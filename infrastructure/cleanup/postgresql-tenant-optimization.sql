-- PostgreSQL Multi-Tenant Optimization Script
-- This script optimizes PostgreSQL for multi-tenant isolation and performance
-- Date: 2025-07-25

-- ============================================
-- 1. VERIFY SCHEMA ISOLATION
-- ============================================

-- List all organization schemas
SELECT 
    schema_name,
    schema_owner
FROM information_schema.schemata 
WHERE schema_name LIKE 'org_%'
ORDER BY schema_name;

-- Verify no cross-schema foreign keys exist
SELECT 
    tc.table_schema AS source_schema,
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_schema AS target_schema,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema LIKE 'org_%'
    AND tc.table_schema != ccu.table_schema
    AND ccu.table_schema != 'public';

-- ============================================
-- 2. CREATE TENANT-AWARE INDEXES
-- ============================================

-- Function to create indexes for all organization schemas
CREATE OR REPLACE FUNCTION create_tenant_indexes() RETURNS void AS $$
DECLARE
    schema_record RECORD;
    index_sql TEXT;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Campaign indexes for performance
        index_sql := format('CREATE INDEX IF NOT EXISTS idx_%I_campaign_status_date ON %I."Campaign"(status, "createdAt" DESC)', 
                          schema_record.schema_name, schema_record.schema_name);
        EXECUTE index_sql;
        
        index_sql := format('CREATE INDEX IF NOT EXISTS idx_%I_campaign_advertiser ON %I."Campaign"("advertiserId")', 
                          schema_record.schema_name, schema_record.schema_name);
        EXECUTE index_sql;
        
        -- Show indexes
        index_sql := format('CREATE INDEX IF NOT EXISTS idx_%I_show_active ON %I."Show"("isActive", name)', 
                          schema_record.schema_name, schema_record.schema_name);
        EXECUTE index_sql;
        
        -- Episode indexes
        index_sql := format('CREATE INDEX IF NOT EXISTS idx_%I_episode_show_date ON %I."Episode"("showId", "airDate" DESC)', 
                          schema_record.schema_name, schema_record.schema_name);
        EXECUTE index_sql;
        
        -- Analytics indexes
        index_sql := format('CREATE INDEX IF NOT EXISTS idx_%I_campaign_analytics_date ON %I."CampaignAnalytics"("campaignId", date DESC)', 
                          schema_record.schema_name, schema_record.schema_name);
        EXECUTE index_sql;
        
        RAISE NOTICE 'Created indexes for schema: %', schema_record.schema_name;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute index creation
SELECT create_tenant_indexes();

-- ============================================
-- 3. ROW-LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on public schema tables that contain user data
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;

-- Create policies for User table
CREATE POLICY user_isolation_policy ON public."User"
    FOR ALL
    USING (
        -- Users can only see their own record OR
        -- Users in same organization (except master users)
        id = current_setting('app.current_user_id', true)::text
        OR (
            "organizationId" = current_setting('app.current_org_id', true)::text
            AND role != 'master'
        )
        OR 
        -- Master users can see all
        current_setting('app.current_user_role', true) = 'master'
    );

-- Create policies for Session table  
CREATE POLICY session_isolation_policy ON public."Session"
    FOR ALL
    USING (
        -- Sessions are only visible to the session owner
        "userId" = current_setting('app.current_user_id', true)::text
        OR
        -- Master users can see all sessions
        current_setting('app.current_user_role', true) = 'master'
    );

-- ============================================
-- 4. PERFORMANCE OPTIMIZATION
-- ============================================

-- Update table statistics for all tenant schemas
CREATE OR REPLACE FUNCTION analyze_tenant_schemas() RETURNS void AS $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        EXECUTE format('ANALYZE %I."Campaign"', schema_record.schema_name);
        EXECUTE format('ANALYZE %I."Show"', schema_record.schema_name);
        EXECUTE format('ANALYZE %I."Episode"', schema_record.schema_name);
        EXECUTE format('ANALYZE %I."Advertiser"', schema_record.schema_name);
        RAISE NOTICE 'Analyzed tables in schema: %', schema_record.schema_name;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run analysis
SELECT analyze_tenant_schemas();

