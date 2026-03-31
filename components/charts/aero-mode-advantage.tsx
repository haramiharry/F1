"use client";

// AeroModeAdvantage — X-Mode vs Z-Mode effectiveness overlay per car.
//
// Shows two horizontal bars per car:
//   X-Mode (activation) — effectiveness score 0–10
//   Z-Mode (deactivation) — effectiveness score 0–10
//
// The net advantage label (X+ or Z+) is rendered at bar end.
//
// A "DAB zones unconfirmed" warning banner is shown when
// dabZonesConfirmed=false, because unconfirmed zones produce unreliable
// Z-mode scores (dab_zone_count defaults to 0, inflating z_mode).
// This mirrors the engine.ts guard: predictions are skipped when
// dab_zones_confirmed=false.
//
// Source label: always "derived" (computed from CCP + DAB zone data).

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { TEAM_COLORS, CHART_GRID_COLOR, CHART_TEXT_COLOR } from "@/lib/ui/tokens";
import { SourceLabel } from "@/components/ui/source-label";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import type { TeamSlug, ConfidenceTier } from "@/lib/ui/tokens";

export interface AeroEntry {
  carId: string;
  teamSlug: TeamSlug;
  label: string;
  xMode: number;
  zMode: number;
  confidence: ConfidenceTier;
}

interface AeroModeAdvantageProps {
  data: AeroEntry[];
  dabZonesConfirmed: boolean;
  className?: string;
}

export function AeroModeAdvantage({
  data,
  dabZonesConfirmed,
  className = "",
}: AeroModeAdvantageProps) {
  const chartData = data.map((e) => ({
    ...e,
    advantage: Math.round((e.xMode - e.zMode) * 100) / 100,
  }));

  return (
    <div className={`rounded-card bg-surface p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-data-small font-semibold text-text-primary">
            Active Aero — X vs Z Mode
          </h3>
          <p className="text-caption text-text-muted mt-0.5">
            Effectiveness score per car (0–10, higher = more benefit from that mode)
          </p>
        </div>
        <SourceLabel variant="derived" size="sm" />
      </div>

      {/* DAB zones unconfirmed warning */}
      {!dabZonesConfirmed && (
        <div className="flex items-start gap-2 rounded-badge bg-source-predicted/10 border border-source-predicted/30 border-dashed px-3 py-2 mb-3">
          <AlertTriangle
            size={13}
            className="text-source-predicted shrink-0 mt-0.5"
            aria-hidden
          />
          <p className="text-caption text-source-predicted">
            DAB zone boundaries not yet confirmed for this round. Aero mode
            scores are withheld until admin promotion is complete.
          </p>
        </div>
      )}

      {dabZonesConfirmed && (
        <>
          <ResponsiveContainer width="100%" height={Math.max(160, data.length * 48)}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 0, right: 48, bottom: 0, left: 72 }}
              barCategoryGap="30%"
              barGap={2}
            >
              <CartesianGrid
                horizontal={false}
                stroke={CHART_GRID_COLOR}
                strokeDasharray="3 3"
              />
              <XAxis
                type="number"
                domain={[0, 10]}
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
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface-elevated)",
                  borderColor: "var(--color-border)",
                  borderRadius: "0.5rem",
                  fontSize: "0.6875rem",
                }}
                formatter={(value, name) => [
                  typeof value === "number" ? value.toFixed(2) : String(value ?? ""),
                  name === "xMode" ? "X-Mode" : "Z-Mode",
                ]}
              />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: "0.6875rem", paddingTop: "8px" }}
                formatter={(value) => (value === "xMode" ? "X-Mode (active)" : "Z-Mode (inactive)")}
              />
              <Bar dataKey="xMode" name="xMode" radius={[0, 2, 2, 0]} maxBarSize={14}>
                {chartData.map((e) => (
                  <Cell
                    key={`x-${e.carId}`}
                    fill={TEAM_COLORS[e.teamSlug]}
                    opacity={0.9}
                  />
                ))}
              </Bar>
              <Bar dataKey="zMode" name="zMode" radius={[0, 2, 2, 0]} maxBarSize={14}>
                {chartData.map((e) => (
                  <Cell
                    key={`z-${e.carId}`}
                    fill={TEAM_COLORS[e.teamSlug]}
                    opacity={0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Net advantage summary */}
          <div className="mt-3 flex flex-wrap gap-2">
            {chartData.map((e) => (
              <div
                key={e.carId}
                className="flex items-center gap-1.5 rounded-badge bg-surface-elevated border border-border px-2 py-1"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: TEAM_COLORS[e.teamSlug] }}
                />
                <span className="text-caption text-text-secondary">{e.label}</span>
                <span
                  className={`text-caption font-semibold ${
                    e.advantage >= 0 ? "text-confidence-high" : "text-source-derived"
                  }`}
                >
                  {e.advantage >= 0
                    ? `X +${e.advantage.toFixed(2)}`
                    : `Z +${Math.abs(e.advantage).toFixed(2)}`}
                </span>
                <ConfidenceBadge tier={e.confidence} size="sm" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
