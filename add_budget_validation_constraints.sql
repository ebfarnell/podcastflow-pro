-- Add database constraints to prevent orphaned HierarchicalBudget records
\c podcastflow_production
SET search_path TO org_podcastflow_pro, public;

-- Note: We cannot add foreign key constraints because the referenced tables are in different schemas
-- Instead, we'll add check constraints to prevent obvious issues

-- 1. Add check constraint to prevent blank entity names
\echo '=== ADDING CHECK CONSTRAINT FOR ENTITY NAMES ==='
ALTER TABLE "HierarchicalBudget" 
ADD CONSTRAINT check_entity_name_not_blank
CHECK ("entityName" IS NOT NULL AND LENGTH(TRIM("entityName")) > 0);

-- 2. Add check constraint to prevent negative budget amounts
\echo '=== ADDING CHECK CONSTRAINT FOR BUDGET AMOUNTS ==='
ALTER TABLE "HierarchicalBudget" 
ADD CONSTRAINT check_budget_amounts_non_negative
CHECK ("budgetAmount" >= 0 AND "actualAmount" >= 0);

-- 3. Add check constraint for valid entity types
\echo '=== ADDING CHECK CONSTRAINT FOR ENTITY TYPES ==='
ALTER TABLE "HierarchicalBudget" 
ADD CONSTRAINT check_valid_entity_types
CHECK ("entityType" IN ('advertiser', 'agency', 'seller'));

-- 4. Add check constraint for valid months
\echo '=== ADDING CHECK CONSTRAINT FOR VALID MONTHS ==='
ALTER TABLE "HierarchicalBudget" 
ADD CONSTRAINT check_valid_months
CHECK ("month" >= 1 AND "month" <= 12);

-- 5. Add check constraint for reasonable years
\echo '=== ADDING CHECK CONSTRAINT FOR REASONABLE YEARS ==='
ALTER TABLE "HierarchicalBudget" 
ADD CONSTRAINT check_reasonable_years
CHECK ("year" >= 2020 AND "year" <= 2050);

-- 6. Add unique constraint to prevent duplicate budget entries
\echo '=== ADDING UNIQUE CONSTRAINT FOR BUDGET ENTRIES ==='
ALTER TABLE "HierarchicalBudget" 
ADD CONSTRAINT unique_budget_entry
UNIQUE ("organizationId", "entityType", "entityId", "year", "month");

-- 7. Verify constraints were added
\echo ''
\echo '=== VERIFY CONSTRAINTS WERE ADDED ==='
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'org_podcastflow_pro."HierarchicalBudget"'::regclass
ORDER BY conname;