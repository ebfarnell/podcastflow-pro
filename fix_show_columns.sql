-- Check and add missing columns to Show table in org schemas

-- Function to add columns if they don't exist
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Loop through all org schemas
    FOR r IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Check and add selloutProjection column
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = r.schema_name 
            AND table_name = 'Show' 
            AND column_name = 'selloutProjection'
        ) THEN
            EXECUTE format('ALTER TABLE %I."Show" ADD COLUMN "selloutProjection" DOUBLE PRECISION DEFAULT 0', r.schema_name);
            RAISE NOTICE 'Added selloutProjection to %.Show', r.schema_name;
        END IF;
        
        -- Check and add estimatedEpisodeValue column
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = r.schema_name 
            AND table_name = 'Show' 
            AND column_name = 'estimatedEpisodeValue'
        ) THEN
            EXECUTE format('ALTER TABLE %I."Show" ADD COLUMN "estimatedEpisodeValue" DOUBLE PRECISION DEFAULT 0', r.schema_name);
            RAISE NOTICE 'Added estimatedEpisodeValue to %.Show', r.schema_name;
        END IF;
    END LOOP;
END $$;

-- Verify columns were added
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema LIKE 'org_%'
AND table_name = 'Show'
AND column_name IN ('selloutProjection', 'estimatedEpisodeValue')
ORDER BY table_schema, column_name;