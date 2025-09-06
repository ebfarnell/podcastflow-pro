-- Add probability field to Campaign model in organization schemas only
-- Probability values: 10, 35, 65, 90, 100 (percentage of closing)

-- Add to org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Campaign" 
ADD COLUMN "probability" INTEGER DEFAULT 10;

COMMENT ON COLUMN org_podcastflow_pro."Campaign"."probability" IS 'Probability of campaign closing (10, 35, 65, 90, 100)';

-- Add to org_unfy schema (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        EXECUTE 'ALTER TABLE org_unfy."Campaign" ADD COLUMN "probability" INTEGER DEFAULT 10';
        EXECUTE 'COMMENT ON COLUMN org_unfy."Campaign"."probability" IS ''Probability of campaign closing (10, 35, 65, 90, 100)''';
    END IF;
END
$$;

-- Add constraint to ensure valid probability values (drop first if exists)
DO $$
BEGIN
    BEGIN
        ALTER TABLE org_podcastflow_pro."Campaign" 
        ADD CONSTRAINT "Campaign_probability_check" 
        CHECK ("probability" IN (10, 35, 65, 90, 100));
    EXCEPTION 
        WHEN duplicate_object THEN NULL;
    END;
END
$$;

-- Add constraint to org_unfy if schema exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        BEGIN
            EXECUTE 'ALTER TABLE org_unfy."Campaign" ADD CONSTRAINT "Campaign_probability_check" CHECK ("probability" IN (10, 35, 65, 90, 100))';
        EXCEPTION 
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END
$$;

-- Update existing campaigns to have a default probability based on their status
UPDATE org_podcastflow_pro."Campaign" 
SET "probability" = CASE 
    WHEN "status" = 'draft' THEN 10
    WHEN "status" = 'active' THEN 90
    WHEN "status" = 'completed' THEN 100
    WHEN "status" = 'cancelled' THEN 10
    ELSE 35
END
WHERE "probability" IS NULL OR "probability" = 10;

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
        WHERE "probability" IS NULL OR "probability" = 10';
    END IF;
END
$$;

-- Create index for performance
DO $$
BEGIN
    BEGIN
        CREATE INDEX "Campaign_probability_idx" ON org_podcastflow_pro."Campaign"("probability");
    EXCEPTION 
        WHEN duplicate_table THEN NULL;
    END;
END
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'org_unfy') THEN
        BEGIN
            EXECUTE 'CREATE INDEX "Campaign_probability_idx" ON org_unfy."Campaign"("probability")';
        EXCEPTION 
            WHEN duplicate_table THEN NULL;
        END;
    END IF;
END
$$;

-- Verify the changes
SELECT 'org_podcastflow_pro' as schema_name, COUNT(*) as campaign_count,
       COUNT(CASE WHEN "probability" IS NOT NULL THEN 1 END) as with_probability,
       MIN("probability") as min_prob, MAX("probability") as max_prob
FROM org_podcastflow_pro."Campaign";