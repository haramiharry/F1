// Shared API response types used by both route handlers and client-side
// fetch code. Kept in lib/ so neither side needs to import from the other.

// ---------------------------------------------------------------------------
// /api/cars
// ---------------------------------------------------------------------------

export interface CarPerfRow {
  id: string;
  teamSlug: string;
  teamName: string;
  designation: string;
  oneLapPace: number | null;
  longRunPace: number | null;
  straightLinePace: number | null;
  corneringPerformance: number | null;
  tyreBehaviour: number | null;
  xModeEffectiveness: number | null;
  zModeEffectiveness: number | null;
  hasData: boolean;
  isStale: boolean;
  dataRoundNumber: number | null;
  dependsOnDabZones: boolean;
  recalculationRequired: boolean;
}

export interface CarsApiResponse {
  cars: CarPerfRow[];
  asOfRound: number | null;
  season: number;
}

// ---------------------------------------------------------------------------
// /api/weekend
// ---------------------------------------------------------------------------

export interface WeekendSessionMeta {
  id: string;
  sessionType: string;
  scheduledStart: string;
  actualStart: string | null;
  endedAt: string | null;
  sessionCancelled: boolean;
}

export interface WeekendSessionResult {
  carId: string;
  teamSlug: string;
  designation: string;
  oneLapPace: number | null;
  longRunPace: number | null;
  longRunPaceAvailable: boolean;
  confidence: string;
  sourceVariant: string;
  isStale: boolean;
}

export interface WeekendLapEntry {
  carId: string;
  teamSlug: string;
  label: string;
  lapTimeMs: number;
  gapToLeaderMs: number;
}

export interface WeekendAeroEntry {
  carId: string;
  teamSlug: string;
  label: string;
  xMode: number;
  zMode: number;
  confidence: string;
}

export interface WeekendPrediction {
  carId: string;
  teamSlug: string;
  label: string;
  predictedMs: number;
  marginOfErrorMs: number;
  confidence: string;
  actualMs?: number;
}

export interface WeekendRound {
  id: string;
  roundNumber: number;
  roundName: string;
  season: number;
  status: "upcoming" | "in_progress" | "completed";
  circuitName: string;
  circuitCountry: string;
  circuitSlug: string;
  dabZonesConfirmed: boolean;
  sessions: WeekendSessionMeta[];
  availableSessions: string[];
  sessionMetrics: Record<string, WeekendSessionResult[]>;
  lapEntries: Record<string, WeekendLapEntry[]>;
  aeroEntries: WeekendAeroEntry[];
  predictions: WeekendPrediction[];
  preSeasonOnly: boolean;
}

export interface WeekendApiResponse {
  round: WeekendRound | null;
}

// ---------------------------------------------------------------------------
// /api/amendments
// ---------------------------------------------------------------------------

export interface AmendmentEntry {
  id: string;
  createdAt: string;
  amendmentReason: string | null;
  sourceType: string;
  isCurrent: boolean;
  summary: string;
}

export interface AmendmentsApiResponse {
  amendments: AmendmentEntry[];
  entityType: string;
  entityId: string;
}
