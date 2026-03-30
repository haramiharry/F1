import type { SessionType, TyreCompound } from "@/lib/db/types";

// Sessions that can be scraped from Formula1.com.
// round_aggregate is DB-only (derived after race ingestion, never scraped).
export type IngestableSessionType = Exclude<SessionType, "round_aggregate">;

// ---------------------------------------------------------------------------
// Scraper output types
// ---------------------------------------------------------------------------

export interface ScrapedDriverResult {
  driverAbbreviation: string;
  position: number | null;    // null = DNF / DSQ / DNS
  classified: boolean;
  lapTimeMs: number | null;   // best lap time in milliseconds
  gapToLeaderMs: number | null;
  lapsCompleted: number | null;
  tyreCompound: TyreCompound | null;
}

export interface ScrapedSessionResults {
  sessionType: IngestableSessionType;
  roundNumber: number;
  season: number;
  circuitSlug: string;
  results: ScrapedDriverResult[];
  sourceUrl: string;
  rawHtmlHash: string;        // MD5 of raw HTML; used for staleness detection
  accessedAt: Date;
}

export interface ScrapedFastestLap {
  driverAbbreviation: string;
  roundNumber: number;
  season: number;
  lapTimeMs: number;
  lapTimeDisplay: string;     // e.g. "1:22.091"
  awardEligible: boolean;
  sourceUrl: string;
  rawHtmlHash: string;
  accessedAt: Date;
}

// ---------------------------------------------------------------------------
// Processor output
// ---------------------------------------------------------------------------

export interface IngestionResult {
  success: boolean;
  recordsWritten: number;
  errors: string[];
  roundStatusTransition?: {
    roundId: string;
    previousStatus: string;
    newStatus: string;
    source: string;
  };
  aggregateCalculated?: boolean;
}

// ---------------------------------------------------------------------------
// DAB zone admin ingestion
// ---------------------------------------------------------------------------

export interface DabZoneInput {
  zoneNumber: number;
  startReference: string;
  endReference: string;
  activationDirection: string;
  parseErrors?: string[];     // parser warnings e.g. ["zone_3_boundary_ambiguous"]
}

export interface DabIngestRequest {
  circuitId: string;
  roundId: string;
  provenanceUrl?: string;      // FIA document URL
  documentReference?: string;  // e.g. "FIA Event Notes R03 2026"
  zones: DabZoneInput[];
}
