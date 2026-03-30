// Admin endpoint: promote a staged DAB zone to live circuit_dab_zones.
//
// Amendment chain logic:
//   No existing live record  → plain create, status='confirmed'.
//   Existing active record   → amendment:
//     1. Create new live record (status='confirmed').
//     2. Set superseded_at + superseded_by_id on old record.
//     Both steps are atomic (transaction).
//
// Provenance is created at promotion time — this is when the admin confirms
// the source document. The staging table intentionally has no provenance_id.
//
// POST /api/admin/dab-zones/[stagingId]/promote
// Body (all optional): {
//   reviewerNotes?: string,
//   amendmentReason?: string,
//   provenanceUrl?: string,       // FIA document URL
//   documentReference?: string,   // e.g. "FIA Event Notes R03 2026"
// }
//
// Response 200: { message: string, wasAmendment: boolean }
// Response 404: staging record not found
// Response 409: already promoted or rejected

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { rawPrisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { createProvenance } from "@/lib/ingestion/provenance";
import { FIA_DOCUMENT_STALE_HOURS } from "@/lib/ingestion/staleness";

export async function POST(
  req: NextRequest,
  { params }: { params: { stagingId: string } }
) {
  const { stagingId } = params;

  // Body is optional — default all fields to undefined.
  let body: Record<string, string | undefined> = {};
  try {
    const parsed = await req.json();
    if (typeof parsed === "object" && parsed !== null) {
      body = parsed as Record<string, string | undefined>;
    }
  } catch {
    // Proceed with empty body if JSON parsing fails.
  }

  // CircuitDabZoneStaging has no deleted_at, so rawPrisma and prisma behave
  // identically here. Use rawPrisma for explicit read-all semantics.
  const staging = await rawPrisma.circuitDabZoneStaging.findUnique({
    where: { id: stagingId },
  });

  if (!staging) {
    return NextResponse.json(
      { error: "Staging record not found" },
      { status: 404 }
    );
  }

  if (staging.promotion_status !== "pending") {
    return NextResponse.json(
      { error: `Record has already been ${staging.promotion_status}` },
      { status: 409 }
    );
  }

  // Create provenance at promotion time — admin is confirming the source.
  const provenanceId = await createProvenance({
    sourceType: "official",
    url: body.provenanceUrl,
    documentReference:
      body.documentReference ??
      `FIA Event Notes — promoted from staging ${stagingId}`,
    staleThresholdHours: FIA_DOCUMENT_STALE_HOURS,
  });

  // Find existing active live record for this circuit + round + zone_number.
  const existingLive = await rawPrisma.circuitDabZone.findFirst({
    where: {
      circuit_id: staging.circuit_id,
      round_id: staging.round_id,
      zone_number: staging.zone_number,
      superseded_at: null,
    },
    select: { id: true },
  });

  const now = new Date();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create the new live record.
    const newLive = await tx.circuitDabZone.create({
      data: {
        circuit_id: staging.circuit_id,
        round_id: staging.round_id,
        zone_number: staging.zone_number,
        start_reference: staging.start_reference,
        end_reference: staging.end_reference,
        activation_direction: staging.activation_direction,
        status: "confirmed",
        amendment_reason: existingLive
          ? (body.amendmentReason ?? "Correction via admin staging promotion")
          : null,
        provenance_id: provenanceId,
      },
      select: { id: true },
    });

    // Supersede the old live record if one existed.
    if (existingLive) {
      await tx.circuitDabZone.update({
        where: { id: existingLive.id },
        data: {
          superseded_at: now,
          superseded_by_id: newLive.id,
        },
      });
    }

    // Mark the staging record as promoted.
    await tx.circuitDabZoneStaging.update({
      where: { id: stagingId },
      data: {
        promotion_status: "promoted",
        promoted_at: now,
        reviewed_at: now,
        reviewer_notes: body.reviewerNotes ?? null,
      },
    });
  });

  return NextResponse.json({
    message: `Zone ${staging.zone_number} promoted to live`,
    wasAmendment: existingLive !== null,
  });
}
