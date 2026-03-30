// Car Detail View — full profile for one constructor's 2026 car.
//
// URL params:
//   ?liveData=true               — shows in-progress weekend overlay
//                                  no-op when round is completed
//   ?amendmentHistory=type:id    — opens AmendmentPanel (handled globally in layout)
//
// Predictions section:
//   Queries the DB directly (server component) for all active fastest_lap
//   predictions for this car. Three render states:
//     1. predictions.length === 0            → zero state (no records at all)
//     2. preSeasonOnly === true              → editorial baselines + disclaimer banner
//     3. preSeasonOnly === false             → model predictions, no banner
//
// Spec table rows that are not publicly confirmed render with SourceLabel
// variant="official" only when confirmed; unavailable fields render
// "Not publicly confirmed" with no badge or speculation.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink, GitCommit, Zap, Info } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";
import { prisma } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// Placeholder data — keyed by teamSlug
// ---------------------------------------------------------------------------

interface CarSpec {
  teamSlug: TeamSlug;
  designation: string;
  gearboxType: "longitudinal" | "transverse" | "unavailable";
  weightKg: number | null;
  fuelCapacityL: number | null;
  suspensionConcept: string | null;
  notes: string | null;
  specSourceUrl: string | null;
}

const CAR_SPECS: Record<string, CarSpec> = {
  ferrari:     { teamSlug: "ferrari",     designation: "SF-26",    gearboxType: "longitudinal", weightKg: 798,  fuelCapacityL: null, suspensionConcept: "Pull-rod front, push-rod rear",      notes: null, specSourceUrl: "https://www.formula1.com/en/teams/ferrari" },
  mclaren:     { teamSlug: "mclaren",     designation: "MCL39",    gearboxType: "transverse",   weightKg: 800,  fuelCapacityL: null, suspensionConcept: "Push-rod front and rear",              notes: null, specSourceUrl: null },
  redbull:     { teamSlug: "redbull",     designation: "RB21",     gearboxType: "longitudinal", weightKg: null, fuelCapacityL: null, suspensionConcept: null,                                  notes: null, specSourceUrl: null },
  mercedes:    { teamSlug: "mercedes",    designation: "W16",      gearboxType: "longitudinal", weightKg: null, fuelCapacityL: null, suspensionConcept: "Zero-pod concept (provisional)",       notes: null, specSourceUrl: null },
  astonmartin: { teamSlug: "astonmartin", designation: "AMR26",    gearboxType: "longitudinal", weightKg: null, fuelCapacityL: null, suspensionConcept: null,                                  notes: null, specSourceUrl: null },
  alpine:      { teamSlug: "alpine",      designation: "A526",     gearboxType: "transverse",   weightKg: null, fuelCapacityL: null, suspensionConcept: null,                                  notes: null, specSourceUrl: null },
  williams:    { teamSlug: "williams",    designation: "FW47",     gearboxType: "longitudinal", weightKg: null, fuelCapacityL: null, suspensionConcept: null,                                  notes: null, specSourceUrl: null },
  racingbulls: { teamSlug: "racingbulls", designation: "VCARB 02", gearboxType: "longitudinal", weightKg: null, fuelCapacityL: null, suspensionConcept: null,                                  notes: null, specSourceUrl: null },
  haas:        { teamSlug: "haas",        designation: "VF-26",    gearboxType: "longitudinal", weightKg: null, fuelCapacityL: null, suspensionConcept: null,                                  notes: null, specSourceUrl: null },
  sauber:      { teamSlug: "sauber",      designation: "C45",      gearboxType: "longitudinal", weightKg: null, fuelCapacityL: null, suspensionConcept: null,                                  notes: null, specSourceUrl: null },
};

export async function generateMetadata({
  params,
}: {
  params: { teamSlug: string };
}): Promise<Metadata> {
  const spec = CAR_SPECS[params.teamSlug];
  if (!spec) return { title: "Car not found" };
  return { title: `${TEAM_NAMES[spec.teamSlug]} ${spec.designation}` };
}

// ---------------------------------------------------------------------------
// Spec row component
// ---------------------------------------------------------------------------

