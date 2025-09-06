-- Add missing fields to Campaign table in all organization schemas
DO $$
DECLARE
    schema_name TEXT;
BEGIN
    -- Add fields to podcastflow_pro schema
    ALTER TABLE org_podcastflow_pro."Campaign" 
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS industry TEXT,
    ADD COLUMN IF NOT EXISTS "adFormats" TEXT[];

    -- Add fields to unfy schema  
    ALTER TABLE org_unfy."Campaign"
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS industry TEXT,
    ADD COLUMN IF NOT EXISTS "adFormats" TEXT[];

    RAISE NOTICE 'Campaign fields added successfully';
END $$;