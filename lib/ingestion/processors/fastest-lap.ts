// Writes a scraped fastest lap to the fastest_laps table.
//
// Amendment chain behaviour:
//   First write for a round  → plain create.
//   Subsequent write (same driver, same time) → no-op.
//   Subsequent write (different driver OR different time) → amendment:
//     1. Create new record.
//     2. Set superseded_at + superseded_by_id on old record.
//   Both steps run in a single transaction so the chain is always consistent.

import { prisma } from "@/lib/db/client";
import { rawPrisma } from "@/lib/db/client";
import type { TransactionClient } from "@/lib/db/client";
import { createProvenance } from "@/lib/ingestion/provenance";
import { sessionTypeThreshold } from "@/lib/ingestion/staleness";
import type { ScrapedFastestLap, IngestionResult } from "@/lib/ingestion/types";

export async function processFastestLap(
  scraped: ScrapedFastestLap
): Promise<IngestionResult> {
  // Resolve driver.
  const driver = await prisma.driver.findUnique({
    where: { abbreviation: scraped.driverAbbreviation },
    select: { id: true },
  });
  if (!driver) {
    return {
      success: false,
      recordsWritten: 0,
      errors: [`Driver not found: ${scraped.driverAbbreviation}`],
    };
  }

  // Resolve the race session that hosts the fastest lap award.
  const session = await prisma.session.findFirst({
    where: {
      round: {
        season: scraped.season,
        round_number: scraped.roundNumber,
      },
      session_type: "race",
      session_cancelled: false,
    },
    include: { round: { select: { id: true } } },
  });
  if (!session) {
    return {
      success: false,
      recordsWritten: 0,
      errors: [
        `Race session not found: season=${scraped.season} round=${scraped.roundNumber}`,
      ],
    };
  }

  // Read existing active fastest lap via rawPrisma so we see the full chain
  // including any previously superseded records (not filtered by soft-delete).
  const existing = await rawPrisma.fastestLap.findFirst({
    where: {
      round_id: session.round.id,
      superseded_at: null,
    },
    select: { id: true, lap_time_ms: true, driver_id: true },
  });

  // Idempotent: same driver, same time — nothing to write.
  if (
    existing &&
    existing.driver_id === driver.id &&
    existing.lap_time_ms === scraped.lapTimeMs
  ) {
    return { success: true, recordsWritten: 0, errors: [] };
  }

  const provenanceId = await createProvenance({
    sourceType: "official",
    url: scraped.sourceUrl,
    contentHash: scraped.rawHtmlHash,
    staleThresholdHours: sessionTypeThreshold("race"),
  });

  if (!existing) {
    // First write for this round.
    await prisma.fastestLap.create({
      data: {
        round_id: session.round.id,
        session_id: session.id,
        driver_id: driver.id,
        lap_time_ms: scraped.lapTimeMs,
        lap_time_display: scraped.lapTimeDisplay,
        award_eligible: scraped.awardEligible,
        provenance_id: provenanceId,
      },
    });
    return { success: true, recordsWritten: 1, errors: [] };
  }

  // Amendment: create new record first to obtain its id, then supersede old.
  // Both operations are atomic — a partial amendment would leave the chain
  // inconsistent, so we wrap in a transaction.
  await prisma.$transaction(async (tx: TransactionClient) => {
    const newRecord = await tx.fastestLap.create({
      data: {
        round_id: session.round.id,
        session_id: session.id,
        driver_id: driver.id,
        lap_time_ms: scraped.lapTimeMs,
        lap_time_display: scraped.lapTimeDisplay,
        award_eligible: scraped.awardEligible,
        amendment_reason: "Post-race penalty or official correction",
        provenance_id: provenanceId,
      },
      select: { id: true },
    });

    await tx.fastestLap.update({
      where: { id: existing.id },
      data: {
        superseded_at: new Date(),
        superseded_by_id: newRecord.id,
      },
    });
  });

  return { success: true, recordsWritten: 1, errors: [] };
}
