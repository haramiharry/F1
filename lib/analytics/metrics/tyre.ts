// tyre_behaviour — proxy for tyre management and degradation resistance.
//
// Derived from the gap between long_run_pace and one_lap_pace on the same
// 0–10 scale. A car that sustains race pace close to its qualifying pace
// manages tyres well; one that fades significantly does not.
//
// Formula:
//   tyre_behaviour = clamp(5 + (long_run_pace − one_lap_pace) × 0.5, 0, 10)
//
// Interpretation:
//   long_run_pace = one_lap_pace → score = 5.0 (neutral tyre management)
//   long_run_pace > one_lap_pace by 2 pts → score = 6.0 (mild positive)
//   long_run_pace > one_lap_pace by 6 pts → score = 8.0 (strong degradation resistance)
//   long_run_pace < one_lap_pace by 4 pts → score = 3.0 (notable degradation)
//
// Returns null when either input is null (requires both metrics to be present).
// This is expected pre-season or after FP/quali sessions where long_run_pace
// is not yet populated.
//
// Data source note:
//   long_run_pace for fp2 is a best-lap proxy, not true stint data.
//   The metric is most reliable when computed from round_aggregate records
//   (race session), where long_run_pace reflects actual race degradation.

export function computeTyreBehaviour(
  oneLapPace: number | null,
  longRunPace: number | null
): number | null {
  if (oneLapPace === null || longRunPace === null) return null;
  const score = 5 + (longRunPace - oneLapPace) * 0.5;
  return Math.round(Math.max(0, Math.min(10, score)) * 100) / 100;
}
