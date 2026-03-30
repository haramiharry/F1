"use client";

// CarsOverviewClient — fetches /api/cars and renders the comparison grid.
//
// URL params:
//   ?compare=[s1,s2]   — side-by-side comparison panel (max 2)
//   ?highlight=[...]   — highlight these cars in the grid
//   ?liveData=true     — shows live badge on active cars
//   ?asOfRound=N       — cap data to rounds ≤ N (passed to API)
//
// Loading state: skeleton cards during initial fetch.
// Error state:   error card with retry button.
// Zero state:    all cars have null pace → "No performance data yet" notice.
// Stale state:   cars with isStale=true show a StaleTag under their bar.

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { GitCompare, Zap, X, AlertCircle, RefreshCw, GitCommit } from "lucide-react";
import { CompareLimitBlock } from "@/components/layout/compare-limit-block";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { SourceLabel } from "@/components/ui/source-label";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";
import type { CarsApiResponse, CarPerfRow } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MetricBar({ value, color }: { value: number | null; color: string }) {
  if (value === null)
    return <span className="text-caption text-text-muted italic">No data</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${(value / 10) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-caption text-text-secondary font-mono w-6 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function SpecValue({ value }: { value: string | number | null }) {
  if (value === null)
    return <span className="text-caption text-text-muted italic">Not confirmed</span>;
  return <span className="text-caption text-text-secondary">{value}</span>;
}

function StaleTag() {
  return (
    <span className="inline-flex items-center gap-0.5 text-caption text-confidence-low mt-0.5">
      <AlertCircle size={9} aria-hidden />
      Source stale
    </span>
  );
}

function RevisedTag() {
  return (
    <span className="inline-flex items-center gap-0.5 text-caption text-text-secondary border border-border rounded-badge px-1.5 py-0.5">
      <GitCommit size={9} aria-hidden />
      Revised
    </span>
  );
}

// ---------------------------------------------------------------------------
// Comparison panel (max 2 cars)
// ---------------------------------------------------------------------------

function ComparePanel({ slugs, allCars }: { slugs: TeamSlug[]; allCars: CarPerfRow[] }) {
  const cars = slugs
    .map((s) => allCars.find((c) => c.teamSlug === s))
    .filter(Boolean) as CarPerfRow[];
  if (cars.length === 0) return null;

  const ROWS: {
    label: string;
    key: keyof CarPerfRow;
    render?: (v: CarPerfRow[keyof CarPerfRow], car: CarPerfRow) => React.ReactNode;
  }[] = [
    { label: "Designation",     key: "designation" },
    { label: "One-lap pace",    key: "oneLapPace",           render: (v, car) => <MetricBar value={v as number | null} color={TEAM_COLORS[car.teamSlug as TeamSlug]} /> },
    { label: "Long-run pace",   key: "longRunPace",          render: (v, car) => <MetricBar value={v as number | null} color={TEAM_COLORS[car.teamSlug as TeamSlug]} /> },
    { label: "Straight-line",   key: "straightLinePace",     render: (v, car) => <MetricBar value={v as number | null} color={TEAM_COLORS[car.teamSlug as TeamSlug]} /> },
    { label: "Cornering",       key: "corneringPerformance", render: (v, car) => <MetricBar value={v as number | null} color={TEAM_COLORS[car.teamSlug as TeamSlug]} /> },
    { label: "Tyre efficiency", key: "tyreBehaviour",        render: (v, car) => <MetricBar value={v as number | null} color={TEAM_COLORS[car.teamSlug as TeamSlug]} /> },
  ];

  const hasAnyData = cars.some((c) => c.hasData);
  const dataRound = cars.find((c) => c.dataRoundNumber !== null)?.dataRoundNumber;

  return (
    <div className="rounded-card bg-surface border border-border overflow-hidden mb-6">
      <div style={{ display: "grid", gridTemplateColumns: `160px repeat(${cars.length}, 1fr)` }}>
        {/* Header row */}
        <div className="bg-surface-elevated border-b border-r border-border px-3 py-2">
          {dataRound !== undefined && dataRound !== null && (
            <span className="text-caption text-text-muted">R{dataRound} data</span>
          )}
        </div>
        {cars.map((car) => (
          <div
            key={car.teamSlug}
            className="bg-surface-elevated border-b border-r last:border-r-0 border-border px-3 py-2 border-t-4"
            style={{ borderTopColor: TEAM_COLORS[car.teamSlug as TeamSlug] }}
          >
            <p className="text-data-small font-semibold text-text-primary">
              {TEAM_NAMES[car.teamSlug as TeamSlug] ?? car.teamName}
            </p>
            <p className="text-caption text-text-muted">{car.designation}</p>
            {car.isStale && <StaleTag />}
          </div>
        ))}

        {/* Data rows */}
        {ROWS.map(({ label, key, render }) => (
          <>
            <div
              key={`label-${key}`}
              className="border-b last:border-b-0 border-r border-border px-3 py-2 bg-surface"
            >
              <span className="text-caption text-text-muted">{label}</span>
            </div>
            {cars.map((car) => (
              <div
                key={`${car.teamSlug}-${key}`}
                className="border-b last:border-b-0 border-r last:border-r-0 border-border px-3 py-2"
              >
                {render
                  ? render(car[key], car)
                  : <SpecValue value={car[key] as string | number | null} />}
              </div>
            ))}
          </>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-border flex items-center justify-between">
        <SourceLabel variant={hasAnyData ? "derived" : "predicted"} size="sm" />
        <ConfidenceBadge tier={hasAnyData ? "medium" : "low"} size="sm" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / Error skeletons
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      <div className="h-8 w-32 bg-surface-elevated rounded-badge animate-pulse mb-6" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-card bg-surface-elevated border border-border h-28 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      <div className="rounded-card bg-surface border border-confidence-low/30 p-5 flex items-start gap-3">
        <AlertCircle size={16} className="text-confidence-low shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-data-small text-text-primary font-medium mb-1">
            Failed to load car data
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
// Main component
// ---------------------------------------------------------------------------

interface Props {
  compareSlugs: string[];
  highlightSlugs: string[];
  liveData: boolean;
  asOfRound: string | null;
}

export function CarsOverviewClient({
  compareSlugs,
  highlightSlugs,
  liveData,
  asOfRound,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<CarsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchCars() {
    setLoading(true);
    setError(null);
    try {
      const qs = asOfRound ? `?asOfRound=${asOfRound}` : "";
      const res = await fetch(`/api/cars${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: CarsApiResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfRound]);

  const isOverLimit = compareSlugs.length > 2;
  const activeCompare = compareSlugs.slice(0, 2) as TeamSlug[];

  function toggleCompare(slug: TeamSlug) {
    const params = new URLSearchParams(searchParams.toString());
    const current = compareSlugs.filter((s) => s in TEAM_NAMES) as TeamSlug[];
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    if (next.length === 0) params.delete("compare");
    else params.set("compare", next.join(","));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={fetchCars} />;
  if (!data) return null;

  const allCars = data.cars;
  const allHaveNoData = allCars.every((c) => !c.hasData);

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-data-large font-bold text-text-primary">Cars</h1>
          <p className="text-data-small text-text-secondary mt-0.5">
            {liveData && data.roundIsLive ? (
              <span className="text-f1 font-medium">Live data active</span>
            ) : data.asOfRound !== null ? (
              <span>Data through Round {data.asOfRound}</span>
            ) : (
              "Select two cars to compare"
            )}
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
        <ComparePanel slugs={activeCompare} allCars={allCars} />
      )}

      {/* Car grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {allCars.map((car) => {
          const isComparing = compareSlugs.includes(car.teamSlug);
          const isHighlighted = highlightSlugs.includes(car.teamSlug);
          const color = TEAM_COLORS[car.teamSlug as TeamSlug];

          return (
            <div
              key={car.teamSlug}
              className={[
                "rounded-card border border-l-4 transition-all",
                isHighlighted
                  ? "border-text-secondary bg-surface-elevated"
                  : "border-border bg-surface-elevated",
                isComparing ? "ring-1 ring-f1/50" : "",
              ].join(" ")}
              style={{ borderLeftColor: color }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Link href={`/cars/${car.teamSlug}`} className="min-w-0 group">
                    <p className="text-data-medium font-semibold text-text-primary group-hover:text-f1 transition-colors">
                      {TEAM_NAMES[car.teamSlug as TeamSlug] ?? car.teamName}
                    </p>
                    <p className="text-caption text-text-muted">{car.designation}</p>
                  </Link>
                  <button
                    onClick={() => toggleCompare(car.teamSlug as TeamSlug)}
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

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                  <SourceLabel variant={car.hasData ? "derived" : "predicted"} size="sm" />
                  <ConfidenceBadge tier={car.hasData ? "medium" : "low"} size="sm" />
                  {car.isStale && <StaleTag />}
                  {car.amendmentReason !== null && <RevisedTag />}
                  {liveData && data.roundIsLive && car.hasData && (
                    <Zap size={11} className="text-f1 ml-auto" aria-hidden />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zero state */}
      {allHaveNoData && (
        <p className="text-center text-caption text-text-muted mt-6">
          Performance metrics will populate after Round 1 completes.
          Specifications shown are pre-season confirmed data only.
        </p>
      )}
    </div>
  );
}
