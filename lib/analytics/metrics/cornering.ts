// cornering_performance — how well the car handles traction and braking zones.
//
// Derived from one_lap_pace on circuits where traction demand and braking
// intensity are the key lap-time factors. High combined demand (traction + braking)
// means the circuit strongly differentiates cornering ability.
//
// Formula:
//   cornering = one_lap_pace × clamp((traction_demand + braking_intensity) / 16.0, 0, 1)
//
// The 16.0 divisor (max combined: 10 + 10 = 20, threshold at 16) sets the
// "fully informative" threshold. Circuits with combined demand ≥ 16 reveal
// cornering ability as clearly as possible from lap time data alone.
//
// Output range: 0–10.
// Interpretation:
//   10 = fastest car on a high traction+braking circuit
//   0  = slowest car, or circuit has low cornering demand

export function computeCorneringPerformance(
  oneLapPace: number | null,
  tractionDemand: number,
  brakingIntensity: number
): number | null {
  if (oneLapPace === null) return null;
  const weight = Math.max(
    0,
    Math.min(1, (tractionDemand + brakingIntensity) / 16.0)
  );
  return Math.round(oneLapPace * weight * 100) / 100;
}
