"use client";

// WeekendScreen — mobile-first Weekend Screen wireframe.
//
// LAYOUT — mobile (default, <768px):
//
//   ┌─────────────────────────────────────┐
//   │  [Round header]                     │
//   │  Round 4 · Miami Grand Prix         │
//   │  Circuit · Round status badge       │
//   ├─────────────────────────────────────┤
//   │  [Session tab strip — scrollable]   │
//   │  FP1 · FP2 · FP3 · QUALI · RACE    │
//   ├─────────────────────────────────────┤
//   │  [Pre-season disclaimer banner]     │  ← preSeasonOnly only
//   ├─────────────────────────────────────┤
//   │  [Car card list — stacked]          │
//   │  ┌─ Team stripe (4px border-left) ─┐│
//   │  │ Car name          Confidence    ││
//   │  │ One-lap ████████░░  8.4         ││
//   │  │ Long-run ██████░░░  6.1         ││
//   │  │ [Source label]                  ││
//   │  └─────────────────────────────────┘│
//   ├─────────────────────────────────────┤
//   │  [Fastest Lap Prediction card]      │
//   │  Ranked list: car + time + margin   │
//   │  [SourceLabel: Predicted]           │
//   ├─────────────────────────────────────┤
//   │  [Aero Mode panel]                  │
//   │  X/Z bars (withheld if unconfirmed) │
//   └─────────────────────────────────────┘
//
// LAYOUT — desktop (md: ≥768px):
//   Two-column grid: car cards | charts sidebar
//   Tab strip becomes horizontal pill group instead of scrollable strip
//   Chart panels move to sidebar column
//
// DATA PROPS:
//   All data is passed from the parent page as typed props — this component
//   contains no data fetching. The shape mirrors the API response structures
//   from Steps 4–6 so real data wiring in Step 8 is a direct substitution.

import { useState } from "react";
import { MapPin, Zap, Clock } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { LapTimeDistribution } from "@/components/charts/lap-time-distribution";
import { AeroModeAdvantage } from "@/components/charts/aero-mode-advantage";
import { PredictionActual } from "@/components/charts/prediction-actual";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug, ConfidenceTier, SourceVariant } from "@/lib/ui/tokens";
import type { CarLapEntry } from "@/components/charts/lap-time-distribution";
import type { AeroEntry } from "@/components/charts/aero-mode-advantage";
import type { PredictionActualEntry } from "@/components/charts/prediction-actual";

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------

export type SessionTabKey = "fp1" | "fp2" | "fp3" | "qualifying" | "sprint" | "race";

export interface CarSessionMetric {
  carId: string;
  teamSlug: TeamSlug;
  designation: string;         // e.g. "W15"
  oneLapPace: number | null;   // 0–10
  longRunPace: number | null;  // 0–10
  confidence: ConfidenceTier;
  sourceVariant: SourceVariant;
}

export interface FastestLapPredictionItem {
  carId: string;
  teamSlug: TeamSlug;
  label: string;
  predictedMs: number;
  marginOfErrorMs: number;
  confidence: ConfidenceTier;
  actualMs?: number;
}

export interface WeekendScreenProps {
  // Round context
  roundNumber: number;
  roundName: string;
  circuitName: string;
  circuitCountry: string;
  season: number;
  roundStatus: "upcoming" | "in_progress" | "completed";

  // Session data keyed by tab
  availableSessions: SessionTabKey[];
  sessionMetrics: Record<SessionTabKey, CarSessionMetric[]>;
  lapEntries: Record<SessionTabKey, CarLapEntry[]>;

  // Aero
  aeroEntries: AeroEntry[];
  dabZonesConfirmed: boolean;

