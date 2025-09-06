-- Additional migration steps for email system
-- Run this after the main migration

-- Check if columns already exist before adding them
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'Organization' 
                 AND column_name = 'emailSettings') THEN
    -- Since we don't own the table, we'll handle this separately
    RAISE NOTICE 'Organization.emailSettings column needs to be added by table owner';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'User' 
                 AND column_name = 'emailPreferences') THEN
    -- Since we don't own the table, we'll handle this separately
    RAISE NOTICE 'User.emailPreferences column needs to be added by table owner';
  END IF;
END $$;

-- Insert default system email templates (checking if they already exist)
INSERT INTO "SystemEmailTemplate" ("key", "name", "description", "subject", "htmlContent", "textContent", "variables", "category") 
SELECT * FROM (VALUES
-- User Management
('user_invitation', 'User Invitation', 'Sent when a new user is invited to join an organization', 
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
('password_reset', 'Password Reset', 'Sent when a user requests a password reset',
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
('task_assignment', 'Task Assignment', 'Sent when a task is assigned to a user',
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
('campaign_status_change', 'Campaign Status Change', 'Sent when a campaign status changes',
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
('approval_request', 'Approval Request', 'Sent when approval is needed',
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
 'approvals')
) AS v(key, name, description, subject, htmlContent, textContent, variables, category)
WHERE NOT EXISTS (
  SELECT 1 FROM "SystemEmailTemplate" WHERE "key" = v.key
);

-- Verify tables were created
DO $$ 
BEGIN
  RAISE NOTICE 'Email system tables created:';
  RAISE NOTICE '- PlatformEmailSettings: %', EXISTS(SELECT FROM pg_tables WHERE tablename = 'PlatformEmailSettings');
  RAISE NOTICE '- EmailSuppressionList: %', EXISTS(SELECT FROM pg_tables WHERE tablename = 'EmailSuppressionList');
  RAISE NOTICE '- EmailLog: %', EXISTS(SELECT FROM pg_tables WHERE tablename = 'EmailLog');
  RAISE NOTICE '- SystemEmailTemplate: %', EXISTS(SELECT FROM pg_tables WHERE tablename = 'SystemEmailTemplate');
  RAISE NOTICE '- EmailQueue: %', EXISTS(SELECT FROM pg_tables WHERE tablename = 'EmailQueue');
  RAISE NOTICE '- EmailAnalyticsSummary: %', EXISTS(SELECT FROM pg_tables WHERE tablename = 'EmailAnalyticsSummary');
END $$;