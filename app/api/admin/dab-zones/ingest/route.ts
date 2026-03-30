// Admin endpoint: parse and stage DAB zone data.
//
// DAB zone ingestion is manual-only — no automated scraping.
// All parser output lands in circuit_dab_zones_staging first.
// An admin must review the zones and promote each one individually via:
//   POST /api/admin/dab-zones/[stagingId]/promote
//
// POST /api/admin/dab-zones/ingest
// Body: DabIngestRequest {
//   circuitId: string,
//   roundId: string,
//   provenanceUrl?: string,       // FIA document URL (carried to live record at promotion)
//   documentReference?: string,   // e.g. "FIA Event Notes R03 2026"
//   zones: {
//     zoneNumber: number,
//     startReference: string,
//     endReference: string,
//     activationDirection: string,
//     parseErrors?: string[],      // parser warnings captured at parse time
//   }[]
// }
//
// Response 201: { stagingIds: string[], zonesQueued: number, message: string }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import type { DabIngestRequest, DabZoneInput } from "@/lib/ingestion/types";

function isValidZone(z: unknown): z is DabZoneInput {
  if (typeof z !== "object" || z === null) return false;
  const zone = z as Record<string, unknown>;
  return (
    typeof zone.zoneNumber === "number" &&
    typeof zone.startReference === "string" &&
    zone.startReference.length > 0 &&
    typeof zone.endReference === "string" &&
    zone.endReference.length > 0 &&
    typeof zone.activationDirection === "string" &&
    zone.activationDirection.length > 0
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as Partial<DabIngestRequest>;

  if (
    typeof data.circuitId !== "string" ||
    typeof data.roundId !== "string" ||
    !Array.isArray(data.zones) ||
    data.zones.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Required fields: circuitId (string), roundId (string), zones (non-empty array)",
      },
      { status: 400 }
    );
  }

  // Validate each zone before touching the DB.
  const invalidIndex = data.zones.findIndex((z) => !isValidZone(z));
  if (invalidIndex !== -1) {
    return NextResponse.json(
      {
        error: `zones[${invalidIndex}] is missing required fields: zoneNumber, startReference, endReference, activationDirection`,
      },
      { status: 400 }
    );
  }

  // Verify circuit and round exist.
  const [circuit, round] = await Promise.all([
    prisma.circuit.findFirst({
      where: { id: data.circuitId },
      select: { id: true },
    }),
    prisma.round.findFirst({
      where: { id: data.roundId },
      select: { id: true },
    }),
  ]);

  if (!circuit) {
    return NextResponse.json(
      { error: `Circuit not found: ${data.circuitId}` },
      { status: 404 }
    );
  }
  if (!round) {
    return NextResponse.json(
      { error: `Round not found: ${data.roundId}` },
      { status: 404 }
    );
  }

  // Insert all zones into staging in a single transaction.
  const created: { id: string; zone_number: number }[] = await prisma.$transaction(
    (data.zones as DabZoneInput[]).map((zone) =>
      prisma.circuitDabZoneStaging.create({
        data: {
          circuit_id: data.circuitId!,
          round_id: data.roundId!,
          zone_number: zone.zoneNumber,
          start_reference: zone.startReference,
          end_reference: zone.endReference,
          activation_direction: zone.activationDirection,
          parse_errors: zone.parseErrors
            ? JSON.stringify(zone.parseErrors)
            : null,
        },
        select: { id: true, zone_number: true },
      })
    )
  );

  return NextResponse.json(
    {
      stagingIds: created.map((r) => r.id),
      zonesQueued: created.length,
      message: `${created.length} zone(s) staged. Review and promote each via POST /api/admin/dab-zones/[stagingId]/promote`,
    },
    { status: 201 }
  );
}
