export const dynamic = "force-dynamic";
// GET /api/predictions/[carId]/[circuitId]
//
// Returns all active (non-superseded) predictions for a car × circuit pair,
// plus a preSeasonOnly flag that the UI uses to render the pre-season
// disclaimer banner.
//
// preSeasonOnly = true when every active prediction has source_type='editorial'.
//   These records have round_valid_from=0 and represent manually authored
//   pre-season estimates. They are superseded atomically by the first model
//   output from the Step 6 prediction engine after Round 1 data arrives.
//
// Query parameters (all optional):
//   asOfRound=N  — return predictions valid up to and including round N.
//                  Omit to return the latest active predictions (default).
//                  asOfRound=0 returns editorial baselines only.
//
// Response shape:
//   {
//     predictions: Prediction[],
//     preSeasonOnly: boolean
//   }
//
// 404 if neither the car nor the circuit exists in the database.

import { NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db/client";

export async function GET(
  request: Request,
  { params }: { params: { carId: string; circuitId: string } }
): Promise<NextResponse> {
  const { carId, circuitId } = params;
  const { searchParams } = new URL(request.url);
  const asOfRoundParam = searchParams.get("asOfRound");
  const asOfRound =
    asOfRoundParam !== null ? parseInt(asOfRoundParam, 10) : null;

  // Validate car and circuit exist.
  const [car, circuit] = await Promise.all([
    rawPrisma.car.findFirst({
      where: { id: carId, deleted_at: null },
      select: { id: true },
    }),
    rawPrisma.circuit.findFirst({
      where: { id: circuitId, deleted_at: null },
      select: { id: true },
    }),
  ]);

  if (!car || !circuit) {
    return NextResponse.json(
      { error: "Car or circuit not found" },
      { status: 404 }
    );
  }

  // Build the round_valid_from filter.
  // asOfRound=0 → only editorial baselines (round_valid_from=0)
  // asOfRound=N → round_valid_from ≤ N
  // omitted     → no round filter (latest active predictions)
  const roundFilter =
    asOfRound !== null ? { round_valid_from: { lte: asOfRound } } : {};

  const predictions = await rawPrisma.prediction.findMany({
    where: {
      car_id: carId,
      circuit_id: circuitId,
      superseded_at: null,
      ...roundFilter,
    },
    orderBy: [{ prediction_type: "asc" }, { round_valid_from: "desc" }],
    select: {
      id: true,
      prediction_type: true,
      predicted_value: true,
      predicted_value_display: true,
      margin_of_error_ms: true,
      confidence: true,
      source_type: true,
      round_valid_from: true,
      round_id: true,
      editorial_rationale: true,
      depends_on_dab_zones: true,
      created_at: true,
    },
  });

  // preSeasonOnly = true if ALL returned predictions are source_type='editorial'.
  // An empty predictions array is also considered pre-season only (no model data yet).
  const preSeasonOnly =
    predictions.length === 0 ||
    predictions.every((p) => p.source_type === "editorial");

  return NextResponse.json({ predictions, preSeasonOnly });
}
