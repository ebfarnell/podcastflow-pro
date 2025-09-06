-- Create test data for campaigns, agencies, and orders workflow

-- Create agencies first
INSERT INTO "Agency" (id, name, website, phone, email, address, city, state, "postalCode", country, "isActive", "organizationId", "createdAt", "updatedAt")
VALUES 
  ('agency1', 'MediaMax Agency', 'https://mediamax.com', '555-0100', 'contact@mediamax.com', '123 Madison Ave', 'New York', 'NY', '10016', 'US', true, 'cmd2qfeve0000og5y8hfwu795', NOW(), NOW()),
  ('agency2', 'Digital First Marketing', 'https://digitalfirst.com', '555-0200', 'hello@digitalfirst.com', '456 Market St', 'San Francisco', 'CA', '94105', 'US', true, 'cmd2qfeve0000og5y8hfwu795', NOW(), NOW()),
  ('agency3', 'Creative Solutions Group', 'https://creativesolutions.com', '555-0300', 'info@creativesolutions.com', '789 Sunset Blvd', 'Los Angeles', 'CA', '90028', 'US', true, 'cmd2qfeve0000og5y8hfwu795', NOW(), NOW());

-- Update existing advertisers to link to agencies
UPDATE "Advertiser" SET "agencyId" = 'agency1' WHERE id = 'adv1';
UPDATE "Advertiser" SET "agencyId" = 'agency2' WHERE id = 'adv2';
UPDATE "Advertiser" SET "agencyId" = 'agency3' WHERE id = 'adv3';

-- Update existing campaigns with realistic spent amounts and link to shows
-- TechCorp Q1 2025 - Active campaign, 45% spent
UPDATE "Campaign" 
SET 
  spent = 4500,
  impressions = 45000,
  clicks = 2250,
  conversions = 225,
  "targetImpressions" = 100000,
  "targetAudience" = 'Tech professionals and business decision makers'
WHERE id = 'camp1';

-- HealthPlus Wellness Series - Active campaign, 30% spent
UPDATE "Campaign" 
SET 
  spent = 4500,
  impressions = 30000,
  clicks = 1500,
  conversions = 150,
  "targetImpressions" = 100000,
  "targetAudience" = 'Health-conscious adults 25-54'
WHERE id = 'camp2';

-- Business Solutions Promo - Active campaign, 20% spent
UPDATE "Campaign" 
SET 
  spent = 1600,
  impressions = 16000,
  clicks = 800,
  conversions = 80,
  "targetImpressions" = 80000,
  "targetAudience" = 'Small to medium business owners'
WHERE id = 'camp3';

-- Create some completed historical campaigns
INSERT INTO "Campaign" (id, name, "advertiserId", "agencyId", "organizationId", "startDate", "endDate", budget, spent, impressions, "targetImpressions", clicks, conversions, "targetAudience", status, "createdAt", "updatedAt")
VALUES
  ('camp4', 'Holiday Season 2024', 'adv1', 'agency1', 'cmd2qfeve0000og5y8hfwu795', '2024-11-01', '2024-12-31', 25000, 24850, 248500, 250000, 12425, 1242, 'Holiday shoppers and tech enthusiasts', 'completed', '2024-10-15', NOW()),
  ('camp5', 'Back to School 2024', 'adv2', 'agency2', 'cmd2qfeve0000og5y8hfwu795', '2024-08-01', '2024-09-30', 18000, 17950, 179500, 180000, 8975, 897, 'Parents and students preparing for school', 'completed', '2024-07-15', NOW()),
  ('camp6', 'Summer Wellness 2024', 'adv3', 'agency3', 'cmd2qfeve0000og5y8hfwu795', '2024-06-01', '2024-08-31', 12000, 11900, 119000, 120000, 5950, 595, 'Fitness enthusiasts and wellness seekers', 'completed', '2024-05-15', NOW());

