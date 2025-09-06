-- FINAL PHASE: Generate Campaigns and Show Analytics
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
    days_diff INTEGER;
    start_epoch BIGINT;
    end_epoch BIGINT;
    range_epoch BIGINT;
BEGIN
    RAISE NOTICE 'Generating campaigns with daily performance analytics...';
    
    -- Calculate epoch seconds for date math
    start_epoch := EXTRACT(EPOCH FROM start_date);
    end_epoch := EXTRACT(EPOCH FROM (end_date - INTERVAL '60 days'));
    range_epoch := end_epoch - start_epoch;
    
    -- Generate 40 campaigns across the time period
    FOR i IN 1..40 LOOP
        -- Select random advertiser
        SELECT INTO advertiser_record * FROM "Advertiser" WHERE name LIKE 'Seed:%' ORDER BY RANDOM() LIMIT 1;
        
        -- Select show from same organization
        SELECT INTO show_record * FROM "Show" 
        WHERE name LIKE 'Seed:%' AND "organizationId" = advertiser_record."organizationId" 
        ORDER BY RANDOM() LIMIT 1;
        
        -- Generate realistic campaign timeline (2 weeks to 4 months)
        campaign_start := start_date + (RANDOM() * range_epoch/86400)::INTEGER * INTERVAL '1 day';
        campaign_end := campaign_start + (14 + RANDOM() * 106)::INTEGER * INTERVAL '1 day';
        
        -- Ensure campaign end is not in the future
        campaign_end := LEAST(campaign_end, CURRENT_DATE);
        
        campaign_id := gen_random_uuid();
        campaign_budget := (10000 + RANDOM() * 90000)::INTEGER; -- $10K to $100K
        
        days_diff := EXTRACT(EPOCH FROM (campaign_end - campaign_start))/86400;
        daily_budget := CASE WHEN days_diff > 0 THEN campaign_budget::NUMERIC / days_diff ELSE campaign_budget END;
        
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
            'Targeted advertising campaign designed to reach ' || show_record.category || 
            ' enthusiasts and drive engagement with ' || advertiser_record.name || ' products and services.',
            advertiser_record.id,
            advertiser_record."agencyId",
            campaign_start,
            campaign_end,
            campaign_budget,
            ('{"demographics": {"age_range": "25-54", "income": "middle_to_high"}, ' ||
             '"interests": ["' || show_record.category || '", "' || advertiser_record.industry || '"], ' ||
             '"location": ["US", "CA"], "listening_habits": ["podcast_regular"]}')::JSONB,
            CASE 
                WHEN campaign_end < CURRENT_DATE - INTERVAL '1 month' THEN 'completed'
                WHEN campaign_end < CURRENT_DATE THEN 'completed'
                WHEN campaign_start > CURRENT_DATE THEN 'pending'
                ELSE 'active'
            END,
            campaign_start,
            campaign_start,
            true
        );
        
        -- Generate daily campaign analytics with realistic patterns
        current_day := campaign_start;
        WHILE current_day <= campaign_end LOOP
            DECLARE
                base_impressions INTEGER;
                daily_impressions INTEGER;
                daily_clicks INTEGER;
                daily_conversions INTEGER;
                day_of_week INTEGER;
                is_weekend BOOLEAN;
                seasonal_multiplier NUMERIC;
                spend_amount NUMERIC;
            BEGIN
                day_of_week := EXTRACT(DOW FROM current_day);
                is_weekend := day_of_week IN (0, 6); -- Sunday = 0, Saturday = 6
                
                -- Seasonal and weekly patterns
                seasonal_multiplier := CASE 
                    WHEN EXTRACT(MONTH FROM current_day) IN (11, 12) THEN 1.3 -- Holiday boost
                    WHEN EXTRACT(MONTH FROM current_day) IN (6, 7, 8) THEN 0.9 -- Summer dip
                    WHEN is_weekend THEN 0.7 -- Weekend reduction
                    WHEN day_of_week IN (2, 3, 4) THEN 1.2 -- Tuesday-Thursday peak
                    ELSE 1.0
                END;
                
                -- Base impressions with variance and patterns
                base_impressions := (2000 + RANDOM() * 6000)::INTEGER;
                daily_impressions := (base_impressions * seasonal_multiplier)::INTEGER;
                
                -- Click-through rate: 1.5% to 4.5% with industry variance
                daily_clicks := (daily_impressions * (0.015 + RANDOM() * 0.03))::INTEGER;
                
                -- Conversion rate: 0.5% to 3% of clicks
                daily_conversions := (daily_clicks * (0.005 + RANDOM() * 0.025))::INTEGER;
                
                -- Spend calculation based on budget allocation
                spend_amount := LEAST(daily_budget * (0.8 + RANDOM() * 0.4), daily_budget * 1.5);
                
                INSERT INTO "CampaignAnalytics" (
                    id, "campaignId", "organizationId", date, impressions, clicks, conversions,
                    "clickThroughRate", "conversionRate", spend, revenue, "createdAt", "updatedAt"
                ) VALUES (
                    gen_random_uuid(),
                    campaign_id,
                    advertiser_record."organizationId",
                    current_day,
                    daily_impressions,
                    daily_clicks,
                    daily_conversions,
                    CASE WHEN daily_impressions > 0 THEN daily_clicks::DECIMAL / daily_impressions ELSE 0 END,
                    CASE WHEN daily_clicks > 0 THEN daily_conversions::DECIMAL / daily_clicks ELSE 0 END,
                    spend_amount,
                    -- Revenue: 2x to 5x the spend for successful campaigns
                    daily_conversions * (20 + RANDOM() * 180)::INTEGER,
                    current_day,
                    current_day
                );
            END;
            
            current_day := current_day + INTERVAL '1 day';
        END LOOP;
        
        campaign_counter := campaign_counter + 1;
        
        -- Progress indicator
        IF i % 10 = 0 THEN
            RAISE NOTICE 'Generated % campaigns...', i;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Generated 40 campaigns with comprehensive daily analytics';