function SpecRow({
  label,
  value,
  confirmed,
  amendmentEntityId,
}: {
  label: string;
  value: string | number | null;
  confirmed: boolean;
  amendmentEntityId?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-caption text-text-muted w-36 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
        {confirmed && value !== null ? (
          <>
            <span className="text-data-small text-text-primary text-right">{value}</span>
            <SourceLabel variant="official" size="sm" />
            {amendmentEntityId && (
              <Link
                href={`?amendmentHistory=cars:${amendmentEntityId}`}
                className="text-text-muted hover:text-text-secondary transition-colors"
                aria-label="View amendment history"
              >
                <GitCommit size={11} />
              </Link>
            )}
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

export default async function CarDetailPage({
  params,
  searchParams,
}: {
  params: { teamSlug: string };
  searchParams: { liveData?: string; amendmentHistory?: string };
}) {
  const spec = CAR_SPECS[params.teamSlug];
  if (!spec) notFound();

  const liveData = searchParams.liveData === "true";
  const color = TEAM_COLORS[spec.teamSlug];
  const teamName = TEAM_NAMES[spec.teamSlug];

  // ---------------------------------------------------------------------------
  // Predictions — DB lookup. Non-fatal: car may not be seeded yet.
  // ---------------------------------------------------------------------------
  const car = await prisma.car.findFirst({
    where: { team: { slug: params.teamSlug }, season: 2026 },
    select: { id: true },
  });

  const predictions = car
    ? await prisma.prediction.findMany({
        where: {
          car_id: car.id,
          superseded_at: null,
          prediction_type: "fastest_lap",
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
        },
        orderBy: { circuit: { name: "asc" } },
      })
    : [];

  // Mirrors the same logic as /api/predictions/[carId]/[circuitId].
  // preSeasonOnly = true when all active records are source_type='editorial'.
  // An empty array is also pre-season-only by definition.
  const preSeasonOnly =
    predictions.length === 0 ||
    predictions.every((p) => p.source_type === "editorial");

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
              {spec.designation}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {liveData && (
              <span className="flex items-center gap-1 text-caption text-f1 border border-f1/30 rounded-badge px-2 py-0.5">
                <Zap size={10} aria-hidden />
                Live
              </span>
            )}
            <Link
              href={`/cars?compare=${spec.teamSlug}`}
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
          value={spec.designation}
          confirmed
        />
        <SpecRow
          label="Gearbox type"
          value={spec.gearboxType === "unavailable" ? null : spec.gearboxType}
          confirmed={spec.gearboxType !== "unavailable"}
        />
        <SpecRow
          label="Weight (kg)"
          value={spec.weightKg}
          confirmed={spec.weightKg !== null}
        />
        <SpecRow
          label="Fuel capacity (L)"
          value={spec.fuelCapacityL}
          confirmed={spec.fuelCapacityL !== null}
        />
        <SpecRow
          label="Suspension"
          value={spec.suspensionConcept}
          confirmed={spec.suspensionConcept !== null}
        />
        {spec.notes && (
          <div className="pt-2 mt-2 border-t border-border">
            <p className="text-caption text-text-muted">{spec.notes}</p>
          </div>
        )}
        {spec.specSourceUrl && (
          <a
            href={spec.specSourceUrl}
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
          <p className="text-data-small text-text-secondary">
            No session data yet
          </p>
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
          <SourceLabel variant="predicted" size="sm" />
        </div>

        {predictions.length === 0 ? (
          // True zero state — no records of any kind in the DB
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
            {/* Pre-season disclaimer — shown only when every record is editorial */}
            {preSeasonOnly && (
              <div className="flex items-start gap-2.5 rounded-badge border border-dashed border-source-predicted/40 bg-source-predicted/5 p-3 mb-4">
                <Info
                  size={14}
                  className="text-source-predicted shrink-0 mt-0.5"
                  aria-hidden
                />
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

            {/* Prediction rows — one per circuit */}
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
                  <ConfidenceBadge
                    tier={pred.confidence as "low" | "medium" | "high"}
                    size="sm"
                  />
                  <SourceLabel variant="predicted" size="sm" />
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
