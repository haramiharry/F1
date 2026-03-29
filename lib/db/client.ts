/**
 * Prisma client singleton with soft-delete middleware.
 *
 * Soft-delete middleware behavior:
 *   - findUnique / findFirst / findMany on soft-deletable models automatically
 *     filter WHERE deleted_at IS NULL.
 *   - Queries that explicitly need deleted records must use the raw client:
 *     import { rawPrisma } from './client'
 *   - Models WITHOUT deleted_at (fastest_laps, circuit_dab_zones, predictions,
 *     source_provenance, admin_review_queue) are NOT in SOFT_DELETE_MODELS
 *     and are unaffected by this middleware.
 *
 * The middleware is applied once at module load. All application queries go
 * through `prisma` and get the filter for free. Admin audit views and amendment
 * history panels use `rawPrisma` to see full record sets including deleted rows.
 */

import { PrismaClient, Prisma } from "@prisma/client";

// Models that carry a deleted_at field and must be filtered by default.
// Any model added to this list must have deleted_at: DateTime? in the schema.
const SOFT_DELETE_MODELS: Prisma.ModelName[] = [
  "Team",
  "Driver",
  "Car",
  "Circuit",
  "CircuitProfile",
  "Round",
  "Session",
  "SessionResult",
  "CarCircuitPerformance",
];

function buildPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

  // ---------------------------------------------------------------------------
  // Soft-delete middleware
  // Intercepts read operations on soft-deletable models and injects
  // { deleted_at: null } into the WHERE clause automatically.
  // ---------------------------------------------------------------------------
  client.$use(async (params: Prisma.MiddlewareParams, next) => {
    if (params.model && SOFT_DELETE_MODELS.includes(params.model)) {
      if (
        params.action === "findUnique" ||
        params.action === "findFirst" ||
        params.action === "findUniqueOrThrow" ||
        params.action === "findFirstOrThrow"
      ) {
        // findUnique with a where filter that includes deleted_at guard
        // must be promoted to findFirst (findUnique doesn't support extra where clauses
        // beyond unique fields in Prisma)
        params.action = "findFirst";
        params.args = params.args ?? {};
        params.args.where = {
          ...params.args.where,
          deleted_at: null,
        };
      }

      if (params.action === "findMany") {
        params.args = params.args ?? {};
        params.args.where = {
          ...params.args.where,
          deleted_at: null,
        };
      }

      // count also respects the soft-delete filter
      if (params.action === "count") {
        params.args = params.args ?? {};
        params.args.where = {
          ...params.args.where,
          deleted_at: null,
        };
      }
    }

    return next(params);
  });

  return client;
}

// ---------------------------------------------------------------------------
// Singleton pattern: reuse the client across hot-reloads in development.
// In production, module cache ensures a single instance.
// ---------------------------------------------------------------------------
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  rawPrisma: PrismaClient | undefined;
};

/**
 * Default client — soft-delete middleware applied.
 * Use this for all standard application queries.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? buildPrismaClient();

/**
 * Raw client — no middleware.
 * Use only for:
 *   - Admin audit views that need to see deleted records
 *   - Amendment history panels (all revisions including superseded)
 *   - Migration scripts
 */
export const rawPrisma: PrismaClient =
  globalForPrisma.rawPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.rawPrisma = rawPrisma;
}
