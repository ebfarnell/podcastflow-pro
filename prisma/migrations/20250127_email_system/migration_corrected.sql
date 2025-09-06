-- Email System Database Migration (Corrected for text IDs)
-- Phase 1: Database Foundation with Empty State Support

-- 1. Platform Email Settings (Master level)
CREATE TABLE IF NOT EXISTS "PlatformEmailSettings" (
  "id" TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "provider" VARCHAR(10) DEFAULT NULL, -- 'ses' or 'smtp', NULL = not configured
  "sesConfig" JSONB DEFAULT '{"configured": false, "region": null, "useIAMRole": true}'::jsonb,
  "smtpConfig" JSONB DEFAULT '{"configured": false, "host": null, "port": null, "secure": false}'::jsonb,
  "quotaLimits" JSONB DEFAULT '{"dailyQuota": 0, "sendRate": 0, "maxRecipients": 50}'::jsonb,
  "monitoring" JSONB DEFAULT '{"trackOpens": false, "trackClicks": false, "trackBounces": true, "trackComplaints": true}'::jsonb,
  "suppressionList" JSONB DEFAULT '{"enabled": false, "autoAddBounces": true, "autoAddComplaints": true}'::jsonb,
  "isConfigured" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT REFERENCES "User"("id") ON DELETE SET NULL
);

-- Ensure only one row exists
CREATE UNIQUE INDEX "PlatformEmailSettings_single_row" ON "PlatformEmailSettings"((true));

-- Auto-create the single settings row
INSERT INTO "PlatformEmailSettings" ("id") 
SELECT gen_random_uuid()::text 
WHERE NOT EXISTS (SELECT 1 FROM "PlatformEmailSettings");

-- 2. Email Suppression List (Global)
CREATE TABLE IF NOT EXISTS "EmailSuppressionList" (
  "id" TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "email" VARCHAR(255) NOT NULL,
  "reason" VARCHAR(50) NOT NULL CHECK ("reason" IN ('bounce', 'complaint', 'manual', 'unsubscribe')),
  "source" VARCHAR(100), -- e.g., 'ses_webhook', 'manual_admin', 'user_unsubscribe'
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "addedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "addedBy" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  UNIQUE("email")
);

CREATE INDEX "EmailSuppressionList_email_idx" ON "EmailSuppressionList"("email");
CREATE INDEX "EmailSuppressionList_reason_idx" ON "EmailSuppressionList"("reason");

