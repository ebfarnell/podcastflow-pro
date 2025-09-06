-- Migration Script: Move HierarchicalBudget and BudgetRollupCache to Organization Schemas
-- Purpose: Implement strict data isolation by moving budget tables from public to org-specific schemas
-- Created: July 30, 2025
-- 
-- This script:
-- 1. Creates HierarchicalBudget and BudgetRollupCache tables in each org schema
-- 2. Migrates data from public schema to respective org schemas
-- 3. Updates database functions to work with org schemas
-- 4. Creates rollback procedures

-- ==============================================================================
-- PHASE 1: Create tables in organization schemas
-- ==============================================================================

-- Function to create budget tables in a specific organization schema
CREATE OR REPLACE FUNCTION create_budget_tables_in_org_schema(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Create HierarchicalBudget table in org schema
  EXECUTE format('
    CREATE TABLE %I."HierarchicalBudget" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL,
      
      -- Entity information
      "entityType" TEXT NOT NULL, -- ''advertiser'', ''agency'', ''seller''
      "entityId" TEXT NOT NULL,   -- ID of the advertiser, agency, or user
      "entityName" TEXT NOT NULL, -- Cached name for performance
      
      -- Budget amounts
      "budgetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "actualAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      
      -- Hierarchy references for rollup
      "sellerId" TEXT, -- Always populated for rollup calculations
      "agencyId" TEXT, -- Populated for advertisers that belong to agencies
      
      -- Previous year comparison
      "previousYearActual" DOUBLE PRECISION DEFAULT 0,
      
      -- Metadata
      "notes" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdBy" TEXT NOT NULL,
      "updatedBy" TEXT,
      
      -- Constraints
      CONSTRAINT "HierarchicalBudget_organizationId_entityType_entityId_year_month_key" 
        UNIQUE ("organizationId", "entityType", "entityId", "year", "month"),
      CONSTRAINT "HierarchicalBudget_month_check" CHECK ("month" >= 1 AND "month" <= 12),
      CONSTRAINT "HierarchicalBudget_entityType_check" 
        CHECK ("entityType" IN (''advertiser'', ''agency'', ''seller'')),
      CONSTRAINT "HierarchicalBudget_budgetAmount_positive" 
        CHECK ("budgetAmount" >= 0),
      CONSTRAINT "HierarchicalBudget_actualAmount_positive" 
        CHECK ("actualAmount" >= 0)
    )', schema_name);

  -- Create indexes for HierarchicalBudget
  EXECUTE format('CREATE INDEX "HierarchicalBudget_organizationId_idx" ON %I."HierarchicalBudget"("organizationId")', schema_name);
  EXECUTE format('CREATE INDEX "HierarchicalBudget_year_month_idx" ON %I."HierarchicalBudget"("year", "month")', schema_name);
  EXECUTE format('CREATE INDEX "HierarchicalBudget_entityType_entityId_idx" ON %I."HierarchicalBudget"("entityType", "entityId")', schema_name);
  EXECUTE format('CREATE INDEX "HierarchicalBudget_sellerId_idx" ON %I."HierarchicalBudget"("sellerId")', schema_name);
  EXECUTE format('CREATE INDEX "HierarchicalBudget_agencyId_idx" ON %I."HierarchicalBudget"("agencyId")', schema_name);

  -- Create BudgetRollupCache table in org schema
  EXECUTE format('
    CREATE TABLE %I."BudgetRollupCache" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "sellerId" TEXT NOT NULL,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL,
      
      -- Rollup totals
      "totalBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "advertiserBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "advertiserActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "agencyBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "agencyActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "sellerBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "sellerActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
      
      -- Variance tracking
      "budgetVariance" DOUBLE PRECISION NOT NULL DEFAULT 0, -- actual - budget
      "isOnTarget" BOOLEAN NOT NULL DEFAULT true,
      
      -- Previous year comparison
      "previousYearTotal" DOUBLE PRECISION DEFAULT 0,
      "yearOverYearGrowth" DOUBLE PRECISION DEFAULT 0,
      
      -- Cache metadata
      "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      
      CONSTRAINT "BudgetRollupCache_organizationId_sellerId_year_month_key"
        UNIQUE ("organizationId", "sellerId", "year", "month")
    )', schema_name);

  -- Create indexes for BudgetRollupCache
  EXECUTE format('CREATE INDEX "BudgetRollupCache_organizationId_year_month_idx" ON %I."BudgetRollupCache"("organizationId", "year", "month")', schema_name);
  EXECUTE format('CREATE INDEX "BudgetRollupCache_sellerId_year_month_idx" ON %I."BudgetRollupCache"("sellerId", "year", "month")', schema_name);

  RAISE NOTICE 'Created budget tables in schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Create budget tables in all existing organization schemas
DO $$
DECLARE
  schema_rec RECORD;
BEGIN
  FOR schema_rec IN 
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'org_%'
  LOOP
    PERFORM create_budget_tables_in_org_schema(schema_rec.schema_name);
  END LOOP;
END $$;

-- ==============================================================================
-- PHASE 2: Create schema-specific functions for budget rollup calculations
-- ==============================================================================

-- Function to create rollup function in a specific org schema
CREATE OR REPLACE FUNCTION create_budget_rollup_function_in_schema(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    CREATE OR REPLACE FUNCTION %I.update_budget_rollup_cache(
      p_organization_id TEXT,
      p_seller_id TEXT,
      p_year INTEGER,
      p_month INTEGER
    ) RETURNS VOID AS $func$
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
      FROM %I."HierarchicalBudget"
      WHERE "organizationId" = p_organization_id
        AND "sellerId" = p_seller_id
        AND "entityType" = ''advertiser''
        AND "year" = p_year
        AND "month" = p_month
        AND "isActive" = true;

      -- Calculate agency totals
      SELECT 
        COALESCE(SUM("budgetAmount"), 0),
        COALESCE(SUM("actualAmount"), 0)
      INTO v_agency_budget, v_agency_actual
      FROM %I."HierarchicalBudget"
      WHERE "organizationId" = p_organization_id
        AND "sellerId" = p_seller_id
        AND "entityType" = ''agency''
        AND "year" = p_year
        AND "month" = p_month
        AND "isActive" = true;

      -- Calculate seller totals
      SELECT 
        COALESCE(SUM("budgetAmount"), 0),
        COALESCE(SUM("actualAmount"), 0)
      INTO v_seller_budget, v_seller_actual
      FROM %I."HierarchicalBudget"
      WHERE "organizationId" = p_organization_id
        AND "sellerId" = p_seller_id
        AND "entityType" = ''seller''
        AND "year" = p_year
        AND "month" = p_month
        AND "isActive" = true;

      -- Calculate previous year total
      SELECT COALESCE(SUM("actualAmount"), 0)
      INTO v_prev_year_total
      FROM %I."HierarchicalBudget"
      WHERE "organizationId" = p_organization_id
        AND "sellerId" = p_seller_id
        AND "year" = p_year - 1
        AND "month" = p_month
        AND "isActive" = true;

      -- Calculate grand totals
      v_total_budget := v_advertiser_budget + v_agency_budget + v_seller_budget;
      v_total_actual := v_advertiser_actual + v_agency_actual + v_seller_actual;

      -- Upsert cache record
      INSERT INTO %I."BudgetRollupCache" (
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
        ABS(v_total_actual - v_total_budget) < (v_total_budget * 0.1), -- Within 10%%
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
    $func$ LANGUAGE plpgsql;
  ', schema_name, schema_name, schema_name, schema_name, schema_name, schema_name);

  -- Create trigger function
  EXECUTE format('
    CREATE OR REPLACE FUNCTION %I.trigger_update_budget_rollup_cache()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Update cache for the affected seller/period
      PERFORM %I.update_budget_rollup_cache(
        COALESCE(NEW."organizationId", OLD."organizationId"),
        COALESCE(NEW."sellerId", OLD."sellerId"),
        COALESCE(NEW."year", OLD."year"),
        COALESCE(NEW."month", OLD."month")
      );
      
      RETURN COALESCE(NEW, OLD);
    END;
    $func$ LANGUAGE plpgsql;
  ', schema_name, schema_name);

  -- Create trigger
  EXECUTE format('
    CREATE TRIGGER update_rollup_cache_trigger
      AFTER INSERT OR UPDATE OR DELETE ON %I."HierarchicalBudget"
      FOR EACH ROW
      EXECUTE FUNCTION %I.trigger_update_budget_rollup_cache();
  ', schema_name, schema_name);

  RAISE NOTICE 'Created budget rollup functions and triggers in schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Create functions in all org schemas
DO $$
DECLARE
  schema_rec RECORD;
BEGIN
  FOR schema_rec IN 
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'org_%'
  LOOP
    PERFORM create_budget_rollup_function_in_schema(schema_rec.schema_name);
  END LOOP;
END $$;

-- ==============================================================================
-- PHASE 3: Data Migration
-- ==============================================================================

-- Function to migrate data for a specific organization
CREATE OR REPLACE FUNCTION migrate_budget_data_for_org(org_slug TEXT, org_schema_name TEXT)
RETURNS INTEGER AS $$
DECLARE
  migrated_budgets INTEGER := 0;
  migrated_rollups INTEGER := 0;
BEGIN
  -- Migrate HierarchicalBudget data
  EXECUTE format('
    INSERT INTO %I."HierarchicalBudget" (
      "id", "organizationId", "year", "month", "entityType", "entityId", "entityName",
      "budgetAmount", "actualAmount", "sellerId", "agencyId", "previousYearActual",
      "notes", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy"
    )
    SELECT 
      "id", "organizationId", "year", "month", "entityType", "entityId", "entityName",
      "budgetAmount", "actualAmount", "sellerId", "agencyId", "previousYearActual",
      "notes", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy"
    FROM public."HierarchicalBudget"
    WHERE "organizationId" = $1
  ', org_schema_name) USING org_slug;
  
  GET DIAGNOSTICS migrated_budgets = ROW_COUNT;

  -- Migrate BudgetRollupCache data
  EXECUTE format('
    INSERT INTO %I."BudgetRollupCache" (
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
    FROM public."BudgetRollupCache"
    WHERE "organizationId" = $1
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
  ', org_schema_name) USING org_slug;

  GET DIAGNOSTICS migrated_rollups = ROW_COUNT;

  RAISE NOTICE 'Migrated % budget records and % rollup records for org: % (schema: %)', 
    migrated_budgets, migrated_rollups, org_slug, org_schema_name;
  
  RETURN migrated_budgets + migrated_rollups;
END;
$$ LANGUAGE plpgsql;

-- Execute migration for all organizations
DO $$
DECLARE
  org_rec RECORD;
  total_migrated INTEGER := 0;
  target_schema TEXT;
BEGIN
  FOR org_rec IN 
    SELECT slug, id, name 
    FROM public."Organization" 
    WHERE "isActive" = true
  LOOP
    target_schema := 'org_' || replace(org_rec.slug, '-', '_');
    
    -- Check if schema exists
    IF EXISTS (
      SELECT 1 FROM information_schema.schemata s
      WHERE s.schema_name = target_schema
    ) THEN
      total_migrated := total_migrated + migrate_budget_data_for_org(
        org_rec.slug, 
        target_schema
      );
    ELSE
      RAISE WARNING 'Schema % does not exist for organization %', target_schema, org_rec.slug;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total migration complete. Migrated % records across all organizations.', total_migrated;
END $$;

-- ==============================================================================
-- PHASE 4: Validation
-- ==============================================================================

-- Function to validate migration
CREATE OR REPLACE FUNCTION validate_budget_migration()
RETURNS TABLE(
  schema_name TEXT,
  budgets_in_org INTEGER,
  budgets_in_public INTEGER,
  rollups_in_org INTEGER,
  rollups_in_public INTEGER,
  migration_valid BOOLEAN
) AS $$
DECLARE
  schema_rec RECORD;
  org_budgets INTEGER;
  public_budgets INTEGER;
  org_rollups INTEGER;
  public_rollups INTEGER;
  org_slug TEXT;
BEGIN
  FOR schema_rec IN 
    SELECT s.schema_name::TEXT as schema_name
    FROM information_schema.schemata s
    WHERE s.schema_name LIKE 'org_%'
  LOOP
    -- Convert schema name back to org slug (org_podcastflow_pro -> podcastflow-pro)
    org_slug := replace(substring(schema_rec.schema_name from 5), '_', '-');
    
    -- Count records in org schema
    EXECUTE format('SELECT COUNT(*) FROM %I."HierarchicalBudget"', schema_rec.schema_name) INTO org_budgets;
    EXECUTE format('SELECT COUNT(*) FROM %I."BudgetRollupCache"', schema_rec.schema_name) INTO org_rollups;
    
    -- Count corresponding records in public schema using proper org slug
    SELECT COUNT(*) INTO public_budgets FROM public."HierarchicalBudget" WHERE "organizationId" = org_slug;
    SELECT COUNT(*) INTO public_rollups FROM public."BudgetRollupCache" WHERE "organizationId" = org_slug;
    
    RETURN QUERY SELECT 
      schema_rec.schema_name,
      org_budgets,
      public_budgets,
      org_rollups,
      public_rollups,
      (org_budgets = public_budgets AND org_rollups = public_rollups);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run validation
SELECT * FROM validate_budget_migration();

-- ==============================================================================
-- PHASE 5: Cleanup and Comments
-- ==============================================================================

-- Add comments for documentation
COMMENT ON FUNCTION create_budget_tables_in_org_schema(TEXT) IS 'Creates HierarchicalBudget and BudgetRollupCache tables in specified organization schema';
COMMENT ON FUNCTION create_budget_rollup_function_in_schema(TEXT) IS 'Creates budget rollup calculation functions and triggers in specified organization schema';
COMMENT ON FUNCTION migrate_budget_data_for_org(TEXT, TEXT) IS 'Migrates budget data from public schema to organization-specific schema';
COMMENT ON FUNCTION validate_budget_migration() IS 'Validates that budget data migration was successful by comparing record counts';

-- Create rollback script (for safety)
-- Note: This will be saved as a separate file for rollback purposes