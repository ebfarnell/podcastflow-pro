-- Populate ShowMetricsHistory with aggregated YouTube data from Episodes
-- This aggregates daily metrics from episode data

DO $$
DECLARE
    org_schema TEXT;
    query TEXT;
BEGIN
    -- Process each organization schema
    FOR org_schema IN
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Check if ShowMetricsHistory table exists in this schema
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = org_schema 
            AND table_name = 'ShowMetricsHistory'
        ) THEN
            RAISE NOTICE 'Processing schema: %', org_schema;
            
            -- Insert aggregated YouTube metrics by day
            query := format('
                INSERT INTO %I."ShowMetricsHistory" (
                    "showId",
                    date,
                    "youtubeViews",
                    "youtubeLikes",
                    "youtubeComments",
                    "megaphoneDownloads",
                    "megaphoneUniqueListeners",
                    "totalDownloads",
                    "totalListeners",
                    "engagementRate",
                    "createdAt",
                    "updatedAt"
                )
                SELECT 
                    e."showId",
                    DATE(e."airDate") as date,
                    COALESCE(SUM(e."youtubeViewCount"), 0) as "youtubeViews",
                    COALESCE(SUM(e."youtubeLikeCount"), 0) as "youtubeLikes",
                    COALESCE(SUM(e."youtubeCommentCount"), 0) as "youtubeComments",
                    COALESCE(SUM(e."megaphoneDownloads"), 0) as "megaphoneDownloads",
                    COALESCE(SUM(e."megaphoneUniqueListeners"), 0) as "megaphoneUniqueListeners",
                    COALESCE(SUM(e."youtubeViewCount"), 0) + COALESCE(SUM(e."megaphoneDownloads"), 0) as "totalDownloads",
                    COALESCE(MAX(e."megaphoneUniqueListeners"), 0) as "totalListeners",
                    CASE 
                        WHEN COALESCE(SUM(e."youtubeViewCount"), 0) > 0 
                        THEN (COALESCE(SUM(e."youtubeLikeCount"), 0)::float / SUM(e."youtubeViewCount")::float) * 100
                        ELSE 0
                    END as "engagementRate",
                    NOW() as "createdAt",
                    NOW() as "updatedAt"
                FROM %I."Episode" e
                WHERE e."airDate" IS NOT NULL
                    AND e."youtubeViewCount" IS NOT NULL
                    AND e."youtubeViewCount" > 0
                GROUP BY e."showId", DATE(e."airDate")
                ON CONFLICT ("showId", date) 
                DO UPDATE SET
                    "youtubeViews" = EXCLUDED."youtubeViews",
                    "youtubeLikes" = EXCLUDED."youtubeLikes",
                    "youtubeComments" = EXCLUDED."youtubeComments",
                    "megaphoneDownloads" = EXCLUDED."megaphoneDownloads",
                    "megaphoneUniqueListeners" = EXCLUDED."megaphoneUniqueListeners",
                    "totalDownloads" = EXCLUDED."totalDownloads",
                    "totalListeners" = EXCLUDED."totalListeners",
                    "engagementRate" = EXCLUDED."engagementRate",
                    "updatedAt" = NOW();
            ', org_schema, org_schema);
            
            EXECUTE query;
            
            -- Get the count of records inserted/updated
            GET DIAGNOSTICS query := ROW_COUNT;
            RAISE NOTICE 'Processed % rows for schema %', query, org_schema;
            
        END IF;
    END LOOP;
END $$;

-- Verify the data was populated for Theo Von's show
SELECT 
    COUNT(*) as days_with_data,
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    SUM("youtubeViews") as total_views,
    SUM("youtubeLikes") as total_likes
FROM org_podcastflow_pro."ShowMetricsHistory"
WHERE "showId" = 'show_1755587882316_e5ccuvioa';