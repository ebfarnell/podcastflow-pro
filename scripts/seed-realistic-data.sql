-- Comprehensive Database Seeding Script for PodcastFlow Pro
-- Generates 18 months of realistic data with daily granularity
-- Based on real podcast industry patterns and Megaphone integration capabilities

-- Set up date ranges for 18 months of data
DO $$
DECLARE
    start_date DATE := CURRENT_DATE - INTERVAL '18 months';
    end_date DATE := CURRENT_DATE;
    current_date DATE;
    org_podcastflow_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    org_unfy_id TEXT := 'cmd6ntwt00001og415m69qh50';
    show_counter INTEGER := 1;
    episode_counter INTEGER := 1;
    campaign_counter INTEGER := 1;
    advertiser_counter INTEGER := 1;
    agency_counter INTEGER := 1;
BEGIN
    RAISE NOTICE 'Starting comprehensive data seeding for 18 months...';
    
    -- First, clear existing test data to avoid conflicts
    DELETE FROM "EpisodeAnalytics" WHERE "episodeId" IN (SELECT id FROM "Episode" WHERE "createdAt" > start_date);
    DELETE FROM "ShowAnalytics" WHERE "showId" IN (SELECT id FROM "Show" WHERE "createdAt" > start_date);
    DELETE FROM "CampaignAnalytics" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE "createdAt" > start_date);
    DELETE FROM "Order" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE "createdAt" > start_date);
    DELETE FROM "Episode" WHERE "createdAt" > start_date;
    DELETE FROM "Campaign" WHERE "createdAt" > start_date;
    DELETE FROM "Show" WHERE "createdAt" > start_date AND "name" LIKE 'Seed:%';
    DELETE FROM "Advertiser" WHERE "createdAt" > start_date AND "name" LIKE 'Seed:%';
    DELETE FROM "Agency" WHERE "createdAt" > start_date AND "name" LIKE 'Seed:%';
    
    RAISE NOTICE 'Cleared existing seed data';

    -- PHASE 1: CREATE AGENCIES (15 realistic agencies)
    INSERT INTO "Agency" (id, "organizationId", name, website, email, phone, "contactPerson", 
                         address, city, state, "zipCode", country, "createdAt", "updatedAt", "isActive")
    VALUES 
    (gen_random_uuid(), org_podcastflow_id, 'Seed: Waveform Media Group', 'https://waveformmedia.com', 'contact@waveformmedia.com', '+1-555-0101', 'Sarah Martinez', '123 Media Ave', 'New York', 'NY', '10001', 'US', start_date + INTERVAL '1 day', start_date + INTERVAL '1 day', true),
    (gen_random_uuid(), org_podcastflow_id, 'Seed: Podcast Partners Agency', 'https://podcastpartners.co', 'hello@podcastpartners.co', '+1-555-0102', 'Michael Chen', '456 Audio St', 'Los Angeles', 'CA', '90210', 'US', start_date + INTERVAL '2 days', start_date + INTERVAL '2 days', true),
    (gen_random_uuid(), org_podcastflow_id, 'Seed: Digital Sound Solutions', 'https://digitalsound.agency', 'info@digitalsound.agency', '+1-555-0103', 'Jennifer Lopez', '789 Broadcast Blvd', 'Chicago', 'IL', '60601', 'US', start_date + INTERVAL '3 days', start_date + INTERVAL '3 days', true),
    (gen_random_uuid(), org_podcastflow_id, 'Seed: Amplify Marketing', 'https://amplifymarketing.com', 'team@amplifymarketing.com', '+1-555-0104', 'David Wilson', '321 Creative Circle', 'Austin', 'TX', '73301', 'US', start_date + INTERVAL '4 days', start_date + INTERVAL '4 days', true),
    (gen_random_uuid(), org_podcastflow_id, 'Seed: Echo Entertainment', 'https://echoentertainment.net', 'contact@echoentertainment.net', '+1-555-0105', 'Lisa Thompson', '654 Innovation Dr', 'Seattle', 'WA', '98101', 'US', start_date + INTERVAL '5 days', start_date + INTERVAL '5 days', true),
    (gen_random_uuid(), org_unfy_id, 'Seed: NextGen Audio Agency', 'https://nextgenaudio.com', 'hello@nextgenaudio.com', '+1-555-0106', 'Robert Kim', '987 Future Way', 'San Francisco', 'CA', '94102', 'US', start_date + INTERVAL '6 days', start_date + INTERVAL '6 days', true),
    (gen_random_uuid(), org_unfy_id, 'Seed: SoundBridge Media', 'https://soundbridge.media', 'contact@soundbridge.media', '+1-555-0107', 'Amanda Rodriguez', '147 Bridge St', 'Boston', 'MA', '02101', 'US', start_date + INTERVAL '7 days', start_date + INTERVAL '7 days', true),
    (gen_random_uuid(), org_unfy_id, 'Seed: Pinnacle Podcast Group', 'https://pinnaclepodcast.com', 'info@pinnaclepodcast.com', '+1-555-0108', 'James Anderson', '258 Summit Ave', 'Denver', 'CO', '80201', 'US', start_date + INTERVAL '8 days', start_date + INTERVAL '8 days', true);

    RAISE NOTICE 'Created 8 realistic agencies';

    -- PHASE 2: CREATE ADVERTISERS (25 realistic advertisers across various industries)
    INSERT INTO "Advertiser" (id, "organizationId", name, "agencyId", website, email, phone, 
                             "contactPerson", address, city, state, "zipCode", country, industry,
                             "createdAt", "updatedAt", "isActive")
    SELECT 
        gen_random_uuid(),
        CASE WHEN row_number() OVER() % 2 = 0 THEN org_podcastflow_id ELSE org_unfy_id END,
        advertiser_name,
        (SELECT id FROM "Agency" WHERE "organizationId" = CASE WHEN row_number() OVER() % 2 = 0 THEN org_podcastflow_id ELSE org_unfy_id END ORDER BY RANDOM() LIMIT 1),
        website,
        email,
        phone,
        contact_person,
        address,
        city,
        state,
        zip_code,
        'US',
        industry,
        start_date + (row_number() OVER() * INTERVAL '1 day'),
        start_date + (row_number() OVER() * INTERVAL '1 day'),
        true
    FROM (
        VALUES 
        ('Seed: TechFlow Solutions', 'https://techflow.com', 'ads@techflow.com', '+1-555-1001', 'Emily Davis', '100 Tech Park', 'San Francisco', 'CA', '94103', 'Technology'),
        ('Seed: HealthFirst Insurance', 'https://healthfirst.com', 'marketing@healthfirst.com', '+1-555-1002', 'Mark Johnson', '200 Health Plaza', 'Chicago', 'IL', '60602', 'Healthcare'),
        ('Seed: EcoGreen Energy', 'https://ecogreen.energy', 'partnerships@ecogreen.energy', '+1-555-1003', 'Rachel Green', '300 Solar Way', 'Austin', 'TX', '73302', 'Energy'),
        ('Seed: FoodieBox Delivery', 'https://foodiebox.com', 'advertising@foodiebox.com', '+1-555-1004', 'Tony Ricci', '400 Culinary St', 'New York', 'NY', '10002', 'Food & Beverage'),
        ('Seed: SmartHome Tech', 'https://smarthome.tech', 'media@smarthome.tech', '+1-555-1005', 'Jessica Wang', '500 Innovation Blvd', 'Seattle', 'WA', '98102', 'Technology'),
        ('Seed: FlexFit Gym Chain', 'https://flexfit.gym', 'promotions@flexfit.gym', '+1-555-1006', 'Carlos Rodriguez', '600 Fitness Ave', 'Miami', 'FL', '33101', 'Fitness & Health'),
        ('Seed: CloudSync Software', 'https://cloudsync.app', 'growth@cloudsync.app', '+1-555-1007', 'Anna Chen', '700 Cloud Dr', 'Denver', 'CO', '80202', 'Technology'),
        ('Seed: GreenThumb Gardening', 'https://greenthumb.garden', 'outreach@greenthumb.garden', '+1-555-1008', 'Peter Brown', '800 Garden Path', 'Portland', 'OR', '97201', 'Home & Garden'),
        ('Seed: CryptoSecure Wallet', 'https://cryptosecure.wallet', 'partnerships@cryptosecure.wallet', '+1-555-1009', 'Maya Patel', '900 Blockchain Blvd', 'Los Angeles', 'CA', '90211', 'Financial Services'),
        ('Seed: PetCare Plus', 'https://petcareplus.vet', 'marketing@petcareplus.vet', '+1-555-1010', 'Dr. Kevin Murphy', '1000 Pet Way', 'Nashville', 'TN', '37201', 'Pet Care'),
        ('Seed: StudyBuddy Online', 'https://studybuddy.online', 'ads@studybuddy.online', '+1-555-1011', 'Lauren Kim', '1100 Education St', 'Boston', 'MA', '02102', 'Education'),
        ('Seed: AdventureGear Co', 'https://adventuregear.co', 'sponsorship@adventuregear.co', '+1-555-1012', 'Jake Mitchell', '1200 Outdoor Way', 'Boulder', 'CO', '80301', 'Outdoor & Sports'),
        ('Seed: TravelEasy Booking', 'https://traveleasy.booking', 'media@traveleasy.booking', '+1-555-1013', 'Sofia Martinez', '1300 Travel Ln', 'Las Vegas', 'NV', '89101', 'Travel & Tourism'),
        ('Seed: CodeCraft Academy', 'https://codecraft.academy', 'outreach@codecraft.academy', '+1-555-1014', 'Alex Thompson', '1400 Code Campus', 'San Jose', 'CA', '95101', 'Education'),
        ('Seed: WellnessWorks Supplements', 'https://wellnessworks.com', 'partnerships@wellnessworks.com', '+1-555-1015', 'Dr. Sarah Lee', '1500 Wellness Blvd', 'Phoenix', 'AZ', '85001', 'Health & Wellness'),
        ('Seed: FastTrack Logistics', 'https://fasttrack.logistics', 'advertising@fasttrack.logistics', '+1-555-1016', 'Mike Anderson', '1600 Shipping Dr', 'Atlanta', 'GA', '30301', 'Logistics'),
        ('Seed: StyleHub Fashion', 'https://stylehub.fashion', 'collabs@stylehub.fashion', '+1-555-1017', 'Isabella Rodriguez', '1700 Fashion Ave', 'New York', 'NY', '10003', 'Fashion & Retail'),
        ('Seed: CleanSlate Cleaning', 'https://cleanslate.services', 'marketing@cleanslate.services', '+1-555-1018', 'Daniel Wilson', '1800 Clean Way', 'Dallas', 'TX', '75201', 'Services'),
        ('Seed: MindfulMoments App', 'https://mindfulmoments.app', 'growth@mindfulmoments.app', '+1-555-1019', 'Samantha Liu', '1900 Meditation Ln', 'San Diego', 'CA', '92101', 'Mental Health'),
        ('Seed: AutoCare Express', 'https://autocare.express', 'ads@autocare.express', '+1-555-1020', 'Robert Taylor', '2000 Auto Blvd', 'Detroit', 'MI', '48201', 'Automotive'),
        ('Seed: GamerGear Pro', 'https://gamergear.pro', 'sponsorships@gamergear.pro', '+1-555-1021', 'Ashley Chen', '2100 Gaming St', 'Los Angeles', 'CA', '90212', 'Gaming & Tech'),
        ('Seed: BakeFresh Artisan', 'https://bakefresh.artisan', 'marketing@bakefresh.artisan', '+1-555-1022', 'Marco Rossi', '2200 Bakery Way', 'Portland', 'OR', '97202', 'Food & Beverage'),
        ('Seed: SecureVault Finance', 'https://securevault.finance', 'partnerships@securevault.finance', '+1-555-1023', 'Jennifer Park', '2300 Financial Dr', 'Charlotte', 'NC', '28201', 'Financial Services'),
        ('Seed: EcoHome Building', 'https://ecohome.build', 'outreach@ecohome.build', '+1-555-1024', 'Chris Johnson', '2400 Green Building Way', 'Seattle', 'WA', '98103', 'Construction'),
        ('Seed: StreamlineHR Solutions', 'https://streamlinehr.com', 'growth@streamlinehr.com', '+1-555-1025', 'Nicole Davis', '2500 HR Plaza', 'Minneapolis', 'MN', '55401', 'Business Services')
    ) AS advertisers(advertiser_name, website, email, phone, contact_person, address, city, state, zip_code, industry);

    RAISE NOTICE 'Created 25 realistic advertisers across various industries';

    -- PHASE 3: CREATE SHOWS (12 realistic shows with different genres and schedules)
    INSERT INTO "Show" (id, "organizationId", name, description, category, "hostName", "contactEmail", 
                       "releaseSchedule", "episodeDuration", "isActive", "createdAt", "updatedAt")
    VALUES 
    (gen_random_uuid(), org_podcastflow_id, 'Seed: The Tech Talk Weekly', 'Your weekly dose of technology news, product reviews, and industry insights from Silicon Valley and beyond.', 'Technology', 'Alex Chen & Sarah Kim', 'alex@techtalkweekly.com', 'weekly', 45, true, start_date + INTERVAL '1 week', start_date + INTERVAL '1 week'),
    (gen_random_uuid(), org_podcastflow_id, 'Seed: Business Breakthrough', 'Interviews with successful entrepreneurs and business leaders sharing their strategies for growth and innovation.', 'Business', 'Michael Rodriguez', 'michael@businessbreakthrough.com', 'bi-weekly', 35, true, start_date + INTERVAL '2 weeks', start_date + INTERVAL '2 weeks'),
    (gen_random_uuid(), org_podcastflow_id, 'Seed: Wellness Warriors', 'Exploring mental health, fitness, nutrition, and overall wellness with expert guests and practical tips.', 'Health', 'Dr. Lisa Thompson & Jenny Martinez', 'contact@wellnesswarriors.com', 'twice-weekly', 25, true, start_date + INTERVAL '3 weeks', start_date + INTERVAL '3 weeks'),
    (gen_random_uuid(), org_podcastflow_id, 'Seed: Creative Minds', 'Conversations with artists, designers, writers, and creative professionals about their craft and creative process.', 'Arts', 'David Wilson', 'david@creativeminds.show', 'weekly', 40, true, start_date + INTERVAL '4 weeks', start_date + INTERVAL '4 weeks'),
    (gen_random_uuid(), org_unfy_id, 'Seed: Financial Freedom Daily', 'Daily insights on personal finance, investing, and building wealth, delivered in bite-sized episodes.', 'Finance', 'Rachel Green', 'rachel@financialfreedom.daily', 'daily', 15, true, start_date + INTERVAL '5 weeks', start_date + INTERVAL '5 weeks'),
    (gen_random_uuid(), org_unfy_id, 'Seed: Sports Central', 'Comprehensive sports analysis, game recaps, and player interviews covering NFL, NBA, MLB, and more.', 'Sports', 'Tony Ricci & Mark Johnson', 'hosts@sportscentral.podcast', 'tri-weekly', 50, true, start_date + INTERVAL '6 weeks', start_date + INTERVAL '6 weeks'),
    (gen_random_uuid(), org_unfy_id, 'Seed: History Uncovered', 'Deep dives into fascinating historical events, figures, and mysteries with engaging storytelling.', 'History', 'Professor Amanda Rodriguez', 'amanda@historyuncovered.edu', 'weekly', 55, true, start_date + INTERVAL '7 weeks', start_date + INTERVAL '7 weeks'),
    (gen_random_uuid(), org_unfy_id, 'Seed: Startup Stories', 'Real stories from startup founders about their journey, challenges, failures, and successes.', 'Business', 'Jessica Wang & Carlos Lopez', 'team@startupstories.vc', 'weekly', 30, true, start_date + INTERVAL '8 weeks', start_date + INTERVAL '8 weeks'),
    (gen_random_uuid(), org_podcastflow_id, 'Seed: Science Today', 'Latest scientific discoveries and research explained in accessible language for curious minds.', 'Science', 'Dr. Peter Brown', 'peter@sciencetoday.lab', 'weekly', 35, true, start_date + INTERVAL '9 weeks', start_date + INTERVAL '9 weeks'),
    (gen_random_uuid(), org_podcastflow_id, 'Seed: Travel Tales', 'Travel stories, destination guides, and cultural insights from travelers around the world.', 'Travel', 'Maya Patel & Jake Mitchell', 'hosts@traveltales.world', 'bi-weekly', 40, true, start_date + INTERVAL '10 weeks', start_date + INTERVAL '10 weeks'),
    (gen_random_uuid(), org_unfy_id, 'Seed: Parenting Plus', 'Practical parenting advice, child development insights, and family life tips for modern parents.', 'Family', 'Lauren Kim & Dr. Kevin Murphy', 'support@parentingplus.family', 'weekly', 25, true, start_date + INTERVAL '11 weeks', start_date + INTERVAL '11 weeks'),
    (gen_random_uuid(), org_unfy_id, 'Seed: Film & Fiction', 'Movie reviews, book discussions, and entertainment industry analysis with passionate hosts.', 'Entertainment', 'Sofia Martinez & Alex Thompson', 'reviews@filmfiction.media', 'twice-weekly', 45, true, start_date + INTERVAL '12 weeks', start_date + INTERVAL '12 weeks');

    RAISE NOTICE 'Created 12 diverse podcast shows';

