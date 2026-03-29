// Active-aero effectiveness: X Mode and Z Mode advantage per car per circuit.
//
// X Mode = DRS/DAB deployment mode. Activated in DAB zones (marked on circuit).
//   Advantage is revealed on circuits with high aero_zone_value and many
//   active DAB zones — the car exploits the drag reduction windows more.
//
// Z Mode = non-deployment (high downforce) mode. Advantage is revealed on
//   circuits where DAB activation is rare and mechanical/aero grip dominates.
//
// Both are derived from one_lap_pace, weighted by two independent signals:
//   1. circuit_profiles.aero_zone_value   (0–10, schema-defined per circuit)
//   2. dab_zone_count normalised to [0,1] (active zones from circuit_dab_zones)
//
// DAB zone weight normalisation:
//   MAX_DAB_ZONES = 3  (typical F1 circuit has 1–3 DRS/DAB detection zones)
//   dab_weight = clamp(dab_zone_count / 3, 0, 1)
//
// Formulas (outputs 0–10):
//   x_mode = one_lap_pace × (aero_zone_value/10 × 0.6 + dab_weight × 0.4)
//   z_mode = one_lap_pace × ((1 − aero_zone_value/10) × 0.6 + (1 − dab_weight) × 0.4)
//
// The 0.6/0.4 split weights the static circuit profile signal more heavily than
// the round-specific DAB zone count, since circuit profiles change slowly while
// zone counts can vary per race weekend.

const MAX_DAB_ZONES = 3;

function dabWeight(dabZoneCount: number): number {
  return Math.min(1, dabZoneCount / MAX_DAB_ZONES);
}

export function computeXModeEffectiveness(
  oneLapPace: number | null,
  aeroZoneValue: number,
  dabZoneCount: number
): number | null {
  if (oneLapPace === null) return null;
  const dw = dabWeight(dabZoneCount);
  const weight = (aeroZoneValue / 10) * 0.6 + dw * 0.4;
  return Math.round(oneLapPace * weight * 100) / 100;
}

export function computeZModeEffectiveness(
  oneLapPace: number | null,
  aeroZoneValue: number,
  dabZoneCount: number
): number | null {
  if (oneLapPace === null) return null;
  const dw = dabWeight(dabZoneCount);
  const weight = (1 - aeroZoneValue / 10) * 0.6 + (1 - dw) * 0.4;
  return Math.round(oneLapPace * weight * 100) / 100;
}