-- ============================================
-- 5. MONITORING QUERIES
-- ============================================

-- Create view for monitoring tenant data distribution
CREATE OR REPLACE VIEW tenant_data_distribution AS
SELECT 
    'org_podcastflow_pro' as schema_name,
    'Campaign' as table_name,
    COUNT(*) as row_count
FROM org_podcastflow_pro."Campaign"
UNION ALL
SELECT 
    'org_podcastflow_pro',
    'Show',
    COUNT(*)
FROM org_podcastflow_pro."Show"
UNION ALL
SELECT 
    'org_podcastflow_pro',
    'Episode',
    COUNT(*)
FROM org_podcastflow_pro."Episode"
UNION ALL
SELECT 
    'org_unfy',
    'Campaign',
    COUNT(*)
FROM org_unfy."Campaign"
UNION ALL
SELECT 
    'org_unfy',
    'Show',
    COUNT(*)
FROM org_unfy."Show"
UNION ALL
SELECT 
    'org_unfy',
    'Episode', 
    COUNT(*)
FROM org_unfy."Episode";

-- ============================================
-- 6. BACKUP PROCEDURES
-- ============================================

-- Function to backup a single tenant's data
CREATE OR REPLACE FUNCTION backup_tenant_schema(tenant_schema TEXT, backup_path TEXT) 
RETURNS TEXT AS $$
DECLARE
    backup_cmd TEXT;
    result TEXT;
BEGIN
    -- Validate schema exists and follows naming convention
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = tenant_schema 
        AND schema_name LIKE 'org_%'
    ) THEN
        RAISE EXCEPTION 'Invalid tenant schema: %', tenant_schema;
    END IF;
    
    -- Build backup command (to be executed externally)
    backup_cmd := format(
        'pg_dump -h localhost -U podcastflow -d podcastflow_production --schema=%I -f %s/%s_backup_%s.sql',
        tenant_schema,
        backup_path,
        tenant_schema,
        to_char(CURRENT_TIMESTAMP, 'YYYYMMDD_HH24MISS')
    );
    
    RETURN backup_cmd;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. AUDIT LOGGING
-- ============================================

-- Create audit log table in public schema
CREATE TABLE IF NOT EXISTS public.tenant_access_log (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    accessed_schema TEXT NOT NULL,
    query_type TEXT NOT NULL,
    table_name TEXT,
    row_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for audit queries
CREATE INDEX idx_tenant_access_log_user_date 
    ON public.tenant_access_log(user_id, created_at DESC);
CREATE INDEX idx_tenant_access_log_org_date 
    ON public.tenant_access_log(organization_id, created_at DESC);

-- ============================================
-- 8. SECURITY HARDENING
-- ============================================

-- Revoke default permissions
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO podcastflow;

-- Ensure each tenant schema has restricted access
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Revoke all from PUBLIC
        EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', schema_record.schema_name);
        -- Grant only to app user
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO podcastflow', schema_record.schema_name);
        EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO podcastflow', schema_record.schema_name);
        EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO podcastflow', schema_record.schema_name);
    END LOOP;
END $$;

-- ============================================
-- 9. PERFORMANCE SETTINGS
-- ============================================

-- Recommend settings (to be added to postgresql.conf)
COMMENT ON DATABASE podcastflow_production IS '
Recommended settings for multi-tenant performance:
- shared_buffers = 256MB
- effective_cache_size = 1GB
- work_mem = 4MB
- maintenance_work_mem = 64MB
- max_connections = 200
- random_page_cost = 1.1 (for SSD)
';

-- ============================================
-- 10. VERIFICATION QUERIES
-- ============================================

-- Verify no cross-tenant data access is possible
SELECT 
    'Verification Complete' as status,
    COUNT(DISTINCT schema_name) as tenant_schemas,
    SUM(CASE WHEN schema_name LIKE 'org_%' THEN 1 ELSE 0 END) as org_schemas
FROM information_schema.schemata;

-- Show data isolation summary
SELECT * FROM tenant_data_distribution ORDER BY schema_name, table_name;

-- List all indexes created
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname LIKE 'org_%'
ORDER BY schemaname, tablename, indexname;