// Car Detail View — full profile for one constructor's 2026 car.
//
// URL params:
//   ?liveData=true               — shows in-progress weekend overlay
//                                  no-op when round is completed
//   ?amendmentHistory=type:id    — opens AmendmentPanel (handled globally in layout)
//
// Zero state (pre-Round 1): shows all confirmed spec data, full spec table
// with unavailable fields clearly marked. Performance sections show
// "No session data yet — populates after Round 1."
//
// Spec table rows that are not publicly confirmed render with SourceLabel
// variant="official" only when confirmed; unavailable fields render
// "Not publicly confirmed" with no badge or speculation.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink, GitCommit, Zap } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";

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

export default function CarDetailPage({
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

      {/* Fastest lap predictions — zero state */}
      <section className="rounded-card bg-surface border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-data-small font-semibold text-text-primary">
            Fastest Lap Predictions
          </h2>
          <SourceLabel variant="predicted" size="sm" />
        </div>
        <p className="text-caption text-text-muted py-4 text-center">
          Circuit-by-circuit predictions will appear here after the
          prediction engine has run for the first time.
        </p>
        <p className="text-caption text-text-muted text-center">
          <Link href="/methodology" className="underline hover:text-text-secondary transition-colors">
            How predictions are calculated
          </Link>
        </p>
      </section>
    </div>
  );
}
