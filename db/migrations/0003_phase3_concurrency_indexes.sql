-- db/migrations/0003_phase3_concurrency_indexes.sql
-- PHASE 3: Add indexes and constraints for concurrency safety

ALTER TABLE pending_transactions
  ADD CONSTRAINT IF NOT EXISTS pending_transactions_checkout_request_id_unique
  UNIQUE (checkout_request_id);

ALTER TABLE tenant_ledger
  ADD CONSTRAINT IF NOT EXISTS tenant_ledger_reference_code_unique
  UNIQUE (reference_code);

CREATE INDEX IF NOT EXISTS idx_tenant_ledger_month_category_type
  ON tenant_ledger (billing_month, category, type);

CREATE INDEX IF NOT EXISTS idx_tenant_ledger_tenant_type
  ON tenant_ledger (tenant_id, type);

CREATE INDEX IF NOT EXISTS idx_pending_tx_tenant_status
  ON pending_transactions (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_buildings_shortcode
  ON buildings (daraja_shortcode);

CREATE INDEX IF NOT EXISTS idx_tenants_clerk_status
  ON tenants (clerk_user_id, status);

CREATE INDEX IF NOT EXISTS idx_leases_tenant_status
  ON leases (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tenants_active
  ON tenants (agency_id, status, invite_status)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS billing_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_month TEXT NOT NULL UNIQUE,
  locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  locked_by TEXT NOT NULL DEFAULT 'cron',
  expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS idx_billing_locks_expires
  ON billing_locks (expires_at);