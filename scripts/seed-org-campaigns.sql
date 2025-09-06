-- Seed campaigns in organization-specific schemas
-- This script creates test campaigns in the org_podcastflow_pro schema

DO $$
DECLARE
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795'; -- PodcastFlow Pro
    advertiser_record RECORD;
    campaign_start DATE;
    campaign_end DATE;
    campaign_id TEXT;
BEGIN
    RAISE NOTICE 'Creating campaigns in org_podcastflow_pro schema...';
    
    -- Get advertisers from the org schema
    FOR advertiser_record IN 
        SELECT * FROM org_podcastflow_pro."Advertiser" 
        WHERE "organizationId" = org_id
        LIMIT 5
    LOOP
        -- Create 2-3 campaigns per advertiser
        FOR i IN 1..3 LOOP
            campaign_id := 'cmp_' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 8);
            campaign_start := CURRENT_DATE - (30 + random() * 60)::INTEGER;
            campaign_end := campaign_start + (30 + random() * 60)::INTEGER;
            
            INSERT INTO org_podcastflow_pro."Campaign" (
                id,
                name,
                "advertiserId",
                "organizationId",
                "createdBy",
                "startDate",
                "endDate",
                budget,
                status,
                probability,
                "createdAt",
                "updatedAt",
                spent,
                impressions,
                clicks,
                conversions,
                "targetImpressions"
            ) VALUES (
                campaign_id,
                advertiser_record.name || ' - ' || 
                CASE (random() * 5)::INTEGER
                    WHEN 0 THEN 'Q1 Brand Campaign'
                    WHEN 1 THEN 'Product Launch'
                    WHEN 2 THEN 'Holiday Promotion'
                    WHEN 3 THEN 'Summer Series'
                    ELSE 'Awareness Drive'
                END || ' ' || EXTRACT(YEAR FROM campaign_start),
                advertiser_record.id,
                org_id,
                'cmd2qfevf0002og5yhtcbidvx', -- Sales Manager user
                campaign_start,
                campaign_end,
                (10000 + random() * 90000)::INTEGER,
                CASE 
                    WHEN campaign_end < CURRENT_DATE THEN 'completed'
                    WHEN campaign_start > CURRENT_DATE THEN 'proposal'
                    ELSE 'active'
                END,
                CASE (random() * 4)::INTEGER
                    WHEN 0 THEN 10
                    WHEN 1 THEN 35
                    WHEN 2 THEN 65
                    WHEN 3 THEN 90
                    ELSE 10
                END,
                campaign_start - INTERVAL '7 days',
                CURRENT_TIMESTAMP,
                CASE 
                    WHEN campaign_end < CURRENT_DATE THEN (5000 + random() * 45000)::INTEGER
                    WHEN campaign_start > CURRENT_DATE THEN 0
                    ELSE (1000 + random() * 10000)::INTEGER
                END,
                CASE 
                    WHEN campaign_end < CURRENT_DATE THEN (10000 + random() * 90000)::INTEGER
                    WHEN campaign_start > CURRENT_DATE THEN 0
                    ELSE (1000 + random() * 20000)::INTEGER
                END,
                CASE 
                    WHEN campaign_end < CURRENT_DATE THEN (100 + random() * 900)::INTEGER
                    WHEN campaign_start > CURRENT_DATE THEN 0
                    ELSE (10 + random() * 200)::INTEGER
                END,
                CASE 
                    WHEN campaign_end < CURRENT_DATE THEN (10 + random() * 90)::INTEGER
                    WHEN campaign_start > CURRENT_DATE THEN 0
                    ELSE (1 + random() * 20)::INTEGER
                END,
                (50000 + random() * 150000)::INTEGER
            );
            
            RAISE NOTICE 'Created campaign: %', campaign_id;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Campaign seeding complete!';
END $$;

-- Verify the campaigns were created
SELECT 
    COUNT(*) as total_campaigns,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_campaigns,
    COUNT(CASE WHEN status = 'proposal' THEN 1 END) as proposal_campaigns,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_campaigns
FROM org_podcastflow_pro."Campaign";