// Circuit similarity model — 5D Euclidean distance in circuit profile space.
//
// The five profile dimensions (all 0–10 float scale):
//   drag_sensitivity, traction_demand, braking_intensity,
//   overtaking_potential, aero_zone_value
//
// Distance formula:
//   d = sqrt( Σ w_i × (a_i − b_i)² )   for i in the five dimensions
//
// Maximum possible distance in this space (with equal weights = 1.0):
//   sqrt(5 × 10²) ≈ 22.36
//
// Similarity score:
//   similarity = max(0, 1 − d / MAX_DISTANCE)
//   range: 0 (orthogonal) to 1 (identical profile)
//
// Used by the prediction engine when a car has no 2026 data at the target
// circuit. The top-N most similar circuits are found, and the car's pace at
// those circuits is used as a weighted proxy for its target-circuit pace.
// Weight = similarity score (closer circuits contribute more heavily).
//
// METHODOLOGY DISCLOSURE — dimension weighting:
//   DIMENSION_WEIGHTS below are currently set to 1.0 for all five dimensions,
//   meaning the Euclidean distance treats each profile axis as equally
//   important to circuit similarity. This is an unvalidated assumption.
//
//   The practical consequence for 2026 specifically:
//     drag_sensitivity and braking_intensity have years of F1 circuit
//     characterisation behind them and their 0–10 values reflect a mature
//     calibration. aero_zone_value is a new 2026 dimension (F1 active aero
//     regulations) with no historical anchor; its 0–10 scale was defined
//     editorially for this platform. Treating it with equal weight to
//     drag_sensitivity may over-emphasise an uncalibrated dimension.
//
//   Recalibration path: after Round 6+ of 2026 data, compare predicted vs
//   observed lap times for similarity-inferred circuits and adjust weights.
//   Until then, equal weighting is disclosed on the Methodology page and the
//   PREDICTED label on all similarity-inferred estimates acknowledges this
//   uncertainty. The LOW confidence rating (margin ±2000ms) further signals
//   that similarity-inferred predictions carry higher uncertainty.

import { prisma } from "@/lib/db/client";
import type { CircuitSimilarityScore } from "@/lib/predictions/types";

// ---------------------------------------------------------------------------
// Pure computation — no DB access
// ---------------------------------------------------------------------------

// Dimension weights — all 1.0 (equal) until post-season calibration.
// See methodology disclosure in the file header.
const DIMENSION_WEIGHTS = {
  drag_sensitivity: 1.0,
  traction_demand: 1.0,
  braking_intensity: 1.0,
  overtaking_potential: 1.0,
  aero_zone_value: 1.0,
} as const;

// Max distance recomputed from weights so it stays in sync if weights change.
const MAX_DISTANCE = Math.sqrt(
  Object.values(DIMENSION_WEIGHTS).reduce((s, w) => s + w * 100, 0)
); // ≈ 22.36 with equal weights

interface ProfileDimensions {
  drag_sensitivity: number;
  traction_demand: number;
  braking_intensity: number;
  overtaking_potential: number;
  aero_zone_value: number;
}

export function circuitDistance(
  a: ProfileDimensions,
  b: ProfileDimensions
): number {
  return Math.sqrt(
    DIMENSION_WEIGHTS.drag_sensitivity * (a.drag_sensitivity - b.drag_sensitivity) ** 2 +
      DIMENSION_WEIGHTS.traction_demand * (a.traction_demand - b.traction_demand) ** 2 +
      DIMENSION_WEIGHTS.braking_intensity * (a.braking_intensity - b.braking_intensity) ** 2 +
      DIMENSION_WEIGHTS.overtaking_potential * (a.overtaking_potential - b.overtaking_potential) ** 2 +
      DIMENSION_WEIGHTS.aero_zone_value * (a.aero_zone_value - b.aero_zone_value) ** 2
  );
}

export function distanceToSimilarity(distance: number): number {
  return Math.max(0, 1 - distance / MAX_DISTANCE);
}

// ---------------------------------------------------------------------------
// DB query — sorted similarity list
// ---------------------------------------------------------------------------

// Returns the top `limit` circuits most similar to targetCircuitId,
// sorted ascending by Euclidean distance (closest first).
// Circuits with no CircuitProfile record are excluded.
// The target circuit itself is always excluded from results.
export async function findSimilarCircuits(
  targetCircuitId: string,
  limit = 3
): Promise<CircuitSimilarityScore[]> {
  const targetProfile = await prisma.circuitProfile.findFirst({
    where: { circuit_id: targetCircuitId, deleted_at: null },
    select: {
      drag_sensitivity: true,
      traction_demand: true,
      braking_intensity: true,
      overtaking_potential: true,
      aero_zone_value: true,
    },
  });

  if (!targetProfile) return [];

  const allProfiles = await prisma.circuitProfile.findMany({
    where: {
      circuit_id: { not: targetCircuitId },
      deleted_at: null,
    },
    select: {
      circuit_id: true,
      drag_sensitivity: true,
      traction_demand: true,
      braking_intensity: true,
      overtaking_potential: true,
      aero_zone_value: true,
    },
  });

  const scored: CircuitSimilarityScore[] = (allProfiles as Array<{
    circuit_id: string;
    drag_sensitivity: number;
    traction_demand: number;
    braking_intensity: number;
    overtaking_potential: number;
    aero_zone_value: number;
  }>).map((p) => {
    const distance = circuitDistance(targetProfile, p);
    return {
      circuitId: p.circuit_id,
      distance: Math.round(distance * 10000) / 10000,
      similarity: Math.round(distanceToSimilarity(distance) * 10000) / 10000,
    };
  });

  return scored.sort((a, b) => a.distance - b.distance).slice(0, limit);
}
