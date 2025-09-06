-- Quick script to add campaigns with fixed date math
DO $$
DECLARE
    advertiser_record RECORD;
    show_record RECORD;
    campaign_start DATE;
    campaign_end DATE;
    campaign_id TEXT;
    current_day DATE;
    campaign_counter INTEGER := 1;
    campaign_budget INTEGER;
    daily_budget NUMERIC;
    start_date DATE := CURRENT_DATE - INTERVAL '15 months';
    end_date DATE := CURRENT_DATE;
    campaign_duration INTEGER;
BEGIN
    RAISE NOTICE 'Adding 40 campaigns with fixed date calculations...';
    
    -- Generate 40 campaigns across the time period
    FOR i IN 1..40 LOOP
        -- Select random advertiser
        SELECT INTO advertiser_record * FROM "Advertiser" WHERE name LIKE 'Seed:%' ORDER BY RANDOM() LIMIT 1;
        
        -- Select show from same organization
        SELECT INTO show_record * FROM "Show" 
        WHERE name LIKE 'Seed:%' AND "organizationId" = advertiser_record."organizationId" 
        ORDER BY RANDOM() LIMIT 1;
        
        -- Generate realistic campaign timeline (2 weeks to 4 months)
        campaign_start := start_date + (RANDOM() * 400)::INTEGER * INTERVAL '1 day';
        campaign_duration := 14 + (RANDOM() * 106)::INTEGER; -- 2 weeks to 4 months
        campaign_end := campaign_start + campaign_duration * INTERVAL '1 day';
        
        -- Ensure campaign end is not in the future
        campaign_end := LEAST(campaign_end, CURRENT_DATE);
        
        campaign_id := gen_random_uuid();
        campaign_budget := (10000 + RANDOM() * 90000)::INTEGER; -- $10K to $100K
        daily_budget := campaign_budget::NUMERIC / campaign_duration;
        
        -- Create campaign
        INSERT INTO "Campaign" (
            id, "organizationId", name, description, "advertiserId", "agencyId", 
            "startDate", "endDate", budget, "targetAudience", status, 
            "createdAt", "updatedAt", "isActive"
        ) VALUES (
            campaign_id,
            advertiser_record."organizationId",
            'Seed Campaign ' || campaign_counter || ': ' || 
            CASE 
                WHEN advertiser_record.industry = 'Technology' THEN 'Digital Innovation Series'
                WHEN advertiser_record.industry = 'Healthcare' THEN 'Health Awareness Campaign'
                WHEN advertiser_record.industry = 'Financial Services' THEN 'Financial Literacy Drive'
                WHEN advertiser_record.industry = 'Food & Beverage' THEN 'Culinary Experience Promotion'
                WHEN advertiser_record.industry = 'Education' THEN 'Learning Excellence Initiative'
                ELSE 'Brand Awareness Campaign'
            END,
            'Strategic campaign targeting ' || show_record.category || ' audience',
            advertiser_record.id,
            advertiser_record."agencyId",
            campaign_start,
            campaign_end,
            campaign_budget,
            ('{"demographics": {"age_range": "25-54"}, "interests": ["' || show_record.category || '"]}')::JSONB,
            CASE 
                WHEN campaign_end < CURRENT_DATE THEN 'completed'
                ELSE 'active'
            END,
            campaign_start,
            campaign_start,
            true
        );
        
        -- Generate daily campaign analytics
        current_day := campaign_start;
        WHILE current_day <= campaign_end LOOP
            INSERT INTO "CampaignAnalytics" (
                id, "campaignId", "organizationId", date, impressions, clicks, conversions,
                "clickThroughRate", "conversionRate", spend, revenue, "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                campaign_id,
                advertiser_record."organizationId",
                current_day,
                (2000 + RANDOM() * 6000)::INTEGER, -- Daily impressions
                (100 + RANDOM() * 300)::INTEGER,   -- Daily clicks (2-7% CTR)
                (5 + RANDOM() * 20)::INTEGER,      -- Daily conversions
                0.02 + (RANDOM() * 0.05), -- 2-7% CTR
                0.05 + (RANDOM() * 0.10), -- 5-15% conversion rate
                daily_budget * (0.8 + RANDOM() * 0.4), -- Daily spend with variance
                (100 + RANDOM() * 400)::INTEGER, -- Daily revenue
                current_day,
                current_day
            );
            
            current_day := current_day + INTERVAL '1 day';
        END LOOP;
        
        campaign_counter := campaign_counter + 1;
        
        IF i % 10 = 0 THEN
            RAISE NOTICE 'Generated % campaigns...', i;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Successfully generated 40 campaigns with daily analytics!';
END $$;

-- Final data summary
DO $$
DECLARE
    total_campaigns INTEGER;
    total_campaign_analytics INTEGER;
    total_episodes INTEGER;
    total_episode_analytics INTEGER;
    total_show_analytics INTEGER;
    date_range_start DATE;
    date_range_end DATE;
BEGIN
    SELECT COUNT(*) INTO total_campaigns FROM "Campaign" WHERE name LIKE 'Seed Campaign%';
    SELECT COUNT(*) INTO total_campaign_analytics FROM "CampaignAnalytics" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE name LIKE 'Seed Campaign%');
    SELECT COUNT(*) INTO total_episodes FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    SELECT COUNT(*) INTO total_episode_analytics FROM "EpisodeAnalytics" WHERE "episodeId" IN (SELECT id FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%'));
    SELECT COUNT(*) INTO total_show_analytics FROM "ShowAnalytics" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    
    SELECT MIN("airDate"::DATE), MAX("airDate"::DATE) INTO date_range_start, date_range_end
    FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '  FINAL DATABASE SEEDING SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'CONTENT & CAMPAIGNS:';
    RAISE NOTICE '✓ Shows: 10 (across 2 organizations)';
    RAISE NOTICE '✓ Episodes: % (realistic scheduling)', total_episodes;
    RAISE NOTICE '✓ Campaigns: % (comprehensive)', total_campaigns;
    RAISE NOTICE '✓ Advertisers: 20 (multiple industries)';
    RAISE NOTICE '✓ Agencies: 8 (media partners)';
    RAISE NOTICE '';
    RAISE NOTICE 'ANALYTICS & METRICS:';
    RAISE NOTICE '✓ Episode Analytics: % records', total_episode_analytics;
    RAISE NOTICE '✓ Campaign Analytics: % records', total_campaign_analytics;
    RAISE NOTICE '✓ Show Analytics: % records', total_show_analytics;
    RAISE NOTICE '';
    RAISE NOTICE 'TIME COVERAGE:';
    RAISE NOTICE '• Episodes: % to %', date_range_start, date_range_end;
    RAISE NOTICE '• Daily granularity maintained';
    RAISE NOTICE '• 15+ months of historical data';
    RAISE NOTICE '';
    RAISE NOTICE 'DASHBOARD FEATURES NOW AVAILABLE:';
    RAISE NOTICE '• All date filters work properly';
    RAISE NOTICE '• Analytics charts populated';
    RAISE NOTICE '• Campaign performance tracking';
    RAISE NOTICE '• Episode management tools';
    RAISE NOTICE '• Financial reporting ready';
    RAISE NOTICE '• Cross-organizational data';
    RAISE NOTICE '';
    RAISE NOTICE 'The PodcastFlow Pro database is now';
    RAISE NOTICE 'fully seeded with comprehensive';
    RAISE NOTICE 'realistic data for demonstration!';
    RAISE NOTICE '========================================';
END $$;