// Computes and writes a round_aggregate CarCircuitPerformance record for every
// car that participated in the race.
//
// Triggered automatically by processSessionResults after race ingestion.
// Can also be called manually to recompute after a penalty re-ingestion.
//
// Amendment chain: if an active round_aggregate already exists for a car+circuit+round,
// a new record is created and the old one is superseded (never overwritten).
// Post-race penalty re-runs set amendment_reason accordingly.
//
// Metrics computed from available session_results data:
//   one_lap_pace   — inverse normalised finishing position (0–10, 10 = winner)
//   long_run_pace  — car's best lap time vs. field median, normalised (0–10)
//   other metrics  — null until additional data sources are wired in

import { prisma } from "@/lib/db/client";
import { rawPrisma } from "@/lib/db/client";
import { createProvenance } from "@/lib/ingestion/provenance";
import { sessionTypeThreshold } from "@/lib/ingestion/staleness";
import type { IngestionResult } from "@/lib/ingestion/types";

export async function calculateRoundAggregate(
  roundId: string,
  raceSessionId: string
): Promise<IngestionResult> {
  const errors: string[] = [];
  let recordsWritten = 0;

  // Load round first so we can filter team stints and cars by season.
  const round = await prisma.round.findFirst({
    where: { id: roundId },
    select: { id: true, circuit_id: true, season: true },
  });
  if (!round) {
    return { success: false, recordsWritten: 0, errors: ["Round not found"] };
  }

  // Load race results with the driver's active team stint for this season,
  // and the team's car for this season.
  const results = await prisma.sessionResult.findMany({
    where: { session_id: raceSessionId },
    include: {
      driver: {
        include: {
          team_stints: {
            where: { season: round.season, to_round: null },
            orderBy: { from_round: "desc" },
            take: 1,
            include: {
              team: {
                include: {
                  cars: {
                    where: { season: round.season, deleted_at: null },
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
      errors: ["No race results found for this session"],
    };
  }

  // Group results by car id. Multiple drivers may share a car (reserve driver
  // scenario), so we collect all of the car's results together.
  const carResults = new Map<string, typeof results>();

  for (const result of results) {
    const car = result.driver.team_stints[0]?.team?.cars[0];
    if (!car) {
      errors.push(
        `No active ${round.season} car found for driver ${result.driver_id}`
      );
      continue;
    }
    const existing = carResults.get(car.id) ?? [];
    existing.push(result);
    carResults.set(car.id, existing);
  }

  // Single provenance record for all aggregate rows in this run.
  const provenanceId = await createProvenance({
    sourceType: "derived",
    staleThresholdHours: sessionTypeThreshold("round_aggregate"),
    documentReference: `Computed from race session ${raceSessionId}`,
  });

  const totalDrivers = results.length;

  for (const [carId, carRaceResults] of carResults) {
    // one_lap_pace: inverse-normalised finishing position.
    // Winner (pos=1) scores 10; last classified scores ~0.
    const positions = carRaceResults
      .map((r) => r.position)
      .filter((p): p is number => p !== null);

    const bestPosition = positions.length > 0 ? Math.min(...positions) : null;

    const oneLapPace =
      bestPosition !== null && totalDrivers > 1
        ? ((totalDrivers - bestPosition) / (totalDrivers - 1)) * 10
        : null;

    // long_run_pace: car's best lap time relative to field median.
    // Positive delta from median → score above 5; negative → below 5.
    const carLapTimes = carRaceResults
      .map((r) => r.lap_time_ms)
      .filter((t): t is number => t !== null);

    const allLapTimes = results
      .map((r) => r.lap_time_ms)
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b);

    let longRunPace: number | null = null;
    if (carLapTimes.length > 0 && allLapTimes.length >= 2) {
      const carBest = Math.min(...carLapTimes);
      const fieldMedian = allLapTimes[Math.floor(allLapTimes.length / 2)];
      const fieldRange = allLapTimes[allLapTimes.length - 1] - allLapTimes[0];
      if (fieldRange > 0) {
        const normalised = ((fieldMedian - carBest) / fieldRange + 0.5) * 10;
        longRunPace = Math.max(0, Math.min(10, normalised));
      }
    }

    // Check for an existing active aggregate to determine if this is an amendment.
    // Use rawPrisma to bypass soft-delete so we can detect superseded records too.
    const existingAggregate = await rawPrisma.carCircuitPerformance.findFirst({
      where: {
        car_id: carId,
        circuit_id: round.circuit_id,
        round_id: roundId,
        session_type: "round_aggregate",
        superseded_at: null,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (existingAggregate) {
      // Amendment: create new → supersede old. Atomic transaction.
      await prisma.$transaction(async (tx) => {
        const newRecord = await tx.carCircuitPerformance.create({
          data: {
            car_id: carId,
            circuit_id: round.circuit_id,
            round_id: roundId,
            session_type: "round_aggregate",
            one_lap_pace: oneLapPace,
            long_run_pace: longRunPace,
            amendment_reason:
              "Recalculated after race session re-ingestion or penalty",
            provenance_id: provenanceId,
          },
          select: { id: true },
        });

        await tx.carCircuitPerformance.update({
          where: { id: existingAggregate.id },
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
          circuit_id: round.circuit_id,
          round_id: roundId,
          session_type: "round_aggregate",
          one_lap_pace: oneLapPace,
          long_run_pace: longRunPace,
          provenance_id: provenanceId,
        },
      });
    }

    recordsWritten++;
  }

  return {
    success: recordsWritten > 0,
    recordsWritten,
    errors,
    aggregateCalculated: recordsWritten > 0,
  };
}
