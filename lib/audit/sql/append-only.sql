-- lib/audit/sql/append-only.sql
-- Phase B — Make audit_log append-only at the database level.
--
-- RUN THIS MANUALLY via psql or drizzle-kit execute:
--   psql $DATABASE_URL -f lib/audit/sql/append-only.sql
--
-- What this does:
-- 1. Creates a dedicated DB role for the application (if not exists)
-- 2. Grants INSERT + SELECT on audit_log to the app role
-- 3. Explicitly revokes UPDATE and DELETE on audit_log from the app role
-- 4. Creates an index on agencyId + createdAt for fast Super Admin queries
--
-- NOTE: Replace 'propflow_app' with your actual application DB user name.

-- ── 1. Create app role (skip if already exists) ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'propflow_app') THEN
    CREATE ROLE propflow_app NOLOGIN;
  END IF;
END
$$;

-- ── 2. Grant schema usage ────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO propflow_app;

-- ── 3. Grant SELECT + INSERT on audit_log ──────────────────────────────────
GRANT SELECT, INSERT ON audit_log TO propflow_app;

-- ── 4. Revoke UPDATE + DELETE on audit_log ─────────────────────────────────
REVOKE UPDATE, DELETE ON audit_log FROM propflow_app;

-- ── 5. Revoke ALL on audit_log from public ─────────────────────────────────
REVOKE ALL ON audit_log FROM PUBLIC;

-- ── 6. Index for Super Admin queries ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_agency_created
  ON audit_log (agency_id, created_at DESC);

-- ── 7. Index for actor queries ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_created
  ON audit_log (actor_clerk_id, created_at DESC);

-- ── 8. Index for target record history ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_target
  ON audit_log (target_table, target_id, created_at DESC);

-- ── 9. Index for action type filtering ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON audit_log (action, created_at DESC);