-- Fix notification templates insertion
-- Using proper upsert without conflict clause since organizationId can be NULL for defaults

-- Delete any existing default templates first
DELETE FROM "NotificationTemplate" WHERE "organizationId" IS NULL AND "isDefault" = true;

-- Insert default notification templates
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

('schedule_built', 'inApp', 'Default', NULL, 'Schedule Built: {{campaignName}}',
  NULL, 'Schedule ready for {{campaignName}} - {{spotCount}} spots across {{showCount}} shows',
  '["campaignName", "showCount", "spotCount", "actionUrl"]'::jsonb, true),

('talent_approval_requested', 'email', 'Default', 'Host Read Approval Needed: {{campaignName}}', NULL,
  '<p>Your approval is needed for a host read.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Show:</strong> {{showName}}<br/><strong>Advertiser:</strong> {{advertiserName}}</p><p><a href="{{actionUrl}}">Review and Approve</a></p>',
  'Host read approval needed for {{campaignName}} on {{showName}}. Review at: {{actionUrl}}',
  '["campaignName", "showName", "advertiserName", "actionUrl"]'::jsonb, true),

('talent_approval_requested', 'inApp', 'Default', NULL, 'Host Read Approval Required',
  NULL, 'Please approve host read for {{campaignName}} on {{showName}}',
  '["campaignName", "showName", "actionUrl"]'::jsonb, true),

('admin_approval_requested', 'email', 'Default', 'Campaign Approval Required: {{campaignName}}', NULL,
  '<p>A campaign requires your approval to proceed.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Advertiser:</strong> {{advertiserName}}<br/><strong>Total Budget:</strong> ${{budget}}<br/><strong>Rate Card Variance:</strong> {{variance}}%</p><p><a href="{{actionUrl}}">Review Campaign</a></p>',
  'Campaign {{campaignName}} requires approval. Budget: ${{budget}}, Variance: {{variance}}%. Review at: {{actionUrl}}',
  '["campaignName", "advertiserName", "budget", "variance", "actionUrl"]'::jsonb, true),

('admin_approval_requested', 'inApp', 'Default', NULL, 'Campaign Needs Approval',
  NULL, '{{campaignName}} (${{budget}}) requires admin approval - {{variance}}% variance',
  '["campaignName", "budget", "variance", "actionUrl"]'::jsonb, true),

('campaign_approved', 'email', 'Default', 'Campaign Approved: {{campaignName}}', NULL,
  '<p>Great news! Your campaign has been approved.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Approved By:</strong> {{approverName}}<br/><strong>Next Steps:</strong> {{nextSteps}}</p><p><a href="{{actionUrl}}">View Campaign</a></p>',
  'Campaign {{campaignName}} has been approved by {{approverName}}. {{nextSteps}}',
  '["campaignName", "approverName", "nextSteps", "actionUrl"]'::jsonb, true),

('campaign_approved', 'inApp', 'Default', NULL, 'Campaign Approved ✓',
  NULL, '{{campaignName}} approved by {{approverName}}',
  '["campaignName", "approverName", "actionUrl"]'::jsonb, true),

('campaign_rejected', 'email', 'Default', 'Campaign Rejected: {{campaignName}}', NULL,
  '<p>Your campaign requires revisions.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Rejected By:</strong> {{rejectorName}}<br/><strong>Reason:</strong> {{reason}}</p><p><a href="{{actionUrl}}">Revise Campaign</a></p>',
  'Campaign {{campaignName}} was rejected by {{rejectorName}}. Reason: {{reason}}. Revise at: {{actionUrl}}',
  '["campaignName", "rejectorName", "reason", "actionUrl"]'::jsonb, true),

('campaign_rejected', 'inApp', 'Default', NULL, 'Campaign Needs Revision',
  NULL, '{{campaignName}} rejected: {{reason}}',
  '["campaignName", "reason", "actionUrl"]'::jsonb, true),

-- Inventory templates
('inventory_conflict', 'email', 'Default', 'Inventory Conflict: {{campaignName}}', NULL,
  '<p>An inventory conflict has been detected.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Show:</strong> {{showName}}<br/><strong>Date:</strong> {{date}}<br/><strong>Conflict:</strong> {{conflictDetails}}</p><p><a href="{{actionUrl}}">Resolve Conflict</a></p>',
  'Inventory conflict for {{campaignName}} on {{showName}} for {{date}}. {{conflictDetails}}',
  '["campaignName", "showName", "date", "conflictDetails", "actionUrl"]'::jsonb, true),

('inventory_conflict', 'inApp', 'Default', NULL, 'Inventory Conflict Detected',
  NULL, 'Conflict on {{showName}} for {{date}}: {{conflictDetails}}',
  '["showName", "date", "conflictDetails", "actionUrl"]'::jsonb, true),

('inventory_released', 'email', 'Default', 'Inventory Released: {{campaignName}}', NULL,
  '<p>Inventory has been released for your campaign.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Reason:</strong> {{reason}}<br/><strong>Released Spots:</strong> {{spotCount}}</p>',
  'Inventory released for {{campaignName}}. Reason: {{reason}}. {{spotCount}} spots released.',
  '["campaignName", "reason", "spotCount"]'::jsonb, true),

