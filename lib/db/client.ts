/**
 * Prisma client singleton with soft-delete query extension.
 *
 * Uses @prisma/adapter-neon backed by @neondatabase/serverless for
 * PostgreSQL connections to Neon. The Pool is created per process; Vercel
 * serverless functions get one pool per cold start, reused across requests
 * within the same instance.
 *
 * Soft-delete extension behavior:
 *   - findFirst / findFirstOrThrow / findMany / count on soft-deletable models
 *     automatically filter WHERE deleted_at IS NULL.
 *   - findUnique is NOT intercepted (Prisma requires unique-field-only WHERE on
 *     findUnique; the app uses findFirst for any query that needs the filter).
 *   - Queries that explicitly need deleted records must use the raw client:
 *     import { rawPrisma } from './client'
 *   - Models WITHOUT deleted_at are NOT in SOFT_DELETE_MODELS and are unaffected.
 *
 * The extension is applied once at module load. All application queries go
 * through `prisma` and get the filter for free. Admin audit views and amendment
 * history panels use `rawPrisma` to see full record sets including deleted rows.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

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

function makeAdapter() {
  return new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
}

function buildPrismaClient() {
  const base = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
    adapter: makeAdapter(),
  });

  // -------------------------------------------------------------------------
  // Soft-delete extension (replaces $use middleware removed in Prisma 7).
  // Intercepts read operations on soft-deletable models and injects
  // { deleted_at: null } into the WHERE clause automatically.
  // -------------------------------------------------------------------------
  return base.$extends({
    query: {
      $allModels: {
        async findFirst({ model, args, query }: any) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            args = { ...args, where: { ...args.where, deleted_at: null } };
          }
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }: any) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            args = { ...args, where: { ...args.where, deleted_at: null } };
          }
          return query(args);
        },
        async findMany({ model, args, query }: any) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            args = { ...args, where: { ...args.where, deleted_at: null } };
          }
          return query(args);
        },
        async count({ model, args, query }: any) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            args = { ...args, where: { ...args.where, deleted_at: null } };
          }
          return query(args);
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof buildPrismaClient>;

// ---------------------------------------------------------------------------
// Singleton pattern: reuse the client across hot-reloads in development.
// In production, module cache ensures a single instance.
// ---------------------------------------------------------------------------
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
  rawPrisma: PrismaClient | undefined;
};

/**
 * Default client — soft-delete extension applied.
 * Use this for all standard application queries.
 */
export const prisma: ExtendedPrismaClient =
  globalForPrisma.prisma ?? buildPrismaClient();

/**
 * Raw client — no extension.
 * Use only for:
 *   - Admin audit views that need to see deleted records
 *   - Amendment history panels (all revisions including superseded)
 *   - Migration scripts
 */
export const rawPrisma: PrismaClient =
  globalForPrisma.rawPrisma ?? new PrismaClient({ adapter: makeAdapter() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.rawPrisma = rawPrisma;
}

/**
 * Type for the transaction client passed to prisma.$transaction callbacks.
 * Derived from the prisma instance so it stays in sync with extensions.
 */
export type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];
