"use client";

// LapTimeDistribution — lap time spread per car within a session.
//
// Renders a horizontal bar chart showing each car's best lap time for the
// session, anchored to the session fastest lap (gap displayed as +Xms).
// Cars are sorted fastest to slowest.
//
// This is a gap-from-leader chart, not a raw-time chart, because raw
// millisecond values (e.g. 82091) are not human-readable at chart scale.
// The x-axis shows gap in milliseconds; tick labels are formatted as
// "+0.0s", "+0.5s" etc.
//
// Data shape expected by the parent:
//   CarLapEntry { carId, teamSlug, label, lapTimeMs, gapToLeaderMs }
//
// Source label: parent passes sourceVariant ("official" | "derived") which
// is rendered in the chart title area via SourceLabel.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TEAM_COLORS, CHART_GRID_COLOR, CHART_TEXT_COLOR } from "@/lib/ui/tokens";
import { SourceLabel } from "@/components/ui/source-label";
import type { TeamSlug, SourceVariant } from "@/lib/ui/tokens";

export interface CarLapEntry {
  carId: string;
  teamSlug: TeamSlug;
  label: string;
  lapTimeMs: number;
  gapToLeaderMs: number;
}

interface LapTimeDistributionProps {
  data: CarLapEntry[];
  sessionLabel: string;
  sourceVariant?: SourceVariant;
  className?: string;
}

function formatGap(ms: number): string {
  if (ms === 0) return "Leader";
  return `+${(ms / 1000).toFixed(3)}s`;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CarLapEntry }[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="rounded-card bg-surface-elevated border border-border px-3 py-2 text-caption">
      <p className="text-text-primary font-semibold mb-0.5">{entry.label}</p>
      <p className="text-text-secondary">
        Best lap: {(entry.lapTimeMs / 1000).toFixed(3)}s
      </p>
      <p className="text-text-secondary">{formatGap(entry.gapToLeaderMs)}</p>
    </div>
  );
}

export function LapTimeDistribution({
  data,
  sessionLabel,
  sourceVariant = "official",
  className = "",
}: LapTimeDistributionProps) {
  const sorted = [...data].sort((a, b) => a.gapToLeaderMs - b.gapToLeaderMs);

  return (
    <div className={`rounded-card bg-surface p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-data-small font-semibold text-text-primary">
          {sessionLabel} — Lap Time Distribution
        </h3>
        <SourceLabel variant={sourceVariant} size="sm" />
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 28)}>
        <BarChart
          layout="vertical"
          data={sorted}
          margin={{ top: 0, right: 16, bottom: 0, left: 72 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke={CHART_GRID_COLOR}
            strokeDasharray="3 3"
          />
          <XAxis
            type="number"
            tickFormatter={(v) => `+${(v / 1000).toFixed(1)}s`}
            tick={{ fill: CHART_TEXT_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={68}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="gapToLeaderMs" radius={[0, 2, 2, 0]} maxBarSize={18}>
            {sorted.map((entry) => (
              <Cell
                key={entry.carId}
                fill={TEAM_COLORS[entry.teamSlug]}
                opacity={0.9}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
