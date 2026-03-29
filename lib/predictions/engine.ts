// Step 6 Predictive Module — fastest-lap prediction engine.
//
// computeFastestLapPrediction(input):
//   Computes and writes a fastest_lap prediction for one car at one circuit.
//   Data sources, in priority order:
//     1. Car has round_aggregate CarCircuitPerformance at this circuit (2026 data)
//        → confidence escalates with number of rounds (low/medium/high)
//     2. No 2026 data at this circuit → circuit similarity inference
//        → top-3 similar circuits by 5D Euclidean profile distance
//        → weighted pace delta (weight = similarity score)
//        → confidence = low
//     3. No comparable data anywhere → returns false, no write
//
//   Lap time estimate:
//     estimatedMs = circuitBaseline × adjustmentFactor × qualiRaceDelta
//     adjustmentFactor = 1 − (carPace − fieldMean) × 0.005
//     qualiRaceDelta = observed circuit ratio OR 1.018 default
//
//   Amendment chain:
//     Creates new prediction → supersedes previous model prediction (if any).
//     On the FIRST model output for a (car, circuit) pair, the editorial
//     baseline (source_type='editorial', round_valid_from=0) is also superseded
//     in the same $transaction.
//
// runPredictionEngineForSession(target):
//   Entry point called from lib/ingestion/pipeline.ts after analytics enrichment.
//   Runs computeFastestLapPrediction for every active car in the session's season.
//   Non-fatal: each car's failure is caught and appended to the errors list.
//
// Writes to:
//   predictions — prediction_type='fastest_lap', source_type='model'
//
// All predictions carry:
//   source_type = model
//   round_valid_from = roundNumber
//   provenance_id (derived, stale_threshold_hours = 24)
//   margin_of_error_ms from MARGIN_OF_ERROR_BY_CONFIDENCE

