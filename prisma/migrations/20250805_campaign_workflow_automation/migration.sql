-- Campaign Workflow Automation Migration
-- Phase 1: Database Schema Updates
-- Created: 2025-08-05
-- This migration adds support for campaign workflow automation including:
-- - Ad requests for producers/talent
-- - Creative requests for sellers
-- - Rate history tracking
-- - Category exclusivity management
-- - Organization settings for templates and billing

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
ADD COLUMN IF NOT EXISTS "defaultPaymentTerms" INTEGER DEFAULT 30, -- net 30 days
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

-- Create contract template table for multiple templates
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

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS "ContractTemplate_organizationId_idx" ON public."ContractTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "ContractTemplate_isDefault_idx" ON public."ContractTemplate"("isDefault") WHERE "isDefault" = true;

-- =====================================================
-- PART 2: Organization Schema Tables
-- =====================================================

-- Function to apply changes to all organization schemas
CREATE OR REPLACE FUNCTION apply_to_all_org_schemas(sql_template TEXT)
RETURNS void AS $$
DECLARE
    org_schema TEXT;
BEGIN
    FOR org_schema IN 
        SELECT DISTINCT schemaName 
        FROM public."Organization" 
        WHERE schemaName IS NOT NULL AND schemaName != 'public'
    LOOP
        -- Replace the placeholder with actual schema name
        EXECUTE replace(sql_template, '${schema}', org_schema);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add fields to Campaign table in all org schemas
DO $$
BEGIN
    PERFORM apply_to_all_org_schemas($template$
        ALTER TABLE "${schema}"."Campaign" 
        ADD COLUMN IF NOT EXISTS "probability" INTEGER DEFAULT 0 CHECK ("probability" >= 0 AND "probability" <= 100),
        ADD COLUMN IF NOT EXISTS "reservationId" TEXT,
        ADD COLUMN IF NOT EXISTS "reservationCreatedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "approvalRequestId" TEXT,
        ADD COLUMN IF NOT EXISTS "preBillRequired" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "preBillInvoiceId" TEXT,
        ADD COLUMN IF NOT EXISTS "categoryExclusivities" JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "lastStatusChangeAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "lastStatusChangeBy" TEXT;
    $template$);
END $$;

-- Create AdRequest table in all org schemas
DO $$
BEGIN
    PERFORM apply_to_all_org_schemas($template$
        CREATE TABLE IF NOT EXISTS "${schema}"."AdRequest" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "orderId" TEXT NOT NULL,
            "showId" TEXT NOT NULL,
            "episodeId" TEXT,
            "assignedToId" TEXT NOT NULL,
            "assignedToRole" TEXT NOT NULL, -- 'producer' or 'talent'
            "status" TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
            "priority" TEXT DEFAULT 'medium', -- low, medium, high, urgent
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
                REFERENCES "${schema}"."Order"("id") ON DELETE CASCADE,
            CONSTRAINT "AdRequest_showId_fkey" FOREIGN KEY ("showId") 
                REFERENCES "${schema}"."Show"("id") ON DELETE RESTRICT
        );

        -- Indexes for AdRequest
        CREATE INDEX IF NOT EXISTS "AdRequest_orderId_idx" ON "${schema}"."AdRequest"("orderId");
        CREATE INDEX IF NOT EXISTS "AdRequest_showId_idx" ON "${schema}"."AdRequest"("showId");
        CREATE INDEX IF NOT EXISTS "AdRequest_assignedToId_idx" ON "${schema}"."AdRequest"("assignedToId");
        CREATE INDEX IF NOT EXISTS "AdRequest_status_idx" ON "${schema}"."AdRequest"("status");
        CREATE INDEX IF NOT EXISTS "AdRequest_dueDate_idx" ON "${schema}"."AdRequest"("dueDate");
    $template$);
END $$;

