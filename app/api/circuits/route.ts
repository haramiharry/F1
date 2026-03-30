// GET /api/circuits
//
// Returns all circuits with their 2026 round assignments and circuit profile
// dimensions. Used by the Track Intelligence list view.
//
// dabZonesConfirmed reflects the Round.dab_zones_confirmed flag for the 2026
// round at this circuit (false = "Awaiting FIA Event Notes").

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

const SEASON = 2026;

export async function GET(): Promise<NextResponse> {
  const circuits = await prisma.circuit.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      short_name: true,
      country: true,
      lap_length_km: true,
      total_laps_race: true,
      profile: {
        select: {
          drag_sensitivity: true,
          traction_demand: true,
          braking_intensity: true,
          overtaking_potential: true,
          aero_zone_value: true,
          baseline_fastest_lap_s: true,
          provenance: { select: { is_stale: true } },
        },
      },
      rounds: {
        where: { season: SEASON },
        select: {
          round_number: true,
          name: true,
          dab_zones_confirmed: true,
          status: true,
        },
        orderBy: { round_number: "asc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const result = circuits.map((c) => {
    const round = c.rounds[0] ?? null;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      shortName: c.short_name,
      country: c.country,
      lapLengthKm: c.lap_length_km,
      totalLapsRace: c.total_laps_race,
      dragSensitivity: c.profile?.drag_sensitivity ?? null,
      tractionDemand: c.profile?.traction_demand ?? null,
      brakingIntensity: c.profile?.braking_intensity ?? null,
      overtakingPotential: c.profile?.overtaking_potential ?? null,
      aeroZoneValue: c.profile?.aero_zone_value ?? null,
      baselineFastestLapS: c.profile?.baseline_fastest_lap_s ?? null,
      profileIsStale: c.profile?.provenance?.is_stale ?? false,
      dabZonesConfirmed: round?.dab_zones_confirmed ?? false,
      upcomingRoundNumber: round?.round_number ?? null,
      upcomingRoundName: round?.name ?? null,
      roundStatus: round?.status ?? null,
    };
  });

  return NextResponse.json({ circuits: result });
}
