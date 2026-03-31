// GET /api/cars
//
// Returns all 2026 cars with their latest round_aggregate performance metrics.
//
// Query parameters:
//   asOfRound=N  — cap performance data to rounds ≤ N (default: latest available)
//
// Response shape: CarsApiResponse (see lib/api/types.ts)
//
// isStale is true when the provenance record for the CCP row has is_stale=true,
// meaning the source data hasn't been refreshed within the session-type threshold
// (race: 24h, practice: 6h, qualifying: 12h). Used to render stale indicators.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import type { CarsApiResponse } from "@/lib/api/types";

const SEASON = 2026;

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const asOfRoundParam = searchParams.get("asOfRound");
  const asOfRound = asOfRoundParam !== null ? parseInt(asOfRoundParam, 10) : null;

  // Find the most recent round in the requested window that has completed data.
  // "Has data" = at least one round_aggregate CCP record exists for that round.
  // We don't use a relation sub-filter here to avoid hitting the soft-delete
  // middleware gap on nested queries; instead we query the latest active round
  // and check for CCP records in the second query.
  const latestActiveRound = await prisma.round.findFirst({
    where: {
      season: SEASON,
      status: { in: ["in_progress", "completed"] },
      ...(asOfRound !== null ? { round_number: { lte: asOfRound } } : {}),
    },
    orderBy: { round_number: "desc" },
    select: { id: true, round_number: true },
  });

  const [cars, ccpRecords, activeRound] = await Promise.all([
    prisma.car.findMany({
      where: { season: SEASON },
      select: {
        id: true,
        designation: true,
        team: { select: { slug: true, name: true } },
      },
      orderBy: { team: { name: "asc" } },
    }),
    latestActiveRound
      ? prisma.carCircuitPerformance.findMany({
          where: {
            round_id: latestActiveRound.id,
            session_type: "round_aggregate",
            superseded_at: null,
          },
          select: {
            car_id: true,
            one_lap_pace: true,
            long_run_pace: true,
            straight_line_efficiency: true,
            cornering_performance: true,
            tyre_behaviour: true,
            x_mode_effectiveness: true,
            z_mode_effectiveness: true,
            depends_on_dab_zones: true,
            recalculation_required: true,
            amendment_reason: true,
            provenance: { select: { is_stale: true } },
          },
        })
      : Promise.resolve([]),
    prisma.round.findFirst({
      where: { season: SEASON, status: "in_progress" },
      select: { id: true },
    }),
  ]);

  const ccpByCar = new Map((ccpRecords as Array<{
    car_id: string;
    one_lap_pace: number | null;
    long_run_pace: number | null;
    straight_line_efficiency: number | null;
    cornering_performance: number | null;
    tyre_behaviour: number | null;
    x_mode_effectiveness: number | null;
    z_mode_effectiveness: number | null;
    depends_on_dab_zones: boolean;
    recalculation_required: boolean;
    amendment_reason: string | null;
    provenance: { is_stale: boolean } | null;
  }>).map((r) => [r.car_id, r]));

  const result: CarsApiResponse = {
    season: SEASON,
    asOfRound: latestActiveRound?.round_number ?? null,
    roundIsLive: activeRound !== null,
    cars: cars.map((car) => {
      const ccp = ccpByCar.get(car.id) ?? null;
      return {
        id: car.id,
        teamSlug: car.team.slug,
        teamName: car.team.name,
        designation: car.designation,
        oneLapPace: ccp?.one_lap_pace ?? null,
        longRunPace: ccp?.long_run_pace ?? null,
        straightLinePace: ccp?.straight_line_efficiency ?? null,
        corneringPerformance: ccp?.cornering_performance ?? null,
        tyreBehaviour: ccp?.tyre_behaviour ?? null,
        xModeEffectiveness: ccp?.x_mode_effectiveness ?? null,
        zModeEffectiveness: ccp?.z_mode_effectiveness ?? null,
        hasData: ccp !== null,
        isStale: ccp?.provenance?.is_stale ?? false,
        dataRoundNumber: latestActiveRound?.round_number ?? null,
        dependsOnDabZones: ccp?.depends_on_dab_zones ?? false,
        recalculationRequired: ccp?.recalculation_required ?? false,
        amendmentReason: ccp?.amendment_reason ?? null,
      };
    }),
  };

  return NextResponse.json(result);
}
