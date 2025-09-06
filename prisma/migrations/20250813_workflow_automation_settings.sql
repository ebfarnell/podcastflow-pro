-- Workflow Automation Settings Migration
-- This migration adds configurable workflow automation settings per organization

BEGIN;

-- Function to create workflow automation tables for an organization schema
CREATE OR REPLACE FUNCTION create_workflow_automation_tables(schema_name text)
RETURNS void AS $$
BEGIN
  -- WorkflowAutomationSetting table for key-value configuration
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I."WorkflowAutomationSetting" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      key TEXT NOT NULL,
      value JSONB NOT NULL,
      description TEXT,
      "isEnabled" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdBy" TEXT,
      "updatedBy" TEXT,
      CONSTRAINT "WorkflowAutomationSetting_key_unique" UNIQUE (key)
    )', schema_name);

  -- WorkflowTrigger table for custom triggers
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I."WorkflowTrigger" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      event TEXT NOT NULL,
      condition JSONB,
      actions JSONB NOT NULL,
      "isEnabled" BOOLEAN DEFAULT true,
      priority INTEGER DEFAULT 100,
      "lastExecutedAt" TIMESTAMP(3),
      "executionCount" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdBy" TEXT,
      "updatedBy" TEXT
    )', schema_name);

  -- WorkflowActionTemplate table for reusable action definitions
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I."WorkflowActionTemplate" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config JSONB NOT NULL,
      description TEXT,
      "isSystem" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WorkflowActionTemplate_name_unique" UNIQUE (name)
    )', schema_name);

  -- TriggerExecutionLog for idempotency and audit
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I."TriggerExecutionLog" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "triggerId" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      event TEXT NOT NULL,
      condition JSONB,
      actions JSONB,
      result JSONB,
      status TEXT NOT NULL CHECK (status IN (''success'', ''failed'', ''skipped'')),
      error TEXT,
      "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "executedBy" TEXT,
      CONSTRAINT "TriggerExecutionLog_unique_execution" UNIQUE ("triggerId", "entityId", event)
    )', schema_name);

  -- Create indexes for performance
  EXECUTE format('CREATE INDEX IF NOT EXISTS "WorkflowTrigger_event_idx" ON %I."WorkflowTrigger" (event)', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS "WorkflowTrigger_isEnabled_idx" ON %I."WorkflowTrigger" ("isEnabled")', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS "WorkflowTrigger_condition_idx" ON %I."WorkflowTrigger" USING GIN (condition)', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS "WorkflowTrigger_actions_idx" ON %I."WorkflowTrigger" USING GIN (actions)', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS "TriggerExecutionLog_triggerId_idx" ON %I."TriggerExecutionLog" ("triggerId")', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS "TriggerExecutionLog_entityId_idx" ON %I."TriggerExecutionLog" ("entityId")', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS "TriggerExecutionLog_executedAt_idx" ON %I."TriggerExecutionLog" ("executedAt")', schema_name);

  -- Add update trigger for updatedAt
  EXECUTE format('
    CREATE OR REPLACE TRIGGER update_workflow_automation_setting_updated_at
    BEFORE UPDATE ON %I."WorkflowAutomationSetting"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  ', schema_name);

  EXECUTE format('
    CREATE OR REPLACE TRIGGER update_workflow_trigger_updated_at
    BEFORE UPDATE ON %I."WorkflowTrigger"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  ', schema_name);

  EXECUTE format('
    CREATE OR REPLACE TRIGGER update_workflow_action_template_updated_at
    BEFORE UPDATE ON %I."WorkflowActionTemplate"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  ', schema_name);

EXCEPTION WHEN duplicate_table THEN
  -- Tables already exist, skip creation
  NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to seed default workflow settings
CREATE OR REPLACE FUNCTION seed_default_workflow_settings(schema_name text, org_id text)
RETURNS void AS $$
BEGIN
  -- Check if settings already exist
  EXECUTE format('
    SELECT 1 FROM %I."WorkflowAutomationSetting" WHERE key = ''milestone.thresholds'' LIMIT 1
  ', schema_name);
  
  -- If settings exist, skip seeding
  IF FOUND THEN
    RETURN;
  END IF;

  -- Seed default milestone thresholds
  EXECUTE format('
    INSERT INTO %I."WorkflowAutomationSetting" (key, value, description, "isEnabled")
    VALUES (
      ''milestone.thresholds'',
      ''{"pre_sale_active": 10, "schedule_available": 10, "schedule_valid": 35, "talent_approval_required": 65, "admin_approval_required": 90, "auto_reservation": 90, "order_creation": 100}''::jsonb,
      ''Probability thresholds for workflow milestones'',
      true
    )
  ', schema_name);

  -- Seed default approval rules
  EXECUTE format('
    INSERT INTO %I."WorkflowAutomationSetting" (key, value, description, "isEnabled")
    VALUES (
      ''approval.rules'',
      ''{"campaignApproval": {"enabled": true, "at": 90, "roles": ["admin", "master"]}, "talentApproval": {"enabled": true, "at": 65, "types": ["host_read", "endorsement"], "fallback": "producer"}}''::jsonb,
      ''Approval workflow configuration'',
      true
    )
  ', schema_name);

  -- Seed notification settings
  EXECUTE format('
    INSERT INTO %I."WorkflowAutomationSetting" (key, value, description, "isEnabled")
    VALUES (
      ''notifications.enabled'',
      ''{"email": true, "inApp": true, "webhook": false}''::jsonb,
      ''Notification channel configuration'',
      true
    )
  ', schema_name);

  -- Seed rate card delta settings
  EXECUTE format('
    INSERT INTO %I."WorkflowAutomationSetting" (key, value, description, "isEnabled")
    VALUES (
      ''rate_card.delta_tracking'',
      ''{"enabled": true, "threshold_percent": 10, "require_approval_above": 20}''::jsonb,
      ''Rate card delta tracking configuration'',
      true
    )
  ', schema_name);

  -- Seed competitive category settings
  EXECUTE format('
    INSERT INTO %I."WorkflowAutomationSetting" (key, value, description, "isEnabled")
    VALUES (
      ''competitive.category_checking'',
      ''{"enabled": true, "mode": "warn", "buffer_days": 30}''::jsonb,
      ''Competitive category conflict checking'',
      true
    )
  ', schema_name);

  -- Seed system action templates
  EXECUTE format('
    INSERT INTO %I."WorkflowActionTemplate" (name, type, config, description, "isSystem")
    VALUES 
      (''send_notification'', ''notification'', ''{"channels": ["email", "inApp"], "template": "default"}''::jsonb, ''Send notification to users'', true),
      (''create_reservation'', ''reservation'', ''{"status": "held", "expiryDays": 14}''::jsonb, ''Create inventory reservation'', true),
      (''require_approval'', ''approval'', ''{"type": "campaign", "roles": ["admin"]}''::jsonb, ''Require approval from specified roles'', true),
      (''change_probability'', ''update'', ''{"field": "probability", "operation": "set"}''::jsonb, ''Change campaign probability'', true),
      (''transition_status'', ''update'', ''{"field": "status", "operation": "set"}''::jsonb, ''Transition campaign status'', true),
      (''emit_webhook'', ''webhook'', ''{"method": "POST", "headers": {"Content-Type": "application/json"}}''::jsonb, ''Send webhook notification'', true)
  ', schema_name);

EXCEPTION WHEN unique_violation THEN
  -- Settings already exist, skip
  NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply to existing organization schemas
DO $$
DECLARE
  org_record RECORD;
BEGIN
  -- Apply to org_podcastflow_pro
  PERFORM create_workflow_automation_tables('org_podcastflow_pro');
  PERFORM seed_default_workflow_settings('org_podcastflow_pro', 'cmd2qfev00000og5y8hftu795');
  
  -- Apply to org_unfy
  PERFORM create_workflow_automation_tables('org_unfy');
  PERFORM seed_default_workflow_settings('org_unfy', 'cmd2qfex00001og5y0d8lw2ht');
  
  -- Apply to any other org schemas
  FOR org_record IN 
    SELECT nspname as schema_name
    FROM pg_namespace 
    WHERE nspname LIKE 'org_%' 
      AND nspname NOT IN ('org_podcastflow_pro', 'org_unfy')
  LOOP
    PERFORM create_workflow_automation_tables(org_record.schema_name);
    -- Note: We don't have org_id for other schemas, so we skip seeding
  END LOOP;
END $$;

-- Create or replace the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Rollback script (save as separate file)
-- BEGIN;
-- DROP TABLE IF EXISTS org_podcastflow_pro."TriggerExecutionLog";
-- DROP TABLE IF EXISTS org_podcastflow_pro."WorkflowActionTemplate";
-- DROP TABLE IF EXISTS org_podcastflow_pro."WorkflowTrigger";
-- DROP TABLE IF EXISTS org_podcastflow_pro."WorkflowAutomationSetting";
-- DROP TABLE IF EXISTS org_unfy."TriggerExecutionLog";
-- DROP TABLE IF EXISTS org_unfy."WorkflowActionTemplate";
-- DROP TABLE IF EXISTS org_unfy."WorkflowTrigger";
-- DROP TABLE IF EXISTS org_unfy."WorkflowAutomationSetting";
-- DROP FUNCTION IF EXISTS create_workflow_automation_tables(text);
-- DROP FUNCTION IF EXISTS seed_default_workflow_settings(text, text);
-- COMMIT;