"use client";

// ConfidenceBadge — displays the data confidence tier for a prediction.
//
// Three tiers:
//   high   — 3+ rounds of 2026 data for this car+circuit
//   medium — 1–2 rounds, or circuit-similarity inference
//   low    — pre-season only / no 2026 race data
//
// Differentiation beyond color:
//   high   → filled circle icon   (●) — "complete"
//   medium → half-filled triangle (△) — "partial"
//   low    → empty circle         (○) + exclamation — "warning"
//
// Each tier uses a distinct icon SHAPE, not just color. This ensures
// the confidence state is unambiguous in greyscale print and for users
// with colour vision deficiency.
//
// Also renders the MARGIN_OF_ERROR_LABELS on the "lg" size variant so
// the uncertainty band is visible without a tooltip on desktop.
//
// Size variants:
//   sm  — icon only, no text — used in dense table rows
//   md  — icon + tier name (default)
//   lg  — icon + tier name + margin of error

import { CircleDot, Triangle, CircleAlert } from "lucide-react";
import type { ConfidenceTier } from "@/lib/ui/tokens";
import { MARGIN_OF_ERROR_LABELS } from "@/lib/ui/tokens";

interface ConfidenceBadgeProps {
  tier: ConfidenceTier;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const CONFIG: Record<
  ConfidenceTier,
  {
    label: string;
    icon: React.ElementType;
    colorClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  high: {
    label: "High",
    icon: CircleDot,
    colorClass:  "text-confidence-high",
    bgClass:     "bg-confidence-high/10",
    borderClass: "border border-confidence-high/30",
  },
  medium: {
    label: "Medium",
    icon: Triangle,
    colorClass:  "text-confidence-medium",
    bgClass:     "bg-confidence-medium/10",
    borderClass: "border border-confidence-medium/30",
  },
  low: {
    label: "Low",
    icon: CircleAlert,
    colorClass:  "text-confidence-low",
    bgClass:     "bg-confidence-low/10",
    borderClass: "border border-confidence-low/30",
  },
};

const SIZE: Record<
  "sm" | "md" | "lg",
  { text: string; icon: number; px: string; py: string; gap: string; showLabel: boolean; showMoe: boolean }
> = {
  sm: { text: "text-caption", icon: 12, px: "px-1",   py: "py-0.5", gap: "gap-0.5", showLabel: false, showMoe: false },
  md: { text: "text-label",   icon: 11, px: "px-2",   py: "py-1",   gap: "gap-1",   showLabel: true,  showMoe: false },
  lg: { text: "text-label",   icon: 12, px: "px-2.5", py: "py-1",   gap: "gap-1.5", showLabel: true,  showMoe: true  },
};

export function ConfidenceBadge({
  tier,
  size = "md",
  className = "",
}: ConfidenceBadgeProps) {
  const cfg = CONFIG[tier];
  const sz = SIZE[size];
  const Icon = cfg.icon;

  return (
    <span
      className={[
        "inline-flex items-center rounded-badge uppercase tracking-widest font-medium select-none",
        sz.text,
        sz.px,
        sz.py,
        sz.gap,
        cfg.colorClass,
        cfg.bgClass,
        cfg.borderClass,
        className,
      ].join(" ")}
      aria-label={`Confidence: ${cfg.label}${sz.showMoe ? `, ${MARGIN_OF_ERROR_LABELS[tier]}` : ""}`}
    >
      <Icon size={sz.icon} strokeWidth={2} aria-hidden />
      {sz.showLabel && cfg.label}
      {sz.showMoe && (
        <span className="text-muted ml-0.5 normal-case tracking-normal opacity-70">
          {MARGIN_OF_ERROR_LABELS[tier]}
        </span>
      )}
    </span>
  );
}
