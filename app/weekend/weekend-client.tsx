"use client";

// WeekendClient — fetches /api/weekend and renders WeekendScreen.
//
// Auto-refresh strategy:
//   - Polls every 30 seconds ONLY when round.status === 'in_progress'
//   - Tracks a session completion signature (joined ended_at values for all sessions)
//   - When the signature changes between polls, a new session has completed:
//     shows a "New session data available" banner for 5 seconds
//   - Stops polling when round becomes 'completed' or is null
//   - No polling when round is 'upcoming' (nothing changes session-by-session)
//
// "Not on a fixed timer" means: polling exists to detect changes, but the
// visible update (banner + data refresh) is triggered by detected session
// completion, not by the poll tick itself.
//
// Loading state: skeleton layout matching WeekendScreen dimensions.
// Error state:   error card with retry button.

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Radio, Clock, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { WeekendScreen } from "@/components/weekend/weekend-screen";
import type { WeekendScreenProps, SessionTabKey } from "@/components/weekend/weekend-screen";
import type { CarLapEntry } from "@/components/charts/lap-time-distribution";
import type { AeroEntry } from "@/components/charts/aero-mode-advantage";
import type { WeekendApiResponse, WeekendRound, WeekendLapEntry, WeekendSessionMeta, WeekendSessionResult, WeekendPrediction } from "@/lib/api/types";
import type { TeamSlug, ConfidenceTier, SourceVariant } from "@/lib/ui/tokens";

const POLL_INTERVAL_MS = 30_000;

const VALID_TAB_SESSIONS: SessionTabKey[] = [
  "fp1", "fp2", "fp3", "qualifying", "sprint", "race",
];

// ---------------------------------------------------------------------------
// Map API response to WeekendScreenProps
// ---------------------------------------------------------------------------

function toWeekendProps(round: WeekendRound, liveData: boolean): WeekendScreenProps {
  const emptyMetrics = Object.fromEntries(
    VALID_TAB_SESSIONS.map((st) => [st, []])
  ) as unknown as Record<SessionTabKey, WeekendScreenProps["sessionMetrics"][SessionTabKey]>;

  const emptyLapEntries = Object.fromEntries(
    VALID_TAB_SESSIONS.map((st) => [st, [] as CarLapEntry[]])
  ) as Record<SessionTabKey, CarLapEntry[]>;

  const sessionMetrics = { ...emptyMetrics };
  const lapEntries = { ...emptyLapEntries };

  for (const st of VALID_TAB_SESSIONS) {
    const metrics = round.sessionMetrics[st];
    if (metrics) {
      sessionMetrics[st] = metrics.map((m: WeekendSessionResult) => ({
        carId: m.carId,
        teamSlug: m.teamSlug as TeamSlug,
        designation: m.designation,
        oneLapPace: m.oneLapPace,
        longRunPace: m.longRunPace,
        longRunPaceAvailable: m.longRunPaceAvailable,
        confidence: m.confidence as ConfidenceTier,
        sourceVariant: m.sourceVariant as SourceVariant,
      }));
    }
    const laps = round.lapEntries[st];
    if (laps) {
      lapEntries[st] = laps.map((e: WeekendLapEntry) => ({
        carId: e.carId,
        teamSlug: e.teamSlug as TeamSlug,
        label: e.label,
        lapTimeMs: e.lapTimeMs,
        gapToLeaderMs: e.gapToLeaderMs,
      }));
    }
  }

  const availableSessions = round.availableSessions.filter((st): st is SessionTabKey =>
    VALID_TAB_SESSIONS.includes(st as SessionTabKey)
  );

  return {
    roundNumber: round.roundNumber,
    roundName: round.roundName,
    circuitName: round.circuitName,
    circuitCountry: round.circuitCountry,
    season: round.season,
    roundStatus: liveData && round.status === "in_progress" ? "in_progress" : round.status,
    availableSessions,
    sessionMetrics,
    lapEntries,
    aeroEntries: round.aeroEntries as AeroEntry[],
    dabZonesConfirmed: round.dabZonesConfirmed,
    fastestLapPredictions: round.predictions.map((p: WeekendPrediction) => ({
      carId: p.carId,
      teamSlug: p.teamSlug as TeamSlug,
      label: p.label,
      predictedMs: p.predictedMs,
      marginOfErrorMs: p.marginOfErrorMs,
      confidence: p.confidence as ConfidenceTier,
      ...(p.actualMs !== undefined ? { actualMs: p.actualMs } : {}),
    })),
    preSeasonOnly: round.preSeasonOnly,
  };
}

