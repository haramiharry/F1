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
//         "schedule": "*/15 * * * 5,6,0"
//       }
//     ]
//   }
//
// Schedule explanation:
//   */15 * * * 5,6,0  — every 15 minutes on Friday (5), Saturday (6), Sunday (0)
//   Race weekends run Thu–Sun UTC. Adjust to 4,5,6,0 if Thursday FP1 is needed.
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

export async function GET() {
  const start = Date.now();

  const { checked, transitioned } = await applyTimeBasedFallbackAll();

  return NextResponse.json({
    checked,
    transitioned,
    elapsedMs: Date.now() - start,
  });
}
