// Cron endpoint: apply time-based round status fallback to all active rounds.
//
// Runs independently of ingestSession. Designed to be called by a scheduler
// every 15 minutes during race weekends so that rounds transition from
// upcoming → in_progress even when no ingestion trigger has fired.
//
// ---------------------------------------------------------------------------
// Vercel cron configuration (add to vercel.json at project root):
//
//   {
//     "crons": [
//       {
//         "path": "/api/ingestion/cron/round-status",
//         "schedule": "*/15 * * * 4,5,6,0"
//       }
//     ]
//   }
//
// Schedule explanation:
//   */15 * * * 4,5,6,0  — every 15 minutes on Thursday (4), Friday (5), Saturday (6), Sunday (0)
//   Covers the full race weekend: FP1 (Thu), FP2/FP3 (Fri), Qualifying (Sat), Race (Sun).
//
// For non-Vercel deployments (Railway, Fly.io, external cron):
//   Call GET /api/ingestion/cron/round-status on whatever scheduler is available.
//   No request body or auth header is required in development.
//   Add an Authorization header check (e.g. Bearer token from env) before
//   deploying to production to prevent unauthenticated invocation.
//
// Response 200:
//   { checked: number, transitioned: number, elapsedMs: number }
//   checked     — number of upcoming rounds with sessions past the 90-min cutoff
//   transitioned — number of those rounds that had no results and were flipped
//   elapsedMs   — wall-clock time for the operation (useful for cron monitoring)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { applyTimeBasedFallbackAll } from "@/lib/ingestion/pipeline";

export async function GET(request: Request) {
  // Authorization guard — required in production to prevent unauthenticated
  // invocation by arbitrary callers. Set CRON_SECRET in the environment.
  // On Vercel, the platform injects x-vercel-cron-signature automatically and
  // this Bearer check is an additional layer for external schedulers.
  // Skipped when CRON_SECRET is unset (development).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const start = Date.now();

  const { checked, transitioned } = await applyTimeBasedFallbackAll();

  return NextResponse.json({
    checked,
    transitioned,
    elapsedMs: Date.now() - start,
  });
}
