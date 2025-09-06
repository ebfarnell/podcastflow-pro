-- Campaign Workflow Automation Migration (Fixed)
-- Phase 1: Database Schema Updates
-- Created: 2025-08-05

-- =====================================================
-- PART 1: Organization Settings Updates
-- =====================================================

-- Add workflow configuration fields to Organization table
ALTER TABLE public."Organization" 
ADD COLUMN IF NOT EXISTS "contractTemplateHtml" TEXT,
ADD COLUMN IF NOT EXISTS "contractTemplateVariables" JSONB DEFAULT '["advertiserName", "agencyName", "campaignName", "totalCost", "scheduleTable", "exclusivities", "startDate", "endDate", "terms"]'::jsonb,
ADD COLUMN IF NOT EXISTS "invoiceGenerationDay" INTEGER DEFAULT 1 CHECK ("invoiceGenerationDay" >= 1 AND "invoiceGenerationDay" <= 28),
ADD COLUMN IF NOT EXISTS "preBillThreshold" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "requirePreBillApproval" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "defaultPaymentTerms" INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS "autoGenerateContracts" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "autoGenerateInvoices" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "workflowSettings" JSONB DEFAULT '{
  "autoReserveAt90": true,
  "requireAdminApprovalAt90": true,
  "autoCreateOrderOnApproval": true,
  "autoAssignAdRequests": true,
  "notifyOnStatusChange": true,
  "reservationExpiryHours": 72
}'::jsonb;

-- Create contract template table
CREATE TABLE IF NOT EXISTS public."ContractTemplate" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL REFERENCES public."Organization"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "templateHtml" TEXT NOT NULL,
  "variables" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "isDefault" BOOLEAN DEFAULT false,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "ContractTemplate_organizationId_idx" ON public."ContractTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "ContractTemplate_isDefault_idx" ON public."ContractTemplate"("isDefault") WHERE "isDefault" = true;

-- =====================================================
-- PART 2: Organization Schema Tables for org_podcastflow_pro
-- =====================================================

-- Add fields to Campaign table
ALTER TABLE org_podcastflow_pro."Campaign" 
ADD COLUMN IF NOT EXISTS "probability" INTEGER DEFAULT 0 CHECK ("probability" >= 0 AND "probability" <= 100),
ADD COLUMN IF NOT EXISTS "reservationId" TEXT,
ADD COLUMN IF NOT EXISTS "reservationCreatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approvalRequestId" TEXT,
ADD COLUMN IF NOT EXISTS "preBillRequired" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "preBillInvoiceId" TEXT,
ADD COLUMN IF NOT EXISTS "categoryExclusivities" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "lastStatusChangeAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastStatusChangeBy" TEXT;

-- Create AdRequest table
CREATE TABLE IF NOT EXISTS org_podcastflow_pro."AdRequest" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "orderId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "episodeId" TEXT,
    "assignedToId" TEXT NOT NULL,
    "assignedToRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requirements" JSONB DEFAULT '{}'::jsonb,
    "deliverables" JSONB DEFAULT '[]'::jsonb,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "AdRequest_orderId_fkey" FOREIGN KEY ("orderId") 
        REFERENCES org_podcastflow_pro."Order"("id") ON DELETE CASCADE,
    CONSTRAINT "AdRequest_showId_fkey" FOREIGN KEY ("showId") 
        REFERENCES org_podcastflow_pro."Show"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "AdRequest_orderId_idx" ON org_podcastflow_pro."AdRequest"("orderId");
CREATE INDEX IF NOT EXISTS "AdRequest_showId_idx" ON org_podcastflow_pro."AdRequest"("showId");
CREATE INDEX IF NOT EXISTS "AdRequest_assignedToId_idx" ON org_podcastflow_pro."AdRequest"("assignedToId");
CREATE INDEX IF NOT EXISTS "AdRequest_status_idx" ON org_podcastflow_pro."AdRequest"("status");
CREATE INDEX IF NOT EXISTS "AdRequest_dueDate_idx" ON org_podcastflow_pro."AdRequest"("dueDate");

