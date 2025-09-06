-- Workflow Settings Migration
-- This migration is REVERSIBLE - includes both UP and DOWN operations

-- UP Migration: Create workflow_settings table
DO $$
BEGIN
    -- Check if table doesn't exist before creating
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'WorkflowSettings'
    ) THEN
        CREATE TABLE public."WorkflowSettings" (
            "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "organizationId" TEXT NOT NULL,
            "workflowType" TEXT NOT NULL DEFAULT 'campaign_approval',
            "stages" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "thresholds" JSONB NOT NULL DEFAULT '{
                "approval_trigger": 90,
                "auto_win": 100,
                "rejection_fallback": 65,
                "reservation_threshold": 80
            }'::jsonb,
            "notifications" JSONB NOT NULL DEFAULT '{
                "enabled": true,
                "notify_on_trigger": true,
                "notify_on_approval": true,
                "notify_on_rejection": true,
                "recipient_roles": ["admin", "master"]
            }'::jsonb,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdBy" TEXT,
            "updatedBy" TEXT,
            
            CONSTRAINT "WorkflowSettings_organizationId_fkey" 
                FOREIGN KEY ("organizationId") 
                REFERENCES public."Organization"("id") 
                ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "WorkflowSettings_createdBy_fkey" 
                FOREIGN KEY ("createdBy") 
                REFERENCES public."User"("id") 
                ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT "WorkflowSettings_updatedBy_fkey" 
                FOREIGN KEY ("updatedBy") 
                REFERENCES public."User"("id") 
                ON DELETE SET NULL ON UPDATE CASCADE
        );

        -- Create indexes
        CREATE INDEX "WorkflowSettings_organizationId_idx" ON public."WorkflowSettings"("organizationId");
        CREATE UNIQUE INDEX "WorkflowSettings_organizationId_workflowType_key" 
            ON public."WorkflowSettings"("organizationId", "workflowType");
        
        -- Insert default settings for existing organizations
        INSERT INTO public."WorkflowSettings" ("organizationId", "workflowType", "stages")
        SELECT 
            id as "organizationId",
            'campaign_approval' as "workflowType",
            '[
                {
                    "id": "stage_draft",
                    "name": "Draft",
                    "threshold": 0,
                    "status": "draft",
                    "color": "#9e9e9e",
                    "description": "Initial campaign creation",
                    "actions": [],
                    "order": 1
                },
                {
                    "id": "stage_proposal",
                    "name": "Proposal",
                    "threshold": 25,
                    "status": "proposal",
                    "color": "#2196f3",
                    "description": "Campaign proposal phase",
                    "actions": ["notify_sales_team"],
                    "order": 2
                },
                {
                    "id": "stage_negotiation",
                    "name": "Negotiation",
                    "threshold": 50,
                    "status": "negotiation",
                    "color": "#ff9800",
                    "description": "Active negotiation with client",
                    "actions": ["track_communications"],
                    "order": 3
                },
                {
                    "id": "stage_pending",
                    "name": "Pending Approval",
                    "threshold": 90,
                    "status": "pending",
                    "color": "#f44336",
                    "description": "Awaiting admin approval",
                    "actions": [
                        "create_approval_request",
                        "reserve_inventory",
                        "notify_admins",
                        "validate_rates"
                    ],
                    "order": 4
                },
                {
                    "id": "stage_won",
                    "name": "Won",
                    "threshold": 100,
                    "status": "won",
                    "color": "#4caf50",
                    "description": "Deal closed and confirmed",
                    "actions": [
                        "create_order",
                        "generate_contract",
                        "schedule_campaign",
                        "notify_all_stakeholders"
                    ],
                    "order": 5
                }
            ]'::jsonb as "stages"
        FROM public."Organization"
        WHERE NOT EXISTS (
            SELECT 1 FROM public."WorkflowSettings" ws 
            WHERE ws."organizationId" = "Organization".id 
            AND ws."workflowType" = 'campaign_approval'
        );

        RAISE NOTICE 'WorkflowSettings table created successfully';
    ELSE
        RAISE NOTICE 'WorkflowSettings table already exists';
    END IF;
END $$;

-- Create function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_workflow_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updatedAt
DROP TRIGGER IF EXISTS update_workflow_settings_updated_at_trigger ON public."WorkflowSettings";
CREATE TRIGGER update_workflow_settings_updated_at_trigger
BEFORE UPDATE ON public."WorkflowSettings"
FOR EACH ROW
EXECUTE FUNCTION update_workflow_settings_updated_at();

-- DOWN Migration: Rollback procedure
-- To rollback this migration, run:
-- DROP TABLE IF EXISTS public."WorkflowSettings" CASCADE;
-- DROP FUNCTION IF EXISTS update_workflow_settings_updated_at() CASCADE;