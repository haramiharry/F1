-- =============================================================================
-- Manual Migration: Partial Unique Index for Sessions (PostgreSQL)
-- =============================================================================
-- Purpose:
--   Enforce database-level uniqueness on active (non-cancelled) sessions.
--   A cancelled session (session_cancelled = FALSE) is excluded from the
--   constraint, allowing a rescheduled session to reuse the same
--   (round_id, session_type) combination with attempt_number incremented.
--
-- Apply after prisma migrate deploy:
--   psql $DATABASE_URL -f prisma/manual/001_session_partial_unique.sql
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_active_unique
  ON sessions (round_id, session_type, attempt_number)
  WHERE session_cancelled = FALSE;
