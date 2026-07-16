-- Migration: 0004d_neon_pooler_rls_fix.sql
-- FIX: Update get_current_agency_id() to work with Neon connection pooler

CREATE OR REPLACE FUNCTION get_current_agency_id()
RETURNS UUID AS $$
DECLARE
    val TEXT;
BEGIN
    -- Try custom session variable first (for direct connections)
    val := current_setting('app.current_agency_id', true);
    IF val IS NOT NULL AND val != '' THEN
        RETURN val::UUID;
    END IF;
    
    -- Fallback to application_name (for Neon pooled connections)
    -- application_name format: 'propflow:<agency_id>'
    val := current_setting('application_name', true);
    IF val IS NOT NULL AND val != '' AND val LIKE 'propflow:%' THEN
        RETURN substring(val from 10)::UUID;
    END IF;
    
    RETURN NULL;
EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;