-- Migration: 0004c_clean_rls_reset.sql
-- NUCLEAR OPTION: Wipe ALL RLS policies and recreate from scratch
-- Run this ONLY after 0004b has been applied

-- ═══════════════════════════════════════════════════════════════════════════════
-- 0. DROP EVERY SINGLE POLICY ON EVERY TABLE (nuclear option)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename IN (
            'buildings', 'units', 'tenants', 'leases', 'tenant_ledger',
            'utility_readings', 'pending_transactions', 'complaints',
            'complaint_updates', 'building_utilities', 'notifications', 
            'staff', 'agencies', 'audit_log'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. RECREATE ALL ISOLATION POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY buildings_isolation ON buildings
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY units_isolation ON units
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY tenants_isolation ON tenants
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY leases_isolation ON leases
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY tenant_ledger_isolation ON tenant_ledger
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY utility_readings_isolation ON utility_readings
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY pending_transactions_isolation ON pending_transactions
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY complaints_isolation ON complaints
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY complaint_updates_isolation ON complaint_updates
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY building_utilities_isolation ON building_utilities
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY staff_isolation ON staff
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

CREATE POLICY notifications_isolation ON notifications
    FOR ALL USING (agency_id = get_current_agency_id())
    WITH CHECK (agency_id = get_current_agency_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. RECREATE SUPER ADMIN BYPASS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY buildings_super_admin_bypass ON buildings
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY units_super_admin_bypass ON units
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY tenants_super_admin_bypass ON tenants
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY leases_super_admin_bypass ON leases
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY tenant_ledger_super_admin_bypass ON tenant_ledger
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY utility_readings_super_admin_bypass ON utility_readings
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY pending_transactions_super_admin_bypass ON pending_transactions
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY complaints_super_admin_bypass ON complaints
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY complaint_updates_super_admin_bypass ON complaint_updates
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY building_utilities_super_admin_bypass ON building_utilities
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY staff_super_admin_bypass ON staff
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY notifications_super_admin_bypass ON notifications
    FOR ALL USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. AGENCIES TABLE POLICIES (special: public read for kill-switch)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY agencies_public_read ON agencies
    FOR SELECT USING (true);

CREATE POLICY agencies_write ON agencies
    FOR ALL
    USING (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (get_current_agency_id() = '00000000-0000-0000-0000-000000000000'::UUID);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. VERIFY
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = pg_tables.tablename) as policies
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'buildings', 'units', 'tenants', 'leases', 'tenant_ledger',
    'utility_readings', 'pending_transactions', 'complaints',
    'complaint_updates', 'building_utilities', 'notifications', 
    'staff', 'agencies'
)
ORDER BY tablename;

