-- PHASE 4: Generate Episodes with Daily Scheduling Based on Release Frequency
DO $$
DECLARE
    show_record RECORD;
    episode_date DATE;
    episode_number INTEGER;
    episode_id TEXT;
    episode_duration INTEGER;
    end_date DATE := CURRENT_DATE;
    dow INTEGER; -- day of week
BEGIN
    RAISE NOTICE 'Generating episodes with realistic scheduling for each show...';
    
    -- Loop through each seeded show
    FOR show_record IN 
        SELECT id, name, "organizationId", "releaseFrequency", "createdAt"
        FROM "Show" 
        WHERE name LIKE 'Seed:%'
        ORDER BY "createdAt"
    LOOP
        episode_number := 1;
        episode_date := show_record."createdAt"::DATE;
        
        RAISE NOTICE 'Generating episodes for: % (% schedule)', show_record.name, show_record."releaseFrequency";
        
        -- Generate episodes based on release frequency
        WHILE episode_date <= end_date LOOP
            episode_id := gen_random_uuid();
            
            -- Realistic episode durations based on show type
            episode_duration := CASE 
                WHEN show_record."releaseFrequency" = 'daily' THEN 900 + (RANDOM() * 600)::INTEGER  -- 15-25 minutes
                WHEN show_record.name LIKE '%Sports%' THEN 2700 + (RANDOM() * 1800)::INTEGER      -- 45-75 minutes
                WHEN show_record.name LIKE '%History%' THEN 3300 + (RANDOM() * 2100)::INTEGER     -- 55-90 minutes
                ELSE 1800 + (RANDOM() * 1800)::INTEGER  -- 30-60 minutes for most shows
            END;
            
            INSERT INTO "Episode" (
                id, "showId", "organizationId", title, description, "episodeNumber", 
                duration, "airDate", status, "createdAt", "updatedAt", "isActive"
            ) VALUES (
                episode_id,
                show_record.id,
                show_record."organizationId",
                'Episode ' || episode_number || ': ' || 
                CASE 
                    WHEN show_record.name LIKE '%Tech%' THEN 'Latest Tech Trends and Innovations'
                    WHEN show_record.name LIKE '%Business%' THEN 'Strategic Business Insights'
                    WHEN show_record.name LIKE '%Wellness%' THEN 'Health and Wellness Deep Dive'
                    WHEN show_record.name LIKE '%Creative%' THEN 'Spotlight on Creative Excellence'
                    WHEN show_record.name LIKE '%Science%' THEN 'Scientific Discoveries Explored'
                    WHEN show_record.name LIKE '%Financial%' THEN 'Market Analysis and Investment Tips'
                    WHEN show_record.name LIKE '%Sports%' THEN 'Game Analysis and Player Updates'
                    WHEN show_record.name LIKE '%History%' THEN 'Historical Events Uncovered'
                    WHEN show_record.name LIKE '%Startup%' THEN 'Entrepreneurial Journey Stories'
                    WHEN show_record.name LIKE '%Film%' THEN 'Entertainment Industry Insights'
                    ELSE 'Weekly Discussion and Analysis'
                END,
                'An engaging episode featuring expert insights, audience Q&A, and comprehensive coverage of the latest developments in our field.',
                episode_number,
                episode_duration,
                episode_date,
                'published',
                episode_date,
                episode_date,
                true
            );
            
            -- Generate realistic episode analytics with daily variance
            INSERT INTO "EpisodeAnalytics" (
                id, "episodeId", "organizationId", date, downloads, listeners, 
                "completionRate", "averageListenTime", "platformBreakdown", "countryBreakdown",
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                episode_id,
                show_record."organizationId",
                episode_date,
                -- Higher downloads for newer episodes, with random variance
                (1500 + RANDOM() * 8500 + 
                 CASE WHEN episode_date > CURRENT_DATE - INTERVAL '3 months' THEN 2000 ELSE 0 END)::INTEGER,
                -- 70-85% of downloads convert to listeners
                ((1500 + RANDOM() * 8500) * (0.70 + RANDOM() * 0.15))::INTEGER,
                -- Completion rate 55-90%, higher for shorter episodes
                CASE WHEN episode_duration < 1800 THEN 0.70 + (RANDOM() * 0.20) 
                     ELSE 0.55 + (RANDOM() * 0.25) END,
                -- Average listen time correlated with episode duration and completion rate
                (episode_duration * (0.40 + RANDOM() * 0.40))::INTEGER,
                '{"apple_podcasts": 42, "spotify": 33, "google_podcasts": 12, "overcast": 6, "pocket_casts": 4, "other": 3}'::JSONB,
                '{"US": 68, "CA": 12, "UK": 8, "AU": 4, "DE": 3, "other": 5}'::JSONB,
                episode_date,
                episode_date
            );
            
            episode_number := episode_number + 1;
            
            -- Calculate next episode date based on release frequency
            CASE show_record."releaseFrequency"
                WHEN 'daily' THEN 
                    -- Skip weekends for daily shows (Monday-Friday only)
                    episode_date := episode_date + INTERVAL '1 day';
                    dow := EXTRACT(DOW FROM episode_date);
                    IF dow = 0 THEN episode_date := episode_date + INTERVAL '1 day'; END IF; -- Skip Sunday
                    IF dow = 6 THEN episode_date := episode_date + INTERVAL '2 days'; END IF; -- Skip Saturday
                    
                WHEN 'twice-weekly' THEN 
                    -- Tuesday and Friday releases
                    dow := EXTRACT(DOW FROM episode_date);
                    IF dow = 2 THEN -- Tuesday
                        episode_date := episode_date + INTERVAL '3 days'; -- Next Friday
                    ELSE -- Friday or other
                        episode_date := episode_date + INTERVAL '4 days'; -- Next Tuesday
                        IF EXTRACT(DOW FROM episode_date) != 2 THEN
                            episode_date := episode_date + INTERVAL '1 day'; -- Adjust to Tuesday
                        END IF;
                    END IF;
                    
                WHEN 'tri-weekly' THEN 
                    -- Monday, Wednesday, Friday releases
                    dow := EXTRACT(DOW FROM episode_date);
                    IF dow = 1 THEN -- Monday
                        episode_date := episode_date + INTERVAL '2 days'; -- Wednesday
                    ELSIF dow = 3 THEN -- Wednesday
                        episode_date := episode_date + INTERVAL '2 days'; -- Friday
                    ELSE -- Friday or other
                        episode_date := episode_date + INTERVAL '3 days'; -- Next Monday
                        -- Ensure it's Monday
                        WHILE EXTRACT(DOW FROM episode_date) != 1 LOOP
                            episode_date := episode_date + INTERVAL '1 day';
                        END LOOP;
                    END IF;
                    
                WHEN 'weekly' THEN 
                    episode_date := episode_date + INTERVAL '7 days';
                    
                WHEN 'bi-weekly' THEN 
                    episode_date := episode_date + INTERVAL '14 days';
                    
                ELSE 
                    episode_date := episode_date + INTERVAL '7 days'; -- Default weekly
            END CASE;
        END LOOP;
        
        RAISE NOTICE 'Generated % episodes for %', episode_number - 1, show_record.name;
    END LOOP;
    
    RAISE NOTICE 'Episode generation complete for all shows';
