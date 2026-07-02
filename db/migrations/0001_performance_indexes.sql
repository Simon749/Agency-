-- Migration: Performance Indexes for Phase 2
-- Generated: 2026-07-01
-- Run: psql $DATABASE_URL -f db/migrations/0001_performance_indexes.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- TENANTS (middleware hot path + every tenant query)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "idx_tenants_clerk_user_id" ON "tenants" ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "idx_tenants_agency_id" ON "tenants" ("agency_id");
CREATE INDEX IF NOT EXISTS "idx_tenants_building_id" ON "tenants" ("building_id");
CREATE INDEX IF NOT EXISTS "idx_tenants_unit_id" ON "tenants" ("unit_id");
CREATE INDEX IF NOT EXISTS "idx_tenants_status" ON "tenants" ("status");

-- ═══════════════════════════════════════════════════════════════════════════════
-- TENANT LEDGER — THE HOTTEST TABLE (millions of rows expected)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "idx_tenant_ledger_tenant_id" ON "tenant_ledger" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_ledger_agency_id" ON "tenant_ledger" ("agency_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_ledger_building_id" ON "tenant_ledger" ("building_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_ledger_created_at" ON "tenant_ledger" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_tenant_ledger_billing_month" ON "tenant_ledger" ("billing_month");
CREATE INDEX IF NOT EXISTS "idx_tenant_ledger_reference_code" ON "tenant_ledger" ("reference_code");
-- Composite: enables index-only scans for balance calculations
CREATE INDEX IF NOT EXISTS "idx_tenant_ledger_tenant_type" ON "tenant_ledger" ("tenant_id", "type");

-- ═══════════════════════════════════════════════════════════════════════════════
-- PENDING TRANSACTIONS (webhook hot path — must be sub-100ms)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "idx_pending_transactions_checkout_request_id" ON "pending_transactions" ("checkout_request_id");
CREATE INDEX IF NOT EXISTS "idx_pending_transactions_tenant_id" ON "pending_transactions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_pending_transactions_status" ON "pending_transactions" ("status");

-- ═══════════════════════════════════════════════════════════════════════════════
-- BUILDINGS & UNITS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "idx_buildings_agency_id" ON "buildings" ("agency_id");
CREATE INDEX IF NOT EXISTS "idx_units_building_id" ON "units" ("building_id");
CREATE INDEX IF NOT EXISTS "idx_units_agency_id" ON "units" ("agency_id");

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEASES
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "idx_leases_tenant_id" ON "leases" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_leases_unit_id" ON "leases" ("unit_id");
CREATE INDEX IF NOT EXISTS "idx_leases_agency_id" ON "leases" ("agency_id");
CREATE INDEX IF NOT EXISTS "idx_leases_status" ON "leases" ("status");

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMPLAINTS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "idx_complaints_tenant_id" ON "complaints" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_complaints_agency_id" ON "complaints" ("agency_id");
CREATE INDEX IF NOT EXISTS "idx_complaints_building_id" ON "complaints" ("building_id");
CREATE INDEX IF NOT EXISTS "idx_complaints_status" ON "complaints" ("status");

-- ═══════════════════════════════════════════════════════════════════════════════
-- UTILITY READINGS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "idx_utility_readings_unit_id" ON "utility_readings" ("unit_id");
CREATE INDEX IF NOT EXISTS "idx_utility_readings_agency_id" ON "utility_readings" ("agency_id");
CREATE INDEX IF NOT EXISTS "idx_utility_readings_billing_month" ON "utility_readings" ("billing_month");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STAFF
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "idx_staff_clerk_user_id" ON "staff" ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "idx_staff_agency_id" ON "staff" ("agency_id");

-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_agency_id" ON "notifications" ("agency_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_is_read" ON "notifications" ("is_read");