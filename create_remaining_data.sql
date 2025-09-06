-- Create KPI History entries
INSERT INTO "KPIHistory" (id, "campaignKPIId", "changeType", "changedFields", "oldValues", "newValues", "updatedBy", "updateSource", "createdAt")
VALUES
  ('hist1', 'kpi1', 'update', '["actualVisits", "actualConversions"]'::jsonb, '{"actualVisits": 10000, "actualConversions": 100}'::jsonb, '{"actualVisits": 22500, "actualConversions": 225}'::jsonb, 'cmd2qff240004og5y1f5msy5g', 'admin', NOW() - INTERVAL '7 days'),
  ('hist2', 'kpi1', 'update', '["actualVisits", "actualConversions"]'::jsonb, '{"actualVisits": 22500, "actualConversions": 225}'::jsonb, '{"actualVisits": 22500, "actualConversions": 225}'::jsonb, NULL, 'client', NOW() - INTERVAL '3 days'),
  ('hist3', 'kpi2', 'create', '["all"]'::jsonb, '{}'::jsonb, '{"kpiType": "conversions", "goalCPA": 30, "targetConversions": 300}'::jsonb, 'cmd2qff550006og5y4ri8ztev', 'admin', NOW() - INTERVAL '14 days');

-- Create Contracts for orders (fixed schema)
INSERT INTO "Contract" (id, "contractNumber", "organizationId", "advertiserId", "agencyId", "campaignId", "orderId", title, "totalAmount", "netAmount", "startDate", "endDate", status, "specialTerms", "createdAt", "updatedAt", "createdById")
VALUES
  ('contract1', 'IO-2025-001', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'camp1', 'order1', 'Q1 2025 TechCorp Campaign', 10000, 9000, '2025-01-01', '2025-03-31', 'draft', 'Standard terms and conditions apply. Cancellation requires 14 days notice.', NOW(), NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('contract2', 'IO-2024-101', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'camp4', 'order4', 'Holiday 2024 Campaign', 25000, 22500, '2024-11-01', '2024-12-31', 'completed', 'Holiday campaign terms. Premium rates apply.', '2024-10-20', NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('contract3', 'IO-2024-102', 'cmd2qfeve0000og5y8hfwu795', 'adv2', 'agency2', 'camp5', 'order5', 'Back to School 2024', 18000, 16200, '2024-08-01', '2024-09-30', 'completed', 'Back to school campaign. Health & wellness focus.', '2024-07-20', NOW(), 'cmd2qff550006og5y4ri8ztev');

-- Update contracts with signature dates
UPDATE "Contract" SET "signedAt" = '2024-10-25', "isExecuted" = true, "executedAt" = '2024-10-25' WHERE id = 'contract2';
UPDATE "Contract" SET "signedAt" = '2024-07-25', "isExecuted" = true, "executedAt" = '2024-07-25' WHERE id = 'contract3';

-- Create ad approvals (fixed schema)
INSERT INTO "AdApproval" (id, title, "advertiserId", "advertiserName", "campaignId", "showId", "showName", "organizationId", "script", type, duration, status, "submittedBy", "createdAt", "updatedAt")
VALUES
  ('approval1', 'TechCorp Q1 Tech Talk Pre-Roll', 'adv1', 'TechCorp Inc', 'camp1', 'show1', 'Tech Talk Weekly', 'cmd2qfeve0000og5y8hfwu795', 'Looking for cutting-edge tech solutions? TechCorp has you covered with innovative products designed for modern businesses. Visit techcorp.com today!', 'voiced', 30, 'approved', 'cmd2qff550006og5y4ri8ztev', NOW() - INTERVAL '2 days', NOW()),
  ('approval2', 'HealthPlus Wellness Hour Mid-Roll', 'adv2', 'HealthPlus Ltd', 'camp2', 'show3', 'Health & Wellness Hour', 'cmd2qfeve0000og5y8hfwu795', 'Transform your wellness journey with HealthPlus - your partner in achieving optimal health. Our comprehensive wellness programs are designed to fit your lifestyle.', 'endorsed', 60, 'pending_talent', 'cmd2qff550006og5y4ri8ztev', NOW() - INTERVAL '1 day', NOW()),
  ('approval3', 'TechCorp Holiday Special', 'adv1', 'TechCorp Inc', 'camp1', 'show1', 'Tech Talk Weekly', 'cmd2qfeve0000og5y8hfwu795', 'This holiday season, give the gift of technology. TechCorp''s latest innovations make perfect presents for the tech enthusiast in your life.', 'host_read', 60, 'pending', 'cmd2qff550006og5y4ri8ztev', NOW(), NOW());

-- Update ad approval with approval date
UPDATE "AdApproval" SET 
  "approvedAt" = NOW() - INTERVAL '1 day',
  "workflowStage" = 'ready_for_recording'
WHERE id = 'approval1';

-- Display summary
SELECT 'KPI History entries:' as summary, COUNT(*) as count FROM "KPIHistory" WHERE id IN ('hist1', 'hist2', 'hist3')
UNION ALL
SELECT 'Contracts created:', COUNT(*) FROM "Contract" WHERE id IN ('contract1', 'contract2', 'contract3')
UNION ALL
SELECT 'Ad approvals created:', COUNT(*) FROM "AdApproval" WHERE id IN ('approval1', 'approval2', 'approval3');