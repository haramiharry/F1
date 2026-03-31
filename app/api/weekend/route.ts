// GET /api/weekend
//
// Returns the currently in-progress round with all session data, car metrics,
// lap time entries, aero effectiveness, and fastest-lap predictions.
//
// Returns { round: null } when no round has status='in_progress' for season 2026.
// The client renders WeekendZeroState in that case.
//
// Session metrics come from CarCircuitPerformance records (one per car per
// session type per round). Lap entries come from SessionResult records (one per
// driver per session), aggregated to best lap per car via DriverTeamStint.
//
// longRunPaceAvailable:
//   true  → session type is fp2 or race (long-run data collected)
//   false → all other session types (no long-run data by design)
//
// Aero entries: from round_aggregate CCP x_mode_effectiveness / z_mode_effectiveness.
// Withheld when dabZonesConfirmed=false (mirrors engine.ts guard).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";
import type {
  WeekendRound,
  WeekendSessionResult,
  WeekendLapEntry,
} from "@/lib/api/types";

const SEASON = 2026;
const LONG_RUN_SESSIONS = new Set(["fp2", "race"]);
const VALID_TAB_SESSIONS = new Set(["fp1", "fp2", "fp3", "qualifying", "sprint", "race"]);

export async function GET(): Promise<NextResponse> {
  // Only show the weekend view when a round is actively in progress.
  const activeRound = await prisma.round.findFirst({
    where: { season: SEASON, status: "in_progress" },
    select: {
      id: true,
      round_number: true,
      name: true,
      season: true,
      status: true,
      dab_zones_confirmed: true,
      circuit: {
        select: { id: true, name: true, country: true, slug: true },
      },
      sessions: {
        select: {
          id: true,
          session_type: true,
          scheduled_start: true,
          actual_start: true,
          ended_at: true,
          session_cancelled: true,
        },
        orderBy: { scheduled_start: "asc" },
      },
    },
  });

  if (!activeRound) {
    return NextResponse.json({ round: null });
  }

  const circuitId = activeRound.circuit.id;
  const roundId = activeRound.id;

  // Completed sessions: needed to decide which sessions have lap entry data.
  const completedSessions = activeRound.sessions.filter((s) => s.ended_at !== null);
  const completedSessionIds = completedSessions.map((s: { id: string }) => s.id);

  // All cars for the season (team slug + designation).
  const cars: Array<{ id: string; designation: string; team: { slug: string; name: string } }> = await prisma.car.findMany({
    where: { season: SEASON },
    select: {
      id: true,
      designation: true,
      team: { select: { slug: true, name: true } },
    },
  });
  const carById = new Map(cars.map((c) => [c.id, c]));
  const carByTeamSlug = new Map(cars.map((c) => [c.team.slug, c]));

  // CCP records for all non-aggregate session types for this round.
  const ccpRecords: Array<{
    car_id: string;
    session_type: string;
    one_lap_pace: number | null;
    long_run_pace: number | null;
    recalculation_required: boolean;
    provenance: { is_stale: boolean } | null;
  }> = await prisma.carCircuitPerformance.findMany({
    where: {
      round_id: roundId,
      circuit_id: circuitId,
      superseded_at: null,
      NOT: { session_type: "round_aggregate" },
    },
    select: {
      car_id: true,
      session_type: true,
      one_lap_pace: true,
      long_run_pace: true,
      recalculation_required: true,
      provenance: { select: { is_stale: true } },
    },
  });

  // Round aggregate CCP for aero entries.
  const roundAggCcp: Array<{
    car_id: string;
    x_mode_effectiveness: number | null;
    z_mode_effectiveness: number | null;
    depends_on_dab_zones: boolean;
  }> = await prisma.carCircuitPerformance.findMany({
    where: {
      round_id: roundId,
      circuit_id: circuitId,
      session_type: "round_aggregate",
      superseded_at: null,
    },
    select: {
      car_id: true,
      x_mode_effectiveness: true,
      z_mode_effectiveness: true,
      depends_on_dab_zones: true,
    },
  });

  // Fastest lap predictions for this circuit.
  const predictions: Array<{
    car_id: string | null;
    predicted_value: number | null;
    predicted_value_display: string | null;
    margin_of_error_ms: number | null;
    confidence: string;
    source_type: string;
  }> = await prisma.prediction.findMany({
    where: {
      circuit_id: circuitId,
      prediction_type: "fastest_lap",
      superseded_at: null,
    },
    select: {
      car_id: true,
      predicted_value: true,
      predicted_value_display: true,
      margin_of_error_ms: true,
      confidence: true,
      source_type: true,
    },
  });

  const preSeasonOnly =
    predictions.length === 0 ||
    predictions.every((p) => p.source_type === "editorial");

  // -------------------------------------------------------------------------
  // Lap entries from session results.
  // SessionResult → driver → DriverTeamStint → Team → Car
  // -------------------------------------------------------------------------
  const lapEntriesRaw: Map<string, WeekendLapEntry> = new Map();

  if (completedSessionIds.length > 0) {
    const sessionResults = await prisma.sessionResult.findMany({
      where: {
        session_id: { in: completedSessionIds },
        lap_time_ms: { not: null },
      },
      select: {
        session_id: true,
        lap_time_ms: true,
        gap_to_leader_ms: true,
        driver: {
          select: {
            team_stints: {
              where: {
                season: SEASON,
                from_round: { lte: activeRound.round_number },
                OR: [
                  { to_round: null },
                  { to_round: { gte: activeRound.round_number } },
                ],
              },
              select: { team_id: true },
              take: 1,
            },
          },
        },
      },
    });

    // Get all referenced team IDs to batch-load team slugs.
    const teamIds = [
      ...new Set(
        sessionResults.flatMap((r: { driver: { team_stints: { team_id: string }[] } }) =>
          r.driver.team_stints.map((s: { team_id: string }) => s.team_id)
        )
      ),
    ];
    const teams: Array<{ id: string; slug: string; name: string }> = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, slug: true, name: true },
    });
    const teamById = new Map(teams.map((t) => [t.id, t]));

    // Build best-lap-per-car-per-session map (key = sessionId:teamSlug).
    for (const result of sessionResults) {
      const stint = result.driver.team_stints[0];
      if (!stint) continue;
      const team = teamById.get(stint.team_id);
      if (!team) continue;
      const car = carByTeamSlug.get(team.slug);
      if (!car) continue;

      const key = `${result.session_id}:${team.slug}`;
      const existing = lapEntriesRaw.get(key);
      if (!existing || result.lap_time_ms! < existing.lapTimeMs) {
        lapEntriesRaw.set(key, {
          carId: car.id,
          teamSlug: team.slug,
          label: `${TEAM_NAMES[team.slug as TeamSlug] ?? team.name} ${car.designation}`,
          lapTimeMs: result.lap_time_ms!,
          gapToLeaderMs: result.gap_to_leader_ms ?? 0,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Build per-session-tab maps.
  // -------------------------------------------------------------------------
  const sessionMetrics: Record<string, WeekendSessionResult[]> = {};
  const lapEntries: Record<string, WeekendLapEntry[]> = {};

  for (const session of activeRound.sessions) {
    const st = session.session_type;
    if (!VALID_TAB_SESSIONS.has(st)) continue;

    const sessionCcp = ccpRecords.filter((r) => r.session_type === st);
    sessionMetrics[st] = sessionCcp
      .map((ccp): WeekendSessionResult | null => {
        const car = carById.get(ccp.car_id);
        if (!car) return null;
        return {
          carId: ccp.car_id,
          teamSlug: car.team.slug,
          designation: car.designation,
          oneLapPace: ccp.one_lap_pace,
          longRunPace: ccp.long_run_pace,
          longRunPaceAvailable: LONG_RUN_SESSIONS.has(st),
          confidence: "medium",
          sourceVariant: "derived",
          isStale: ccp.provenance?.is_stale ?? false,
        };
      })
      .filter((x): x is WeekendSessionResult => x !== null);

    lapEntries[st] = Array.from(lapEntriesRaw.entries())
      .filter(([key]) => key.startsWith(`${session.id}:`))
      .map(([, entry]) => entry);
  }

  // -------------------------------------------------------------------------
  // Aero entries — only when DAB zones confirmed.
  // -------------------------------------------------------------------------
  const aeroEntries = activeRound.dab_zones_confirmed
    ? roundAggCcp
        .filter(
          (r) => r.x_mode_effectiveness !== null && r.z_mode_effectiveness !== null
        )
        .map((r) => {
          const car = carById.get(r.car_id);
          if (!car) return null;
          const name = TEAM_NAMES[car.team.slug as TeamSlug] ?? car.team.slug;
          return {
            carId: r.car_id,
            teamSlug: car.team.slug,
            label: `${name} ${car.designation}`,
            xMode: r.x_mode_effectiveness!,
            zMode: r.z_mode_effectiveness!,
            confidence: "medium",
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  const availableSessions = activeRound.sessions
    .map((s: { session_type: string }) => s.session_type)
    .filter((st) => VALID_TAB_SESSIONS.has(st));

  const round: WeekendRound = {
    id: activeRound.id,
    roundNumber: activeRound.round_number,
    roundName: activeRound.name,
    season: activeRound.season,
    status: activeRound.status as "upcoming" | "in_progress" | "completed",
    circuitName: activeRound.circuit.name,
    circuitCountry: activeRound.circuit.country,
    circuitSlug: activeRound.circuit.slug,
    dabZonesConfirmed: activeRound.dab_zones_confirmed,
    sessions: activeRound.sessions.map((s: {
      id: string;
      session_type: string;
      scheduled_start: Date;
      actual_start: Date | null;
      ended_at: Date | null;
      session_cancelled: boolean;
    }) => ({
      id: s.id,
      sessionType: s.session_type,
      scheduledStart: s.scheduled_start.toISOString(),
      actualStart: s.actual_start?.toISOString() ?? null,
      endedAt: s.ended_at?.toISOString() ?? null,
      sessionCancelled: s.session_cancelled,
    })),
    availableSessions,
    sessionMetrics,
    lapEntries,
    aeroEntries,
    predictions: predictions
      .map((p) => {
        const car = p.car_id ? carById.get(p.car_id) : null;
        const name = car ? (TEAM_NAMES[car.team.slug as TeamSlug] ?? car.team.slug) : null;
        return {
          carId: p.car_id ?? "",
          teamSlug: car?.team.slug ?? "",
          label: car && name ? `${name} ${car.designation}` : "Unknown",
          predictedMs: Math.round(p.predicted_value ?? 0),
          marginOfErrorMs: Math.round(p.margin_of_error_ms ?? 2000),
          confidence: p.confidence,
        };
      })
      .filter((p) => p.carId !== ""),
    preSeasonOnly,
  };

  return NextResponse.json({ round });
}
