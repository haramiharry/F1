// Cars Overview — comparison grid with URL param state.
//
// URL params handled:
//   ?compare=[teamSlug,teamSlug]   — activate side-by-side comparison panel
//                                    max 2 slugs; 3+ triggers CompareLimitBlock
//   ?highlight=[s1,s2,s3]          — highlight these cars in the grid
//                                    (used as redirect destination from CompareLimitBlock)
//   ?liveData=true                 — layer in-progress weekend metrics over static specs
//                                    no-op when the current round is completed
//
// Zero state (pre-Round 1): grid renders all cars with spec info but all
// performance metrics show "No data yet". Comparison columns show only specs.
//
// Comparison panel (≤2 cars): side-by-side column layout on desktop,
// stacked accordion on mobile.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CarsOverviewClient } from "./cars-overview-client";

export const metadata: Metadata = { title: "Cars" };

export default function CarsPage({
  searchParams,
}: {
  searchParams: {
    compare?: string;
    highlight?: string;
    liveData?: string;
    asOfRound?: string;
  };
}) {
  const compareSlugs = searchParams.compare
    ? searchParams.compare.split(",").filter(Boolean)
    : [];
  const highlightSlugs = searchParams.highlight
    ? searchParams.highlight.split(",").filter(Boolean)
    : [];
  const liveData = searchParams.liveData === "true";
  const asOfRound = searchParams.asOfRound ?? null;

  return (
    <Suspense fallback={<div className="px-4 py-8 text-text-muted text-data-small">Loading…</div>}>
      <CarsOverviewClient
        compareSlugs={compareSlugs}
        highlightSlugs={highlightSlugs}
        liveData={liveData}
        asOfRound={asOfRound}
      />
    </Suspense>
  );
}
