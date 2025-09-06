-- Add missing YouTube fields to Episode table for all organization schemas

-- Add fields to org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Episode" 
ADD COLUMN IF NOT EXISTS "youtubeUrl" TEXT,
ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT,
ADD COLUMN IF NOT EXISTS "durationSeconds" INTEGER,
ADD COLUMN IF NOT EXISTS "seasonNumber" INTEGER;

-- Create unique index on youtubeVideoId if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "idx_episode_youtube_video_id_unique" 
ON org_podcastflow_pro."Episode"("youtubeVideoId") 
WHERE "youtubeVideoId" IS NOT NULL;

-- Add fields to org_unfy schema (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        ALTER TABLE org_unfy."Episode" 
        ADD COLUMN IF NOT EXISTS "youtubeUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "durationSeconds" INTEGER,
        ADD COLUMN IF NOT EXISTS "seasonNumber" INTEGER;

        CREATE UNIQUE INDEX IF NOT EXISTS "idx_episode_youtube_video_id_unique" 
        ON org_unfy."Episode"("youtubeVideoId") 
        WHERE "youtubeVideoId" IS NOT NULL;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN org_podcastflow_pro."Episode"."youtubeUrl" IS 'Direct URL to YouTube video';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."thumbnailUrl" IS 'YouTube video thumbnail URL';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."durationSeconds" IS 'Video duration in seconds';
COMMENT ON COLUMN org_podcastflow_pro."Episode"."seasonNumber" IS 'Season number if applicable';