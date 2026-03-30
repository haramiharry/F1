// Season Dashboard — primary landing view.
//
// Zero state (pre-Round 1): shows season schedule, car grid with no metrics,
// countdown to first session. No performance data is surfaced until
// round_status transitions from upcoming.
//
// Post-Round 1: surfaces latest round results, championship trajectory,
// fastest lap award leaders, and next weekend preview.

import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Trophy, Zap, ChevronRight, Clock } from "lucide-react";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { SourceLabel } from "@/components/ui/source-label";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";

export const metadata: Metadata = { title: "Dashboard" };

// ---------------------------------------------------------------------------
// Placeholder data — replaced by real DB queries in Step 9
// ---------------------------------------------------------------------------

const SEASON_META = {
  season: 2026,
  totalRounds: 24,
  currentRound: null as number | null, // null = pre-season
  lastCompletedRound: null as { number: number; name: string; winner: string } | null,
  nextRound: {
    number: 1,
    name: "Australian Grand Prix",
    circuit: "Albert Park",
    country: "Australia",
    scheduledStart: "2026-03-15T05:00:00Z",
  },
};

const CARS_SNAPSHOT: {
  teamSlug: TeamSlug;
  designation: string;
  hasData: boolean;
  oneLapPace: number | null;
}[] = [
  { teamSlug: "ferrari",     designation: "SF-26",    hasData: false, oneLapPace: null },
  { teamSlug: "mclaren",     designation: "MCL39",    hasData: false, oneLapPace: null },
  { teamSlug: "redbull",     designation: "RB21",     hasData: false, oneLapPace: null },
  { teamSlug: "mercedes",    designation: "W16",      hasData: false, oneLapPace: null },
  { teamSlug: "astonmartin", designation: "AMR26",    hasData: false, oneLapPace: null },
  { teamSlug: "alpine",      designation: "A526",     hasData: false, oneLapPace: null },
  { teamSlug: "williams",    designation: "FW47",     hasData: false, oneLapPace: null },
  { teamSlug: "racingbulls", designation: "VCARB 02", hasData: false, oneLapPace: null },
  { teamSlug: "haas",        designation: "VF-26",    hasData: false, oneLapPace: null },
  { teamSlug: "sauber",      designation: "C45",      hasData: false, oneLapPace: null },
];

const UPCOMING_ROUNDS = [
  { number: 1,  name: "Australian GP",   circuit: "Albert Park",         date: "15 Mar" },
  { number: 2,  name: "Chinese GP",      circuit: "Shanghai",            date: "22 Mar" },
  { number: 3,  name: "Japanese GP",     circuit: "Suzuka",              date: "6 Apr" },
  { number: 4,  name: "Bahrain GP",      circuit: "Bahrain Int'l",       date: "13 Apr" },
  { number: 5,  name: "Saudi Arabian GP",circuit: "Jeddah Corniche",     date: "20 Apr" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PreSeasonHero({ nextRound }: { nextRound: typeof SEASON_META.nextRound }) {
  return (
    <section className="bg-surface border-b border-border px-4 py-8 md:py-12">
      <div className="max-w-screen-lg mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-label uppercase text-source-predicted border border-source-predicted/40 border-dashed rounded-badge px-2 py-0.5">
            Pre-Season
          </span>
        </div>
        <h1 className="text-data-hero font-bold text-text-primary mb-2">
          F1 <span className="text-f1">2026</span> Season
        </h1>
        <p className="text-data-medium text-text-secondary mb-6">
          No race data yet. All car metrics will populate as sessions complete.
        </p>

        {/* Next round callout */}
        <Link
          href="/weekend"
          className="inline-flex items-center gap-3 rounded-card bg-surface-elevated border border-border px-4 py-3 hover:border-text-secondary transition-colors group"
        >
          <div>
            <p className="text-label uppercase text-text-muted">Season opener</p>
            <p className="text-data-medium font-semibold text-text-primary">
              Round 1 · {nextRound.name}
            </p>
            <p className="text-data-small text-text-secondary flex items-center gap-1 mt-0.5">
              <Clock size={12} aria-hidden />
              {nextRound.circuit}, {nextRound.country}
            </p>
          </div>
          <ChevronRight
            size={18}
            className="text-text-muted group-hover:text-text-primary transition-colors ml-auto"
            aria-hidden
          />
        </Link>
      </div>
    </section>
  );
}

function CarGrid() {
  return (
    <section className="px-4 py-6 max-w-screen-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-data-medium font-semibold text-text-primary flex items-center gap-2">
          <Trophy size={16} className="text-text-muted" aria-hidden />
          2026 Constructors
        </h2>
        <Link
          href="/cars"
          className="text-caption text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
        >
          Compare cars
          <ChevronRight size={12} aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {CARS_SNAPSHOT.map((car) => (
          <Link
            key={car.teamSlug}
            href={`/cars/${car.teamSlug}`}
            className="rounded-card bg-surface-elevated border border-border border-l-4 p-3 hover:border-l-4 transition-colors group"
            style={{ borderLeftColor: TEAM_COLORS[car.teamSlug] }}
          >
            <p className="text-data-small font-semibold text-text-primary group-hover:text-f1 transition-colors truncate">
              {TEAM_NAMES[car.teamSlug]}
            </p>
            <p className="text-caption text-text-muted mb-2">{car.designation}</p>
            {car.hasData ? (
              <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${((car.oneLapPace ?? 0) / 10) * 100}%`,
                    backgroundColor: TEAM_COLORS[car.teamSlug],
                  }}
                />
              </div>
            ) : (
              <p className="text-caption text-text-muted italic">No data yet</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Schedule() {
  return (
    <section className="px-4 py-6 border-t border-border max-w-screen-lg mx-auto w-full">
      <h2 className="text-data-medium font-semibold text-text-primary flex items-center gap-2 mb-4">
        <Calendar size={16} className="text-text-muted" aria-hidden />
        Upcoming Rounds
      </h2>
      <div className="space-y-2">
        {UPCOMING_ROUNDS.map((round) => (
          <div
            key={round.number}
            className="flex items-center gap-4 rounded-card bg-surface-elevated border border-border px-4 py-3"
          >
            <span className="text-label text-text-muted font-mono tabular-nums w-6 shrink-0">
              R{round.number}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-data-small font-medium text-text-primary truncate">
                {round.name}
              </p>
              <p className="text-caption text-text-muted">{round.circuit}</p>
            </div>
            <span className="text-caption text-text-secondary shrink-0">{round.date}</span>
          </div>
        ))}
        <p className="text-caption text-text-muted text-center pt-1">
          Full 2026 calendar · 24 rounds
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const isPreSeason = SEASON_META.currentRound === null;

  return (
    <div>
      {isPreSeason ? (
        <PreSeasonHero nextRound={SEASON_META.nextRound} />
      ) : (
        // Post-Round 1: show last race summary (Step 9 wires real data)
        <section className="bg-surface border-b border-border px-4 py-6">
          <div className="max-w-screen-lg mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-f1" aria-hidden />
              <span className="text-label uppercase text-text-secondary">
                Round {SEASON_META.currentRound} complete
              </span>
            </div>
            <p className="text-data-large font-bold text-text-primary">
              {SEASON_META.lastCompletedRound?.name}
            </p>
          </div>
        </section>
      )}

      <div className="max-w-screen-lg mx-auto divide-y divide-border">
        <CarGrid />
        <Schedule />
      </div>
    </div>
  );
}
