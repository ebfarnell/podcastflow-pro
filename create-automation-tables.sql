-- Create automation tables for 90% campaign workflow
-- These tables will be created in each organization schema

-- Create CampaignApproval table for tracking approval requests
CREATE TABLE IF NOT EXISTS org_podcastflow_pro."CampaignApproval" (
    id TEXT PRIMARY KEY,
    "campaignId" TEXT NOT NULL REFERENCES org_podcastflow_pro."Campaign"(id) ON DELETE CASCADE,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    "hasRateDiscrepancy" BOOLEAN DEFAULT false,
    "discrepancyDetails" JSONB,
    "discrepancyAmount" DECIMAL(10,2) DEFAULT 0,
    "discrepancyPercentage" DECIMAL(5,2) DEFAULT 0,
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    metadata JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3)
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_campaign_approval_campaign ON org_podcastflow_pro."CampaignApproval"("campaignId");
CREATE INDEX IF NOT EXISTS idx_campaign_approval_status ON org_podcastflow_pro."CampaignApproval"(status);

-- Create ScheduledSpot table for tracking campaign spots
CREATE TABLE IF NOT EXISTS org_podcastflow_pro."ScheduledSpot" (
    id TEXT PRIMARY KEY,
    "campaignId" TEXT NOT NULL REFERENCES org_podcastflow_pro."Campaign"(id) ON DELETE CASCADE,
    "showId" TEXT NOT NULL REFERENCES org_podcastflow_pro."Show"(id),
    "episodeId" TEXT REFERENCES org_podcastflow_pro."Episode"(id),
    "airDate" DATE NOT NULL,
    "placementType" VARCHAR(50) NOT NULL, -- pre-roll, mid-roll, post-roll
    rate DECIMAL(10,2),
    duration INTEGER, -- in seconds
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, aired, cancelled
    metadata JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedBy" TEXT
);

-- Create indexes for scheduled spots
CREATE INDEX IF NOT EXISTS idx_scheduled_spot_campaign ON org_podcastflow_pro."ScheduledSpot"("campaignId");
CREATE INDEX IF NOT EXISTS idx_scheduled_spot_show ON org_podcastflow_pro."ScheduledSpot"("showId");
CREATE INDEX IF NOT EXISTS idx_scheduled_spot_date ON org_podcastflow_pro."ScheduledSpot"("airDate");

-- Create CampaignTimeline table for tracking all campaign events
CREATE TABLE IF NOT EXISTS org_podcastflow_pro."CampaignTimeline" (
    id TEXT PRIMARY KEY,
    "campaignId" TEXT NOT NULL REFERENCES org_podcastflow_pro."Campaign"(id) ON DELETE CASCADE,
    "eventType" VARCHAR(100) NOT NULL, -- probability_changed, approval_requested, approved, rejected, inventory_reserved, etc.
    "eventData" JSONB,
    "actorId" TEXT,
    "actorName" VARCHAR(255),
    "actorRole" VARCHAR(50),
    description TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for timeline lookups
CREATE INDEX IF NOT EXISTS idx_campaign_timeline_campaign ON org_podcastflow_pro."CampaignTimeline"("campaignId");
CREATE INDEX IF NOT EXISTS idx_campaign_timeline_event ON org_podcastflow_pro."CampaignTimeline"("eventType");

-- Create the same tables in org_unfy schema
CREATE TABLE IF NOT EXISTS org_unfy."CampaignApproval" (
    id TEXT PRIMARY KEY,
    "campaignId" TEXT NOT NULL REFERENCES org_unfy."Campaign"(id) ON DELETE CASCADE,
    "requestedBy" UUID NOT NULL,
    "approvedBy" UUID,
    "rejectedBy" UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    "hasRateDiscrepancy" BOOLEAN DEFAULT false,
    "discrepancyDetails" JSONB,
    "discrepancyAmount" DECIMAL(10,2) DEFAULT 0,
    "discrepancyPercentage" DECIMAL(5,2) DEFAULT 0,
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    metadata JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS idx_campaign_approval_campaign ON org_unfy."CampaignApproval"("campaignId");
CREATE INDEX IF NOT EXISTS idx_campaign_approval_status ON org_unfy."CampaignApproval"(status);

CREATE TABLE IF NOT EXISTS org_unfy."ScheduledSpot" (
    id TEXT PRIMARY KEY,
    "campaignId" TEXT NOT NULL REFERENCES org_unfy."Campaign"(id) ON DELETE CASCADE,
    "showId" TEXT NOT NULL REFERENCES org_unfy."Show"(id),
    "episodeId" TEXT REFERENCES org_unfy."Episode"(id),
    "airDate" DATE NOT NULL,
    "placementType" VARCHAR(50) NOT NULL,
    rate DECIMAL(10,2),
    duration INTEGER,
    status VARCHAR(50) DEFAULT 'scheduled',
    metadata JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedBy" TEXT
);

CREATE INDEX IF NOT EXISTS idx_scheduled_spot_campaign ON org_unfy."ScheduledSpot"("campaignId");
CREATE INDEX IF NOT EXISTS idx_scheduled_spot_show ON org_unfy."ScheduledSpot"("showId");
CREATE INDEX IF NOT EXISTS idx_scheduled_spot_date ON org_unfy."ScheduledSpot"("airDate");

CREATE TABLE IF NOT EXISTS org_unfy."CampaignTimeline" (
    id TEXT PRIMARY KEY,
    "campaignId" TEXT NOT NULL REFERENCES org_unfy."Campaign"(id) ON DELETE CASCADE,
    "eventType" VARCHAR(100) NOT NULL,
    "eventData" JSONB,
    "actorId" TEXT,
    "actorName" VARCHAR(255),
    "actorRole" VARCHAR(50),
    description TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaign_timeline_campaign ON org_unfy."CampaignTimeline"("campaignId");
CREATE INDEX IF NOT EXISTS idx_campaign_timeline_event ON org_unfy."CampaignTimeline"("eventType");

-- Add workflow settings column to Organization table if it doesn't exist
ALTER TABLE public."Organization" 
ADD COLUMN IF NOT EXISTS "workflowSettings" JSONB DEFAULT '{
    "autoReserveAt90": true,
    "requireAdminApprovalAt90": true,
    "notifyOnStatusChange": true,
    "autoExpireReservations": 72,
    "allowRateDiscrepancy": true
}'::jsonb;