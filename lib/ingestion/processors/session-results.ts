// Writes scraped session results to session_results.
//
// Write strategy: upsert (create on first ingestion, update on re-ingestion).
// SessionResult has no amendment chain — the @@unique([session_id, driver_id])
// constraint enforces one canonical row per driver per session. Post-race penalty
// amendments that affect championship standings are captured in the round_aggregate
// CarCircuitPerformance record, which does carry a superseded_at chain.
//
// Round status transitions triggered here:
//   first successful write → upcoming → in_progress (status_source: data)
//   after race ingestion   → in_progress → completed (status_source: data)
//
// Time-based fallback (90 min after scheduled_start with no data) is handled
// separately in pipeline.ts::applyTimeBasedFallback.

import { prisma } from "@/lib/db/client";
import { createProvenance } from "@/lib/ingestion/provenance";
import { sessionTypeThreshold } from "@/lib/ingestion/staleness";
import { calculateRoundAggregate } from "@/lib/ingestion/processors/round-aggregate";
import type { ScrapedSessionResults, IngestionResult } from "@/lib/ingestion/types";

export async function processSessionResults(
  scraped: ScrapedSessionResults
): Promise<IngestionResult> {
  const errors: string[] = [];
  let recordsWritten = 0;

  // Resolve the session. Session is in SOFT_DELETE_MODELS so middleware injects
  // deleted_at: null automatically — cancelled/deleted sessions are excluded.
  const session = await prisma.session.findFirst({
    where: {
      round: {
        season: scraped.season,
        round_number: scraped.roundNumber,
      },
      session_type: scraped.sessionType,
      session_cancelled: false,
    },
    include: {
      round: { select: { id: true, status: true } },
    },
  });

  if (!session) {
    return {
      success: false,
      recordsWritten: 0,
      errors: [
        `Session not found: season=${scraped.season} round=${scraped.roundNumber} type=${scraped.sessionType}`,
      ],
    };
  }

  // Create provenance outside the transaction — permanent audit record regardless
  // of transaction outcome.
  const provenanceId = await createProvenance({
    sourceType: "official",
    url: scraped.sourceUrl,
    contentHash: scraped.rawHtmlHash,
    staleThresholdHours: sessionTypeThreshold(scraped.sessionType),
  });

  // Resolve all driver abbreviations up front so unknown drivers fail fast
  // before the transaction opens.
  const abbreviations = [
    ...new Set(scraped.results.map((r) => r.driverAbbreviation)),
  ];
  const drivers = await prisma.driver.findMany({
    where: { abbreviation: { in: abbreviations } },
    select: { id: true, abbreviation: true },
  });
  const driverMap = new Map(drivers.map((d) => [d.abbreviation, d.id]));

  for (const abbrev of abbreviations) {
    if (!driverMap.has(abbrev)) errors.push(`Driver not found: ${abbrev}`);
  }

  // Upsert all results in a single transaction.
  await prisma.$transaction(async (tx) => {
    for (const result of scraped.results) {
      const driverId = driverMap.get(result.driverAbbreviation);
      if (!driverId) continue;

      await tx.sessionResult.upsert({
        where: {
          session_id_driver_id: {
            session_id: session.id,
            driver_id: driverId,
          },
        },
        create: {
          session_id: session.id,
          driver_id: driverId,
          position: result.position,
          classified: result.classified,
          lap_time_ms: result.lapTimeMs,
          gap_to_leader_ms: result.gapToLeaderMs,
          laps_completed: result.lapsCompleted,
          tyre_compound: result.tyreCompound,
          provenance_id: provenanceId,
        },
        update: {
          position: result.position,
          classified: result.classified,
          lap_time_ms: result.lapTimeMs,
          gap_to_leader_ms: result.gapToLeaderMs,
          laps_completed: result.lapsCompleted,
          tyre_compound: result.tyreCompound,
          provenance_id: provenanceId,
        },
      });

      recordsWritten++;
    }
  });

  // Round status transitions run outside the results transaction.
  let roundStatusTransition: IngestionResult["roundStatusTransition"];

  if (recordsWritten > 0) {
    if (session.round.status === "upcoming") {
      await prisma.round.update({
        where: { id: session.round_id },
        data: { status: "in_progress", status_source: "data" },
      });
      roundStatusTransition = {
        roundId: session.round_id,
        previousStatus: "upcoming",
        newStatus: "in_progress",
        source: "data",
      };
    }

    // Race session: transition to completed regardless of prior status.
    if (scraped.sessionType === "race") {
      await prisma.round.update({
        where: { id: session.round_id },
        data: { status: "completed", status_source: "data" },
      });
      roundStatusTransition = {
        roundId: session.round_id,
        previousStatus: session.round.status,
        newStatus: "completed",
        source: "data",
      };
    }
  }

  // Round aggregate is computed after race ingestion completes.
  let aggregateCalculated = false;
  if (scraped.sessionType === "race" && recordsWritten > 0) {
    const agg = await calculateRoundAggregate(session.round_id, session.id);
    aggregateCalculated = agg.success;
    if (!agg.success) errors.push(...agg.errors);
  }

  return {
    success: recordsWritten > 0 && errors.length < scraped.results.length,
    recordsWritten,
    errors,
    roundStatusTransition,
    aggregateCalculated,
  };
}
