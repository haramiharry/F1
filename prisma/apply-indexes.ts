// Apply the three manual partial-unique indexes to the production database.
//
// Run after `npx prisma migrate deploy`:
//   DATABASE_URL=<neon-connection-string> npx tsx prisma/apply-indexes.ts
//
// This is the alternative to running psql when psql is not available locally.
// Each statement is idempotent (IF NOT EXISTS) so it is safe to re-run.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Applying manual partial-unique indexes…");

  // 1. Sessions: only one active (non-cancelled) session per round × type × attempt.
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_session_active_unique
      ON sessions (round_id, session_type, attempt_number)
      WHERE session_cancelled = FALSE
  `);
  console.log("✓ idx_session_active_unique");

  // 2. CarCircuitPerformance: only one active (non-superseded) record per
  //    car × circuit × round × session_type.
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ccp_active_unique
      ON car_circuit_performance (car_id, circuit_id, round_id, session_type)
      WHERE superseded_at IS NULL
  `);
  console.log("✓ idx_ccp_active_unique");

  // 3. Predictions: only one active model prediction per car × circuit × type.
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_model_active_unique
      ON predictions (car_id, circuit_id, prediction_type)
      WHERE superseded_at IS NULL AND source_type = 'model'
  `);
  console.log("✓ idx_predictions_model_active_unique");

  console.log("All indexes applied successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
