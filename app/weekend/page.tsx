// Live Weekend — uses the WeekendScreen component with placeholder data.
//
// Zero state (no active round): shows next scheduled round with countdown
// and "sessions will populate here" message.
//
// Active round: passes real-shaped placeholder data into WeekendScreen.
// Step 9 replaces placeholder with live API calls.
//
// ?liveData=true is honoured: when present AND the active round is in_progress,
// indicates fresh data should be shown without stale indicators.
// When the round is completed it is treated as a no-op (completed data is
// not "live" by definition).

import type { Metadata } from "next";
import { Radio, Clock } from "lucide-react";
import { WeekendScreen } from "@/components/weekend/weekend-screen";
import type {
  WeekendScreenProps,
  SessionTabKey,
} from "@/components/weekend/weekend-screen";
import type { TeamSlug } from "@/lib/ui/tokens";
import type { CarLapEntry } from "@/components/charts/lap-time-distribution";
import type { AeroEntry } from "@/components/charts/aero-mode-advantage";

export const metadata: Metadata = { title: "Weekend" };

// ---------------------------------------------------------------------------
// Placeholder state — swap for DB query in Step 9
// ---------------------------------------------------------------------------

// Set to null to show the zero state (no active round).
const ACTIVE_ROUND: WeekendScreenProps | null = null;

// Alternatively, here is a fully-populated placeholder for development preview:
const PLACEHOLDER_WEEKEND: WeekendScreenProps = {
  roundNumber:    1,
  roundName:      "Australian Grand Prix",
  circuitName:    "Albert Park",
  circuitCountry: "Australia",
  season:         2026,
  roundStatus:    "upcoming",

  availableSessions: ["fp1", "fp2", "fp3", "qualifying", "race"] as SessionTabKey[],

  sessionMetrics: {
    fp1: [
      { carId: "car_ferrari",  teamSlug: "ferrari" as TeamSlug,  designation: "SF-26",    oneLapPace: null, longRunPace: null, longRunPaceAvailable: false, confidence: "low", sourceVariant: "official" },
      { carId: "car_mclaren",  teamSlug: "mclaren" as TeamSlug,  designation: "MCL39",    oneLapPace: null, longRunPace: null, longRunPaceAvailable: false, confidence: "low", sourceVariant: "official" },
      { carId: "car_redbull",  teamSlug: "redbull" as TeamSlug,  designation: "RB21",     oneLapPace: null, longRunPace: null, longRunPaceAvailable: false, confidence: "low", sourceVariant: "official" },
      { carId: "car_mercedes", teamSlug: "mercedes" as TeamSlug, designation: "W16",      oneLapPace: null, longRunPace: null, longRunPaceAvailable: false, confidence: "low", sourceVariant: "official" },
    ],
    fp2: [], fp3: [], qualifying: [], sprint: [], race: [],
  },

  lapEntries: {
    fp1: [] as CarLapEntry[],
    fp2: [], fp3: [], qualifying: [], sprint: [], race: [],
  },

  aeroEntries: [] as AeroEntry[],
  dabZonesConfirmed: false,

  fastestLapPredictions: [
    { carId: "car_ferrari",  teamSlug: "ferrari" as TeamSlug,  label: "Ferrari SF-26",    predictedMs: 82400, marginOfErrorMs: 2000, confidence: "low" },
    { carId: "car_mclaren",  teamSlug: "mclaren" as TeamSlug,  label: "McLaren MCL39",    predictedMs: 82650, marginOfErrorMs: 2000, confidence: "low" },
    { carId: "car_redbull",  teamSlug: "redbull" as TeamSlug,  label: "Red Bull RB21",    predictedMs: 82500, marginOfErrorMs: 2000, confidence: "low" },
    { carId: "car_mercedes", teamSlug: "mercedes" as TeamSlug, label: "Mercedes W16",     predictedMs: 82800, marginOfErrorMs: 2000, confidence: "low" },
  ],
  preSeasonOnly: true,
};

// ---------------------------------------------------------------------------
// Zero state component
// ---------------------------------------------------------------------------

function WeekendZeroState() {
  return (
    <div className="max-w-screen-lg mx-auto px-4 py-12 text-center space-y-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface-elevated border border-border mb-2">
        <Radio size={24} className="text-text-muted" aria-hidden />
      </div>
      <h1 className="text-data-large font-bold text-text-primary">Weekend</h1>
      <p className="text-data-medium text-text-secondary max-w-sm mx-auto">
        No active race weekend at the moment.
      </p>
      <p className="text-data-small text-text-secondary flex items-center justify-center gap-2">
        <Clock size={14} className="text-text-muted" aria-hidden />
        Next: Round 1 · Australian GP · 15 March 2026
      </p>
      <p className="text-caption text-text-muted max-w-xs mx-auto">
        This view will populate automatically when the first session of Round 1
        is scheduled to begin. Session tabs, car metrics, and fastest lap
        estimates will appear here in real time.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WeekendPage({
  searchParams,
}: {
  searchParams: { liveData?: string };
}) {
  const liveData = searchParams.liveData === "true";

  // Use the placeholder for development preview; production uses ACTIVE_ROUND
  const roundData = ACTIVE_ROUND ?? (process.env.NODE_ENV === "development" ? PLACEHOLDER_WEEKEND : null);

  if (!roundData) return <WeekendZeroState />;

  // When liveData=true and round is completed, treat as no-op per spec.
  const effectiveLiveData = liveData && roundData.roundStatus !== "completed";

  return (
    <WeekendScreen
      {...roundData}
      // Step 9 will override roundStatus based on live DB round.status
      roundStatus={effectiveLiveData ? "in_progress" : roundData.roundStatus}
    />
  );
}
