-- Fix YouTube API Config table to include all necessary columns
-- This will recreate the table with proper structure

-- First, backup any existing data
CREATE TEMP TABLE youtube_config_backup AS 
SELECT * FROM "YouTubeApiConfig";

-- Drop the existing table
DROP TABLE IF EXISTS "YouTubeApiConfig";

-- Create the table with all required columns
CREATE TABLE "YouTubeApiConfig" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    
    -- API Key configuration
    "apiKey" TEXT,  -- Encrypted API key
    
    -- OAuth configuration
    "clientId" TEXT,
    "clientSecret" TEXT,  -- Encrypted
    "redirectUri" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    
    -- Channel information
    "channelId" TEXT,
    "channelName" TEXT,
    
    -- Quota management
    "quotaLimit" INTEGER DEFAULT 10000,
    "quotaUsed" INTEGER DEFAULT 0,
    "quotaResetAt" TIMESTAMP(3),
    
    -- Status
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "YouTubeApiConfig_pkey" PRIMARY KEY ("id")
);

-- Create unique index on organizationId (each org has one config)
CREATE UNIQUE INDEX "YouTubeApiConfig_organizationId_key" ON "YouTubeApiConfig"("organizationId");

-- Add foreign key constraint to Organization table
ALTER TABLE "YouTubeApiConfig" 
ADD CONSTRAINT "YouTubeApiConfig_organizationId_fkey" 
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restore any existing data
INSERT INTO "YouTubeApiConfig" (
    "id", 
    "organizationId", 
    "accessToken", 
    "refreshToken", 
    "tokenExpiry", 
    "channelId", 
    "channelName", 
    "isActive", 
    "createdAt", 
    "updatedAt"
)
SELECT 
    "id", 
    "organizationId", 
    "accessToken", 
    "refreshToken", 
    "tokenExpiry", 
    "channelId", 
    "channelName", 
    "active", 
    "createdAt", 
    "updatedAt"
FROM youtube_config_backup;

-- Grant permissions to podcastflow user
GRANT ALL PRIVILEGES ON TABLE "YouTubeApiConfig" TO podcastflow;

-- Add helpful comment
COMMENT ON TABLE "YouTubeApiConfig" IS 'Stores YouTube API configuration per organization including API keys and OAuth credentials';
COMMENT ON COLUMN "YouTubeApiConfig"."apiKey" IS 'Encrypted YouTube Data API v3 key';
COMMENT ON COLUMN "YouTubeApiConfig"."clientSecret" IS 'Encrypted OAuth 2.0 client secret';
COMMENT ON COLUMN "YouTubeApiConfig"."quotaLimit" IS 'Daily quota limit (default 10,000)';
COMMENT ON COLUMN "YouTubeApiConfig"."quotaUsed" IS 'Current quota usage for the day';
COMMENT ON COLUMN "YouTubeApiConfig"."quotaResetAt" IS 'When the quota resets (usually midnight Pacific Time)';