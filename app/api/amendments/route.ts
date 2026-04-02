export const dynamic = "force-dynamic";
// GET /api/amendments
//
// Returns the full amendment chain for a given entity.
// Used by the AmendmentPanel component triggered by ?amendmentHistory=type:id.
//
// Query params (both required):
//   entityType  — one of: fastest_laps | predictions | car_circuit_performance | circuit_dab_zones
//   entityId    — the CUID of any record in the chain (current or superseded)
//
// Strategy: fetch the anchor record to determine its grouping key (the set of
// fields that identifies "the same logical entity across revisions"), then
// fetch all records with that key ordered by created_at desc.
//
// rawPrisma is used because amendment history needs to see superseded records,
// which may have deleted_at set on soft-deletable models.

import { NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db/client";
import type { AmendmentsApiResponse, AmendmentEntry } from "@/lib/api/types";

const VALID_TYPES = [
  "fastest_laps",
  "predictions",
  "car_circuit_performance",
  "circuit_dab_zones",
] as const;

type EntityType = (typeof VALID_TYPES)[number];

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") as EntityType | null;
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: "entityType and entityId are required" },
      { status: 400 }
    );
  }
  if (!VALID_TYPES.includes(entityType)) {
    return NextResponse.json(
      { error: `entityType must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  let amendments: AmendmentEntry[] = [];

  // -------------------------------------------------------------------------
  // predictions
  // -------------------------------------------------------------------------
  if (entityType === "predictions") {
    const anchor = await rawPrisma.prediction.findFirst({
      where: { id: entityId },
      select: { car_id: true, circuit_id: true, prediction_type: true },
    });
    if (!anchor) {
      return NextResponse.json({ amendments: [], entityType, entityId });
    }
    const records = await rawPrisma.prediction.findMany({
      where: {
        car_id: anchor.car_id,
        circuit_id: anchor.circuit_id,
        prediction_type: anchor.prediction_type,
      },
      select: {
        id: true,
        predicted_value_display: true,
        confidence: true,
        source_type: true,
        round_valid_from: true,
        amendment_reason: true,
        superseded_at: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
    });
    amendments = (records as Array<{
      id: string;
      predicted_value_display: string | null;
      confidence: string;
      source_type: string;
      round_valid_from: number;
      amendment_reason: string | null;
      superseded_at: Date | null;
      created_at: Date;
    }>).map((r) => ({
      id: r.id,
      createdAt: r.created_at.toISOString(),
      amendmentReason: r.amendment_reason,
      sourceType: r.source_type,
      isCurrent: r.superseded_at === null,
      summary: [
        r.predicted_value_display ?? "—",
        r.confidence,
        r.round_valid_from === 0 ? "Pre-season" : `Round ${r.round_valid_from}`,
      ].join(" · "),
    }));
  }

  // -------------------------------------------------------------------------
  // car_circuit_performance
  // -------------------------------------------------------------------------
  else if (entityType === "car_circuit_performance") {
    const anchor = await rawPrisma.carCircuitPerformance.findFirst({
      where: { id: entityId },
      select: { car_id: true, circuit_id: true, session_type: true },
    });
    if (!anchor) {
      return NextResponse.json({ amendments: [], entityType, entityId });
    }
    const records = await rawPrisma.carCircuitPerformance.findMany({
      where: {
        car_id: anchor.car_id,
        circuit_id: anchor.circuit_id,
        session_type: anchor.session_type,
      },
      select: {
        id: true,
        one_lap_pace: true,
        session_type: true,
        amendment_reason: true,
        superseded_at: true,
        calculated_at: true,
        round: { select: { round_number: true, name: true } },
      },
      orderBy: { calculated_at: "desc" },
    });
    amendments = (records as Array<{
      id: string;
      one_lap_pace: number | null;
      session_type: string;
      amendment_reason: string | null;
      superseded_at: Date | null;
      calculated_at: Date;
      round: { round_number: number; name: string } | null;
    }>).map((r) => ({
      id: r.id,
      createdAt: r.calculated_at.toISOString(),
      amendmentReason: r.amendment_reason,
      sourceType: "derived",
      isCurrent: r.superseded_at === null,
      summary: [
        r.round ? `R${r.round.round_number} ${r.round.name}` : "Unknown round",
        r.session_type.toUpperCase(),
        r.one_lap_pace != null ? `pace ${r.one_lap_pace.toFixed(1)}` : "no pace",
      ].join(" · "),
    }));
  }

  // -------------------------------------------------------------------------
  // fastest_laps
  // -------------------------------------------------------------------------
  else if (entityType === "fastest_laps") {
    const anchor = await rawPrisma.fastestLap.findFirst({
      where: { id: entityId },
      select: { session_id: true, driver_id: true },
    });
    if (!anchor) {
      return NextResponse.json({ amendments: [], entityType, entityId });
    }
    const records = await rawPrisma.fastestLap.findMany({
      where: {
        session_id: anchor.session_id,
        driver_id: anchor.driver_id,
      },
      select: {
        id: true,
        lap_time_display: true,
        amendment_reason: true,
        superseded_at: true,
        created_at: true,
        driver: { select: { abbreviation: true } },
      },
      orderBy: { created_at: "desc" },
    });
    amendments = (records as Array<{
      id: string;
      lap_time_display: string;
      amendment_reason: string | null;
      superseded_at: Date | null;
      created_at: Date;
      driver: { abbreviation: string } | null;
    }>).map((r) => ({
      id: r.id,
      createdAt: r.created_at.toISOString(),
      amendmentReason: r.amendment_reason,
      sourceType: "official",
      isCurrent: r.superseded_at === null,
      summary: `${r.lap_time_display} · ${r.driver?.abbreviation ?? "UNK"}`,
    }));
  }

  // -------------------------------------------------------------------------
  // circuit_dab_zones
  // -------------------------------------------------------------------------
  else if (entityType === "circuit_dab_zones") {
    const anchor = await rawPrisma.circuitDabZone.findFirst({
      where: { id: entityId },
      select: { circuit_id: true, zone_number: true },
    });
    if (!anchor) {
      return NextResponse.json({ amendments: [], entityType, entityId });
    }
    const records = await rawPrisma.circuitDabZone.findMany({
      where: {
        circuit_id: anchor.circuit_id,
        zone_number: anchor.zone_number,
      },
      select: {
        id: true,
        zone_number: true,
        start_reference: true,
        end_reference: true,
        status: true,
        amendment_reason: true,
        superseded_at: true,
        created_at: true,
        round: { select: { round_number: true } },
      },
      orderBy: { created_at: "desc" },
    });
    amendments = (records as Array<{
      id: string;
      zone_number: number;
      start_reference: string;
      end_reference: string;
      status: string;
      amendment_reason: string | null;
      superseded_at: Date | null;
      created_at: Date;
      round: { round_number: number } | null;
    }>).map((r) => ({
      id: r.id,
      createdAt: r.created_at.toISOString(),
      amendmentReason: r.amendment_reason,
      sourceType: "official",
      isCurrent: r.superseded_at === null,
      summary: [
        `Zone ${r.zone_number}`,
        `${r.start_reference} → ${r.end_reference}`,
        r.round ? `R${r.round.round_number}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  }

  const response: AmendmentsApiResponse = { amendments, entityType, entityId };
  return NextResponse.json(response);
}
