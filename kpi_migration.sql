-- KPI Management System Database Migration
-- This creates the tables needed for campaign KPI tracking and client self-service updates

-- CampaignKPI table for storing KPI configuration and performance
CREATE TABLE "CampaignKPI" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kpiType" TEXT NOT NULL,
    "goalCPA" DOUBLE PRECISION,
    "conversionValue" DOUBLE PRECISION,
    "targetVisits" INTEGER,
    "targetConversions" INTEGER,
    "actualVisits" INTEGER NOT NULL DEFAULT 0,
    "actualConversions" INTEGER NOT NULL DEFAULT 0,
    "actualCPA" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    "clientCanUpdate" BOOLEAN NOT NULL DEFAULT true,
    "lastClientUpdate" TIMESTAMP(3),
    "nextReminderDate" TIMESTAMP(3),
    "reminderFrequency" TEXT DEFAULT 'monthly',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignKPI_pkey" PRIMARY KEY ("id")
);

-- KPIUpdateToken table for secure client access
CREATE TABLE "KPIUpdateToken" (
    "id" TEXT NOT NULL,
    "campaignKPIId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "emailOpened" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "KPIUpdateToken_pkey" PRIMARY KEY ("id")
);

-- KPIHistory table for tracking changes
CREATE TABLE "KPIHistory" (
    "id" TEXT NOT NULL,
    "campaignKPIId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "changedFields" JSONB NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB NOT NULL,
    "updatedBy" TEXT,
    "clientEmail" TEXT,
    "updateSource" TEXT NOT NULL,
    "comment" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KPIHistory_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "CampaignKPI_campaignId_key" ON "CampaignKPI"("campaignId");
CREATE UNIQUE INDEX "KPIUpdateToken_token_key" ON "KPIUpdateToken"("token");

-- Indexes for performance
CREATE INDEX "CampaignKPI_organizationId_idx" ON "CampaignKPI"("organizationId");
CREATE INDEX "CampaignKPI_kpiType_idx" ON "CampaignKPI"("kpiType");
CREATE INDEX "CampaignKPI_isActive_idx" ON "CampaignKPI"("isActive");
CREATE INDEX "CampaignKPI_nextReminderDate_idx" ON "CampaignKPI"("nextReminderDate");

CREATE INDEX "KPIUpdateToken_token_idx" ON "KPIUpdateToken"("token");
CREATE INDEX "KPIUpdateToken_clientEmail_idx" ON "KPIUpdateToken"("clientEmail");
CREATE INDEX "KPIUpdateToken_isActive_idx" ON "KPIUpdateToken"("isActive");
CREATE INDEX "KPIUpdateToken_expiresAt_idx" ON "KPIUpdateToken"("expiresAt");

CREATE INDEX "KPIHistory_campaignKPIId_idx" ON "KPIHistory"("campaignKPIId");
CREATE INDEX "KPIHistory_changeType_idx" ON "KPIHistory"("changeType");
CREATE INDEX "KPIHistory_updateSource_idx" ON "KPIHistory"("updateSource");
CREATE INDEX "KPIHistory_createdAt_idx" ON "KPIHistory"("createdAt");

-- Foreign key constraints
ALTER TABLE "CampaignKPI" ADD CONSTRAINT "CampaignKPI_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignKPI" ADD CONSTRAINT "CampaignKPI_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignKPI" ADD CONSTRAINT "CampaignKPI_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KPIUpdateToken" ADD CONSTRAINT "KPIUpdateToken_campaignKPIId_fkey" FOREIGN KEY ("campaignKPIId") REFERENCES "CampaignKPI"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KPIUpdateToken" ADD CONSTRAINT "KPIUpdateToken_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KPIHistory" ADD CONSTRAINT "KPIHistory_campaignKPIId_fkey" FOREIGN KEY ("campaignKPIId") REFERENCES "CampaignKPI"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KPIHistory" ADD CONSTRAINT "KPIHistory_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;