-- Executive Reporting and Order Management Schema Updates
-- PodcastFlow Pro - 2025-07-14

-- =====================================================
-- SHOW ENHANCEMENTS
-- =====================================================

-- Add revenue sharing and placement details to Show model
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "releaseFrequency" TEXT; -- 'daily', 'weekly', 'biweekly', 'monthly'
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "releaseDay" TEXT; -- 'monday', 'tuesday', etc. or specific date
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "revenueSharingType" TEXT; -- 'percentage', 'fixed', 'tiered'
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "revenueSharingPercentage" DECIMAL(5,2);
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "revenueSharingFixedAmount" DECIMAL(10,2);
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "revenueSharingNotes" TEXT;

-- Placement configuration for shows
CREATE TABLE IF NOT EXISTS "ShowPlacement" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "showId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "placementType" TEXT NOT NULL, -- 'preroll', 'midroll', 'postroll'
  "totalSpots" INTEGER NOT NULL DEFAULT 1,
  "liveReadSpots" INTEGER DEFAULT 0,
  "liveReadPercentage" DECIMAL(5,2),
  "defaultLength" INTEGER DEFAULT 30, -- seconds
  "availableLengths" INTEGER[], -- array of available lengths in seconds
  "baseRate" DECIMAL(10,2) NOT NULL,
  "rates" JSONB, -- rates by length {"15": 500, "30": 1000, "60": 1500}
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "ShowPlacement_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE,
  CONSTRAINT "ShowPlacement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
);

-- Blocked spots for specific advertisers
CREATE TABLE IF NOT EXISTS "BlockedSpot" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "showId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "placementType" TEXT NOT NULL,
  "spotNumber" INTEGER NOT NULL,
  "advertiserId" TEXT,
  "campaignId" TEXT,
  "startDate" DATE,
  "endDate" DATE,
  "reason" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "BlockedSpot_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE,
  CONSTRAINT "BlockedSpot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id"),
  CONSTRAINT "BlockedSpot_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE SET NULL,
  CONSTRAINT "BlockedSpot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL
);

-- =====================================================
-- ORDER MANAGEMENT SYSTEM
-- =====================================================

-- Orders table
CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "orderNumber" TEXT NOT NULL UNIQUE,
  "campaignId" TEXT NOT NULL,
  "version" INTEGER DEFAULT 1,
  "parentOrderId" TEXT, -- for revised orders
  "organizationId" TEXT NOT NULL,
  "advertiserId" TEXT NOT NULL,
  "agencyId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft', -- draft, pending_approval, approved, booked, confirmed
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "discountAmount" DECIMAL(10,2) DEFAULT 0,
  "discountReason" TEXT,
  "netAmount" DECIMAL(10,2) NOT NULL,
  
  -- Approval tracking
  "submittedAt" TIMESTAMP,
  "submittedBy" TEXT,
  "approvedAt" TIMESTAMP,
  "approvedBy" TEXT,
  "bookedAt" TIMESTAMP,
  "bookedBy" TEXT,
  "confirmedAt" TIMESTAMP,
  "confirmedBy" TEXT,
  
  -- IO/Contract tracking
  "ioNumber" TEXT,
  "ioGeneratedAt" TIMESTAMP,
  "contractUrl" TEXT,
  "signedContractUrl" TEXT,
  "contractSignedAt" TIMESTAMP,
  
  "notes" TEXT,
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "Order_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id"),
  CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id"),
  CONSTRAINT "Order_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id"),
  CONSTRAINT "Order_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id"),
  CONSTRAINT "Order_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "Order"("id"),
  CONSTRAINT "Order_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id"),
  CONSTRAINT "Order_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id"),
  CONSTRAINT "Order_bookedBy_fkey" FOREIGN KEY ("bookedBy") REFERENCES "User"("id"),
  CONSTRAINT "Order_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id"),
  CONSTRAINT "Order_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id")
);

-- Order line items (individual spots)
CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "orderId" TEXT NOT NULL,
  "showId" TEXT NOT NULL,
  "episodeId" TEXT,
  "placementType" TEXT NOT NULL, -- preroll, midroll, postroll
  "spotNumber" INTEGER,
  "airDate" DATE NOT NULL,
  "length" INTEGER NOT NULL, -- seconds
  "isLiveRead" BOOLEAN DEFAULT false,
  "rate" DECIMAL(10,2) NOT NULL,
  "actualRate" DECIMAL(10,2) NOT NULL, -- after any discounts
  "status" TEXT DEFAULT 'pending', -- pending, reserved, confirmed, aired, cancelled
  
  -- Ad creative details
  "adTitle" TEXT,
  "adScript" TEXT,
  "adTalkingPoints" TEXT[],
  "adAudioUrl" TEXT,
  "adApprovalStatus" TEXT DEFAULT 'pending',
  
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE,
  CONSTRAINT "OrderItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id"),
  CONSTRAINT "OrderItem_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id")
);

