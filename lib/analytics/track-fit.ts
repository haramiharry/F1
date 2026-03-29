// Track fit scoring — composite 0–10 score for a car's suitability to a circuit.
//
// Computed as a weighted average of the five primary performance dimensions:
//   one_lap_pace, long_run_pace, straight_line_efficiency,
//   cornering_performance, tyre_behaviour
//
// Base weights:
//   one_lap_pace          0.30  (universal relevance — always included)
//   long_run_pace         0.20  (race pace; lower if only FP/quali data)
//   straight_line         0.15  (scaled up by drag_sensitivity)
//   cornering             0.20  (scaled up by traction_demand + braking_intensity)
//   tyre_behaviour        0.15  (scaled by overtaking_potential as a proxy for race management)
//
// Circuit-adjusted weights: the base weights are modulated by the circuit profile
// so a Monza-style circuit weighs straight-line heavily while a Monaco-style
// circuit weights cornering heavily. After modulation, weights are normalised
// so they sum to 1.0 across available (non-null) metrics.
//
// Written to the predictions table as prediction_type='track_fit' with
//   source_type='model', confidence from the car+circuit data count.

import { prisma } from "@/lib/db/client";
import { rawPrisma } from "@/lib/db/client";
import { createProvenance } from "@/lib/ingestion/provenance";
import { computeConfidence } from "@/lib/analytics/confidence";
import type { DimensionScores, CircuitAnalyticsContext } from "@/lib/analytics/types";

// ---------------------------------------------------------------------------
// Pure computation — no DB access
// ---------------------------------------------------------------------------

interface TrackFitWeights {
  one_lap_pace: number;
  long_run_pace: number;
  straight_line_efficiency: number;
  cornering_performance: number;
  tyre_behaviour: number;
}

function circuitAdjustedWeights(ctx: CircuitAnalyticsContext): TrackFitWeights {
  return {
    one_lap_pace: 0.30,
    long_run_pace: 0.20,
    // Straight-line weight scales from 0.10 to 0.25 with drag_sensitivity
    straight_line_efficiency: 0.10 + (ctx.drag_sensitivity / 10) * 0.15,
    // Cornering weight scales from 0.10 to 0.30 with combined traction+braking
    cornering_performance: 0.10 + ((ctx.traction_demand + ctx.braking_intensity) / 20) * 0.20,
    // Tyre weight scales slightly with overtaking_potential (race management importance)
    tyre_behaviour: 0.10 + (ctx.overtaking_potential / 10) * 0.10,
  };
}

export function computeTrackFitScore(
  scores: DimensionScores,
  ctx: CircuitAnalyticsContext
): number | null {
  const weights = circuitAdjustedWeights(ctx);

  type MetricKey = keyof TrackFitWeights;
  const keys: MetricKey[] = [
    "one_lap_pace",
    "long_run_pace",
    "straight_line_efficiency",
    "cornering_performance",
    "tyre_behaviour",
  ];

  // Collect available (non-null) metrics and their weights.
  const available = keys
    .map((k) => ({ key: k, value: scores[k], weight: weights[k] }))
    .filter((item): item is { key: MetricKey; value: number; weight: number } =>
      item.value !== null
    );

  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  const score = available.reduce(
    (sum, item) => sum + (item.weight / totalWeight) * item.value,
    0
  );

  return Math.round(score * 100) / 100;
}

// ---------------------------------------------------------------------------
// DB writer — creates or supersedes the track_fit prediction for this car+circuit
// ---------------------------------------------------------------------------

export async function writeTrackFitPrediction({
  carId,
  circuitId,
  roundId,
  roundValidFrom,
  score,
  ctx,
}: {
  carId: string;
  circuitId: string;
  roundId: string | null;
  roundValidFrom: number;
  score: number;
  ctx: CircuitAnalyticsContext;
}): Promise<void> {
  const confidence = await computeConfidence(carId, circuitId);

  const provenanceId = await createProvenance({
    sourceType: "derived",
    staleThresholdHours: 24,
    documentReference: `track_fit score for car=${carId} circuit=${circuitId} round=${roundId ?? "pre-season"}`,
  });

  // Supersede existing active track_fit prediction for this car+circuit, if any.
  const existing = await rawPrisma.prediction.findFirst({
    where: {
      prediction_type: "track_fit",
      car_id: carId,
      circuit_id: circuitId,
      superseded_at: null,
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    const newPrediction = await tx.prediction.create({
      data: {
        prediction_type: "track_fit",
        car_id: carId,
        circuit_id: circuitId,
        round_id: roundId,
        round_valid_from: roundValidFrom,
        predicted_value: score,
        predicted_value_display: score.toFixed(1),
        confidence,
        source_type: "model",
        editorial_rationale: `Composite score from ${Object.entries(ctx)
          .filter(([k]) => k !== "dab_zone_count")
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`,
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
          amendment_reason: "Track fit score recalculated with new session data",
        },
      });
    }
  });
}
