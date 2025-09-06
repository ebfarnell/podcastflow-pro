-- YouTube Integration Schema for Multi-Tenant Architecture
-- This adds YouTube OAuth token storage to each organization schema

-- Function to add YouTube tables to an organization schema
CREATE OR REPLACE FUNCTION add_youtube_tables_to_schema(schema_name text)
RETURNS void AS $$
BEGIN
    -- YouTube Channel connections (OAuth tokens per channel)
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."YouTubeChannel" (
            id TEXT PRIMARY KEY DEFAULT ''ytc_'' || extract(epoch from now())::text || ''_'' || substr(md5(random()::text), 1, 8),
            "organizationId" TEXT NOT NULL,
            "channelId" TEXT NOT NULL, -- YouTube channel ID
            "channelTitle" TEXT,
            "channelDescription" TEXT,
            "channelThumbnail" TEXT,
            "connectedBy" TEXT NOT NULL, -- User ID who connected the channel
            "accessToken" TEXT NOT NULL, -- Encrypted OAuth access token
            "refreshToken" TEXT NOT NULL, -- Encrypted OAuth refresh token
            "tokenExpiry" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL,
            "scope" TEXT[], -- OAuth scopes granted
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "lastSync" TIMESTAMP(3) WITHOUT TIME ZONE,
            "metadata" JSONB DEFAULT ''{}'',
            "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "YouTubeChannel_channelId_unique" UNIQUE ("channelId", "organizationId")
        )', schema_name);

    -- YouTube Video data cache
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."YouTubeVideo" (
            id TEXT PRIMARY KEY DEFAULT ''ytv_'' || extract(epoch from now())::text || ''_'' || substr(md5(random()::text), 1, 8),
            "videoId" TEXT NOT NULL UNIQUE, -- YouTube video ID
            "channelId" TEXT, -- Reference to YouTubeChannel if owned
            "organizationId" TEXT NOT NULL,
            "title" TEXT,
            "description" TEXT,
            "thumbnailUrl" TEXT,
            "publishedAt" TIMESTAMP(3) WITHOUT TIME ZONE,
            "duration" TEXT, -- ISO 8601 duration
            "viewCount" BIGINT,
            "likeCount" BIGINT,
            "commentCount" BIGINT,
            "tags" TEXT[],
            "categoryId" TEXT,
            "privacyStatus" TEXT,
            "metadata" JSONB DEFAULT ''{}'',
            "lastFetched" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- YouTube Analytics data (private data)
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."YouTubeAnalytics" (
            id TEXT PRIMARY KEY DEFAULT ''yta_'' || extract(epoch from now())::text || ''_'' || substr(md5(random()::text), 1, 8),
            "channelId" TEXT NOT NULL,
            "videoId" TEXT,
            "organizationId" TEXT NOT NULL,
            "date" DATE NOT NULL,
            "views" BIGINT DEFAULT 0,
            "estimatedMinutesWatched" BIGINT DEFAULT 0,
            "averageViewDuration" INTEGER DEFAULT 0,
            "likes" INTEGER DEFAULT 0,
            "dislikes" INTEGER DEFAULT 0,
            "comments" INTEGER DEFAULT 0,
            "shares" INTEGER DEFAULT 0,
            "subscribersGained" INTEGER DEFAULT 0,
            "subscribersLost" INTEGER DEFAULT 0,
            "estimatedRevenue" DOUBLE PRECISION DEFAULT 0,
            "monetizedPlaybacks" BIGINT DEFAULT 0,
            "playbackBasedCpm" DOUBLE PRECISION DEFAULT 0,
            "metadata" JSONB DEFAULT ''{}'',
            "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "YouTubeAnalytics_unique_date" UNIQUE ("channelId", "videoId", "date")
        )', schema_name);

    -- YouTube Sync logs
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."YouTubeSyncLog" (
            id TEXT PRIMARY KEY DEFAULT ''yts_'' || extract(epoch from now())::text || ''_'' || substr(md5(random()::text), 1, 8),
            "channelId" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            "syncType" TEXT NOT NULL, -- ''videos'', ''analytics'', ''playlists''
            "status" TEXT NOT NULL, -- ''started'', ''completed'', ''failed''
            "itemsProcessed" INTEGER DEFAULT 0,
            "errorMessage" TEXT,
            "startedAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "completedAt" TIMESTAMP(3) WITHOUT TIME ZONE,
            "metadata" JSONB DEFAULT ''{}'',
            "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS "YouTubeChannel_organizationId_idx" ON %I."YouTubeChannel" ("organizationId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "YouTubeChannel_connectedBy_idx" ON %I."YouTubeChannel" ("connectedBy")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "YouTubeVideo_channelId_idx" ON %I."YouTubeVideo" ("channelId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "YouTubeVideo_organizationId_idx" ON %I."YouTubeVideo" ("organizationId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "YouTubeAnalytics_channelId_idx" ON %I."YouTubeAnalytics" ("channelId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "YouTubeAnalytics_videoId_idx" ON %I."YouTubeAnalytics" ("videoId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "YouTubeAnalytics_date_idx" ON %I."YouTubeAnalytics" ("date")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "YouTubeSyncLog_channelId_idx" ON %I."YouTubeSyncLog" ("channelId")', schema_name);
    
END;
$$ LANGUAGE plpgsql;

-- Apply to existing organization schemas
DO $$
DECLARE
    org_record RECORD;
BEGIN
    FOR org_record IN SELECT slug FROM public."Organization" WHERE "isActive" = true
    LOOP
        PERFORM add_youtube_tables_to_schema('org_' || replace(lower(org_record.slug), '-', '_'));
        RAISE NOTICE 'Added YouTube tables to schema: org_%', replace(lower(org_record.slug), '-', '_');
    END LOOP;
END $$;

-- Also add to public schema for API key configuration
CREATE TABLE IF NOT EXISTS public."YouTubeApiConfig" (
    id TEXT PRIMARY KEY DEFAULT 'ytapi_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 8),
    "organizationId" TEXT NOT NULL UNIQUE,
    "apiKey" TEXT, -- Encrypted API key for public data access
    "clientId" TEXT, -- OAuth client ID
    "clientSecret" TEXT, -- Encrypted OAuth client secret
    "redirectUri" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "quotaLimit" INTEGER DEFAULT 10000, -- Daily quota limit
    "quotaUsed" INTEGER DEFAULT 0,
    "quotaResetAt" TIMESTAMP(3) WITHOUT TIME ZONE,
    "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "YouTubeApiConfig_organizationId_idx" ON public."YouTubeApiConfig" ("organizationId");