  // Predictions
  fastestLapPredictions: FastestLapPredictionItem[];
  preSeasonOnly: boolean;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SESSION_LABELS: Record<SessionTabKey, string> = {
  fp1:        "FP1",
  fp2:        "FP2",
  fp3:        "FP3",
  qualifying: "QUALI",
  sprint:     "SPRINT",
  race:       "RACE",
};

const ROUND_STATUS_CONFIG = {
  upcoming:    { label: "Upcoming",    className: "bg-border text-text-secondary" },
  in_progress: { label: "Live",        className: "bg-f1/20 text-f1 border border-f1/40" },
  completed:   { label: "Completed",   className: "bg-confidence-high/15 text-confidence-high border border-confidence-high/30" },
};

function PaceBar({
  value,
  color,
}: {
  value: number | null;
  color: string;
}) {
  if (value === null) {
    return (
      <span className="text-caption text-text-muted italic">No data</span>
    );
  }
  const pct = Math.round((value / 10) * 100);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-caption text-text-secondary font-mono tabular-nums w-6 text-right shrink-0">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function CarCard({ metric }: { metric: CarSessionMetric }) {
  const color = TEAM_COLORS[metric.teamSlug];
  const teamName = TEAM_NAMES[metric.teamSlug];

  return (
    <div
      className="rounded-card bg-surface-elevated border border-border border-l-4 p-3 animate-fade-in"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-data-small font-semibold text-text-primary leading-tight">
            {teamName}
          </p>
          <p className="text-caption text-text-muted">{metric.designation}</p>
        </div>
        <ConfidenceBadge tier={metric.confidence} size="md" />
      </div>

      <div className="space-y-1.5 mb-2.5">
        <div>
          <p className="text-caption text-text-muted uppercase tracking-wider mb-1">
            One-lap
          </p>
          <PaceBar value={metric.oneLapPace} color={color} />
        </div>
        {metric.longRunPace !== null && (
          <div>
            <p className="text-caption text-text-muted uppercase tracking-wider mb-1">
              Long-run
            </p>
            <PaceBar value={metric.longRunPace} color={color} />
          </div>
        )}
      </div>

      <SourceLabel variant={metric.sourceVariant} size="sm" />
    </div>
  );
}

function FastestLapCard({
  predictions,
  preSeasonOnly,
}: {
  predictions: FastestLapPredictionItem[];
  preSeasonOnly: boolean;
}) {
  const sorted = [...predictions].sort((a, b) => a.predictedMs - b.predictedMs);

  function msToDisplay(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = ms % 1000;
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }

  return (
    <div className="rounded-card bg-surface border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-text-muted" aria-hidden />
          <h3 className="text-data-small font-semibold text-text-primary">
            Fastest Lap Estimates
          </h3>
        </div>
        <SourceLabel variant="predicted" size="sm" />
      </div>

      {preSeasonOnly && (
        <p className="text-caption text-source-predicted mb-3 flex items-start gap-1.5">
          <Zap size={11} className="shrink-0 mt-0.5" aria-hidden />
          Pre-season estimates — no 2026 circuit data yet. Confidence escalates as weekend data arrives.
        </p>
      )}

      <ol className="space-y-2">
        {sorted.map((item, idx) => {
          const color = TEAM_COLORS[item.teamSlug];
          return (
            <li
              key={item.carId}
              className="flex items-center gap-3 py-1 border-b border-border-subtle last:border-0"
            >
              <span className="text-caption text-text-muted font-mono w-4 shrink-0">
                {idx + 1}
              </span>
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-data-small text-text-primary font-medium flex-1 truncate">
                {item.label}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-data-small font-mono tabular-nums text-text-primary">
                  {msToDisplay(item.predictedMs)}
                </span>
                <span className="text-caption text-text-muted font-mono">
                  ±{(item.marginOfErrorMs / 1000).toFixed(1)}s
                </span>
              </div>
              <ConfidenceBadge tier={item.confidence} size="sm" />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WeekendScreen({
  roundNumber,
  roundName,
  circuitName,
  circuitCountry,
  season,
  roundStatus,
  availableSessions,
  sessionMetrics,
  lapEntries,
  aeroEntries,
  dabZonesConfirmed,
  fastestLapPredictions,
  preSeasonOnly,
}: WeekendScreenProps) {
  const [activeTab, setActiveTab] = useState<SessionTabKey>(
    availableSessions[0] ?? "fp1"
  );

  const statusCfg = ROUND_STATUS_CONFIG[roundStatus];
  const currentMetrics = sessionMetrics[activeTab] ?? [];
  const currentLaps = lapEntries[activeTab] ?? [];

  // Build PredictionActual entries from fastest lap predictions + any actual data.
  const predActualData: PredictionActualEntry[] = fastestLapPredictions.map(
    (p) => ({
      carId: p.carId,
      teamSlug: p.teamSlug,
      label: p.label,
      predictedMs: p.predictedMs,
      marginOfErrorMs: p.marginOfErrorMs,
      confidence: p.confidence,
      actualMs: p.actualMs,
    })
  );

  return (
    // Root: full-height column, dark bg, mobile-first max-w
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="max-w-screen-lg mx-auto">

        {/* ---- Round header ---- */}
        <header className="px-4 pt-5 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-caption text-text-muted uppercase tracking-wider mb-0.5">
                {season} Season · Round {roundNumber}
              </p>
              <h1 className="text-data-large font-bold text-text-primary leading-tight truncate">
                {roundName}
              </h1>
              <p className="text-data-small text-text-secondary flex items-center gap-1 mt-1">
                <MapPin size={12} aria-hidden />
                {circuitName}, {circuitCountry}
              </p>
            </div>
            <span
              className={`text-label uppercase rounded-badge px-2 py-1 shrink-0 ${statusCfg.className}`}
            >
              {statusCfg.label}
            </span>
          </div>
        </header>

        {/* ---- Session tab strip — horizontal scroll on mobile ---- */}
        <nav
          className="flex gap-1 px-4 py-2 overflow-x-auto scrollbar-none border-b border-border bg-surface"
          aria-label="Session tabs"
          role="tablist"
        >
          {availableSessions.map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={[
                "shrink-0 rounded-badge px-3 py-1.5 text-label uppercase transition-colors",
                activeTab === key
                  ? "bg-f1 text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated",
              ].join(" ")}
            >
              {SESSION_LABELS[key]}
            </button>
          ))}
        </nav>

        {/* ---- Main content area ---- */}
        {/*
          Mobile:  single column, stacked sections
          Desktop: two-column grid (cards left, charts right)
        */}
        <main className="px-4 py-4 md:grid md:grid-cols-[1fr_1fr] md:gap-6 md:items-start">

          {/* Left column on desktop / top on mobile */}
          <div className="space-y-3 mb-4 md:mb-0">

            {/* Pre-season disclaimer */}
            {preSeasonOnly && (
              <div className="rounded-card bg-source-predicted/10 border border-source-predicted/30 border-dashed px-4 py-3 flex items-start gap-2 animate-fade-in">
                <Zap size={14} className="text-source-predicted shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-label font-semibold text-source-predicted uppercase">
                    Pre-Season Estimates
                  </p>
                  <p className="text-caption text-text-secondary mt-0.5">
                    No 2026 race data for this circuit. All metrics are model
                    estimates. Confidence will escalate as each session completes.
                  </p>
                </div>
              </div>
            )}

            {/* Car metric cards */}
            {currentMetrics.length > 0 ? (
              currentMetrics.map((metric) => (
                <CarCard key={metric.carId} metric={metric} />
              ))
            ) : (
              <div className="rounded-card bg-surface-elevated border border-border px-4 py-6 text-center">
                <p className="text-data-small text-text-muted">
                  No session data available yet
                </p>
                <p className="text-caption text-text-muted mt-1">
                  Data will appear once the session results are published
                </p>
              </div>
            )}
          </div>

          {/* Right column on desktop / below cards on mobile */}
          <div className="space-y-4">

            {/* Lap time distribution (shown when data available) */}
            {currentLaps.length > 0 && (
              <LapTimeDistribution
                data={currentLaps}
                sessionLabel={SESSION_LABELS[activeTab]}
                sourceVariant="official"
              />
            )}

            {/* Fastest lap prediction card */}
            {fastestLapPredictions.length > 0 && (
              <FastestLapCard
                predictions={fastestLapPredictions}
                preSeasonOnly={preSeasonOnly}
              />
            )}

            {/* Prediction vs actual chart */}
            {fastestLapPredictions.length > 0 && (
              <PredictionActual
                data={predActualData}
                preSeasonOnly={preSeasonOnly}
              />
            )}

            {/* Aero mode panel */}
            <AeroModeAdvantage
              data={aeroEntries}
              dabZonesConfirmed={dabZonesConfirmed}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