END $$;

-- PHASE 4: Generate Episodes with Daily Data
DO $$
DECLARE
    show_record RECORD;
    current_date DATE;
    episode_date DATE;
    days_between INTEGER;
    episode_count INTEGER;
    start_date DATE := CURRENT_DATE - INTERVAL '18 months';
    end_date DATE := CURRENT_DATE;
    episode_id TEXT;
    episode_number INTEGER;
BEGIN
    RAISE NOTICE 'Generating episodes with daily data for each show...';
    
    -- Loop through each show
    FOR show_record IN 
        SELECT id, name, "releaseSchedule", "organizationId", "createdAt"
        FROM "Show" 
        WHERE name LIKE 'Seed:%'
    LOOP
        episode_number := 1;
        episode_date := show_record."createdAt"::DATE;
        
        -- Generate episodes based on release schedule
        WHILE episode_date <= end_date LOOP
            episode_id := gen_random_uuid();
            
            INSERT INTO "Episode" (
                id, "showId", "organizationId", title, description, "episodeNumber", 
                duration, "airDate", status, "createdAt", "updatedAt", "isActive"
            ) VALUES (
                episode_id,
                show_record.id,
                show_record."organizationId",
                CASE 
                    WHEN show_record."releaseSchedule" = 'daily' THEN 'Episode ' || episode_number || ': Daily Market Update'
                    WHEN show_record."releaseSchedule" = 'weekly' THEN 'Episode ' || episode_number || ': Weekly Deep Dive'
                    WHEN show_record."releaseSchedule" = 'bi-weekly' THEN 'Episode ' || episode_number || ': Bi-Weekly Analysis'
                    WHEN show_record."releaseSchedule" = 'twice-weekly' THEN 'Episode ' || episode_number || ': Semi-Weekly Discussion'
                    WHEN show_record."releaseSchedule" = 'tri-weekly' THEN 'Episode ' || episode_number || ': Tri-Weekly Coverage'
                    ELSE 'Episode ' || episode_number
                END,
                'A comprehensive episode covering the latest topics and insights relevant to our audience.',
                episode_number,
                CASE 
                    WHEN show_record."releaseSchedule" = 'daily' THEN 900 + (RANDOM() * 600)::INTEGER  -- 15-25 minutes
                    ELSE 1800 + (RANDOM() * 1800)::INTEGER  -- 30-60 minutes
                END,
                episode_date,
                'published',
                episode_date,
                episode_date,
                true
            );
            
            -- Generate episode analytics for each episode
            INSERT INTO "EpisodeAnalytics" (
                id, "episodeId", "organizationId", date, downloads, listeners, 
                "completionRate", "averageListenTime", "platformBreakdown", "countryBreakdown",
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                episode_id,
                show_record."organizationId",
                episode_date,
                (1000 + RANDOM() * 9000)::INTEGER,  -- 1K-10K downloads
                (800 + RANDOM() * 7200)::INTEGER,   -- 80% of downloads as listeners
                0.60 + (RANDOM() * 0.35),          -- 60-95% completion rate
                (600 + RANDOM() * 1200)::INTEGER,   -- 10-30 minutes average listen time
                '{"apple_podcasts": 45, "spotify": 30, "google_podcasts": 15, "other": 10}'::JSONB,
                '{"US": 70, "CA": 10, "UK": 8, "AU": 5, "other": 7}'::JSONB,
                episode_date,
                episode_date
            );
            
            -- Increment episode number
            episode_number := episode_number + 1;
            
            -- Calculate next episode date based on schedule
            CASE show_record."releaseSchedule"
                WHEN 'daily' THEN 
                    episode_date := episode_date + INTERVAL '1 day';
                WHEN 'twice-weekly' THEN 
                    -- Tuesday and Friday
                    IF EXTRACT(DOW FROM episode_date) = 2 THEN -- Tuesday
                        episode_date := episode_date + INTERVAL '3 days'; -- Friday
                    ELSE -- Friday
                        episode_date := episode_date + INTERVAL '4 days'; -- Next Tuesday
                    END IF;
                WHEN 'tri-weekly' THEN 
                    -- Monday, Wednesday, Friday
                    IF EXTRACT(DOW FROM episode_date) = 1 THEN -- Monday
                        episode_date := episode_date + INTERVAL '2 days'; -- Wednesday
                    ELSIF EXTRACT(DOW FROM episode_date) = 3 THEN -- Wednesday
                        episode_date := episode_date + INTERVAL '2 days'; -- Friday
                    ELSE -- Friday
                        episode_date := episode_date + INTERVAL '3 days'; -- Next Monday
                    END IF;
                WHEN 'weekly' THEN 
                    episode_date := episode_date + INTERVAL '7 days';
                WHEN 'bi-weekly' THEN 
                    episode_date := episode_date + INTERVAL '14 days';
                ELSE 
                    episode_date := episode_date + INTERVAL '7 days';
            END CASE;
        END LOOP;
        
        RAISE NOTICE 'Generated % episodes for show: %', episode_number - 1, show_record.name;
    END LOOP;
    
    RAISE NOTICE 'Completed episode generation for all shows';
