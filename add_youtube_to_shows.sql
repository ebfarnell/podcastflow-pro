-- Add YouTube integration fields to Show table for all organization schemas

-- Add fields to org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Show" 
ADD COLUMN IF NOT EXISTS "youtubeChannelId" TEXT,
ADD COLUMN IF NOT EXISTS "youtubeChannelUrl" TEXT,
ADD COLUMN IF NOT EXISTS "youtubeChannelName" TEXT,
ADD COLUMN IF NOT EXISTS "youtubePlaylistId" TEXT,
ADD COLUMN IF NOT EXISTS "youtubeSyncEnabled" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "youtubeLastSyncAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "youtubeAutoCreateEpisodes" BOOLEAN DEFAULT false;

-- Create index for YouTube channel ID
CREATE INDEX IF NOT EXISTS "idx_show_youtube_channel_id" 
ON org_podcastflow_pro."Show"("youtubeChannelId");

-- Add fields to org_unfy schema (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        ALTER TABLE org_unfy."Show" 
        ADD COLUMN IF NOT EXISTS "youtubeChannelId" TEXT,
        ADD COLUMN IF NOT EXISTS "youtubeChannelUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "youtubeChannelName" TEXT,
        ADD COLUMN IF NOT EXISTS "youtubePlaylistId" TEXT,
        ADD COLUMN IF NOT EXISTS "youtubeSyncEnabled" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "youtubeLastSyncAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "youtubeAutoCreateEpisodes" BOOLEAN DEFAULT false;

        CREATE INDEX IF NOT EXISTS "idx_show_youtube_channel_id" 
        ON org_unfy."Show"("youtubeChannelId");
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN org_podcastflow_pro."Show"."youtubeChannelId" IS 'YouTube Channel ID (UC... format) linked to this show';
COMMENT ON COLUMN org_podcastflow_pro."Show"."youtubeChannelUrl" IS 'Full URL to YouTube channel or podcast page';
COMMENT ON COLUMN org_podcastflow_pro."Show"."youtubeChannelName" IS 'YouTube channel display name';
COMMENT ON COLUMN org_podcastflow_pro."Show"."youtubePlaylistId" IS 'Specific playlist ID if episodes are in a playlist';
COMMENT ON COLUMN org_podcastflow_pro."Show"."youtubeSyncEnabled" IS 'Whether to sync episodes from YouTube';
COMMENT ON COLUMN org_podcastflow_pro."Show"."youtubeLastSyncAt" IS 'Last time episodes were synced from YouTube';
COMMENT ON COLUMN org_podcastflow_pro."Show"."youtubeAutoCreateEpisodes" IS 'Automatically create episodes from YouTube videos';