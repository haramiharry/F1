// Season Dashboard — primary landing view.
//
// Data: server-side Prisma queries. No placeholder data.
//
// Pre-season (no completed/in-progress rounds):
//   Shows PreSeasonHero with next round callout, car grid (all null pace),
//   upcoming rounds schedule.
//
// Post-Round 1:
//   Shows last completed round summary, car grid with latest pace bars,
//   upcoming rounds from current position.
//
// Stale indicators shown when CCP provenance.is_stale = true.

import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Trophy, Zap, ChevronRight, Clock, AlertCircle } from "lucide-react";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";
import { prisma } from "@/lib/db/client";

export const metadata: Metadata = { title: "Dashboard" };

const SEASON = 2026;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StaleTag() {
  return (
    <span className="inline-flex items-center gap-0.5 text-caption text-confidence-low">
      <AlertCircle size={9} aria-hidden />
      Stale
    </span>
  );
}

function PreSeasonHero({
  nextRound,
}: {
  nextRound: { number: number; name: string; circuit: string; country: string } | null;
}) {
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

        {nextRound && (
          <Link
            href="/weekend"
            className="inline-flex items-center gap-3 rounded-card bg-surface-elevated border border-border px-4 py-3 hover:border-text-secondary transition-colors group"
          >
            <div>
              <p className="text-label uppercase text-text-muted">Season opener</p>
              <p className="text-data-medium font-semibold text-text-primary">
                Round {nextRound.number} · {nextRound.name}
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
        )}
      </div>
    </section>
  );
}

function LastRoundHero({
  round,
}: {
  round: { number: number; name: string; status: string };
}) {
  return (
    <section className="bg-surface border-b border-border px-4 py-6">
      <div className="max-w-screen-lg mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} className="text-f1" aria-hidden />
          <span className="text-label uppercase text-text-secondary">
            Round {round.number} · {round.status === "in_progress" ? "Live" : "Complete"}
          </span>
        </div>
        <p className="text-data-large font-bold text-text-primary">
          {round.name}
        </p>
        <Link
          href="/weekend"
          className="mt-2 inline-flex items-center gap-1 text-caption text-text-secondary hover:text-text-primary transition-colors"
        >
          View session data
          <ChevronRight size={11} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function CarGrid({
  cars,
}: {
  cars: {
    teamSlug: TeamSlug;
    designation: string;
    hasData: boolean;
    oneLapPace: number | null;
    isStale: boolean;
  }[];
}) {
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
        {cars.map((car) => (
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
            {car.hasData && car.oneLapPace !== null ? (
              <>
                <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(car.oneLapPace / 10) * 100}%`,
                      backgroundColor: TEAM_COLORS[car.teamSlug],
                    }}
                  />
                </div>
                {car.isStale && <StaleTag />}
              </>
            ) : (
              <p className="text-caption text-text-muted italic">No data yet</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Schedule({
  rounds,
  totalRounds,
}: {
  rounds: { number: number; name: string; circuit: string; country: string; date: string }[];
  totalRounds: number;
}) {
  return (
    <section className="px-4 py-6 border-t border-border max-w-screen-lg mx-auto w-full">
      <h2 className="text-data-medium font-semibold text-text-primary flex items-center gap-2 mb-4">
        <Calendar size={16} className="text-text-muted" aria-hidden />
        Upcoming Rounds
      </h2>
      {rounds.length === 0 ? (
        <p className="text-caption text-text-muted text-center py-4">
          No upcoming rounds scheduled.
        </p>
      ) : (
        <div className="space-y-2">
          {rounds.map((round) => (
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
            Full {SEASON} calendar · {totalRounds} rounds
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  // Latest active or completed round for the hero section.
  const latestActiveRound = await prisma.round.findFirst({
    where: { season: SEASON, status: { in: ["in_progress", "completed"] } },
    orderBy: { round_number: "desc" },
    select: { id: true, round_number: true, name: true, status: true },
  });

  const isPreSeason = latestActiveRound === null;

  // All cars for the car grid.
  const cars = await prisma.car.findMany({
    where: { season: SEASON },
    select: {
      id: true,
      designation: true,
      team: { select: { slug: true } },
    },
    orderBy: { team: { name: "asc" } },
  });

  // Latest round_aggregate CCP for pace bars (if any round has data).
  const ccpRecords = latestActiveRound
    ? await prisma.carCircuitPerformance.findMany({
        where: {
          round_id: latestActiveRound.id,
          session_type: "round_aggregate",
          superseded_at: null,
        },
        select: {
          car_id: true,
          one_lap_pace: true,
          provenance: { select: { is_stale: true } },
        },
      })
    : [];

  const ccpByCar = new Map(ccpRecords.map((r) => [r.car_id, r]));

  const carItems = cars.map((c) => {
    const ccp = ccpByCar.get(c.id) ?? null;
    return {
      teamSlug: c.team.slug as TeamSlug,
      designation: c.designation,
      hasData: ccp !== null,
      oneLapPace: ccp?.one_lap_pace ?? null,
      isStale: ccp?.provenance?.is_stale ?? false,
    };
  });

  // Next round callout (pre-season hero) or upcoming list.
  const [nextRoundRaw, upcomingRoundsRaw, totalRoundsCount] = await Promise.all([
    prisma.round.findFirst({
      where: { season: SEASON, status: "upcoming" },
      orderBy: { round_number: "asc" },
      select: {
        round_number: true,
        name: true,
        circuit: { select: { name: true, country: true } },
      },
    }),
    prisma.round.findMany({
      where: { season: SEASON, status: "upcoming" },
      orderBy: { round_number: "asc" },
      take: 5,
      select: {
        round_number: true,
        name: true,
        circuit: { select: { name: true, country: true } },
        sessions: {
          where: { session_type: "race" },
          select: { scheduled_start: true },
          take: 1,
          orderBy: { scheduled_start: "asc" },
        },
      },
    }),
    prisma.round.count({ where: { season: SEASON } }),
  ]);

  const nextRound = nextRoundRaw
    ? {
        number: nextRoundRaw.round_number,
        name: nextRoundRaw.name,
        circuit: nextRoundRaw.circuit.name,
        country: nextRoundRaw.circuit.country,
      }
    : null;

  const upcomingRounds = upcomingRoundsRaw.map((r) => {
    const raceStart = r.sessions[0]?.scheduled_start ?? null;
    const dateLabel = raceStart
      ? new Date(raceStart).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })
      : "TBC";
    return {
      number: r.round_number,
      name: r.name,
      circuit: r.circuit.name,
      country: r.circuit.country,
      date: dateLabel,
    };
  });

  return (
    <div>
      {isPreSeason ? (
        <PreSeasonHero nextRound={nextRound} />
      ) : (
        <LastRoundHero
          round={{
            number: latestActiveRound.round_number,
            name: latestActiveRound.name,
            status: latestActiveRound.status,
          }}
        />
      )}

      <div className="max-w-screen-lg mx-auto divide-y divide-border">
        <CarGrid cars={carItems} />
        <Schedule rounds={upcomingRounds} totalRounds={totalRoundsCount} />
      </div>
    </div>
  );
}