END $$;

-- PHASE 5: Generate Campaigns with Daily Performance Data
DO $$
DECLARE
    advertiser_record RECORD;
    show_record RECORD;
    campaign_start DATE;
    campaign_end DATE;
    campaign_id TEXT;
    current_date DATE;
    daily_impressions INTEGER;
    daily_clicks INTEGER;
    daily_conversions INTEGER;
    start_date DATE := CURRENT_DATE - INTERVAL '18 months';
    end_date DATE := CURRENT_DATE;
    campaign_counter INTEGER := 1;
BEGIN
    RAISE NOTICE 'Generating campaigns with daily performance data...';
    
    -- Generate 50 campaigns across the 18-month period
    FOR i IN 1..50 LOOP
        -- Select random advertiser and show
        SELECT INTO advertiser_record * FROM "Advertiser" WHERE name LIKE 'Seed:%' ORDER BY RANDOM() LIMIT 1;
        SELECT INTO show_record * FROM "Show" WHERE name LIKE 'Seed:%' AND "organizationId" = advertiser_record."organizationId" ORDER BY RANDOM() LIMIT 1;
        
        -- Generate realistic campaign dates
        campaign_start := start_date + (RANDOM() * (end_date - start_date - INTERVAL '30 days'))::INTEGER * INTERVAL '1 day';
        campaign_end := campaign_start + (7 + RANDOM() * 83)::INTEGER * INTERVAL '1 day'; -- 1 week to 3 months
        
        campaign_id := gen_random_uuid();
        
        -- Create campaign
        INSERT INTO "Campaign" (
            id, "organizationId", name, description, "advertiserId", "agencyId", 
            "startDate", "endDate", budget, "targetAudience", status, 
            "createdAt", "updatedAt", "isActive"
        ) VALUES (
            campaign_id,
            advertiser_record."organizationId",
            'Seed Campaign ' || campaign_counter || ': ' || advertiser_record.name || ' on ' || show_record.name,
            'Strategic advertising campaign targeting ' || show_record.category || ' audience',
            advertiser_record.id,
            advertiser_record."agencyId",
            campaign_start,
            campaign_end,
            (5000 + RANDOM() * 95000)::INTEGER, -- $5K to $100K budget
            '{"age_range": "25-45", "interests": ["' || show_record.category || '"], "location": ["US", "CA"]}',
            CASE WHEN campaign_end < CURRENT_DATE THEN 'completed' ELSE 'active' END,
            campaign_start,
            campaign_start,
            true
        );
        
        -- Generate daily campaign analytics
        current_date := campaign_start;
        WHILE current_date <= LEAST(campaign_end, CURRENT_DATE) LOOP
            -- Realistic daily performance metrics
            daily_impressions := (1000 + RANDOM() * 9000)::INTEGER;
            daily_clicks := (daily_impressions * (0.02 + RANDOM() * 0.08))::INTEGER; -- 2-10% CTR
            daily_conversions := (daily_clicks * (0.01 + RANDOM() * 0.09))::INTEGER; -- 1-10% conversion rate
            
            INSERT INTO "CampaignAnalytics" (
                id, "campaignId", "organizationId", date, impressions, clicks, conversions,
                "clickThroughRate", "conversionRate", spend, revenue, "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                campaign_id,
                advertiser_record."organizationId",
                current_date,
                daily_impressions,
                daily_clicks,
                daily_conversions,
                CASE WHEN daily_impressions > 0 THEN daily_clicks::DECIMAL / daily_impressions ELSE 0 END,
                CASE WHEN daily_clicks > 0 THEN daily_conversions::DECIMAL / daily_clicks ELSE 0 END,
                (50 + RANDOM() * 450)::INTEGER, -- $50-500 daily spend
                daily_conversions * (10 + RANDOM() * 90)::INTEGER, -- $10-100 per conversion
                current_date,
                current_date
            );
            
            current_date := current_date + INTERVAL '1 day';
        END LOOP;
        
        campaign_counter := campaign_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Generated 50 campaigns with daily performance data';
