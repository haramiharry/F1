// Track Intelligence Center — circuit list with profile dimensions.
//
// Data: server-side Prisma queries via /api/circuits.
// Direct DB query here (server component) avoids an internal HTTP round-trip.
//
// Circuits with no CircuitProfile record show null bars (profile not seeded).
// dabZonesConfirmed reflects Round.dab_zones_confirmed for the 2026 round.
// Stale profiles show a StaleTag under the profile bars.

import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ChevronRight, AlertCircle } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";
import { prisma } from "@/lib/db/client";

export const metadata: Metadata = { title: "Tracks" };

const SEASON = 2026;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProfileBar({ value, label }: { value: number | null; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-caption text-text-muted">{label}</span>
        <span className="text-caption text-text-secondary font-mono">
          {value !== null ? value.toFixed(1) : "—"}
        </span>
      </div>
      <div className="h-1 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full bg-text-muted opacity-50"
          style={{ width: value !== null ? `${(value / 10) * 100}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function StaleTag() {
  return (
    <span className="inline-flex items-center gap-0.5 text-caption text-confidence-low">
      <AlertCircle size={9} aria-hidden />
      Profile stale
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TracksPage() {
  const circuits = await prisma.circuit.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      short_name: true,
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
          provenance: { select: { is_stale: true } },
        },
      },
      rounds: {
        where: { season: SEASON },
        select: { round_number: true, name: true, dab_zones_confirmed: true, status: true },
        orderBy: { round_number: "asc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-data-large font-bold text-text-primary">Track Intelligence</h1>
        <p className="text-data-small text-text-secondary mt-0.5">
          Circuit profiles and car fit scores — {SEASON} calendar
        </p>
      </div>

      {/* Info notice */}
      <div className="rounded-card bg-surface-elevated border border-border px-4 py-3 mb-6 flex items-start gap-2">
        <MapPin size={13} className="text-text-muted shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-caption text-text-secondary">
            Circuit profiles are pre-season editorial values. Car fit scores will
            populate after each round completes. Profile dimensions rated 0–10.
          </p>
          <div className="mt-1.5">
            <SourceLabel variant="derived" size="sm" />
          </div>
        </div>
      </div>

      {/* Circuit list */}
      {circuits.length === 0 ? (
        <p className="text-center text-caption text-text-muted py-8">
          No circuits found for the {SEASON} season.
        </p>
      ) : (
        <div className="space-y-3">
          {circuits.map((circuit) => {
            const round = circuit.rounds[0] ?? null;
            const isStale = circuit.profile?.provenance?.is_stale ?? false;

            return (
              <Link
                key={circuit.slug}
                href={`/tracks/${circuit.slug}`}
                className="block rounded-card bg-surface-elevated border border-border p-4 hover:border-text-secondary transition-colors group"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {round && (
                        <span className="text-caption text-text-muted font-mono">
                          R{round.round_number}
                        </span>
                      )}
                      {round?.status === "in_progress" && (
                        <span className="text-caption text-f1 border border-f1/30 rounded-badge px-1.5 py-0.5">
                          Live
                        </span>
                      )}
                      <h2 className="text-data-small font-semibold text-text-primary group-hover:text-f1 transition-colors truncate">
                        {circuit.short_name}
                      </h2>
                    </div>
                    <p className="text-caption text-text-muted">
                      {circuit.country} · {circuit.lap_length_km}km · {circuit.total_laps_race} laps
                    </p>
                    {isStale && <StaleTag />}
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-text-muted group-hover:text-text-primary transition-colors shrink-0 mt-1"
                    aria-hidden
                  />
                </div>

                {/* Profile mini-bars — 5 dims */}
                {circuit.profile ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1.5">
                    <ProfileBar value={circuit.profile.drag_sensitivity}     label="Drag" />
                    <ProfileBar value={circuit.profile.traction_demand}      label="Traction" />
                    <ProfileBar value={circuit.profile.braking_intensity}    label="Braking" />
                    <ProfileBar value={circuit.profile.overtaking_potential} label="Overtaking" />
                    <ProfileBar value={circuit.profile.aero_zone_value}      label="Aero zone" />
                  </div>
                ) : (
                  <p className="text-caption text-text-muted italic">
                    Circuit profile not yet seeded
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-caption text-text-muted text-center mt-6">
        {circuits.length} circuit{circuits.length !== 1 ? "s" : ""} · Full {SEASON} calendar
      </p>
    </div>
  );
}
