-- Migration: Add YouTube retention metrics and real-time data fields
-- Date: 2025-08-23

-- Add retention metrics columns to YouTubeAnalytics table for all organization schemas
DO $$
DECLARE
    schema_name text;
BEGIN
    -- Loop through all organization schemas
    FOR schema_name IN 
        SELECT nspname 
        FROM pg_namespace 
        WHERE nspname LIKE 'org_%'
    LOOP
        -- Add retention metrics columns
        EXECUTE format('
            ALTER TABLE %I."YouTubeAnalytics"
            ADD COLUMN IF NOT EXISTS "audienceRetention" jsonb DEFAULT ''{}''::jsonb,
            ADD COLUMN IF NOT EXISTS "relativeRetentionPerformance" numeric(5,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "audienceWatchRatio" numeric(5,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "cardClickRate" numeric(5,4) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "cardTeaserClickRate" numeric(5,4) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "endScreenElementClickRate" numeric(5,4) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "endScreenImpressions" bigint DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "cardImpressions" bigint DEFAULT 0
        ', schema_name);

        -- Create table for real-time YouTube metrics
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."YouTubeRealTimeMetrics" (
                "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "organizationId" text NOT NULL,
                "videoId" text NOT NULL,
                "timestamp" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "concurrentViewers" integer DEFAULT 0,
                "views" bigint DEFAULT 0,
                "likes" integer DEFAULT 0,
                "comments" integer DEFAULT 0,
                "chatMessages" integer DEFAULT 0,
                "superChatAmount" numeric(10,2) DEFAULT 0,
                "membershipJoins" integer DEFAULT 0,
                "isLive" boolean DEFAULT false,
                "streamHealth" jsonb DEFAULT ''{}''::jsonb,
                "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
                UNIQUE("videoId", "timestamp")
            )
        ', schema_name);

        -- Create table for YouTube retention curve data (detailed retention data)
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."YouTubeRetentionData" (
                "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "organizationId" text NOT NULL,
                "videoId" text NOT NULL,
                "date" date NOT NULL,
                "retentionCurve" jsonb NOT NULL DEFAULT ''[]''::jsonb,
                "absoluteRetention" jsonb DEFAULT ''[]''::jsonb,
                "relativeRetention" jsonb DEFAULT ''[]''::jsonb,
                "heatMapData" jsonb DEFAULT ''{}''::jsonb,
                "keyMoments" jsonb DEFAULT ''[]''::jsonb,
                "averageViewDuration" integer DEFAULT 0,
                "videoDuration" integer DEFAULT 0,
                "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
                UNIQUE("videoId", "date")
            )
        ', schema_name);

        -- Create table for traffic source details
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."YouTubeTrafficSource" (
                "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "organizationId" text NOT NULL,
                "videoId" text NOT NULL,
                "date" date NOT NULL,
                "source" text NOT NULL,
                "sourceDetail" text,
                "views" bigint DEFAULT 0,
                "watchTimeMinutes" bigint DEFAULT 0,
                "averageViewDuration" integer DEFAULT 0,
                "impressions" bigint DEFAULT 0,
                "clickThroughRate" numeric(5,4) DEFAULT 0,
                "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
                UNIQUE("videoId", "date", "source", "sourceDetail")
            )
        ', schema_name);

        -- Create indexes for performance
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "idx_realtime_metrics_video_%s" 
            ON %I."YouTubeRealTimeMetrics" ("videoId", "timestamp" DESC)
        ', replace(schema_name, 'org_', ''), schema_name);

        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "idx_retention_data_video_%s" 
            ON %I."YouTubeRetentionData" ("videoId", "date" DESC)
        ', replace(schema_name, 'org_', ''), schema_name);

        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "idx_traffic_source_video_%s" 
            ON %I."YouTubeTrafficSource" ("videoId", "date" DESC)
        ', replace(schema_name, 'org_', ''), schema_name);

        RAISE NOTICE 'Updated schema: %', schema_name;
    END LOOP;
END $$;

-- Add comment documentation
COMMENT ON COLUMN org_podcastflow_pro."YouTubeAnalytics"."audienceRetention" IS 'JSON array of retention percentage at each point in the video';
COMMENT ON COLUMN org_podcastflow_pro."YouTubeAnalytics"."relativeRetentionPerformance" IS 'How well video retains viewers compared to similar videos (0-100)';
COMMENT ON COLUMN org_podcastflow_pro."YouTubeAnalytics"."audienceWatchRatio" IS 'Percentage of video watched by returning viewers';

COMMENT ON TABLE org_podcastflow_pro."YouTubeRealTimeMetrics" IS 'Real-time YouTube metrics updated every 5 minutes for recent/live videos';
COMMENT ON TABLE org_podcastflow_pro."YouTubeRetentionData" IS 'Detailed audience retention curves and heatmap data';
COMMENT ON TABLE org_podcastflow_pro."YouTubeTrafficSource" IS 'Breakdown of traffic sources and search terms';