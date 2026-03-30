// Track Intelligence Center — circuit list with profile dimensions.
//
// Zero state (pre-Round 1): all circuits show profile data (if seeded)
// but no car fit scores, no 2026 fastest-lap data. Profile dims are
// editorial values from circuit characterisation; labelled as Derived.
//
// Circuit comparison is standalone: no car anchor required. Selecting two
// circuits shows a side-by-side profile comparison (profile dims only).
// Unlike car comparison, there is no limit on circuit comparison.

import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";
import { TEAM_COLORS } from "@/lib/ui/tokens";

export const metadata: Metadata = { title: "Tracks" };

// ---------------------------------------------------------------------------
// Placeholder circuit data
// ---------------------------------------------------------------------------

interface CircuitRow {
  slug: string;
  name: string;
  shortName: string;
  country: string;
  lapLengthKm: number;
  totalLapsRace: number;
  dragSensitivity: number;
  tractionDemand: number;
  brakingIntensity: number;
  overtakingPotential: number;
  aeroZoneValue: number;
  roundNumber: number | null; // null = not yet scheduled in 2026
}

const CIRCUITS: CircuitRow[] = [
  { slug: "albert-park",    name: "Australian Grand Prix",    shortName: "Albert Park",    country: "Australia",     lapLengthKm: 5.278, totalLapsRace: 58, dragSensitivity: 6.0, tractionDemand: 5.5, brakingIntensity: 7.0, overtakingPotential: 4.5, aeroZoneValue: 5.0, roundNumber: 1  },
  { slug: "shanghai",       name: "Chinese Grand Prix",       shortName: "Shanghai",       country: "China",         lapLengthKm: 5.451, totalLapsRace: 56, dragSensitivity: 5.5, tractionDemand: 6.0, brakingIntensity: 6.5, overtakingPotential: 5.5, aeroZoneValue: 5.5, roundNumber: 2  },
  { slug: "suzuka",         name: "Japanese Grand Prix",      shortName: "Suzuka",         country: "Japan",         lapLengthKm: 5.807, totalLapsRace: 53, dragSensitivity: 5.0, tractionDemand: 8.5, brakingIntensity: 7.5, overtakingPotential: 3.0, aeroZoneValue: 7.5, roundNumber: 3  },
  { slug: "bahrain",        name: "Bahrain Grand Prix",       shortName: "Bahrain Int'l",  country: "Bahrain",       lapLengthKm: 5.412, totalLapsRace: 57, dragSensitivity: 6.5, tractionDemand: 7.0, brakingIntensity: 8.5, overtakingPotential: 7.0, aeroZoneValue: 6.0, roundNumber: 4  },
  { slug: "jeddah",         name: "Saudi Arabian Grand Prix", shortName: "Jeddah Corniche",country: "Saudi Arabia",  lapLengthKm: 6.174, totalLapsRace: 50, dragSensitivity: 9.0, tractionDemand: 4.5, brakingIntensity: 6.0, overtakingPotential: 5.0, aeroZoneValue: 8.5, roundNumber: 5  },
  { slug: "miami",          name: "Miami Grand Prix",         shortName: "Miami",          country: "USA",           lapLengthKm: 5.412, totalLapsRace: 57, dragSensitivity: 6.5, tractionDemand: 6.5, brakingIntensity: 7.0, overtakingPotential: 6.5, aeroZoneValue: 6.5, roundNumber: 6  },
  { slug: "imola",          name: "Emilia Romagna Grand Prix",shortName: "Imola",          country: "Italy",         lapLengthKm: 4.909, totalLapsRace: 63, dragSensitivity: 5.5, tractionDemand: 7.5, brakingIntensity: 7.5, overtakingPotential: 3.5, aeroZoneValue: 5.5, roundNumber: 7  },
  { slug: "monaco",         name: "Monaco Grand Prix",        shortName: "Monaco",         country: "Monaco",        lapLengthKm: 3.337, totalLapsRace: 78, dragSensitivity: 2.0, tractionDemand: 9.5, brakingIntensity: 9.0, overtakingPotential: 1.0, aeroZoneValue: 3.0, roundNumber: 8  },
  { slug: "barcelona",      name: "Spanish Grand Prix",       shortName: "Barcelona",      country: "Spain",         lapLengthKm: 4.657, totalLapsRace: 66, dragSensitivity: 5.5, tractionDemand: 7.5, brakingIntensity: 7.0, overtakingPotential: 4.0, aeroZoneValue: 6.0, roundNumber: 9  },
  { slug: "montreal",       name: "Canadian Grand Prix",      shortName: "Montréal",       country: "Canada",        lapLengthKm: 4.361, totalLapsRace: 70, dragSensitivity: 7.5, tractionDemand: 6.0, brakingIntensity: 9.0, overtakingPotential: 7.5, aeroZoneValue: 7.0, roundNumber: 10 },
];

// Profile bar — 0–10 scale, color is neutral (circuit-level, not car-level)
function ProfileBar({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-caption text-text-muted">{label}</span>
        <span className="text-caption text-text-secondary font-mono">{value.toFixed(1)}</span>
      </div>
      <div className="h-1 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full bg-text-muted opacity-50"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function TracksPage() {
  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-data-large font-bold text-text-primary">Track Intelligence</h1>
        <p className="text-data-small text-text-secondary mt-0.5">
          Circuit profiles and car fit scores — 2026 calendar
        </p>
      </div>

      {/* Pre-season notice */}
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
      <div className="space-y-3">
        {CIRCUITS.map((circuit) => (
          <Link
            key={circuit.slug}
            href={`/tracks/${circuit.slug}`}
            className="block rounded-card bg-surface-elevated border border-border p-4 hover:border-text-secondary transition-colors group"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {circuit.roundNumber && (
                    <span className="text-caption text-text-muted font-mono">
                      R{circuit.roundNumber}
                    </span>
                  )}
                  <h2 className="text-data-small font-semibold text-text-primary group-hover:text-f1 transition-colors truncate">
                    {circuit.shortName}
                  </h2>
                </div>
                <p className="text-caption text-text-muted">
                  {circuit.country} · {circuit.lapLengthKm}km · {circuit.totalLapsRace} laps
                </p>
              </div>
              <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary transition-colors shrink-0 mt-1" aria-hidden />
            </div>

            {/* Profile mini-bars — 5 dims in 2-col grid on mobile, 5-col on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1.5">
              <ProfileBar value={circuit.dragSensitivity}    label="Drag" />
              <ProfileBar value={circuit.tractionDemand}     label="Traction" />
              <ProfileBar value={circuit.brakingIntensity}   label="Braking" />
              <ProfileBar value={circuit.overtakingPotential}label="Overtaking" />
              <ProfileBar value={circuit.aeroZoneValue}      label="Aero zone" />
            </div>
          </Link>
        ))}
      </div>

      <p className="text-caption text-text-muted text-center mt-6">
        {CIRCUITS.length} circuits shown · Full 24-round calendar
      </p>
    </div>
  );
}
