// Circuit similarity model — 5D Euclidean distance in circuit profile space.
//
// The five profile dimensions (all 0–10 float scale):
//   drag_sensitivity, traction_demand, braking_intensity,
//   overtaking_potential, aero_zone_value
//
// Distance formula:
//   d = sqrt( Σ (a_i − b_i)² )   for i in the five dimensions
//
// Maximum possible distance in this space:
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

import { prisma } from "@/lib/db/client";
import type { CircuitSimilarityScore } from "@/lib/predictions/types";

// ---------------------------------------------------------------------------
// Pure computation — no DB access
// ---------------------------------------------------------------------------

const MAX_DISTANCE = Math.sqrt(5 * 100); // ≈ 22.36

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
    (a.drag_sensitivity - b.drag_sensitivity) ** 2 +
      (a.traction_demand - b.traction_demand) ** 2 +
      (a.braking_intensity - b.braking_intensity) ** 2 +
      (a.overtaking_potential - b.overtaking_potential) ** 2 +
      (a.aero_zone_value - b.aero_zone_value) ** 2
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

  const scored: CircuitSimilarityScore[] = allProfiles.map((p) => {
    const distance = circuitDistance(targetProfile, p);
    return {
      circuitId: p.circuit_id,
      distance: Math.round(distance * 10000) / 10000,
      similarity: Math.round(distanceToSimilarity(distance) * 10000) / 10000,
    };
  });

  return scored.sort((a, b) => a.distance - b.distance).slice(0, limit);
}
