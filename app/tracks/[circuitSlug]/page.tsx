// Circuit Detail — profile, car fit scores, DAB zones, fastest lap predictions.
//
// Zero state (pre-Round 1):
//   - Circuit profile: always visible (editorial data)
//   - Car fit scores: "No race data yet"
//   - DAB zones: show staging status; "Awaiting FIA event notes"
//   - Fastest lap predictions: pre-season editorial estimates if seeded,
//     otherwise empty

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";

// ---------------------------------------------------------------------------
// Placeholder data
// ---------------------------------------------------------------------------

const CIRCUIT_PROFILES: Record<string, {
  name: string; country: string; lapLengthKm: number; totalLapsRace: number;
  dragSensitivity: number; tractionDemand: number; brakingIntensity: number;
  overtakingPotential: number; aeroZoneValue: number;
  baselineFastestLapS: number;
  dabZonesConfirmed: boolean;
  dabZoneCount: number;
}> = {
  "albert-park": {
    name: "Albert Park", country: "Australia", lapLengthKm: 5.278, totalLapsRace: 58,
    dragSensitivity: 6.0, tractionDemand: 5.5, brakingIntensity: 7.0, overtakingPotential: 4.5, aeroZoneValue: 5.0,
    baselineFastestLapS: 82.091, dabZonesConfirmed: false, dabZoneCount: 0,
  },
  "suzuka": {
    name: "Suzuka", country: "Japan", lapLengthKm: 5.807, totalLapsRace: 53,
    dragSensitivity: 5.0, tractionDemand: 8.5, brakingIntensity: 7.5, overtakingPotential: 3.0, aeroZoneValue: 7.5,
    baselineFastestLapS: 90.983, dabZonesConfirmed: false, dabZoneCount: 0,
  },
  "monaco": {
    name: "Monaco", country: "Monaco", lapLengthKm: 3.337, totalLapsRace: 78,
    dragSensitivity: 2.0, tractionDemand: 9.5, brakingIntensity: 9.0, overtakingPotential: 1.0, aeroZoneValue: 3.0,
    baselineFastestLapS: 74.531, dabZonesConfirmed: false, dabZoneCount: 0,
  },
};

const PROFILE_DIMS = [
  { key: "dragSensitivity",    label: "Drag sensitivity",     description: "How much straight-line speed advantage low drag provides." },
  { key: "tractionDemand",     label: "Traction demand",      description: "Importance of rear traction out of slow corners." },
  { key: "brakingIntensity",   label: "Braking intensity",    description: "Frequency and severity of heavy braking zones." },
  { key: "overtakingPotential",label: "Overtaking potential", description: "Likelihood of on-track position changes." },
  { key: "aeroZoneValue",      label: "Aero zone value",      description: "Benefit of the active aero DAB system at this circuit. 2026 editorial estimate — uncalibrated." },
] as const;

export async function generateMetadata({ params }: { params: { circuitSlug: string } }): Promise<Metadata> {
  const profile = CIRCUIT_PROFILES[params.circuitSlug];
  if (!profile) return { title: "Circuit not found" };
  return { title: profile.name };
}

function ProfileDimRow({
  label,
  value,
  description,
  isNew2026 = false,
}: {
  label: string;
  value: number;
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
          {value.toFixed(1)}<span className="text-caption text-text-muted">/10</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full bg-text-secondary opacity-60"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <p className="text-caption text-text-muted">{description}</p>
    </div>
  );
}

export default function CircuitDetailPage({ params }: { params: { circuitSlug: string } }) {
  const profile = CIRCUIT_PROFILES[params.circuitSlug];
  if (!profile) notFound();

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
          {profile.country}
        </p>
        <h1 className="text-data-hero font-bold text-text-primary">{profile.name}</h1>
        <p className="text-data-small text-text-secondary mt-1">
          {profile.lapLengthKm}km · {profile.totalLapsRace} laps ·{" "}
          Baseline fastest lap: {Math.floor(profile.baselineFastestLapS / 60)}:{String(
            (profile.baselineFastestLapS % 60).toFixed(3).padStart(6, "0")
          )}
        </p>
      </div>

      {/* Circuit profile */}
      <section className="rounded-card bg-surface border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-data-small font-semibold text-text-primary">
            Circuit Profile
          </h2>
          <SourceLabel variant="derived" size="sm" />
        </div>
        {PROFILE_DIMS.map(({ key, label, description }) => (
          <ProfileDimRow
            key={key}
            label={label}
            value={profile[key]}
            description={description}
            isNew2026={key === "aeroZoneValue"}
          />
        ))}
      </section>

      {/* DAB zones */}
      <section className="rounded-card bg-surface border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-data-small font-semibold text-text-primary">
            DAB Zones
          </h2>
          <span className="text-caption text-text-muted">
            Active aero activation boundaries
          </span>
        </div>
        {profile.dabZonesConfirmed ? (
          <div className="flex items-center gap-2 text-confidence-high">
            <CheckCircle2 size={14} aria-hidden />
            <p className="text-data-small">
              {profile.dabZoneCount} zone{profile.dabZoneCount !== 1 ? "s" : ""} confirmed
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-source-predicted shrink-0 mt-0.5" aria-hidden />
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

      {/* Car fit scores — zero state */}
      <section className="rounded-card bg-surface border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-data-small font-semibold text-text-primary">
            Car Fit Scores
          </h2>
          <ConfidenceBadge tier="low" size="sm" />
        </div>
        <p className="text-caption text-text-muted text-center py-4">
          Car fit scores for each constructor will appear after Round 1
          performance data has been processed.
        </p>
        <p className="text-caption text-text-muted text-center">
          <Link href="/methodology" className="underline hover:text-text-secondary transition-colors">
            How track fit is calculated
          </Link>
        </p>
      </section>
    </div>
  );
}
