-- Create AdApproval records for the 3 campaigns with all required fields
-- First, let's get the campaign and advertiser info
WITH campaign_data AS (
    SELECT 
        c.id as campaign_id,
        c.name as campaign_name,
        c."advertiserId",
        a.name as advertiser_name,
        c."createdBy",
        c.probability
    FROM org_podcastflow_pro."Campaign" c
    JOIN org_podcastflow_pro."Advertiser" a ON c."advertiserId" = a.id
    WHERE c.id IN ('cmp_1753140387494_809d3e95', 'cmp_1753054387785_7375fdef', 'cmp_1753054388895_21b9c3f4')
)
-- Insert AdApproval records
INSERT INTO org_podcastflow_pro."AdApproval" (
    id, title, "advertiserId", "advertiserName", "campaignId", "showId", "showName",
    type, duration, script, priority, status, "submittedBy", "organizationId",
    "workflowStage", "revisionCount", "createdAt", "updatedAt"
) VALUES
-- Test Campaign - Probability Tracking (90% - Verbal Agreement) - Assign to 2 shows
(
    'adapp_' || substr(md5(random()::text || NOW()::text || '1'), 1, 20),
    'Test Campaign - Business Breakthrough',
    '013e4d14-2594-4a9d-8f5d-6f82ed6a1228',
    'Master Advertiser',
    'cmp_1753140387494_809d3e95',
    '33d9647f-27cb-49a3-8b38-4adfc42a5de9',
    'Seed: Business Breakthrough',
    'host-read',
    30,
    'Test campaign script for Business Breakthrough show. This campaign is at 90% probability stage.',
    'high',
    'approved',
    'cmd2qff550006og5y4ri8ztev', -- Sammy Seller
    'cmd2qfeve0000og5y8hfwu795',
    'approved',
    0,
    NOW(),
    NOW()
),
(
    'adapp_' || substr(md5(random()::text || NOW()::text || '2'), 1, 20),
    'Test Campaign - Startup Stories',
    '013e4d14-2594-4a9d-8f5d-6f82ed6a1228',
    'Master Advertiser',
    'cmp_1753140387494_809d3e95',
    'cbdb0807-97fd-4e56-b973-d3bf096c9690',
    'Seed: Startup Stories',
    'host-read',
    30,
    'Test campaign script for Startup Stories show. This campaign is at 90% probability stage.',
    'high',
    'approved',
    'cmd2qff550006og5y4ri8ztev', -- Sammy Seller
    'cmd2qfeve0000og5y8hfwu795',
    'approved',
    0,
    NOW(),
    NOW()
),
-- First Michael Bachelis campaign (10% - Initial Contact) - Assign to 2 shows
(
    'adapp_' || substr(md5(random()::text || NOW()::text || '3'), 1, 20),
    'Michael Bachelis - Business Insights',
    '013e4d14-2594-4a9d-8f5d-6f82ed6a1228',
    'Master Advertiser',
    'cmp_1753054387785_7375fdef',
    'show2',
    'Business Insights',
    'pre-roll',
    15,
    'Initial contact campaign for Business Insights. Early stage discussions.',
    'medium',
    'pending',
    'cmd2qff550006og5y4ri8ztev', -- Sammy Seller
    'cmd2qfeve0000og5y8hfwu795',
    'pending_creation',
    0,
    NOW(),
    NOW()
),
(
    'adapp_' || substr(md5(random()::text || NOW()::text || '4'), 1, 20),
    'Michael Bachelis - Financial Freedom',
    '013e4d14-2594-4a9d-8f5d-6f82ed6a1228',
    'Master Advertiser',
    'cmp_1753054387785_7375fdef',
    'f9d7f7d3-7341-4e45-a7ae-0e7f771531ff',
    'Seed: Financial Freedom Daily',
    'pre-roll',
    15,
    'Initial contact campaign for Financial Freedom Daily. Early stage discussions.',
    'medium',
    'pending',
    'cmd2qff550006og5y4ri8ztev', -- Sammy Seller
    'cmd2qfeve0000og5y8hfwu795',
    'pending_creation',
    0,
    NOW(),
    NOW()
),
-- Second Michael Bachelis campaign (10% - Initial Contact) - Assign to 2 shows
(
    'adapp_' || substr(md5(random()::text || NOW()::text || '5'), 1, 20),
    'Michael Bachelis - Health & Wellness',
    '013e4d14-2594-4a9d-8f5d-6f82ed6a1228',
    'Master Advertiser',
    'cmp_1753054388895_21b9c3f4',
    'show3',
    'Health & Wellness',
    'mid-roll',
    20,
    'Initial contact campaign for Health & Wellness. Early stage discussions.',
    'medium',
    'pending',
    'cmd2qff550006og5y4ri8ztev', -- Sammy Seller
    'cmd2qfeve0000og5y8hfwu795',
    'pending_creation',
    0,
    NOW(),
    NOW()
),
(
    'adapp_' || substr(md5(random()::text || NOW()::text || '6'), 1, 20),
    'Michael Bachelis - Creative Minds',
    '013e4d14-2594-4a9d-8f5d-6f82ed6a1228',
    'Master Advertiser',
    'cmp_1753054388895_21b9c3f4',
    '490436ef-a67a-4f7b-a32f-b913e947baf9',
    'Seed: Creative Minds',
    'mid-roll',
    20,
    'Initial contact campaign for Creative Minds. Early stage discussions.',
    'medium',
    'pending',
    'cmd2qff550006og5y4ri8ztev', -- Sammy Seller
    'cmd2qfeve0000og5y8hfwu795',
    'pending_creation',
    0,
    NOW(),
    NOW()
);

-- Verify the results
SELECT 
    c.id,
    c.name as campaign_name,
    c.probability,
    CASE c.probability
        WHEN 10 THEN 'Initial Contact'
        WHEN 35 THEN 'Qualified Lead'
        WHEN 65 THEN 'Proposal Sent'
        WHEN 90 THEN 'Verbal Agreement'
        WHEN 100 THEN 'Signed Contract'
    END as stage,
    COUNT(aa.id) as show_assignments,
    STRING_AGG(s.name, ', ' ORDER BY s.name) as assigned_shows
FROM org_podcastflow_pro."Campaign" c
LEFT JOIN org_podcastflow_pro."AdApproval" aa ON c.id = aa."campaignId"
LEFT JOIN org_podcastflow_pro."Show" s ON aa."showId" = s.id
WHERE c.id IN ('cmp_1753054387785_7375fdef', 'cmp_1753054388895_21b9c3f4', 'cmp_1753140387494_809d3e95')
GROUP BY c.id, c.name, c.probability
ORDER BY c.name;