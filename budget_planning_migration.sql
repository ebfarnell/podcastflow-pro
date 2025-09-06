-- Budget Planning Tab Overhaul - Database Schema Migration
-- Creates hierarchical budget management with Advertiser/Agency/Seller relationships

-- 1. Add sellerId to Advertiser and Agency tables for hierarchy
ALTER TABLE "Advertiser" ADD COLUMN "sellerId" TEXT;
ALTER TABLE "Agency" ADD COLUMN "sellerId" TEXT;

-- Add indexes for performance
CREATE INDEX "Advertiser_sellerId_idx" ON "Advertiser"("sellerId");
CREATE INDEX "Agency_sellerId_idx" ON "Agency"("sellerId");

-- 2. Create new HierarchicalBudget table for monthly budget management
CREATE TABLE "HierarchicalBudget" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  
  -- Entity information
  "entityType" TEXT NOT NULL, -- 'advertiser', 'agency', 'seller'
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
    CHECK ("entityType" IN ('advertiser', 'agency', 'seller')),
  CONSTRAINT "HierarchicalBudget_budgetAmount_positive" 
    CHECK ("budgetAmount" >= 0),
  CONSTRAINT "HierarchicalBudget_actualAmount_positive" 
    CHECK ("actualAmount" >= 0)
);

-- Create indexes for performance
CREATE INDEX "HierarchicalBudget_organizationId_idx" ON "HierarchicalBudget"("organizationId");
CREATE INDEX "HierarchicalBudget_year_month_idx" ON "HierarchicalBudget"("year", "month");
CREATE INDEX "HierarchicalBudget_entityType_entityId_idx" ON "HierarchicalBudget"("entityType", "entityId");
CREATE INDEX "HierarchicalBudget_sellerId_idx" ON "HierarchicalBudget"("sellerId");
CREATE INDEX "HierarchicalBudget_agencyId_idx" ON "HierarchicalBudget"("agencyId");

-- 3. Create BudgetRollupCache table for performance
CREATE TABLE "BudgetRollupCache" (
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
);

-- Create indexes for rollup cache
CREATE INDEX "BudgetRollupCache_organizationId_year_month_idx" 
  ON "BudgetRollupCache"("organizationId", "year", "month");
CREATE INDEX "BudgetRollupCache_sellerId_year_month_idx"
  ON "BudgetRollupCache"("sellerId", "year", "month");

-- 4. Create function to update rollup cache
CREATE OR REPLACE FUNCTION update_budget_rollup_cache(
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
  FROM "HierarchicalBudget"
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
  FROM "HierarchicalBudget"
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
  FROM "HierarchicalBudget"
  WHERE "organizationId" = p_organization_id
    AND "sellerId" = p_seller_id
    AND "entityType" = 'seller'
    AND "year" = p_year
    AND "month" = p_month
    AND "isActive" = true;

  -- Calculate previous year total
  SELECT COALESCE(SUM("actualAmount"), 0)
  INTO v_prev_year_total
  FROM "HierarchicalBudget"
  WHERE "organizationId" = p_organization_id
    AND "sellerId" = p_seller_id
    AND "year" = p_year - 1
    AND "month" = p_month
    AND "isActive" = true;

  -- Calculate grand totals
  v_total_budget := v_advertiser_budget + v_agency_budget + v_seller_budget;
  v_total_actual := v_advertiser_actual + v_agency_actual + v_seller_actual;

  -- Upsert cache record
  INSERT INTO "BudgetRollupCache" (
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

-- 5. Create trigger to automatically update cache when budgets change
CREATE OR REPLACE FUNCTION trigger_update_budget_rollup_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Update cache for the affected seller/period
  PERFORM update_budget_rollup_cache(
    COALESCE(NEW."organizationId", OLD."organizationId"),
    COALESCE(NEW."sellerId", OLD."sellerId"),
    COALESCE(NEW."year", OLD."year"),
    COALESCE(NEW."month", OLD."month")
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rollup_cache_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "HierarchicalBudget"
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_budget_rollup_cache();

-- 6. Migration function to populate initial data
-- This would be run as part of the migration to seed data from existing sources
CREATE OR REPLACE FUNCTION migrate_initial_budget_data() RETURNS VOID AS $$
BEGIN
  -- This function would be implemented to:
  -- 1. Assign sellers to existing advertisers/agencies based on business rules
  -- 2. Populate HierarchicalBudget with current year data
  -- 3. Import previous year actuals for comparison
  -- 4. Update rollup cache for all periods
  
  RAISE NOTICE 'Initial budget data migration would be implemented here';
END;
$$ LANGUAGE plpgsql;

-- Comments for clarity
COMMENT ON TABLE "HierarchicalBudget" IS 'Monthly budget tracking for advertisers, agencies, and sellers with hierarchical rollups';
COMMENT ON TABLE "BudgetRollupCache" IS 'Cached rollup calculations for budget performance by seller and period';
COMMENT ON FUNCTION update_budget_rollup_cache IS 'Updates cached rollup totals for a specific seller and time period';