END $$;

-- PHASE 5: Generate Campaigns with Daily Performance Data
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
    daily_budget INTEGER;
    start_date DATE := CURRENT_DATE - INTERVAL '15 months';
    end_date DATE := CURRENT_DATE;
BEGIN
    RAISE NOTICE 'Generating campaigns with daily performance analytics...';
    
    -- Generate 40 campaigns across the time period
    FOR i IN 1..40 LOOP
        -- Select random advertiser
        SELECT INTO advertiser_record * FROM "Advertiser" WHERE name LIKE 'Seed:%' ORDER BY RANDOM() LIMIT 1;
        
        -- Select show from same organization
        SELECT INTO show_record * FROM "Show" 
        WHERE name LIKE 'Seed:%' AND "organizationId" = advertiser_record."organizationId" 
        ORDER BY RANDOM() LIMIT 1;
        
        -- Generate realistic campaign timeline (2 weeks to 4 months)
        campaign_start := start_date + (RANDOM() * (end_date - start_date - INTERVAL '60 days'))::INTEGER * INTERVAL '1 day';
        campaign_end := campaign_start + (14 + RANDOM() * 106)::INTEGER * INTERVAL '1 day';
        
        -- Ensure campaign end is not in the future
        campaign_end := LEAST(campaign_end, CURRENT_DATE);
        
        campaign_id := gen_random_uuid();
        campaign_budget := (10000 + RANDOM() * 90000)::INTEGER; -- $10K to $100K
        daily_budget := campaign_budget / GREATEST(1, campaign_end - campaign_start);
        
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

