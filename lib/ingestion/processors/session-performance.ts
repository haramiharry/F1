// Computes and writes a CarCircuitPerformance record for one non-race session.
// Called automatically by ingestSession after fp1 / fp2 / fp3 / qualifying /
// sprint_qualifying / sprint result writes.
//
// Race sessions are NOT handled here — race produces session_type=round_aggregate
// via processors/round-aggregate.ts, which rolls up multiple sessions.
//
// Metric coverage per session type:
//
//   fp1, fp3         one_lap_pace populated  |  long_run_pace null
//   fp2              one_lap_pace populated  |  long_run_pace populated (proxy)
//   qualifying       one_lap_pace populated  |  long_run_pace null
//   sprint_qualifying one_lap_pace populated |  long_run_pace null
//   sprint           one_lap_pace populated  |  long_run_pace null
//
// fp2 long_run_pace: FP2 is the primary race-simulation session, but
//   session_results stores one lap_time_ms per driver (their session best),
//   not individual stint laps. Until a laps table is added to the schema,
//   long_run_pace for fp2 is computed using the same field-relative best-lap
//   normalisation as one_lap_pace. It is a proxy, not a true stint metric.
//   Set to the same computed value as one_lap_pace to signal the data is
//   present but label-approximate.
//
// one_lap_pace formula:
//   10 × (fieldMax_ms − carBest_ms) / (fieldMax_ms − fieldMin_ms)
//   Range 0–10. Car with the fastest lap in session = 10. Worst = 0.
//
// Amendment chain: re-ingesting a session supersedes the existing active
//   CarCircuitPerformance record and creates a new one. The old record is
//   never overwritten.

import { prisma } from "@/lib/db/client";
import { rawPrisma } from "@/lib/db/client";
import type { TransactionClient } from "@/lib/db/client";
import { createProvenance } from "@/lib/ingestion/provenance";
import { sessionTypeThreshold } from "@/lib/ingestion/staleness";
import type { IngestableSessionType, IngestionResult } from "@/lib/ingestion/types";

// Session types where this processor produces records.
// "race" is excluded — handled by round-aggregate.ts.
export const SESSION_PERFORMANCE_TYPES = new Set<IngestableSessionType>([
  "fp1",
  "fp2",
  "fp3",
  "qualifying",
  "sprint_qualifying",
  "sprint",
]);

export function handlesSessionType(sessionType: IngestableSessionType): boolean {
  return SESSION_PERFORMANCE_TYPES.has(sessionType);
}

export async function processSessionPerformance(
  sessionType: IngestableSessionType,
  season: number,
  roundNumber: number
): Promise<IngestionResult> {
  if (!handlesSessionType(sessionType)) {
    return {
      success: false,
      recordsWritten: 0,
      errors: [
        `processSessionPerformance does not handle session_type=${sessionType}`,
      ],
    };
  }

  const errors: string[] = [];
  let recordsWritten = 0;

  // Resolve session. Middleware injects deleted_at: null automatically.
  const session = await prisma.session.findFirst({
    where: {
      round: { season, round_number: roundNumber },
      session_type: sessionType,
      session_cancelled: false,
    },
    include: {
      round: {
        select: { id: true, circuit_id: true, season: true },
      },
    },
  });

  if (!session) {
    return {
      success: false,
      recordsWritten: 0,
      errors: [
        `Session not found: season=${season} round=${roundNumber} type=${sessionType}`,
      ],
    };
  }

  // Load session results with driver → active team stint → team → car for this season.
  const results = await prisma.sessionResult.findMany({
    where: { session_id: session.id },
    include: {
      driver: {
        include: {
          team_stints: {
            where: { season: session.round.season, to_round: null },
            orderBy: { from_round: "desc" },
            take: 1,
            include: {
              team: {
                include: {
                  cars: {
                    where: { season: session.round.season, deleted_at: null },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (results.length === 0) {
    return {
      success: false,
      recordsWritten: 0,
      errors: [`No results found for session ${session.id}`],
    };
  }

  // Field-wide lap times for normalisation.
  const allLapTimes = results
    .map((r) => r.lap_time_ms)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);

  const fieldMin = allLapTimes[0] ?? null;
  const fieldMax = allLapTimes[allLapTimes.length - 1] ?? null;
  const fieldRange =
    fieldMin !== null && fieldMax !== null ? fieldMax - fieldMin : 0;

  // Group results by car.
  const carResults = new Map<string, typeof results>();
  for (const result of results) {
    const car = result.driver.team_stints[0]?.team?.cars[0];
    if (!car) {
      errors.push(
        `No active ${session.round.season} car for driver ${result.driver_id}`
      );
      continue;
    }
    const bucket = carResults.get(car.id) ?? [];
    bucket.push(result);
    carResults.set(car.id, bucket);
  }

  // Single provenance record shared across all car records in this run.
  const provenanceId = await createProvenance({
    sourceType: "derived",
    staleThresholdHours: sessionTypeThreshold(sessionType),
    documentReference: `Computed from ${sessionType} session ${session.id}`,
  });

  for (const [carId, carSessionResults] of carResults) {
    const carLapTimes = carSessionResults
      .map((r) => r.lap_time_ms)
      .filter((t): t is number => t !== null);

    const carBest = carLapTimes.length > 0 ? Math.min(...carLapTimes) : null;

    // one_lap_pace: 0–10, 10 = fastest car in session.
    let oneLapPace: number | null = null;
    if (carBest !== null) {
      if (fieldRange > 0 && fieldMax !== null) {
        oneLapPace = Math.max(
          0,
          Math.min(10, ((fieldMax - carBest) / fieldRange) * 10)
        );
      } else if (allLapTimes.length === 1) {
        // Only one car posted a lap time — give full score by default.
        oneLapPace = 10;
      }
    }

    // long_run_pace: fp2 only, proxy using same field-relative value.
    // See file header note about stint data limitation.
    const longRunPace: number | null =
      sessionType === "fp2" ? oneLapPace : null;

    // Check for existing active record — amendment chain if found.
    const existingRecord = await rawPrisma.carCircuitPerformance.findFirst({
      where: {
        car_id: carId,
        circuit_id: session.round.circuit_id,
        round_id: session.round_id,
        session_type: sessionType,
        superseded_at: null,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (existingRecord) {
      // Amendment: create new, then supersede old — atomic.
      await prisma.$transaction(async (tx: TransactionClient) => {
        const newRecord = await tx.carCircuitPerformance.create({
          data: {
            car_id: carId,
            circuit_id: session.round.circuit_id,
            round_id: session.round_id,
            session_type: sessionType,
            one_lap_pace: oneLapPace,
            long_run_pace: longRunPace,
            amendment_reason: `Re-ingested ${sessionType} session`,
            provenance_id: provenanceId,
          },
          select: { id: true },
        });

        await tx.carCircuitPerformance.update({
          where: { id: existingRecord.id },
          data: {
            superseded_at: new Date(),
            superseded_by_id: newRecord.id,
          },
        });
      });
    } else {
      await prisma.carCircuitPerformance.create({
        data: {
          car_id: carId,
          circuit_id: session.round.circuit_id,
          round_id: session.round_id,
          session_type: sessionType,
          one_lap_pace: oneLapPace,
          long_run_pace: longRunPace,
          provenance_id: provenanceId,
        },
      });
    }

    recordsWritten++;
  }

  return { success: recordsWritten > 0, recordsWritten, errors };
}