-- Create CreativeRequest table
CREATE TABLE IF NOT EXISTS org_podcastflow_pro."CreativeRequest" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "orderId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requiredAssets" JSONB DEFAULT '[]'::jsonb,
    "submittedAssets" JSONB DEFAULT '[]'::jsonb,
    "feedbackHistory" JSONB DEFAULT '[]'::jsonb,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "CreativeRequest_orderId_fkey" FOREIGN KEY ("orderId") 
        REFERENCES org_podcastflow_pro."Order"("id") ON DELETE CASCADE,
    CONSTRAINT "CreativeRequest_campaignId_fkey" FOREIGN KEY ("campaignId") 
        REFERENCES org_podcastflow_pro."Campaign"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CreativeRequest_orderId_idx" ON org_podcastflow_pro."CreativeRequest"("orderId");
CREATE INDEX IF NOT EXISTS "CreativeRequest_campaignId_idx" ON org_podcastflow_pro."CreativeRequest"("campaignId");
CREATE INDEX IF NOT EXISTS "CreativeRequest_assignedToId_idx" ON org_podcastflow_pro."CreativeRequest"("assignedToId");
CREATE INDEX IF NOT EXISTS "CreativeRequest_status_idx" ON org_podcastflow_pro."CreativeRequest"("status");

-- Create ShowRateHistory table
CREATE TABLE IF NOT EXISTS org_podcastflow_pro."ShowRateHistory" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "showId" TEXT NOT NULL,
    "placementType" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "expiryDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "ShowRateHistory_showId_fkey" FOREIGN KEY ("showId") 
        REFERENCES org_podcastflow_pro."Show"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ShowRateHistory_showId_idx" ON org_podcastflow_pro."ShowRateHistory"("showId");
CREATE INDEX IF NOT EXISTS "ShowRateHistory_effectiveDate_idx" ON org_podcastflow_pro."ShowRateHistory"("effectiveDate");
CREATE INDEX IF NOT EXISTS "ShowRateHistory_showId_placement_idx" ON org_podcastflow_pro."ShowRateHistory"("showId", "placementType");

-- Create CategoryExclusivity table
CREATE TABLE IF NOT EXISTS org_podcastflow_pro."CategoryExclusivity" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "showId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'episode',
    "advertiserId" TEXT,
    "campaignId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "CategoryExclusivity_showId_fkey" FOREIGN KEY ("showId") 
        REFERENCES org_podcastflow_pro."Show"("id") ON DELETE CASCADE,
    CONSTRAINT "CategoryExclusivity_advertiserId_fkey" FOREIGN KEY ("advertiserId") 
        REFERENCES org_podcastflow_pro."Advertiser"("id") ON DELETE SET NULL,
    CONSTRAINT "CategoryExclusivity_campaignId_fkey" FOREIGN KEY ("campaignId") 
        REFERENCES org_podcastflow_pro."Campaign"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "CategoryExclusivity_showId_idx" ON org_podcastflow_pro."CategoryExclusivity"("showId");
CREATE INDEX IF NOT EXISTS "CategoryExclusivity_category_idx" ON org_podcastflow_pro."CategoryExclusivity"("category");
CREATE INDEX IF NOT EXISTS "CategoryExclusivity_dates_idx" ON org_podcastflow_pro."CategoryExclusivity"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "CategoryExclusivity_active_idx" ON org_podcastflow_pro."CategoryExclusivity"("isActive", "showId", "category");

-- Update Reservation table
ALTER TABLE org_podcastflow_pro."Reservation" 
ADD COLUMN IF NOT EXISTS "campaignId" TEXT,
ADD COLUMN IF NOT EXISTS "approvalRequestId" TEXT,
ADD COLUMN IF NOT EXISTS "autoExpireAt" TIMESTAMP(3);

-- Add constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Reservation_campaignId_fkey' 
        AND connamespace = 'org_podcastflow_pro'::regnamespace
    ) THEN
        ALTER TABLE org_podcastflow_pro."Reservation" 
        ADD CONSTRAINT "Reservation_campaignId_fkey" FOREIGN KEY ("campaignId") 
        REFERENCES org_podcastflow_pro."Campaign"("id") ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Reservation_campaignId_idx" ON org_podcastflow_pro."Reservation"("campaignId");

