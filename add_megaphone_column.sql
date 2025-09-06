-- Add megaphonePodcastId column to Show table in all organization schemas

-- For org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Show" 
ADD COLUMN IF NOT EXISTS "megaphonePodcastId" TEXT;

-- For org_unfy schema  
ALTER TABLE org_unfy."Show"
ADD COLUMN IF NOT EXISTS "megaphonePodcastId" TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_show_megaphone_podcast_id 
ON org_podcastflow_pro."Show"("megaphonePodcastId");

CREATE INDEX IF NOT EXISTS idx_show_megaphone_podcast_id 
ON org_unfy."Show"("megaphonePodcastId");

-- Optional: Add comment to describe the column
COMMENT ON COLUMN org_podcastflow_pro."Show"."megaphonePodcastId" 
IS 'Megaphone API podcast ID for fetching metrics';

COMMENT ON COLUMN org_unfy."Show"."megaphonePodcastId" 
IS 'Megaphone API podcast ID for fetching metrics';