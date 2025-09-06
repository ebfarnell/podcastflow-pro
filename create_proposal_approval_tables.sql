-- Create proposal approval workflow tables for both organization schemas

-- Function to create approval tables in a schema
CREATE OR REPLACE FUNCTION create_proposal_approval_tables(schema_name text) RETURNS void AS $$
BEGIN
    -- Add approval fields to Proposal table if they don't exist
    EXECUTE format('
        ALTER TABLE %I."Proposal" 
        ADD COLUMN IF NOT EXISTS "approvalStatus" VARCHAR(50) DEFAULT ''draft'',
        ADD COLUMN IF NOT EXISTS "submittedForApprovalAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "approvedBy" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "currentApproverId" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "approvalNotes" TEXT,
        ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "parentProposalId" VARCHAR(255)
    ', schema_name);

    -- Create ProposalApproval table for tracking approval history
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."ProposalApproval" (
            "id" VARCHAR(255) NOT NULL,
            "proposalId" VARCHAR(255) NOT NULL,
            "approverId" VARCHAR(255) NOT NULL,
            "status" VARCHAR(50) NOT NULL,
            "comments" TEXT,
            "approvedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "requiredChanges" JSONB,
            "approvalLevel" INTEGER DEFAULT 1,
            
            CONSTRAINT "ProposalApproval_pkey" PRIMARY KEY ("id")
        )
    ', schema_name);

    -- Create ProposalComment table for discussion threads
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."ProposalComment" (
            "id" VARCHAR(255) NOT NULL,
            "proposalId" VARCHAR(255) NOT NULL,
            "userId" VARCHAR(255) NOT NULL,
            "comment" TEXT NOT NULL,
            "isInternal" BOOLEAN DEFAULT false,
            "parentCommentId" VARCHAR(255),
            "attachments" JSONB,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            
            CONSTRAINT "ProposalComment_pkey" PRIMARY KEY ("id")
        )
    ', schema_name);

    -- Create ProposalRevision table for tracking changes
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."ProposalRevision" (
            "id" VARCHAR(255) NOT NULL,
            "proposalId" VARCHAR(255) NOT NULL,
            "version" INTEGER NOT NULL,
            "changes" JSONB NOT NULL,
            "changedBy" VARCHAR(255) NOT NULL,
            "changeReason" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "proposalSnapshot" JSONB,
            
            CONSTRAINT "ProposalRevision_pkey" PRIMARY KEY ("id")
        )
    ', schema_name);

    -- Create ApprovalWorkflow table for defining approval chains
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."ApprovalWorkflow" (
            "id" VARCHAR(255) NOT NULL,
            "name" VARCHAR(255) NOT NULL,
            "description" TEXT,
            "isActive" BOOLEAN DEFAULT true,
            "conditions" JSONB,
            "approvalSteps" JSONB NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdBy" VARCHAR(255),
            
            CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
        )
    ', schema_name);

    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS "ProposalApproval_proposalId_idx" ON %I."ProposalApproval"("proposalId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "ProposalApproval_approverId_idx" ON %I."ProposalApproval"("approverId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "ProposalApproval_status_idx" ON %I."ProposalApproval"("status")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "ProposalComment_proposalId_idx" ON %I."ProposalComment"("proposalId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "ProposalComment_userId_idx" ON %I."ProposalComment"("userId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "ProposalRevision_proposalId_idx" ON %I."ProposalRevision"("proposalId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "Proposal_approvalStatus_idx" ON %I."Proposal"("approvalStatus")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "Proposal_currentApproverId_idx" ON %I."Proposal"("currentApproverId")', schema_name);

    -- Add foreign key constraints
    EXECUTE format('
        ALTER TABLE %I."ProposalApproval" 
        ADD CONSTRAINT "ProposalApproval_proposalId_fkey" 
        FOREIGN KEY ("proposalId") REFERENCES %I."Proposal"("id") ON DELETE CASCADE
    ', schema_name, schema_name);

    EXECUTE format('
        ALTER TABLE %I."ProposalComment" 
        ADD CONSTRAINT "ProposalComment_proposalId_fkey" 
        FOREIGN KEY ("proposalId") REFERENCES %I."Proposal"("id") ON DELETE CASCADE
    ', schema_name, schema_name);

    EXECUTE format('
        ALTER TABLE %I."ProposalRevision" 
        ADD CONSTRAINT "ProposalRevision_proposalId_fkey" 
        FOREIGN KEY ("proposalId") REFERENCES %I."Proposal"("id") ON DELETE CASCADE
    ', schema_name, schema_name);

END;
$$ LANGUAGE plpgsql;

-- Apply to both organization schemas
SELECT create_proposal_approval_tables('org_podcastflow_pro');
SELECT create_proposal_approval_tables('org_unfy');

-- Insert default approval workflows
INSERT INTO org_podcastflow_pro."ApprovalWorkflow" (id, name, description, "approvalSteps", "createdBy") VALUES
('workflow_standard', 'Standard Approval', 'Standard single-level approval workflow', 
 '[{"level": 1, "approverRole": "admin", "requireAll": false}]'::jsonb, 
 'cmd2qff240004og5y1f5msy5g'),
('workflow_high_value', 'High Value Approval', 'Multi-level approval for high-value proposals', 
 '[{"level": 1, "approverRole": "sales", "requireAll": false}, {"level": 2, "approverRole": "admin", "requireAll": true}]'::jsonb, 
 'cmd2qff240004og5y1f5msy5g'),
('workflow_executive', 'Executive Approval', 'Requires executive approval', 
 '[{"level": 1, "approverRole": "admin", "requireAll": false}, {"level": 2, "approverRole": "master", "requireAll": true}]'::jsonb, 
 'cmd2qff240004og5y1f5msy5g');

-- Copy workflows to unfy schema
INSERT INTO org_unfy."ApprovalWorkflow" (id, name, description, "approvalSteps", "createdBy")
SELECT id, name, description, "approvalSteps", "createdBy" FROM org_podcastflow_pro."ApprovalWorkflow";

-- Drop the function
DROP FUNCTION create_proposal_approval_tables(text);