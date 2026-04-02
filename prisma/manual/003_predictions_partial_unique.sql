-- =============================================================================
-- Manual Migration: Partial Unique Index for predictions (PostgreSQL)
-- =============================================================================
-- Purpose:
--   Enforce database-level uniqueness on active model predictions.
--   Only one active model prediction should exist per (car_id, circuit_id,
--   prediction_type) combination at any time.
--
-- Apply after prisma migrate deploy:
--   psql $DATABASE_URL -f prisma/manual/003_predictions_partial_unique.sql
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_model_active_unique
  ON predictions (car_id, circuit_id, prediction_type)
  WHERE superseded_at IS NULL AND source_type = 'model';
