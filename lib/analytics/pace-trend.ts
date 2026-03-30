// Pace trend — rate of change in one_lap_pace across sequential rounds for a car.
//
// Calculated from the car's round_aggregate CarCircuitPerformance records,
// sorted by round_number ascending. Because a car visits different circuits
// each round, raw pace values are not directly comparable across circuits.
// The trend is therefore computed on z-score-normalised values: each round's
// one_lap_pace is expressed as a deviation from the season-wide mean and
// standard deviation of all cars' one_lap_pace for that same round.
//
// Normalised pace trend (NPT):
//   z_i = (car_pace_round_i − field_mean_round_i) / field_std_round_i
//   trend = slope of linear regression on z_i values vs round_number
//
// Stored as prediction_type='track_fit' with:
//   predicted_value = trend slope (positive = improving, negative = declining)
//   predicted_value_display = formatted trend string e.g. "+0.12/round"
//   editorial_rationale = metadata about the regression window
//
// Minimum data points required: 2 rounds. Below that, returns null (no write).
// Confidence scales with data points using the standard dataPointsToConfidence rule.

import { prisma } from "@/lib/db/client";
import { rawPrisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { createProvenance } from "@/lib/ingestion/provenance";
import { dataPointsToConfidence } from "@/lib/analytics/confidence";

// ---------------------------------------------------------------------------
// Pure computation — no DB access
// ---------------------------------------------------------------------------

interface RoundPacePoint {
  roundNumber: number;
  carPace: number;
  fieldMean: number;
  fieldStd: number;
}

function zScore(carPace: number, fieldMean: number, fieldStd: number): number {
  if (fieldStd === 0) return 0;
  return (carPace - fieldMean) / fieldStd;
}

// Ordinary least-squares slope of y = a + b*x, returns b.
function olsSlope(points: { x: number; y: number }[]): number | null {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

export function computePaceTrendSlope(
  points: RoundPacePoint[]
): number | null {
  if (points.length < 2) return null;
  const zPoints = points.map((p) => ({
    x: p.roundNumber,
    y: zScore(p.carPace, p.fieldMean, p.fieldStd),
  }));
  const slope = olsSlope(zPoints);
  return slope !== null ? Math.round(slope * 10000) / 10000 : null;
}

// ---------------------------------------------------------------------------
// DB reader + writer
// ---------------------------------------------------------------------------

// Load the pace data needed for trend computation for a specific car.
// Queries the last `maxRounds` round_aggregate records for this car,
// joined with field-wide stats for the same rounds.
async function loadPacePoints(
  carId: string,
  maxRounds = 10
): Promise<RoundPacePoint[]> {
  // Car's round_aggregate records (non-superseded)
  const carRecords = await rawPrisma.carCircuitPerformance.findMany({
    where: {
      car_id: carId,
      session_type: "round_aggregate",
      superseded_at: null,
      deleted_at: null,
      one_lap_pace: { not: null },
    },
    include: { round: { select: { round_number: true, id: true } } },
    orderBy: { round: { round_number: "asc" } },
    take: maxRounds,
  });

  if (carRecords.length < 2) return [];

  const points: RoundPacePoint[] = [];

  for (const record of carRecords) {
    // Field stats: all cars' one_lap_pace for the same round (round_aggregate)
    const fieldRecords = await rawPrisma.carCircuitPerformance.findMany({
      where: {
        round_id: record.round_id,
        session_type: "round_aggregate",
        superseded_at: null,
        deleted_at: null,
        one_lap_pace: { not: null },
      },
      select: { one_lap_pace: true },
    });

    const paces = fieldRecords
      .map((r) => r.one_lap_pace)
      .filter((p): p is number => p !== null);

    if (paces.length < 2) continue;

    const fieldMean = paces.reduce((s, p) => s + p, 0) / paces.length;
    const fieldStd = Math.sqrt(
      paces.reduce((s, p) => s + (p - fieldMean) ** 2, 0) / paces.length
    );

    points.push({
      roundNumber: record.round.round_number,
      carPace: record.one_lap_pace!,
      fieldMean,
      fieldStd,
    });
  }

  return points;
}

// Compute and write the pace trend prediction for a car.
// No-ops silently if fewer than 2 rounds of data exist.
//
// STORAGE NOTE — circuit_id is a storage artifact, not a filter dimension:
//   The slope computed here is SEASON-WIDE. loadPacePoints queries all of the
//   car's round_aggregate records with NO circuit_id filter, using z-score
//   normalisation to make pace values comparable across circuits of varying
//   difficulty. The slope measures the car's development trajectory over the
//   season (positive = improving relative to field, negative = declining).
//
//   circuit_id is passed as a parameter only because the predictions table
//   requires a non-nullable circuit_id FK. It is set to the circuit of the
//   round_aggregate record that triggered this enrichment run.
//
//   Consequence: after N rounds, the same slope value is stored as N separate
//   prediction records (one per circuit visited), each superseding the previous.
//   This redundancy is intentional — the amendment chain preserves history.
//
//   UI INSTRUCTION: read the pace trend from the car's most recent active
//   prediction WHERE prediction_type = 'track_fit' AND source_type = 'model'
//   AND editorial_rationale LIKE 'OLS slope%', ordered by round_valid_from DESC.
//   Do NOT filter by circuit_id when displaying the season-wide trend.
export async function writePaceTrendPrediction(
  carId: string,
  circuitId: string,
  roundId: string | null,
  roundValidFrom: number
): Promise<void> {
  const points = await loadPacePoints(carId);
  if (points.length < 2) return;

  const slope = computePaceTrendSlope(points);
  if (slope === null) return;

  const confidence = dataPointsToConfidence(points.length);
  const provenanceId = await createProvenance({
    sourceType: "derived",
    staleThresholdHours: 24,
    documentReference: `Pace trend slope for car=${carId}, ${points.length} rounds`,
  });

  const trendDisplay =
    (slope >= 0 ? "+" : "") + slope.toFixed(4) + " z/round";

  // Supersede existing active pace trend prediction for this car+circuit.
  const existing = await rawPrisma.prediction.findFirst({
    where: {
      prediction_type: "track_fit",
      car_id: carId,
      circuit_id: circuitId,
      superseded_at: null,
      // Distinguish trend predictions by editorial_rationale prefix check is
      // fragile; we rely on there being only one active track_fit per car+circuit.
      // If track-fit.ts already wrote one this cycle, it will be found here.
      // That is acceptable — the trend prediction supersedes the raw score.
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const newPrediction = await tx.prediction.create({
      data: {
        prediction_type: "track_fit",
        car_id: carId,
        circuit_id: circuitId,
        round_id: roundId,
        round_valid_from: roundValidFrom,
        predicted_value: slope,
        predicted_value_display: trendDisplay,
        confidence,
        source_type: "model",
        editorial_rationale: `OLS slope over ${points.length} rounds (z-score normalised). Positive = improving relative to field.`,
        provenance_id: provenanceId,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.prediction.update({
        where: { id: existing.id },
        data: {
          superseded_at: new Date(),
          superseded_by_id: newPrediction.id,
          amendment_reason: "Pace trend recalculated with new round data",
        },
      });
    }
  });
}