import { prisma } from "@/lib/db/client";
import { rawPrisma } from "@/lib/db/client";
import { createProvenance } from "@/lib/ingestion/provenance";
import { dataPointsToConfidence } from "@/lib/analytics/confidence";
import { findSimilarCircuits } from "@/lib/predictions/circuit-similarity";
import {
  estimateLapTime,
  formatLapTime,
  MARGIN_OF_ERROR_BY_CONFIDENCE,
} from "@/lib/predictions/fastest-lap";
import { computeQualiRaceDelta } from "@/lib/predictions/quali-race-delta";
import type { FastestLapEstimateInput, PredictionEngineResult } from "@/lib/predictions/types";
import type { SessionType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Core prediction — one car at one circuit
// ---------------------------------------------------------------------------

// Computes and writes a fastest_lap prediction for a single car+circuit.
// Returns true if a prediction was written, false if there was insufficient
// data to produce an estimate (e.g., no circuit profile or no car data
// anywhere in the season).
export async function computeFastestLapPrediction(
  input: FastestLapEstimateInput
): Promise<boolean> {
  const { carId, circuitId, roundId, roundNumber } = input;

  // 1. Load circuit profile for baseline lap time and profile dimensions.
  const profile = await prisma.circuitProfile.findFirst({
    where: { circuit_id: circuitId, deleted_at: null },
    select: {
      baseline_fastest_lap_s: true,
      drag_sensitivity: true,
      traction_demand: true,
      braking_intensity: true,
      overtaking_potential: true,
      aero_zone_value: true,
    },
  });

  if (!profile) return false;

  const baselineMs = profile.baseline_fastest_lap_s * 1000;

  // 2. Load car's round_aggregate records at this specific circuit.
  const carCircuitRecords = await rawPrisma.carCircuitPerformance.findMany({
    where: {
      car_id: carId,
      circuit_id: circuitId,
      session_type: "round_aggregate",
      superseded_at: null,
      deleted_at: null,
      one_lap_pace: { not: null },
    },
    orderBy: { calculated_at: "desc" },
    take: 3,
    select: { one_lap_pace: true },
  });

  // 3. Field mean one_lap_pace at this circuit.
  const fieldRecords = await rawPrisma.carCircuitPerformance.findMany({
    where: {
      circuit_id: circuitId,
      session_type: "round_aggregate",
      superseded_at: null,
      deleted_at: null,
      one_lap_pace: { not: null },
    },
    select: { one_lap_pace: true },
  });

  const fieldPaces = fieldRecords
    .map((r) => r.one_lap_pace)
    .filter((p): p is number => p !== null);

  // Default to 5.0 (mid-range of the 0–10 scale) when no field data exists yet.
  const fieldMean =
    fieldPaces.length > 0
      ? fieldPaces.reduce((s, p) => s + p, 0) / fieldPaces.length
      : 5.0;

  // 4. Determine car pace and confidence.
  let carPace: number;
  let confidence: "low" | "medium" | "high";
  let dataSourceNote: string;

  if (carCircuitRecords.length > 0) {
    // Car has 2026 data at this circuit.
    const carPaces = carCircuitRecords
      .map((r) => r.one_lap_pace)
      .filter((p): p is number => p !== null);
    carPace = carPaces.reduce((s, p) => s + p, 0) / carPaces.length;
    confidence = dataPointsToConfidence(carCircuitRecords.length);
    dataSourceNote = `${carCircuitRecords.length} round(s) at circuit`;
  } else {
    // No data at this circuit — fall back to circuit similarity.
    const similarCircuits = await findSimilarCircuits(circuitId, 3);

    if (similarCircuits.length === 0) return false;

    let weightedDeltaSum = 0;
    let weightSum = 0;

    for (const sim of similarCircuits) {
      // Car's most recent round_aggregate at this similar circuit.
      const simRecord = await rawPrisma.carCircuitPerformance.findFirst({
        where: {
          car_id: carId,
          circuit_id: sim.circuitId,
          session_type: "round_aggregate",
          superseded_at: null,
          deleted_at: null,
          one_lap_pace: { not: null },
        },
        orderBy: { calculated_at: "desc" },
        select: { one_lap_pace: true },
      });

      if (simRecord?.one_lap_pace == null) continue;

      // Field mean at the similar circuit for a meaningful delta.
      const simFieldRecords = await rawPrisma.carCircuitPerformance.findMany({
        where: {
          circuit_id: sim.circuitId,
          session_type: "round_aggregate",
          superseded_at: null,
          deleted_at: null,
          one_lap_pace: { not: null },
        },
        select: { one_lap_pace: true },
      });

      const simPaces = simFieldRecords
        .map((r) => r.one_lap_pace)
        .filter((p): p is number => p !== null);

      if (simPaces.length === 0) continue;

      const simFieldMean =
        simPaces.reduce((s, p) => s + p, 0) / simPaces.length;
      const paceDelta = simRecord.one_lap_pace - simFieldMean;

      weightedDeltaSum += paceDelta * sim.similarity;
      weightSum += sim.similarity;
    }

    if (weightSum === 0) return false; // car has no data at any similar circuit

    const avgWeightedDelta = weightedDeltaSum / weightSum;
    // Re-express as absolute pace: field mean at target circuit + weighted delta.
    carPace = fieldMean + avgWeightedDelta;
    confidence = "low";
    const ids = similarCircuits.map((s) => s.circuitId.slice(0, 8)).join(", ");
    dataSourceNote = `circuit similarity (${similarCircuits.length} circuits: ${ids}…)`;
  }

  // 5. Estimate lap time and apply qualifying-to-race delta.
  const rawEstimateMs = estimateLapTime(baselineMs, carPace, fieldMean);
  const { delta: qualiRaceDelta, dataSource: deltaSource } =
    await computeQualiRaceDelta(circuitId);
  const estimatedMs = Math.round(rawEstimateMs * qualiRaceDelta);

  const marginOfError = MARGIN_OF_ERROR_BY_CONFIDENCE[confidence];
  const display = `${formatLapTime(estimatedMs)} PREDICTED`;

  // 6. Provenance record (created outside the transaction per project convention).
  const provenanceId = await createProvenance({
    sourceType: "predicted",
    staleThresholdHours: 24,
    documentReference: `fastest_lap for car=${carId} circuit=${circuitId} round=${roundNumber}`,
  });

  // 7. Write prediction and handle amendment chain inside a single transaction.
  //
  //    RACE CONDITION GUARD: both the "existing model prediction" check and the
  //    "editorial baseline" check are performed INSIDE the transaction, not before
  //    it. If two concurrent requests both reach this point simultaneously, the
  //    second transaction's reads will observe the first transaction's committed
  //    writes before deciding what to supersede.
  //
  //    Isolation guarantee:
  //      SQLite (dev) — serializable by default; only one writer at a time.
  //      PostgreSQL (prod) — interactive transactions run at READ COMMITTED by
  //      default. With READ COMMITTED, two concurrent transactions could still
  //      both read existing=null if neither has committed yet. The practical
  //      risk is low (session ingestion is single-threaded per round), but for
  //      hard safety in production, add a partial unique index:
  //        UNIQUE (car_id, circuit_id, prediction_type)
  //        WHERE superseded_at IS NULL AND source_type = 'model'
  //      This causes the second transaction to fail with a unique violation
  //      rather than silently creating a duplicate active prediction.
  await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction — atomically consistent with the write below.
    const existingModel = await tx.prediction.findFirst({
      where: {
        prediction_type: "fastest_lap",
        car_id: carId,
        circuit_id: circuitId,
        source_type: "model",
        superseded_at: null,
      },
      select: { id: true },
    });

    const newPred = await tx.prediction.create({
      data: {
        prediction_type: "fastest_lap",
        car_id: carId,
        circuit_id: circuitId,
        round_id: roundId,
        round_valid_from: roundNumber,
        predicted_value: estimatedMs,
        predicted_value_display: display,
        margin_of_error_ms: marginOfError,
        confidence,
        source_type: "model",
        editorial_rationale: `Source: ${dataSourceNote}. Q→Race delta: ${qualiRaceDelta.toFixed(4)} (${deltaSource}).`,
        provenance_id: provenanceId,
      },
      select: { id: true },
    });

    if (existingModel) {
      // Recalibration: supersede previous model prediction.
      await tx.prediction.update({
        where: { id: existingModel.id },
        data: {
          superseded_at: new Date(),
          superseded_by_id: newPred.id,
          amendment_reason: "Fastest lap prediction recalibrated with new session data",
        },
      });
    } else {
      // First model output for this car+circuit: supersede editorial baseline
      // if one exists. Checked here (not outside) to avoid TOCTOU race.
      const editorialBaseline = await tx.prediction.findFirst({
        where: {
          prediction_type: "fastest_lap",
          car_id: carId,
          circuit_id: circuitId,
          source_type: "editorial",
          superseded_at: null,
        },
        select: { id: true },
      });

      if (editorialBaseline) {
        await tx.prediction.update({
          where: { id: editorialBaseline.id },
          data: {
            superseded_at: new Date(),
            superseded_by_id: newPred.id,
            amendment_reason: "Superseded by first model output after Round 1",
          },
        });
      }
    }
  });

  return true;
}

