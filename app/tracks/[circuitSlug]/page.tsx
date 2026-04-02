// Circuit Detail — profile, car fit scores, DAB zones, fastest lap predictions.
//
// All data from DB (server component Prisma queries). No hardcoded profiles.
export const dynamic = "force-dynamic";
//
// Sections:
//   Circuit Profile  — 5 profile dimensions with 0–10 bars; aero_zone_value tagged "New 2026"
//   DAB Zones        — confirmed count or "Awaiting FIA Event Notes" when unconfirmed
//   Car Fit Scores   — from Prediction records (prediction_type=track_fit); zero state pre-Round 1
//
// Stale indicator: profile.provenance.is_stale or carFitScore.provenance.is_stale

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, AlertTriangle, CheckCircle2, MapPin, AlertCircle } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";
import { prisma } from "@/lib/db/client";

const SEASON = 2026;

export async function generateMetadata({
  params,
}: {
  params: { circuitSlug: string };
}): Promise<Metadata> {
  const circuit = await prisma.circuit.findFirst({
    where: { slug: params.circuitSlug },
    select: { name: true },
  });
  if (!circuit) return { title: "Circuit not found" };
  return { title: circuit.name };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProfileDimRow({
  label,
  value,
  description,
  isNew2026 = false,
}: {
  label: string;
  value: number | null;
  description: string;
  isNew2026?: boolean;
}) {
  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-data-small font-medium text-text-primary">{label}</span>
          {isNew2026 && (
            <span className="text-caption text-source-predicted border border-source-predicted/30 border-dashed rounded-badge px-1.5 py-0.5 uppercase">
              New 2026
            </span>
          )}
        </div>
        <span className="text-data-small font-mono text-text-primary tabular-nums shrink-0">
          {value !== null ? (
            <>
              {value.toFixed(1)}
              <span className="text-caption text-text-muted">/10</span>
            </>
          ) : (
            <span className="text-caption text-text-muted">—</span>
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full bg-text-secondary opacity-60"
          style={{ width: value !== null ? `${(value / 10) * 100}%` : "0%" }}
        />
      </div>
      <p className="text-caption text-text-muted">{description}</p>
    </div>
  );
}

function StaleTag() {
  return (
    <span className="inline-flex items-center gap-0.5 text-caption text-confidence-low">
      <AlertCircle size={9} aria-hidden />
      Stale
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CircuitDetailPage({
  params,
}: {
  params: { circuitSlug: string };
}) {
  const circuit = await prisma.circuit.findFirst({
    where: { slug: params.circuitSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      country: true,
      lap_length_km: true,
      total_laps_race: true,
      profile: {
        select: {
          drag_sensitivity: true,
          traction_demand: true,
          braking_intensity: true,
          overtaking_potential: true,
          aero_zone_value: true,
          baseline_fastest_lap_s: true,
          provenance: { select: { is_stale: true } },
        },
      },
      rounds: {
        where: { season: SEASON },
        select: { id: true, round_number: true, name: true, dab_zones_confirmed: true, status: true },
        orderBy: { round_number: "asc" },
        take: 1,
      },
      dab_zones: {
        where: { superseded_at: null },
        select: {
          id: true,
          zone_number: true,
          start_reference: true,
          end_reference: true,
          activation_direction: true,
          status: true,
        },
        orderBy: { zone_number: "asc" },
      },
    },
  });

  if (!circuit) notFound();

  const upcomingRound = circuit.rounds[0] ?? null;
  const dabZonesConfirmed = upcomingRound?.dab_zones_confirmed ?? false;
  const profileIsStale = circuit.profile?.provenance?.is_stale ?? false;

  // Car fit scores from Prediction (track_fit, non-superseded).
  const fitPredictions = await prisma.prediction.findMany({
    where: {
      circuit_id: circuit.id,
      prediction_type: "track_fit",
      superseded_at: null,
    },
    select: {
      id: true,
      car_id: true,
      predicted_value: true,
      confidence: true,
      round_valid_from: true,
      car: {
        select: {
          designation: true,
          team: { select: { slug: true, name: true } },
        },
      },
      provenance: { select: { is_stale: true } },
    },
    orderBy: { predicted_value: "desc" },
  });

  const baselineS = circuit.profile?.baseline_fastest_lap_s ?? null;
  const baselineDisplay = baselineS !== null
    ? `${Math.floor(baselineS / 60)}:${String(Math.floor(baselineS % 60)).padStart(2, "0")}.${String(Math.round((baselineS % 1) * 1000)).padStart(3, "0")}`
    : null;

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      {/* Back */}
      <Link
        href="/tracks"
        className="inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-text-secondary transition-colors mb-4"
      >
        <ChevronLeft size={12} aria-hidden />
        All Tracks
      </Link>

      {/* Circuit header */}
      <div className="rounded-card bg-surface border border-border p-5 mb-6">
        <p className="text-caption text-text-muted uppercase tracking-wider mb-0.5">
          <MapPin size={11} className="inline mr-1" aria-hidden />
          {circuit.country}
          {upcomingRound && (
            <span className="ml-2 font-mono">R{upcomingRound.round_number}</span>
          )}
          {upcomingRound?.status === "in_progress" && (
            <span className="ml-2 text-f1 border border-f1/30 rounded-badge px-1.5 py-0.5">
              Live
            </span>
          )}
        </p>
        <h1 className="text-data-hero font-bold text-text-primary">{circuit.name}</h1>
        <p className="text-data-small text-text-secondary mt-1">
          {circuit.lap_length_km}km · {circuit.total_laps_race} laps
          {baselineDisplay && ` · Baseline fastest lap: ${baselineDisplay}`}
        </p>
      </div>

      {/* Circuit profile */}
      <section className="rounded-card bg-surface border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-data-small font-semibold text-text-primary">
            Circuit Profile
          </h2>
          <div className="flex items-center gap-2">
            {profileIsStale && <StaleTag />}
            <SourceLabel variant="derived" size="sm" />
          </div>
        </div>
        {circuit.profile ? (
          <>
            <ProfileDimRow
              label="Drag sensitivity"
              value={circuit.profile.drag_sensitivity}
              description="How much straight-line speed advantage low drag provides."
            />
            <ProfileDimRow
              label="Traction demand"
              value={circuit.profile.traction_demand}
              description="Importance of rear traction out of slow corners."
            />
            <ProfileDimRow
              label="Braking intensity"
              value={circuit.profile.braking_intensity}
              description="Frequency and severity of heavy braking zones."
            />
            <ProfileDimRow
              label="Overtaking potential"
              value={circuit.profile.overtaking_potential}
              description="Likelihood of on-track position changes."
            />
            <ProfileDimRow
              label="Aero zone value"
              value={circuit.profile.aero_zone_value}
              description="Benefit of the active aero DAB system at this circuit. 2026 editorial estimate — uncalibrated."
              isNew2026
            />
          </>
        ) : (
          <p className="text-caption text-text-muted italic py-4 text-center">
            Circuit profile not yet seeded.
          </p>
        )}
      </section>

      {/* DAB Zones */}
      <section className="rounded-card bg-surface border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-data-small font-semibold text-text-primary">DAB Zones</h2>
          <span className="text-caption text-text-muted">Active aero activation boundaries</span>
        </div>
        {dabZonesConfirmed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-confidence-high">
              <CheckCircle2 size={14} aria-hidden />
              <p className="text-data-small">
                {circuit.dab_zones.length} zone{circuit.dab_zones.length !== 1 ? "s" : ""} confirmed
              </p>
            </div>
            {(circuit.dab_zones as Array<{
              id: string;
              zone_number: number;
              start_reference: string;
              end_reference: string;
              activation_direction: string;
              status: string;
            }>).map((zone) => (
              <div
                key={zone.id}
                className="flex items-center justify-between px-3 py-2 rounded-badge bg-surface-elevated border border-border text-caption"
              >
                <span className="text-text-primary font-medium">Zone {zone.zone_number}</span>
                <span className="text-text-muted">
                  {zone.start_reference} → {zone.end_reference}
                </span>
                <Link
                  href={`?amendmentHistory=circuit_dab_zones:${zone.id}`}
                  className="text-text-muted hover:text-text-secondary transition-colors"
                  aria-label={`Zone ${zone.zone_number} amendment history`}
                >
                  <span className="text-caption">History</span>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={14}
              className="text-source-predicted shrink-0 mt-0.5"
              aria-hidden
            />
            <div>
              <p className="text-data-small text-source-predicted font-medium">
                Awaiting FIA Event Notes
              </p>
              <p className="text-caption text-text-muted mt-0.5">
                DAB zone boundaries are published in the FIA Event Notes
                approximately 48–72 hours before the first session. Aero
                effectiveness predictions are withheld until admin promotes
                the confirmed zone data.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Car Fit Scores */}
      <section className="rounded-card bg-surface border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-data-small font-semibold text-text-primary">Car Fit Scores</h2>
          <ConfidenceBadge tier="low" size="sm" />
        </div>

        {fitPredictions.length === 0 ? (
          <>
            <p className="text-caption text-text-muted text-center py-4">
              Car fit scores for each constructor will appear after Round 1
              performance data has been processed.
            </p>
            <p className="text-caption text-text-muted text-center">
              <Link
                href="/methodology"
                className="underline hover:text-text-secondary transition-colors"
              >
                How track fit is calculated
              </Link>
            </p>
          </>
        ) : (
          <div className="space-y-px">
            {(fitPredictions as Array<{
              id: string;
              car_id: string | null;
              predicted_value: number | null;
              confidence: string;
              round_valid_from: number;
              car: { designation: string; team: { slug: string; name: string } } | null;
              provenance: { is_stale: boolean } | null;
            }>).map((pred) => {
              const teamSlug = pred.car?.team.slug as TeamSlug | undefined;
              const color = teamSlug ? TEAM_COLORS[teamSlug] : "#666666";
              const teamName = teamSlug
                ? (TEAM_NAMES[teamSlug] ?? pred.car?.team.name ?? "")
                : (pred.car?.team.name ?? "");

              return (
                <div
                  key={pred.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-data-small text-text-primary block truncate">
                      {teamName}
                    </span>
                    <span className="text-caption text-text-muted">
                      {pred.car?.designation ?? ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-32">
                    <div className="flex-1 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: pred.predicted_value !== null
                            ? `${(pred.predicted_value / 10) * 100}%`
                            : "0%",
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="text-caption font-mono text-text-secondary w-6 text-right tabular-nums">
                      {pred.predicted_value?.toFixed(1) ?? "—"}
                    </span>
                  </div>
                  {pred.provenance?.is_stale && <StaleTag />}
                  <ConfidenceBadge
                    tier={pred.confidence as "low" | "medium" | "high"}
                    size="sm"
                  />
                  <Link
                    href={`?amendmentHistory=predictions:${pred.id}`}
                    className="text-text-muted hover:text-text-secondary transition-colors"
                    aria-label="View amendment history"
                  >
                    <span className="text-caption">History</span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
