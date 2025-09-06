-- Create ShowMetricsHistory table for all organization schemas
DO $$
DECLARE
    org_schema text;
BEGIN
    -- Loop through all organization schemas
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Create ShowMetricsHistory table
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."ShowMetricsHistory" (
                id TEXT PRIMARY KEY DEFAULT ''smh_'' || extract(epoch from now())::text || ''_'' || substr(md5(random()::text), 1, 8),
                "showId" TEXT NOT NULL,
                "organizationId" TEXT NOT NULL,
                "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                date DATE NOT NULL,
                
                -- YouTube Metrics (Video)
                "youtubeViews" BIGINT DEFAULT 0,
                "youtubeLikes" INTEGER DEFAULT 0,
                "youtubeComments" INTEGER DEFAULT 0,
                "youtubeSubscribers" INTEGER DEFAULT 0,
                "youtubeWatchTime" BIGINT DEFAULT 0,
                "youtubeAverageViewDuration" INTEGER DEFAULT 0,
                "youtubeImpressions" BIGINT DEFAULT 0,
                "youtubeCTR" NUMERIC(5,2) DEFAULT 0,
                
                -- Megaphone Metrics (Audio)
                "megaphoneDownloads" BIGINT DEFAULT 0,
                "megaphoneImpressions" BIGINT DEFAULT 0,
                "megaphoneUniqueListeners" INTEGER DEFAULT 0,
                "megaphoneAvgListenTime" INTEGER DEFAULT 0,
                "megaphoneCompletionRate" NUMERIC(5,2) DEFAULT 0,
                
                -- Combined Metrics
                "totalDownloads" BIGINT DEFAULT 0,
                "totalListeners" INTEGER DEFAULT 0,
                "totalImpressions" BIGINT DEFAULT 0,
                "averageCompletion" NUMERIC(5,2) DEFAULT 0,
                
                -- Revenue Metrics
                "dailyRevenue" NUMERIC(10,2) DEFAULT 0,
                "cpm" NUMERIC(8,2) DEFAULT 0,
                
                -- Engagement Metrics
                "engagementRate" NUMERIC(5,2) DEFAULT 0,
                "shareCount" INTEGER DEFAULT 0,
                
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY ("showId") REFERENCES %I."Show"(id) ON DELETE CASCADE
            )
        ', org_schema, org_schema);
        
        -- Create indexes for efficient querying
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "idx_metrics_history_show_date" 
            ON %I."ShowMetricsHistory" ("showId", date DESC)
        ', org_schema);
        
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "idx_metrics_history_date" 
            ON %I."ShowMetricsHistory" (date DESC)
        ', org_schema);
        
        -- Create unique constraint to prevent duplicate entries per day
        EXECUTE format('
            CREATE UNIQUE INDEX IF NOT EXISTS "idx_metrics_history_unique_day" 
            ON %I."ShowMetricsHistory" ("showId", date)
        ', org_schema);
        
        RAISE NOTICE 'Created ShowMetricsHistory table in %.', org_schema;
    END LOOP;
END $$;