-- Inventory tracking
CREATE TABLE IF NOT EXISTS "Inventory" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "showId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "placementType" TEXT NOT NULL,
  "totalSpots" INTEGER NOT NULL,
  "availableSpots" INTEGER NOT NULL,
  "reservedSpots" INTEGER DEFAULT 0,
  "bookedSpots" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "Inventory_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id"),
  CONSTRAINT "Inventory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id"),
  UNIQUE ("showId", "date", "placementType")
);

-- =====================================================
-- BUDGET MANAGEMENT
-- =====================================================

-- Budget categories
CREATE TABLE IF NOT EXISTS "BudgetCategory" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL, -- 'expense', 'revenue', 'cogs'
  "parentCategoryId" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "BudgetCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id"),
  CONSTRAINT "BudgetCategory_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "BudgetCategory"("id")
);

-- Budget entries
CREATE TABLE IF NOT EXISTS "BudgetEntry" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "budgetAmount" DECIMAL(10,2) NOT NULL,
  "actualAmount" DECIMAL(10,2) DEFAULT 0,
  "variance" DECIMAL(10,2) GENERATED ALWAYS AS ("actualAmount" - "budgetAmount") STORED,
  "notes" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "BudgetEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id"),
  CONSTRAINT "BudgetEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id"),
  CONSTRAINT "BudgetEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id"),
  UNIQUE ("organizationId", "categoryId", "year", "month")
);

-- Employee compensation tracking
CREATE TABLE IF NOT EXISTS "EmployeeCompensation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "baseSalary" DECIMAL(10,2),
  "targetBonus" DECIMAL(10,2),
  "actualBonus" DECIMAL(10,2),
  "commissionRate" DECIMAL(5,2),
  "actualCommission" DECIMAL(10,2),
  "benefits" DECIMAL(10,2),
  "totalCompensation" DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE("baseSalary", 0) + 
    COALESCE("actualBonus", 0) + 
    COALESCE("actualCommission", 0) + 
    COALESCE("benefits", 0)
  ) STORED,
  "effectiveDate" DATE NOT NULL,
  "endDate" DATE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeCompensation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id"),
  CONSTRAINT "EmployeeCompensation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);

-- =====================================================
-- P&L AND FINANCIAL DATA
-- =====================================================

-- QuickBooks sync tracking
CREATE TABLE IF NOT EXISTS "QuickBooksSync" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "syncType" TEXT NOT NULL, -- 'full', 'incremental', 'manual'
  "status" TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  "startDate" DATE,
  "endDate" DATE,
  "recordsProcessed" INTEGER DEFAULT 0,
  "errors" JSONB,
  "startedAt" TIMESTAMP,
  "completedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "QuickBooksSync_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
);

-- Financial data from QuickBooks
CREATE TABLE IF NOT EXISTS "FinancialData" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "accountCode" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountType" TEXT NOT NULL, -- 'revenue', 'expense', 'asset', 'liability', 'equity'
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "quickbooksId" TEXT,
  "syncId" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "FinancialData_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id"),
  CONSTRAINT "FinancialData_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "QuickBooksSync"("id"),
  UNIQUE ("organizationId", "accountCode", "year", "month")
);

-- =====================================================
-- APPROVAL WORKFLOWS
-- =====================================================

-- Campaign approval requests
CREATE TABLE IF NOT EXISTS "CampaignApproval" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "campaignId" TEXT NOT NULL,
  "orderId" TEXT,
  "requestedBy" TEXT NOT NULL,
  "requestedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, revision_requested
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP,
  
  -- Rate discrepancy tracking
  "hasRateDiscrepancy" BOOLEAN DEFAULT false,
  "discrepancyDetails" JSONB, -- detailed breakdown of rate differences
  "discrepancyAmount" DECIMAL(10,2),
  "discrepancyPercentage" DECIMAL(5,2),
  
  "approvalNotes" TEXT,
  "rejectionReason" TEXT,
  "revisionRequested" TEXT,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "CampaignApproval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id"),
  CONSTRAINT "CampaignApproval_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id"),
  CONSTRAINT "CampaignApproval_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id"),
  CONSTRAINT "CampaignApproval_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id")
);

-- =====================================================
-- EPISODE ENHANCEMENTS
-- =====================================================

-- Add producer notes and talent assignments
ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "producerNotes" TEXT;
ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "talentNotes" TEXT;
ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "recordingDate" TIMESTAMP;
ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "publishUrl" TEXT;

