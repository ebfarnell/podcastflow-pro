-- Simple campaign creation using valid status values
DO $$
DECLARE
    advertiser_record RECORD;
    campaign_start DATE;
    campaign_end DATE;
    campaign_id TEXT;
    campaign_counter INTEGER := 1;
    start_date DATE := CURRENT_DATE - INTERVAL '12 months';
BEGIN
    RAISE NOTICE 'Creating 25 campaigns with valid status values...';
    
    FOR i IN 1..25 LOOP
        SELECT INTO advertiser_record * FROM "Advertiser" WHERE name LIKE 'Seed:%' ORDER BY RANDOM() LIMIT 1;
        
        campaign_start := start_date + (RANDOM() * 300)::INTEGER * INTERVAL '1 day';
        campaign_end := campaign_start + (14 + RANDOM() * 60)::INTEGER * INTERVAL '1 day';
        campaign_end := LEAST(campaign_end, CURRENT_DATE);
        
        campaign_id := gen_random_uuid();
        
        INSERT INTO "Campaign" (
            id, "organizationId", name, "advertiserId", "agencyId", 
            "startDate", "endDate", budget, "targetAudience", status, 
            "createdAt", "updatedAt"
        ) VALUES (
            campaign_id,
            advertiser_record."organizationId",
            'Seed Campaign ' || campaign_counter,
            advertiser_record.id,
            advertiser_record."agencyId",
            campaign_start,
            campaign_end,
            (15000 + RANDOM() * 85000)::INTEGER,
            'Target demographic for ' || advertiser_record.industry,
            CASE WHEN campaign_end < CURRENT_DATE THEN 'completed' ELSE 'active' END,
            campaign_start,
            campaign_start
        );
        
        campaign_counter := campaign_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Created 25 campaigns successfully!';
END $$;

SELECT 
    COUNT(*) as total_campaigns,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_campaigns,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_campaigns
FROM "Campaign" WHERE name LIKE 'Seed Campaign%';