-- Create CreativeRequest table in all org schemas
DO $$
BEGIN
    PERFORM apply_to_all_org_schemas($template$
        CREATE TABLE IF NOT EXISTS "${schema}"."CreativeRequest" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "orderId" TEXT NOT NULL,
            "campaignId" TEXT NOT NULL,
            "assignedToId" TEXT NOT NULL, -- seller user id
            "status" TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, submitted, approved, revision_needed
            "priority" TEXT DEFAULT 'medium',
            "dueDate" TIMESTAMP(3),
            "title" TEXT NOT NULL,
            "description" TEXT,
            "requiredAssets" JSONB DEFAULT '[]'::jsonb, -- list of required creative assets
            "submittedAssets" JSONB DEFAULT '[]'::jsonb, -- list of submitted assets with URLs
            "feedbackHistory" JSONB DEFAULT '[]'::jsonb,
            "submittedAt" TIMESTAMP(3),
            "approvedAt" TIMESTAMP(3),
            "approvedBy" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdBy" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            CONSTRAINT "CreativeRequest_orderId_fkey" FOREIGN KEY ("orderId") 
                REFERENCES "${schema}"."Order"("id") ON DELETE CASCADE,
            CONSTRAINT "CreativeRequest_campaignId_fkey" FOREIGN KEY ("campaignId") 
                REFERENCES "${schema}"."Campaign"("id") ON DELETE CASCADE
        );

        -- Indexes for CreativeRequest
        CREATE INDEX IF NOT EXISTS "CreativeRequest_orderId_idx" ON "${schema}"."CreativeRequest"("orderId");
        CREATE INDEX IF NOT EXISTS "CreativeRequest_campaignId_idx" ON "${schema}"."CreativeRequest"("campaignId");
        CREATE INDEX IF NOT EXISTS "CreativeRequest_assignedToId_idx" ON "${schema}"."CreativeRequest"("assignedToId");
        CREATE INDEX IF NOT EXISTS "CreativeRequest_status_idx" ON "${schema}"."CreativeRequest"("status");
    $template$);
END $$;

-- Create ShowRateHistory table in all org schemas for tracking rate changes
DO $$
BEGIN
    PERFORM apply_to_all_org_schemas($template$
        CREATE TABLE IF NOT EXISTS "${schema}"."ShowRateHistory" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "showId" TEXT NOT NULL,
            "placementType" TEXT NOT NULL, -- preroll, midroll, postroll
            "rate" DECIMAL(10,2) NOT NULL,
            "effectiveDate" DATE NOT NULL,
            "expiryDate" DATE,
            "notes" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdBy" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            CONSTRAINT "ShowRateHistory_showId_fkey" FOREIGN KEY ("showId") 
                REFERENCES "${schema}"."Show"("id") ON DELETE CASCADE
        );

        -- Indexes for ShowRateHistory
        CREATE INDEX IF NOT EXISTS "ShowRateHistory_showId_idx" ON "${schema}"."ShowRateHistory"("showId");
        CREATE INDEX IF NOT EXISTS "ShowRateHistory_effectiveDate_idx" ON "${schema}"."ShowRateHistory"("effectiveDate");
        CREATE INDEX IF NOT EXISTS "ShowRateHistory_showId_placement_idx" ON "${schema}"."ShowRateHistory"("showId", "placementType");
    $template$);
END $$;

-- Create CategoryExclusivity table in all org schemas
DO $$
BEGIN
    PERFORM apply_to_all_org_schemas($template$
        CREATE TABLE IF NOT EXISTS "${schema}"."CategoryExclusivity" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "showId" TEXT NOT NULL,
            "category" TEXT NOT NULL, -- automotive, finance, healthcare, etc.
            "level" TEXT NOT NULL DEFAULT 'episode', -- episode, show, network
            "advertiserId" TEXT, -- which advertiser holds the exclusivity
            "campaignId" TEXT, -- which campaign secured it
            "startDate" DATE NOT NULL,
            "endDate" DATE NOT NULL,
            "isActive" BOOLEAN DEFAULT true,
            "notes" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdBy" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            CONSTRAINT "CategoryExclusivity_showId_fkey" FOREIGN KEY ("showId") 
                REFERENCES "${schema}"."Show"("id") ON DELETE CASCADE,
            CONSTRAINT "CategoryExclusivity_advertiserId_fkey" FOREIGN KEY ("advertiserId") 
                REFERENCES "${schema}"."Advertiser"("id") ON DELETE SET NULL,
            CONSTRAINT "CategoryExclusivity_campaignId_fkey" FOREIGN KEY ("campaignId") 
                REFERENCES "${schema}"."Campaign"("id") ON DELETE SET NULL
        );

        -- Indexes for CategoryExclusivity
        CREATE INDEX IF NOT EXISTS "CategoryExclusivity_showId_idx" ON "${schema}"."CategoryExclusivity"("showId");
        CREATE INDEX IF NOT EXISTS "CategoryExclusivity_category_idx" ON "${schema}"."CategoryExclusivity"("category");
        CREATE INDEX IF NOT EXISTS "CategoryExclusivity_dates_idx" ON "${schema}"."CategoryExclusivity"("startDate", "endDate");
        CREATE INDEX IF NOT EXISTS "CategoryExclusivity_active_idx" ON "${schema}"."CategoryExclusivity"("isActive", "showId", "category");
    $template$);
