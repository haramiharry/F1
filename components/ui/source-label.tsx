"use client";

// SourceLabel — displays the data provenance state of a metric.
//
// Three variants:
//   official   — FIA or Formula1.com sourced data
//   derived    — computed from official session data
//   predicted  — model or editorial estimate
//
// Differentiation beyond color:
//   official   → solid border + shield-check icon + uppercase text
//   derived    → solid border + function (σ) icon + uppercase text
//   predicted  → DASHED border + sparkles icon + uppercase text
//
// The dashed border on predicted is the non-color secondary signal: it
// communicates "not settled" at a glance even in greyscale or for
// users with colour vision deficiency.
//
// Size variants:
//   sm  — 11px caption, used inside chart tooltips and table cells
//   md  — 12px label (default), used on cards

import { CheckCircle2, FunctionSquare, Sparkles } from "lucide-react";
import type { SourceVariant } from "@/lib/ui/tokens";

interface SourceLabelProps {
  variant: SourceVariant;
  size?: "sm" | "md";
  className?: string;
}

const CONFIG: Record<
  SourceVariant,
  {
    label: string;
    icon: React.ElementType;
    colorClass: string;
    borderClass: string;
    bgClass: string;
  }
> = {
  official: {
    label: "Official",
    icon: CheckCircle2,
    colorClass: "text-source-official",
    borderClass: "border border-source-official/40 border-solid",
    bgClass: "bg-source-official/10",
  },
  derived: {
    label: "Derived",
    icon: FunctionSquare,
    colorClass: "text-source-derived",
    borderClass: "border border-source-derived/40 border-solid",
    bgClass: "bg-source-derived/10",
  },
  predicted: {
    label: "Predicted",
    icon: Sparkles,
    colorClass: "text-source-predicted",
    // Dashed border is the secondary non-color signal for predicted state.
    borderClass: "border border-source-predicted/50 border-dashed",
    bgClass: "bg-source-predicted/10",
  },
};

const SIZE: Record<"sm" | "md", { text: string; icon: number; px: string; py: string; gap: string }> = {
  sm: { text: "text-caption", icon: 10, px: "px-1.5", py: "py-0.5", gap: "gap-1" },
  md: { text: "text-label",   icon: 11, px: "px-2",   py: "py-1",   gap: "gap-1" },
};

export function SourceLabel({
  variant,
  size = "md",
  className = "",
}: SourceLabelProps) {
  const cfg = CONFIG[variant];
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
        cfg.borderClass,
        cfg.bgClass,
        className,
      ].join(" ")}
      aria-label={`Data source: ${cfg.label}`}
    >
      <Icon size={sz.icon} strokeWidth={2} aria-hidden />
      {cfg.label}
    </span>
  );
}
