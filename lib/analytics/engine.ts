// Analytics enrichment engine.
//
// enrichRecord(recordId):
//   Takes a CarCircuitPerformance record id that was written by the Step 4
//   processors (session-performance.ts or round-aggregate.ts) with only
//   one_lap_pace and long_run_pace populated. Computes the remaining derived
//   dimensions, determines confidence, and supersedes the Step 4 record
//   with a fully enriched record.
//
//   Enrichment marker: x_mode_effectiveness IS NULL.
//   x_mode_effectiveness is populated for every record that has a non-null
//   one_lap_pace, regardless of session type. Step 4 processors never write it.
//
//   Dimension population by session type:
//     straight_line_efficiency  round_aggregate only (cross-circuit signal required)
//     cornering_performance     round_aggregate only (cross-circuit signal required)
//     tyre_behaviour            any session where both pace metrics are present
//     x_mode_effectiveness      all sessions with one_lap_pace (enrichment marker)
//     z_mode_effectiveness      all sessions with one_lap_pace
//
//   straight_line_efficiency and cornering_performance are null for fp1/fp2/fp3/
//   qualifying/sprint_qualifying/sprint records. At a single circuit, two cars
//   with identical one_lap_pace produce identical scores — the car-level signal
//   only emerges when comparing the same car's pace across circuits of different
//   drag_sensitivity / traction_demand. That cross-circuit comparison is only
//   meaningful for round_aggregate records.
//
// enrichSessionRecords(target):
//   Finds all unenriched active records for a session and calls enrichRecord
//   on each. Called from pipeline.ts after every ingestSession.
//
// Writes to:
//   car_circuit_performance — amendment chain (Step 4 record → enriched record)
//   predictions (track_fit) — via track-fit.ts (round_aggregate sessions only)
//   predictions (track_fit) — pace trend via pace-trend.ts (round_aggregate only)
//   predictions (aero_effectiveness) — X vs Z Mode advantage, only when
//     round.dab_zones_confirmed = true. If false, the prediction is skipped.
//     POST /api/analytics/recalculate will pick it up after admin promotion.
//
// Confidence auto-set to LOW before Round 1 (0 prior data points), escalating
// to MEDIUM (1–2 sessions) then HIGH (3+ sessions) as data accumulates.

