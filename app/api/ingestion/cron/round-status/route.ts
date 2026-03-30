// Cron endpoint: apply time-based round status fallback to all active rounds.
//
// Runs independently of ingestSession. Designed to be called by a scheduler
// every 15 minutes during race weekends so that rounds transition from
// upcoming → in_progress even when no ingestion trigger has fired.
//
// ---------------------------------------------------------------------------
// Scheduler configuration:
//
//   See .github/workflows/round-status-cron.yml
//
//   A GitHub Actions workflow calls this endpoint every 15 minutes on
//   Thursday (4), Friday (5), Saturday (6), and Sunday (0) UTC. It passes
//   Authorization: Bearer <CRON_SECRET> on every request.
//
//   The Vercel Hobby plan does not support sub-daily cron schedules, so
//   Vercel crons are not used for this endpoint.
//
// Authorization:
//   CRON_SECRET must be set as a GitHub Actions secret (and as a Vercel
//   environment variable so this handler can verify it). When CRON_SECRET
//   is unset the auth check is skipped — development only.
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