END $$;

-- PHASE 6: Generate Show Analytics with Daily Data
DO $$
DECLARE
    show_record RECORD;
    current_date DATE;
    start_date DATE := CURRENT_DATE - INTERVAL '18 months';
    end_date DATE := CURRENT_DATE;
BEGIN
    RAISE NOTICE 'Generating daily show analytics...';
    
    FOR show_record IN 
        SELECT id, "organizationId", "createdAt" FROM "Show" WHERE name LIKE 'Seed:%'
    LOOP
        current_date := show_record."createdAt"::DATE;
        
        WHILE current_date <= end_date LOOP
            INSERT INTO "ShowAnalytics" (
                id, "showId", "organizationId", period, "periodStart", "periodEnd",
                "totalDownloads", "totalListeners", "averageRating", "totalEpisodes",
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                show_record.id,
                show_record."organizationId",
                'daily',
                current_date,
                current_date,
                (500 + RANDOM() * 4500)::INTEGER,  -- 500-5000 daily downloads
                (400 + RANDOM() * 3600)::INTEGER,  -- 400-4000 daily listeners
                3.5 + (RANDOM() * 1.5),           -- 3.5-5.0 rating
                1,                                 -- 1 episode per day average
                current_date,
                current_date
            );
            
            current_date := current_date + INTERVAL '1 day';
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Generated daily show analytics for all shows';
END $$;

