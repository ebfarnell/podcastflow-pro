-- Add socialMedia field to Show table in all organization schemas
-- This is a JSONB field to store social media links

-- Add to org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Show" 
ADD COLUMN IF NOT EXISTS "socialMedia" jsonb DEFAULT '{}';

-- Add to org_unfy schema  
ALTER TABLE org_unfy."Show"
ADD COLUMN IF NOT EXISTS "socialMedia" jsonb DEFAULT '{}';

-- Add comment to document the structure
COMMENT ON COLUMN org_podcastflow_pro."Show"."socialMedia" IS 'JSON object containing social media links: {twitter: string, instagram: string, facebook: string}';
COMMENT ON COLUMN org_unfy."Show"."socialMedia" IS 'JSON object containing social media links: {twitter: string, instagram: string, facebook: string}';