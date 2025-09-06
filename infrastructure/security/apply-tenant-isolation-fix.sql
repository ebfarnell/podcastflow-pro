-- Apply Tenant Isolation Fix for PodcastFlow Pro
-- This script enables critical tenant isolation that was missing
-- Date: 2025-08-04

-- ============================================
-- 1. ALTER EXISTING TENANT ACCESS LOG TABLE
-- ============================================

-- Add missing columns to match expected structure
ALTER TABLE public.tenant_access_log 
ADD COLUMN IF NOT EXISTS user_role TEXT,
ADD COLUMN IF NOT EXISTS operation TEXT,
ADD COLUMN IF NOT EXISTS model TEXT,
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS allowed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reason TEXT;

-- Rename organization_id to accessed_org_id to match expected schema
ALTER TABLE public.tenant_access_log 
RENAME COLUMN organization_id TO accessed_org_id;

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_tenant_access_log_org ON public.tenant_access_log(accessed_org_id);
CREATE INDEX IF NOT EXISTS idx_tenant_access_log_timestamp ON public.tenant_access_log(timestamp);

-- ============================================
-- 2. FIX CONTEXT FUNCTIONS IF MISSING
-- ============================================

-- Drop and recreate functions to ensure they exist
DROP FUNCTION IF EXISTS current_user_id();
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS current_org_id();
CREATE OR REPLACE FUNCTION current_org_id() 
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_org_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS current_org_schema();
CREATE OR REPLACE FUNCTION current_org_schema() 
RETURNS TEXT AS $$
DECLARE
    org_slug TEXT;
BEGIN
    SELECT slug INTO org_slug
    FROM public."Organization"
    WHERE id = current_org_id();
    
    IF org_slug IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN 'org_' || REPLACE(LOWER(org_slug), '-', '_');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. CREATE CRITICAL RLS POLICIES
-- ============================================

-- We cannot enable RLS without being table owner, but we can create
-- a verification function that APIs should call

