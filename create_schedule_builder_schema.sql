-- Schedule Builder Enhanced Schema
-- This migration adds the necessary tables for the comprehensive schedule builder feature

-- =====================================================
-- FUNCTION TO ADD SCHEDULE BUILDER TABLES TO EACH ORG
-- =====================================================

CREATE OR REPLACE FUNCTION add_schedule_builder_to_org_schema(org_slug TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
BEGIN
    -- Sanitize slug for schema name
    schema_name := 'org_' || replace(lower(org_slug), '-', '_');
    
    -- Set search path
    EXECUTE format('SET search_path TO %I, public', schema_name);
    
    -- =====================================================
    -- SHOW CONFIGURATIONS & SETTINGS
    -- =====================================================
    
    -- Show Configuration table (for multiple episode types per show)
    CREATE TABLE IF NOT EXISTS "ShowConfiguration" (
        "id" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "name" TEXT NOT NULL, -- e.g., "15-minute episode", "2-hour special"
        "episodeLength" INTEGER NOT NULL, -- in minutes
        "adLoadType" TEXT NOT NULL DEFAULT 'standard', -- standard, premium, custom
        "preRollSlots" INTEGER DEFAULT 1,
        "midRollSlots" INTEGER DEFAULT 2,
        "postRollSlots" INTEGER DEFAULT 1,
        "preRollDuration" INTEGER DEFAULT 30, -- seconds
        "midRollDuration" INTEGER DEFAULT 60,
        "postRollDuration" INTEGER DEFAULT 30,
        "releaseDays" TEXT[], -- ['monday', 'wednesday', 'friday']
        "releaseTime" TIME, -- typical release time
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ShowConfiguration_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ShowConfiguration_showId_fkey" FOREIGN KEY ("showId") 
            REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    -- Rate Card table (episode configuration specific)
    CREATE TABLE IF NOT EXISTS "RateCard" (
        "id" TEXT NOT NULL,
        "showConfigurationId" TEXT NOT NULL,
        "effectiveDate" DATE NOT NULL,
        "expiryDate" DATE,
        "preRollBaseRate" DOUBLE PRECISION NOT NULL,
        "midRollBaseRate" DOUBLE PRECISION NOT NULL,
        "postRollBaseRate" DOUBLE PRECISION NOT NULL,
        "volumeDiscounts" JSONB DEFAULT '[]', -- [{minSlots: 10, discount: 0.1}, ...]
        "seasonalMultipliers" JSONB DEFAULT '{}', -- {q1: 1.2, q2: 1.0, ...}
        "dayOfWeekMultipliers" JSONB DEFAULT '{}', -- {monday: 1.0, tuesday: 0.9, ...}
        "notes" TEXT,
        "createdBy" TEXT NOT NULL,
        "approvedBy" TEXT,
        "approvedAt" TIMESTAMP(3),
        "status" TEXT DEFAULT 'draft', -- draft, active, expired
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "RateCard_showConfigurationId_fkey" FOREIGN KEY ("showConfigurationId") 
            REFERENCES "ShowConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    -- Show Restrictions table
    CREATE TABLE IF NOT EXISTS "ShowRestriction" (
        "id" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "restrictionType" TEXT NOT NULL, -- 'category_exclusive', 'category_blocked', 'advertiser_blocked'
        "category" TEXT, -- e.g., 'automotive', 'finance'
        "advertiserId" TEXT,
        "startDate" DATE,
        "endDate" DATE,
        "notes" TEXT,
        "createdBy" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ShowRestriction_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ShowRestriction_showId_fkey" FOREIGN KEY ("showId") 
            REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    -- =====================================================
    -- SCHEDULE & INVENTORY MANAGEMENT
    -- =====================================================

    -- Schedule table (main schedule entity)
    CREATE TABLE IF NOT EXISTS "Schedule" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "campaignId" TEXT,
        "advertiserId" TEXT NOT NULL,
        "agencyId" TEXT,
        "organizationId" TEXT NOT NULL,
        "status" TEXT DEFAULT 'draft', -- draft, pending_approval, approved, active, completed
        "startDate" DATE NOT NULL,
        "endDate" DATE NOT NULL,
        "totalBudget" DOUBLE PRECISION,
        "totalSpots" INTEGER DEFAULT 0,
        "totalImpressions" INTEGER DEFAULT 0,
        "rateCardValue" DOUBLE PRECISION DEFAULT 0,
        "discountAmount" DOUBLE PRECISION DEFAULT 0,
        "valueAddAmount" DOUBLE PRECISION DEFAULT 0,
        "netAmount" DOUBLE PRECISION DEFAULT 0,
        "notes" TEXT,
        "internalNotes" TEXT,
        "createdBy" TEXT NOT NULL,
        "updatedBy" TEXT,
        "approvedBy" TEXT,
        "approvedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
    );

    -- Schedule Item table (individual placements)
    CREATE TABLE IF NOT EXISTS "ScheduleItem" (
        "id" TEXT NOT NULL,
        "scheduleId" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "showConfigurationId" TEXT NOT NULL,
        "episodeId" TEXT,
        "airDate" DATE NOT NULL,
        "placementType" TEXT NOT NULL, -- pre-roll, mid-roll, post-roll
        "slotNumber" INTEGER DEFAULT 1, -- which slot (1st mid-roll, 2nd mid-roll, etc)
        "rateCardPrice" DOUBLE PRECISION NOT NULL,
        "negotiatedPrice" DOUBLE PRECISION NOT NULL,
        "impressions" INTEGER,
        "status" TEXT DEFAULT 'scheduled', -- scheduled, confirmed, delivered, cancelled
        "conflictStatus" TEXT, -- null, 'category_conflict', 'exclusive_conflict'
        "conflictDetails" JSONB,
        "creativeId" TEXT,
        "notes" TEXT,
        "addedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "addedBy" TEXT NOT NULL,
        "lastModifiedAt" TIMESTAMP(3),
        "lastModifiedBy" TEXT,
        CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") 
            REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "ScheduleItem_showId_fkey" FOREIGN KEY ("showId") 
            REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "ScheduleItem_showConfigurationId_fkey" FOREIGN KEY ("showConfigurationId") 
            REFERENCES "ShowConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    -- Inventory Tracking Enhancement
    CREATE TABLE IF NOT EXISTS "InventoryReservation" (
        "id" TEXT NOT NULL,
        "episodeId" TEXT NOT NULL,
        "placementType" TEXT NOT NULL,
        "slotNumber" INTEGER NOT NULL,
        "scheduleId" TEXT,
        "scheduleItemId" TEXT,
        "status" TEXT NOT NULL, -- 'reserved', 'confirmed', 'released'
        "reservedBy" TEXT NOT NULL,
        "reservedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3), -- for temporary holds
        "confirmedAt" TIMESTAMP(3),
        "releasedAt" TIMESTAMP(3),
        CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InventoryReservation_scheduleId_fkey" FOREIGN KEY ("scheduleId") 
            REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "InventoryReservation_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") 
            REFERENCES "ScheduleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        UNIQUE("episodeId", "placementType", "slotNumber", "status")
    );

    -- =====================================================
    -- COMPETITIVE SEPARATION & BLOCKING
    -- =====================================================

    -- Campaign Categories (for competitive blocking)
    CREATE TABLE IF NOT EXISTS "CampaignCategory" (
        "id" TEXT NOT NULL,
        "campaignId" TEXT NOT NULL,
        "category" TEXT NOT NULL, -- 'automotive', 'finance', etc.
        "isPrimary" BOOLEAN DEFAULT false,
        "exclusivityLevel" TEXT DEFAULT 'none', -- 'none', 'episode', 'show', 'network'
        "exclusivityStartDate" DATE,
        "exclusivityEndDate" DATE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CampaignCategory_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CampaignCategory_campaignId_fkey" FOREIGN KEY ("campaignId") 
            REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE("campaignId", "category")
    );

    -- =====================================================
    -- TEMPLATES & SAVED SCHEDULES
    -- =====================================================

    -- Schedule Template table
    CREATE TABLE IF NOT EXISTS "ScheduleTemplate" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "organizationId" TEXT NOT NULL,
        "isPublic" BOOLEAN DEFAULT false,
        "showCriteria" JSONB, -- {categories: ['news'], minEpisodes: 10, ...}
        "budgetRange" JSONB, -- {min: 10000, max: 50000}
        "defaultPattern" TEXT, -- 'weekly', 'biweekly', 'monthly', 'custom'
        "defaultPlacements" JSONB, -- {preRoll: true, midRoll: 2, postRoll: false}
        "settings" JSONB DEFAULT '{}',
        "usageCount" INTEGER DEFAULT 0,
        "createdBy" TEXT NOT NULL,
        "lastUsedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
    );

    -- =====================================================
    -- APPROVAL WORKFLOW
    -- =====================================================

    -- Schedule Approval table
    CREATE TABLE IF NOT EXISTS "ScheduleApproval" (
        "id" TEXT NOT NULL,
        "scheduleId" TEXT NOT NULL,
        "requestedBy" TEXT NOT NULL,
        "requestedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "approvalType" TEXT NOT NULL, -- 'rate_exception', 'value_add', 'standard'
        "rateCardPercent" DOUBLE PRECISION, -- e.g., 85 means 85% of rate card
        "valueAddDetails" JSONB,
        "justification" TEXT,
        "status" TEXT DEFAULT 'pending', -- pending, approved, rejected
        "reviewedBy" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "reviewNotes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ScheduleApproval_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ScheduleApproval_scheduleId_fkey" FOREIGN KEY ("scheduleId") 
            REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    -- =====================================================
    -- INDEXES FOR PERFORMANCE
    -- =====================================================

    CREATE INDEX IF NOT EXISTS "ShowConfiguration_showId_idx" ON "ShowConfiguration"("showId");
    CREATE INDEX IF NOT EXISTS "ShowConfiguration_isActive_idx" ON "ShowConfiguration"("isActive");
    
    CREATE INDEX IF NOT EXISTS "RateCard_showConfigurationId_idx" ON "RateCard"("showConfigurationId");
    CREATE INDEX IF NOT EXISTS "RateCard_effectiveDate_idx" ON "RateCard"("effectiveDate");
    CREATE INDEX IF NOT EXISTS "RateCard_status_idx" ON "RateCard"("status");
    
    CREATE INDEX IF NOT EXISTS "ShowRestriction_showId_idx" ON "ShowRestriction"("showId");
    CREATE INDEX IF NOT EXISTS "ShowRestriction_category_idx" ON "ShowRestriction"("category");
    CREATE INDEX IF NOT EXISTS "ShowRestriction_advertiserId_idx" ON "ShowRestriction"("advertiserId");
    
    CREATE INDEX IF NOT EXISTS "Schedule_campaignId_idx" ON "Schedule"("campaignId");
    CREATE INDEX IF NOT EXISTS "Schedule_advertiserId_idx" ON "Schedule"("advertiserId");
    CREATE INDEX IF NOT EXISTS "Schedule_status_idx" ON "Schedule"("status");
    CREATE INDEX IF NOT EXISTS "Schedule_startDate_endDate_idx" ON "Schedule"("startDate", "endDate");
    
    CREATE INDEX IF NOT EXISTS "ScheduleItem_scheduleId_idx" ON "ScheduleItem"("scheduleId");
    CREATE INDEX IF NOT EXISTS "ScheduleItem_showId_idx" ON "ScheduleItem"("showId");
    CREATE INDEX IF NOT EXISTS "ScheduleItem_episodeId_idx" ON "ScheduleItem"("episodeId");
    CREATE INDEX IF NOT EXISTS "ScheduleItem_airDate_idx" ON "ScheduleItem"("airDate");
    CREATE INDEX IF NOT EXISTS "ScheduleItem_status_idx" ON "ScheduleItem"("status");
    CREATE INDEX IF NOT EXISTS "ScheduleItem_conflictStatus_idx" ON "ScheduleItem"("conflictStatus");
    
    CREATE INDEX IF NOT EXISTS "InventoryReservation_episodeId_idx" ON "InventoryReservation"("episodeId");
    CREATE INDEX IF NOT EXISTS "InventoryReservation_scheduleId_idx" ON "InventoryReservation"("scheduleId");
    CREATE INDEX IF NOT EXISTS "InventoryReservation_status_idx" ON "InventoryReservation"("status");
    
    CREATE INDEX IF NOT EXISTS "CampaignCategory_campaignId_idx" ON "CampaignCategory"("campaignId");
    CREATE INDEX IF NOT EXISTS "CampaignCategory_category_idx" ON "CampaignCategory"("category");
    
    CREATE INDEX IF NOT EXISTS "ScheduleTemplate_organizationId_idx" ON "ScheduleTemplate"("organizationId");
    CREATE INDEX IF NOT EXISTS "ScheduleTemplate_isPublic_idx" ON "ScheduleTemplate"("isPublic");
    
    CREATE INDEX IF NOT EXISTS "ScheduleApproval_scheduleId_idx" ON "ScheduleApproval"("scheduleId");
    CREATE INDEX IF NOT EXISTS "ScheduleApproval_status_idx" ON "ScheduleApproval"("status");

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- APPLY TO EXISTING ORGANIZATIONS
-- =====================================================

-- Apply to PodcastFlow Pro organization
SELECT add_schedule_builder_to_org_schema('podcastflow-pro');

-- Apply to Unfy organization
SELECT add_schedule_builder_to_org_schema('unfy');

-- =====================================================
-- UPDATE create_org_tables_from_public TO INCLUDE NEW TABLES
-- =====================================================

-- First drop the existing function
DROP FUNCTION IF EXISTS create_org_tables_from_public CASCADE;

-- Recreate with schedule builder tables included
CREATE OR REPLACE FUNCTION create_org_tables_from_public(org_slug TEXT, org_id TEXT)
RETURNS void AS $$
BEGIN
    -- First create all the existing tables
    PERFORM create_complete_org_schema(org_slug, org_id);
    
    -- Then add schedule builder tables
    PERFORM add_schedule_builder_to_org_schema(org_slug);
END;
$$ LANGUAGE plpgsql;

-- Add sample data for testing (PodcastFlow Pro org)
SET search_path TO org_podcastflow_pro, public;

-- Add show configurations for existing shows
INSERT INTO "ShowConfiguration" ("id", "showId", "name", "episodeLength", "adLoadType", "preRollSlots", "midRollSlots", "postRollSlots", "releaseDays", "releaseTime", "isActive", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    s."id",
    'Standard Episode',
    60, -- 60 minute episodes
    'standard',
    1,
    3,
    1,
    CASE 
        WHEN s."releaseFrequency" = 'daily' THEN ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        WHEN s."releaseFrequency" = 'weekly' THEN ARRAY[lower(COALESCE(s."releaseDay", 'monday'))]
        ELSE ARRAY['monday', 'wednesday', 'friday']
    END,
    '08:00:00'::time,
    true,
    NOW(),
    NOW()
FROM "Show" s
WHERE NOT EXISTS (
    SELECT 1 FROM "ShowConfiguration" sc WHERE sc."showId" = s."id"
);

-- Add rate cards for the configurations
INSERT INTO "RateCard" ("id", "showConfigurationId", "effectiveDate", "preRollBaseRate", "midRollBaseRate", "postRollBaseRate", "volumeDiscounts", "seasonalMultipliers", "dayOfWeekMultipliers", "status", "createdBy", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    sc."id",
    CURRENT_DATE,
    500.00, -- $500 pre-roll base
    750.00, -- $750 mid-roll base
    400.00, -- $400 post-roll base
    '[{"minSlots": 10, "discount": 0.05}, {"minSlots": 25, "discount": 0.10}, {"minSlots": 50, "discount": 0.15}]'::jsonb,
    '{"q1": 1.2, "q2": 1.0, "q3": 0.9, "q4": 1.3}'::jsonb,
    '{"monday": 1.1, "tuesday": 1.0, "wednesday": 1.0, "thursday": 1.0, "friday": 1.1, "saturday": 0.8, "sunday": 0.8}'::jsonb,
    'active',
    'system',
    NOW(),
    NOW()
FROM "ShowConfiguration" sc
WHERE NOT EXISTS (
    SELECT 1 FROM "RateCard" rc WHERE rc."showConfigurationId" = sc."id" AND rc."status" = 'active'
);

-- Reset search path
SET search_path TO public;

COMMIT;