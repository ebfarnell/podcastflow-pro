-- Remove all BudgetRollupCache references from all organization schemas

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
        -- Drop BudgetRollupCache table if it exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = r.schema_name 
            AND table_name = 'BudgetRollupCache'
        ) THEN
            EXECUTE format('DROP TABLE IF EXISTS %I."BudgetRollupCache" CASCADE', r.schema_name);
            RAISE NOTICE 'Dropped BudgetRollupCache from %', r.schema_name;
        END IF;
        
        -- Drop any functions related to BudgetRollupCache
        IF EXISTS (
            SELECT 1 
            FROM information_schema.routines 
            WHERE routine_schema = r.schema_name 
            AND routine_name = 'update_budget_rollup_cache'
        ) THEN
            EXECUTE format('DROP FUNCTION IF EXISTS %I.update_budget_rollup_cache CASCADE', r.schema_name);
            RAISE NOTICE 'Dropped update_budget_rollup_cache function from %', r.schema_name;
        END IF;
        
        -- Drop any triggers related to BudgetRollupCache
        IF EXISTS (
            SELECT 1 
            FROM information_schema.triggers 
            WHERE trigger_schema = r.schema_name 
            AND trigger_name = 'trigger_update_budget_rollup_cache'
        ) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_update_budget_rollup_cache ON %I."HierarchicalBudget"', r.schema_name);
            RAISE NOTICE 'Dropped trigger_update_budget_rollup_cache from %', r.schema_name;
        END IF;
    END LOOP;
END $$;

-- Verify removal
SELECT 
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema LIKE 'org_%'
AND table_name = 'BudgetRollupCache';

-- Also check for any functions
SELECT 
    routine_schema,
    routine_name
FROM information_schema.routines
WHERE routine_schema LIKE 'org_%'
AND routine_name LIKE '%budget_rollup%';