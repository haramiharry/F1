// Ingestion pipeline orchestrator.
//
// applyTimeBasedFallback  — promotes a round from upcoming → in_progress when
//   a session was scheduled > 90 minutes ago with no results yet. Runs before
//   every scrape attempt so the round status is never permanently stuck.
//
// ingestSession           — fetches session results from Formula1.com and
//   writes them to the DB via processSessionResults.
//
// ingestFastestLap        — fetches the DHL Fastest Lap Award page and writes
//   the result for a specific round via processFastestLap.

import { prisma } from "@/lib/db/client";
import {
  buildResultsUrl,
  fetchSessionResults,
} from "@/lib/ingestion/scrapers/f1-results";
import { fetchFastestLaps } from "@/lib/ingestion/scrapers/f1-fastest-lap";
import { processSessionResults } from "@/lib/ingestion/processors/session-results";
import { processFastestLap } from "@/lib/ingestion/processors/fastest-lap";
import type { IngestionResult, IngestableSessionType } from "@/lib/ingestion/types";

const FALLBACK_WINDOW_MINUTES = 90;

// Check if any session for a round was scheduled > 90 minutes ago with no
// results yet. If so, flip the round status to in_progress with
// status_source='time_based' so the UI reflects an active weekend.
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

  // No-op if any results already exist — data path already fired.
  const existingCount = await prisma.sessionResult.count({
    where: { session: { round_id: round.id } },
  });
  if (existingCount > 0) return;

  await prisma.round.update({
    where: { id: round.id },
    data: { status: "in_progress", status_source: "time_based" },
  });
}

// Fetch and ingest session results from Formula1.com.
// Returns a failure result (not a thrown error) if the page is unavailable.
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

  return processSessionResults(scraped);
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
