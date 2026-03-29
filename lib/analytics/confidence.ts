// Confidence level for a car × circuit data combination.
//
// From the schema comment:
//   low    = pre-season only / no 2026 race data for this car+circuit combo
//   medium = 1-2 sessions or circuit-similarity inference
//   high   = 3+ sessions of 2026 data for this car+circuit combo
//
// "Session" here means a distinct non-superseded CarCircuitPerformance record
// for the (car_id, circuit_id) pair. We count them via rawPrisma so superseded
// records from previous analytics runs don't inflate the count.

import { rawPrisma } from "@/lib/db/client";
import type { ConfidenceLevel } from "@prisma/client";

export function dataPointsToConfidence(dataPoints: number): ConfidenceLevel {
  if (dataPoints >= 3) return "high";
  if (dataPoints >= 1) return "medium";
  return "low";
}

export async function computeConfidence(
  carId: string,
  circuitId: string
): Promise<ConfidenceLevel> {
  const count = await rawPrisma.carCircuitPerformance.count({
    where: {
      car_id: carId,
      circuit_id: circuitId,
      superseded_at: null,
      deleted_at: null,
    },
  });
  // Subtract 1 because we're about to write the new record — it doesn't
  // count toward the data the new record was computed from.
  return dataPointsToConfidence(Math.max(0, count - 1));
}
