"use client";

// SourceLabel — displays the data provenance state of a metric.
//
// Three variants:
//   official   — FIA or Formula1.com sourced data
//   derived    — computed from official session data
//   predicted  — model or editorial estimate
//
// Differentiation matrix — three independent signals, all non-color:
//
//   Variant    Border style   Border width   Icon character
//   ─────────  ────────────   ────────────   ──────────────────────────────
//   official   SOLID          2px (thick)    ShieldCheck — filled shield,
//                                            conveys "verified, locked in"
//   derived    DOTTED         1px            Sigma (σ) — mathematical symbol,
//                                            conveys "computed from data"
//   predicted  DASHED         1px            Sparkles — estimative/uncertain,
//                                            conveys "model output"
//
// In greyscale (CVD or print):
//   official  — recognisable by thick solid border + shield-check shape
//   derived   — recognisable by dotted border + sigma letter shape
//   predicted — recognisable by dashed border + sparkle star shape
//
// Border styles differ structurally (solid dots are round, dashes are
// rectangular, solid is continuous) — not just in color or thickness.
// Icon shapes also differ structurally (shield vs Greek letter vs stars).
// A user who cannot distinguish green/blue/amber can still identify all
// three variants from border style alone or icon shape alone.
//
// Size variants:
//   sm  — 11px caption, used inside chart tooltips and table cells
//   md  — 12px label (default), used on cards

import { ShieldCheck, Sigma, Sparkles } from "lucide-react";
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
    // Each variant has a structurally distinct border style — see header comment.
    borderClass: string;
    bgClass: string;
  }
> = {
  official: {
    label: "Official",
    icon: ShieldCheck,
    colorClass: "text-source-official",
    // Thick solid border: "confirmed, locked"
    borderClass: "border-2 border-source-official/50",
    bgClass: "bg-source-official/15",
  },
  derived: {
    label: "Derived",
    icon: Sigma,
    colorClass: "text-source-derived",
    // Dotted border: "computed, not directly observed"
    borderClass: "border border-source-derived/50 border-dotted",
    bgClass: "bg-source-derived/10",
  },
  predicted: {
    label: "Predicted",
    icon: Sparkles,
    colorClass: "text-source-predicted",
    // Dashed border: "estimated, uncertain"
    borderClass: "border border-source-predicted/50 border-dashed",
    bgClass: "bg-source-predicted/8",
  },
};

const SIZE: Record<
  "sm" | "md",
  { text: string; icon: number; px: string; py: string; gap: string }
> = {
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
