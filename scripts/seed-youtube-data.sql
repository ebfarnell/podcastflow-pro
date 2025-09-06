-- Insert sample YouTube Analytics data for Theo Von's show
-- This is for testing purposes to demonstrate the metrics UI

-- First, get some episodes from Theo Von's show
WITH theo_episodes AS (
  SELECT 
    id,
    "youtubeVideoId",
    "airDate",
    title
  FROM org_podcastflow_pro."Episode"
  WHERE "showId" = 'show_1755587882316_e5ccuvioa'
    AND "youtubeVideoId" IS NOT NULL
    AND "airDate" >= CURRENT_DATE - INTERVAL '30 days'
  ORDER BY "airDate" DESC
  LIMIT 10
)
-- Insert YouTube Analytics data for these episodes
INSERT INTO org_podcastflow_pro."YouTubeAnalytics" (
  id,
  "videoId",
  date,
  views,
  likes,
  comments,
  shares,
  "estimatedMinutesWatched",
  "averageViewDuration",
  "averageViewPercentage",
  "subscribersGained",
  "subscribersLost",
  "videosAddedToPlaylists",
  "videosRemovedFromPlaylists",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "organizationId"
)
SELECT
  gen_random_uuid()::text,
  e."youtubeVideoId",
  d.date::date,
  -- Generate realistic view counts (50k-500k range)
  FLOOR(RANDOM() * 450000 + 50000)::integer as views,
  -- Likes typically 3-5% of views
  FLOOR((RANDOM() * 450000 + 50000) * (0.03 + RANDOM() * 0.02))::integer as likes,
  -- Comments typically 0.1-0.3% of views  
  FLOOR((RANDOM() * 450000 + 50000) * (0.001 + RANDOM() * 0.002))::integer as comments,
  -- Shares typically 0.5-1% of views
  FLOOR((RANDOM() * 450000 + 50000) * (0.005 + RANDOM() * 0.005))::integer as shares,
  -- Estimated minutes watched
  FLOOR((RANDOM() * 450000 + 50000) * (8 + RANDOM() * 4))::integer as "estimatedMinutesWatched",
  -- Average view duration in seconds (8-15 minutes)
  FLOOR(480 + RANDOM() * 420)::integer as "averageViewDuration",
  -- Average view percentage (35-65% typical for long-form content)
  35 + RANDOM() * 30 as "averageViewPercentage",
  -- Subscribers gained (0.1-0.3% of views)
  FLOOR((RANDOM() * 450000 + 50000) * (0.001 + RANDOM() * 0.002))::integer as "subscribersGained",
  -- Subscribers lost (10-20% of gained)
  FLOOR((RANDOM() * 450000 + 50000) * (0.001 + RANDOM() * 0.002) * (0.1 + RANDOM() * 0.1))::integer as "subscribersLost",
  -- Playlist adds
  FLOOR((RANDOM() * 450000 + 50000) * 0.001)::integer as "videosAddedToPlaylists",
  -- Playlist removes  
  FLOOR((RANDOM() * 450000 + 50000) * 0.0001)::integer as "videosRemovedFromPlaylists",
  NOW() as "createdAt",
  NOW() as "updatedAt",
  'admin-user' as "createdBy",
  'admin-user' as "updatedBy",
  '11111111-1111-1111-1111-111111111111' as "organizationId"
FROM theo_episodes e
CROSS JOIN generate_series(
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE,
  INTERVAL '1 day'
) as d(date)
ON CONFLICT (id) DO NOTHING;

-- Add some spike days for outlier detection
UPDATE org_podcastflow_pro."YouTubeAnalytics"
SET views = views * 3,
    likes = likes * 3,
    comments = comments * 4
WHERE "videoId" IN (
  SELECT "youtubeVideoId" 
  FROM org_podcastflow_pro."Episode"
  WHERE "showId" = 'show_1755587882316_e5ccuvioa'
  LIMIT 2
)
AND date IN (CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE - INTERVAL '5 days');

-- Verify the data was inserted
SELECT 
  COUNT(*) as records_inserted,
  SUM(views) as total_views,
  AVG("averageViewPercentage") as avg_vtr,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM org_podcastflow_pro."YouTubeAnalytics"
WHERE "videoId" IN (
  SELECT "youtubeVideoId"
  FROM org_podcastflow_pro."Episode"  
  WHERE "showId" = 'show_1755587882316_e5ccuvioa'
);