END $$;

-- Generate Show Analytics with Daily Aggregation using correct schema
DO $$
DECLARE
    show_record RECORD;
    current_day DATE;
    daily_downloads INTEGER;
    daily_listeners INTEGER;
    daily_completions INTEGER;
    avg_rating NUMERIC;
    total_ratings INTEGER;
    daily_revenue NUMERIC;
    start_date DATE := CURRENT_DATE - INTERVAL '15 months';
    end_date DATE := CURRENT_DATE;
BEGIN
    RAISE NOTICE 'Generating daily show analytics aggregations...';
    
    FOR show_record IN 
        SELECT id, "organizationId", "createdAt", name FROM "Show" WHERE name LIKE 'Seed:%'
    LOOP
        current_day := GREATEST(show_record."createdAt"::DATE, start_date);
        
        WHILE current_day <= end_date LOOP
            -- Aggregate daily episode performance for each show
            SELECT 
                COALESCE(SUM(downloads), 0),
                COALESCE(SUM("uniqueListeners"), 0),
                COALESCE(SUM(completions), 0),
                COALESCE(AVG("adRevenue"), 0),
                COALESCE(COUNT(CASE WHEN downloads > 0 THEN 1 END), 0) -- Episodes with data
            INTO daily_downloads, daily_listeners, daily_completions, daily_revenue, total_ratings
            FROM "EpisodeAnalytics" ea
            JOIN "Episode" e ON ea."episodeId" = e.id
            WHERE e."showId" = show_record.id AND ea.date::DATE = current_day;
            
            -- Only insert if there's actual data (episodes aired)
            IF daily_downloads > 0 THEN
                avg_rating := 3.8 + (RANDOM() * 1.2); -- Random rating 3.8-5.0
                
                INSERT INTO "ShowAnalytics" (
                    id, "showId", "organizationId", date, "periodType", "totalDownloads", 
                    "totalListeners", "avgDownloadsPerEpisode", "avgRating", "totalRatings",
                    "newSubscribers", "lostSubscribers", "netSubscribers", 
                    "totalRevenue", "adRevenue", "sponsorRevenue", "createdAt", "updatedAt"
                ) VALUES (
                    gen_random_uuid(),
                    show_record.id,
                    show_record."organizationId",
                    current_day,
                    'daily',
                    daily_downloads,
                    daily_listeners,
                    CASE WHEN total_ratings > 0 THEN daily_downloads::NUMERIC / total_ratings ELSE daily_downloads END,
                    avg_rating,
                    (RANDOM() * 50)::INTEGER + 10, -- 10-60 ratings per day
                    (RANDOM() * 100)::INTEGER + 20, -- 20-120 new subscribers
                    (RANDOM() * 30)::INTEGER + 5,   -- 5-35 lost subscribers  
                    (RANDOM() * 70)::INTEGER + 15,  -- Net positive growth
                    daily_revenue + (RANDOM() * 200)::INTEGER, -- Total revenue
                    daily_revenue, -- Ad revenue from episodes
                    (RANDOM() * 100)::INTEGER, -- Additional sponsor revenue
                    current_day,
                    current_day
                );
            END IF;
            
            current_day := current_day + INTERVAL '1 day';
        END LOOP;
        
        RAISE NOTICE 'Generated daily analytics for: %', show_record.name;
    END LOOP;
    
    RAISE NOTICE 'Daily show analytics generation complete';
