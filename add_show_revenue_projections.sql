-- Add revenue projection fields to Show table in all organization schemas

-- For org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Show"
ADD COLUMN IF NOT EXISTS "selloutProjection" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "estimatedEpisodeValue" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "talentContractUrl" TEXT,
ADD COLUMN IF NOT EXISTS "talentContractUploadedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "talentContractUploadedBy" TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "Show_selloutProjection_idx" ON org_podcastflow_pro."Show" ("selloutProjection");
CREATE INDEX IF NOT EXISTS "Show_estimatedEpisodeValue_idx" ON org_podcastflow_pro."Show" ("estimatedEpisodeValue");

-- For org_unfy schema (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        ALTER TABLE org_unfy."Show"
        ADD COLUMN IF NOT EXISTS "selloutProjection" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "estimatedEpisodeValue" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "talentContractUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "talentContractUploadedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "talentContractUploadedBy" TEXT;

        CREATE INDEX IF NOT EXISTS "Show_selloutProjection_idx" ON org_unfy."Show" ("selloutProjection");
        CREATE INDEX IF NOT EXISTS "Show_estimatedEpisodeValue_idx" ON org_unfy."Show" ("estimatedEpisodeValue");
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN org_podcastflow_pro."Show"."selloutProjection" IS 'Projected sellout rate as a percentage (0-100)';
COMMENT ON COLUMN org_podcastflow_pro."Show"."estimatedEpisodeValue" IS 'Estimated revenue value per episode in dollars';
COMMENT ON COLUMN org_podcastflow_pro."Show"."talentContractUrl" IS 'URL to uploaded talent contract document';
COMMENT ON COLUMN org_podcastflow_pro."Show"."talentContractUploadedAt" IS 'Timestamp when talent contract was uploaded';
COMMENT ON COLUMN org_podcastflow_pro."Show"."talentContractUploadedBy" IS 'User ID who uploaded the talent contract';