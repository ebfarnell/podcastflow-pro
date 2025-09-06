-- Add YouTube tables to organization schemas
-- This script copies the YouTube tables structure to each org schema

-- Function to create YouTube tables in an organization schema
CREATE OR REPLACE FUNCTION create_youtube_tables_in_schema(schema_name TEXT) RETURNS VOID AS $$
BEGIN
    -- YouTubeChannel table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."YouTubeChannel" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "organizationId" TEXT NOT NULL,
            "channelId" TEXT NOT NULL,
            "channelName" TEXT NOT NULL,
            "channelTitle" TEXT NOT NULL,
            "description" TEXT,
            "customUrl" TEXT,
            "publishedAt" TIMESTAMP,
            "subscriberCount" BIGINT DEFAULT 0,
            "videoCount" INTEGER DEFAULT 0,
            "viewCount" BIGINT DEFAULT 0,
            "thumbnails" JSONB DEFAULT ''{}'',
            "bannerImageUrl" TEXT,
            "profileImageUrl" TEXT,
            "monetizationEnabled" BOOLEAN DEFAULT false,
            "verificationStatus" TEXT DEFAULT ''unverified'',
            "isActive" BOOLEAN DEFAULT true,
            "lastSyncAt" TIMESTAMP,
            "syncStatus" TEXT DEFAULT ''pending'',
            "syncError" TEXT,
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE("organizationId", "channelId")
        )', schema_name);

    -- YouTubeVideo table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."YouTubeVideo" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "organizationId" TEXT NOT NULL,
            "channelId" TEXT NOT NULL,
            "videoId" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "description" TEXT,
            "publishedAt" TIMESTAMP,
            "duration" TEXT,
            "durationSeconds" INTEGER,
            "privacyStatus" TEXT DEFAULT ''public'',
            "uploadStatus" TEXT DEFAULT ''processed'',
            "license" TEXT DEFAULT ''youtube'',
            "viewCount" BIGINT DEFAULT 0,
            "likeCount" INTEGER DEFAULT 0,
            "commentCount" INTEGER DEFAULT 0,
            "favoriteCount" INTEGER DEFAULT 0,
            "thumbnails" JSONB DEFAULT ''{}'',
            "tags" TEXT[],
            "categoryId" TEXT,
            "defaultLanguage" TEXT,
            "defaultAudioLanguage" TEXT,
            "monetizationDetails" JSONB DEFAULT ''{}'',
            "contentRating" JSONB DEFAULT ''{}'',
            "restrictions" TEXT[],
            "lastSyncAt" TIMESTAMP,
            "syncStatus" TEXT DEFAULT ''pending'',
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE("organizationId", "videoId")
        )', schema_name);

    -- YouTubePlaylist table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."YouTubePlaylist" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "organizationId" TEXT NOT NULL,
            "channelId" TEXT NOT NULL,
            "playlistId" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "description" TEXT,
            "publishedAt" TIMESTAMP,
            "privacyStatus" TEXT DEFAULT ''public'',
            "itemCount" INTEGER DEFAULT 0,
            "thumbnails" JSONB DEFAULT ''{}'',
            "lastSyncAt" TIMESTAMP,
            "syncStatus" TEXT DEFAULT ''pending'',
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE("organizationId", "playlistId")
        )', schema_name);

    -- YouTubeAnalytics table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."YouTubeAnalytics" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "organizationId" TEXT NOT NULL,
            "channelId" TEXT,
            "videoId" TEXT,
            "date" DATE NOT NULL,
            "period" TEXT NOT NULL DEFAULT ''day'',
            "views" BIGINT DEFAULT 0,
            "impressions" BIGINT DEFAULT 0,
            "clickThroughRate" DECIMAL(5,4) DEFAULT 0,
            "likes" INTEGER DEFAULT 0,
            "dislikes" INTEGER DEFAULT 0,
            "comments" INTEGER DEFAULT 0,
            "shares" INTEGER DEFAULT 0,
            "subscribersGained" INTEGER DEFAULT 0,
            "subscribersLost" INTEGER DEFAULT 0,
            "watchTimeMinutes" BIGINT DEFAULT 0,
            "averageViewDuration" INTEGER DEFAULT 0,
            "averageViewPercentage" DECIMAL(5,2) DEFAULT 0,
            "estimatedRevenue" DECIMAL(10,2) DEFAULT 0,
            "adImpressions" BIGINT DEFAULT 0,
            "cpm" DECIMAL(8,2) DEFAULT 0,
            "rpm" DECIMAL(8,2) DEFAULT 0,
            "trafficSources" JSONB DEFAULT ''{}'',
            "deviceTypes" JSONB DEFAULT ''{}'',
            "geography" JSONB DEFAULT ''{}'',
            "demographics" JSONB DEFAULT ''{}'',
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE("organizationId", "channelId", "videoId", "date", "period")
        )', schema_name);

    -- YouTubeSyncLog table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."YouTubeSyncLog" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "organizationId" TEXT NOT NULL,
            "syncType" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT ''started'',
            "startedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "completedAt" TIMESTAMP,
            "totalItems" INTEGER DEFAULT 0,
            "processedItems" INTEGER DEFAULT 0,
            "successfulItems" INTEGER DEFAULT 0,
            "failedItems" INTEGER DEFAULT 0,
            "errorMessage" TEXT,
            "errorDetails" JSONB DEFAULT ''{}'',
            "quotaUsed" INTEGER DEFAULT 0,
            "syncConfig" JSONB DEFAULT ''{}'',
            "results" JSONB DEFAULT ''{}'',
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS "idx_youtube_channel_org_id_%s" ON %I."YouTubeChannel"("organizationId")', replace(schema_name, 'org_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "idx_youtube_channel_channel_id_%s" ON %I."YouTubeChannel"("channelId")', replace(schema_name, 'org_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "idx_youtube_video_org_id_%s" ON %I."YouTubeVideo"("organizationId")', replace(schema_name, 'org_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "idx_youtube_video_video_id_%s" ON %I."YouTubeVideo"("videoId")', replace(schema_name, 'org_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "idx_youtube_analytics_date_%s" ON %I."YouTubeAnalytics"("date")', replace(schema_name, 'org_', ''), schema_name);

    RAISE NOTICE 'Created YouTube tables in schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Apply to all existing organization schemas
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        PERFORM create_youtube_tables_in_schema(schema_record.schema_name);
    END LOOP;
END;
$$;

-- Clean up the function
DROP FUNCTION create_youtube_tables_in_schema(TEXT);