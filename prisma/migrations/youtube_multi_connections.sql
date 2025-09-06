-- Create YouTubeConnection table to support multiple OAuth connections per organization
CREATE TABLE IF NOT EXISTS "YouTubeConnection" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "connectionName" TEXT NOT NULL,
    "accountEmail" TEXT,
    "channelId" TEXT,
    "channelTitle" TEXT,
    "channelDescription" TEXT,
    "channelThumbnail" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "isActive" BOOLEAN DEFAULT true,
    "isPrimary" BOOLEAN DEFAULT false,
    "connectedBy" TEXT NOT NULL,
    "lastSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YouTubeConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "YouTubeConnection_connectedBy_fkey" FOREIGN KEY ("connectedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "YouTubeConnection_organizationId_idx" ON "YouTubeConnection"("organizationId");
CREATE INDEX IF NOT EXISTS "YouTubeConnection_channelId_idx" ON "YouTubeConnection"("channelId");
CREATE INDEX IF NOT EXISTS "YouTubeConnection_isActive_idx" ON "YouTubeConnection"("isActive");

-- Create junction table to link shows to specific YouTube connections
CREATE TABLE IF NOT EXISTS "ShowYouTubeConnection" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "showId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "playlistId" TEXT,
    "isDefault" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShowYouTubeConnection_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "YouTubeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE("showId", "connectionId")
);

-- Add indexes for junction table
CREATE INDEX IF NOT EXISTS "ShowYouTubeConnection_showId_idx" ON "ShowYouTubeConnection"("showId");
CREATE INDEX IF NOT EXISTS "ShowYouTubeConnection_connectionId_idx" ON "ShowYouTubeConnection"("connectionId");

-- Add columns to YouTubeApiConfig for OAuth support
ALTER TABLE "YouTubeApiConfig" 
ADD COLUMN IF NOT EXISTS "oauthClientId" TEXT,
ADD COLUMN IF NOT EXISTS "oauthClientSecret" TEXT,
ADD COLUMN IF NOT EXISTS "oauthRedirectUri" TEXT DEFAULT 'https://app.podcastflow.pro/api/youtube/auth/callback';

-- Create table in organization schemas for sync logs with connection tracking
DO $$
DECLARE
    schema_name TEXT;
BEGIN
    -- Update YouTubeSyncLog in org_podcastflow_pro to include connectionId
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'org_podcastflow_pro' AND table_name = 'YouTubeSyncLog') THEN
        EXECUTE 'ALTER TABLE org_podcastflow_pro."YouTubeSyncLog" ADD COLUMN IF NOT EXISTS "connectionId" TEXT';
    END IF;
    
    -- Update YouTubeSyncLog in org_unfy to include connectionId
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'org_unfy' AND table_name = 'YouTubeSyncLog') THEN
        EXECUTE 'ALTER TABLE org_unfy."YouTubeSyncLog" ADD COLUMN IF NOT EXISTS "connectionId" TEXT';
    END IF;
    
    RAISE NOTICE 'Updated YouTubeSyncLog tables with connectionId column';
END $$;

-- Sample data for testing (only if no connections exist)
INSERT INTO "YouTubeConnection" (
    "organizationId",
    "connectionName",
    "accountEmail",
    "channelId",
    "channelTitle",
    "connectedBy",
    "isActive",
    "isPrimary"
)
SELECT 
    o.id,
    'Primary Account',
    'youtube@' || o.slug || '.com',
    s."youtubeChannelId",
    s.name || ' YouTube',
    (SELECT id FROM "User" WHERE "organizationId" = o.id AND role = 'admin' LIMIT 1),
    true,
    true
FROM "Organization" o
INNER JOIN (
    SELECT DISTINCT ON ("organizationId") 
        "organizationId", 
        "youtubeChannelId", 
        name
    FROM org_podcastflow_pro."Show"
    WHERE "youtubeChannelId" IS NOT NULL AND "youtubeChannelId" != ''
) s ON s."organizationId" = o.id
WHERE NOT EXISTS (
    SELECT 1 FROM "YouTubeConnection" WHERE "organizationId" = o.id
)
LIMIT 1;