-- Migration: Talent Approval System
-- Purpose: Add talent approval workflow at 65% for host-read/endorsed placements
-- Author: System
-- Date: 2025-08-12

-- Note: All tables created in org schemas, not public schema

DO $$
DECLARE
    org_schema TEXT;
BEGIN
    -- Iterate through all organization schemas
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Create TalentApprovalRequest table
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."TalentApprovalRequest" (
                id TEXT PRIMARY KEY DEFAULT ''tar_'' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
                "organizationId" TEXT NOT NULL,
                "campaignId" TEXT NOT NULL,
                "showId" TEXT NOT NULL,
                "talentId" TEXT,
                "advertiserId" TEXT NOT NULL,
                "placementType" TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT ''PENDING'' CHECK (status IN (''PENDING'', ''APPROVED'', ''DENIED'', ''EXPIRED'')),
                "requestedByUserId" TEXT NOT NULL,
                "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                "decidedByUserId" TEXT,
                "decidedAt" TIMESTAMP(3),
                reason TEXT,
                notes TEXT,
                metadata JSONB DEFAULT ''{}'',
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_campaign FOREIGN KEY ("campaignId") REFERENCES %I."Campaign"(id) ON DELETE CASCADE,
                CONSTRAINT fk_show FOREIGN KEY ("showId") REFERENCES %I."Show"(id) ON DELETE CASCADE,
                CONSTRAINT fk_advertiser FOREIGN KEY ("advertiserId") REFERENCES %I."Advertiser"(id) ON DELETE CASCADE
            )', org_schema, org_schema, org_schema, org_schema);

        -- Create indices for TalentApprovalRequest
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tar_org_campaign ON %I."TalentApprovalRequest"("organizationId", "campaignId")', 
            replace(org_schema, 'org_', ''), org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tar_show_status ON %I."TalentApprovalRequest"("showId", status)', 
            replace(org_schema, 'org_', ''), org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tar_talent_status ON %I."TalentApprovalRequest"("talentId", status) WHERE "talentId" IS NOT NULL', 
            replace(org_schema, 'org_', ''), org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tar_requested_at ON %I."TalentApprovalRequest"("requestedAt" DESC)', 
            replace(org_schema, 'org_', ''), org_schema);
        
        -- Add unique constraint to prevent duplicate requests
        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_tar_unique_request ON %I."TalentApprovalRequest"("campaignId", "showId", "placementType") WHERE status = ''PENDING''', 
            replace(org_schema, 'org_', ''), org_schema);

        RAISE NOTICE 'Created TalentApprovalRequest table in schema %', org_schema;
    END LOOP;
END $$;

-- Add workflow settings for talent approval
INSERT INTO public."WorkflowSettings" (
    id,
    "organizationId",
    "workflowType",
    stages,
    thresholds,
    notifications,
    metadata,
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'ws_talent_' || o.id,
    o.id,
    'talent_approval',
    '["pending", "approved", "denied"]'::jsonb,
    '{}'::jsonb,
    '{"enabled": true, "channels": ["inbox", "email"]}'::jsonb,
    '{"talentApprovalAt65": true, "autoExpireDays": 7}'::jsonb,
    true,
    NOW(),
    NOW()
FROM public."Organization" o
WHERE NOT EXISTS (
    SELECT 1 FROM public."WorkflowSettings" ws 
    WHERE ws."organizationId" = o.id 
    AND ws."workflowType" = 'talent_approval'
)
ON CONFLICT DO NOTHING;

-- Update existing workflow settings to include talentApprovalAt65 flag
UPDATE public."WorkflowSettings"
SET 
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{talentApprovalAt65}',
        'true'::jsonb
    ),
    "updatedAt" = NOW()
WHERE "workflowType" = 'campaign_approval'
AND (metadata->>'talentApprovalAt65' IS NULL OR metadata->>'talentApprovalAt65' = '');

COMMENT ON TABLE org_podcastflow_pro."TalentApprovalRequest" IS 'Tracks talent/producer approvals for host-read and endorsed placements at 65% probability';