-- 3. Email Logs (Track all email activity)
CREATE TABLE IF NOT EXISTS "EmailLog" (
  "id" TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "recipient" VARCHAR(255) NOT NULL,
  "subject" VARCHAR(500),
  "templateKey" VARCHAR(50),
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK ("status" IN ('pending', 'queued', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'complained')),
  "providerMessageId" VARCHAR(255),
  "errorMessage" TEXT,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "clickedAt" TIMESTAMP(3),
  "bouncedAt" TIMESTAMP(3),
  "complainedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "EmailLog_organizationId_idx" ON "EmailLog"("organizationId");
CREATE INDEX "EmailLog_userId_idx" ON "EmailLog"("userId");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
CREATE INDEX "EmailLog_templateKey_idx" ON "EmailLog"("templateKey");

-- 4. System Email Templates (Global defaults)
CREATE TABLE IF NOT EXISTS "SystemEmailTemplate" (
  "id" TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "key" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "subject" VARCHAR(500) NOT NULL,
  "htmlContent" TEXT NOT NULL,
  "textContent" TEXT NOT NULL,
  "variables" JSONB DEFAULT '[]'::jsonb, -- Array of required variables
  "category" VARCHAR(50) NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SystemEmailTemplate_key_idx" ON "SystemEmailTemplate"("key");
CREATE INDEX "SystemEmailTemplate_category_idx" ON "SystemEmailTemplate"("category");

-- 5. Email Queue (For async processing)
CREATE TABLE IF NOT EXISTS "EmailQueue" (
  "id" TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "recipient" VARCHAR(255) NOT NULL,
  "templateKey" VARCHAR(50) NOT NULL,
  "templateData" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "priority" INTEGER DEFAULT 5 CHECK ("priority" >= 1 AND "priority" <= 10),
  "scheduledFor" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "status" VARCHAR(20) DEFAULT 'pending' 
    CHECK ("status" IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  "emailLogId" TEXT REFERENCES "EmailLog"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "EmailQueue_status_scheduledFor_idx" ON "EmailQueue"("status", "scheduledFor");
CREATE INDEX "EmailQueue_organizationId_idx" ON "EmailQueue"("organizationId");

-- 6. Update Organization table for email settings
ALTER TABLE "Organization" 
ADD COLUMN IF NOT EXISTS "emailSettings" JSONB DEFAULT '{
  "configured": false,
  "replyToAddress": null,
  "supportEmail": null,
  "emailFooter": null,
  "notifications": {
    "userInvitations": true,
    "taskAssignments": true,
    "campaignUpdates": true,
    "paymentReminders": true,
    "reportReady": true,
    "deadlineReminders": true,
    "approvalRequests": true,
    "adCopyUpdates": true
  },
  "sendingRules": {
    "dailyLimitPerUser": 100,
    "allowedDomains": [],
    "requireApproval": false,
    "ccOnCertainEmails": false,
    "ccAddress": null
  }
}'::jsonb;

ALTER TABLE "Organization" 
ADD COLUMN IF NOT EXISTS "emailBranding" JSONB DEFAULT '{
  "enabled": false,
  "logoUrl": null,
  "primaryColor": "#2196F3",
  "secondaryColor": "#4CAF50",
  "customCSS": null
}'::jsonb;

-- 7. Update User table for email preferences
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "emailPreferences" JSONB DEFAULT '{
  "configured": false,
  "enabled": true,
  "frequency": "immediate",
  "format": "html",
  "categories": {
    "taskAssignments": false,
    "taskComments": false,
    "taskDeadlines": false,
    "campaignStatusChanges": false,
    "campaignComments": false,
    "mentions": false,
    "approvalRequests": false,
    "approvalDecisions": false,
    "reportCompletion": false,
    "systemAnnouncements": false
  },
  "digestSettings": {
    "dailyDigestTime": "09:00",
    "weeklyDigestDay": 1,
    "includeTaskSummary": true,
    "includeCampaignSummary": true,
    "includeUpcomingDeadlines": true
  }
}'::jsonb;

ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "unsubscribeTokens" JSONB DEFAULT '{}'::jsonb;

-- 8. Email Analytics Summary (Materialized view for performance)
CREATE TABLE IF NOT EXISTS "EmailAnalyticsSummary" (
  "id" TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL,
  "sent" INTEGER DEFAULT 0,
  "delivered" INTEGER DEFAULT 0,
  "opened" INTEGER DEFAULT 0,
  "clicked" INTEGER DEFAULT 0,
  "bounced" INTEGER DEFAULT 0,
  "complained" INTEGER DEFAULT 0,
  "failed" INTEGER DEFAULT 0,
  "uniqueRecipients" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("organizationId", "date")
);

CREATE INDEX "EmailAnalyticsSummary_organizationId_date_idx" ON "EmailAnalyticsSummary"("organizationId", "date");

-- 9. Insert default system email templates
INSERT INTO "SystemEmailTemplate" ("id", "key", "name", "description", "subject", "htmlContent", "textContent", "variables", "category") VALUES
-- User Management
(gen_random_uuid()::text, 'user_invitation', 'User Invitation', 'Sent when a new user is invited to join an organization', 
 'You''ve been invited to join {{organizationName}} on PodcastFlow Pro',
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
   <h2>Welcome to {{organizationName}}!</h2>
   <p>Hi {{userName}},</p>
   <p>You''ve been invited to join {{organizationName}} on PodcastFlow Pro as a {{userRole}}.</p>
   <p>Click the button below to accept your invitation and set up your account:</p>
   <div style="text-align: center; margin: 30px 0;">
     <a href="{{inviteLink}}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
   </div>
   <p>This invitation will expire in 7 days.</p>
   <p>If you have any questions, please contact us at {{supportEmail}}.</p>
 </div>',
 'Welcome to {{organizationName}}!

Hi {{userName}},

You''ve been invited to join {{organizationName}} on PodcastFlow Pro as a {{userRole}}.

Accept your invitation here: {{inviteLink}}

This invitation will expire in 7 days.

If you have any questions, please contact us at {{supportEmail}}.',
 '["organizationName", "userName", "userRole", "inviteLink", "supportEmail"]'::jsonb,
 'user_management'),

-- Password Reset
(gen_random_uuid()::text, 'password_reset', 'Password Reset', 'Sent when a user requests a password reset',
 'Reset your PodcastFlow Pro password',
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
   <h2>Password Reset Request</h2>
   <p>Hi {{userName}},</p>
   <p>We received a request to reset your password for PodcastFlow Pro.</p>
   <p>Click the button below to reset your password:</p>
   <div style="text-align: center; margin: 30px 0;">
     <a href="{{resetLink}}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
   </div>
   <p>This link will expire in 1 hour.</p>
   <p>If you didn''t request this, please ignore this email.</p>
 </div>',
 'Password Reset Request

Hi {{userName}},

We received a request to reset your password for PodcastFlow Pro.

Reset your password here: {{resetLink}}

This link will expire in 1 hour.

If you didn''t request this, please ignore this email.',
 '["userName", "resetLink"]'::jsonb,
 'authentication'),

-- Task Assignment
(gen_random_uuid()::text, 'task_assignment', 'Task Assignment', 'Sent when a task is assigned to a user',
 'New task assigned: {{taskTitle}}',
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
   <h2>New Task Assigned</h2>
   <p>Hi {{assigneeName}},</p>
   <p>{{assignerName}} has assigned you a new task:</p>
   <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
     <h3 style="margin-top: 0;">{{taskTitle}}</h3>
     <p>{{taskDescription}}</p>
     <p><strong>Due Date:</strong> {{dueDate}}</p>
     <p><strong>Priority:</strong> {{priority}}</p>
   </div>
   <div style="text-align: center; margin: 30px 0;">
     <a href="{{taskLink}}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Task</a>
   </div>
 </div>',
 'New Task Assigned

Hi {{assigneeName}},

{{assignerName}} has assigned you a new task:

Task: {{taskTitle}}
Description: {{taskDescription}}
Due Date: {{dueDate}}
Priority: {{priority}}

View task: {{taskLink}}',
 '["assigneeName", "assignerName", "taskTitle", "taskDescription", "dueDate", "priority", "taskLink"]'::jsonb,
 'tasks'),

-- Campaign Update
(gen_random_uuid()::text, 'campaign_status_change', 'Campaign Status Change', 'Sent when a campaign status changes',
 'Campaign {{campaignName}} is now {{newStatus}}',
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
   <h2>Campaign Status Update</h2>
   <p>Hi {{userName}},</p>
   <p>The status of campaign <strong>{{campaignName}}</strong> has changed:</p>
   <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
     <p><strong>Previous Status:</strong> {{previousStatus}}</p>
     <p><strong>New Status:</strong> {{newStatus}}</p>
     <p><strong>Changed By:</strong> {{changedBy}}</p>
     <p><strong>Date:</strong> {{changeDate}}</p>
   </div>
   <div style="text-align: center; margin: 30px 0;">
     <a href="{{campaignLink}}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Campaign</a>
   </div>
 </div>',
 'Campaign Status Update

Hi {{userName}},

The status of campaign "{{campaignName}}" has changed:

Previous Status: {{previousStatus}}
New Status: {{newStatus}}
Changed By: {{changedBy}}
Date: {{changeDate}}

View campaign: {{campaignLink}}',
 '["userName", "campaignName", "previousStatus", "newStatus", "changedBy", "changeDate", "campaignLink"]'::jsonb,
 'campaigns'),

-- Approval Request
(gen_random_uuid()::text, 'approval_request', 'Approval Request', 'Sent when approval is needed',
 'Approval needed: {{itemTitle}}',
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
   <h2>Approval Request</h2>
   <p>Hi {{approverName}},</p>
   <p>{{requesterName}} has requested your approval for:</p>
   <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
     <h3 style="margin-top: 0;">{{itemTitle}}</h3>
     <p>{{itemDescription}}</p>
     <p><strong>Type:</strong> {{itemType}}</p>
     <p><strong>Requested:</strong> {{requestDate}}</p>
   </div>
   <div style="text-align: center; margin: 30px 0;">
     <a href="{{approvalLink}}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 0 10px;">Approve</a>
     <a href="{{approvalLink}}" style="background-color: #f44336; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 0 10px;">Reject</a>
   </div>
 </div>',
 'Approval Request

Hi {{approverName}},

{{requesterName}} has requested your approval for:

{{itemTitle}}
{{itemDescription}}

Type: {{itemType}}
Requested: {{requestDate}}

Review request: {{approvalLink}}',
 '["approverName", "requesterName", "itemTitle", "itemDescription", "itemType", "requestDate", "approvalLink"]'::jsonb,
 'approvals');

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_platform_email_settings_updated_at 
BEFORE UPDATE ON "PlatformEmailSettings" 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_email_template_updated_at 
BEFORE UPDATE ON "SystemEmailTemplate" 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_analytics_summary_updated_at 
BEFORE UPDATE ON "EmailAnalyticsSummary" 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();