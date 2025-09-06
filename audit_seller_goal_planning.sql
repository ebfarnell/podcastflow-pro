-- Comprehensive Audit for Seller Goal Planning "Direct" Issue
-- Generated: July 31, 2025

\c podcastflow_production
SET search_path TO org_podcastflow_pro, public;

-- 1. Check all advertisers for null/blank names
\echo '=== ADVERTISERS WITH NULL/BLANK NAMES ==='
SELECT 
    id,
    name,
    "contactEmail",
    "agencyId",
    "sellerId",
    "isActive",
    "createdAt",
    "createdBy"
FROM "Advertiser"
WHERE name IS NULL 
    OR name = ''
    OR name ~ '^\s*$'
    OR LENGTH(TRIM(name)) = 0
ORDER BY "createdAt" DESC;

-- 2. Check for campaigns with missing or invalid advertiser references
\echo ''
\echo '=== CAMPAIGNS WITH MISSING/INVALID ADVERTISERS ==='
SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    c."advertiserId",
    c.budget,
    c.status,
    c."createdAt",
    a.name as advertiser_name,
    a."isActive" as advertiser_active
FROM "Campaign" c
LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
WHERE a.id IS NULL 
    OR a."isActive" = false 
    OR a.name IS NULL 
    OR a.name = ''
    OR LENGTH(TRIM(a.name)) = 0
ORDER BY c."createdAt" DESC;

-- 3. Check HierarchicalBudget table for problematic advertiser records
\echo ''
\echo '=== HIERARCHICAL BUDGETS WITH PROBLEMATIC ADVERTISERS ==='
SELECT 
    hb.id,
    hb."entityType",
    hb."entityId",
    hb.year,
    hb.month,
    hb."budgetAmount",
    hb."actualAmount",
    a.name as advertiser_name,
    a."isActive" as advertiser_active,
    CASE 
        WHEN a.id IS NULL THEN 'MISSING_ADVERTISER'
        WHEN a.name IS NULL OR a.name = '' OR LENGTH(TRIM(a.name)) = 0 THEN 'BLANK_NAME'
        WHEN a."isActive" = false THEN 'INACTIVE'
        ELSE 'OK'
    END as issue_type
FROM "HierarchicalBudget" hb
LEFT JOIN "Advertiser" a ON a.id = hb."entityId" AND hb."entityType" = 'advertiser'
WHERE hb."entityType" = 'advertiser' 
    AND (
        a.id IS NULL 
        OR a."isActive" = false 
        OR a.name IS NULL 
        OR a.name = ''
        OR LENGTH(TRIM(a.name)) = 0
    )
ORDER BY hb.year DESC, hb.month DESC;

-- 4. Check for seller assignments that might create "Direct" entries
\echo ''
\echo '=== SELLER ASSIGNMENTS AND ADVERTISER RELATIONSHIPS ==='
SELECT 
    u.id as seller_id,
    u.name as seller_name,
    COUNT(DISTINCT a.id) as advertiser_count,
    COUNT(DISTINCT CASE WHEN a.name IS NULL OR a.name = '' OR LENGTH(TRIM(a.name)) = 0 THEN a.id END) as blank_name_count,
    COUNT(DISTINCT CASE WHEN a."agencyId" IS NULL THEN a.id END) as no_agency_count
FROM "User" u
LEFT JOIN "Advertiser" a ON a."sellerId" = u.id
WHERE u.role = 'sales' AND u."isActive" = true
GROUP BY u.id, u.name
ORDER BY u.name;

-- 5. Check budget rollup cache for "Direct" entries
\echo ''
\echo '=== BUDGET ROLLUP CACHE ANALYSIS ==='
SELECT 
    brc.id,
    brc."entityType",
    brc."entityId",
    brc.year,
    brc.month,
    brc."totalBudget",
    brc."totalActual",
    CASE 
        WHEN brc."entityType" = 'seller' THEN u.name
        WHEN brc."entityType" = 'agency' THEN ag.name
        WHEN brc."entityType" = 'advertiser' THEN a.name
        ELSE 'UNKNOWN'
    END as entity_name,
    CASE 
        WHEN brc."entityType" = 'advertiser' AND (a.name IS NULL OR a.name = '' OR LENGTH(TRIM(a.name)) = 0) THEN 'BLANK_ADVERTISER_NAME'
        WHEN brc."entityType" = 'advertiser' AND a.id IS NULL THEN 'MISSING_ADVERTISER'
        WHEN brc."entityType" = 'agency' AND (ag.name IS NULL OR ag.name = '' OR LENGTH(TRIM(ag.name)) = 0) THEN 'BLANK_AGENCY_NAME'
        WHEN brc."entityType" = 'agency' AND ag.id IS NULL THEN 'MISSING_AGENCY'
        WHEN brc."entityType" = 'seller' AND (u.name IS NULL OR u.name = '' OR LENGTH(TRIM(u.name)) = 0) THEN 'BLANK_SELLER_NAME'
        WHEN brc."entityType" = 'seller' AND u.id IS NULL THEN 'MISSING_SELLER'
        ELSE 'OK'
    END as validation_status
