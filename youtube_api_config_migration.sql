-- Add missing columns to YouTubeApiConfig table for YouTube API integration

-- Add API key column (encrypted)
ALTER TABLE "YouTubeApiConfig" 
ADD COLUMN IF NOT EXISTS "apiKey" TEXT;

-- Add OAuth client configuration columns
ALTER TABLE "YouTubeApiConfig" 
ADD COLUMN IF NOT EXISTS "clientId" TEXT;

ALTER TABLE "YouTubeApiConfig" 
ADD COLUMN IF NOT EXISTS "clientSecret" TEXT;

ALTER TABLE "YouTubeApiConfig" 
ADD COLUMN IF NOT EXISTS "redirectUri" TEXT;

-- Add quota management columns
ALTER TABLE "YouTubeApiConfig" 
ADD COLUMN IF NOT EXISTS "quotaLimit" INTEGER DEFAULT 10000;

ALTER TABLE "YouTubeApiConfig" 
ADD COLUMN IF NOT EXISTS "quotaUsed" INTEGER DEFAULT 0;

ALTER TABLE "YouTubeApiConfig" 
ADD COLUMN IF NOT EXISTS "quotaResetAt" TIMESTAMP(3);

-- Add activity flag (rename active to isActive for consistency)
ALTER TABLE "YouTubeApiConfig" 
RENAME COLUMN "active" TO "isActive";

-- Create unique index on organizationId
CREATE UNIQUE INDEX IF NOT EXISTS "YouTubeApiConfig_organizationId_key" 
ON "YouTubeApiConfig"("organizationId");

-- Add comment to table
COMMENT ON TABLE "YouTubeApiConfig" IS 'Stores YouTube API configuration including API keys and OAuth credentials';