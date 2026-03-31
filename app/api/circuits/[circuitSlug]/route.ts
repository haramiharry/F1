// GET /api/circuits/[circuitSlug]
//
// Returns full circuit detail: profile dimensions, active DAB zones, and
// car fit scores (track_fit predictions from the prediction engine).
//
// Car fit scores are Prediction records with prediction_type='track_fit',
// superseded_at=null. They are written by lib/analytics/engine.ts after
// each session enrichment. Before Round 1 they are absent (zero state).
//
// dabZonesConfirmed reflects Round.dab_zones_confirmed for the 2026 round.
// DAB zones are CircuitDabZone records with superseded_at=null.
//
// 404 if the circuit slug doesn't exist.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

const SEASON = 2026;

export async function GET(
  _req: Request,
  { params }: { params: { circuitSlug: string } }
): Promise<NextResponse> {
  const circuit = await prisma.circuit.findFirst({
    where: { slug: params.circuitSlug },
    select: {
      id: true,
      slug: true,
      name: true,
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
        select: { id: true, round_number: true, name: true, dab_zones_confirmed: true, status: true },
        orderBy: { round_number: "asc" },
        take: 1,
      },
      dab_zones: {
        where: { superseded_at: null },
        select: {
          id: true,
          zone_number: true,
          start_reference: true,
          end_reference: true,
          activation_direction: true,
          status: true,
        },
        orderBy: { zone_number: "asc" },
      },
    },
  });

  if (!circuit) {
    return NextResponse.json({ error: "Circuit not found" }, { status: 404 });
  }

  const upcomingRound = circuit.rounds[0] ?? null;

  // Car fit scores: Prediction records for this circuit with type=track_fit,
  // non-superseded. Includes car → team for display names.
  const fitPredictions = await prisma.prediction.findMany({
    where: {
      circuit_id: circuit.id,
      prediction_type: "track_fit",
      superseded_at: null,
    },
    select: {
      id: true,
      car_id: true,
      predicted_value: true,
      confidence: true,
      round_valid_from: true,
      car: {
        select: {
          id: true,
          designation: true,
          team: { select: { slug: true, name: true } },
        },
      },
      provenance: { select: { is_stale: true } },
    },
    orderBy: { predicted_value: "desc" },
  });

  return NextResponse.json({
    id: circuit.id,
    slug: circuit.slug,
    name: circuit.name,
    country: circuit.country,
    lapLengthKm: circuit.lap_length_km,
    totalLapsRace: circuit.total_laps_race,
    profile: circuit.profile
      ? {
          dragSensitivity: circuit.profile.drag_sensitivity,
          tractionDemand: circuit.profile.traction_demand,
          brakingIntensity: circuit.profile.braking_intensity,
          overtakingPotential: circuit.profile.overtaking_potential,
          aeroZoneValue: circuit.profile.aero_zone_value,
          baselineFastestLapS: circuit.profile.baseline_fastest_lap_s,
          isStale: circuit.profile.provenance.is_stale,
        }
      : null,
    dabZonesConfirmed: upcomingRound?.dab_zones_confirmed ?? false,
    dabZoneCount: circuit.dab_zones.length,
    dabZones: circuit.dab_zones,
    carFitScores: (fitPredictions as Array<{
      id: string;
      car_id: string | null;
      predicted_value: number | null;
      confidence: string;
      round_valid_from: number;
      car: { id: string; designation: string; team: { slug: string; name: string } } | null;
      provenance: { is_stale: boolean } | null;
    }>).map((p) => ({
      carId: p.car_id ?? "",
      teamSlug: p.car?.team.slug ?? "",
      teamName: p.car?.team.name ?? "",
      designation: p.car?.designation ?? "",
      trackFitScore: p.predicted_value,
      confidence: p.confidence,
      roundNumber: p.round_valid_from > 0 ? p.round_valid_from : null,
      isStale: p.provenance?.is_stale ?? false,
    })),
  });
}
