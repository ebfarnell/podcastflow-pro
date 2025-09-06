-- Create test data for campaigns, agencies, and orders workflow (fixed for actual schema)

-- Create agencies first
INSERT INTO "Agency" (id, name, website, "contactPhone", "contactEmail", address, city, state, "zipCode", country, "isActive", "organizationId", "createdAt", "updatedAt")
VALUES 
  ('agency1', 'MediaMax Agency', 'https://mediamax.com', '555-0100', 'contact@mediamax.com', '123 Madison Ave', 'New York', 'NY', '10016', 'US', true, 'cmd2qfeve0000og5y8hfwu795', NOW(), NOW()),
  ('agency2', 'Digital First Marketing', 'https://digitalfirst.com', '555-0200', 'hello@digitalfirst.com', '456 Market St', 'San Francisco', 'CA', '94105', 'US', true, 'cmd2qfeve0000og5y8hfwu795', NOW(), NOW()),
  ('agency3', 'Creative Solutions Group', 'https://creativesolutions.com', '555-0300', 'info@creativesolutions.com', '789 Sunset Blvd', 'Los Angeles', 'CA', '90028', 'US', true, 'cmd2qfeve0000og5y8hfwu795', NOW(), NOW());

-- Update existing advertisers to link to agencies
UPDATE "Advertiser" SET "agencyId" = 'agency1' WHERE id = 'adv1';
UPDATE "Advertiser" SET "agencyId" = 'agency2' WHERE id = 'adv2';
UPDATE "Advertiser" SET "agencyId" = 'agency3' WHERE id = 'adv3';

-- Create some completed historical campaigns
INSERT INTO "Campaign" (id, name, "advertiserId", "agencyId", "organizationId", "startDate", "endDate", budget, spent, impressions, "targetImpressions", clicks, conversions, "targetAudience", status, "createdAt", "updatedAt")
VALUES
  ('camp4', 'Holiday Season 2024', 'adv1', 'agency1', 'cmd2qfeve0000og5y8hfwu795', '2024-11-01', '2024-12-31', 25000, 24850, 248500, 250000, 12425, 1242, 'Holiday shoppers and tech enthusiasts', 'completed', '2024-10-15', NOW()),
  ('camp5', 'Back to School 2024', 'adv2', 'agency2', 'cmd2qfeve0000og5y8hfwu795', '2024-08-01', '2024-09-30', 18000, 17950, 179500, 180000, 8975, 897, 'Parents and students preparing for school', 'completed', '2024-07-15', NOW()),
  ('camp6', 'Summer Wellness 2024', 'adv3', 'agency3', 'cmd2qfeve0000og5y8hfwu795', '2024-06-01', '2024-08-31', 12000, 11900, 119000, 120000, 5950, 595, 'Fitness enthusiasts and wellness seekers', 'completed', '2024-05-15', NOW());

-- Check Order table structure first
\d "Order"