-- Episode spots (actual ad placements in episodes)
CREATE TABLE IF NOT EXISTS "EpisodeSpot" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "episodeId" TEXT NOT NULL,
  "orderItemId" TEXT,
  "placementType" TEXT NOT NULL,
  "spotNumber" INTEGER NOT NULL,
  "startTime" INTEGER, -- seconds into episode
  "endTime" INTEGER, -- seconds into episode
  "actualLength" INTEGER,
  "status" TEXT DEFAULT 'scheduled', -- scheduled, recorded, aired, cancelled
  "audioUrl" TEXT,
  "transcript" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "EpisodeSpot_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id"),
  CONSTRAINT "EpisodeSpot_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
);

-- =====================================================
-- SCHEDULE MANAGEMENT
-- =====================================================

-- Campaign schedules
CREATE TABLE IF NOT EXISTS "CampaignSchedule" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "campaignId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER DEFAULT 1,
  "status" TEXT DEFAULT 'draft', -- draft, sent_to_client, approved
  "exportedAt" TIMESTAMP,
  "exportedBy" TEXT,
  "exportUrl" TEXT,
  "clientApprovedAt" TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "CampaignSchedule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id"),
  CONSTRAINT "CampaignSchedule_exportedBy_fkey" FOREIGN KEY ("exportedBy") REFERENCES "User"("id"),
  CONSTRAINT "CampaignSchedule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id")
);

-- Schedule items
CREATE TABLE IF NOT EXISTS "ScheduleItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "scheduleId" TEXT NOT NULL,
  "showId" TEXT NOT NULL,
  "airDate" DATE NOT NULL,
  "placementType" TEXT NOT NULL,
  "length" INTEGER NOT NULL,
  "rate" DECIMAL(10,2) NOT NULL,
  "isLiveRead" BOOLEAN DEFAULT false,
  "notes" TEXT,
  "sortOrder" INTEGER,
  
  PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CampaignSchedule"("id") ON DELETE CASCADE,
  CONSTRAINT "ScheduleItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id")
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS "ShowPlacement_showId_idx" ON "ShowPlacement"("showId");
CREATE INDEX IF NOT EXISTS "ShowPlacement_organizationId_idx" ON "ShowPlacement"("organizationId");
CREATE INDEX IF NOT EXISTS "BlockedSpot_showId_idx" ON "BlockedSpot"("showId");
CREATE INDEX IF NOT EXISTS "BlockedSpot_organizationId_idx" ON "BlockedSpot"("organizationId");
CREATE INDEX IF NOT EXISTS "Order_orderNumber_idx" ON "Order"("orderNumber");
CREATE INDEX IF NOT EXISTS "Order_campaignId_idx" ON "Order"("campaignId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_showId_idx" ON "OrderItem"("showId");
CREATE INDEX IF NOT EXISTS "OrderItem_airDate_idx" ON "OrderItem"("airDate");
CREATE INDEX IF NOT EXISTS "Inventory_showId_date_idx" ON "Inventory"("showId", "date");
CREATE INDEX IF NOT EXISTS "Inventory_organizationId_idx" ON "Inventory"("organizationId");
CREATE INDEX IF NOT EXISTS "BudgetEntry_organizationId_year_month_idx" ON "BudgetEntry"("organizationId", "year", "month");
CREATE INDEX IF NOT EXISTS "FinancialData_organizationId_year_month_idx" ON "FinancialData"("organizationId", "year", "month");
CREATE INDEX IF NOT EXISTS "CampaignApproval_campaignId_idx" ON "CampaignApproval"("campaignId");
CREATE INDEX IF NOT EXISTS "EpisodeSpot_episodeId_idx" ON "EpisodeSpot"("episodeId");
CREATE INDEX IF NOT EXISTS "CampaignSchedule_campaignId_idx" ON "CampaignSchedule"("campaignId");

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Insert default budget categories
INSERT INTO "BudgetCategory" ("id", "organizationId", "name", "type", "parentCategoryId") 
SELECT gen_random_uuid(), o.id, cat.name, cat.type, NULL
FROM "Organization" o
CROSS JOIN (VALUES 
  ('Salaries & Wages', 'expense'),
  ('Bonuses', 'expense'),
  ('Commissions', 'expense'),
  ('Benefits', 'expense'),
  ('Office Expenses', 'expense'),
  ('Marketing', 'expense'),
  ('Technology', 'expense'),
  ('Professional Services', 'expense'),
  ('Show Revenue Share', 'cogs'),
  ('Production Costs', 'cogs'),
  ('Campaign Revenue', 'revenue'),
  ('Sponsorship Revenue', 'revenue'),
  ('Other Revenue', 'revenue')
) AS cat(name, type)
ON CONFLICT DO NOTHING;