END $$;

-- Update Reservation table to support campaign-level reservations
DO $$
BEGIN
    PERFORM apply_to_all_org_schemas($template$
        ALTER TABLE "${schema}"."Reservation" 
        ADD COLUMN IF NOT EXISTS "campaignId" TEXT,
        ADD COLUMN IF NOT EXISTS "approvalRequestId" TEXT,
        ADD COLUMN IF NOT EXISTS "autoExpireAt" TIMESTAMP(3),
        ADD CONSTRAINT "Reservation_campaignId_fkey" FOREIGN KEY ("campaignId") 
            REFERENCES "${schema}"."Campaign"("id") ON DELETE CASCADE;
        
        -- Index for campaign reservations
        CREATE INDEX IF NOT EXISTS "Reservation_campaignId_idx" ON "${schema}"."Reservation"("campaignId");
    $template$);
END $$;

-- Update Order table to track workflow metadata
DO $$
BEGIN
    PERFORM apply_to_all_org_schemas($template$
        ALTER TABLE "${schema}"."Order" 
        ADD COLUMN IF NOT EXISTS "sourceCampaignId" TEXT,
        ADD COLUMN IF NOT EXISTS "autoGenerated" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "contractId" TEXT,
        ADD COLUMN IF NOT EXISTS "preBillInvoiceId" TEXT,
        ADD COLUMN IF NOT EXISTS "workflowMetadata" JSONB DEFAULT '{}'::jsonb;
    $template$);
END $$;

-- Add advertiser credit terms
DO $$
BEGIN
    PERFORM apply_to_all_org_schemas($template$
        ALTER TABLE "${schema}"."Advertiser" 
        ADD COLUMN IF NOT EXISTS "creditTerms" INTEGER DEFAULT 0, -- 0 = no credit, 30 = net 30, etc.
        ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "requiresPreBill" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "categories" JSONB DEFAULT '[]'::jsonb; -- advertiser business categories
    $template$);
END $$;

-- =====================================================
-- PART 3: Notification System Enhancements
-- =====================================================

-- Add notification types for workflow
ALTER TABLE public."Notification" 
ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "requiresAction" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "actionCompletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "actionCompletedBy" TEXT;

-- Create indexes for better notification queries
CREATE INDEX IF NOT EXISTS "Notification_category_idx" ON public."Notification"("category");
CREATE INDEX IF NOT EXISTS "Notification_priority_idx" ON public."Notification"("priority");
CREATE INDEX IF NOT EXISTS "Notification_requiresAction_idx" ON public."Notification"("requiresAction") WHERE "requiresAction" = true;
CREATE INDEX IF NOT EXISTS "Notification_expiresAt_idx" ON public."Notification"("expiresAt") WHERE "expiresAt" IS NOT NULL;

-- =====================================================
-- PART 4: Activity Log Updates
-- =====================================================

-- Ensure Activity table exists in all org schemas with workflow tracking
DO $$
BEGIN
    PERFORM apply_to_all_org_schemas($template$
        CREATE TABLE IF NOT EXISTS "${schema}"."Activity" (
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

        -- Indexes for Activity
        CREATE INDEX IF NOT EXISTS "Activity_actorId_idx" ON "${schema}"."Activity"("actorId");
        CREATE INDEX IF NOT EXISTS "Activity_targetType_targetId_idx" ON "${schema}"."Activity"("targetType", "targetId");
        CREATE INDEX IF NOT EXISTS "Activity_campaignId_idx" ON "${schema}"."Activity"("campaignId");
        CREATE INDEX IF NOT EXISTS "Activity_orderId_idx" ON "${schema}"."Activity"("orderId");
        CREATE INDEX IF NOT EXISTS "Activity_createdAt_idx" ON "${schema}"."Activity"("createdAt");
    $template$);
END $$;

-- =====================================================
-- PART 5: Initial Data and Functions
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

-- Insert default notification categories
INSERT INTO public."User" (id, email, password, name, role, "organizationId")
SELECT 'system-workflow', 'system-workflow@podcastflow.pro', '', 'Workflow System', 'master', NULL
WHERE NOT EXISTS (SELECT 1 FROM public."User" WHERE id = 'system-workflow');

-- Clean up the function
DROP FUNCTION IF EXISTS apply_to_all_org_schemas(TEXT);

-- =====================================================
-- Migration completed successfully
-- =====================================================