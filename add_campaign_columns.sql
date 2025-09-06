-- Add missing columns to Campaign table in all organization schemas

-- Add description column to org_podcastflow_pro schema
ALTER TABLE "org_podcastflow_pro"."Campaign" 
ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Add industry column to org_podcastflow_pro schema
ALTER TABLE "org_podcastflow_pro"."Campaign" 
ADD COLUMN IF NOT EXISTS "industry" TEXT;

-- Add description column to org_unfy schema
ALTER TABLE "org_unfy"."Campaign" 
ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Add industry column to org_unfy schema
ALTER TABLE "org_unfy"."Campaign" 
ADD COLUMN IF NOT EXISTS "industry" TEXT;

-- Verify the columns were added
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema IN ('org_podcastflow_pro', 'org_unfy')
    AND table_name = 'Campaign'
    AND column_name IN ('description', 'industry')
ORDER BY table_schema, column_name;