// ---------------------------------------------------------------------------
// Batch entry point — called from lib/ingestion/pipeline.ts
// ---------------------------------------------------------------------------

// Runs computeFastestLapPrediction for every active car in the season after
// a session is ingested. Each car's failure is non-fatal and appended to errors.
export async function runPredictionEngineForSession({
  season,
  roundNumber,
}: {
  season: number;
  roundNumber: number;
  sessionType: SessionType; // passed through from pipeline; not used internally
}): Promise<PredictionEngineResult> {
  const errors: string[] = [];
  let predictionsWritten = 0;

  const round = await prisma.round.findFirst({
    where: { season, round_number: roundNumber },
    select: { id: true, circuit_id: true },
  });

  if (!round) {
    return {
      success: false,
      predictionsWritten: 0,
      errors: [
        `Round not found: season=${season} round=${roundNumber}`,
      ],
    };
  }

  // Run predictions for all active cars this season.
  const allCars = await prisma.car.findMany({
    where: { season, deleted_at: null },
    select: { id: true },
  });

  for (const car of allCars) {
    try {
      const wrote = await computeFastestLapPrediction({
        carId: car.id,
        circuitId: round.circuit_id,
        roundId: round.id,
        roundNumber,
      });
      if (wrote) predictionsWritten++;
    } catch (err) {
      errors.push(`car=${car.id}: ${String(err)}`);
    }
  }

  return {
    success: predictionsWritten > 0 || errors.length === 0,
    predictionsWritten,
    errors,
  };
}
