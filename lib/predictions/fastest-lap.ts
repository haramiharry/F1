// Fastest-lap estimation utilities — pure functions, no DB access.
//
// estimateLapTime:
//   Adjusts the circuit's baseline fastest lap (from CircuitProfile) by the
//   car's normalised pace relative to the field mean at that circuit.
//
//   Formula:
//     adjustmentFactor = 1 − (carPace − fieldMean) × PACE_UNIT_PCT
//     estimatedMs      = baselineMs × adjustmentFactor
//
//   PACE_UNIT_PCT = 0.005: each unit of one_lap_pace above or below the field
//   mean maps to a 0.5% adjustment in lap time. A car with pace = 8 vs field
//   mean = 5 (3 units above) is estimated to be 1.5% faster than the baseline.
//
//   The formula is intentionally simple: it anchors to an observed circuit
//   baseline and scales linearly. It does not attempt to model tyre deg,
//   fuel load, or track evolution.
//
// formatLapTime:
//   Converts milliseconds to the canonical F1 display format: M:SS.mmm
//   e.g. 82091ms → "1:22.091"
//
// MARGIN_OF_ERROR_BY_CONFIDENCE:
//   Represents ±ms uncertainty on the predicted lap time.
//   HIGH   → ±300ms  (3+ rounds of real data at this circuit)
//   MEDIUM → ±800ms  (1–2 rounds, or circuit-similarity inference)
//   LOW    → ±2000ms (pre-season or no comparable data)

import type { ConfidenceLevel } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Each unit of one_lap_pace above/below field mean = 0.5% of lap time.
const PACE_UNIT_PCT = 0.005;

export const MARGIN_OF_ERROR_BY_CONFIDENCE: Record<ConfidenceLevel, number> = {
  high: 300,
  medium: 800,
  low: 2000,
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

// Estimate the fastest lap time (milliseconds) for a car at a circuit.
//
// baselineMs   — circuit's baseline_fastest_lap_s × 1000
// carPace      — car's mean one_lap_pace at this circuit (or similarity-weighted)
// fieldMean    — field mean one_lap_pace at this circuit (default 5.0 if no data)
export function estimateLapTime(
  baselineMs: number,
  carPace: number,
  fieldMean: number
): number {
  const adjustmentFactor = 1 - (carPace - fieldMean) * PACE_UNIT_PCT;
  return Math.round(baselineMs * adjustmentFactor);
}

// Format milliseconds to M:SS.mmm
// e.g. 82091 → "1:22.091"
export function formatLapTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis
    .toString()
    .padStart(3, "0")}`;
}
