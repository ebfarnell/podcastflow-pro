-- Comprehensive Audit for "Direct" Advertiser Issue
-- Generated: July 31, 2025

-- Connect to the database and set schema search path
\c podcastflow_production
SET search_path TO org_podcastflow_pro, public;

-- 1. Find all advertisers without agencies (these show as "Direct" in UI)
\echo '=== ADVERTISERS WITHOUT AGENCIES (Show as "Direct" in UI) ==='
SELECT 
    a.id,
    a.name,
    a."contactEmail",
    a."agencyId",
    a."isActive",
    a."createdAt",
    a."createdBy",
    COUNT(DISTINCT c.id) as campaign_count,
    COALESCE(SUM(c.budget), 0) as total_budget
FROM "Advertiser" a
LEFT JOIN "Campaign" c ON c."advertiserId" = a.id
WHERE a."agencyId" IS NULL
    AND a."isActive" = true
GROUP BY a.id, a.name, a."contactEmail", a."agencyId", a."isActive", a."createdAt", a."createdBy"
ORDER BY a.name;

-- 2. Check for orphaned billing records
\echo ''
\echo '=== ORPHANED BILLING RECORDS (No matching advertiser) ==='
SELECT 
    i.id as invoice_id,
    i."invoiceNumber",
    i."advertiserId",
    i.amount,
    i."dueDate",
    i.status,
    i."createdAt"
FROM "Invoice" i
LEFT JOIN "Advertiser" a ON a.id = i."advertiserId"
WHERE a.id IS NULL
ORDER BY i."createdAt" DESC;

-- 3. Check for campaigns with missing or invalid advertiser references
\echo ''
\echo '=== CAMPAIGNS WITH MISSING ADVERTISERS ==='
SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    c."advertiserId",
    c.budget,
    c.status,
    c."createdAt"
FROM "Campaign" c
LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
WHERE a.id IS NULL OR a."isActive" = false
ORDER BY c."createdAt" DESC;

-- 4. Check goals/budgets with missing advertiser references
\echo ''
\echo '=== HIERARCHICAL BUDGETS WITH MISSING ADVERTISERS ==='
SELECT 
    hb.id,
    hb."entityType",
    hb."entityId",
    hb."budgetType",
    hb.year,
    hb.month,
    hb."budgetAmount",
    hb."actualAmount"
FROM "HierarchicalBudget" hb
LEFT JOIN "Advertiser" a ON a.id = hb."entityId" AND hb."entityType" = 'advertiser'
WHERE hb."entityType" = 'advertiser' 
    AND a.id IS NULL
ORDER BY hb.year DESC, hb.month DESC;

-- 5. Summary of all advertisers by agency status
\echo ''
\echo '=== ADVERTISER SUMMARY BY AGENCY STATUS ==='
SELECT 
    CASE 
        WHEN a."agencyId" IS NULL THEN 'Direct (No Agency)'
        ELSE 'Has Agency'
    END as agency_status,
    COUNT(DISTINCT a.id) as advertiser_count,
    COUNT(DISTINCT c.id) as total_campaigns,
    COALESCE(SUM(c.budget), 0) as total_budget,
    COALESCE(AVG(c.budget), 0) as avg_campaign_budget
FROM "Advertiser" a
LEFT JOIN "Campaign" c ON c."advertiserId" = a.id
WHERE a."isActive" = true
GROUP BY CASE WHEN a."agencyId" IS NULL THEN 'Direct (No Agency)' ELSE 'Has Agency' END;

-- 6. Check for advertisers with blank or null names
\echo ''
\echo '=== ADVERTISERS WITH BLANK OR NULL NAMES ==='
SELECT 
    id,
    name,
    "contactEmail",
    "agencyId",
    "isActive",
    "createdAt"
FROM "Advertiser"
WHERE name IS NULL 
    OR name = ''
    OR name ~ '^\s*$'
ORDER BY "createdAt" DESC;

-- 7. Revenue data for direct advertisers
\echo ''
\echo '=== REVENUE DATA FOR DIRECT ADVERTISERS ==='
SELECT 
    a.id,
    a.name,
    COUNT(DISTINCT i.id) as invoice_count,
    COALESCE(SUM(i.amount), 0) as total_invoiced,
    COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END), 0) as total_paid,
    COUNT(DISTINCT c.id) as campaign_count
FROM "Advertiser" a
LEFT JOIN "Invoice" i ON i."advertiserId" = a.id
LEFT JOIN "Campaign" c ON c."advertiserId" = a.id
WHERE a."agencyId" IS NULL
    AND a."isActive" = true
GROUP BY a.id, a.name
HAVING COUNT(DISTINCT i.id) > 0 OR COUNT(DISTINCT c.id) > 0
ORDER BY total_invoiced DESC;

-- 8. Export all direct advertiser data for detailed analysis
\echo ''
\echo '=== DETAILED DIRECT ADVERTISER DATA FOR EXPORT ==='
\copy (SELECT a.*, 'Direct' as display_agency FROM "Advertiser" a WHERE a."agencyId" IS NULL AND a."isActive" = true ORDER BY a.name) TO '/tmp/direct_advertisers_export.csv' WITH CSV HEADER;
\echo 'Exported to: /tmp/direct_advertisers_export.csv'

-- 9. Count totals
\echo ''
\echo '=== SUMMARY COUNTS ==='
SELECT 
    (SELECT COUNT(*) FROM "Advertiser" WHERE "agencyId" IS NULL AND "isActive" = true) as direct_advertisers,
    (SELECT COUNT(*) FROM "Advertiser" WHERE "agencyId" IS NOT NULL AND "isActive" = true) as agency_advertisers,
    (SELECT COUNT(*) FROM "Campaign" c JOIN "Advertiser" a ON a.id = c."advertiserId" WHERE a."agencyId" IS NULL AND a."isActive" = true) as direct_campaigns,
    (SELECT COALESCE(SUM(budget), 0) FROM "Campaign" c JOIN "Advertiser" a ON a.id = c."advertiserId" WHERE a."agencyId" IS NULL AND a."isActive" = true) as direct_total_budget;