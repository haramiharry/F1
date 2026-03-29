// straight_line_efficiency — how well the car exploits straight-line speed.
//
// Derived from the car's one_lap_pace on circuits where drag sensitivity
// is the primary lap-time determinant. A circuit with drag_sensitivity = 8
// (e.g. Monza-style) reveals straight-line ability clearly; one with
// drag_sensitivity = 2 (e.g. Monaco-style) reveals almost nothing.
//
// Formula:
//   efficiency = one_lap_pace × clamp(drag_sensitivity / 8.0, 0, 1)
//
// Output range: 0–10.
// Interpretation:
//   10 = fastest car on a high-drag-dependency circuit
//   0  = slowest car, or circuit has no straight-line relevance
//
// The 8.0 divisor sets the "fully informative" threshold. Any circuit with
// drag_sensitivity ≥ 8 is treated as a complete straight-line signal.
// Below 8, the signal is attenuated proportionally.

export function computeStraightLineEfficiency(
  oneLapPace: number | null,
  dragSensitivity: number
): number | null {
  if (oneLapPace === null) return null;
  const weight = Math.max(0, Math.min(1, dragSensitivity / 8.0));
  return Math.round(oneLapPace * weight * 100) / 100;
}
