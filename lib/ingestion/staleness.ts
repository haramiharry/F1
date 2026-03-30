import type { SessionType } from "@/lib/db/types";

// Stale thresholds per session type in hours.
// Per spec: race 24h, qualifying 12h, practice 6h, sprint 12h.
// Passed to createProvenance({ staleThresholdHours }) so the staleness job
// knows when to set is_stale=true and raise an admin_review_queue item.
export const STALE_THRESHOLD_HOURS: Record<SessionType, number> = {
  fp1: 6,
  fp2: 6,
  fp3: 6,
  qualifying: 12,
  sprint_qualifying: 12,
  sprint: 12,
  race: 24,
  round_aggregate: 24,  // follows race threshold — derived from race data
} as const;

// FIA regulation documents are separate from session data. 7-day threshold.
export const FIA_DOCUMENT_STALE_HOURS = 168;

export function sessionTypeThreshold(sessionType: SessionType): number {
  return STALE_THRESHOLD_HOURS[sessionType];
}
