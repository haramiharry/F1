"use client";

// PaceEvolution — pace trend over the season for one or more cars.
//
// Plots one_lap_pace (normalised 0–10 scale) against round_number.
// Multiple cars can be overlaid; each gets its team color line.
//
// Because one_lap_pace is a normalised score (not a raw lap time), the
// y-axis is labeled "Pace score (0–10)" and is described as "higher = faster
// relative to field" in the chart subtitle. This is the UI counterpart to the
// z-score normalised OLS slope computed in lib/analytics/pace-trend.ts.
//
// Optionally renders the OLS trend line for each car when trendSlope is
// provided. The trend line is dashed to distinguish it from observed data.
//
// Data shape:
//   CarPaceSeriesPoint { roundNumber, pace }
//   CarPaceSeries { carId, teamSlug, label, points, trendSlope? }

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  TEAM_COLORS,
  CHART_GRID_COLOR,
  CHART_TEXT_COLOR,
} from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";

export interface CarPaceSeriesPoint {
  roundNumber: number;
  pace: number;
}

export interface CarPaceSeries {
  carId: string;
  teamSlug: TeamSlug;
  label: string;
  points: CarPaceSeriesPoint[];
  trendSlope?: number; // OLS slope from pace-trend.ts; null = no trend line
}

interface PaceEvolutionProps {
  series: CarPaceSeries[];
  highlightRound?: number;
  className?: string;
}

// Flatten series into a round-keyed dataset Recharts can consume.
function buildChartData(series: CarPaceSeries[]) {
  const allRounds = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.roundNumber)))
  ).sort((a, b) => a - b);

  return allRounds.map((round) => {
    const entry: Record<string, number> = { round };
    for (const s of series) {
      const pt = s.points.find((p) => p.roundNumber === round);
      if (pt) entry[s.carId] = pt.pace;
    }
    return entry;
  });
}

export function PaceEvolution({
  series,
  highlightRound,
  className = "",
}: PaceEvolutionProps) {
  const data = buildChartData(series);

  return (
    <div className={`rounded-card bg-surface p-4 ${className}`}>
      <div className="mb-1">
        <h3 className="text-data-small font-semibold text-text-primary">
          Pace Evolution
        </h3>
        <p className="text-caption text-text-muted mt-0.5">
          Normalised one-lap pace (0–10, higher = faster relative to field)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
          <XAxis
            dataKey="round"
            tick={{ fill: CHART_TEXT_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Round",
              position: "insideBottomRight",
              offset: -4,
              fill: CHART_TEXT_COLOR,
              fontSize: 10,
            }}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fill: CHART_TEXT_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-elevated)",
              borderColor: "var(--color-border)",
              borderRadius: "0.5rem",
              fontSize: "0.6875rem",
            }}
            labelStyle={{ color: "var(--color-text-primary)", fontWeight: 600 }}
            labelFormatter={(v) => `Round ${v}`}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "0.6875rem", paddingTop: "8px" }}
          />
          {highlightRound != null && (
            <ReferenceLine
              x={highlightRound}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="4 2"
            />
          )}
          {series.map((s) => (
            <Line
              key={s.carId}
              type="monotone"
              dataKey={s.carId}
              name={s.label}
              stroke={TEAM_COLORS[s.teamSlug]}
              strokeWidth={2}
              dot={{ r: 3, fill: TEAM_COLORS[s.teamSlug] }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* OLS trend slopes — shown as text annotation below chart */}
      {series.some((s) => s.trendSlope != null) && (
        <div className="mt-2 flex flex-wrap gap-3">
          {series
            .filter((s) => s.trendSlope != null)
            .map((s) => (
              <span key={s.carId} className="text-caption text-text-secondary flex items-center gap-1">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: TEAM_COLORS[s.teamSlug] }}
                />
                {s.label}:{" "}
                <span
                  className={
                    s.trendSlope! >= 0 ? "text-confidence-high" : "text-confidence-low"
                  }
                >
                  {s.trendSlope! >= 0 ? "+" : ""}
                  {s.trendSlope!.toFixed(4)} z/round
                </span>
              </span>
            ))}
          <span className="text-caption text-text-muted self-center">
            OLS slope — season-wide, z-normalised
          </span>
        </div>
      )}
    </div>
  );
}