-- PHASE 7: Generate Episode Ratings and Reviews
DO $$
DECLARE
    episode_record RECORD;
    user_names TEXT[] := ARRAY['Alex Johnson', 'Sarah Wilson', 'Mike Chen', 'Lisa Rodriguez', 'David Kim', 'Emily Davis', 'Chris Lee', 'Amanda Brown', 'Jason Taylor', 'Rachel Martinez'];
    rating_count INTEGER;
BEGIN
    RAISE NOTICE 'Generating episode ratings and reviews...';
    
    FOR episode_record IN 
        SELECT id, "organizationId", "airDate" FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%')
    LOOP
        -- Generate 3-15 ratings per episode
        rating_count := (3 + RANDOM() * 12)::INTEGER;
        
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
                CASE WHEN RANDOM() > 0.7 THEN 
                    CASE (RANDOM() * 5)::INTEGER
                        WHEN 0 THEN 'Great episode! Really enjoyed the insights and discussion.'
                        WHEN 1 THEN 'Excellent content as always. Keep up the great work!'
                        WHEN 2 THEN 'Very informative and well-produced. Looking forward to the next one.'
                        WHEN 3 THEN 'Solid episode with good guest interviews and valuable takeaways.'
                        ELSE 'Love this podcast! The hosts really know their stuff.'
                    END
                ELSE NULL END,
                episode_record."airDate" + (RANDOM() * INTERVAL '7 days'),
                episode_record."airDate" + (RANDOM() * INTERVAL '7 days')
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Generated ratings and reviews for all episodes';
END $$;

