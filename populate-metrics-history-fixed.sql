-- Populate ShowMetricsHistory with aggregated YouTube data from Episodes
-- This aggregates daily metrics from episode data for org_podcastflow_pro only

-- First check if the columns exist in Episode table
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'org_podcastflow_pro' 
    AND table_name = 'Episode' 
    AND column_name IN ('youtubeViewCount', 'youtubeLikeCount', 'megaphoneDownloads');

-- Insert aggregated YouTube metrics by day for org_podcastflow_pro
INSERT INTO org_podcastflow_pro."ShowMetricsHistory" (
    "showId",
    "organizationId",
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
    e."organizationId",
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
FROM org_podcastflow_pro."Episode" e
WHERE e."airDate" IS NOT NULL
    AND e."youtubeViewCount" IS NOT NULL
    AND e."youtubeViewCount" > 0
GROUP BY e."showId", e."organizationId", DATE(e."airDate")
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

-- Verify the data was populated for Theo Von's show
SELECT 
    COUNT(*) as days_with_data,
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    SUM("youtubeViews") as total_views,
    SUM("youtubeLikes") as total_likes
FROM org_podcastflow_pro."ShowMetricsHistory"
WHERE "showId" = 'show_1755587882316_e5ccuvioa';