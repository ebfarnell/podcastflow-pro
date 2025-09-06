-- Multi-Tenant Schema Migration V2 - Complete Table Structure
-- This creates exact copies of tables in organization schemas

-- =====================================================
-- STEP 1: Drop and recreate the migration functions
-- =====================================================

DROP FUNCTION IF EXISTS create_organization_schema CASCADE;
DROP FUNCTION IF EXISTS create_organization_tables CASCADE;
DROP FUNCTION IF EXISTS migrate_organization_data CASCADE;

-- =====================================================
-- STEP 2: Create complete table creation function
-- =====================================================

CREATE OR REPLACE FUNCTION create_org_tables_from_public(org_slug TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
    create_table_sql TEXT;
BEGIN
    -- Sanitize slug for schema name
    schema_name := 'org_' || replace(org_slug, '-', '_');
    
    -- Create schema if not exists
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
    EXECUTE format('GRANT ALL ON SCHEMA %I TO podcastflow', schema_name);
    
    -- Set search path
    EXECUTE format('SET search_path TO %I, public', schema_name);
    
    -- List of tables to copy (organization-specific tables only)
    -- We'll use pg_dump style CREATE TABLE statements to ensure exact structure
    
    -- Campaign table
    CREATE TABLE IF NOT EXISTS "Campaign" (LIKE public."Campaign" INCLUDING ALL);
    
    -- Show table
    CREATE TABLE IF NOT EXISTS "Show" (LIKE public."Show" INCLUDING ALL);
    
    -- Episode table
    CREATE TABLE IF NOT EXISTS "Episode" (LIKE public."Episode" INCLUDING ALL);
    
    -- Agency table
    CREATE TABLE IF NOT EXISTS "Agency" (LIKE public."Agency" INCLUDING ALL);
    
    -- Advertiser table
    CREATE TABLE IF NOT EXISTS "Advertiser" (LIKE public."Advertiser" INCLUDING ALL);
    
    -- AdApproval table
    CREATE TABLE IF NOT EXISTS "AdApproval" (LIKE public."AdApproval" INCLUDING ALL);
    
    -- AdCreative table
    CREATE TABLE IF NOT EXISTS "AdCreative" (LIKE public."AdCreative" INCLUDING ALL);
    
    -- Order table
    CREATE TABLE IF NOT EXISTS "Order" (LIKE public."Order" INCLUDING ALL);
    
    -- OrderItem table
    CREATE TABLE IF NOT EXISTS "OrderItem" (LIKE public."OrderItem" INCLUDING ALL);
    
    -- Invoice table
    CREATE TABLE IF NOT EXISTS "Invoice" (LIKE public."Invoice" INCLUDING ALL);
    
    -- InvoiceItem table
    CREATE TABLE IF NOT EXISTS "InvoiceItem" (LIKE public."InvoiceItem" INCLUDING ALL);
    
    -- Payment table
    CREATE TABLE IF NOT EXISTS "Payment" (LIKE public."Payment" INCLUDING ALL);
    
    -- Contract table
    CREATE TABLE IF NOT EXISTS "Contract" (LIKE public."Contract" INCLUDING ALL);
    
    -- ContractLineItem table
    CREATE TABLE IF NOT EXISTS "ContractLineItem" (LIKE public."ContractLineItem" INCLUDING ALL);
    
    -- Expense table
    CREATE TABLE IF NOT EXISTS "Expense" (LIKE public."Expense" INCLUDING ALL);
    
    -- CampaignAnalytics table
    CREATE TABLE IF NOT EXISTS "CampaignAnalytics" (LIKE public."CampaignAnalytics" INCLUDING ALL);
    
    -- EpisodeAnalytics table
    CREATE TABLE IF NOT EXISTS "EpisodeAnalytics" (LIKE public."EpisodeAnalytics" INCLUDING ALL);
    
    -- ShowAnalytics table
    CREATE TABLE IF NOT EXISTS "ShowAnalytics" (LIKE public."ShowAnalytics" INCLUDING ALL);
    
    -- AnalyticsEvent table
    CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (LIKE public."AnalyticsEvent" INCLUDING ALL);
    
    -- ShowMetrics table
    CREATE TABLE IF NOT EXISTS "ShowMetrics" (LIKE public."ShowMetrics" INCLUDING ALL);
    
    -- UsageRecord table
    CREATE TABLE IF NOT EXISTS "UsageRecord" (LIKE public."UsageRecord" INCLUDING ALL);
    
    -- Comment table
    CREATE TABLE IF NOT EXISTS "Comment" (LIKE public."Comment" INCLUDING ALL);
    
    -- SpotSubmission table
    CREATE TABLE IF NOT EXISTS "SpotSubmission" (LIKE public."SpotSubmission" INCLUDING ALL);
    
    -- UploadedFile table
    CREATE TABLE IF NOT EXISTS "UploadedFile" (LIKE public."UploadedFile" INCLUDING ALL);
    
    -- CreativeUsage table
    CREATE TABLE IF NOT EXISTS "CreativeUsage" (LIKE public."CreativeUsage" INCLUDING ALL);
    
    -- Reservation table
    CREATE TABLE IF NOT EXISTS "Reservation" (LIKE public."Reservation" INCLUDING ALL);
    
    -- ReservationItem table
    CREATE TABLE IF NOT EXISTS "ReservationItem" (LIKE public."ReservationItem" INCLUDING ALL);
    
    -- BlockedSpot table
    CREATE TABLE IF NOT EXISTS "BlockedSpot" (LIKE public."BlockedSpot" INCLUDING ALL);
    
    -- Inventory table
    CREATE TABLE IF NOT EXISTS "Inventory" (LIKE public."Inventory" INCLUDING ALL);
    
    -- ShowPlacement table
    CREATE TABLE IF NOT EXISTS "ShowPlacement" (LIKE public."ShowPlacement" INCLUDING ALL);
    
    -- CampaignSchedule table
    CREATE TABLE IF NOT EXISTS "CampaignSchedule" (LIKE public."CampaignSchedule" INCLUDING ALL);
    
    -- ScheduleItem table
    CREATE TABLE IF NOT EXISTS "ScheduleItem" (LIKE public."ScheduleItem" INCLUDING ALL);
    
    -- Add more organization-specific tables as needed...
    
    -- Reset search path
    SET search_path TO public;
    
    RAISE NOTICE 'Created tables in schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 3: Create data migration function
-- =====================================================

CREATE OR REPLACE FUNCTION migrate_org_data(org_id TEXT, org_slug TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
    record_count INTEGER;
    total_count INTEGER := 0;
BEGIN
    -- Sanitize slug for schema name
    schema_name := 'org_' || replace(org_slug, '-', '_');
    
    -- Set search path
    EXECUTE format('SET search_path TO %I, public', schema_name);
    
    -- Migrate each table's data
    
    -- Campaigns
    INSERT INTO "Campaign" SELECT * FROM public."Campaign" WHERE "organizationId" = org_id ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS record_count = ROW_COUNT;
    total_count := total_count + record_count;
    RAISE NOTICE 'Migrated % campaigns', record_count;
    
    -- Shows
    INSERT INTO "Show" SELECT * FROM public."Show" WHERE "organizationId" = org_id ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS record_count = ROW_COUNT;
    total_count := total_count + record_count;
    RAISE NOTICE 'Migrated % shows', record_count;
    
    -- Episodes
    INSERT INTO "Episode" SELECT * FROM public."Episode" WHERE "organizationId" = org_id ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS record_count = ROW_COUNT;
    total_count := total_count + record_count;
    RAISE NOTICE 'Migrated % episodes', record_count;
    
    -- Agencies
    INSERT INTO "Agency" SELECT * FROM public."Agency" WHERE "organizationId" = org_id ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS record_count = ROW_COUNT;
    total_count := total_count + record_count;
    RAISE NOTICE 'Migrated % agencies', record_count;
    
    -- Advertisers
    INSERT INTO "Advertiser" SELECT * FROM public."Advertiser" WHERE "organizationId" = org_id ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS record_count = ROW_COUNT;
    total_count := total_count + record_count;
    RAISE NOTICE 'Migrated % advertisers', record_count;
    
    -- AdApprovals
    INSERT INTO "AdApproval" SELECT * FROM public."AdApproval" WHERE "organizationId" = org_id ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS record_count = ROW_COUNT;
    total_count := total_count + record_count;
    RAISE NOTICE 'Migrated % ad approvals', record_count;
    
    -- Orders
    INSERT INTO "Order" SELECT * FROM public."Order" WHERE "organizationId" = org_id ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS record_count = ROW_COUNT;
    total_count := total_count + record_count;
    RAISE NOTICE 'Migrated % orders', record_count;
    
    -- Invoices
    INSERT INTO "Invoice" SELECT * FROM public."Invoice" WHERE "organizationId" = org_id ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS record_count = ROW_COUNT;
    total_count := total_count + record_count;
    RAISE NOTICE 'Migrated % invoices', record_count;
    
    -- Contracts
    INSERT INTO "Contract" SELECT * FROM public."Contract" WHERE "organizationId" = org_id ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS record_count = ROW_COUNT;
    total_count := total_count + record_count;
    RAISE NOTICE 'Migrated % contracts', record_count;
    
    -- Expenses
    INSERT INTO "Expense" SELECT * FROM public."Expense" WHERE "organizationId" = org_id ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS record_count = ROW_COUNT;
    total_count := total_count + record_count;
    RAISE NOTICE 'Migrated % expenses', record_count;
    
    -- Reset search path
    SET search_path TO public;
    
    RAISE NOTICE 'Total records migrated for %: %', org_slug, total_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 4: Create function for new organizations
-- =====================================================

CREATE OR REPLACE FUNCTION setup_new_organization(org_id TEXT, org_slug TEXT)
RETURNS void AS $$
BEGIN
    -- Create schema and tables
    PERFORM create_org_tables_from_public(org_slug);
    
    -- Create initial records if needed (e.g., default settings)
    
    RAISE NOTICE 'Organization % setup complete', org_slug;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: Run migration for existing organizations
-- =====================================================

-- Drop existing schemas to start fresh
DROP SCHEMA IF EXISTS org_podcastflow_pro CASCADE;
DROP SCHEMA IF EXISTS org_unfy CASCADE;

-- Create schemas and tables for existing orgs
SELECT create_org_tables_from_public('podcastflow-pro');
SELECT create_org_tables_from_public('unfy');

-- Migrate data
SELECT migrate_org_data('cmd2qfeve0000og5y8hfwu795', 'podcastflow-pro');
SELECT migrate_org_data('cmd6ntwt00001og415m69qh50', 'unfy');

-- =====================================================
-- STEP 6: Create views for master account
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS all_campaigns;
DROP VIEW IF EXISTS all_shows;

-- Create union views for master account access
CREATE OR REPLACE VIEW master_campaigns AS
SELECT 'podcastflow_pro' as org_schema, * FROM org_podcastflow_pro."Campaign"
UNION ALL
SELECT 'unfy' as org_schema, * FROM org_unfy."Campaign";

CREATE OR REPLACE VIEW master_shows AS
SELECT 'podcastflow_pro' as org_schema, * FROM org_podcastflow_pro."Show"
UNION ALL
SELECT 'unfy' as org_schema, * FROM org_unfy."Show";

CREATE OR REPLACE VIEW master_episodes AS
SELECT 'podcastflow_pro' as org_schema, * FROM org_podcastflow_pro."Episode"
UNION ALL
SELECT 'unfy' as org_schema, * FROM org_unfy."Episode";

CREATE OR REPLACE VIEW master_orders AS
SELECT 'podcastflow_pro' as org_schema, * FROM org_podcastflow_pro."Order"
UNION ALL
SELECT 'unfy' as org_schema, * FROM org_unfy."Order";

-- Grant permissions
GRANT SELECT ON master_campaigns TO podcastflow;
GRANT SELECT ON master_shows TO podcastflow;
GRANT SELECT ON master_episodes TO podcastflow;
GRANT SELECT ON master_orders TO podcastflow;

-- =====================================================
-- STEP 7: Create helper functions for schema switching
-- =====================================================

CREATE OR REPLACE FUNCTION set_org_schema(org_slug TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
BEGIN
    schema_name := 'org_' || replace(org_slug, '-', '_');
    EXECUTE format('SET search_path TO %I, public', schema_name);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- List all organization schemas
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name LIKE 'org_%'
ORDER BY schema_name;