('inventory_released', 'inApp', 'Default', NULL, 'Inventory Released',
  NULL, '{{spotCount}} spots released from {{campaignName}}: {{reason}}',
  '["campaignName", "reason", "spotCount"]'::jsonb, true),

('bulk_placement_failed', 'email', 'Default', 'Bulk Placement Failed: {{campaignName}}', NULL,
  '<p>Unable to place all requested spots for your campaign.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Requested:</strong> {{requested}}<br/><strong>Placed:</strong> {{placed}}<br/><strong>Issue:</strong> {{issue}}</p><p><a href="{{actionUrl}}">Adjust Schedule</a></p>',
  'Bulk placement failed for {{campaignName}}. Only {{placed}}/{{requested}} spots placed. {{issue}}',
  '["campaignName", "requested", "placed", "issue", "actionUrl"]'::jsonb, true),

('bulk_placement_failed', 'inApp', 'Default', NULL, 'Bulk Placement Issue',
  NULL, 'Only {{placed}}/{{requested}} spots placed: {{issue}}',
  '["requested", "placed", "issue", "actionUrl"]'::jsonb, true),

-- Billing templates
('order_created', 'email', 'Default', 'Order Created: {{orderNumber}}', NULL,
  '<p>A new order has been created from your approved campaign.</p><p><strong>Order Number:</strong> {{orderNumber}}<br/><strong>Campaign:</strong> {{campaignName}}<br/><strong>Total Value:</strong> ${{totalValue}}</p><p><a href="{{actionUrl}}">View Order</a></p>',
  'Order {{orderNumber}} created for {{campaignName}}. Value: ${{totalValue}}',
  '["orderNumber", "campaignName", "totalValue", "actionUrl"]'::jsonb, true),

('order_created', 'inApp', 'Default', NULL, 'Order Created',
  NULL, 'Order {{orderNumber}} created (${{totalValue}})',
  '["orderNumber", "totalValue", "actionUrl"]'::jsonb, true),

('contract_generated', 'email', 'Default', 'Contract Ready for Signature: {{contractId}}', NULL,
  '<p>A contract has been generated and is ready for signature.</p><p><strong>Contract ID:</strong> {{contractId}}<br/><strong>Campaign:</strong> {{campaignName}}<br/><strong>Action Required:</strong> E-signature</p><p><a href="{{actionUrl}}">Sign Contract</a></p>',
  'Contract {{contractId}} ready for signature. Campaign: {{campaignName}}',
  '["contractId", "campaignName", "actionUrl"]'::jsonb, true),

('contract_signed', 'email', 'Default', 'Contract Signed: {{contractId}}', NULL,
  '<p>Contract has been successfully signed.</p><p><strong>Contract ID:</strong> {{contractId}}<br/><strong>Signed By:</strong> {{signerName}}<br/><strong>Date:</strong> {{signedDate}}</p>',
  'Contract {{contractId}} signed by {{signerName}} on {{signedDate}}',
  '["contractId", "signerName", "signedDate"]'::jsonb, true),

('invoice_generated', 'email', 'Default', 'Invoice Ready: {{invoiceNumber}}', NULL,
  '<p>A new invoice has been generated.</p><p><strong>Invoice Number:</strong> {{invoiceNumber}}<br/><strong>Amount:</strong> ${{amount}}<br/><strong>Due Date:</strong> {{dueDate}}</p><p><a href="{{actionUrl}}">View Invoice</a></p>',
  'Invoice {{invoiceNumber}} for ${{amount}} is ready. Due: {{dueDate}}. View at: {{actionUrl}}',
  '["invoiceNumber", "amount", "dueDate", "actionUrl"]'::jsonb, true),

('invoice_generated', 'inApp', 'Default', NULL, 'Invoice Generated',
  NULL, 'Invoice {{invoiceNumber}} (${{amount}}) - Due {{dueDate}}',
  '["invoiceNumber", "amount", "dueDate", "actionUrl"]'::jsonb, true),

('payment_received', 'email', 'Default', 'Payment Received: {{invoiceNumber}}', NULL,
  '<p>Payment has been received for your invoice.</p><p><strong>Invoice Number:</strong> {{invoiceNumber}}<br/><strong>Amount Paid:</strong> ${{amount}}<br/><strong>Payment Date:</strong> {{paymentDate}}</p>',
  'Payment of ${{amount}} received for invoice {{invoiceNumber}} on {{paymentDate}}',
  '["invoiceNumber", "amount", "paymentDate"]'::jsonb, true),

('invoice_overdue', 'email', 'Default', 'Invoice Overdue: {{invoiceNumber}}', NULL,
  '<p>An invoice is now overdue.</p><p><strong>Invoice Number:</strong> {{invoiceNumber}}<br/><strong>Amount Due:</strong> ${{amount}}<br/><strong>Days Overdue:</strong> {{daysOverdue}}</p><p><a href="{{actionUrl}}">View Invoice</a></p>',
  'Invoice {{invoiceNumber}} is {{daysOverdue}} days overdue. Amount due: ${{amount}}',
  '["invoiceNumber", "amount", "daysOverdue", "actionUrl"]'::jsonb, true),

