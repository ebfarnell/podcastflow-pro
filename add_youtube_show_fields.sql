-- Add YouTube uploads playlist ID field to Show table

-- Add fields to org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Show" 
ADD COLUMN IF NOT EXISTS "youtubeUploadsPlaylistId" TEXT;

-- Add fields to org_unfy schema (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        ALTER TABLE org_unfy."Show" 
        ADD COLUMN IF NOT EXISTS "youtubeUploadsPlaylistId" TEXT;
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN org_podcastflow_pro."Show"."youtubeUploadsPlaylistId" IS 'YouTube uploads playlist ID (usually UU + channel ID suffix)';