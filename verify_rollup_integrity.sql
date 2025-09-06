-- Verify rollup logic integrity after fixing orphaned records
\c podcastflow_production
SET search_path TO org_podcastflow_pro, public;

-- 1. Check that all HierarchicalBudget records now have valid entity references
\echo '=== VERIFY NO ORPHANED RECORDS REMAIN ==='
SELECT COUNT(*) as total_budget_records FROM "HierarchicalBudget";

SELECT COUNT(*) as orphaned_advertiser_budgets
FROM "HierarchicalBudget" hb
LEFT JOIN "Advertiser" a ON hb."entityId" = a.id AND hb."entityType" = 'advertiser'
WHERE hb."entityType" = 'advertiser' AND a.id IS NULL;

SELECT COUNT(*) as orphaned_agency_budgets
FROM "HierarchicalBudget" hb
LEFT JOIN "Agency" ag ON hb."entityId" = ag.id AND hb."entityType" = 'agency'
WHERE hb."entityType" = 'agency' AND ag.id IS NULL;

-- 2. Verify seller totals are still correct
\echo ''
\echo '=== SELLER ROLLUP VERIFICATION ==='
SELECT 
    u.name as seller_name,
    COUNT(DISTINCT hb.id) as budget_entries,
    SUM(hb."budgetAmount") as total_budget,
    SUM(hb."actualAmount") as total_actual,
    COUNT(DISTINCT CASE WHEN hb."entityType" = 'advertiser' THEN hb."entityId" END) as advertiser_count,
    COUNT(DISTINCT CASE WHEN hb."entityType" = 'agency' THEN hb."entityId" END) as agency_count
FROM public."User" u
LEFT JOIN "HierarchicalBudget" hb ON hb."sellerId" = u.id
WHERE u.role = 'sales' AND u."isActive" = true
GROUP BY u.id, u.name
ORDER BY u.name;

-- 3. Check that BudgetRollupCache is still valid (if it exists)
\echo ''
\echo '=== BUDGET ROLLUP CACHE VALIDATION ==='
SELECT COUNT(*) as cache_entries FROM "BudgetRollupCache";

-- 4. Verify advertiser totals
\echo ''
\echo '=== ADVERTISER BUDGET TOTALS ==='
SELECT 
    a.name as advertiser_name,
    COALESCE(ag.name, 'No Agency') as agency_name,
    u.name as seller_name,
    COALESCE(SUM(hb."budgetAmount"), 0) as total_budget,
    COALESCE(SUM(hb."actualAmount"), 0) as total_actual
FROM "Advertiser" a
LEFT JOIN "Agency" ag ON a."agencyId" = ag.id
LEFT JOIN public."User" u ON a."sellerId" = u.id
LEFT JOIN "HierarchicalBudget" hb ON hb."entityId" = a.id AND hb."entityType" = 'advertiser'
WHERE a."isActive" = true
GROUP BY a.id, a.name, ag.name, u.name
ORDER BY u.name, ag.name, a.name;

-- 5. Check for any remaining "Direct" issues in entity names
\echo ''
\echo '=== CHECK FOR REMAINING DIRECT NAMING ISSUES ==='
SELECT 
    hb."entityType",
    hb."entityId", 
    hb."entityName",
    CASE 
        WHEN hb."entityType" = 'advertiser' THEN a.name
        WHEN hb."entityType" = 'agency' THEN ag.name  
        WHEN hb."entityType" = 'seller' THEN u.name
    END as actual_entity_name,
    CASE 
        WHEN hb."entityType" = 'advertiser' AND a.id IS NULL THEN 'MISSING_ADVERTISER'
        WHEN hb."entityType" = 'agency' AND ag.id IS NULL THEN 'MISSING_AGENCY'
        WHEN hb."entityType" = 'seller' AND u.id IS NULL THEN 'MISSING_SELLER'
        WHEN hb."entityName" IS NULL OR hb."entityName" = '' THEN 'BLANK_NAME'
        WHEN hb."entityName" = 'Direct' THEN 'DIRECT_NAME'
        ELSE 'OK'
    END as validation_status
FROM "HierarchicalBudget" hb
LEFT JOIN "Advertiser" a ON hb."entityType" = 'advertiser' AND hb."entityId" = a.id
LEFT JOIN "Agency" ag ON hb."entityType" = 'agency' AND hb."entityId" = ag.id  
LEFT JOIN public."User" u ON hb."entityType" = 'seller' AND hb."entityId" = u.id
WHERE validation_status != 'OK'
ORDER BY validation_status, hb."entityType";

-- 6. Summary
\echo ''
\echo '=== FINAL VERIFICATION SUMMARY ==='
SELECT 
    'Total HierarchicalBudget records' as metric,
    COUNT(*)::text as value
FROM "HierarchicalBudget"

UNION ALL

SELECT 
    'Records with valid entity references' as metric,
    COUNT(*)::text as value
FROM "HierarchicalBudget" hb
LEFT JOIN "Advertiser" a ON hb."entityType" = 'advertiser' AND hb."entityId" = a.id AND a."isActive" = true
LEFT JOIN "Agency" ag ON hb."entityType" = 'agency' AND hb."entityId" = ag.id AND ag."isActive" = true
LEFT JOIN public."User" u ON hb."entityType" = 'seller' AND hb."entityId" = u.id AND u."isActive" = true
WHERE (hb."entityType" = 'advertiser' AND a.id IS NOT NULL)
   OR (hb."entityType" = 'agency' AND ag.id IS NOT NULL)
   OR (hb."entityType" = 'seller' AND u.id IS NOT NULL)

UNION ALL

SELECT 
    'Total budget amount' as metric,
    TO_CHAR(SUM("budgetAmount"), 'FM999,999,999.00') as value
FROM "HierarchicalBudget"

UNION ALL

SELECT 
    'Total actual amount' as metric,
    TO_CHAR(SUM("actualAmount"), 'FM999,999,999.00') as value
FROM "HierarchicalBudget";