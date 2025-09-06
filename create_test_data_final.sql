-- Create test data for campaigns, agencies, and orders workflow

-- We already inserted agencies and updated advertisers, so skip those

-- Create Orders from campaigns (using real user IDs)
INSERT INTO "Order" (id, "orderNumber", "campaignId", "organizationId", "advertiserId", "agencyId", status, "totalAmount", "netAmount", notes, "createdAt", "updatedAt", "createdBy")
VALUES
  ('order1', 'ORD-2025-001', 'camp1', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'approved', 10000, 9000, 'Q1 2025 campaign for TechCorp', NOW(), NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('order2', 'ORD-2024-101', 'camp4', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'confirmed', 25000, 22500, 'Holiday season campaign - completed successfully', '2024-10-20', NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('order3', 'ORD-2024-102', 'camp5', 'cmd2qfeve0000og5y8hfwu795', 'adv2', 'agency2', 'confirmed', 18000, 16200, 'Back to school health campaign', '2024-07-20', NOW(), 'cmd2qff550006og5y4ri8ztev');

-- Update orders with approval info
UPDATE "Order" SET "approvedAt" = NOW() - INTERVAL '5 days', "approvedBy" = 'cmd2qff240004og5y1f5msy5g' WHERE id = 'order1';
UPDATE "Order" SET "approvedAt" = '2024-10-25', "approvedBy" = 'cmd2qff240004og5y1f5msy5g', "confirmedAt" = '2024-10-26', "confirmedBy" = 'cmd2qff240004og5y1f5msy5g' WHERE id = 'order2';
UPDATE "Order" SET "approvedAt" = '2024-07-25', "approvedBy" = 'cmd2qff240004og5y1f5msy5g', "confirmedAt" = '2024-07-26', "confirmedBy" = 'cmd2qff240004og5y1f5msy5g' WHERE id = 'order3';

-- Create Order Items for the orders
INSERT INTO "OrderItem" (id, "orderId", "showId", "placementType", "airDate", length, rate, "actualRate", "isLiveRead", status, "adTitle", "createdAt", "updatedAt")
VALUES
  -- Order 1 items (current Q1 2025)
  ('oi1', 'order1', 'show1', 'pre-roll', '2025-01-08 14:00:00', 30, 250, 250, false, 'pending', 'TechCorp Pre-Roll Week 1', NOW(), NOW()),
  ('oi2', 'order1', 'show1', 'mid-roll', '2025-01-08 14:00:00', 60, 250, 250, true, 'pending', 'TechCorp Mid-Roll Week 1', NOW(), NOW()),
  ('oi3', 'order1', 'show1', 'pre-roll', '2025-01-15 14:00:00', 30, 250, 250, false, 'pending', 'TechCorp Pre-Roll Week 2', NOW(), NOW()),
  ('oi4', 'order1', 'show1', 'mid-roll', '2025-01-15 14:00:00', 60, 250, 250, true, 'pending', 'TechCorp Mid-Roll Week 2', NOW(), NOW()),
  
  -- Order 2 items (completed Holiday 2024)
  ('oi5', 'order2', 'show1', 'pre-roll', '2024-11-01 14:00:00', 30, 300, 300, false, 'completed', 'Holiday Pre-Roll Nov 1', '2024-10-20', NOW()),
  ('oi6', 'order2', 'show1', 'mid-roll', '2024-11-01 14:00:00', 60, 300, 300, true, 'completed', 'Holiday Mid-Roll Nov 1', '2024-10-20', NOW()),
  ('oi7', 'order2', 'show2', 'pre-roll', '2024-11-05 14:00:00', 30, 350, 350, false, 'completed', 'Business Holiday Spot', '2024-10-20', NOW());

-- Create Contracts for the orders
INSERT INTO "Contract" (id, "contractNumber", "organizationId", "advertiserId", "agencyId", "campaignId", "orderId", title, "totalAmount", "netAmount", "startDate", "endDate", status, terms, "createdAt", "updatedAt", "createdById")
VALUES
  ('contract1', 'IO-2025-001', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'camp1', 'order1', 'Q1 2025 TechCorp Campaign', 10000, 9000, '2025-01-01', '2025-03-31', 'signed', 'Standard terms and conditions apply. Cancellation requires 14 days notice.', NOW(), NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('contract2', 'IO-2024-101', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'camp4', 'order2', 'Holiday 2024 Campaign', 25000, 22500, '2024-11-01', '2024-12-31', 'completed', 'Holiday campaign terms. Premium rates apply.', '2024-10-20', NOW(), 'cmd2qff550006og5y4ri8ztev'),
  ('contract3', 'IO-2024-102', 'cmd2qfeve0000og5y8hfwu795', 'adv2', 'agency2', 'camp5', 'order3', 'Back to School 2024', 18000, 16200, '2024-08-01', '2024-09-30', 'completed', 'Back to school campaign. Health & wellness focus.', '2024-07-20', NOW(), 'cmd2qff550006og5y4ri8ztev');

-- Update contracts with signature dates
UPDATE "Contract" SET "signedAt" = '2024-12-20', "signedBy" = 'John Smith, CEO' WHERE id = 'contract1';
UPDATE "Contract" SET "signedAt" = '2024-10-25', "signedBy" = 'Jane Doe, CMO' WHERE id = 'contract2';
UPDATE "Contract" SET "signedAt" = '2024-07-25', "signedBy" = 'Mike Johnson, Director' WHERE id = 'contract3';

-- Create some sample KPIs for campaigns
INSERT INTO "CampaignKPI" (id, "campaignId", "organizationId", "kpiType", "goalCPA", "conversionValue", "targetVisits", "targetConversions", "actualVisits", "actualConversions", "actualCPA", "isActive", "lastUpdated", "updatedBy", "clientCanUpdate", "reminderFrequency", "createdAt", "updatedAt")
VALUES
  ('kpi1', 'camp1', 'cmd2qfeve0000og5y8hfwu795', 'both', 50.00, 100.00, 50000, 500, 22500, 225, 20.00, true, NOW(), 'cmd2qff550006og5y4ri8ztev', true, 'monthly', NOW(), NOW()),
  ('kpi2', 'camp2', 'cmd2qfeve0000og5y8hfwu795', 'conversions', 30.00, 150.00, 0, 300, 0, 150, 30.00, true, NOW(), 'cmd2qff550006og5y4ri8ztev', true, 'quarterly', NOW(), NOW()),
  ('kpi3', 'camp4', 'cmd2qfeve0000og5y8hfwu795', 'both', 20.00, 200.00, 125000, 1250, 124250, 1242, 20.00, true, NOW(), 'cmd2qff240004og5y1f5msy5g', false, 'never', '2024-10-20', NOW());

-- Create some ad approvals for talent recording requests
INSERT INTO "AdApproval" (id, "campaignId", "showId", "organizationId", "script", type, duration, status, "submittedAt", "createdAt", "updatedAt")
VALUES
  ('approval1', 'camp1', 'show1', 'cmd2qfeve0000og5y8hfwu795', 'Looking for cutting-edge tech solutions? TechCorp has you covered with innovative products designed for modern businesses. Visit techcorp.com today!', 'voiced', 30, 'approved', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW()),
  ('approval2', 'camp2', 'show3', 'cmd2qfeve0000og5y8hfwu795', 'Transform your wellness journey with HealthPlus - your partner in achieving optimal health.', 'endorsed', 60, 'pending_talent', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW());

-- Add some sample expenses to complete the financial picture
INSERT INTO "Expense" (id, "organizationId", amount, category, "expenseDate", description, vendor, "paymentMethod", status, "createdAt", "updatedAt", "createdBy")
VALUES
  ('exp1', 'cmd2qfeve0000og5y8hfwu795', 2500, 'talent_fees', '2024-12-01', 'Talent fees for Q4 2024 recordings', 'Various Talent', 'bank_transfer', 'approved', '2024-12-01', NOW(), 'cmd2qff240004og5y1f5msy5g'),
  ('exp2', 'cmd2qfeve0000og5y8hfwu795', 1500, 'production', '2024-12-15', 'Studio time and editing costs', 'ProAudio Studios', 'credit_card', 'approved', '2024-12-15', NOW(), 'cmd2qff240004og5y1f5msy5g'),
  ('exp3', 'cmd2qfeve0000og5y8hfwu795', 500, 'marketing', '2025-01-05', 'Social media advertising', 'Meta Ads', 'credit_card', 'pending', '2025-01-05', NOW(), 'cmd2qff550006og5y4ri8ztev');

-- Update expenses with approval info
UPDATE "Expense" SET "approvedBy" = 'cmd2qff240004og5y1f5msy5g' WHERE id IN ('exp1', 'exp2');

-- Create invoices for financial tracking
INSERT INTO "Invoice" (id, "invoiceNumber", "organizationId", amount, tax, "totalAmount", status, "dueDate", notes, "createdAt", "updatedAt")
VALUES
  ('inv1', 'INV-2024-1001', 'cmd2qfeve0000og5y8hfwu795', 24850, 0, 24850, 'paid', '2024-12-31', 'Holiday campaign invoice - PAID', '2024-12-01', NOW()),
  ('inv2', 'INV-2024-1002', 'cmd2qfeve0000og5y8hfwu795', 17950, 0, 17950, 'paid', '2024-10-30', 'Back to school campaign - PAID', '2024-09-30', NOW()),
  ('inv3', 'INV-2025-0001', 'cmd2qfeve0000og5y8hfwu795', 3333.33, 0, 3333.33, 'sent', '2025-01-31', 'Q1 2025 - January invoice', '2025-01-01', NOW());