FROM "BudgetRollupCache" brc
LEFT JOIN "User" u ON u.id = brc."entityId" AND brc."entityType" = 'seller'
LEFT JOIN "Agency" ag ON ag.id = brc."entityId" AND brc."entityType" = 'agency'
LEFT JOIN "Advertiser" a ON a.id = brc."entityId" AND brc."entityType" = 'advertiser'
WHERE validation_status != 'OK'
ORDER BY brc.year DESC, brc.month DESC;

-- 6. Check for any records that might be generating "Direct" in rollups
\echo ''
\echo '=== POTENTIAL 'DIRECT' GENERATORS IN SELLER ROLLUPS ==='
SELECT DISTINCT
    'Campaign with null advertiser' as record_type,
    c.id as record_id,
    c.name as record_name,
    c.budget as budget_amount,
    NULL as entity_name
FROM "Campaign" c
LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
WHERE a.id IS NULL

UNION ALL

SELECT DISTINCT
    'Advertiser with blank name' as record_type,
    a.id as record_id,
    COALESCE(a.name, '[NULL]') as record_name,
    0 as budget_amount,
    COALESCE(a.name, '[NULL]') as entity_name
FROM "Advertiser" a
WHERE a.name IS NULL OR a.name = '' OR LENGTH(TRIM(a.name)) = 0

UNION ALL

SELECT DISTINCT
    'HierarchicalBudget with missing advertiser' as record_type,
    hb.id as record_id,
    'Budget Entry' as record_name,
    hb."budgetAmount" as budget_amount,
    'Missing Advertiser ID: ' || hb."entityId" as entity_name
FROM "HierarchicalBudget" hb
LEFT JOIN "Advertiser" a ON a.id = hb."entityId"
WHERE hb."entityType" = 'advertiser' AND a.id IS NULL

ORDER BY record_type, budget_amount DESC;

-- 7. Export problematic records for analysis
\echo ''
\echo '=== EXPORTING PROBLEMATIC RECORDS ==='
\copy (
    SELECT 
        'advertiser' as table_name,
        id,
        COALESCE(name, '[NULL]') as name,
        "sellerId",
        "agencyId",
        "isActive",
        "createdAt"::text
    FROM "Advertiser"
    WHERE name IS NULL OR name = '' OR LENGTH(TRIM(name)) = 0
    
    UNION ALL
    
    SELECT 
        'campaign' as table_name,
        c.id,
        c.name,
        NULL as "sellerId",
        c."advertiserId" as "agencyId",
        CASE WHEN c.status = 'active' THEN true ELSE false END as "isActive",
        c."createdAt"::text
    FROM "Campaign" c
    LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
    WHERE a.id IS NULL OR a.name IS NULL OR a.name = '' OR LENGTH(TRIM(a.name)) = 0
) TO '/tmp/problematic_records.csv' WITH CSV HEADER;

\echo 'Exported to: /tmp/problematic_records.csv'

-- 8. Summary counts
\echo ''
\echo '=== SUMMARY COUNTS ==='
SELECT 
    'Total Advertisers' as metric,
    COUNT(*)::text as count
FROM "Advertiser"
WHERE "isActive" = true

UNION ALL

SELECT 
    'Advertisers with blank names' as metric,
    COUNT(*)::text as count
FROM "Advertiser"
WHERE ("name" IS NULL OR "name" = '' OR LENGTH(TRIM("name")) = 0) AND "isActive" = true

UNION ALL

SELECT 
    'Campaigns with missing advertisers' as metric,
    COUNT(*)::text as count
FROM "Campaign" c
LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
WHERE a.id IS NULL

UNION ALL

SELECT 
    'Budget entries with missing advertisers' as metric,
    COUNT(*)::text as count
FROM "HierarchicalBudget" hb
LEFT JOIN "Advertiser" a ON a.id = hb."entityId"
WHERE hb."entityType" = 'advertiser' AND a.id IS NULL

ORDER BY metric;