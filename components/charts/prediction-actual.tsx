"use client";

// PredictionActual — compares model-predicted fastest lap times to
// observed actual times after a session completes.
//
// Renders a grouped bar chart per car:
//   Predicted bar — predicted_value (ms) with margin_of_error error band
//   Actual bar    — actual observed fastest lap (ms), shown when available
//
// The margin-of-error band is rendered as a thin error line on the
// predicted bar (not a filled area) to avoid visual clutter on mobile.
//
// When actual data is not yet available (pre-race / pre-session):
//   Actual bar is omitted; a "PREDICTED ONLY" notice is shown.
//   preSeasonOnly=true adds an additional disclaimer banner.
//
// Y-axis: lap time in seconds (ms / 1000) to human-readable scale.
//   Formatted as "M:SS.s" for axis labels, full "M:SS.mmm" in tooltip.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ErrorBar,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Sparkles } from "lucide-react";
import { TEAM_COLORS, CHART_GRID_COLOR, CHART_TEXT_COLOR } from "@/lib/ui/tokens";
import { SourceLabel } from "@/components/ui/source-label";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import type { TeamSlug, ConfidenceTier } from "@/lib/ui/tokens";

export interface PredictionActualEntry {
  carId: string;
  teamSlug: TeamSlug;
  label: string;
  predictedMs: number;
  marginOfErrorMs: number;
  confidence: ConfidenceTier;
  actualMs?: number; // undefined = not yet available
}

interface PredictionActualProps {
  data: PredictionActualEntry[];
  preSeasonOnly?: boolean;
  className?: string;
}

function msToDisplayTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function msToAxisLabel(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `${minutes}:${seconds.padStart(4, "0")}`;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: PredictionActualEntry }[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;

  return (
    <div className="rounded-card bg-surface-elevated border border-border px-3 py-2 min-w-[160px]">
      <p className="text-label text-text-primary font-semibold mb-1">{entry.label}</p>
      <div className="space-y-0.5">
        <p className="text-caption text-text-secondary flex justify-between gap-4">
          <span className="flex items-center gap-1">
            <Sparkles size={9} aria-hidden />
            Predicted
          </span>
          <span className="font-mono">{msToDisplayTime(entry.predictedMs)}</span>
        </p>
        <p className="text-caption text-text-muted flex justify-between gap-4">
          <span>Margin</span>
          <span className="font-mono">±{(entry.marginOfErrorMs / 1000).toFixed(3)}s</span>
        </p>
        {entry.actualMs != null && (
          <p className="text-caption text-source-official flex justify-between gap-4">
            <span>Actual</span>
            <span className="font-mono">{msToDisplayTime(entry.actualMs)}</span>
          </p>
        )}
        <div className="pt-1 border-t border-border">
          <ConfidenceBadge tier={entry.confidence} size="sm" />
        </div>
      </div>
    </div>
  );
}

export function PredictionActual({
  data,
  preSeasonOnly = false,
  className = "",
}: PredictionActualProps) {
  const hasActual = data.some((e) => e.actualMs != null);

  // Y-axis domain: bracket the predicted range with a small margin.
  const allMs = data.flatMap((e) =>
    [e.predictedMs, e.actualMs].filter((v): v is number => v != null)
  );
  const minMs = Math.min(...allMs) - 1000;
  const maxMs = Math.max(...allMs) + 500;

  const chartData = data.map((e) => ({
    ...e,
    // Recharts ErrorBar requires [lowerBound, upperBound] relative deltas.
    predictedErrorBand: [e.marginOfErrorMs, e.marginOfErrorMs] as [number, number],
  }));

  return (
    <div className={`rounded-card bg-surface p-4 ${className}`}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <h3 className="text-data-small font-semibold text-text-primary">
            Fastest Lap — Prediction vs Actual
          </h3>
          {preSeasonOnly && (
            <p className="text-caption text-source-predicted mt-1 flex items-center gap-1">
              <Sparkles size={10} aria-hidden />
              Pre-season estimates only — no 2026 race data for this circuit yet
            </p>
          )}
        </div>
        <SourceLabel variant="predicted" size="sm" />
      </div>

      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 42)}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 0, left: 4 }}
          barCategoryGap="25%"
          barGap={3}
        >
          <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: CHART_TEXT_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minMs, maxMs]}
            tickFormatter={msToAxisLabel}
            tick={{ fill: CHART_TEXT_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          {hasActual && (
            <Legend
              iconType="square"
              iconSize={8}
              wrapperStyle={{ fontSize: "0.6875rem", paddingTop: "8px" }}
              formatter={(value) =>
                value === "predictedMs" ? "Predicted" : "Actual"
              }
            />
          )}

          {/* Predicted bars */}
          <Bar dataKey="predictedMs" name="predictedMs" radius={[2, 2, 0, 0]} maxBarSize={28}>
            {chartData.map((e) => (
              <Cell
                key={`pred-${e.carId}`}
                fill={TEAM_COLORS[e.teamSlug]}
                opacity={0.55}
              />
            ))}
            <ErrorBar
              dataKey="predictedErrorBand"
              width={4}
              strokeWidth={1.5}
              stroke="rgba(255,255,255,0.4)"
            />
          </Bar>

          {/* Actual bars — only rendered when data exists */}
          {hasActual && (
            <Bar dataKey="actualMs" name="actualMs" radius={[2, 2, 0, 0]} maxBarSize={28}>
              {chartData.map((e) => (
                <Cell
                  key={`act-${e.carId}`}
                  fill={TEAM_COLORS[e.teamSlug]}
                  opacity={0.9}
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>

      {!hasActual && !preSeasonOnly && (
        <p className="text-caption text-text-muted mt-2 text-center">
          Actual data will appear once the session completes.
        </p>
      )}
    </div>
  );
}
