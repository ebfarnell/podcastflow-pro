-- Multi-Tenant Schema Migration for PodcastFlow Pro
-- This script creates separate schemas for each organization

-- =====================================================
-- STEP 1: Create function to generate organization schema
-- =====================================================

CREATE OR REPLACE FUNCTION create_organization_schema(org_slug TEXT, org_id TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
BEGIN
    -- Sanitize slug for schema name (replace hyphens with underscores)
    schema_name := 'org_' || replace(org_slug, '-', '_');
    
    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
    
    -- Grant permissions to podcastflow user
    EXECUTE format('GRANT ALL ON SCHEMA %I TO podcastflow', schema_name);
    
    RAISE NOTICE 'Created schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 2: Create function to create tables in org schema
-- =====================================================

CREATE OR REPLACE FUNCTION create_organization_tables(org_slug TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
BEGIN
    -- Sanitize slug for schema name
    schema_name := 'org_' || replace(org_slug, '-', '_');
    
    -- Set search path to the organization schema
    EXECUTE format('SET search_path TO %I, public', schema_name);
    
    -- Create Campaign table
    CREATE TABLE IF NOT EXISTS "Campaign" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL,
        "advertiserId" TEXT NOT NULL,
        "agencyId" TEXT,
        "organizationId" TEXT NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "budget" DOUBLE PRECISION,
        "spent" DOUBLE PRECISION DEFAULT 0,
        "impressions" INTEGER DEFAULT 0,
        "targetImpressions" INTEGER DEFAULT 0,
        "clicks" INTEGER DEFAULT 0,
        "conversions" INTEGER DEFAULT 0,
        "targetAudience" TEXT,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdBy" TEXT,
        "updatedBy" TEXT,
        CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
    );

    -- Create Show table
    CREATE TABLE IF NOT EXISTS "Show" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "organizationId" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdBy" TEXT,
        "updatedBy" TEXT,
        "host" TEXT,
        "category" TEXT,
        "releaseFrequency" TEXT,
        "releaseDay" TEXT,
        "revenueSharingType" TEXT,
        "revenueSharingPercentage" DOUBLE PRECISION,
        "revenueSharingFixedAmount" DOUBLE PRECISION,
        "revenueSharingNotes" TEXT,
        CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
    );

    -- Create Episode table
    CREATE TABLE IF NOT EXISTS "Episode" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "showId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "episodeNumber" INTEGER NOT NULL,
        "airDate" TIMESTAMP(3),
        "duration" INTEGER,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdBy" TEXT,
        "updatedBy" TEXT,
        "organizationId" TEXT NOT NULL,
        "producerNotes" TEXT,
        "talentNotes" TEXT,
        "recordingDate" TIMESTAMP(3),
        "publishUrl" TEXT,
        CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
    );

    -- Create Agency table
    CREATE TABLE IF NOT EXISTS "Agency" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL,
        "contactEmail" TEXT,
        "contactPhone" TEXT,
        "website" TEXT,
        "address" TEXT,
        "city" TEXT,
        "state" TEXT,
        "zipCode" TEXT,
        "country" TEXT,
        "organizationId" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdBy" TEXT,
        "updatedBy" TEXT,
        CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
    );

    -- Create Advertiser table
    CREATE TABLE IF NOT EXISTS "Advertiser" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL,
        "contactEmail" TEXT,
        "contactPhone" TEXT,
        "website" TEXT,
        "industry" TEXT,
        "address" TEXT,
        "city" TEXT,
        "state" TEXT,
        "zipCode" TEXT,
        "country" TEXT,
        "agencyId" TEXT,
        "organizationId" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdBy" TEXT,
        "updatedBy" TEXT,
        CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
    );

    -- Create AdApproval table
    CREATE TABLE IF NOT EXISTS "AdApproval" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "title" TEXT NOT NULL,
        "advertiserId" TEXT NOT NULL,
        "advertiserName" TEXT NOT NULL,
        "campaignId" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "showName" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "duration" INTEGER NOT NULL,
        "script" TEXT,
        "talkingPoints" TEXT[],
        "priority" TEXT NOT NULL DEFAULT 'medium',
        "deadline" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'pending',
        "salesRepId" TEXT,
        "salesRepName" TEXT,
        "submittedBy" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "workflowStage" TEXT NOT NULL DEFAULT 'pending_creation',
        "revisionCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "approvedAt" TIMESTAMP(3),
        "rejectedAt" TIMESTAMP(3),
        CONSTRAINT "AdApproval_pkey" PRIMARY KEY ("id")
    );

    -- Create Order table
    CREATE TABLE IF NOT EXISTS "Order" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "orderNumber" TEXT NOT NULL,
        "campaignId" TEXT NOT NULL,
        "version" INTEGER NOT NULL DEFAULT 1,
        "parentOrderId" TEXT,
        "organizationId" TEXT NOT NULL,
        "advertiserId" TEXT NOT NULL,
        "agencyId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "totalAmount" DOUBLE PRECISION NOT NULL,
        "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "discountReason" TEXT,
        "netAmount" DOUBLE PRECISION NOT NULL,
        "submittedAt" TIMESTAMP(3),
        "submittedBy" TEXT,
        "approvedAt" TIMESTAMP(3),
        "approvedBy" TEXT,
        "bookedAt" TIMESTAMP(3),
        "bookedBy" TEXT,
        "confirmedAt" TIMESTAMP(3),
        "confirmedBy" TEXT,
        "ioNumber" TEXT,
        "ioGeneratedAt" TIMESTAMP(3),
        "contractUrl" TEXT,
        "signedContractUrl" TEXT,
        "contractSignedAt" TIMESTAMP(3),
        "notes" TEXT,
        "internalNotes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdBy" TEXT NOT NULL,
        CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
    );

    -- Create Invoice table
    CREATE TABLE IF NOT EXISTS "Invoice" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "invoiceNumber" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'USD',
        "description" TEXT NOT NULL,
        "billingPeriod" TEXT,
        "plan" TEXT NOT NULL DEFAULT 'starter',
        "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "dueDate" TIMESTAMP(3) NOT NULL,
        "paidDate" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'pending',
        "notes" TEXT,
        "taxAmount" DOUBLE PRECISION,
        "discountAmount" DOUBLE PRECISION,
        "totalAmount" DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdById" TEXT,
        CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
    );

    -- Create Contract table
    CREATE TABLE IF NOT EXISTS "Contract" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "contractNumber" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "campaignId" TEXT,
        "orderId" TEXT,
        "advertiserId" TEXT NOT NULL,
        "agencyId" TEXT,
        "contractType" TEXT NOT NULL DEFAULT 'insertion_order',
        "title" TEXT NOT NULL,
        "description" TEXT,
        "totalAmount" DOUBLE PRECISION NOT NULL,
        "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "netAmount" DOUBLE PRECISION NOT NULL,
        "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "paymentTerms" TEXT NOT NULL DEFAULT 'Net 30',
        "cancellationTerms" TEXT,
        "deliveryTerms" TEXT,
        "specialTerms" TEXT,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "isExecuted" BOOLEAN NOT NULL DEFAULT false,
        "executedAt" TIMESTAMP(3),
        "executedById" TEXT,
        "templateId" TEXT,
        "generatedDocument" JSONB,
        "documentUrl" TEXT,
        "signatureUrl" TEXT,
        "sentAt" TIMESTAMP(3),
        "signedAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdById" TEXT NOT NULL,
        CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS "Campaign_organizationId_idx" ON "Campaign"("organizationId");
    CREATE INDEX IF NOT EXISTS "Campaign_advertiserId_idx" ON "Campaign"("advertiserId");
    CREATE INDEX IF NOT EXISTS "Show_organizationId_idx" ON "Show"("organizationId");
    CREATE INDEX IF NOT EXISTS "Episode_organizationId_idx" ON "Episode"("organizationId");
    CREATE INDEX IF NOT EXISTS "Episode_showId_idx" ON "Episode"("showId");
    CREATE INDEX IF NOT EXISTS "Agency_organizationId_idx" ON "Agency"("organizationId");
    CREATE INDEX IF NOT EXISTS "Advertiser_organizationId_idx" ON "Advertiser"("organizationId");
    CREATE INDEX IF NOT EXISTS "AdApproval_organizationId_idx" ON "AdApproval"("organizationId");
    CREATE INDEX IF NOT EXISTS "Order_organizationId_idx" ON "Order"("organizationId");
    CREATE INDEX IF NOT EXISTS "Invoice_organizationId_idx" ON "Invoice"("organizationId");
    CREATE INDEX IF NOT EXISTS "Contract_organizationId_idx" ON "Contract"("organizationId");

    -- Add more tables as needed...
    
    -- Reset search path
    SET search_path TO public;
    
    RAISE NOTICE 'Created tables in schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 3: Create schemas for existing organizations
