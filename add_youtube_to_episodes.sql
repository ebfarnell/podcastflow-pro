-- Add YouTube integration fields to Episode table for all organization schemas

-- Add fields to org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Episode" 
ADD COLUMN IF NOT EXISTS "youtubeVideoId" TEXT,
ADD COLUMN IF NOT EXISTS "youtubeViewCount" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeLikeCount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "youtubeCommentCount" INTEGER DEFAULT 0;

-- Create index for YouTube video ID
CREATE INDEX IF NOT EXISTS "idx_episode_youtube_video_id" 
ON org_podcastflow_pro."Episode"("youtubeVideoId");

-- Add fields to org_unfy schema (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        ALTER TABLE org_unfy."Episode" 
        ADD COLUMN IF NOT EXISTS "youtubeVideoId" TEXT,
        ADD COLUMN IF NOT EXISTS "youtubeViewCount" BIGINT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "youtubeLikeCount" INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "youtubeCommentCount" INTEGER DEFAULT 0;

        CREATE INDEX IF NOT EXISTS "idx_episode_youtube_video_id" 
        ON org_unfy."Episode"("youtubeVideoId");
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeVideoId" IS 'YouTube Video ID if episode was synced from YouTube';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeViewCount" IS 'View count from YouTube Analytics';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeLikeCount" IS 'Like count from YouTube Analytics';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeCommentCount" IS 'Comment count from YouTube Analytics';