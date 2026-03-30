"use client";

// CompareLimitBlock — shown when a third car would be added to comparison.
//
// The comparison system supports a maximum of two cars. When ?compare= would
// result in three or more slugs, this block is rendered instead of a third
// column. It explains the limit and offers two resolution paths:
//
//   1. Pre-filtered grid redirect — links to /cars?highlight=[slug1,slug2,slug3]
//      which opens Cars Overview with all three cars highlighted so the user
//      can pick which two to compare.
//
//   2. Clear one — links to remove one of the current cars from ?compare.
//
// This component receives the overflow slugs from the parent page, which
// parses the ?compare param.

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { Users, ArrowRight } from "lucide-react";
import { TEAM_NAMES } from "@/lib/ui/tokens";
import type { TeamSlug } from "@/lib/ui/tokens";

interface CompareLimitBlockProps {
  // All slugs including the one that triggered the limit (could be 3+)
  allSlugs: TeamSlug[];
}

export function CompareLimitBlock({ allSlugs }: CompareLimitBlockProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Build the highlight link — all slugs, no compare param
  const highlightHref = `/cars?highlight=${allSlugs.join(",")}`;

  // Build a "keep first two" link — drops the overflow slugs
  const keepTwo = allSlugs.slice(0, 2);
  const params = new URLSearchParams(searchParams.toString());
  params.set("compare", keepTwo.join(","));
  const keepTwoHref = `${pathname}?${params.toString()}`;

  return (
    <div className="rounded-card bg-surface border border-source-predicted/30 border-dashed p-5 space-y-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <Users size={18} className="text-source-predicted shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-data-small font-semibold text-text-primary">
            Two-car comparison limit reached
          </p>
          <p className="text-caption text-text-secondary mt-1">
            Side-by-side comparison supports a maximum of two cars to keep
            the view readable on mobile. You selected{" "}
            <strong className="text-text-primary">{allSlugs.length} cars</strong>:
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {allSlugs.map((slug) => (
              <li key={slug} className="text-caption text-text-secondary flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-text-muted inline-block" />
                {TEAM_NAMES[slug] ?? slug}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-2">
        {/* Option 1: show all in highlight grid */}
        <Link
          href={highlightHref}
          className="flex items-center justify-between w-full rounded-badge bg-surface-elevated border border-border px-3 py-2 text-data-small text-text-primary hover:border-text-secondary transition-colors group"
        >
          <span>Open all {allSlugs.length} in Cars grid</span>
          <ArrowRight size={14} className="text-text-muted group-hover:text-text-primary transition-colors" aria-hidden />
        </Link>

        {/* Option 2: keep first two only */}
        <Link
          href={keepTwoHref}
          className="flex items-center justify-between w-full rounded-badge bg-surface-elevated border border-border px-3 py-2 text-data-small text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors group"
        >
          <span>
            Keep {TEAM_NAMES[keepTwo[0]] ?? keepTwo[0]} &amp;{" "}
            {TEAM_NAMES[keepTwo[1]] ?? keepTwo[1]} only
          </span>
          <ArrowRight size={14} className="text-text-muted group-hover:text-text-primary transition-colors" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