-- =====================================================

-- Create schema for PodcastFlow Pro
SELECT create_organization_schema('podcastflow-pro', 'cmd2qfeve0000og5y8hfwu795');
SELECT create_organization_tables('podcastflow-pro');

-- Create schema for Unfy
SELECT create_organization_schema('unfy', 'cmd6ntwt00001og415m69qh50');
SELECT create_organization_tables('unfy');

-- =====================================================
-- STEP 4: Create function to migrate existing data
-- =====================================================

CREATE OR REPLACE FUNCTION migrate_organization_data(org_id TEXT, org_slug TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
    record_count INTEGER;
BEGIN
    -- Sanitize slug for schema name
    schema_name := 'org_' || replace(org_slug, '-', '_');
    
    -- Set search path
    EXECUTE format('SET search_path TO %I, public', schema_name);
    
    -- Migrate Campaigns
    EXECUTE format('
        INSERT INTO %I."Campaign" 
        SELECT * FROM public."Campaign" 
        WHERE "organizationId" = %L
        ON CONFLICT DO NOTHING
    ', schema_name, org_id);
    GET DIAGNOSTICS record_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % campaigns for %', record_count, org_slug;
    
    -- Migrate Shows
    EXECUTE format('
        INSERT INTO %I."Show" 
        SELECT * FROM public."Show" 
        WHERE "organizationId" = %L
        ON CONFLICT DO NOTHING
    ', schema_name, org_id);
    GET DIAGNOSTICS record_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % shows for %', record_count, org_slug;
    
    -- Migrate Episodes
    EXECUTE format('
        INSERT INTO %I."Episode" 
        SELECT * FROM public."Episode" 
        WHERE "organizationId" = %L
        ON CONFLICT DO NOTHING
    ', schema_name, org_id);
    GET DIAGNOSTICS record_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % episodes for %', record_count, org_slug;
    
    -- Migrate Agencies
    EXECUTE format('
        INSERT INTO %I."Agency" 
        SELECT * FROM public."Agency" 
        WHERE "organizationId" = %L
        ON CONFLICT DO NOTHING
    ', schema_name, org_id);
    GET DIAGNOSTICS record_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % agencies for %', record_count, org_slug;
    
    -- Migrate Advertisers
    EXECUTE format('
        INSERT INTO %I."Advertiser" 
        SELECT * FROM public."Advertiser" 
        WHERE "organizationId" = %L
        ON CONFLICT DO NOTHING
    ', schema_name, org_id);
    GET DIAGNOSTICS record_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % advertisers for %', record_count, org_slug;
    
    -- Reset search path
    SET search_path TO public;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: Migrate data for existing organizations
-- =====================================================

-- Migrate PodcastFlow Pro data
SELECT migrate_organization_data('cmd2qfeve0000og5y8hfwu795', 'podcastflow-pro');

-- Migrate Unfy data
SELECT migrate_organization_data('cmd6ntwt00001og415m69qh50', 'unfy');

-- =====================================================
-- STEP 6: Create view for master account to see all data
-- =====================================================

CREATE OR REPLACE VIEW all_campaigns AS
SELECT 'podcastflow-pro' as org_slug, * FROM org_podcastflow_pro."Campaign"
UNION ALL
SELECT 'unfy' as org_slug, * FROM org_unfy."Campaign";

CREATE OR REPLACE VIEW all_shows AS
SELECT 'podcastflow-pro' as org_slug, * FROM org_podcastflow_pro."Show"
UNION ALL
SELECT 'unfy' as org_slug, * FROM org_unfy."Show";

-- Grant permissions
GRANT SELECT ON all_campaigns TO podcastflow;
GRANT SELECT ON all_shows TO podcastflow;

-- =====================================================
-- VERIFICATION QUERIES (Run these to verify migration)
-- =====================================================

-- Check schemas created
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'org_%';

-- Check tables in each schema
-- SELECT table_schema, table_name FROM information_schema.tables 
-- WHERE table_schema LIKE 'org_%' ORDER BY table_schema, table_name;

-- Verify data migration
-- SELECT 'public' as schema, COUNT(*) as campaigns FROM public."Campaign"
-- UNION ALL
-- SELECT 'org_podcastflow_pro', COUNT(*) FROM org_podcastflow_pro."Campaign"
-- UNION ALL  
-- SELECT 'org_unfy', COUNT(*) FROM org_unfy."Campaign";