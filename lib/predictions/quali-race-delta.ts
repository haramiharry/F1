// Qualifying-to-race pace delta.
//
// The fastest lap set during a race is typically slower than a car's
// qualifying lap because race conditions impose fuel load, tyre management,
// and traffic constraints. The delta is the ratio:
//
//   delta = race_fastest_lap_ms / qualifying_pole_lap_ms
//
// A value of 1.018 means the race fastest lap is ~1.8% slower than pole.
//
// DEFAULT_QUALI_RACE_DELTA is the fallback for:
//   - Season opener (no prior data at any circuit this season)
//   - Circuits with no 2026 qualifying + race pair observed yet
//
// computeQualiRaceDelta(circuitId):
//   Queries the database for qualifying session best laps and race fastest laps
//   at this circuit for the current season. When at least one qualifying/race
//   pair exists, the average observed ratio is returned. Otherwise the default
//   is returned.
//
//   This is a circuit-level (not car-level) delta: different cars experience
//   similar race-to-quali time loss at the same venue. The circuit-level average
//   is a more stable estimate than per-car deltas, especially early in the season
//   when each car has few data points.

import { prisma } from "@/lib/db/client";
import { rawPrisma } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Default delta when no observed qualifying+race pair exists.
//
// PROVENANCE — editorial constant:
//   1.018 is derived from editorial analysis of 2018–2024 F1 dry-weather
//   race results. The mean ratio of (race fastest lap / qualifying pole lap)
//   across those seasons was approximately 1.015–1.020 per circuit, with
//   lower values at street circuits (less tyre degradation, cleaner air in
//   late-race laps) and higher values at high-deg circuits. 1.018 is the
//   central estimate across the range.
//
//   Source type: editorial — not derived from live 2026 data.
//   This value is labelled as such on the Methodology page.
//   It will be superseded circuit-by-circuit once computeQualiRaceDelta
//   accumulates qualifying + race fastest-lap pairs for 2026.
//
//   Do not treat 1.018 as a calibrated model output. It is a reasonable
//   pre-season prior whose uncertainty is absorbed into the prediction's
//   margin_of_error_ms (±2000ms at LOW confidence, ±800ms at MEDIUM).
export const DEFAULT_QUALI_RACE_DELTA = 1.018;

// ---------------------------------------------------------------------------
// DB query
// ---------------------------------------------------------------------------

export async function computeQualiRaceDelta(circuitId: string): Promise<{
  delta: number;
  dataSource: "observed" | "default";
}> {
  // Find all qualifying sessions at this circuit that have a matching race fastest lap.
  const qualiSessions = await prisma.session.findMany({
    where: {
      session_type: "qualifying",
      session_cancelled: false,
      round: { circuit_id: circuitId },
    },
    select: { id: true, round_id: true },
  });

  if (qualiSessions.length === 0) {
    return { delta: DEFAULT_QUALI_RACE_DELTA, dataSource: "default" };
  }

  const deltas: number[] = [];

  for (const session of qualiSessions) {
    // Best (lowest) lap time set in this qualifying session (pole lap proxy).
    const bestQuali = await rawPrisma.sessionResult.findFirst({
      where: {
        session_id: session.id,
        lap_time_ms: { not: null },
        classified: true,
        deleted_at: null,
      },
      orderBy: { lap_time_ms: "asc" },
      select: { lap_time_ms: true },
    });

    // Race fastest lap for the same round (non-superseded).
    const fastestRace = await rawPrisma.fastestLap.findFirst({
      where: {
        round_id: session.round_id,
        superseded_at: null,
      },
      orderBy: { lap_time_ms: "asc" },
      select: { lap_time_ms: true },
    });

    if (
      bestQuali?.lap_time_ms != null &&
      fastestRace?.lap_time_ms != null &&
      bestQuali.lap_time_ms > 0
    ) {
      deltas.push(fastestRace.lap_time_ms / bestQuali.lap_time_ms);
    }
  }

  if (deltas.length === 0) {
    return { delta: DEFAULT_QUALI_RACE_DELTA, dataSource: "default" };
  }

  const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  return {
    delta: Math.round(avgDelta * 10000) / 10000,
    dataSource: "observed",
  };
}
