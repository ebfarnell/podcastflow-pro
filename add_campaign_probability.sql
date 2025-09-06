-- Add probability field to Campaign model in all schemas
-- Probability values: 10, 35, 65, 90, 100 (percentage of closing)

-- Add to public schema Campaign table (legacy)
ALTER TABLE public."Campaign" 
ADD COLUMN IF NOT EXISTS "probability" INTEGER DEFAULT 10;

COMMENT ON COLUMN public."Campaign"."probability" IS 'Probability of campaign closing (10, 35, 65, 90, 100)';

-- Add to org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Campaign" 
ADD COLUMN IF NOT EXISTS "probability" INTEGER DEFAULT 10;

COMMENT ON COLUMN org_podcastflow_pro."Campaign"."probability" IS 'Probability of campaign closing (10, 35, 65, 90, 100)';

-- Add to org_unfy schema (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        EXECUTE 'ALTER TABLE org_unfy."Campaign" ADD COLUMN IF NOT EXISTS "probability" INTEGER DEFAULT 10';
        EXECUTE 'COMMENT ON COLUMN org_unfy."Campaign"."probability" IS ''Probability of campaign closing (10, 35, 65, 90, 100)''';
    END IF;
END
$$;

-- Add constraint to ensure valid probability values
ALTER TABLE public."Campaign" 
ADD CONSTRAINT IF NOT EXISTS "Campaign_probability_check" 
CHECK ("probability" IN (10, 35, 65, 90, 100));

ALTER TABLE org_podcastflow_pro."Campaign" 
ADD CONSTRAINT IF NOT EXISTS "Campaign_probability_check" 
CHECK ("probability" IN (10, 35, 65, 90, 100));

-- Add constraint to org_unfy if schema exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        EXECUTE 'ALTER TABLE org_unfy."Campaign" ADD CONSTRAINT IF NOT EXISTS "Campaign_probability_check" CHECK ("probability" IN (10, 35, 65, 90, 100))';
    END IF;
END
$$;

-- Update existing campaigns to have a default probability based on their status
UPDATE public."Campaign" 
SET "probability" = CASE 
    WHEN "status" = 'draft' THEN 10
    WHEN "status" = 'active' THEN 90
    WHEN "status" = 'completed' THEN 100
    WHEN "status" = 'cancelled' THEN 10
    ELSE 35
END
WHERE "probability" IS NULL;

UPDATE org_podcastflow_pro."Campaign" 
SET "probability" = CASE 
    WHEN "status" = 'draft' THEN 10
    WHEN "status" = 'active' THEN 90
    WHEN "status" = 'completed' THEN 100
    WHEN "status" = 'cancelled' THEN 10
    ELSE 35
END
WHERE "probability" IS NULL;

-- Update org_unfy if schema exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        EXECUTE 'UPDATE org_unfy."Campaign" SET "probability" = CASE 
            WHEN "status" = ''draft'' THEN 10
            WHEN "status" = ''active'' THEN 90
            WHEN "status" = ''completed'' THEN 100
            WHEN "status" = ''cancelled'' THEN 10
            ELSE 35
        END
        WHERE "probability" IS NULL';
    END IF;
END
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS "Campaign_probability_idx" ON public."Campaign"("probability");
CREATE INDEX IF NOT EXISTS "Campaign_probability_idx" ON org_podcastflow_pro."Campaign"("probability");

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS "Campaign_probability_idx" ON org_unfy."Campaign"("probability")';
    END IF;
END
$$;

-- Verify the changes
SELECT 'public' as schema_name, COUNT(*) as campaign_count, 
       COUNT(CASE WHEN "probability" IS NOT NULL THEN 1 END) as with_probability
FROM public."Campaign"
UNION ALL
SELECT 'org_podcastflow_pro' as schema_name, COUNT(*) as campaign_count,
       COUNT(CASE WHEN "probability" IS NOT NULL THEN 1 END) as with_probability  
FROM org_podcastflow_pro."Campaign";