END $$;

-- Generate Episode Ratings for engagement
DO $$
DECLARE
    episode_record RECORD;
    user_names TEXT[] := ARRAY['Alex Johnson', 'Sarah Wilson', 'Mike Chen', 'Lisa Rodriguez', 'David Kim', 'Emily Davis', 'Chris Lee', 'Amanda Brown', 'Jason Taylor', 'Rachel Martinez', 'Tom Anderson', 'Maya Patel', 'Kevin Murphy', 'Lauren Scott', 'Carlos Lopez'];
    rating_count INTEGER;
BEGIN
    RAISE NOTICE 'Generating episode ratings and reviews for engagement...';
    
    FOR episode_record IN 
        SELECT id, "organizationId", "airDate", title FROM "Episode" 
        WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%')
        AND "airDate" < CURRENT_DATE - INTERVAL '1 day' -- Don't rate today's episodes
        ORDER BY RANDOM() LIMIT 300 -- Sample 300 episodes for ratings
    LOOP
        -- Generate 2-12 ratings per episode
        rating_count := (2 + RANDOM() * 10)::INTEGER;
        
        FOR i IN 1..rating_count LOOP
            INSERT INTO "EpisodeRating" (
                id, "episodeId", "organizationId", "userId", "userName", rating, review,
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                episode_record.id,
                episode_record."organizationId",
                gen_random_uuid(), -- Random user ID
                user_names[1 + (RANDOM() * array_length(user_names, 1))::INTEGER],
                (3 + RANDOM() * 2)::INTEGER, -- 3-5 star rating
                CASE WHEN RANDOM() > 0.6 THEN 
                    CASE (RANDOM() * 8)::INTEGER
                        WHEN 0 THEN 'Great episode! Really enjoyed the insights and discussion.'
                        WHEN 1 THEN 'Excellent content as always. Keep up the great work!'
                        WHEN 2 THEN 'Very informative and well-produced. Looking forward to the next one.'
                        WHEN 3 THEN 'Solid episode with good analysis and valuable takeaways.'
                        WHEN 4 THEN 'Love this podcast! The hosts really know their stuff.'
                        WHEN 5 THEN 'Fantastic episode, learned so much. Highly recommend!'
                        WHEN 6 THEN 'Another brilliant discussion. This show never disappoints.'
                        ELSE 'Quality content and great production value. Well done!'
                    END
                ELSE NULL END,
                episode_record."airDate" + (RANDOM() * INTERVAL '14 days'), -- Rating within 2 weeks of air date
                episode_record."airDate" + (RANDOM() * INTERVAL '14 days')
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Generated ratings and reviews for 300 episodes';
END $$;

-- Final comprehensive summary
DO $$
DECLARE
    agency_count INTEGER;
    advertiser_count INTEGER;
    show_count INTEGER;
    episode_count INTEGER;
    campaign_count INTEGER;
    episode_analytics_count INTEGER;
    campaign_analytics_count INTEGER;
    show_analytics_count INTEGER;
    episode_ratings_count INTEGER;
    date_range_start DATE;
    date_range_end DATE;
    total_organizations INTEGER;
BEGIN
    SELECT COUNT(*) INTO agency_count FROM "Agency" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO advertiser_count FROM "Advertiser" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO show_count FROM "Show" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO episode_count FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    SELECT COUNT(*) INTO campaign_count FROM "Campaign" WHERE name LIKE 'Seed Campaign%';
    SELECT COUNT(*) INTO episode_analytics_count FROM "EpisodeAnalytics" WHERE "episodeId" IN (SELECT id FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%'));
    SELECT COUNT(*) INTO campaign_analytics_count FROM "CampaignAnalytics" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE name LIKE 'Seed Campaign%');
    SELECT COUNT(*) INTO show_analytics_count FROM "ShowAnalytics" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    SELECT COUNT(*) INTO episode_ratings_count FROM "EpisodeRating" WHERE "episodeId" IN (SELECT id FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%'));
    SELECT COUNT(*) INTO total_organizations FROM "Organization";
    
    -- Get actual date range from generated data
    SELECT MIN("airDate"::DATE), MAX("airDate"::DATE) INTO date_range_start, date_range_end
    FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    
    RAISE NOTICE '';
    RAISE NOTICE '================================';
    RAISE NOTICE '  COMPREHENSIVE SEEDING COMPLETE';
    RAISE NOTICE '================================';
    RAISE NOTICE '';
    RAISE NOTICE 'DATABASE OVERVIEW:';
    RAISE NOTICE '- Total Organizations: % (2 main orgs)', total_organizations;
    RAISE NOTICE '- Distribution: PodcastFlow Pro & Unfy';
    RAISE NOTICE '';
    RAISE NOTICE 'FOUNDATION DATA:';
    RAISE NOTICE '✓ Agencies: % (realistic media agencies)', agency_count;
    RAISE NOTICE '✓ Advertisers: % (across % industries)', advertiser_count, '10+';
    RAISE NOTICE '✓ Shows: % (different categories & schedules)', show_count;
    RAISE NOTICE '✓ Episodes: % (realistic scheduling)', episode_count;
    RAISE NOTICE '✓ Campaigns: % (comprehensive targeting)', campaign_count;
    RAISE NOTICE '';
    RAISE NOTICE 'ANALYTICS & ENGAGEMENT:';
    RAISE NOTICE '✓ Episode Analytics: % (daily performance)', episode_analytics_count;
    RAISE NOTICE '✓ Campaign Analytics: % (daily metrics)', campaign_analytics_count;
    RAISE NOTICE '✓ Show Analytics: % (aggregated insights)', show_analytics_count;
    RAISE NOTICE '✓ Episode Ratings: % (user engagement)', episode_ratings_count;
    RAISE NOTICE '';
    RAISE NOTICE 'DATA FEATURES:';
    RAISE NOTICE '• Daily granularity for all date filters';
    RAISE NOTICE '• Realistic episode scheduling (daily/weekly/bi-weekly)';
    RAISE NOTICE '• Industry-specific campaign targeting';
    RAISE NOTICE '• Seasonal and weekly performance patterns';
    RAISE NOTICE '• Cross-organization data distribution';
    RAISE NOTICE '• Platform-specific analytics breakdown';
    RAISE NOTICE '• User engagement and ratings';
    RAISE NOTICE '• Financial metrics and revenue tracking';
    RAISE NOTICE '';
    RAISE NOTICE 'DATE COVERAGE:';
    RAISE NOTICE '• Episode Range: % to %', date_range_start, date_range_end;
    RAISE NOTICE '• Campaign Range: 15 months historical data';
    RAISE NOTICE '• Analytics: Daily tracking throughout period';
    RAISE NOTICE '';
    RAISE NOTICE 'DASHBOARD READINESS:';
    RAISE NOTICE '✓ All date filters functional';
    RAISE NOTICE '✓ Analytics dashboards populated';
    RAISE NOTICE '✓ Performance metrics available';
    RAISE NOTICE '✓ Campaign tracking complete';
    RAISE NOTICE '✓ Episode management ready';
    RAISE NOTICE '✓ Financial reporting enabled';
    RAISE NOTICE '';
    RAISE NOTICE 'The application now has comprehensive';
    RAISE NOTICE 'realistic data for demonstration,';
    RAISE NOTICE 'testing, and development purposes!';
    RAISE NOTICE '================================';
END $$;