import { prisma } from "@/lib/db/client";
import { rawPrisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { createProvenance } from "@/lib/ingestion/provenance";
import { computeConfidence } from "@/lib/analytics/confidence";
import { computeStraightLineEfficiency } from "@/lib/analytics/metrics/straight-line";
import { computeCorneringPerformance } from "@/lib/analytics/metrics/cornering";
import { computeTyreBehaviour } from "@/lib/analytics/metrics/tyre";
import {
  computeXModeEffectiveness,
  computeZModeEffectiveness,
} from "@/lib/analytics/metrics/active-aero";
import {
  computeTrackFitScore,
  writeTrackFitPrediction,
} from "@/lib/analytics/track-fit";
import { writePaceTrendPrediction } from "@/lib/analytics/pace-trend";
import type {
  CircuitAnalyticsContext,
  DimensionScores,
  AnalyticsResult,
  SessionEnrichmentTarget,
} from "@/lib/analytics/types";

// ---------------------------------------------------------------------------
// Context loader
// ---------------------------------------------------------------------------

async function loadCircuitContext(
  circuitId: string,
  roundId: string
): Promise<CircuitAnalyticsContext | null> {
  const profile = await prisma.circuitProfile.findFirst({
    where: { circuit_id: circuitId },
    select: {
      drag_sensitivity: true,
      traction_demand: true,
      braking_intensity: true,
      overtaking_potential: true,
      aero_zone_value: true,
    },
  });

  if (!profile) return null;

  const dabZoneCount = await rawPrisma.circuitDabZone.count({
    where: { circuit_id: circuitId, round_id: roundId, superseded_at: null },
  });

  return { ...profile, dab_zone_count: dabZoneCount };
}

// ---------------------------------------------------------------------------
// Aero effectiveness prediction writer
// ---------------------------------------------------------------------------

async function writeAeroPrediction({
  carId,
  circuitId,
  roundId,
  roundValidFrom,
  xMode,
  zMode,
}: {
  carId: string;
  circuitId: string;
  roundId: string | null;
  roundValidFrom: number;
  xMode: number | null;
  zMode: number | null;
}): Promise<void> {
  if (xMode === null || zMode === null) return;

  const advantage = Math.round((xMode - zMode) * 100) / 100;
  const confidence = await computeConfidence(carId, circuitId);

  const provenanceId = await createProvenance({
    sourceType: "derived",
    staleThresholdHours: 24,
    documentReference: `aero_effectiveness for car=${carId} circuit=${circuitId}`,
  });

  const existing = await rawPrisma.prediction.findFirst({
    where: {
      prediction_type: "aero_effectiveness",
      car_id: carId,
      circuit_id: circuitId,
      superseded_at: null,
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const newPred = await tx.prediction.create({
      data: {
        prediction_type: "aero_effectiveness",
        car_id: carId,
        circuit_id: circuitId,
        round_id: roundId,
        round_valid_from: roundValidFrom,
        predicted_value: advantage,
        predicted_value_display:
          advantage >= 0
            ? `X+${advantage.toFixed(2)}`
            : `Z+${Math.abs(advantage).toFixed(2)}`,
        confidence,
        source_type: "model",
        editorial_rationale: `x_mode=${xMode.toFixed(2)} z_mode=${zMode.toFixed(2)} advantage=${advantage >= 0 ? "X" : "Z"}`,
        provenance_id: provenanceId,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.prediction.update({
        where: { id: existing.id },
        data: {
          superseded_at: new Date(),
          superseded_by_id: newPred.id,
          amendment_reason: "Aero effectiveness recalculated",
        },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Core enrichment — one record at a time
// ---------------------------------------------------------------------------

export async function enrichRecord(recordId: string): Promise<boolean> {
  const record = await rawPrisma.carCircuitPerformance.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      car_id: true,
      circuit_id: true,
      round_id: true,
      session_type: true,
      one_lap_pace: true,
      long_run_pace: true,
      x_mode_effectiveness: true,  // enrichment marker — null = not yet enriched
      superseded_at: true,
      deleted_at: true,
      round: { select: { round_number: true, dab_zones_confirmed: true } },
    },
  });

  // Guard: skip if already enriched, superseded, or deleted.
  if (!record) return false;
  if (record.superseded_at !== null || record.deleted_at !== null) return false;
  if (record.x_mode_effectiveness !== null) return false; // already enriched

  const ctx = await loadCircuitContext(record.circuit_id, record.round_id);
  if (!ctx) {
    // No circuit profile — abort rather than write zero-weight metrics.
    // Admin must create the CircuitProfile record first.
    return false;
  }

  const isAggregate = record.session_type === "round_aggregate";

  // straight_line_efficiency and cornering_performance are cross-circuit metrics:
  // a single circuit visit reveals nothing about a car's general capability in
  // these dimensions. Only populate on round_aggregate records, where the value
  // is computed once the car has visited circuits of varying profile.
  const straight = isAggregate
    ? computeStraightLineEfficiency(record.one_lap_pace, ctx.drag_sensitivity)
    : null;
  const cornering = isAggregate
    ? computeCorneringPerformance(
        record.one_lap_pace,
        ctx.traction_demand,
        ctx.braking_intensity
      )
    : null;

  const tyre = computeTyreBehaviour(record.one_lap_pace, record.long_run_pace);
  // x_mode and z_mode are computed for all sessions — x_mode_effectiveness
  // doubles as the enrichment marker and must always be written.
  const xMode = computeXModeEffectiveness(
    record.one_lap_pace,
    ctx.aero_zone_value,
    ctx.dab_zone_count
  );
  const zMode = computeZModeEffectiveness(
    record.one_lap_pace,
    ctx.aero_zone_value,
    ctx.dab_zone_count
  );

  const scores: DimensionScores = {
    one_lap_pace: record.one_lap_pace,
    long_run_pace: record.long_run_pace,
    straight_line_efficiency: straight,
    cornering_performance: cornering,
    tyre_behaviour: tyre,
    x_mode_effectiveness: xMode,
    z_mode_effectiveness: zMode,
  };

  const confidence = await computeConfidence(record.car_id, record.circuit_id);

  const provenanceId = await createProvenance({
    sourceType: "derived",
    staleThresholdHours: 24,
    documentReference: `Analytics enrichment for ccp=${recordId}`,
  });

  // Supersede Step 4 record with fully enriched record.
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const newRecord = await tx.carCircuitPerformance.create({
      data: {
        car_id: record.car_id,
        circuit_id: record.circuit_id,
        round_id: record.round_id,
        session_type: record.session_type,
        one_lap_pace: scores.one_lap_pace,
        long_run_pace: scores.long_run_pace,
        straight_line_efficiency: scores.straight_line_efficiency,
        cornering_performance: scores.cornering_performance,
        tyre_behaviour: scores.tyre_behaviour,
        x_mode_effectiveness: scores.x_mode_effectiveness,
        z_mode_effectiveness: scores.z_mode_effectiveness,
        amendment_reason: "Analytics enrichment (Step 5)",
        provenance_id: provenanceId,
      },
      select: { id: true },
    });

    await tx.carCircuitPerformance.update({
      where: { id: record.id },
      data: {
        superseded_at: new Date(),
        superseded_by_id: newRecord.id,
      },
    });
  });

  const roundValidFrom = record.round.round_number;

  // Predictions are only written for round_aggregate records (post-race)
  // to avoid flooding the predictions table with per-session intermediates.
  if (record.session_type === "round_aggregate") {
    const trackFitScore = computeTrackFitScore(scores, ctx);

    if (trackFitScore !== null) {
      await writeTrackFitPrediction({
        carId: record.car_id,
        circuitId: record.circuit_id,
        roundId: record.round_id,
        roundValidFrom,
        score: trackFitScore,
        ctx,
      });
    }

    await writePaceTrendPrediction(
      record.car_id,
      record.circuit_id,
      record.round_id,
      roundValidFrom
    );
  }

  // Aero effectiveness prediction is only valid once the admin has confirmed
  // the circuit's DAB zone boundaries via the staging → promote flow.
  // round.dab_zones_confirmed is set when the last staging record for the round
  // is promoted. If false, dab_zone_count in ctx would be 0, silently inflating
  // z_mode_effectiveness and producing a misleading prediction.
  // Skipping here is safe: POST /api/analytics/recalculate (force=false) will
  // pick up all unenriched records after admin promotion and write the prediction.
  if (xMode !== null && zMode !== null && record.round.dab_zones_confirmed) {
    await writeAeroPrediction({
      carId: record.car_id,
      circuitId: record.circuit_id,
      roundId: record.round_id,
      roundValidFrom,
      xMode,
      zMode,
    });
  }

  return true;
}

// ---------------------------------------------------------------------------
// Batch enrichment — all unenriched records for a session
// ---------------------------------------------------------------------------

// Records are considered unenriched when x_mode_effectiveness IS NULL.
// x_mode_effectiveness is populated for every record with a non-null one_lap_pace.
// Step 4 processors never write it. straight_line_efficiency is NOT used as the
// marker because it is intentionally null on all per-session (non-aggregate) records.
export async function enrichSessionRecords(
  target: SessionEnrichmentTarget
): Promise<AnalyticsResult> {
  const errors: string[] = [];
  let recordsEnriched = 0;
  let predictionsWritten = 0;

  // Resolve round id.
  const round = await prisma.round.findFirst({
    where: {
      season: target.season,
      round_number: target.roundNumber,
    },
    select: { id: true },
  });

  if (!round) {
    return {
      success: false,
      recordsEnriched: 0,
      predictionsWritten: 0,
      errors: [
        `Round not found: season=${target.season} round=${target.roundNumber}`,
      ],
    };
  }

  // Find all active, unenriched records for this round + session_type.
  const unenriched = await rawPrisma.carCircuitPerformance.findMany({
    where: {
      round_id: round.id,
      session_type: target.sessionType,
      superseded_at: null,
      deleted_at: null,
      x_mode_effectiveness: null, // enrichment marker — see file header
    },
    select: { id: true },
  });

  for (const { id } of unenriched) {
    try {
      const enriched = await enrichRecord(id);
      if (enriched) {
        recordsEnriched++;
        // Count predictions as a best-effort estimate (3 types possible per record)
        predictionsWritten += target.sessionType === "round_aggregate" ? 2 : 1;
      }
    } catch (err) {
      errors.push(`Failed to enrich record ${id}: ${String(err)}`);
    }
  }

  return {
    success: recordsEnriched > 0 || unenriched.length === 0,
    recordsEnriched,
    predictionsWritten,
    errors,
  };
}
