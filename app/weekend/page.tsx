// Live Weekend — renders the WeekendScreen when a round is active.
//
// Zero state (no active round): shows WeekendZeroState in both dev and
// production. There is no dev-mode placeholder — fabricated lap time
// numbers must never appear in any environment without DB provenance.
//
// Active round: passes real-shaped data from the DB into WeekendScreen.
// Step 9 replaces ACTIVE_ROUND with a live DB query.
//
// ?liveData=true is honoured: when present AND the active round is in_progress,
// indicates fresh data should be shown without stale indicators.
// When the round is completed it is treated as a no-op (completed data is
// not "live" by definition).

import type { Metadata } from "next";
import { Radio, Clock } from "lucide-react";
import { WeekendScreen } from "@/components/weekend/weekend-screen";
import type { WeekendScreenProps } from "@/components/weekend/weekend-screen";

export const metadata: Metadata = { title: "Weekend" };

// ---------------------------------------------------------------------------
// Active round — swap for DB query in Step 9
// ---------------------------------------------------------------------------

// null = no active round → WeekendZeroState renders in both dev and production.
const ACTIVE_ROUND: WeekendScreenProps | null = null;

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

  if (!ACTIVE_ROUND) return <WeekendZeroState />;

  // When liveData=true and round is completed, treat as no-op per spec.
  const effectiveLiveData = liveData && ACTIVE_ROUND.roundStatus !== "completed";

  return (
    <WeekendScreen
      {...ACTIVE_ROUND}
      // Step 9 will override roundStatus based on live DB round.status
      roundStatus={effectiveLiveData ? "in_progress" : ACTIVE_ROUND.roundStatus}
    />
  );
}
