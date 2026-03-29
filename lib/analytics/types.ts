import type { ConfidenceLevel, SessionType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Context fed into the analytics engine for one computation run.
// Loaded once per enrichRecord call and passed through to all metric functions.
// ---------------------------------------------------------------------------

export interface CircuitAnalyticsContext {
  // Circuit profile dimensions (all assumed 0–10 float scale)
  drag_sensitivity: number;
  traction_demand: number;
  braking_intensity: number;
  overtaking_potential: number;
  aero_zone_value: number;
  // Active (non-superseded) DAB zones for this circuit + round
  dab_zone_count: number;
}

// The seven performance dimensions stored on car_circuit_performance.
// All on a 0–10 scale where 10 = best measured value in the current field.
export interface DimensionScores {
  one_lap_pace: number | null;
  long_run_pace: number | null;
  straight_line_efficiency: number | null;
  cornering_performance: number | null;
  tyre_behaviour: number | null;
  x_mode_effectiveness: number | null;
  z_mode_effectiveness: number | null;
}

export interface AnalyticsResult {
  success: boolean;
  recordsEnriched: number;
  predictionsWritten: number;
  errors: string[];
}

// Input to enrichSessionRecords — resolves to individual records internally.
export interface SessionEnrichmentTarget {
  season: number;
  roundNumber: number;
  sessionType: SessionType;
}