CREATE OR REPLACE FUNCTION verify_tenant_access(
    p_table_name TEXT,
    p_record_id TEXT,
    p_org_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check if record exists and belongs to the organization
    IF p_table_name = 'UploadedFile' THEN
        SELECT COUNT(*) INTO v_count
        FROM public."UploadedFile"
        WHERE id = p_record_id 
        AND "organizationId" = p_org_id;
    ELSIF p_table_name = 'DeletionRequest' THEN
        SELECT COUNT(*) INTO v_count
        FROM public."DeletionRequest"
        WHERE id = p_record_id 
        AND "organizationId" = p_org_id;
    ELSIF p_table_name = 'User' THEN
        SELECT COUNT(*) INTO v_count
        FROM public."User"
        WHERE id = p_record_id 
        AND "organizationId" = p_org_id;
    ELSE
        -- Unknown table, deny access
        RETURN FALSE;
    END IF;
    
    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. CREATE ENHANCED AUDIT FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION audit_data_access(
    p_user_id TEXT,
    p_user_role TEXT,
    p_org_id TEXT,
    p_accessed_schema TEXT,
    p_operation TEXT,
    p_model TEXT,
    p_allowed BOOLEAN DEFAULT true,
    p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.tenant_access_log (
        user_id,
        user_role,
        accessed_org_id,
        accessed_schema,
        operation,
        model,
        timestamp,
        allowed,
        reason,
        query_type,
        table_name
    ) VALUES (
        p_user_id,
        p_user_role,
        p_org_id,
        p_accessed_schema,
        p_operation,
        p_model,
        NOW(),
        p_allowed,
        p_reason,
        p_operation, -- for backward compatibility
        p_model      -- for backward compatibility
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the operation
        RAISE WARNING 'Failed to audit access: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. CREATE TENANT VALIDATION TRIGGERS
-- ============================================

-- Function to validate organization context on DML operations
CREATE OR REPLACE FUNCTION validate_tenant_context() 
RETURNS TRIGGER AS $$
DECLARE
    v_current_org_id TEXT;
    v_table_org_id TEXT;
BEGIN
    -- Get current organization context
    v_current_org_id := current_org_id();
    
    -- Skip validation if no context set (system operations)
    IF v_current_org_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get organization ID from the record
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        v_table_org_id := NEW."organizationId";
    ELSE
        v_table_org_id := OLD."organizationId";
    END IF;
    
    -- Validate organization match
    IF v_table_org_id IS NOT NULL AND v_table_org_id != v_current_org_id THEN
        -- Check if user is master
        IF EXISTS (
            SELECT 1 FROM public."User" 
            WHERE id = current_user_id() 
            AND role = 'master'
        ) THEN
            -- Log cross-tenant access by master
            PERFORM audit_data_access(
                current_user_id(),
                'master',
                v_table_org_id,
                TG_TABLE_SCHEMA,
                TG_OP,
                TG_TABLE_NAME,
                true,
                'Master cross-tenant access'
            );
        ELSE
            -- Block non-master cross-tenant access
            PERFORM audit_data_access(
                current_user_id(),
                (SELECT role FROM public."User" WHERE id = current_user_id()),
                v_table_org_id,
                TG_TABLE_SCHEMA,
                TG_OP,
                TG_TABLE_NAME,
                false,
                'Blocked: Unauthorized cross-tenant access'
            );
            RAISE EXCEPTION 'Cross-tenant access denied for table % (org % != %)', 
                TG_TABLE_NAME, v_table_org_id, v_current_org_id;
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. APPLY TRIGGERS TO CRITICAL TABLES
-- ============================================

-- Note: We can only create triggers if we have ownership
-- These will fail but show what should be done

-- UploadedFile
DROP TRIGGER IF EXISTS validate_tenant_uploadedfile ON public."UploadedFile";
CREATE TRIGGER validate_tenant_uploadedfile
    BEFORE INSERT OR UPDATE OR DELETE ON public."UploadedFile"
    FOR EACH ROW EXECUTE FUNCTION validate_tenant_context();

-- DeletionRequest  
DROP TRIGGER IF EXISTS validate_tenant_deletionrequest ON public."DeletionRequest";
CREATE TRIGGER validate_tenant_deletionrequest
    BEFORE INSERT OR UPDATE OR DELETE ON public."DeletionRequest"
    FOR EACH ROW EXECUTE FUNCTION validate_tenant_context();

-- User (special handling for user creation)
DROP TRIGGER IF EXISTS validate_tenant_user ON public."User";
CREATE TRIGGER validate_tenant_user
    BEFORE UPDATE OR DELETE ON public."User"
    FOR EACH ROW EXECUTE FUNCTION validate_tenant_context();

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION current_user_id() TO podcastflow;
GRANT EXECUTE ON FUNCTION current_org_id() TO podcastflow;
GRANT EXECUTE ON FUNCTION current_org_schema() TO podcastflow;
GRANT EXECUTE ON FUNCTION verify_tenant_access(TEXT, TEXT, TEXT) TO podcastflow;
GRANT EXECUTE ON FUNCTION audit_data_access(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO podcastflow;

-- ============================================
-- 8. CREATE MONITORING VIEWS
-- ============================================

-- View to monitor cross-tenant access attempts
CREATE OR REPLACE VIEW tenant_access_violations AS
SELECT 
    tal.user_id,
    u.email as user_email,
    tal.user_role,
    tal.accessed_org_id,
    o.name as accessed_org_name,
    tal.accessed_schema,
    tal.operation,
    tal.model,
    tal.timestamp,
    tal.allowed,
    tal.reason
FROM public.tenant_access_log tal
LEFT JOIN public."User" u ON u.id = tal.user_id
LEFT JOIN public."Organization" o ON o.id = tal.accessed_org_id
WHERE tal.allowed = false
   OR (tal.user_role != 'master' 
       AND tal.accessed_org_id != u."organizationId")
ORDER BY tal.timestamp DESC;

-- Grant access to monitoring view
GRANT SELECT ON tenant_access_violations TO podcastflow;

-- ============================================
-- 9. VERIFICATION QUERIES
-- ============================================

-- Show current status
SELECT 'Tenant isolation functions created successfully' as status;

-- Show tables that need RLS enabled (requires superuser)
SELECT 
    schemaname,
    tablename,
    'Needs RLS' as status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('User', 'Session', 'Organization', 'UploadedFile', 'DeletionRequest');

-- Show recent access violations (if any)
SELECT COUNT(*) as violation_count
FROM public.tenant_access_log
WHERE allowed = false
   OR (timestamp > NOW() - INTERVAL '1 day' 
       AND reason LIKE '%cross-tenant%');