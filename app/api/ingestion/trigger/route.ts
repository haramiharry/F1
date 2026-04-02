// Manual ingestion trigger endpoint.
//
// Use this to test the pipeline during development or to force a re-fetch after
// a known Formula1.com update. In a production setup, a cron job or webhook
// would call this automatically after each session.
//
// POST /api/ingestion/trigger
// Body: {
//   season: number,
//   roundNumber: number,
//   sessionType: "fp1"|"fp2"|"fp3"|"qualifying"|"sprint_qualifying"|"sprint"|"race",
//   circuitSlug?: string,         // e.g. "australia" — if omitted, looked up from DB
//   includeFastestLap?: boolean,  // defaults to true for race sessions
// }
//
// Response: { session: IngestionResult, fastestLap: IngestionResult | null }

import { NextRequest, NextResponse } from "next/server";
import { ingestSession, ingestFastestLap } from "@/lib/ingestion/pipeline";
import { prisma } from "@/lib/db/client";
import type { IngestableSessionType } from "@/lib/ingestion/types";

const VALID_SESSION_TYPES = new Set<string>([
  "fp1",
  "fp2",
  "fp3",
  "qualifying",
  "sprint_qualifying",
  "sprint",
  "race",
]);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const {
    season,
    roundNumber,
    sessionType,
    circuitSlug: circuitSlugParam,
    includeFastestLap,
  } = body as Record<string, unknown>;

  if (
    typeof season !== "number" ||
    typeof roundNumber !== "number" ||
    typeof sessionType !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Required fields: season (number), roundNumber (number), sessionType (string). circuitSlug (string) is optional — looked up from DB when omitted.",
      },
      { status: 400 }
    );
  }

  if (!VALID_SESSION_TYPES.has(sessionType)) {
    return NextResponse.json(
      {
        error: `Invalid sessionType "${sessionType}". Must be one of: ${[
          ...VALID_SESSION_TYPES,
        ].join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Resolve circuitSlug: use the provided value or look it up from the DB.
  let circuitSlug: string;
  if (typeof circuitSlugParam === "string" && circuitSlugParam.length > 0) {
    circuitSlug = circuitSlugParam;
  } else {
    const round = await prisma.round.findFirst({
      where: { season, round_number: roundNumber },
      select: { circuit: { select: { slug: true } } },
    });
    if (!round) {
      return NextResponse.json(
        { error: `Round ${roundNumber} of season ${season} not found in database` },
        { status: 404 }
      );
    }
    circuitSlug = round.circuit.slug;
  }

  const sessionResult = await ingestSession({
    season,
    roundNumber,
    sessionType: sessionType as IngestableSessionType,
    circuitSlug,
  });

  // Automatically ingest the fastest lap after race sessions.
  // Can be overridden with includeFastestLap: false.
  const shouldIngestFastest =
    includeFastestLap !== false &&
    (includeFastestLap === true || sessionType === "race");

  let fastestLapResult = null;
  if (shouldIngestFastest) {
    fastestLapResult = await ingestFastestLap({ season, roundNumber });
  }

  const httpStatus =
    sessionResult.success || (fastestLapResult?.success ?? true) ? 200 : 502;

  return NextResponse.json(
    { session: sessionResult, fastestLap: fastestLapResult },
    { status: httpStatus }
  );
}