-- PHASE 6: Generate Show Analytics with Daily Aggregation
DO $$
DECLARE
    show_record RECORD;
    current_day DATE;
    daily_downloads INTEGER;
    daily_listeners INTEGER;
    rating NUMERIC;
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
                COALESCE(SUM(listeners), 0),
                COALESCE(AVG(4.0 + RANDOM() * 1.0), 4.2) -- Random rating 4.0-5.0
            INTO daily_downloads, daily_listeners, rating
            FROM "EpisodeAnalytics" ea
            JOIN "Episode" e ON ea."episodeId" = e.id
            WHERE e."showId" = show_record.id AND ea.date = current_day;
            
            -- Only insert if there's actual data (episodes aired)
            IF daily_downloads > 0 THEN
                INSERT INTO "ShowAnalytics" (
                    id, "showId", "organizationId", period, "periodStart", "periodEnd",
                    "totalDownloads", "totalListeners", "averageRating", "totalEpisodes",
                    "createdAt", "updatedAt"
                ) VALUES (
                    gen_random_uuid(),
                    show_record.id,
                    show_record."organizationId",
                    'daily',
                    current_day,
                    current_day,
                    daily_downloads,
                    daily_listeners,
                    rating,
                    (SELECT COUNT(*) FROM "Episode" WHERE "showId" = show_record.id AND "airDate"::DATE = current_day),
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

-- Final Summary
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
BEGIN
    SELECT COUNT(*) INTO agency_count FROM "Agency" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO advertiser_count FROM "Advertiser" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO show_count FROM "Show" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO episode_count FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    SELECT COUNT(*) INTO campaign_count FROM "Campaign" WHERE name LIKE 'Seed Campaign%';
    SELECT COUNT(*) INTO episode_analytics_count FROM "EpisodeAnalytics" WHERE "episodeId" IN (SELECT id FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%'));
    SELECT COUNT(*) INTO campaign_analytics_count FROM "CampaignAnalytics" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE name LIKE 'Seed Campaign%');
    SELECT COUNT(*) INTO show_analytics_count FROM "ShowAnalytics" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    
    RAISE NOTICE '';
    RAISE NOTICE '=== COMPREHENSIVE SEEDING COMPLETE ===';
    RAISE NOTICE 'Successfully created realistic 18-month dataset:';
    RAISE NOTICE '';
    RAISE NOTICE 'Core Data:';
    RAISE NOTICE '- Agencies: %', agency_count;
    RAISE NOTICE '- Advertisers: %', advertiser_count;
    RAISE NOTICE '- Shows: %', show_count;
    RAISE NOTICE '- Episodes: %', episode_count;
    RAISE NOTICE '- Campaigns: %', campaign_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Analytics Data:';
    RAISE NOTICE '- Episode Analytics Records: %', episode_analytics_count;
    RAISE NOTICE '- Campaign Analytics Records: %', campaign_analytics_count;
    RAISE NOTICE '- Show Analytics Records: %', show_analytics_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Data Features:';
    RAISE NOTICE '- Daily granularity for all date filters';
    RAISE NOTICE '- Realistic episode scheduling by frequency';
    RAISE NOTICE '- Industry-specific campaign targeting';
    RAISE NOTICE '- Seasonal and weekly performance patterns';
    RAISE NOTICE '- Cross-organization data distribution';
    RAISE NOTICE '';
    RAISE NOTICE 'Time Range: % to %', CURRENT_DATE - INTERVAL '15 months', CURRENT_DATE;
    RAISE NOTICE 'All date filters and analytics should now work properly!';
END $$;