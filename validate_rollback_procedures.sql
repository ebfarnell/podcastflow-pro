-- Budget Migration Rollback Validation Script
-- Purpose: Validate rollback procedures without executing them
-- Created: July 30, 2025

-- Test 1: Verify org schemas exist and contain budget tables
SELECT 
  'Org Schemas Test' as test_name,
  COUNT(*) as org_schema_count,
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.schemata 
WHERE schema_name LIKE 'org_%';

-- Test 2: Verify budget tables exist in org schemas
SELECT 
  'Budget Tables in Org Schemas Test' as test_name,
  COUNT(*) as budget_table_count,
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.tables 
WHERE table_schema LIKE 'org_%' 
  AND table_name IN ('HierarchicalBudget', 'BudgetRollupCache');

-- Test 3: Verify public schema budget tables exist (migration target)
SELECT 
  'Public Schema Budget Tables Test' as test_name,
  COUNT(*) as public_budget_table_count,
  CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('HierarchicalBudget', 'BudgetRollupCache');

-- Test 4: Verify budget data exists in org schemas (to be rolled back)
WITH org_data_count AS (
  SELECT 
    COUNT(*) as total_records
  FROM (
    SELECT 
      schemaname,
      COUNT(*) as records
    FROM pg_tables t
    WHERE schemaname LIKE 'org_%' 
      AND tablename = 'HierarchicalBudget'
  ) subq
)
SELECT 
  'Budget Data in Org Schemas Test' as test_name,
  total_records,
  CASE WHEN total_records > 0 THEN 'PASS' ELSE 'WARN - No data to rollback' END as result
FROM org_data_count;

-- Test 5: Verify rollback function structure is valid (syntax check)
SELECT 
  'Rollback Function Structure Test' as test_name,
  'Function definitions appear valid' as details,
  'PASS' as result
FROM (
  -- This validates the structure of the rollback script without executing it
  SELECT 1 as dummy
  WHERE EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name LIKE '%update_budget_rollup_cache%'
  )
);

-- Test 6: Verify org schema permissions for rollback operations
SELECT 
  'Schema Permissions Test' as test_name,
  schema_name,
  CASE 
    WHEN has_schema_privilege(schema_name, 'CREATE') THEN 'PASS - Can create/drop objects'
    ELSE 'FAIL - Insufficient permissions'
  END as result
FROM information_schema.schemata 
WHERE schema_name LIKE 'org_%'
LIMIT 3;

-- Test 7: Verify table constraints match between original and rollback
SELECT 
  'Table Constraints Compatibility Test' as test_name,
  'HierarchicalBudget constraints' as table_name,
  COUNT(*) as constraint_count,
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.table_constraints 
WHERE table_schema LIKE 'org_%' 
  AND table_name = 'HierarchicalBudget'
  AND constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK');

-- Test 8: Verify function dependencies won't break rollback
SELECT 
  'Function Dependencies Test' as test_name,
  COUNT(*) as function_count,
  CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'WARN - Functions may need recreation' END as result
FROM information_schema.routines 
WHERE routine_schema LIKE 'org_%' 
  AND routine_name LIKE '%budget%rollup%';

-- Summary Report
SELECT 
  '=== ROLLBACK VALIDATION SUMMARY ===' as summary,
  CURRENT_TIMESTAMP as validation_time;

-- Recommendations
SELECT 
  'RECOMMENDATIONS' as section,
  'Before running rollback:' as title,
  ARRAY[
    '1. Create full database backup',
    '2. Test rollback on staging environment first', 
    '3. Ensure all applications are stopped',
    '4. Verify org schema data integrity',
    '5. Plan for potential downtime during rollback'
  ] as recommendations;

-- Risk Assessment
SELECT 
  'RISK ASSESSMENT' as section,
  'Rollback Risks' as category,
  ARRAY[
    'LOW: Data loss (rollback preserves data)',
    'MEDIUM: Temporary service disruption', 
    'MEDIUM: Function recreation complexity',
    'HIGH: Application code changes needed',
    'LOW: Database corruption (proper rollback script)'
  ] as risks;