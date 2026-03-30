"use client";

// CarsOverviewClient — client component for Cars Overview.
// Separated from the server page so useRouter/useSearchParams work correctly.

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { GitCompare, Zap, X } from "lucide-react";
import { CompareLimitBlock } from "@/components/layout/compare-limit-block";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { SourceLabel } from "@/components/ui/source-label";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";

// ---------------------------------------------------------------------------
// Placeholder data
// ---------------------------------------------------------------------------

interface CarRow {
  teamSlug: TeamSlug;
  designation: string;
  gearboxType: string;
  weightKg: number | null;
  suspensionConcept: string | null;
  oneLapPace: number | null;
  longRunPace: number | null;
  trackFitScore: number | null;
}

const ALL_CARS: CarRow[] = [
  { teamSlug: "ferrari",     designation: "SF-26",    gearboxType: "longitudinal", weightKg: 798, suspensionConcept: "Pull-rod front, push-rod rear", oneLapPace: null, longRunPace: null, trackFitScore: null },
  { teamSlug: "mclaren",     designation: "MCL39",    gearboxType: "transverse",   weightKg: 800, suspensionConcept: "Push-rod front and rear",       oneLapPace: null, longRunPace: null, trackFitScore: null },
  { teamSlug: "redbull",     designation: "RB21",     gearboxType: "longitudinal", weightKg: null, suspensionConcept: null,                           oneLapPace: null, longRunPace: null, trackFitScore: null },
  { teamSlug: "mercedes",    designation: "W16",      gearboxType: "longitudinal", weightKg: null, suspensionConcept: "Zero-pod concept",             oneLapPace: null, longRunPace: null, trackFitScore: null },
  { teamSlug: "astonmartin", designation: "AMR26",    gearboxType: "longitudinal", weightKg: null, suspensionConcept: null,                           oneLapPace: null, longRunPace: null, trackFitScore: null },
  { teamSlug: "alpine",      designation: "A526",     gearboxType: "transverse",   weightKg: null, suspensionConcept: null,                           oneLapPace: null, longRunPace: null, trackFitScore: null },
  { teamSlug: "williams",    designation: "FW47",     gearboxType: "longitudinal", weightKg: null, suspensionConcept: null,                           oneLapPace: null, longRunPace: null, trackFitScore: null },
  { teamSlug: "racingbulls", designation: "VCARB 02", gearboxType: "longitudinal", weightKg: null, suspensionConcept: null,                           oneLapPace: null, longRunPace: null, trackFitScore: null },
  { teamSlug: "haas",        designation: "VF-26",    gearboxType: "longitudinal", weightKg: null, suspensionConcept: null,                           oneLapPace: null, longRunPace: null, trackFitScore: null },
  { teamSlug: "sauber",      designation: "C45",      gearboxType: "longitudinal", weightKg: null, suspensionConcept: null,                           oneLapPace: null, longRunPace: null, trackFitScore: null },
];

// ---------------------------------------------------------------------------
// Metric display helpers
// ---------------------------------------------------------------------------