-- Content/Show Operations templates
('ad_request_created', 'email', 'Default', 'New Ad Request: {{campaignName}}', NULL,
  '<p>You have a new ad request to fulfill.</p><p><strong>Campaign:</strong> {{campaignName}}<br/><strong>Show:</strong> {{showName}}<br/><strong>Spot Type:</strong> {{spotType}}<br/><strong>Due Date:</strong> {{dueDate}}</p><p><a href="{{actionUrl}}">View Ad Request</a></p>',
  'New ad request for {{campaignName}} on {{showName}}. {{spotType}} due {{dueDate}}',
  '["campaignName", "showName", "spotType", "dueDate", "actionUrl"]'::jsonb, true),

('ad_request_created', 'inApp', 'Default', NULL, 'New Ad Request',
  NULL, '{{spotType}} needed for {{showName}} by {{dueDate}}',
  '["showName", "spotType", "dueDate", "actionUrl"]'::jsonb, true),

('category_conflict', 'email', 'Default', 'Category Exclusivity Conflict', NULL,
  '<p>A category exclusivity conflict has been detected.</p><p><strong>Show:</strong> {{showName}}<br/><strong>Date:</strong> {{date}}<br/><strong>Conflicting Advertisers:</strong> {{advertisers}}<br/><strong>Category:</strong> {{category}}</p><p><a href="{{actionUrl}}">Resolve Conflict</a></p>',
  'Category conflict on {{showName}} for {{date}}. {{advertisers}} in {{category}}',
  '["showName", "date", "advertisers", "category", "actionUrl"]'::jsonb, true),

-- Integration templates
('youtube_quota_reached', 'email', 'Default', 'YouTube API Quota Reached', NULL,
  '<p>The YouTube API daily quota has been reached.</p><p><strong>Current Usage:</strong> {{usage}}<br/><strong>Daily Limit:</strong> {{limit}}<br/><strong>Reset Time:</strong> {{resetTime}}</p><p>Sync has been paused and will resume automatically after quota reset.</p>',
  'YouTube API quota reached: {{usage}}/{{limit}}. Will reset at {{resetTime}}.',
  '["usage", "limit", "resetTime"]'::jsonb, true),

('youtube_quota_reached', 'inApp', 'Default', NULL, 'YouTube Quota Reached',
  NULL, 'API quota {{usage}}/{{limit}} - resets at {{resetTime}}',
  '["usage", "limit", "resetTime"]'::jsonb, true),

('integration_sync_failed', 'email', 'Default', 'Integration Sync Failed: {{integration}}', NULL,
  '<p>An integration sync has failed and requires attention.</p><p><strong>Integration:</strong> {{integration}}<br/><strong>Error:</strong> {{error}}<br/><strong>Last Success:</strong> {{lastSuccess}}</p><p><a href="{{actionUrl}}">View Details</a></p>',
  'Sync failed for {{integration}}: {{error}}. Last success: {{lastSuccess}}',
  '["integration", "error", "lastSuccess", "actionUrl"]'::jsonb, true),

-- Security templates
('security_policy_changed', 'email', 'Default', 'Security Policy Updated', NULL,
  '<p>A security policy has been changed in your organization.</p><p><strong>Changed By:</strong> {{changedBy}}<br/><strong>Policy:</strong> {{policy}}<br/><strong>Change:</strong> {{change}}</p>',
  'Security policy {{policy}} changed by {{changedBy}}: {{change}}',
  '["changedBy", "policy", "change"]'::jsonb, true),

('api_key_rotated', 'email', 'Default', 'API Key Rotated', NULL,
  '<p>An API key has been rotated for security.</p><p><strong>Key Name:</strong> {{keyName}}<br/><strong>Rotated By:</strong> {{rotatedBy}}<br/><strong>Action Required:</strong> Update any integrations using this key</p>',
  'API key {{keyName}} rotated by {{rotatedBy}}. Update integrations accordingly.',
  '["keyName", "rotatedBy"]'::jsonb, true),

-- Backup templates
('backup_completed', 'email', 'Default', 'Backup Completed Successfully', NULL,
  '<p>Your organization backup has completed successfully.</p><p><strong>Backup ID:</strong> {{backupId}}<br/><strong>Size:</strong> {{size}}<br/><strong>Duration:</strong> {{duration}}</p>',
  'Backup {{backupId}} completed. Size: {{size}}, Duration: {{duration}}.',
  '["backupId", "size", "duration"]'::jsonb, true),

('backup_failed', 'email', 'Default', 'Backup Failed', NULL,
  '<p>Your organization backup has failed.</p><p><strong>Error:</strong> {{error}}<br/><strong>Time:</strong> {{time}}</p><p>Please contact support if this persists.</p>',
  'Backup failed at {{time}}: {{error}}',
  '["error", "time"]'::jsonb, true);