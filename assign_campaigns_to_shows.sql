-- First, let's verify the campaign probability values are set correctly
-- The campaigns already have probability values (10, 10, 90) which represent their stages

-- Create AdApproval records for the 3 campaigns that are missing show assignments
-- We'll assign them to appropriate shows based on their campaign names

-- For "Test Campaign - Probability Tracking" (90% probability - Verbal Agreement)
-- Assign to Business Breakthrough and Startup Stories (business-focused shows)
INSERT INTO org_podcastflow_pro."AdApproval" (
    id,
    "campaignId",
    "showId",
    "episodeId",
    status,
    "submittedAt",
    "organizationId",
    "createdAt",
    "updatedAt"
) VALUES 
(
    'adapp_' || substr(md5(random()::text), 1, 20),
    'cmp_1753140387494_809d3e95',
    '33d9647f-27cb-49a3-8b38-4adfc42a5de9', -- Business Breakthrough
    NULL,
    'approved',
    NOW(),
    'cmd2qfeve0000og5y8hfwu795',
    NOW(),
    NOW()
),
(
    'adapp_' || substr(md5(random()::text), 1, 20),
    'cmp_1753140387494_809d3e95',
    'cbdb0807-97fd-4e56-b973-d3bf096c9690', -- Startup Stories
    NULL,
    'approved',
    NOW(),
    'cmd2qfeve0000og5y8hfwu795',
    NOW(),
    NOW()
);

-- For "Michael Bachelis" campaigns (10% probability - Initial Contact)
-- Assign to Business Insights and Financial Freedom Daily
INSERT INTO org_podcastflow_pro."AdApproval" (
    id,
    "campaignId",
    "showId",
    "episodeId",
    status,
    "submittedAt",
    "organizationId",
    "createdAt",
    "updatedAt"
) VALUES 
-- First Michael Bachelis campaign
(
    'adapp_' || substr(md5(random()::text), 1, 20),
    'cmp_1753054387785_7375fdef',
    'show2', -- Business Insights
    NULL,
    'pending',
    NOW(),
    'cmd2qfeve0000og5y8hfwu795',
    NOW(),
    NOW()
),
(
    'adapp_' || substr(md5(random()::text), 1, 20),
    'cmp_1753054387785_7375fdef',
    'f9d7f7d3-7341-4e45-a7ae-0e7f771531ff', -- Financial Freedom Daily
    NULL,
    'pending',
    NOW(),
    'cmd2qfeve0000og5y8hfwu795',
    NOW(),
    NOW()
),
-- Second Michael Bachelis campaign
(
    'adapp_' || substr(md5(random()::text), 1, 20),
    'cmp_1753054388895_21b9c3f4',
    'show3', -- Health & Wellness
    NULL,
    'pending',
    NOW(),
    'cmd2qfeve0000og5y8hfwu795',
    NOW(),
    NOW()
),
(
    'adapp_' || substr(md5(random()::text), 1, 20),
    'cmp_1753054388895_21b9c3f4',
    '490436ef-a67a-4f7b-a32f-b913e947baf9', -- Creative Minds
    NULL,
    'pending',
    NOW(),
    'cmd2qfeve0000og5y8hfwu795',
    NOW(),
    NOW()
);

-- Let's also verify that the probability values represent the correct stages:
-- 10 = Initial Contact
-- 35 = Qualified Lead  
-- 65 = Proposal Sent
-- 90 = Verbal Agreement
-- 100 = Signed Contract

-- Check what we just created
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