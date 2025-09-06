-- Rollback Script: Budget Tables Migration
-- Purpose: Rollback the migration of budget tables from org schemas back to public schema
-- Created: July 30, 2025
-- 
-- WARNING: This script will:
-- 1. Restore data from org schemas back to public schema
-- 2. Drop budget tables from org schemas
-- 3. Restore original public schema functions and triggers
-- 
-- Only run this if the migration needs to be rolled back!

-- ==============================================================================
-- PHASE 1: Backup current public schema data (if any new data was created)
-- ==============================================================================

-- Create backup tables
CREATE TABLE IF NOT EXISTS public."HierarchicalBudget_backup_" AS 
SELECT * FROM public."HierarchicalBudget";

CREATE TABLE IF NOT EXISTS public."BudgetRollupCache_backup_" AS 
SELECT * FROM public."BudgetRollupCache";

-- ==============================================================================
-- PHASE 2: Restore data from org schemas to public schema
-- ==============================================================================

-- Function to restore data from org schema to public
CREATE OR REPLACE FUNCTION restore_budget_data_from_org(org_schema_name TEXT)
RETURNS INTEGER AS $$
DECLARE
  restored_budgets INTEGER := 0;
  restored_rollups INTEGER := 0;
BEGIN
  -- Restore HierarchicalBudget data
  EXECUTE format('
    INSERT INTO public."HierarchicalBudget" (
      "id", "organizationId", "year", "month", "entityType", "entityId", "entityName",
      "budgetAmount", "actualAmount", "sellerId", "agencyId", "previousYearActual",
      "notes", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy"
    )
    SELECT 
      "id", "organizationId", "year", "month", "entityType", "entityId", "entityName",
      "budgetAmount", "actualAmount", "sellerId", "agencyId", "previousYearActual",
      "notes", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy"
    FROM %I."HierarchicalBudget"
    ON CONFLICT ("id") DO UPDATE SET
      "organizationId" = EXCLUDED."organizationId",
      "year" = EXCLUDED."year",
      "month" = EXCLUDED."month",
      "entityType" = EXCLUDED."entityType",
      "entityId" = EXCLUDED."entityId",
      "entityName" = EXCLUDED."entityName",
      "budgetAmount" = EXCLUDED."budgetAmount",
      "actualAmount" = EXCLUDED."actualAmount",
      "sellerId" = EXCLUDED."sellerId",
      "agencyId" = EXCLUDED."agencyId",
      "previousYearActual" = EXCLUDED."previousYearActual",
      "notes" = EXCLUDED."notes",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = EXCLUDED."updatedAt",
      "updatedBy" = EXCLUDED."updatedBy"
  ', org_schema_name);
  
  GET DIAGNOSTICS restored_budgets = ROW_COUNT;

  -- Restore BudgetRollupCache data
  EXECUTE format('
    INSERT INTO public."BudgetRollupCache" (
      "id", "organizationId", "sellerId", "year", "month",
      "totalBudget", "totalActual", "advertiserBudget", "advertiserActual",
      "agencyBudget", "agencyActual", "sellerBudget", "sellerActual",
      "budgetVariance", "isOnTarget", "previousYearTotal", "yearOverYearGrowth",
      "lastUpdated"
    )
    SELECT 
      "id", "organizationId", "sellerId", "year", "month",
      "totalBudget", "totalActual", "advertiserBudget", "advertiserActual",
      "agencyBudget", "agencyActual", "sellerBudget", "sellerActual",
      "budgetVariance", "isOnTarget", "previousYearTotal", "yearOverYearGrowth",
      "lastUpdated"
    FROM %I."BudgetRollupCache"
    ON CONFLICT ("organizationId", "sellerId", "year", "month") DO UPDATE SET
      "totalBudget" = EXCLUDED."totalBudget",
      "totalActual" = EXCLUDED."totalActual",
      "advertiserBudget" = EXCLUDED."advertiserBudget",
      "advertiserActual" = EXCLUDED."advertiserActual",
      "agencyBudget" = EXCLUDED."agencyBudget",
      "agencyActual" = EXCLUDED."agencyActual",
      "sellerBudget" = EXCLUDED."sellerBudget",
      "sellerActual" = EXCLUDED."sellerActual",
      "budgetVariance" = EXCLUDED."budgetVariance",
      "isOnTarget" = EXCLUDED."isOnTarget",
      "previousYearTotal" = EXCLUDED."previousYearTotal",
      "yearOverYearGrowth" = EXCLUDED."yearOverYearGrowth",
      "lastUpdated" = EXCLUDED."lastUpdated"
  ', org_schema_name);

  GET DIAGNOSTICS restored_rollups = ROW_COUNT;

  RAISE NOTICE 'Restored % budget records and % rollup records from schema: %', 
    restored_budgets, restored_rollups, org_schema_name;
  
  RETURN restored_budgets + restored_rollups;
END;
$$ LANGUAGE plpgsql;

-- Execute restoration for all org schemas
DO $$
DECLARE
  schema_rec RECORD;
  total_restored INTEGER := 0;
BEGIN
  FOR schema_rec IN 
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'org_%'
  LOOP
    total_restored := total_restored + restore_budget_data_from_org(schema_rec.schema_name);
  END LOOP;
  
  RAISE NOTICE 'Total rollback complete. Restored % records to public schema.', total_restored;
END $$;

-- ==============================================================================
-- PHASE 3: Restore original public schema functions and triggers
-- ==============================================================================

-- Recreate original public schema rollup function
CREATE OR REPLACE FUNCTION public.update_budget_rollup_cache(
  p_organization_id TEXT,
  p_seller_id TEXT,
  p_year INTEGER,
  p_month INTEGER
) RETURNS VOID AS $$
DECLARE
  v_total_budget DOUBLE PRECISION := 0;
  v_total_actual DOUBLE PRECISION := 0;
  v_advertiser_budget DOUBLE PRECISION := 0;
  v_advertiser_actual DOUBLE PRECISION := 0;
  v_agency_budget DOUBLE PRECISION := 0;
  v_agency_actual DOUBLE PRECISION := 0;
  v_seller_budget DOUBLE PRECISION := 0;
  v_seller_actual DOUBLE PRECISION := 0;
  v_prev_year_total DOUBLE PRECISION := 0;
BEGIN
  -- Calculate advertiser totals
  SELECT 
    COALESCE(SUM("budgetAmount"), 0),
    COALESCE(SUM("actualAmount"), 0)
  INTO v_advertiser_budget, v_advertiser_actual
  FROM public."HierarchicalBudget"
  WHERE "organizationId" = p_organization_id
    AND "sellerId" = p_seller_id
    AND "entityType" = 'advertiser'
    AND "year" = p_year
    AND "month" = p_month
    AND "isActive" = true;

  -- Calculate agency totals
  SELECT 
    COALESCE(SUM("budgetAmount"), 0),
    COALESCE(SUM("actualAmount"), 0)
  INTO v_agency_budget, v_agency_actual
  FROM public."HierarchicalBudget"
  WHERE "organizationId" = p_organization_id
    AND "sellerId" = p_seller_id
    AND "entityType" = 'agency'
    AND "year" = p_year
    AND "month" = p_month
    AND "isActive" = true;

  -- Calculate seller totals
  SELECT 
    COALESCE(SUM("budgetAmount"), 0),
    COALESCE(SUM("actualAmount"), 0)
  INTO v_seller_budget, v_seller_actual
  FROM public."HierarchicalBudget"
  WHERE "organizationId" = p_organization_id
    AND "sellerId" = p_seller_id
    AND "entityType" = 'seller'
    AND "year" = p_year
    AND "month" = p_month
    AND "isActive" = true;

  -- Calculate previous year total
  SELECT COALESCE(SUM("actualAmount"), 0)
  INTO v_prev_year_total
  FROM public."HierarchicalBudget"
  WHERE "organizationId" = p_organization_id
    AND "sellerId" = p_seller_id
    AND "year" = p_year - 1
    AND "month" = p_month
    AND "isActive" = true;

  -- Calculate grand totals
  v_total_budget := v_advertiser_budget + v_agency_budget + v_seller_budget;
  v_total_actual := v_advertiser_actual + v_agency_actual + v_seller_actual;

  -- Upsert cache record
  INSERT INTO public."BudgetRollupCache" (
    "organizationId", "sellerId", "year", "month",
    "totalBudget", "totalActual",
    "advertiserBudget", "advertiserActual",
    "agencyBudget", "agencyActual", 
    "sellerBudget", "sellerActual",
    "budgetVariance", "isOnTarget",
    "previousYearTotal", "yearOverYearGrowth"
  ) VALUES (
    p_organization_id, p_seller_id, p_year, p_month,
    v_total_budget, v_total_actual,
    v_advertiser_budget, v_advertiser_actual,
    v_agency_budget, v_agency_actual,
    v_seller_budget, v_seller_actual,
    v_total_actual - v_total_budget,
    ABS(v_total_actual - v_total_budget) < (v_total_budget * 0.1), -- Within 10%
    v_prev_year_total,
    CASE WHEN v_prev_year_total > 0 
         THEN ((v_total_actual - v_prev_year_total) / v_prev_year_total) * 100 
         ELSE 0 END
  )
  ON CONFLICT ("organizationId", "sellerId", "year", "month")
  DO UPDATE SET
    "totalBudget" = EXCLUDED."totalBudget",
    "totalActual" = EXCLUDED."totalActual",
    "advertiserBudget" = EXCLUDED."advertiserBudget",
    "advertiserActual" = EXCLUDED."advertiserActual",
    "agencyBudget" = EXCLUDED."agencyBudget",
    "agencyActual" = EXCLUDED."agencyActual",
    "sellerBudget" = EXCLUDED."sellerBudget",
    "sellerActual" = EXCLUDED."sellerActual",
    "budgetVariance" = EXCLUDED."budgetVariance",
    "isOnTarget" = EXCLUDED."isOnTarget",
    "previousYearTotal" = EXCLUDED."previousYearTotal",
    "yearOverYearGrowth" = EXCLUDED."yearOverYearGrowth",
    "lastUpdated" = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Recreate original trigger function
CREATE OR REPLACE FUNCTION public.trigger_update_budget_rollup_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Update cache for the affected seller/period
  PERFORM public.update_budget_rollup_cache(
    COALESCE(NEW."organizationId", OLD."organizationId"),
    COALESCE(NEW."sellerId", OLD."sellerId"),
    COALESCE(NEW."year", OLD."year"),
    COALESCE(NEW."month", OLD."month")
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger on public schema table
DROP TRIGGER IF EXISTS update_rollup_cache_trigger ON public."HierarchicalBudget";
CREATE TRIGGER update_rollup_cache_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public."HierarchicalBudget"
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_budget_rollup_cache();

-- ==============================================================================
-- PHASE 4: Drop budget tables from org schemas
-- ==============================================================================

-- Function to drop budget tables from org schema
CREATE OR REPLACE FUNCTION drop_budget_tables_from_org_schema(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Drop triggers first
  EXECUTE format('DROP TRIGGER IF EXISTS update_rollup_cache_trigger ON %I."HierarchicalBudget"', schema_name);
  
  -- Drop functions
  EXECUTE format('DROP FUNCTION IF EXISTS %I.trigger_update_budget_rollup_cache()', schema_name);
  EXECUTE format('DROP FUNCTION IF EXISTS %I.update_budget_rollup_cache(TEXT, TEXT, INTEGER, INTEGER)', schema_name);
  
  -- Drop tables
  EXECUTE format('DROP TABLE IF EXISTS %I."BudgetRollupCache"', schema_name);
  EXECUTE format('DROP TABLE IF EXISTS %I."HierarchicalBudget"', schema_name);
  
  RAISE NOTICE 'Dropped budget tables from schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Drop budget tables from all org schemas
DO $$
DECLARE
  schema_rec RECORD;
BEGIN
  FOR schema_rec IN 
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'org_%'
  LOOP
    PERFORM drop_budget_tables_from_org_schema(schema_rec.schema_name);
  END LOOP;
END $$;

-- ==============================================================================
-- PHASE 5: Cleanup rollback functions
-- ==============================================================================

-- Drop rollback helper functions
DROP FUNCTION IF EXISTS restore_budget_data_from_org(TEXT);
DROP FUNCTION IF EXISTS drop_budget_tables_from_org_schema(TEXT);

-- Final validation
SELECT 
  'public' as schema_name,
  COUNT(*) as hierarchical_budget_count,
  (SELECT COUNT(*) FROM public."BudgetRollupCache") as rollup_cache_count
FROM public."HierarchicalBudget";

RAISE NOTICE 'Rollback completed. Budget tables have been restored to public schema.';
RAISE NOTICE 'Backup tables (HierarchicalBudget_backup_, BudgetRollupCache_backup_) are available if needed.';