-- Create Orders from existing campaigns

-- Active campaigns to orders
INSERT INTO "Order" (id, "orderNumber", "campaignId", "organizationId", "advertiserId", "agencyId", status, "totalAmount", "netAmount", notes, "createdAt", "updatedAt", "createdBy")
VALUES
  ('order1', 'ORD-2025-001', 'camp1', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'approved', 10000, 9000, 'Q1 2025 campaign for TechCorp', NOW(), NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('order2', 'ORD-2025-002', 'camp2', 'cmd2qfeve0000og5y8hfwu795', 'adv2', 'agency2', 'draft', 15000, 13500, 'HealthPlus Wellness Series - pending approval', NOW(), NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('order3', 'ORD-2025-003', 'camp3', 'cmd2qfeve0000og5y8hfwu795', 'adv3', 'agency3', 'pending_approval', 8000, 7200, 'Business Solutions Promo', NOW(), NOW(), 'cmd2qff550006og5y4ri8ztev');

-- Historical campaigns to orders
INSERT INTO "Order" (id, "orderNumber", "campaignId", "organizationId", "advertiserId", "agencyId", status, "totalAmount", "netAmount", notes, "createdAt", "updatedAt", "createdBy")
VALUES
  ('order4', 'ORD-2024-101', 'camp4', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'confirmed', 25000, 22500, 'Holiday season campaign - completed successfully', '2024-10-20', NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('order5', 'ORD-2024-102', 'camp5', 'cmd2qfeve0000og5y8hfwu795', 'adv2', 'agency2', 'confirmed', 18000, 16200, 'Back to school health campaign', '2024-07-20', NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('order6', 'ORD-2024-103', 'camp6', 'cmd2qfeve0000og5y8hfwu795', 'adv3', 'agency3', 'confirmed', 12000, 10800, 'Summer wellness campaign - great performance', '2024-05-20', NOW(), 'cmd2qff550006og5y4ri8ztev');

-- Update orders with approval/confirmation details
UPDATE "Order" SET 
  "submittedAt" = NOW() - INTERVAL '7 days', 
  "submittedBy" = 'cmd2qff550006og5y4ri8ztev',
  "approvedAt" = NOW() - INTERVAL '5 days', 
  "approvedBy" = 'cmd2qff240004og5y1f5msy5g' 
WHERE id = 'order1';

UPDATE "Order" SET 
  "submittedAt" = NOW() - INTERVAL '2 days', 
  "submittedBy" = 'cmd2qff550006og5y4ri8ztev'
WHERE id = 'order3';

UPDATE "Order" SET 
  "submittedAt" = '2024-10-18', 
  "submittedBy" = 'cmd2qff550006og5y4ri8ztev',
  "approvedAt" = '2024-10-20', 
  "approvedBy" = 'cmd2qff240004og5y1f5msy5g',
  "bookedAt" = '2024-10-22',
  "bookedBy" = 'cmd2qff240004og5y1f5msy5g',
  "confirmedAt" = '2024-10-25', 
  "confirmedBy" = 'cmd2qff240004og5y1f5msy5g',
  "ioNumber" = 'IO-2024-101',
  "ioGeneratedAt" = '2024-10-21'
WHERE id = 'order4';

UPDATE "Order" SET 
  "submittedAt" = '2024-07-18', 
  "submittedBy" = 'cmd2qff550006og5y4ri8ztev',
  "approvedAt" = '2024-07-20', 
  "approvedBy" = 'cmd2qff240004og5y1f5msy5g',
  "bookedAt" = '2024-07-22',
  "bookedBy" = 'cmd2qff240004og5y1f5msy5g',
  "confirmedAt" = '2024-07-25', 
  "confirmedBy" = 'cmd2qff240004og5y1f5msy5g',
  "ioNumber" = 'IO-2024-102',
  "ioGeneratedAt" = '2024-07-21'
WHERE id = 'order5';

UPDATE "Order" SET 
  "submittedAt" = '2024-05-18', 
  "submittedBy" = 'cmd2qff550006og5y4ri8ztev',
  "approvedAt" = '2024-05-20', 
  "approvedBy" = 'cmd2qff240004og5y1f5msy5g',
  "bookedAt" = '2024-05-22',
  "bookedBy" = 'cmd2qff240004og5y1f5msy5g',
  "confirmedAt" = '2024-05-25', 
  "confirmedBy" = 'cmd2qff240004og5y1f5msy5g',
  "ioNumber" = 'IO-2024-103',
  "ioGeneratedAt" = '2024-05-21'
WHERE id = 'order6';

-- Create Campaign KPIs
INSERT INTO "CampaignKPI" (id, "campaignId", "organizationId", "kpiType", "goalCPA", "conversionValue", "targetVisits", "targetConversions", "actualVisits", "actualConversions", "actualCPA", "isActive", "lastUpdated", "updatedBy", "clientCanUpdate", "reminderFrequency", "createdAt", "updatedAt")
VALUES
  -- Active campaigns KPIs
  ('kpi1', 'camp1', 'cmd2qfeve0000og5y8hfwu795', 'both', 50.00, 100.00, 50000, 500, 22500, 225, 20.00, true, NOW(), 'cmd2qff550006og5y4ri8ztev', true, 'monthly', NOW(), NOW()),
  ('kpi2', 'camp2', 'cmd2qfeve0000og5y8hfwu795', 'conversions', 30.00, 150.00, 0, 300, 0, 150, 30.00, true, NOW(), 'cmd2qff550006og5y4ri8ztev', true, 'quarterly', NOW(), NOW()),
  ('kpi3', 'camp3', 'cmd2qfeve0000og5y8hfwu795', 'unique_web_visits', 0, 0, 40000, 0, 16000, 0, 0, true, NOW(), 'cmd2qff550006og5y4ri8ztev', true, 'monthly', NOW(), NOW()),
  
  -- Historical campaigns KPIs with realistic data
  ('kpi4', 'camp4', 'cmd2qfeve0000og5y8hfwu795', 'both', 20.00, 200.00, 125000, 1250, 124250, 1242, 20.00, true, NOW(), 'cmd2qff240004og5y1f5msy5g', false, 'never', '2024-10-20', NOW()),
  ('kpi5', 'camp5', 'cmd2qfeve0000og5y8hfwu795', 'both', 20.00, 100.00, 90000, 900, 89750, 897, 20.00, true, NOW(), 'cmd2qff240004og5y1f5msy5g', false, 'never', '2024-07-20', NOW()),
  ('kpi6', 'camp6', 'cmd2qfeve0000og5y8hfwu795', 'conversions', 20.00, 80.00, 0, 600, 0, 595, 20.00, true, NOW(), 'cmd2qff240004og5y1f5msy5g', false, 'never', '2024-05-20', NOW());

-- Create some KPI history entries for active campaigns
INSERT INTO "KPIHistory" (id, "kpiId", "changeType", "updateSource", "changedFields", "previousValues", "newValues", "updatedBy", "createdAt")
VALUES
  ('hist1', 'kpi1', 'update', 'admin', ARRAY['actualVisits', 'actualConversions'], '{"actualVisits": 10000, "actualConversions": 100}', '{"actualVisits": 22500, "actualConversions": 225}', 'cmd2qff240004og5y1f5msy5g', NOW() - INTERVAL '7 days'),
  ('hist2', 'kpi1', 'update', 'client', ARRAY['actualVisits', 'actualConversions'], '{"actualVisits": 22500, "actualConversions": 225}', '{"actualVisits": 22500, "actualConversions": 225}', NULL, NOW() - INTERVAL '3 days'),
  ('hist3', 'kpi2', 'create', 'admin', ARRAY['all'], '{}', '{"kpiType": "conversions", "goalCPA": 30, "targetConversions": 300}', 'cmd2qff550006og5y4ri8ztev', NOW() - INTERVAL '14 days');

-- Create some Shows if they don't exist
INSERT INTO "Show" (id, name, "organizationId", "isActive", "createdAt", "updatedAt") 
VALUES 
  ('show1', 'Tech Talk Weekly', 'cmd2qfeve0000og5y8hfwu795', true, NOW(), NOW()),
  ('show2', 'Business Insights', 'cmd2qfeve0000og5y8hfwu795', true, NOW(), NOW()),
  ('show3', 'Health & Wellness Hour', 'cmd2qfeve0000og5y8hfwu795', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create Order Items for the orders
INSERT INTO "OrderItem" (id, "orderId", "showId", "placementType", "airDate", length, rate, "actualRate", "isLiveRead", status, "adTitle", "createdAt", "updatedAt")
VALUES
  -- Order 1 items (Q1 2025)
  ('oi1', 'order1', 'show1', 'pre-roll', '2025-01-08 14:00:00', 30, 250, 250, false, 'pending', 'TechCorp Pre-Roll Week 1', NOW(), NOW()),
  ('oi2', 'order1', 'show1', 'mid-roll', '2025-01-08 14:00:00', 60, 250, 250, true, 'pending', 'TechCorp Mid-Roll Week 1', NOW(), NOW()),
  ('oi3', 'order1', 'show1', 'pre-roll', '2025-01-15 14:00:00', 30, 250, 250, false, 'pending', 'TechCorp Pre-Roll Week 2', NOW(), NOW()),
  ('oi4', 'order1', 'show1', 'mid-roll', '2025-01-15 14:00:00', 60, 250, 250, true, 'pending', 'TechCorp Mid-Roll Week 2', NOW(), NOW()),
  
  -- Order 4 items (completed Holiday 2024)
  ('oi5', 'order4', 'show1', 'pre-roll', '2024-11-01 14:00:00', 30, 300, 300, false, 'completed', 'Holiday Pre-Roll Nov 1', '2024-10-20', NOW()),
  ('oi6', 'order4', 'show1', 'mid-roll', '2024-11-01 14:00:00', 60, 300, 300, true, 'completed', 'Holiday Mid-Roll Nov 1', '2024-10-20', NOW()),
  ('oi7', 'order4', 'show2', 'pre-roll', '2024-11-05 14:00:00', 30, 350, 350, false, 'completed', 'Business Holiday Spot', '2024-10-20', NOW());

-- Create Contracts for completed orders
INSERT INTO "Contract" (id, "contractNumber", "organizationId", "advertiserId", "agencyId", "campaignId", "orderId", title, "totalAmount", "netAmount", "startDate", "endDate", status, terms, "createdAt", "updatedAt", "createdById")
VALUES
  ('contract1', 'IO-2025-001', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'camp1', 'order1', 'Q1 2025 TechCorp Campaign', 10000, 9000, '2025-01-01', '2025-03-31', 'draft', 'Standard terms and conditions apply. Cancellation requires 14 days notice.', NOW(), NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('contract2', 'IO-2024-101', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'camp4', 'order4', 'Holiday 2024 Campaign', 25000, 22500, '2024-11-01', '2024-12-31', 'completed', 'Holiday campaign terms. Premium rates apply.', '2024-10-20', NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('contract3', 'IO-2024-102', 'cmd2qfeve0000og5y8hfwu795', 'adv2', 'agency2', 'camp5', 'order5', 'Back to School 2024', 18000, 16200, '2024-08-01', '2024-09-30', 'completed', 'Back to school campaign. Health & wellness focus.', '2024-07-20', NOW(), 'cmd2qff550006og5y4ri8ztev');

-- Update contracts with signature information for completed ones
UPDATE "Contract" SET "signedAt" = '2024-10-25', "signedBy" = 'Jane Doe, CMO' WHERE id = 'contract2';
UPDATE "Contract" SET "signedAt" = '2024-07-25', "signedBy" = 'Mike Johnson, Director' WHERE id = 'contract3';

-- Create some ad approvals for talent recording requests
INSERT INTO "AdApproval" (id, "campaignId", "showId", "organizationId", "script", type, duration, status, "submittedAt", "createdAt", "updatedAt")
VALUES
  ('approval1', 'camp1', 'show1', 'cmd2qfeve0000og5y8hfwu795', 'Looking for cutting-edge tech solutions? TechCorp has you covered with innovative products designed for modern businesses. Visit techcorp.com today!', 'voiced', 30, 'approved', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW()),
  ('approval2', 'camp2', 'show3', 'cmd2qfeve0000og5y8hfwu795', 'Transform your wellness journey with HealthPlus - your partner in achieving optimal health. Our comprehensive wellness programs are designed to fit your lifestyle.', 'endorsed', 60, 'pending_talent', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW()),
  ('approval3', 'camp1', 'show1', 'cmd2qfeve0000og5y8hfwu795', 'This holiday season, give the gift of technology. TechCorp''s latest innovations make perfect presents for the tech enthusiast in your life.', 'host_read', 60, 'pending_review', NOW(), NOW(), NOW());

-- Update ad approvals with review information
UPDATE "AdApproval" SET 
  "reviewedAt" = NOW() - INTERVAL '1 day', 
  "reviewedBy" = 'cmd2qff240004og5y1f5msy5g',
  "approvedAt" = NOW() - INTERVAL '1 day',
  "approvedBy" = 'cmd2qff240004og5y1f5msy5g',
  "approvalNotes" = 'Script approved. Ready for talent recording.'
WHERE id = 'approval1';

-- Display summary
SELECT 'Orders created:' as summary, COUNT(*) as count FROM "Order" WHERE id IN ('order1', 'order2', 'order3', 'order4', 'order5', 'order6')
UNION ALL
SELECT 'KPIs configured:', COUNT(*) FROM "CampaignKPI" WHERE id IN ('kpi1', 'kpi2', 'kpi3', 'kpi4', 'kpi5', 'kpi6')
UNION ALL
SELECT 'Order items created:', COUNT(*) FROM "OrderItem" WHERE id LIKE 'oi%'
UNION ALL
SELECT 'Contracts created:', COUNT(*) FROM "Contract" WHERE id IN ('contract1', 'contract2', 'contract3')
UNION ALL
SELECT 'Ad approvals created:', COUNT(*) FROM "AdApproval" WHERE id IN ('approval1', 'approval2', 'approval3');