-- Final Summary
DO $$
DECLARE
    agency_count INTEGER;
    advertiser_count INTEGER;
    show_count INTEGER;
    episode_count INTEGER;
    campaign_count INTEGER;
    analytics_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO agency_count FROM "Agency" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO advertiser_count FROM "Advertiser" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO show_count FROM "Show" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO episode_count FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    SELECT COUNT(*) INTO campaign_count FROM "Campaign" WHERE name LIKE 'Seed Campaign%';
    SELECT COUNT(*) INTO analytics_count FROM "EpisodeAnalytics" WHERE "episodeId" IN (SELECT id FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%'));
    
    RAISE NOTICE '';
    RAISE NOTICE '=== SEEDING COMPLETE ===';
    RAISE NOTICE 'Created comprehensive 18-month dataset:';
    RAISE NOTICE '- Agencies: %', agency_count;
    RAISE NOTICE '- Advertisers: %', advertiser_count;
    RAISE NOTICE '- Shows: %', show_count;
    RAISE NOTICE '- Episodes: %', episode_count;
    RAISE NOTICE '- Campaigns: %', campaign_count;
    RAISE NOTICE '- Analytics Records: %', analytics_count;
    RAISE NOTICE '';
    RAISE NOTICE 'All data includes daily granularity for proper date filtering.';
    RAISE NOTICE 'Data spans 18 months from % to %', CURRENT_DATE - INTERVAL '18 months', CURRENT_DATE;
END $$;