// Build a string that changes whenever a new session ends.
function sessionSignature(round: WeekendRound): string {
  return round.sessions
    .map((s: WeekendSessionMeta) => `${s.sessionType}:${s.endedAt ?? "pending"}`)
    .join("|");
}

// ---------------------------------------------------------------------------
// Zero state
// ---------------------------------------------------------------------------

function WeekendZeroState({
  nextRound,
}: {
  nextRound?: { number: number; name: string } | null;
}) {
  return (
    <div className="max-w-screen-lg mx-auto px-4 py-12 text-center space-y-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface-elevated border border-border mb-2">
        <Radio size={24} className="text-text-muted" aria-hidden />
      </div>
      <h1 className="text-data-large font-bold text-text-primary">Weekend</h1>
      <p className="text-data-medium text-text-secondary max-w-sm mx-auto">
        No active race weekend at the moment.
      </p>
      {nextRound && (
        <p className="text-data-small text-text-secondary flex items-center justify-center gap-2">
          <Clock size={14} className="text-text-muted" aria-hidden />
          Next: Round {nextRound.number} · {nextRound.name}
        </p>
      )}
      <p className="text-caption text-text-muted max-w-xs mx-auto">
        This view will populate automatically when the first session of the next
        round begins. Session tabs, car metrics, and fastest lap estimates will
        appear here in real time.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function WeekendLoadingSkeleton() {
  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6 animate-pulse">
      <div className="h-6 w-48 bg-surface-elevated rounded-badge mb-2" />
      <div className="h-4 w-32 bg-surface-elevated rounded-badge mb-6" />
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-16 bg-surface-elevated rounded-badge" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-card bg-surface-elevated" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error card
// ---------------------------------------------------------------------------

function WeekendErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      <div className="rounded-card bg-surface border border-confidence-low/30 p-5 flex items-start gap-3">
        <AlertCircle size={16} className="text-confidence-low shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-data-small text-text-primary font-medium mb-1">
            Failed to load weekend data
          </p>
          <p className="text-caption text-text-muted mb-3">{message}</p>
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-caption text-text-secondary border border-border rounded-badge px-2 py-1 hover:border-text-secondary transition-colors"
          >
            <RefreshCw size={11} aria-hidden />
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session completion banner
// ---------------------------------------------------------------------------

function SessionUpdatedBanner() {
  return (
    <div className="sticky top-14 z-40 px-4 pt-2">
      <div className="max-w-screen-lg mx-auto">
        <div className="flex items-center gap-2 rounded-badge bg-confidence-high/15 border border-confidence-high/40 px-3 py-2 text-caption text-confidence-high">
          <CheckCircle2 size={12} aria-hidden />
          New session data loaded
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WeekendClient() {
  const searchParams = useSearchParams();
  const liveData = searchParams.get("liveData") === "true";

  const [data, setData] = useState<WeekendApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);

  const lastSignatureRef = useRef<string>("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWeekend = useCallback(async (isRefresh = false) => {
    try {
      const res = await fetch("/api/weekend");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: WeekendApiResponse = await res.json();

      if (isRefresh && json.round) {
        const sig = sessionSignature(json.round);
        if (sig !== lastSignatureRef.current && lastSignatureRef.current !== "") {
          // A session has newly completed since the last poll.
          setJustUpdated(true);
          setTimeout(() => setJustUpdated(false), 5000);
        }
        lastSignatureRef.current = sig;
      } else if (json.round) {
        lastSignatureRef.current = sessionSignature(json.round);
      }

      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    fetchWeekend(false);
  }, [fetchWeekend]);

  // Polling — only when round is in_progress.
  useEffect(() => {
    if (data?.round?.status !== "in_progress") {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    if (!pollTimerRef.current) {
      pollTimerRef.current = setInterval(() => fetchWeekend(true), POLL_INTERVAL_MS);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [data?.round?.status, fetchWeekend]);

  if (loading) return <WeekendLoadingSkeleton />;
  if (error) return <WeekendErrorCard message={error} onRetry={() => fetchWeekend(false)} />;
  if (!data?.round) return <WeekendZeroState />;

  return (
    <>
      {justUpdated && <SessionUpdatedBanner />}
      <WeekendScreen {...toWeekendProps(data.round, liveData)} />
    </>
  );
}
