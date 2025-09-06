-- Add monetization columns to Show table in org schemas
DO $$
DECLARE
    org_schema TEXT;
BEGIN
    -- Add columns to each organization schema
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Add pricing model column
        EXECUTE format('
            ALTER TABLE %I."Show" 
            ADD COLUMN IF NOT EXISTS "pricingModel" TEXT DEFAULT ''cpm''
        ', org_schema);
        
        -- Add CPM pricing columns
        EXECUTE format('
            ALTER TABLE %I."Show" 
            ADD COLUMN IF NOT EXISTS "preRollCpm" DOUBLE PRECISION DEFAULT 25,
            ADD COLUMN IF NOT EXISTS "midRollCpm" DOUBLE PRECISION DEFAULT 30,
            ADD COLUMN IF NOT EXISTS "postRollCpm" DOUBLE PRECISION DEFAULT 20
        ', org_schema);
        
        -- Add spot pricing columns
        EXECUTE format('
            ALTER TABLE %I."Show" 
            ADD COLUMN IF NOT EXISTS "preRollSpotCost" DOUBLE PRECISION DEFAULT 500,
            ADD COLUMN IF NOT EXISTS "midRollSpotCost" DOUBLE PRECISION DEFAULT 750,
            ADD COLUMN IF NOT EXISTS "postRollSpotCost" DOUBLE PRECISION DEFAULT 400
        ', org_schema);
        
        -- Add slot availability columns
        EXECUTE format('
            ALTER TABLE %I."Show" 
            ADD COLUMN IF NOT EXISTS "preRollSlots" INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS "midRollSlots" INTEGER DEFAULT 2,
            ADD COLUMN IF NOT EXISTS "postRollSlots" INTEGER DEFAULT 1
        ', org_schema);
        
        -- Add average episode downloads column
        EXECUTE format('
            ALTER TABLE %I."Show" 
            ADD COLUMN IF NOT EXISTS "avgEpisodeDownloads" INTEGER DEFAULT 5000
        ', org_schema);
        
        -- Add estimated episode value column
        EXECUTE format('
            ALTER TABLE %I."Show" 
            ADD COLUMN IF NOT EXISTS "estimatedEpisodeValue" DOUBLE PRECISION DEFAULT 0
        ', org_schema);
        
        RAISE NOTICE 'Added monetization columns to %.Show', org_schema;
    END LOOP;
END $$;

-- Verify columns were added
SELECT 
    table_schema,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema LIKE 'org_%'
  AND table_name = 'Show'
  AND column_name IN (
    'pricingModel', 
    'preRollCpm', 'midRollCpm', 'postRollCpm',
    'preRollSpotCost', 'midRollSpotCost', 'postRollSpotCost',
    'preRollSlots', 'midRollSlots', 'postRollSlots',
    'avgEpisodeDownloads', 'estimatedEpisodeValue'
  )
ORDER BY table_schema, column_name;