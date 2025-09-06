-- Fix orphaned HierarchicalBudget record
\c podcastflow_production
SET search_path TO org_podcastflow_pro, public;

-- First, let's see the problematic record
\echo '=== PROBLEMATIC HIERARCHICAL BUDGET RECORD ==='
SELECT 
    hb.id,
    hb."entityType",
    hb."entityId",
    hb."entityName",
    hb.year,
    hb.month,
    hb."budgetAmount",
    hb."actualAmount",
    hb."sellerId",
    hb."createdAt",
    hb."createdBy"
FROM "HierarchicalBudget" hb
WHERE hb."entityId" = 'adv_new_1' AND hb."entityType" = 'advertiser';

-- Delete the orphaned record
\echo ''
\echo '=== DELETING ORPHANED BUDGET RECORD ==='
DELETE FROM "HierarchicalBudget" 
WHERE "entityId" = 'adv_new_1' AND "entityType" = 'advertiser';

-- Verify it's gone
\echo ''
\echo '=== VERIFICATION - SHOULD BE NO ROWS ==='
SELECT COUNT(*) as remaining_orphaned_records
FROM "HierarchicalBudget" hb
LEFT JOIN "Advertiser" a ON hb."entityId" = a.id AND hb."entityType" = 'advertiser'
WHERE hb."entityType" = 'advertiser' AND a.id IS NULL;