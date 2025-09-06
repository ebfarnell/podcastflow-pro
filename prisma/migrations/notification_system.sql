-- Comprehensive Notification System Migration
-- Creates all required tables and functions for full notification system

-- 1. Add notification settings to Organization settings JSON if not present
-- (Settings field already exists as JSON in Organization table)

-- 2. Create notification preferences table for per-user overrides (public schema)
CREATE TABLE IF NOT EXISTS "UserNotificationPreference" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "enabled" BOOLEAN DEFAULT true,
  "channels" JSONB DEFAULT '{"email": true, "inApp": true, "slack": false, "webhook": false}'::jsonb,
  "quietHours" JSONB DEFAULT NULL, -- {"start": "22:00", "end": "08:00", "timezone": "America/New_York"}
  "digest" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserNotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  UNIQUE ("userId", "organizationId", "eventType")
);

CREATE INDEX IF NOT EXISTS "UserNotificationPreference_userId_idx" ON "UserNotificationPreference"("userId");
CREATE INDEX IF NOT EXISTS "UserNotificationPreference_organizationId_idx" ON "UserNotificationPreference"("organizationId");
CREATE INDEX IF NOT EXISTS "UserNotificationPreference_eventType_idx" ON "UserNotificationPreference"("eventType");

-- 3. Create notification delivery log table (public schema)
CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "eventType" TEXT NOT NULL,
  "eventPayload" JSONB NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "recipientEmail" TEXT,
  "channel" TEXT NOT NULL, -- 'email', 'inApp', 'slack', 'webhook'
  "status" TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'retrying'
  "attempts" INTEGER DEFAULT 0,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "NotificationDelivery_idempotencyKey_idx" ON "NotificationDelivery"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_organizationId_idx" ON "NotificationDelivery"("organizationId");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_recipientId_idx" ON "NotificationDelivery"("recipientId");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_eventType_idx" ON "NotificationDelivery"("eventType");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "NotificationDelivery_nextRetryAt_idx" ON "NotificationDelivery"("nextRetryAt") WHERE "status" = 'retrying';

-- 4. Create notification templates table (public schema, shared across orgs with org-specific customization)
CREATE TABLE IF NOT EXISTS "NotificationTemplate" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" TEXT,
  "eventType" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT, -- For email
  "title" TEXT, -- For in-app/slack
  "bodyHtml" TEXT, -- For email HTML
  "bodyText" TEXT, -- For email text/slack/webhook
  "bodyJson" JSONB, -- For webhook payloads
  "variables" JSONB DEFAULT '[]'::jsonb, -- List of available variables
  "isDefault" BOOLEAN DEFAULT false,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  CONSTRAINT "NotificationTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  UNIQUE ("organizationId", "eventType", "channel", "name")
);

CREATE INDEX IF NOT EXISTS "NotificationTemplate_organizationId_idx" ON "NotificationTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "NotificationTemplate_eventType_idx" ON "NotificationTemplate"("eventType");
CREATE INDEX IF NOT EXISTS "NotificationTemplate_channel_idx" ON "NotificationTemplate"("channel");
CREATE INDEX IF NOT EXISTS "NotificationTemplate_isDefault_idx" ON "NotificationTemplate"("isDefault");

-- 5. Create notification queue table for async processing
CREATE TABLE IF NOT EXISTS "NotificationQueue" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventType" TEXT NOT NULL,
  "eventPayload" JSONB NOT NULL,
  "organizationId" TEXT NOT NULL,
  "priority" INTEGER DEFAULT 5, -- 1-10, 1 is highest
  "scheduledFor" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
  "attempts" INTEGER DEFAULT 0,
  "maxAttempts" INTEGER DEFAULT 3,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationQueue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "NotificationQueue_status_idx" ON "NotificationQueue"("status");
CREATE INDEX IF NOT EXISTS "NotificationQueue_scheduledFor_idx" ON "NotificationQueue"("scheduledFor") WHERE "status" = 'queued';
CREATE INDEX IF NOT EXISTS "NotificationQueue_priority_idx" ON "NotificationQueue"("priority" DESC);
CREATE INDEX IF NOT EXISTS "NotificationQueue_organizationId_idx" ON "NotificationQueue"("organizationId");

-- 6. Add additional fields to existing Notification table for better tracking
ALTER TABLE "Notification" 
ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
ADD COLUMN IF NOT EXISTS "eventType" TEXT,
ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deliveryId" TEXT,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Add foreign key and indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Notification_organizationId_fkey'
  ) THEN
    ALTER TABLE "Notification" 
    ADD CONSTRAINT "Notification_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_organizationId_idx" ON "Notification"("organizationId");
