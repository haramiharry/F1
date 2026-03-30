// Prisma enum types re-exported as plain TypeScript string-literal unions.
//
// @prisma/client re-exports these through a generated .prisma/client chain
// that TypeScript 6 with moduleResolution:"bundler" cannot always resolve on
// Vercel (where prisma generate may not have run yet at type-check time).
//
// All values are sourced directly from prisma/schema.prisma.
// Update this file whenever an enum is added or a value is changed in the
// schema, then run prisma generate to keep the runtime and compile-time
// definitions in sync.

export type SessionType =
  | "fp1"
  | "fp2"
  | "fp3"
  | "qualifying"
  | "sprint_qualifying"
  | "sprint"
  | "race"
  | "round_aggregate";

export type RoundStatus = "upcoming" | "in_progress" | "completed";

export type RoundStatusSource = "data" | "time_based" | "manual";

export type SourceType = "official" | "derived" | "predicted" | "unavailable";

export type GearboxType = "longitudinal" | "transverse" | "unavailable";

export type FieldAvailability = "confirmed" | "unavailable";

export type TyreCompound = "soft" | "medium" | "hard" | "intermediate" | "wet";

export type PredictionSourceType = "model" | "editorial" | "hybrid";

export type ConfidenceLevel = "low" | "medium" | "high";

export type PredictionType =
  | "fastest_lap"
  | "strategy"
  | "track_fit"
  | "aero_effectiveness";

export type AdminQueueType =
  | "stale_provenance"
  | "hybrid_prediction_review"
  | "dab_zone_correction"
  | "round_aggregate_amendment"
  | "iqr_threshold_update";

export type AdminQueueStatus = "pending" | "in_review" | "resolved" | "dismissed";

export type DabZoneStatus = "confirmed" | "under_correction";

export type ThresholdSource = "static_default" | "iqr_derived";

export type StagingPromotionStatus = "pending" | "promoted" | "rejected";
