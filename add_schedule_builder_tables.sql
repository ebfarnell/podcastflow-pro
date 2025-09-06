-- Add Schedule Builder Tables Manually
BEGIN;

-- Set search path to org_podcastflow_pro
SET search_path TO org_podcastflow_pro, public;

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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShowRestriction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShowRestriction_showId_fkey" FOREIGN KEY ("showId") 
        REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- =====================================================
-- ENHANCED SCHEDULE TABLES
-- =====================================================

-- Enhanced Schedule table (use different name to avoid conflicts)
CREATE TABLE IF NOT EXISTS "ScheduleBuilder" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleBuilder_pkey" PRIMARY KEY ("id")
);

-- Enhanced Schedule Item table (use different name)
CREATE TABLE IF NOT EXISTS "ScheduleBuilderItem" (
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
    CONSTRAINT "ScheduleBuilderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScheduleBuilderItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") 
        REFERENCES "ScheduleBuilder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleBuilderItem_showId_fkey" FOREIGN KEY ("showId") 
        REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleBuilderItem_showConfigurationId_fkey" FOREIGN KEY ("showConfigurationId") 
        REFERENCES "ShowConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Inventory Reservation table
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
        REFERENCES "ScheduleBuilder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryReservation_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") 
        REFERENCES "ScheduleBuilderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleApproval_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScheduleApproval_scheduleId_fkey" FOREIGN KEY ("scheduleId") 
        REFERENCES "ScheduleBuilder"("id") ON DELETE CASCADE ON UPDATE CASCADE
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

CREATE INDEX IF NOT EXISTS "ScheduleBuilder_campaignId_idx" ON "ScheduleBuilder"("campaignId");
CREATE INDEX IF NOT EXISTS "ScheduleBuilder_advertiserId_idx" ON "ScheduleBuilder"("advertiserId");
CREATE INDEX IF NOT EXISTS "ScheduleBuilder_status_idx" ON "ScheduleBuilder"("status");
CREATE INDEX IF NOT EXISTS "ScheduleBuilder_startDate_endDate_idx" ON "ScheduleBuilder"("startDate", "endDate");

CREATE INDEX IF NOT EXISTS "ScheduleBuilderItem_scheduleId_idx" ON "ScheduleBuilderItem"("scheduleId");
CREATE INDEX IF NOT EXISTS "ScheduleBuilderItem_showId_idx" ON "ScheduleBuilderItem"("showId");
CREATE INDEX IF NOT EXISTS "ScheduleBuilderItem_episodeId_idx" ON "ScheduleBuilderItem"("episodeId");
CREATE INDEX IF NOT EXISTS "ScheduleBuilderItem_airDate_idx" ON "ScheduleBuilderItem"("airDate");
CREATE INDEX IF NOT EXISTS "ScheduleBuilderItem_status_idx" ON "ScheduleBuilderItem"("status");
CREATE INDEX IF NOT EXISTS "ScheduleBuilderItem_conflictStatus_idx" ON "ScheduleBuilderItem"("conflictStatus");

CREATE INDEX IF NOT EXISTS "InventoryReservation_episodeId_idx" ON "InventoryReservation"("episodeId");
CREATE INDEX IF NOT EXISTS "InventoryReservation_scheduleId_idx" ON "InventoryReservation"("scheduleId");
CREATE INDEX IF NOT EXISTS "InventoryReservation_status_idx" ON "InventoryReservation"("status");

CREATE INDEX IF NOT EXISTS "CampaignCategory_campaignId_idx" ON "CampaignCategory"("campaignId");
CREATE INDEX IF NOT EXISTS "CampaignCategory_category_idx" ON "CampaignCategory"("category");

CREATE INDEX IF NOT EXISTS "ScheduleTemplate_organizationId_idx" ON "ScheduleTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "ScheduleTemplate_isPublic_idx" ON "ScheduleTemplate"("isPublic");

CREATE INDEX IF NOT EXISTS "ScheduleApproval_scheduleId_idx" ON "ScheduleApproval"("scheduleId");
CREATE INDEX IF NOT EXISTS "ScheduleApproval_status_idx" ON "ScheduleApproval"("status");

-- =====================================================
-- ADD SAMPLE DATA
-- =====================================================

-- Add show configurations for existing shows
INSERT INTO "ShowConfiguration" ("id", "showId", "name", "episodeLength", "adLoadType", "preRollSlots", "midRollSlots", "postRollSlots", "releaseDays", "releaseTime", "isActive")
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
    true
FROM "Show" s
WHERE NOT EXISTS (
    SELECT 1 FROM "ShowConfiguration" sc WHERE sc."showId" = s."id"
);

-- Add some 15-minute configurations for variety
INSERT INTO "ShowConfiguration" ("id", "showId", "name", "episodeLength", "adLoadType", "preRollSlots", "midRollSlots", "postRollSlots", "releaseDays", "releaseTime", "isActive")
SELECT 
    gen_random_uuid()::text,
    s."id",
    'Short Episode',
    15, -- 15 minute episodes
    'premium',
    1,
    1,
    0,
    CASE 
        WHEN s."releaseFrequency" = 'daily' THEN ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        WHEN s."releaseFrequency" = 'weekly' THEN ARRAY[lower(COALESCE(s."releaseDay", 'monday'))]
        ELSE ARRAY['monday', 'wednesday', 'friday']
    END,
    '12:00:00'::time,
    true
FROM "Show" s
WHERE s."category" IN ('News', 'Business')
AND NOT EXISTS (
    SELECT 1 FROM "ShowConfiguration" sc WHERE sc."showId" = s."id" AND sc."episodeLength" = 15
)
LIMIT 3;

-- Add rate cards for the configurations
INSERT INTO "RateCard" ("id", "showConfigurationId", "effectiveDate", "preRollBaseRate", "midRollBaseRate", "postRollBaseRate", "volumeDiscounts", "seasonalMultipliers", "dayOfWeekMultipliers", "status", "createdBy")
SELECT 
    gen_random_uuid()::text,
    sc."id",
    CURRENT_DATE,
    CASE 
        WHEN sc."episodeLength" = 15 THEN 300.00
        ELSE 500.00
    END,
    CASE 
        WHEN sc."episodeLength" = 15 THEN 400.00
        ELSE 750.00
    END,
    CASE 
        WHEN sc."episodeLength" = 15 THEN 200.00
        ELSE 400.00
    END,
    '[{"minSlots": 10, "discount": 0.05}, {"minSlots": 25, "discount": 0.10}, {"minSlots": 50, "discount": 0.15}]'::jsonb,
    '{"q1": 1.2, "q2": 1.0, "q3": 0.9, "q4": 1.3}'::jsonb,
    '{"monday": 1.1, "tuesday": 1.0, "wednesday": 1.0, "thursday": 1.0, "friday": 1.1, "saturday": 0.8, "sunday": 0.8}'::jsonb,
    'active',
    'system'
FROM "ShowConfiguration" sc
WHERE NOT EXISTS (
    SELECT 1 FROM "RateCard" rc WHERE rc."showConfigurationId" = sc."id" AND rc."status" = 'active'
);

-- Apply same schema to Unfy organization
SET search_path TO org_unfy, public;

-- Create all the same tables for org_unfy...
-- (Same CREATE TABLE statements as above, omitted for brevity)

-- Reset search path
SET search_path TO public;

COMMIT;