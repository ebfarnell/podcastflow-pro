-- Ad Creative Management System Migration
-- Creates tables for reusable ad creatives and usage tracking

-- Create AdCreative table
CREATE TABLE "AdCreative" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    
    -- Creative details
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    
    -- Content
    "script" TEXT,
    "talkingPoints" TEXT[],
    "audioUrl" TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "s3Key" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    
    -- Categorization
    "advertiserId" TEXT,
    "campaignId" TEXT,
    "tags" TEXT[],
    "category" TEXT,
    
    -- Performance metrics
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    
    -- Restrictions
    "restrictedTerms" TEXT[],
    "legalDisclaimer" TEXT,
    "expiryDate" TIMESTAMP(3),
    
    -- Metadata
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCreative_pkey" PRIMARY KEY ("id")
);

-- Create CreativeUsage table
CREATE TABLE "CreativeUsage" (
    "id" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    
    -- Where it was used
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT,
    
    -- Usage details
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    
    -- Metadata
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeUsage_pkey" PRIMARY KEY ("id")
);

-- Create indexes for AdCreative
CREATE INDEX "AdCreative_organizationId_idx" ON "AdCreative"("organizationId");
CREATE INDEX "AdCreative_advertiserId_idx" ON "AdCreative"("advertiserId");
CREATE INDEX "AdCreative_campaignId_idx" ON "AdCreative"("campaignId");
CREATE INDEX "AdCreative_status_idx" ON "AdCreative"("status");
CREATE INDEX "AdCreative_type_idx" ON "AdCreative"("type");
CREATE INDEX "AdCreative_createdAt_idx" ON "AdCreative"("createdAt");

-- Create indexes for CreativeUsage
CREATE INDEX "CreativeUsage_creativeId_idx" ON "CreativeUsage"("creativeId");
CREATE INDEX "CreativeUsage_entityType_entityId_idx" ON "CreativeUsage"("entityType", "entityId");
CREATE INDEX "CreativeUsage_startDate_idx" ON "CreativeUsage"("startDate");

-- Add foreign key constraints
ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_advertiserId_fkey" 
    FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_campaignId_fkey" 
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_createdBy_fkey" 
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_updatedBy_fkey" 
    FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreativeUsage" ADD CONSTRAINT "CreativeUsage_creativeId_fkey" 
    FOREIGN KEY ("creativeId") REFERENCES "AdCreative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;