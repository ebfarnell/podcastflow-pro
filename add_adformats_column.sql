-- Add adFormats column to Campaign table in all organization schemas
-- This column will store the selected ad formats as a JSON array

-- Update org_podcastflow_pro schema
ALTER TABLE "org_podcastflow_pro"."Campaign" 
ADD COLUMN IF NOT EXISTS "adFormats" JSONB DEFAULT '[]'::jsonb;

-- Update org_unfy schema
ALTER TABLE "org_unfy"."Campaign" 
ADD COLUMN IF NOT EXISTS "adFormats" JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN "org_podcastflow_pro"."Campaign"."adFormats" IS 'Array of ad format types (e.g., ["Pre-roll", "Mid-roll", "Post-roll", "Host-read"])';
COMMENT ON COLUMN "org_unfy"."Campaign"."adFormats" IS 'Array of ad format types (e.g., ["Pre-roll", "Mid-roll", "Post-roll", "Host-read"])';

-- Create index for better query performance on adFormats
CREATE INDEX IF NOT EXISTS "idx_org_podcastflow_pro_campaign_adformats" ON "org_podcastflow_pro"."Campaign" USING GIN ("adFormats");
CREATE INDEX IF NOT EXISTS "idx_org_unfy_campaign_adformats" ON "org_unfy"."Campaign" USING GIN ("adFormats");