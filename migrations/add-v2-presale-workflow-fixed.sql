-- Migration: Add v2 pre-sale workflow settings
-- Date: 2025-08-12
-- Description: Enable v2 pre-sale timing with 10% default and 35% auto-advance

-- Add metadata column if it doesn't exist
ALTER TABLE public."WorkflowSettings" 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Insert or update workflow settings for PodcastFlow Pro organization with v2PresaleTiming
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
    "enabled": true,
    "notify_on_trigger": true,
    "notify_on_approval": true,
    "notify_on_rejection": true,
    "recipient_roles": ["admin", "master"]
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
  stages = EXCLUDED.stages,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Also add settings for Unfy organization
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
  (SELECT id FROM public."Organization" WHERE slug = 'unfy' LIMIT 1),
  'campaign_approval',
  '["active-presale", "prospecting", "qualified", "pending-approval", "won"]'::jsonb,
  '{
    "approval_trigger": 90,
    "auto_win": 100,
    "rejection_fallback": 65,
    "reservation_threshold": 80
  }'::jsonb,
  '{
    "enabled": true,
    "notify_on_trigger": true,
    "notify_on_approval": true,
    "notify_on_rejection": true,
    "recipient_roles": ["admin", "master"]
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
  stages = EXCLUDED.stages,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Update any existing campaigns at 0% or NULL to 10% for PodcastFlow Pro
UPDATE org_podcastflow_pro."Campaign"
SET probability = 10,
    status = 'active-presale'
WHERE (probability IS NULL OR probability = 0)
  AND status IN ('draft', 'prospecting')
  AND "createdAt" > CURRENT_DATE - INTERVAL '30 days';

-- Update any existing campaigns at 0% or NULL to 10% for Unfy
UPDATE org_unfy."Campaign"
SET probability = 10,
    status = 'active-presale'
WHERE (probability IS NULL OR probability = 0)
  AND status IN ('draft', 'prospecting')
  AND "createdAt" > CURRENT_DATE - INTERVAL '30 days';

-- Add comment
COMMENT ON COLUMN public."WorkflowSettings".metadata IS 'Feature flags and additional settings including v2PresaleTiming';

-- Verify the settings were applied
SELECT 
  o.name as organization,
  ws."workflowType",
  ws.metadata->>'v2PresaleTiming' as v2_presale_timing,
  ws."isActive"
FROM public."WorkflowSettings" ws
JOIN public."Organization" o ON o.id = ws."organizationId"
WHERE ws."workflowType" = 'campaign_approval';

-- Rollback script (save as separate file)
-- UPDATE public."WorkflowSettings" 
-- SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{v2PresaleTiming}', 'false'::jsonb)
-- WHERE "workflowType" = 'campaign_approval';