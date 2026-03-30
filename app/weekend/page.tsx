// Live Weekend — server component wrapper for WeekendClient.
//
// WeekendClient handles all data fetching and auto-refresh client-side.
// This file provides metadata and wraps WeekendClient in Suspense for
// the useSearchParams hook.
//
// No data fetching or placeholder data here. The zero state (no active round)
// renders inside WeekendClient when /api/weekend returns { round: null }.

import type { Metadata } from "next";
import { Suspense } from "react";
import { WeekendClient } from "./weekend-client";

export const metadata: Metadata = { title: "Weekend" };

function WeekendFallback() {
  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6 animate-pulse">
      <div className="h-6 w-48 bg-surface-elevated rounded-badge mb-2" />
      <div className="h-4 w-32 bg-surface-elevated rounded-badge mb-6" />
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-16 bg-surface-elevated rounded-badge" />
        ))}
      </div>
    </div>
  );
}

export default function WeekendPage() {
  return (
    <Suspense fallback={<WeekendFallback />}>
      <WeekendClient />
    </Suspense>
  );
}