-- Create Orders from some campaigns
INSERT INTO "Order" (id, "orderNumber", "campaignId", "organizationId", "advertiserId", "agencyId", "startDate", "endDate", "totalAmount", "netAmount", commission, status, "placementDetails", notes, "approvalStatus", "createdAt", "updatedAt", "createdBy")
VALUES
  ('order1', 'ORD-2025-001', 'camp1', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', '2025-01-01', '2025-03-31', 10000, 9000, 1000, 'active', '{"shows": ["Tech Talk Weekly"], "spotTypes": ["pre-roll", "mid-roll"], "frequency": "weekly"}', 'Q1 2025 campaign for TechCorp', 'approved', NOW(), NOW(), 'cmd2qfeve0001og5y8hfwu796'),
  ('order2', 'ORD-2024-101', 'camp4', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', '2024-11-01', '2024-12-31', 25000, 22500, 2500, 'completed', '{"shows": ["Tech Talk Weekly", "Business Insights"], "spotTypes": ["pre-roll", "mid-roll", "post-roll"], "frequency": "daily"}', 'Holiday season campaign - completed successfully', 'approved', '2024-10-20', NOW(), 'cmd2qfeve0001og5y8hfwu796'),
  ('order3', 'ORD-2024-102', 'camp5', 'cmd2qfeve0000og5y8hfwu795', 'adv2', 'agency2', '2024-08-01', '2024-09-30', 18000, 16200, 1800, 'completed', '{"shows": ["Health & Wellness"], "spotTypes": ["pre-roll", "mid-roll"], "frequency": "3x per week"}', 'Back to school health campaign', 'approved', '2024-07-20', NOW(), 'cmd2qfeve0001og5y8hfwu796');

-- Create Order Items for the orders
INSERT INTO "OrderItem" (id, "orderId", "showId", "spotType", "spotLength", quantity, rate, amount, "airDates", notes, "createdAt", "updatedAt")
VALUES
  -- Order 1 items (current Q1 2025)
  ('oi1', 'order1', 'show1', 'pre-roll', 30, 20, 250, 5000, '["2025-01-01", "2025-01-08", "2025-01-15", "2025-01-22", "2025-01-29"]', 'Weekly pre-roll spots', NOW(), NOW()),
  ('oi2', 'order1', 'show1', 'mid-roll', 60, 20, 250, 5000, '["2025-01-01", "2025-01-08", "2025-01-15", "2025-01-22", "2025-01-29"]', 'Weekly mid-roll spots', NOW(), NOW()),
  
  -- Order 2 items (completed Holiday 2024)
  ('oi3', 'order2', 'show1', 'pre-roll', 30, 30, 300, 9000, '["2024-11-01", "2024-11-15", "2024-11-30", "2024-12-15", "2024-12-25"]', 'Holiday pre-rolls', '2024-10-20', NOW()),
  ('oi4', 'order2', 'show1', 'mid-roll', 60, 30, 300, 9000, '["2024-11-01", "2024-11-15", "2024-11-30", "2024-12-15", "2024-12-25"]', 'Holiday mid-rolls', '2024-10-20', NOW()),
  ('oi5', 'order2', 'show2', 'pre-roll', 30, 20, 350, 7000, '["2024-11-05", "2024-11-20", "2024-12-05", "2024-12-20"]', 'Business show holiday spots', '2024-10-20', NOW());

-- Create Contracts for the orders
INSERT INTO "Contract" (id, "contractNumber", "contractType", "organizationId", "advertiserId", "agencyId", "campaignId", "orderId", "startDate", "endDate", "totalValue", "paymentTerms", status, "signedDate", terms, "createdAt", "updatedAt", "createdById")
VALUES
  ('contract1', 'IO-2025-001', 'insertion_order', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'camp1', 'order1', '2025-01-01', '2025-03-31', 10000, 'Net 30', 'signed', '2024-12-20', 'Standard terms and conditions apply. Cancellation requires 14 days notice.', NOW(), NOW(), 'cmd2qfeve0001og5y8hfwu796'),
  ('contract2', 'IO-2024-101', 'insertion_order', 'cmd2qfeve0000og5y8hfwu795', 'adv1', 'agency1', 'camp4', 'order2', '2024-11-01', '2024-12-31', 25000, 'Net 30', 'completed', '2024-10-25', 'Holiday campaign terms. Premium rates apply.', '2024-10-20', NOW(), 'cmd2qfeve0001og5y8hfwu796'),
  ('contract3', 'IO-2024-102', 'insertion_order', 'cmd2qfeve0000og5y8hfwu795', 'adv2', 'agency2', 'camp5', 'order3', '2024-08-01', '2024-09-30', 18000, 'Net 30', 'completed', '2024-07-25', 'Back to school campaign. Health & wellness focus.', '2024-07-20', NOW(), 'cmd2qfeve0001og5y8hfwu796');

-- Create some sample KPIs for campaigns
INSERT INTO "CampaignKPI" (id, "campaignId", "organizationId", "kpiType", "goalCPA", "conversionValue", "targetVisits", "targetConversions", "actualVisits", "actualConversions", "actualCPA", "isActive", "lastUpdated", "updatedBy", "clientCanUpdate", "reminderFrequency", "createdAt", "updatedAt")
VALUES
  ('kpi1', 'camp1', 'cmd2qfeve0000og5y8hfwu795', 'both', 50.00, 100.00, 50000, 500, 22500, 225, 20.00, true, NOW(), 'cmd2qfeve0001og5y8hfwu796', true, 'monthly', NOW(), NOW()),
  ('kpi2', 'camp2', 'cmd2qfeve0000og5y8hfwu795', 'conversions', 30.00, 150.00, NULL, 300, NULL, 150, 30.00, true, NOW(), 'cmd2qfeve0001og5y8hfwu796', true, 'quarterly', NOW(), NOW()),
  ('kpi3', 'camp4', 'cmd2qfeve0000og5y8hfwu795', 'both', 20.00, 200.00, 125000, 1250, 124250, 1242, 20.00, true, NOW(), 'cmd2qfeve0001og5y8hfwu796', false, 'never', '2024-10-20', NOW());

-- Create some ad approvals for talent recording requests
INSERT INTO "AdApproval" (id, "campaignId", "showId", "organizationId", "scriptContent", "draftScript", "finalScript", type, duration, status, "submittedAt", "createdAt", "updatedAt")
VALUES
  ('approval1', 'camp1', 'show1', 'cmd2qfeve0000og5y8hfwu795', 'Looking for cutting-edge tech solutions? TechCorp has you covered...', 'Looking for cutting-edge tech solutions? TechCorp has you covered with innovative products designed for modern businesses.', 'Looking for cutting-edge tech solutions? TechCorp has you covered with innovative products designed for modern businesses. Visit techcorp.com today!', 'voiced', 30, 'approved', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW()),
  ('approval2', 'camp2', 'show3', 'cmd2qfeve0000og5y8hfwu795', 'Transform your wellness journey with HealthPlus...', 'Transform your wellness journey with HealthPlus - your partner in achieving optimal health.', NULL, 'endorsed', 60, 'pending_talent', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW());

-- Update organization to show some revenue
UPDATE "Organization" 
SET 
  "monthlyRevenue" = 10600,
  "totalRevenue" = 54750,
  "activeUsers" = 6
WHERE id = 'cmd2qfeve0000og5y8hfwu795';

-- Add some sample expenses to complete the financial picture
INSERT INTO "Expense" (id, "organizationId", amount, category, "expenseDate", description, vendor, "paymentMethod", status, "approvedBy", notes, "createdAt", "updatedAt", "createdBy")
VALUES
  ('exp1', 'cmd2qfeve0000og5y8hfwu795', 2500, 'talent_fees', '2024-12-01', 'Talent fees for Q4 2024 recordings', 'Various Talent', 'bank_transfer', 'approved', 'cmd2qfeve0001og5y8hfwu796', 'Monthly talent payment batch', '2024-12-01', NOW(), 'cmd2qfeve0001og5y8hfwu796'),
  ('exp2', 'cmd2qfeve0000og5y8hfwu795', 1500, 'production', '2024-12-15', 'Studio time and editing costs', 'ProAudio Studios', 'credit_card', 'approved', 'cmd2qfeve0001og5y8hfwu796', 'December production costs', '2024-12-15', NOW(), 'cmd2qfeve0001og5y8hfwu796'),
  ('exp3', 'cmd2qfeve0000og5y8hfwu795', 500, 'marketing', '2025-01-05', 'Social media advertising', 'Meta Ads', 'credit_card', 'pending', NULL, 'Q1 2025 marketing budget', '2025-01-05', NOW(), 'cmd2qfeve0001og5y8hfwu796');