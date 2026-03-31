// Ingestion pipeline orchestrator.
//
// applyTimeBasedFallback     — promotes one round upcoming → in_progress when
//   a session was scheduled > 90 min ago with no data yet.
//   Called before every ingestSession scrape attempt.
//
// applyTimeBasedFallbackAll  — same logic across all upcoming rounds.
//   Called by the cron endpoint every 15 minutes.
//
// ingestSession              — fetches session results from Formula1.com,
//   writes to DB via processSessionResults, then:
//     1. Triggers processSessionPerformance (fp1/fp2/fp3/quali/sprint sessions)
//        or calculateRoundAggregate (race — called inside processSessionResults)
//     2. Triggers enrichSessionRecords (Step 5 analytics engine) to enrich
//        the newly written CarCircuitPerformance records with all five
//        remaining dimensions and write track_fit + aero_effectiveness predictions.
//     3. Triggers runPredictionEngineForSession (Step 6) to compute or
//        recalibrate fastest_lap predictions for all cars at this circuit.
//
// ingestFastestLap           — fetches the DHL Fastest Lap Award page and writes
//   the result for a specific round via processFastestLap.

import { prisma } from "@/lib/db/client";
import {
  buildResultsUrl,
  fetchSessionResults,
} from "@/lib/ingestion/scrapers/f1-results";
import { fetchFastestLaps } from "@/lib/ingestion/scrapers/f1-fastest-lap";
import { processSessionResults } from "@/lib/ingestion/processors/session-results";
import { processFastestLap } from "@/lib/ingestion/processors/fastest-lap";
import {
  processSessionPerformance,
  handlesSessionType,
} from "@/lib/ingestion/processors/session-performance";
import { enrichSessionRecords } from "@/lib/analytics/engine";
import { runPredictionEngineForSession } from "@/lib/predictions/engine";
import type { IngestionResult, IngestableSessionType } from "@/lib/ingestion/types";

const FALLBACK_WINDOW_MINUTES = 90;

// Promote one specific round from upcoming → in_progress if a session was
// scheduled > 90 minutes ago and no results have been written yet.
export async function applyTimeBasedFallback(
  roundNumber: number,
  season: number
): Promise<void> {
  const cutoff = new Date(Date.now() - FALLBACK_WINDOW_MINUTES * 60_000);

  const round = await prisma.round.findFirst({
    where: { season, round_number: roundNumber, status: "upcoming" },
    select: {
      id: true,
      sessions: {
        select: { id: true, scheduled_start: true },
        where: { session_cancelled: false },
      },
    },
  });

  if (!round) return;

  const pastSession = round.sessions.find((s) => s.scheduled_start <= cutoff);
  if (!pastSession) return;

  const existingCount = await prisma.sessionResult.count({
    where: { session: { round_id: round.id } },
  });
  if (existingCount > 0) return;

  await prisma.round.update({
    where: { id: round.id },
    data: { status: "in_progress", status_source: "time_based" },
  });
}

// Scan all upcoming rounds and apply the 90-minute time-based fallback to each.
// Called by GET /api/ingestion/cron/round-status every 15 minutes.
// Returns the number of rounds checked and the number that were transitioned.
export async function applyTimeBasedFallbackAll(): Promise<{
  checked: number;
  transitioned: number;
}> {
  const cutoff = new Date(Date.now() - FALLBACK_WINDOW_MINUTES * 60_000);

  // Find all upcoming rounds that have at least one non-cancelled session
  // whose scheduled_start is already past the 90-minute cutoff.
  const candidates = await prisma.round.findMany({
    where: {
      status: "upcoming",
      sessions: {
        some: {
          scheduled_start: { lte: cutoff },
          session_cancelled: false,
        },
      },
    },
    select: { id: true },
  });

  if (candidates.length === 0) return { checked: 0, transitioned: 0 };

  let transitioned = 0;

  for (const round of candidates) {
    const existingCount = await prisma.sessionResult.count({
      where: { session: { round_id: round.id } },
    });

    if (existingCount === 0) {
      await prisma.round.update({
        where: { id: round.id },
        data: { status: "in_progress", status_source: "time_based" },
      });
      transitioned++;
    }
  }

  return { checked: candidates.length, transitioned };
}

