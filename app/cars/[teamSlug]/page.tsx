// Car Detail View — full profile for one constructor's 2026 car.
//
// All spec data comes from the Car model + CarFieldStatus (DB), not hardcoded.
// Predictions come from DB (Prediction table, prediction_type='fastest_lap').
//
// URL params:
//   ?asOfRound=N              — filter predictions to round_valid_from ≤ N
//   ?liveData=true            — shows live badge when round is in_progress
//   ?amendmentHistory=type:id — opens AmendmentPanel (handled globally in layout)
//
// Spec confirmation: CarFieldStatus.status='confirmed' overrides null-check.
// Stale indicator: prediction or CCP provenance.is_stale = true.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink, GitCommit, Zap, Info, AlertCircle } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";
import { prisma } from "@/lib/db/client";

// Spec source URLs are not stored in the DB — editorial constant per team.
const SPEC_SOURCE_URLS: Partial<Record<string, string>> = {
  ferrari:  "https://www.formula1.com/en/teams/ferrari",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StaleTag() {
  return (
    <span className="inline-flex items-center gap-0.5 text-caption text-confidence-low">
      <AlertCircle size={9} aria-hidden />
      Stale
    </span>
  );
}

// ---------------------------------------------------------------------------
// Spec row component
// ---------------------------------------------------------------------------

function SpecRow({
  label,
  value,
  confirmed,
}: {
  label: string;
  value: string | number | null;
  confirmed: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-caption text-text-muted w-36 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
        {confirmed && value !== null ? (
          <>
            <span className="text-data-small text-text-primary text-right">{value}</span>
            <SourceLabel variant="official" size="sm" />
          </>
        ) : (
          <span className="text-caption text-text-muted italic">
            Not publicly confirmed
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: { teamSlug: string };
}): Promise<Metadata> {
  const car = await prisma.car.findFirst({
    where: { team: { slug: params.teamSlug }, season: 2026 },
    select: { designation: true, team: { select: { name: true } } },
  });
  if (!car) return { title: "Car not found" };
  return { title: `${car.team.name} ${car.designation}` };
}

export default async function CarDetailPage({
  params,
  searchParams,
}: {
  params: { teamSlug: string };
  searchParams: { liveData?: string; amendmentHistory?: string; asOfRound?: string };
}) {
  const liveData = searchParams.liveData === "true";
  const asOfRound = searchParams.asOfRound != null
    ? parseInt(searchParams.asOfRound, 10)
    : null;

  // -------------------------------------------------------------------------
  // Car + specs from DB
  // -------------------------------------------------------------------------
  const car = await prisma.car.findFirst({
    where: { team: { slug: params.teamSlug }, season: 2026 },
    select: {
      id: true,
      designation: true,
      gearbox_type: true,
      weight_kg: true,
      fuel_capacity_l: true,
      suspension_concept: true,
      notes: true,
      team: { select: { slug: true, name: true } },
    },
  });

  if (!car) notFound();

  const teamSlug = car.team.slug as TeamSlug;
  const color = TEAM_COLORS[teamSlug];
  const teamName = TEAM_NAMES[teamSlug] ?? car.team.name;

  // CarFieldStatus: explicit confirmed/unavailable per field.
  // Falls back to null-check when a field has no status record.
  const fieldStatuses = await prisma.carFieldStatus.findMany({
    where: { car_id: car.id },
    select: { field_name: true, status: true },
  });
  const fieldStatusMap = new Map(fieldStatuses.map((f) => [f.field_name, f.status]));

  function isConfirmed(fieldName: string, value: unknown): boolean {
    const status = fieldStatusMap.get(fieldName);
    if (status) return status === "confirmed";
    return value !== null;
  }

  // -------------------------------------------------------------------------
  // Active round check (for live badge)
  // -------------------------------------------------------------------------
  const activeRound = liveData
    ? await prisma.round.findFirst({
        where: { season: 2026, status: "in_progress" },
        select: { id: true },
      })
    : null;
  const roundIsLive = activeRound !== null;

  // -------------------------------------------------------------------------
  // Predictions from DB
  // -------------------------------------------------------------------------
  const predictions = await prisma.prediction.findMany({
    where: {
      car_id: car.id,
      superseded_at: null,
      prediction_type: "fastest_lap",
      ...(asOfRound !== null ? { round_valid_from: { lte: asOfRound } } : {}),
    },
    select: {
      id: true,
      predicted_value_display: true,
      margin_of_error_ms: true,
      confidence: true,
      source_type: true,
      round_valid_from: true,
      circuit: {
        select: { name: true, slug: true, country: true },
      },
      provenance: { select: { is_stale: true } },
    },
    orderBy: { circuit: { name: "asc" } },
  });

  const preSeasonOnly =
    predictions.length === 0 ||
    predictions.every((p) => p.source_type === "editorial");

  const anyPredictionStale = predictions.some((p) => p.provenance?.is_stale);

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      {/* Back link */}
      <Link
        href="/cars"
        className="inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-text-secondary transition-colors mb-4"
      >
        <ChevronLeft size={12} aria-hidden />
        All Cars
      </Link>

      {/* Car header */}
      <div
        className="rounded-card bg-surface border border-l-4 border-border p-5 mb-6"
        style={{ borderLeftColor: color }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-caption text-text-muted uppercase tracking-wider mb-0.5">
              2026 Constructor
            </p>
            <h1 className="text-data-hero font-bold" style={{ color }}>
              {teamName}
            </h1>
            <p className="text-data-medium text-text-secondary mt-1">
              {car.designation}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {liveData && roundIsLive && (
              <span className="flex items-center gap-1 text-caption text-f1 border border-f1/30 rounded-badge px-2 py-0.5">
                <Zap size={10} aria-hidden />
                Live
              </span>
            )}
            {asOfRound !== null && (
              <span className="text-caption text-text-muted border border-border rounded-badge px-2 py-0.5">
                Round {asOfRound} data
              </span>
            )}
            <Link
              href={`/cars?compare=${teamSlug}`}
              className="text-caption text-text-secondary border border-border rounded-badge px-2 py-1 hover:border-text-secondary transition-colors"
            >
              Compare
            </Link>
          </div>
        </div>
      </div>

      {/* Specifications */}
      <section className="rounded-card bg-surface border border-border p-4 mb-6">
        <h2 className="text-data-small font-semibold text-text-primary mb-3">
          Technical Specifications
        </h2>
        <SpecRow
          label="Designation"
          value={car.designation}
          confirmed
        />
        <SpecRow
          label="Gearbox type"
          value={car.gearbox_type === "unavailable" ? null : car.gearbox_type}
          confirmed={
            car.gearbox_type !== "unavailable" ||
            fieldStatusMap.get("gearbox_type") === "confirmed"
          }
        />
        <SpecRow
          label="Weight (kg)"
          value={car.weight_kg}
          confirmed={isConfirmed("weight_kg", car.weight_kg)}
        />
        <SpecRow
          label="Fuel capacity (L)"
          value={car.fuel_capacity_l}
          confirmed={isConfirmed("fuel_capacity_l", car.fuel_capacity_l)}
        />
        <SpecRow
          label="Suspension"
          value={car.suspension_concept}
          confirmed={isConfirmed("suspension_concept", car.suspension_concept)}
        />
        {car.notes && (
          <div className="pt-2 mt-2 border-t border-border">
            <p className="text-caption text-text-muted">{car.notes}</p>
          </div>
        )}
        {SPEC_SOURCE_URLS[params.teamSlug] && (
          <a
            href={SPEC_SOURCE_URLS[params.teamSlug]}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-caption text-text-muted hover:text-text-secondary transition-colors"
          >
            <ExternalLink size={10} aria-hidden />
            Formula1.com official page
          </a>
        )}
      </section>

      {/* Performance — zero state pre-Round 1 */}
      <section className="rounded-card bg-surface border border-border p-4 mb-6">
        <h2 className="text-data-small font-semibold text-text-primary mb-3">
          Performance Metrics
        </h2>
        <div className="py-6 text-center space-y-2">
          <p className="text-data-small text-text-secondary">No session data yet</p>
          <p className="text-caption text-text-muted max-w-xs mx-auto">
            One-lap pace, long-run pace, straight-line efficiency, cornering
            performance, and tyre behaviour will populate after Round 1
            sessions complete.
          </p>
          <ConfidenceBadge tier="low" size="md" className="mx-auto" />
        </div>
      </section>

      {/* Fastest Lap Predictions */}
      <section className="rounded-card bg-surface border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-data-small font-semibold text-text-primary">
            Fastest Lap Predictions
          </h2>
          <div className="flex items-center gap-2">
            {anyPredictionStale && <StaleTag />}
            <SourceLabel variant="predicted" size="sm" />
          </div>
        </div>

        {predictions.length === 0 ? (
          <>
            <p className="text-caption text-text-muted py-4 text-center">
              Circuit-by-circuit predictions will appear here after the
              prediction engine has run for the first time.
            </p>
            <p className="text-caption text-text-muted text-center">
              <Link
                href="/methodology"
                className="underline hover:text-text-secondary transition-colors"
              >
                How predictions are calculated
              </Link>
            </p>
          </>
        ) : (
          <>
            {preSeasonOnly && (
              <div className="flex items-start gap-2.5 rounded-badge border border-dashed border-source-predicted/40 bg-source-predicted/5 p-3 mb-4">
                <Info size={14} className="text-source-predicted shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-caption font-medium text-source-predicted">
                    Pre-season editorial estimates
                  </p>
                  <p className="text-caption text-text-muted mt-0.5">
                    These are manually authored baselines, not model-generated
                    predictions. They carry low confidence and a ±2.0 s margin of
                    error. They will be superseded by model predictions after
                    Round 1 session data is ingested.{" "}
                    <Link
                      href="/methodology"
                      className="underline hover:text-text-secondary transition-colors"
                    >
                      Methodology
                    </Link>
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-px">
              {predictions.map((pred) => (
                <div
                  key={pred.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-data-small text-text-primary block truncate">
                      {pred.circuit.name}
                    </span>
                    <span className="text-caption text-text-muted">
                      {pred.circuit.country}
                    </span>
                  </div>
                  <span className="font-mono text-data-small text-text-primary tabular-nums shrink-0">
                    {pred.predicted_value_display ?? "—"}
                  </span>
                  {pred.provenance?.is_stale && <StaleTag />}
                  <ConfidenceBadge
                    tier={pred.confidence as "low" | "medium" | "high"}
                    size="sm"
                  />
                  <SourceLabel variant="predicted" size="sm" />
                  <Link
                    href={`?amendmentHistory=predictions:${pred.id}`}
                    className="text-text-muted hover:text-text-secondary transition-colors shrink-0"
                    aria-label="View prediction amendment history"
                  >
                    <GitCommit size={11} />
                  </Link>
                </div>
              ))}
            </div>

            <p className="mt-3 text-caption text-text-muted text-right">
              <Link
                href="/methodology"
                className="underline hover:text-text-secondary transition-colors"
              >
                How predictions are calculated
              </Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
