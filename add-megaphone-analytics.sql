-- Add Megaphone Analytics fields to Episode table for all organization schemas
DO $$
DECLARE
    org_schema text;
BEGIN
    -- Loop through all organization schemas
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Add Megaphone analytics columns to Episode table
        EXECUTE format('
            ALTER TABLE %I."Episode" 
            ADD COLUMN IF NOT EXISTS "megaphoneId" TEXT,
            ADD COLUMN IF NOT EXISTS "megaphoneDownloads" BIGINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "megaphoneImpressions" BIGINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "megaphoneUniqueListeners" INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "megaphoneAvgListenTime" INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "megaphoneCompletionRate" NUMERIC(5,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "megaphoneUrl" TEXT,
            ADD COLUMN IF NOT EXISTS "megaphoneLastSync" TIMESTAMP(3),
            ADD COLUMN IF NOT EXISTS "audioDeliveryPlatform" TEXT DEFAULT ''megaphone''
        ', org_schema);
        
        -- Add index for Megaphone ID
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "idx_episode_megaphone_id" 
            ON %I."Episode" ("megaphoneId")
            WHERE "megaphoneId" IS NOT NULL
        ', org_schema);
        
        RAISE NOTICE 'Added Megaphone analytics fields to %.Episode', org_schema;
    END LOOP;
END $$;