// Fetch and ingest session results from Formula1.com.
// After a successful write, automatically computes CarCircuitPerformance metrics:
//   fp1/fp2/fp3/qualifying/sprint_qualifying/sprint → processSessionPerformance
//   race → calculateRoundAggregate (called inside processSessionResults)
export async function ingestSession({
  season,
  roundNumber,
  sessionType,
  circuitSlug,
}: {
  season: number;
  roundNumber: number;
  sessionType: IngestableSessionType;
  circuitSlug: string;
}): Promise<IngestionResult> {
  await applyTimeBasedFallback(roundNumber, season);

  const url = buildResultsUrl(season, roundNumber, circuitSlug, sessionType);
  const scraped = await fetchSessionResults(url, {
    season,
    roundNumber,
    sessionType,
    circuitSlug,
  });

  if (!scraped) {
    return {
      success: false,
      recordsWritten: 0,
      errors: [
        `Results unavailable at ${url} — page may not be published yet`,
      ],
    };
  }

  const sessionResult = await processSessionResults(scraped);

  // Compute session-level CarCircuitPerformance after successful writes.
  // Non-fatal: if performance calculation fails, session results are still
  // committed and the error is appended to the returned errors list.
  let perfErrors: string[] = [];
  if (sessionResult.recordsWritten > 0 && handlesSessionType(sessionType)) {
    const perfResult = await processSessionPerformance(
      sessionType,
      season,
      roundNumber
    );
    if (!perfResult.success) {
      perfErrors = perfResult.errors.map((e: string) => `[performance] ${e}`);
    }
  }

  // Step 5: enrich the newly written CarCircuitPerformance records with all
  // five analytics dimensions and write track_fit / aero_effectiveness predictions.
  // Non-fatal: session results and basic pace metrics are already committed.
  let analyticsErrors: string[] = [];
  if (sessionResult.recordsWritten > 0) {
    // For race sessions the round_aggregate is written inside processSessionResults;
    // we enrich it here. For other sessions the session-performance record was
    // written above.
    const enrichTarget = sessionType === "race" ? "round_aggregate" : sessionType;
    const analyticsResult = await enrichSessionRecords({
      season,
      roundNumber,
      sessionType: enrichTarget,
    });
    if (!analyticsResult.success) {
      analyticsErrors = analyticsResult.errors.map(
        (e) => `[analytics] ${e}`
      );
    }
  }

  // Step 6: compute / recalibrate fastest_lap predictions for all cars at this
  // circuit after any session write. Non-fatal: analytics and session results
  // are already committed.
  let predictionErrors: string[] = [];
  if (sessionResult.recordsWritten > 0) {
    const predResult = await runPredictionEngineForSession({
      season,
      roundNumber,
      sessionType,
    });
    if (!predResult.success) {
      predictionErrors = predResult.errors.map((e: string) => `[predictions] ${e}`);
    }
  }

  return {
    ...sessionResult,
    errors: [
      ...sessionResult.errors,
      ...perfErrors,
      ...analyticsErrors,
      ...predictionErrors,
    ],
  };
}

// Fetch and ingest the fastest lap for a specific round.
export async function ingestFastestLap({
  season,
  roundNumber,
}: {
  season: number;
  roundNumber: number;
}): Promise<IngestionResult> {
  const scraped = await fetchFastestLaps(season, roundNumber);

  if (scraped.length === 0) {
    return {
      success: false,
      recordsWritten: 0,
      errors: [
        `No fastest lap data for season=${season} round=${roundNumber} — check DHL page`,
      ],
    };
  }

  const results = await Promise.all(scraped.map(processFastestLap));

  return {
    success: results.some((r) => r.success),
    recordsWritten: results.reduce((sum, r) => sum + r.recordsWritten, 0),
    errors: results.flatMap((r) => r.errors),
  };
}
