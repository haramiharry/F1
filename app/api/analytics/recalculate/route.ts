export const dynamic = "force-dynamic";
// Manual analytics recalculation endpoint.
//
// Forces re-enrichment of CarCircuitPerformance records that either:
//   a) Were never enriched (straight_line_efficiency IS NULL), or
//   b) Are explicitly targeted via filters (forces re-enrichment regardless).
//
// Force re-enrichment works by temporarily nulling the enrichment marker field
// on the targeted record before passing it to enrichRecord. This allows
// re-computing analytics after a circuit profile update or DAB zone correction
// without having to re-ingest session results.
//
// POST /api/analytics/recalculate
// Body (all optional — omit to process all unenriched records):
//   {
//     carId?: string,          // limit to one car
//     circuitId?: string,      // limit to one circuit
//     roundId?: string,        // limit to one round
//     sessionType?: SessionType,
//     force?: boolean,         // re-enrich already-enriched records (default false)
//   }
//
// Response 200:
//   { recordsEnriched: number, predictionsWritten: number, errors: string[] }

import { NextRequest, NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db/client";
import { prisma } from "@/lib/db/client";
import { enrichRecord } from "@/lib/analytics/engine";
import type { SessionType } from "@/lib/db/types";

const VALID_SESSION_TYPES = new Set<string>([
  "fp1", "fp2", "fp3", "qualifying", "sprint_qualifying",
  "sprint", "race", "round_aggregate",
]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (typeof parsed === "object" && parsed !== null) body = parsed;
  } catch {
    // Empty body = process all unenriched records.
  }

  const {
    carId,
    circuitId,
    roundId,
    sessionType,
    force = false,
  } = body as {
    carId?: string;
    circuitId?: string;
    roundId?: string;
    sessionType?: string;
    force?: boolean;
  };

  if (sessionType !== undefined && !VALID_SESSION_TYPES.has(sessionType)) {
    return NextResponse.json(
      { error: `Invalid sessionType: ${sessionType}` },
      { status: 400 }
    );
  }

  // Build the query filter.
  const where = {
    ...(carId ? { car_id: carId } : {}),
    ...(circuitId ? { circuit_id: circuitId } : {}),
    ...(roundId ? { round_id: roundId } : {}),
    ...(sessionType ? { session_type: sessionType as SessionType } : {}),
    superseded_at: null,
    deleted_at: null,
    // Without force: only unenriched records (x_mode_effectiveness IS NULL).
    // With force: all active records regardless of enrichment state.
    // x_mode_effectiveness is the enrichment marker — populated for every record
    // with a non-null one_lap_pace; straight_line_efficiency is NOT the marker
    // because it is intentionally null on all per-session (non-aggregate) records.
    ...(force ? {} : { x_mode_effectiveness: null }),
  };

  const targets = await rawPrisma.carCircuitPerformance.findMany({
    where,
    select: { id: true, x_mode_effectiveness: true },
  });

  if (targets.length === 0) {
    return NextResponse.json({
      recordsEnriched: 0,
      predictionsWritten: 0,
      errors: [],
      message: "No eligible records found",
    });
  }

  const errors: string[] = [];
  let recordsEnriched = 0;
  let predictionsWritten = 0;

  for (const target of targets) {
    try {
      // For forced re-enrichment, clear the enrichment marker first so
      // enrichRecord doesn't skip the record.
      if (force && target.x_mode_effectiveness !== null) {
        await prisma.carCircuitPerformance.update({
          where: { id: target.id },
          data: { x_mode_effectiveness: null },
        });
      }

      const enriched = await enrichRecord(target.id);
      if (enriched) {
        recordsEnriched++;
        predictionsWritten += 2; // rough estimate: track_fit + aero per record
      }
    } catch (err) {
      errors.push(`record ${target.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    recordsEnriched,
    predictionsWritten,
    errors,
  });
}
