-- =============================================================================
-- Manual Migration: Partial Unique Index for car_circuit_performance (PostgreSQL)
-- =============================================================================
-- Purpose:
--   Enforce database-level uniqueness on active (non-superseded) records.
--   A superseded record (superseded_at IS NOT NULL) is excluded from the
--   constraint, allowing amendment records to coexist with their predecessors
--   under the same (car_id, circuit_id, round_id, session_type) key.
--
-- Apply after prisma migrate deploy:
--   psql $DATABASE_URL -f prisma/manual/002_car_circuit_performance_partial_unique.sql
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_ccp_active_unique
  ON car_circuit_performance (car_id, circuit_id, round_id, session_type)
  WHERE superseded_at IS NULL;