CREATE INDEX IF NOT EXISTS "Notification_eventType_idx" ON "Notification"("eventType");
CREATE INDEX IF NOT EXISTS "Notification_priority_idx" ON "Notification"("priority");
CREATE INDEX IF NOT EXISTS "Notification_deletedAt_idx" ON "Notification"("deletedAt");

-- 7. Create audit log table for notification settings changes
CREATE TABLE IF NOT EXISTS "NotificationAuditLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL, -- 'settings_updated', 'template_created', 'template_updated', 'preference_changed'
  "entityType" TEXT NOT NULL, -- 'org_settings', 'user_preference', 'template'
  "entityId" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "NotificationAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "NotificationAuditLog_organizationId_idx" ON "NotificationAuditLog"("organizationId");
CREATE INDEX IF NOT EXISTS "NotificationAuditLog_userId_idx" ON "NotificationAuditLog"("userId");
CREATE INDEX IF NOT EXISTS "NotificationAuditLog_action_idx" ON "NotificationAuditLog"("action");
CREATE INDEX IF NOT EXISTS "NotificationAuditLog_createdAt_idx" ON "NotificationAuditLog"("createdAt" DESC);

-- 8. Create function to compute idempotency key
CREATE OR REPLACE FUNCTION compute_notification_idempotency_key(
  p_org_id TEXT,
  p_event_type TEXT,
  p_recipient_id TEXT,
  p_event_payload JSONB,
  p_timestamp TIMESTAMP
) RETURNS TEXT AS $$
BEGIN
  -- Round timestamp to nearest minute to prevent duplicate sends
  RETURN encode(
    digest(
      p_org_id || ':' || 
      p_event_type || ':' || 
      p_recipient_id || ':' || 
      p_event_payload::TEXT || ':' ||
      date_trunc('minute', p_timestamp)::TEXT,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. Create function to check if notification should be sent based on preferences
CREATE OR REPLACE FUNCTION should_send_notification(
  p_user_id TEXT,
  p_org_id TEXT,
  p_event_type TEXT,
  p_channel TEXT,
  p_org_settings JSONB,
  p_current_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_pref RECORD;
  v_event_config JSONB;
  v_quiet_hours JSONB;
  v_start_hour TIME;
  v_end_hour TIME;
  v_current_hour TIME;
BEGIN
  -- Get org-level event configuration
  v_event_config := p_org_settings->'events'->p_event_type;
  
  -- Check if event is enabled at org level
  IF v_event_config IS NULL OR (v_event_config->>'enabled')::BOOLEAN = false THEN
    RETURN false;
  END IF;
  
  -- Check if event is mandatory (bypasses user preferences)
  IF (v_event_config->>'mandatory')::BOOLEAN = true THEN
    -- Check quiet hours bypass for urgent events
    IF (v_event_config->>'quietHourBypass')::BOOLEAN = true THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Get user preferences
  SELECT * INTO v_user_pref
  FROM "UserNotificationPreference"
  WHERE "userId" = p_user_id
    AND "organizationId" = p_org_id
    AND "eventType" = p_event_type;
  
  -- Check user preference enabled
  IF v_user_pref.enabled = false THEN
    -- Unless it's mandatory
    IF (v_event_config->>'mandatory')::BOOLEAN != true THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Check channel preference
  IF v_user_pref.channels IS NOT NULL THEN
    IF (v_user_pref.channels->>p_channel)::BOOLEAN = false THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Check quiet hours (unless bypassed)
  IF (v_event_config->>'quietHourBypass')::BOOLEAN != true THEN
    v_quiet_hours := COALESCE(v_user_pref."quietHours", p_org_settings->'quietHours');
    IF v_quiet_hours IS NOT NULL THEN
      v_start_hour := (v_quiet_hours->>'start')::TIME;
      v_end_hour := (v_quiet_hours->>'end')::TIME;
      v_current_hour := p_current_time::TIME;
      
      -- Handle overnight quiet hours (e.g., 22:00 to 08:00)
      IF v_start_hour > v_end_hour THEN
        IF v_current_hour >= v_start_hour OR v_current_hour < v_end_hour THEN
          RETURN false;
        END IF;
      ELSE
        IF v_current_hour >= v_start_hour AND v_current_hour < v_end_hour THEN
          RETURN false;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 10. Create default notification templates
INSERT INTO "NotificationTemplate" (
  "eventType", "channel", "name", "subject", "title", "bodyHtml", "bodyText", "variables", "isDefault"
) VALUES
-- Campaign workflow templates
('campaign_created', 'email', 'Default', 'New Campaign Created: {{campaignName}}', NULL, 
  '<p>A new campaign has been created and assigned to you.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Advertiser:</strong> {{advertiserName}}<br/><strong>Status:</strong> {{status}}</p><p><a href="{{actionUrl}}">View Campaign</a></p>',
  'A new campaign has been created: {{campaignName}} for {{advertiserName}}. View at: {{actionUrl}}',
  '["campaignName", "advertiserName", "status", "actionUrl"]'::jsonb, true),

('campaign_created', 'inApp', 'Default', NULL, 'New Campaign: {{campaignName}}',
  NULL, 'Campaign {{campaignName}} created for {{advertiserName}}',
  '["campaignName", "advertiserName", "actionUrl"]'::jsonb, true),

('schedule_built', 'email', 'Default', 'Schedule Built for Campaign: {{campaignName}}', NULL,
  '<p>The schedule has been built for your campaign.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Shows Scheduled:</strong> {{showCount}}<br/><strong>Total Spots:</strong> {{spotCount}}</p><p><a href="{{actionUrl}}">Review Schedule</a></p>',
  'Schedule built for {{campaignName}}. {{showCount}} shows, {{spotCount}} total spots. Review at: {{actionUrl}}',
  '["campaignName", "showCount", "spotCount", "actionUrl"]'::jsonb, true),

('talent_approval_requested', 'email', 'Default', 'Host Read Approval Needed: {{campaignName}}', NULL,
  '<p>Your approval is needed for a host read.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Show:</strong> {{showName}}<br/><strong>Advertiser:</strong> {{advertiserName}}</p><p><a href="{{actionUrl}}">Review and Approve</a></p>',
  'Host read approval needed for {{campaignName}} on {{showName}}. Review at: {{actionUrl}}',
  '["campaignName", "showName", "advertiserName", "actionUrl"]'::jsonb, true),

('admin_approval_requested', 'email', 'Default', 'Campaign Approval Required: {{campaignName}}', NULL,
  '<p>A campaign requires your approval to proceed.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Advertiser:</strong> {{advertiserName}}<br/><strong>Total Budget:</strong> {{budget}}<br/><strong>Rate Card Variance:</strong> {{variance}}</p><p><a href="{{actionUrl}}">Review Campaign</a></p>',
  'Campaign {{campaignName}} requires approval. Budget: {{budget}}, Variance: {{variance}}. Review at: {{actionUrl}}',
  '["campaignName", "advertiserName", "budget", "variance", "actionUrl"]'::jsonb, true),

('campaign_approved', 'email', 'Default', 'Campaign Approved: {{campaignName}}', NULL,
  '<p>Great news! Your campaign has been approved.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Approved By:</strong> {{approverName}}<br/><strong>Next Steps:</strong> {{nextSteps}}</p><p><a href="{{actionUrl}}">View Campaign</a></p>',
  'Campaign {{campaignName}} has been approved by {{approverName}}. {{nextSteps}}',
  '["campaignName", "approverName", "nextSteps", "actionUrl"]'::jsonb, true),

('campaign_rejected', 'email', 'Default', 'Campaign Rejected: {{campaignName}}', NULL,
  '<p>Your campaign requires revisions.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Rejected By:</strong> {{rejectorName}}<br/><strong>Reason:</strong> {{reason}}</p><p><a href="{{actionUrl}}">Revise Campaign</a></p>',
  'Campaign {{campaignName}} was rejected by {{rejectorName}}. Reason: {{reason}}. Revise at: {{actionUrl}}',
  '["campaignName", "rejectorName", "reason", "actionUrl"]'::jsonb, true),

-- Inventory templates
('inventory_conflict', 'email', 'Default', 'Inventory Conflict: {{campaignName}}', NULL,
  '<p>An inventory conflict has been detected.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Show:</strong> {{showName}}<br/><strong>Date:</strong> {{date}}<br/><strong>Conflict:</strong> {{conflictDetails}}</p><p><a href="{{actionUrl}}">Resolve Conflict</a></p>',
  'Inventory conflict for {{campaignName}} on {{showName}} for {{date}}. {{conflictDetails}}',
  '["campaignName", "showName", "date", "conflictDetails", "actionUrl"]'::jsonb, true),

-- Billing templates
('invoice_generated', 'email', 'Default', 'Invoice Ready: {{invoiceNumber}}', NULL,
  '<p>A new invoice has been generated.</p><p><strong>Invoice Number:</strong> {{invoiceNumber}}<br/><strong>Amount:</strong> {{amount}}<br/><strong>Due Date:</strong> {{dueDate}}</p><p><a href="{{actionUrl}}">View Invoice</a></p>',
  'Invoice {{invoiceNumber}} for {{amount}} is ready. Due: {{dueDate}}. View at: {{actionUrl}}',
  '["invoiceNumber", "amount", "dueDate", "actionUrl"]'::jsonb, true),

-- System templates
('youtube_quota_reached', 'email', 'Default', 'YouTube API Quota Reached', NULL,
  '<p>The YouTube API daily quota has been reached.</p><p><strong>Current Usage:</strong> {{usage}}<br/><strong>Daily Limit:</strong> {{limit}}<br/><strong>Reset Time:</strong> {{resetTime}}</p><p>Sync has been paused and will resume automatically after quota reset.</p>',
  'YouTube API quota reached: {{usage}}/{{limit}}. Will reset at {{resetTime}}.',
  '["usage", "limit", "resetTime"]'::jsonb, true),

('backup_completed', 'email', 'Default', 'Backup Completed Successfully', NULL,
  '<p>Your organization backup has completed successfully.</p><p><strong>Backup ID:</strong> {{backupId}}<br/><strong>Size:</strong> {{size}}<br/><strong>Duration:</strong> {{duration}}</p>',
  'Backup {{backupId}} completed. Size: {{size}}, Duration: {{duration}}.',
  '["backupId", "size", "duration"]'::jsonb, true)

ON CONFLICT (organizationId, eventType, channel, name) 
WHERE organizationId IS NULL 
DO NOTHING;

-- 11. Create trigger to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updatedAt
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notification_updated_at') THEN
    CREATE TRIGGER update_notification_updated_at
    BEFORE UPDATE ON "Notification"
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_notification_preference_updated_at') THEN
    CREATE TRIGGER update_user_notification_preference_updated_at
    BEFORE UPDATE ON "UserNotificationPreference"
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notification_delivery_updated_at') THEN
    CREATE TRIGGER update_notification_delivery_updated_at
    BEFORE UPDATE ON "NotificationDelivery"
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notification_template_updated_at') THEN
    CREATE TRIGGER update_notification_template_updated_at
    BEFORE UPDATE ON "NotificationTemplate"
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();
  END IF;
END $$;

-- 12. Add default notification settings to existing organizations
UPDATE "Organization"
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{notifications}',
  '{
    "enabled": true,
    "channels": {
      "email": {"enabled": true},
      "inApp": {"enabled": true},
      "slack": {"enabled": false, "webhookUrl": null},
      "webhook": {"enabled": false, "url": null, "secret": null}
    },
    "quietHours": null,
    "events": {
      "campaign_created": {"enabled": true, "channels": ["email", "inApp"], "mandatory": false, "severity": "normal"},
      "schedule_built": {"enabled": true, "channels": ["email", "inApp"], "mandatory": false, "severity": "normal"},
      "talent_approval_requested": {"enabled": true, "channels": ["email", "inApp"], "mandatory": true, "severity": "high"},
      "admin_approval_requested": {"enabled": true, "channels": ["email", "inApp"], "mandatory": true, "severity": "high"},
      "campaign_approved": {"enabled": true, "channels": ["email", "inApp"], "mandatory": false, "severity": "normal"},
      "campaign_rejected": {"enabled": true, "channels": ["email", "inApp"], "mandatory": false, "severity": "high"},
      "inventory_conflict": {"enabled": true, "channels": ["email", "inApp"], "mandatory": false, "severity": "high"},
      "invoice_generated": {"enabled": true, "channels": ["email"], "mandatory": false, "severity": "normal"},
      "payment_received": {"enabled": true, "channels": ["email"], "mandatory": false, "severity": "normal"},
      "youtube_quota_reached": {"enabled": true, "channels": ["email"], "mandatory": true, "severity": "high"},
      "backup_completed": {"enabled": true, "channels": ["email"], "mandatory": false, "severity": "low"}
    }
  }'::jsonb,
  true
)
WHERE NOT (settings ? 'notifications');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON "UserNotificationPreference" TO podcastflow;
GRANT SELECT, INSERT, UPDATE, DELETE ON "NotificationDelivery" TO podcastflow;
GRANT SELECT, INSERT, UPDATE, DELETE ON "NotificationTemplate" TO podcastflow;
GRANT SELECT, INSERT, UPDATE, DELETE ON "NotificationQueue" TO podcastflow;
GRANT SELECT, INSERT, UPDATE, DELETE ON "NotificationAuditLog" TO podcastflow;
GRANT UPDATE ON "Notification" TO podcastflow;
GRANT UPDATE ON "Organization" TO podcastflow;