-- Migration to add missing YouTube Analytics fields to Episode table
-- These fields are available from YouTube Analytics API but not yet stored in our database

-- Add YouTube Analytics metrics to Episode table in org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Episode"
ADD COLUMN IF NOT EXISTS "youtubeAvgViewDuration" INTEGER DEFAULT 0,  -- Average view duration in seconds
ADD COLUMN IF NOT EXISTS "youtubeAvgViewPercentage" DECIMAL(5,2) DEFAULT 0,  -- Average percentage of video watched
ADD COLUMN IF NOT EXISTS "youtubeWatchTimeHours" DECIMAL(10,2) DEFAULT 0,  -- Total watch time in hours
ADD COLUMN IF NOT EXISTS "youtubeImpressions" BIGINT DEFAULT 0,  -- Number of times thumbnail was shown
ADD COLUMN IF NOT EXISTS "youtubeCTR" DECIMAL(5,2) DEFAULT 0,  -- Click-through rate percentage
ADD COLUMN IF NOT EXISTS "youtubeSubscribersGained" INTEGER DEFAULT 0,  -- New subscribers from this video
ADD COLUMN IF NOT EXISTS "youtubeSubscribersLost" INTEGER DEFAULT 0,  -- Subscribers lost from this video
ADD COLUMN IF NOT EXISTS "youtubeEstimatedMinutesWatched" BIGINT DEFAULT 0,  -- Total minutes watched
ADD COLUMN IF NOT EXISTS "youtubeShares" INTEGER DEFAULT 0,  -- Number of shares
ADD COLUMN IF NOT EXISTS "youtubeDislikeCount" INTEGER DEFAULT 0,  -- Number of dislikes
ADD COLUMN IF NOT EXISTS "youtubeRetentionRate" DECIMAL(5,2) DEFAULT 0,  -- Average retention rate
ADD COLUMN IF NOT EXISTS "youtubeThumbnailUrl" TEXT,  -- URL to video thumbnail
ADD COLUMN IF NOT EXISTS "youtubePublishedAt" TIMESTAMP,  -- When video was published
ADD COLUMN IF NOT EXISTS "youtubeLastSyncedAt" TIMESTAMP;  -- Last time we synced data from YouTube

-- Add the same fields to org_unfy schema
ALTER TABLE org_unfy."Episode"
ADD COLUMN IF NOT EXISTS "youtubeAvgViewDuration" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeAvgViewPercentage" DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeWatchTimeHours" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeImpressions" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeCTR" DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeSubscribersGained" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeSubscribersLost" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeEstimatedMinutesWatched" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeShares" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeDislikeCount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeRetentionRate" DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeThumbnailUrl" TEXT,
ADD COLUMN IF NOT EXISTS "youtubePublishedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "youtubeLastSyncedAt" TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_episode_youtube_last_synced 
ON org_podcastflow_pro."Episode" ("youtubeLastSyncedAt") 
WHERE "youtubeVideoId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_episode_youtube_published 
ON org_podcastflow_pro."Episode" ("youtubePublishedAt") 
WHERE "youtubeVideoId" IS NOT NULL;

-- Same indexes for org_unfy
CREATE INDEX IF NOT EXISTS idx_episode_youtube_last_synced 
ON org_unfy."Episode" ("youtubeLastSyncedAt") 
WHERE "youtubeVideoId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_episode_youtube_published 
ON org_unfy."Episode" ("youtubePublishedAt") 
WHERE "youtubeVideoId" IS NOT NULL;

-- Add comments to document the fields
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeAvgViewDuration" IS 'Average view duration in seconds from YouTube Analytics';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeAvgViewPercentage" IS 'Average percentage of video watched (0-100)';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeWatchTimeHours" IS 'Total watch time in hours';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeImpressions" IS 'Number of times video thumbnail was shown';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeCTR" IS 'Click-through rate percentage (0-100)';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeSubscribersGained" IS 'New subscribers gained from this video';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeEstimatedMinutesWatched" IS 'Total minutes watched across all viewers';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeRetentionRate" IS 'Average audience retention percentage';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeLastSyncedAt" IS 'Timestamp of last YouTube Analytics sync';