function MetricBar({ value, color }: { value: number | null; color: string }) {
  if (value === null) return <span className="text-caption text-text-muted italic">No data</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${(value / 10) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-caption text-text-secondary font-mono w-6 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function SpecValue({ value }: { value: string | number | null }) {
  if (value === null)
    return (
      <span className="text-caption text-text-muted italic flex items-center gap-1">
        Not confirmed
      </span>
    );
  return <span className="text-caption text-text-secondary">{value}</span>;
}

// ---------------------------------------------------------------------------
// Comparison columns (max 2)
// ---------------------------------------------------------------------------

function ComparePanel({ slugs, allCars }: { slugs: TeamSlug[]; allCars: CarRow[] }) {
  const cars = slugs.map((s) => allCars.find((c) => c.teamSlug === s)).filter(Boolean) as CarRow[];
  if (cars.length === 0) return null;

  const ROWS: { label: string; key: keyof CarRow; render?: (v: CarRow[keyof CarRow], car: CarRow) => React.ReactNode }[] = [
    { label: "Designation",         key: "designation" },
    { label: "Gearbox",             key: "gearboxType" },
    { label: "Weight (kg)",         key: "weightKg" },
    { label: "Suspension",          key: "suspensionConcept" },
    { label: "One-lap pace",        key: "oneLapPace",    render: (v, car) => <MetricBar value={v as number | null} color={TEAM_COLORS[car.teamSlug]} /> },
    { label: "Long-run pace",       key: "longRunPace",   render: (v, car) => <MetricBar value={v as number | null} color={TEAM_COLORS[car.teamSlug]} /> },
    { label: "Track fit score",     key: "trackFitScore", render: (v, car) => <MetricBar value={v as number | null} color={TEAM_COLORS[car.teamSlug]} /> },
  ];

  return (
    <div className="rounded-card bg-surface border border-border overflow-hidden mb-6">
      <div className={`grid`} style={{ gridTemplateColumns: `160px repeat(${cars.length}, 1fr)` }}>
        {/* Header row */}
        <div className="bg-surface-elevated border-b border-r border-border px-3 py-2" />
        {cars.map((car) => (
          <div
            key={car.teamSlug}
            className="bg-surface-elevated border-b border-r last:border-r-0 border-border px-3 py-2 border-t-4"
            style={{ borderTopColor: TEAM_COLORS[car.teamSlug] }}
          >
            <p className="text-data-small font-semibold text-text-primary">
              {TEAM_NAMES[car.teamSlug]}
            </p>
            <p className="text-caption text-text-muted">{car.designation}</p>
          </div>
        ))}

        {/* Data rows */}
        {ROWS.map(({ label, key, render }) => (
          <>
            <div key={`label-${key}`} className="border-b last:border-b-0 border-r border-border px-3 py-2 bg-surface">
              <span className="text-caption text-text-muted">{label}</span>
            </div>
            {cars.map((car) => (
              <div key={`${car.teamSlug}-${key}`} className="border-b last:border-b-0 border-r last:border-r-0 border-border px-3 py-2">
                {render ? render(car[key], car) : <SpecValue value={car[key] as string | number | null} />}
              </div>
            ))}
          </>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-border flex items-center justify-between">
        <SourceLabel variant="official" size="sm" />
        <ConfidenceBadge tier="low" size="sm" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  compareSlugs: string[];
  highlightSlugs: string[];
  liveData: boolean;
}

export function CarsOverviewClient({ compareSlugs, highlightSlugs, liveData }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isOverLimit = compareSlugs.length > 2;
  const activeCompare = compareSlugs.slice(0, 2) as TeamSlug[];

  function toggleCompare(slug: TeamSlug) {
    const params = new URLSearchParams(searchParams.toString());
    const current = compareSlugs.filter((s): s is TeamSlug => s in TEAM_NAMES);
    let next: TeamSlug[];
    if (current.includes(slug)) {
      next = current.filter((s) => s !== slug);
    } else {
      next = [...current, slug];
    }
    if (next.length === 0) {
      params.delete("compare");
    } else {
      params.set("compare", next.join(","));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-data-large font-bold text-text-primary">Cars</h1>
          <p className="text-data-small text-text-secondary mt-0.5">
            2026 constructors · {liveData && (
              <span className="text-f1 font-medium">Live data active</span>
            )}
            {!liveData && "Select two cars to compare"}
          </p>
        </div>
        {activeCompare.length > 0 && (
          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("compare");
              router.push(`${pathname}?${params.toString()}`);
            }}
            className="flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary border border-border rounded-badge px-2 py-1 transition-colors"
          >
            <X size={11} aria-hidden />
            Clear comparison
          </button>
        )}
      </div>

      {/* Limit block */}
      {isOverLimit && (
        <div className="mb-6">
          <CompareLimitBlock allSlugs={compareSlugs as TeamSlug[]} />
        </div>
      )}

      {/* Comparison panel */}
      {!isOverLimit && activeCompare.length >= 1 && (
        <ComparePanel slugs={activeCompare} allCars={ALL_CARS} />
      )}

      {/* Car grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ALL_CARS.map((car) => {
          const isComparing = compareSlugs.includes(car.teamSlug);
          const isHighlighted = highlightSlugs.includes(car.teamSlug);
          const color = TEAM_COLORS[car.teamSlug];

          return (
            <div
              key={car.teamSlug}
              className={[
                "rounded-card border border-l-4 transition-all",
                isHighlighted ? "border-text-secondary bg-surface-elevated" : "border-border bg-surface-elevated",
                isComparing ? "ring-1 ring-f1/50" : "",
              ].join(" ")}
              style={{ borderLeftColor: color }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Link href={`/cars/${car.teamSlug}`} className="min-w-0 group">
                    <p className="text-data-medium font-semibold text-text-primary group-hover:text-f1 transition-colors">
                      {TEAM_NAMES[car.teamSlug]}
                    </p>
                    <p className="text-caption text-text-muted">{car.designation}</p>
                  </Link>
                  <button
                    onClick={() => toggleCompare(car.teamSlug)}
                    className={[
                      "shrink-0 flex items-center gap-1 text-caption border rounded-badge px-2 py-1 transition-colors",
                      isComparing
                        ? "border-f1/50 text-f1 bg-f1/10"
                        : "border-border text-text-muted hover:border-text-secondary hover:text-text-secondary",
                    ].join(" ")}
                    aria-pressed={isComparing}
                  >
                    <GitCompare size={10} aria-hidden />
                    {isComparing ? "Comparing" : "Compare"}
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-caption text-text-muted uppercase tracking-wider mb-1">One-lap</p>
                    <MetricBar value={car.oneLapPace} color={color} />
                  </div>
                  <div>
                    <p className="text-caption text-text-muted uppercase tracking-wider mb-1">Long-run</p>
                    <MetricBar value={car.longRunPace} color={color} />
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <SourceLabel variant="official" size="sm" />
                  <ConfidenceBadge tier="low" size="sm" />
                  {liveData && <Zap size={11} className="text-f1 ml-auto" aria-hidden />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zero state notice */}
      {ALL_CARS.every((c) => c.oneLapPace === null) && (
        <p className="text-center text-caption text-text-muted mt-6">
          Performance metrics will populate after Round 1 completes.
          Specifications shown are pre-season confirmed data only.
        </p>
      )}
    </div>
  );
}
