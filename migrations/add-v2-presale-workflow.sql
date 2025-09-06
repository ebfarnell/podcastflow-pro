-- Migration: Add v2 pre-sale workflow settings
-- Date: 2025-08-12
-- Description: Enable v2 pre-sale timing with 10% default and 35% auto-advance

-- Ensure WorkflowSettings table exists in public schema
CREATE TABLE IF NOT EXISTS public."WorkflowSettings" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "workflowType" TEXT NOT NULL,
  stages JSONB,
  thresholds JSONB,
  notifications JSONB,
  metadata JSONB,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("organizationId", "workflowType")
);

-- Insert or update workflow settings for PodcastFlow Pro organization
INSERT INTO public."WorkflowSettings" (
  id,
  "organizationId",
  "workflowType",
  stages,
  thresholds,
  notifications,
  metadata,
  "isActive"
) VALUES (
  gen_random_uuid()::text,
  (SELECT id FROM public."Organization" WHERE slug = 'podcastflow-pro' LIMIT 1),
  'campaign_approval',
  '["active-presale", "prospecting", "qualified", "pending-approval", "won"]'::jsonb,
  '{
    "approval_trigger": 90,
    "auto_win": 100,
    "rejection_fallback": 65,
    "reservation_threshold": 80
  }'::jsonb,
  '{
    "notifyOnStatusChange": true,
    "notifyOnApproval": true,
    "notifyOnRejection": true
  }'::jsonb,
  '{
    "v2PresaleTiming": true,
    "autoReserveAt90": true,
    "requireAdminApprovalAt90": true,
    "autoAssignAdRequests": true,
    "autoGenerateContracts": false,
    "autoGenerateInvoices": false,
    "defaultInvoiceDay": 1,
    "autoSendInvoices": false
  }'::jsonb,
  true
)
ON CONFLICT ("organizationId", "workflowType") 
DO UPDATE SET
  metadata = jsonb_set(
    COALESCE("WorkflowSettings".metadata, '{}'::jsonb),
    '{v2PresaleTiming}',
    'true'::jsonb
  ),
  thresholds = EXCLUDED.thresholds,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Update any existing campaigns at 0% or NULL to 10%
UPDATE org_podcastflow_pro."Campaign"
SET probability = 10,
    status = 'active-presale'
WHERE (probability IS NULL OR probability = 0)
  AND status IN ('draft', 'prospecting')
  AND "createdAt" > CURRENT_DATE - INTERVAL '30 days';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_workflow_settings_org_type 
ON public."WorkflowSettings"("organizationId", "workflowType");

-- Add comment
COMMENT ON TABLE public."WorkflowSettings" IS 'Workflow configuration and feature flags per organization';
COMMENT ON COLUMN public."WorkflowSettings".metadata IS 'Feature flags and additional settings including v2PresaleTiming';

-- Rollback script (save as separate file)
-- UPDATE public."WorkflowSettings" 
-- SET metadata = jsonb_set(metadata, '{v2PresaleTiming}', 'false'::jsonb)
-- WHERE "workflowType" = 'campaign_approval';