-- Update Order table
ALTER TABLE org_podcastflow_pro."Order" 
ADD COLUMN IF NOT EXISTS "sourceCampaignId" TEXT,
ADD COLUMN IF NOT EXISTS "autoGenerated" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "contractId" TEXT,
ADD COLUMN IF NOT EXISTS "preBillInvoiceId" TEXT,
ADD COLUMN IF NOT EXISTS "workflowMetadata" JSONB DEFAULT '{}'::jsonb;

-- Add advertiser credit terms
ALTER TABLE org_podcastflow_pro."Advertiser" 
ADD COLUMN IF NOT EXISTS "creditTerms" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "requiresPreBill" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "categories" JSONB DEFAULT '[]'::jsonb;

-- Create Activity table if it doesn't exist
CREATE TABLE IF NOT EXISTS org_podcastflow_pro."Activity" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetName" TEXT,
    "organizationId" TEXT NOT NULL,
    "showId" TEXT,
    "episodeId" TEXT,
    "campaignId" TEXT,
    "orderId" TEXT,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT
);

CREATE INDEX IF NOT EXISTS "Activity_actorId_idx" ON org_podcastflow_pro."Activity"("actorId");
CREATE INDEX IF NOT EXISTS "Activity_targetType_targetId_idx" ON org_podcastflow_pro."Activity"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "Activity_campaignId_idx" ON org_podcastflow_pro."Activity"("campaignId");
CREATE INDEX IF NOT EXISTS "Activity_orderId_idx" ON org_podcastflow_pro."Activity"("orderId");
CREATE INDEX IF NOT EXISTS "Activity_createdAt_idx" ON org_podcastflow_pro."Activity"("createdAt");

-- =====================================================
-- PART 3: Organization Schema Tables for org_unfy
-- =====================================================

-- Add fields to Campaign table
ALTER TABLE org_unfy."Campaign" 
ADD COLUMN IF NOT EXISTS "probability" INTEGER DEFAULT 0 CHECK ("probability" >= 0 AND "probability" <= 100),
ADD COLUMN IF NOT EXISTS "reservationId" TEXT,
ADD COLUMN IF NOT EXISTS "reservationCreatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approvalRequestId" TEXT,
ADD COLUMN IF NOT EXISTS "preBillRequired" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "preBillInvoiceId" TEXT,
ADD COLUMN IF NOT EXISTS "categoryExclusivities" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "lastStatusChangeAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastStatusChangeBy" TEXT;

-- Create AdRequest table
CREATE TABLE IF NOT EXISTS org_unfy."AdRequest" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "orderId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "episodeId" TEXT,
    "assignedToId" TEXT NOT NULL,
    "assignedToRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requirements" JSONB DEFAULT '{}'::jsonb,
    "deliverables" JSONB DEFAULT '[]'::jsonb,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "AdRequest_orderId_fkey" FOREIGN KEY ("orderId") 
        REFERENCES org_unfy."Order"("id") ON DELETE CASCADE,
    CONSTRAINT "AdRequest_showId_fkey" FOREIGN KEY ("showId") 
        REFERENCES org_unfy."Show"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "AdRequest_orderId_idx" ON org_unfy."AdRequest"("orderId");
CREATE INDEX IF NOT EXISTS "AdRequest_showId_idx" ON org_unfy."AdRequest"("showId");
CREATE INDEX IF NOT EXISTS "AdRequest_assignedToId_idx" ON org_unfy."AdRequest"("assignedToId");
CREATE INDEX IF NOT EXISTS "AdRequest_status_idx" ON org_unfy."AdRequest"("status");
CREATE INDEX IF NOT EXISTS "AdRequest_dueDate_idx" ON org_unfy."AdRequest"("dueDate");

-- Create CreativeRequest table
CREATE TABLE IF NOT EXISTS org_unfy."CreativeRequest" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "orderId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requiredAssets" JSONB DEFAULT '[]'::jsonb,
    "submittedAssets" JSONB DEFAULT '[]'::jsonb,
    "feedbackHistory" JSONB DEFAULT '[]'::jsonb,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "CreativeRequest_orderId_fkey" FOREIGN KEY ("orderId") 
        REFERENCES org_unfy."Order"("id") ON DELETE CASCADE,
    CONSTRAINT "CreativeRequest_campaignId_fkey" FOREIGN KEY ("campaignId") 
        REFERENCES org_unfy."Campaign"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CreativeRequest_orderId_idx" ON org_unfy."CreativeRequest"("orderId");
