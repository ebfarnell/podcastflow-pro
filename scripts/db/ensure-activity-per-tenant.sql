-- Ensure Activity table exists in each org-specific schema
-- This script is idempotent and safe to run multiple times

DO $$
DECLARE
    org_schema text;
    create_count integer := 0;
    skip_count integer := 0;
BEGIN
    -- Loop through all org schemas
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
        ORDER BY schema_name
    LOOP
        -- Check if Activity table already exists in this schema
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = org_schema 
            AND table_name = 'Activity'
        ) THEN
            -- Create the Activity table
            EXECUTE format('
                CREATE TABLE %I."Activity" (
                    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    action TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    actor_id TEXT,
                    metadata JSONB DEFAULT ''{}''::jsonb NOT NULL,
                    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    -- Legacy columns for compatibility
                    type TEXT GENERATED ALWAYS AS (action) STORED,
                    description TEXT,
                    "userId" TEXT GENERATED ALWAYS AS (actor_id) STORED,
                    "organizationId" TEXT
                )', org_schema);

            -- Create indexes for performance
            EXECUTE format('CREATE INDEX "Activity_createdAt_idx" ON %I."Activity" ("createdAt")', org_schema);
            EXECUTE format('CREATE INDEX "Activity_action_idx" ON %I."Activity" (action)', org_schema);
            EXECUTE format('CREATE INDEX "Activity_entity_idx" ON %I."Activity" (entity_type, entity_id)', org_schema);
            EXECUTE format('CREATE INDEX "Activity_actor_idx" ON %I."Activity" (actor_id)', org_schema);
            EXECUTE format('CREATE INDEX "Activity_metadata_gin" ON %I."Activity" USING GIN (metadata)', org_schema);

            -- Set ownership and permissions
            EXECUTE format('ALTER TABLE %I."Activity" OWNER TO podcastflow', org_schema);
            EXECUTE format('GRANT USAGE ON SCHEMA %I TO podcastflow', org_schema);
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I."Activity" TO podcastflow', org_schema);

            RAISE NOTICE 'Created Activity table in schema: %', org_schema;
            create_count := create_count + 1;
        ELSE
            RAISE NOTICE 'Activity table already exists in schema: %', org_schema;
            skip_count := skip_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '=== Activity Table Creation Summary ===';
    RAISE NOTICE 'Tables created: %', create_count;
    RAISE NOTICE 'Tables skipped (already exist): %', skip_count;
    RAISE NOTICE 'Total org schemas processed: %', create_count + skip_count;
END $$;

-- Verify the Activity tables were created
SELECT 
    table_schema as org_schema,
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = t.table_schema 
     AND table_name = 'Activity') as column_count,
    (SELECT COUNT(*) FROM pg_indexes 
     WHERE schemaname = t.table_schema 
     AND tablename = 'Activity') as index_count
FROM information_schema.tables t
WHERE table_name = 'Activity'
AND table_schema LIKE 'org_%'
ORDER BY table_schema;