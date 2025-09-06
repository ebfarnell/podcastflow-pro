-- Migration: 20250812_talent_approval_system
-- Description: Add talent approval and competitive category systems for workflow v2
-- Note: This will be applied to each organization schema

-- Function to apply migration to a specific schema
CREATE OR REPLACE FUNCTION apply_talent_approval_migration(schema_name text) RETURNS void AS $$
BEGIN
    -- Create Category table for competitive category management
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."Category" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "parentId" TEXT,
            "isActive" BOOLEAN DEFAULT true,
            "organizationId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdBy" TEXT,
            "updatedBy" TEXT,
            CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES %I."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )', schema_name, schema_name);

    -- Create CompetitiveGroup table for defining competitive relationships
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."CompetitiveGroup" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "conflictMode" TEXT DEFAULT ''warn'' CHECK ("conflictMode" IN (''warn'', ''block'')),
            "isActive" BOOLEAN DEFAULT true,
            "organizationId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdBy" TEXT,
            "updatedBy" TEXT
        )', schema_name);

    -- Create AdvertiserCategory junction table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."AdvertiserCategory" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "advertiserId" TEXT NOT NULL,
            "categoryId" TEXT NOT NULL,
            "competitiveGroupId" TEXT,
            "isPrimary" BOOLEAN DEFAULT false,
            "organizationId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "AdvertiserCategory_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES %I."Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "AdvertiserCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES %I."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "AdvertiserCategory_competitiveGroupId_fkey" FOREIGN KEY ("competitiveGroupId") REFERENCES %I."CompetitiveGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT "AdvertiserCategory_unique" UNIQUE ("advertiserId", "categoryId")
        )', schema_name, schema_name, schema_name, schema_name);

    -- Create TalentApprovalRequest table for talent approval workflow
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."TalentApprovalRequest" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "campaignId" TEXT NOT NULL,
            "showId" TEXT NOT NULL,
            "talentId" TEXT NOT NULL,
            "spotType" TEXT NOT NULL CHECK ("spotType" IN (''host_read'', ''endorsement'', ''pre_produced'')),
            "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "requestedBy" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT ''pending'' CHECK ("status" IN (''pending'', ''approved'', ''denied'', ''expired'')),
            "respondedAt" TIMESTAMP(3),
            "respondedBy" TEXT,
            "comments" TEXT,
            "denialReason" TEXT,
            "expiresAt" TIMESTAMP(3),
            "summaryData" JSONB,
            "organizationId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "TalentApprovalRequest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES %I."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "TalentApprovalRequest_showId_fkey" FOREIGN KEY ("showId") REFERENCES %I."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )', schema_name, schema_name, schema_name);

    -- Create ShowTalentAllowedCategory table for talent/show category preferences
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."ShowTalentAllowedCategory" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "showId" TEXT,
            "talentId" TEXT,
            "categoryId" TEXT NOT NULL,
            "isAllowed" BOOLEAN DEFAULT true,
            "reason" TEXT,
            "organizationId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdBy" TEXT,
            "updatedBy" TEXT,
            CONSTRAINT "ShowTalentAllowedCategory_showId_fkey" FOREIGN KEY ("showId") REFERENCES %I."Show"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "ShowTalentAllowedCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES %I."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "ShowTalentAllowedCategory_check" CHECK (("showId" IS NOT NULL) OR ("talentId" IS NOT NULL))
        )', schema_name, schema_name, schema_name);

    -- Create TalentVoicingHistory table for tracking past voicing work
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."TalentVoicingHistory" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "talentId" TEXT NOT NULL,
            "advertiserId" TEXT NOT NULL,
            "campaignId" TEXT,
            "showId" TEXT,
            "startDate" DATE NOT NULL,
            "endDate" DATE,
            "spotType" TEXT CHECK ("spotType" IN (''host_read'', ''endorsement'', ''pre_produced'')),
            "notes" TEXT,
            "organizationId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdBy" TEXT,
            "updatedBy" TEXT,
            CONSTRAINT "TalentVoicingHistory_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES %I."Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "TalentVoicingHistory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES %I."Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT "TalentVoicingHistory_showId_fkey" FOREIGN KEY ("showId") REFERENCES %I."Show"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )', schema_name, schema_name, schema_name, schema_name);

    -- Add rate card delta tracking columns to CampaignSchedule if not exists
    BEGIN
        EXECUTE format('
            ALTER TABLE %I."CampaignSchedule" ADD COLUMN IF NOT EXISTS "rateCardDelta" DECIMAL(10,2) DEFAULT 0
        ', schema_name);
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        EXECUTE format('
            ALTER TABLE %I."CampaignSchedule" ADD COLUMN IF NOT EXISTS "rateCardPercentage" DECIMAL(5,2) DEFAULT 100
        ', schema_name);
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        EXECUTE format('
            ALTER TABLE %I."CampaignSchedule" ADD COLUMN IF NOT EXISTS "rateCardNotes" TEXT
        ', schema_name);
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    -- Add competitive conflict tracking to Campaign if not exists
    BEGIN
        EXECUTE format('
            ALTER TABLE %I."Campaign" ADD COLUMN IF NOT EXISTS "competitiveConflicts" JSONB DEFAULT ''[]''::jsonb
        ', schema_name);
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        EXECUTE format('
            ALTER TABLE %I."Campaign" ADD COLUMN IF NOT EXISTS "conflictOverride" BOOLEAN DEFAULT false
        ', schema_name);
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        EXECUTE format('
            ALTER TABLE %I."Campaign" ADD COLUMN IF NOT EXISTS "conflictOverrideReason" TEXT
        ', schema_name);
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    -- Create indexes for performance
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS "Category_organizationId_idx" ON %I."Category"("organizationId");
        CREATE INDEX IF NOT EXISTS "Category_parentId_idx" ON %I."Category"("parentId");
        CREATE INDEX IF NOT EXISTS "CompetitiveGroup_organizationId_idx" ON %I."CompetitiveGroup"("organizationId");
        CREATE INDEX IF NOT EXISTS "AdvertiserCategory_advertiserId_idx" ON %I."AdvertiserCategory"("advertiserId");
        CREATE INDEX IF NOT EXISTS "AdvertiserCategory_categoryId_idx" ON %I."AdvertiserCategory"("categoryId");
        CREATE INDEX IF NOT EXISTS "AdvertiserCategory_competitiveGroupId_idx" ON %I."AdvertiserCategory"("competitiveGroupId");
        CREATE INDEX IF NOT EXISTS "TalentApprovalRequest_campaignId_idx" ON %I."TalentApprovalRequest"("campaignId");
        CREATE INDEX IF NOT EXISTS "TalentApprovalRequest_showId_idx" ON %I."TalentApprovalRequest"("showId");
        CREATE INDEX IF NOT EXISTS "TalentApprovalRequest_talentId_idx" ON %I."TalentApprovalRequest"("talentId");
        CREATE INDEX IF NOT EXISTS "TalentApprovalRequest_status_idx" ON %I."TalentApprovalRequest"("status");
        CREATE INDEX IF NOT EXISTS "ShowTalentAllowedCategory_showId_idx" ON %I."ShowTalentAllowedCategory"("showId");
        CREATE INDEX IF NOT EXISTS "ShowTalentAllowedCategory_talentId_idx" ON %I."ShowTalentAllowedCategory"("talentId");
        CREATE INDEX IF NOT EXISTS "ShowTalentAllowedCategory_categoryId_idx" ON %I."ShowTalentAllowedCategory"("categoryId");
        CREATE INDEX IF NOT EXISTS "TalentVoicingHistory_talentId_idx" ON %I."TalentVoicingHistory"("talentId");
        CREATE INDEX IF NOT EXISTS "TalentVoicingHistory_advertiserId_idx" ON %I."TalentVoicingHistory"("advertiserId");
    ', schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name, schema_name);

END;
$$ LANGUAGE plpgsql;

-- Apply migration to existing organization schemas
DO $$
DECLARE
    org_schema TEXT;
BEGIN
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        RAISE NOTICE 'Applying talent approval migration to schema: %', org_schema;
        PERFORM apply_talent_approval_migration(org_schema);
    END LOOP;
END $$;

-- Clean up the function
DROP FUNCTION IF EXISTS apply_talent_approval_migration(text);