CREATE INDEX IF NOT EXISTS "CreativeRequest_campaignId_idx" ON org_unfy."CreativeRequest"("campaignId");
CREATE INDEX IF NOT EXISTS "CreativeRequest_assignedToId_idx" ON org_unfy."CreativeRequest"("assignedToId");
CREATE INDEX IF NOT EXISTS "CreativeRequest_status_idx" ON org_unfy."CreativeRequest"("status");

-- Create ShowRateHistory table
CREATE TABLE IF NOT EXISTS org_unfy."ShowRateHistory" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "showId" TEXT NOT NULL,
    "placementType" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "expiryDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "ShowRateHistory_showId_fkey" FOREIGN KEY ("showId") 
        REFERENCES org_unfy."Show"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ShowRateHistory_showId_idx" ON org_unfy."ShowRateHistory"("showId");
CREATE INDEX IF NOT EXISTS "ShowRateHistory_effectiveDate_idx" ON org_unfy."ShowRateHistory"("effectiveDate");
CREATE INDEX IF NOT EXISTS "ShowRateHistory_showId_placement_idx" ON org_unfy."ShowRateHistory"("showId", "placementType");

-- Create CategoryExclusivity table
CREATE TABLE IF NOT EXISTS org_unfy."CategoryExclusivity" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "showId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'episode',
    "advertiserId" TEXT,
    "campaignId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "CategoryExclusivity_showId_fkey" FOREIGN KEY ("showId") 
        REFERENCES org_unfy."Show"("id") ON DELETE CASCADE,
    CONSTRAINT "CategoryExclusivity_advertiserId_fkey" FOREIGN KEY ("advertiserId") 
        REFERENCES org_unfy."Advertiser"("id") ON DELETE SET NULL,
    CONSTRAINT "CategoryExclusivity_campaignId_fkey" FOREIGN KEY ("campaignId") 
        REFERENCES org_unfy."Campaign"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "CategoryExclusivity_showId_idx" ON org_unfy."CategoryExclusivity"("showId");
CREATE INDEX IF NOT EXISTS "CategoryExclusivity_category_idx" ON org_unfy."CategoryExclusivity"("category");
CREATE INDEX IF NOT EXISTS "CategoryExclusivity_dates_idx" ON org_unfy."CategoryExclusivity"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "CategoryExclusivity_active_idx" ON org_unfy."CategoryExclusivity"("isActive", "showId", "category");

-- Update Reservation table
ALTER TABLE org_unfy."Reservation" 
ADD COLUMN IF NOT EXISTS "campaignId" TEXT,
ADD COLUMN IF NOT EXISTS "approvalRequestId" TEXT,
ADD COLUMN IF NOT EXISTS "autoExpireAt" TIMESTAMP(3);

-- Add constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Reservation_campaignId_fkey' 
        AND connamespace = 'org_unfy'::regnamespace
    ) THEN
        ALTER TABLE org_unfy."Reservation" 
        ADD CONSTRAINT "Reservation_campaignId_fkey" FOREIGN KEY ("campaignId") 
        REFERENCES org_unfy."Campaign"("id") ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Reservation_campaignId_idx" ON org_unfy."Reservation"("campaignId");

-- Update Order table
ALTER TABLE org_unfy."Order" 
ADD COLUMN IF NOT EXISTS "sourceCampaignId" TEXT,
ADD COLUMN IF NOT EXISTS "autoGenerated" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "contractId" TEXT,
ADD COLUMN IF NOT EXISTS "preBillInvoiceId" TEXT,
ADD COLUMN IF NOT EXISTS "workflowMetadata" JSONB DEFAULT '{}'::jsonb;

-- Add advertiser credit terms
ALTER TABLE org_unfy."Advertiser" 
ADD COLUMN IF NOT EXISTS "creditTerms" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "requiresPreBill" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "categories" JSONB DEFAULT '[]'::jsonb;

-- Create Activity table if it doesn't exist
CREATE TABLE IF NOT EXISTS org_unfy."Activity" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetName" TEXT,
    "organizationId" TEXT NOT NULL,
    "showId" TEXT,
    "episodeId" TEXT,
    "campaignId" TEXT,
    "orderId" TEXT,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT
);

