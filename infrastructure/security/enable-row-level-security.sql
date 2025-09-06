-- Enable Row-Level Security (RLS) for PodcastFlow Pro
-- This script enables RLS on shared tables to provide an additional layer of tenant isolation

-- ============================================
-- 1. CREATE TENANT ACCESS LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.tenant_access_log (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    accessed_org_id TEXT NOT NULL,
    accessed_schema TEXT NOT NULL,
    operation TEXT NOT NULL,
    model TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    allowed BOOLEAN NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_access_log_user ON public.tenant_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_access_log_org ON public.tenant_access_log(accessed_org_id);
CREATE INDEX IF NOT EXISTS idx_tenant_access_log_timestamp ON public.tenant_access_log(timestamp);

-- ============================================
-- 2. CREATE RLS POLICIES FOR SHARED TABLES
-- ============================================

-- Enable RLS on User table
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see users in their organization (except master)
CREATE POLICY user_tenant_isolation ON public."User"
    FOR ALL
    USING (
        -- Master users can see all users
        EXISTS (
            SELECT 1 FROM public."User" current_user
            WHERE current_user.id = current_user_id()
            AND current_user.role = 'master'
        )
        OR
        -- Regular users can only see users in their organization
        "organizationId" = (
            SELECT "organizationId" 
            FROM public."User" 
            WHERE id = current_user_id()
        )
    );

-- Enable RLS on Session table
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sessions
CREATE POLICY session_user_isolation ON public."Session"
    FOR ALL
    USING (
        -- Users can only access their own sessions
        "userId" = current_user_id()
        OR
        -- Master users can see all sessions
        EXISTS (
            SELECT 1 FROM public."User"
            WHERE id = current_user_id()
            AND role = 'master'
        )
    );

-- ============================================
-- 3. CREATE FUNCTION TO GET CURRENT USER CONTEXT
-- ============================================

CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS TEXT AS $$
BEGIN
    -- This gets the user ID from the current session
    -- In production, this would be set by your application
    RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_org_id() 
RETURNS TEXT AS $$
BEGIN
    -- This gets the organization ID from the current session
    RETURN current_setting('app.current_org_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_org_schema() 
RETURNS TEXT AS $$
DECLARE
    org_slug TEXT;
BEGIN
    -- Get the organization slug and convert to schema name
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
-- 4. CREATE SECURE VIEW FOR CROSS-SCHEMA QUERIES
-- ============================================

-- Secure view for accessing tenant data with proper isolation
CREATE OR REPLACE VIEW public.tenant_campaigns AS
SELECT 
    c.*,
    current_org_schema() as tenant_schema
FROM (
    -- This would dynamically query the correct schema
    -- In practice, you'd use a function to query the right schema
    SELECT * FROM org_podcastflow_pro."Campaign"
    WHERE current_org_schema() = 'org_podcastflow_pro'
) c;

-- ============================================
-- 5. CREATE AUDIT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION audit_tenant_access() 
RETURNS TRIGGER AS $$
DECLARE
    operation_type TEXT;
    table_schema TEXT;
    table_name TEXT;
BEGIN
    -- Determine operation type
    CASE TG_OP
        WHEN 'INSERT' THEN operation_type := 'INSERT';
        WHEN 'UPDATE' THEN operation_type := 'UPDATE';
        WHEN 'DELETE' THEN operation_type := 'DELETE';
        ELSE operation_type := TG_OP;
    END CASE;
    
    -- Get schema and table info
    table_schema := TG_TABLE_SCHEMA;
    table_name := TG_TABLE_NAME;
    
    -- Log access if it's a cross-tenant operation
    IF table_schema LIKE 'org_%' AND table_schema != current_org_schema() THEN
        INSERT INTO public.tenant_access_log (
            user_id,
            user_role,
            accessed_org_id,
            accessed_schema,
            operation,
            model,
            timestamp,
            allowed,
            reason
        ) VALUES (
            current_user_id(),
            (SELECT role FROM public."User" WHERE id = current_user_id()),
            (SELECT id FROM public."Organization" WHERE 'org_' || REPLACE(LOWER(slug), '-', '_') = table_schema),
            table_schema,
            operation_type,
            table_name,
            NOW(),
            false,
            'Attempted cross-tenant access'
        );
        
        -- Optionally, you could RAISE EXCEPTION here to block the operation
        -- RAISE EXCEPTION 'Cross-tenant access denied';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. CREATE SCHEMA ISOLATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION set_tenant_context(
    p_user_id TEXT,
    p_org_id TEXT
) RETURNS VOID AS $$
BEGIN
    -- Set session variables for RLS
    PERFORM set_config('app.current_user_id', p_user_id, false);
    PERFORM set_config('app.current_org_id', p_org_id, false);
    
    -- Set search path to include tenant schema
    DECLARE
        org_schema TEXT;
    BEGIN
        SELECT 'org_' || REPLACE(LOWER(slug), '-', '_') 
        INTO org_schema
        FROM public."Organization"
        WHERE id = p_org_id;
        
        IF org_schema IS NOT NULL THEN
            EXECUTE format('SET search_path TO %I, public', org_schema);
        END IF;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. CREATE TENANT ISOLATION ENFORCEMENT
-- ============================================

-- Function to ensure queries are tenant-scoped
CREATE OR REPLACE FUNCTION ensure_tenant_isolation(
    p_query TEXT,
    p_model TEXT,
    p_operation TEXT
) RETURNS TEXT AS $$
DECLARE
    org_schema TEXT;
    safe_query TEXT;
BEGIN
    -- Get current organization schema
    org_schema := current_org_schema();
    
    IF org_schema IS NULL THEN
        RAISE EXCEPTION 'No tenant context set';
    END IF;
    
    -- Ensure query targets the correct schema
    IF p_query NOT LIKE '%' || org_schema || '%' THEN
        -- Prepend schema to table references
        safe_query := REPLACE(p_query, '"' || p_model || '"', org_schema || '."' || p_model || '"');
    ELSE
        safe_query := p_query;
    END IF;
    
    -- Log the access
    INSERT INTO public.tenant_access_log (
        user_id,
        user_role,
        accessed_org_id,
        accessed_schema,
        operation,
        model,
        timestamp,
        allowed,
        reason
    ) VALUES (
        current_user_id(),
        (SELECT role FROM public."User" WHERE id = current_user_id()),
        current_org_id(),
        org_schema,
        p_operation,
        p_model,
        NOW(),
        true,
        'Normal tenant access'
    );
    
    RETURN safe_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION current_user_id() TO podcastflow;
GRANT EXECUTE ON FUNCTION current_org_id() TO podcastflow;
GRANT EXECUTE ON FUNCTION current_org_schema() TO podcastflow;
GRANT EXECUTE ON FUNCTION set_tenant_context(TEXT, TEXT) TO podcastflow;
GRANT EXECUTE ON FUNCTION ensure_tenant_isolation(TEXT, TEXT, TEXT) TO podcastflow;

-- Grant permissions on tenant access log
GRANT SELECT, INSERT ON public.tenant_access_log TO podcastflow;
GRANT USAGE ON SEQUENCE tenant_access_log_id_seq TO podcastflow;

-- ============================================
-- 9. TEST THE SETUP
-- ============================================

-- Test setting context
SELECT set_tenant_context('test-user-id', 'test-org-id');

-- Test getting context
SELECT current_user_id(), current_org_id(), current_org_schema();

-- Reset context
RESET app.current_user_id;
RESET app.current_org_id;
RESET search_path;

-- ============================================
-- 10. MONITORING QUERIES
-- ============================================

-- Query to check for cross-tenant access attempts
SELECT 
    user_id,
    user_role,
    accessed_org_id,
    accessed_schema,
    operation,
    model,
    timestamp,
    allowed,
    reason
FROM public.tenant_access_log
WHERE allowed = false
OR (user_role != 'master' AND accessed_org_id != current_org_id())
ORDER BY timestamp DESC
LIMIT 100;

-- Query to analyze access patterns
SELECT 
    user_role,
    accessed_schema,
    model,
    operation,
    COUNT(*) as access_count,
    COUNT(CASE WHEN allowed = false THEN 1 END) as denied_count
FROM public.tenant_access_log
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY user_role, accessed_schema, model, operation
ORDER BY access_count DESC;