CREATE INDEX IF NOT EXISTS "Activity_actorId_idx" ON org_unfy."Activity"("actorId");
CREATE INDEX IF NOT EXISTS "Activity_targetType_targetId_idx" ON org_unfy."Activity"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "Activity_campaignId_idx" ON org_unfy."Activity"("campaignId");
CREATE INDEX IF NOT EXISTS "Activity_orderId_idx" ON org_unfy."Activity"("orderId");
CREATE INDEX IF NOT EXISTS "Activity_createdAt_idx" ON org_unfy."Activity"("createdAt");

-- =====================================================
-- PART 4: Notification System Enhancements
-- =====================================================

-- Add notification fields
ALTER TABLE public."Notification" 
ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "requiresAction" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "actionCompletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "actionCompletedBy" TEXT;

CREATE INDEX IF NOT EXISTS "Notification_category_idx" ON public."Notification"("category");
CREATE INDEX IF NOT EXISTS "Notification_priority_idx" ON public."Notification"("priority");
CREATE INDEX IF NOT EXISTS "Notification_requiresAction_idx" ON public."Notification"("requiresAction") WHERE "requiresAction" = true;
CREATE INDEX IF NOT EXISTS "Notification_expiresAt_idx" ON public."Notification"("expiresAt") WHERE "expiresAt" IS NOT NULL;

-- =====================================================
-- PART 5: Functions
-- =====================================================

-- Function to check category exclusivity conflicts
CREATE OR REPLACE FUNCTION check_category_exclusivity(
    p_schema TEXT,
    p_show_id TEXT,
    p_category TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_exclude_campaign_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    has_conflict BOOLEAN,
    conflict_details JSONB
) AS $$
DECLARE
    v_conflicts JSONB;
BEGIN
    EXECUTE format('
        SELECT 
            CASE WHEN COUNT(*) > 0 THEN true ELSE false END,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        ''id'', id,
                        ''advertiserId'', "advertiserId",
                        ''campaignId'', "campaignId",
                        ''startDate'', "startDate",
                        ''endDate'', "endDate",
                        ''level'', level
                    )
                ),
                ''[]''::jsonb
            )
        FROM %I."CategoryExclusivity"
        WHERE "showId" = $1
        AND category = $2
        AND "isActive" = true
        AND "startDate" <= $4
        AND "endDate" >= $3
        AND ($5 IS NULL OR "campaignId" != $5)
    ', p_schema)
    INTO has_conflict, conflict_details
    USING p_show_id, p_category, p_start_date, p_end_date, p_exclude_campaign_id;
    
    RETURN QUERY SELECT has_conflict, conflict_details;
END;
$$ LANGUAGE plpgsql;

-- Function to get current rate for a show/placement
CREATE OR REPLACE FUNCTION get_show_rate_at_date(
    p_schema TEXT,
    p_show_id TEXT,
    p_placement_type TEXT,
    p_date DATE
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_rate DECIMAL(10,2);
BEGIN
    EXECUTE format('
        SELECT rate
        FROM %I."ShowRateHistory"
        WHERE "showId" = $1
        AND "placementType" = $2
        AND "effectiveDate" <= $3
        AND ("expiryDate" IS NULL OR "expiryDate" >= $3)
        ORDER BY "effectiveDate" DESC
        LIMIT 1
    ', p_schema)
    INTO v_rate
    USING p_show_id, p_placement_type, p_date;
    
    -- If no rate history found, get from current show placement config
    IF v_rate IS NULL THEN
        EXECUTE format('
            SELECT CASE 
                WHEN $2 = ''preroll'' THEN "preRollRate"
                WHEN $2 = ''midroll'' THEN "midRollRate"
                WHEN $2 = ''postroll'' THEN "postRollRate"
            END
            FROM %I."ShowPlacement"
            WHERE "showId" = $1
            LIMIT 1
        ', p_schema)
        INTO v_rate
        USING p_show_id, p_placement_type;
    END IF;
    
    RETURN COALESCE(v_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- Insert system user for workflows
INSERT INTO public."User" (id, email, password, name, role, "organizationId", "updatedAt")
SELECT 'system-workflow', 'system-workflow@podcastflow.pro', '', 'Workflow System', 'master', NULL, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM public."User" WHERE id = 'system-workflow');

-- =====================================================
-- Migration completed successfully
-- =====================================================