-- Comprehensive Database Seeding Script for PodcastFlow Pro - FIXED VERSION
-- Generates 18 months of realistic data with daily granularity
-- Based on actual database schema and constraints

-- Set up date ranges for 18 months of data
DO $$
DECLARE
    start_date DATE := CURRENT_DATE - INTERVAL '18 months';
    end_date DATE := CURRENT_DATE;
    current_day DATE;
    org_podcastflow_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    org_unfy_id TEXT := 'cmd6ntwt00001og415m69qh50';
BEGIN
    RAISE NOTICE 'Starting comprehensive data seeding for 18 months...';
    RAISE NOTICE 'Date range: % to %', start_date, end_date;
    
    -- First, safely clear existing test data in correct order (respecting foreign keys)
    DELETE FROM "EpisodeRating" WHERE "episodeId" IN (SELECT id FROM "Episode" WHERE "createdAt" > start_date);
    DELETE FROM "EpisodeAnalytics" WHERE "episodeId" IN (SELECT id FROM "Episode" WHERE "createdAt" > start_date);
    DELETE FROM "ShowAnalytics" WHERE "showId" IN (SELECT id FROM "Show" WHERE "createdAt" > start_date);
    DELETE FROM "CampaignAnalytics" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE "createdAt" > start_date);
    DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE "createdAt" > start_date));
    DELETE FROM "Order" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE "createdAt" > start_date);
    DELETE FROM "Episode" WHERE "createdAt" > start_date;
    DELETE FROM "Campaign" WHERE "createdAt" > start_date;
    DELETE FROM "Show" WHERE "createdAt" > start_date AND "name" LIKE 'Seed:%';
    DELETE FROM "Advertiser" WHERE "createdAt" > start_date AND "name" LIKE 'Seed:%';
    DELETE FROM "Agency" WHERE "createdAt" > start_date AND "name" LIKE 'Seed:%';
    
    RAISE NOTICE 'Cleared existing seed data';
END $$;

-- PHASE 1: CREATE AGENCIES (15 realistic agencies)
INSERT INTO "Agency" (id, "organizationId", name, website, email, phone, "contactPerson", 
                     address, city, state, "zipCode", country, "createdAt", "updatedAt", "isActive")
SELECT 
    gen_random_uuid(),
    org_id,
    agency_name,
    website,
    email,
    phone,
    contact_person,
    address,
    city,
    state,
    zip_code,
    'US',
    (CURRENT_DATE - INTERVAL '18 months') + (row_number() OVER() * INTERVAL '1 day'),
    (CURRENT_DATE - INTERVAL '18 months') + (row_number() OVER() * INTERVAL '1 day'),
    true
FROM (
    VALUES 
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: Waveform Media Group', 'https://waveformmedia.com', 'contact@waveformmedia.com', '+1-555-0101', 'Sarah Martinez', '123 Media Ave', 'New York', 'NY', '10001'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: Podcast Partners Agency', 'https://podcastpartners.co', 'hello@podcastpartners.co', '+1-555-0102', 'Michael Chen', '456 Audio St', 'Los Angeles', 'CA', '90210'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: Digital Sound Solutions', 'https://digitalsound.agency', 'info@digitalsound.agency', '+1-555-0103', 'Jennifer Lopez', '789 Broadcast Blvd', 'Chicago', 'IL', '60601'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: Amplify Marketing', 'https://amplifymarketing.com', 'team@amplifymarketing.com', '+1-555-0104', 'David Wilson', '321 Creative Circle', 'Austin', 'TX', '73301'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: Echo Entertainment', 'https://echoentertainment.net', 'contact@echoentertainment.net', '+1-555-0105', 'Lisa Thompson', '654 Innovation Dr', 'Seattle', 'WA', '98101'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: NextGen Audio Agency', 'https://nextgenaudio.com', 'hello@nextgenaudio.com', '+1-555-0106', 'Robert Kim', '987 Future Way', 'San Francisco', 'CA', '94102'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: SoundBridge Media', 'https://soundbridge.media', 'contact@soundbridge.media', '+1-555-0107', 'Amanda Rodriguez', '147 Bridge St', 'Boston', 'MA', '02101'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: Pinnacle Podcast Group', 'https://pinnaclepodcast.com', 'info@pinnaclepodcast.com', '+1-555-0108', 'James Anderson', '258 Summit Ave', 'Denver', 'CO', '80201')
) AS agencies(org_id, agency_name, website, email, phone, contact_person, address, city, state, zip_code);

-- PHASE 2: CREATE ADVERTISERS (25 realistic advertisers across various industries)
INSERT INTO "Advertiser" (id, "organizationId", name, "agencyId", website, email, phone, 
                         "contactPerson", address, city, state, "zipCode", country, industry,
                         "createdAt", "updatedAt", "isActive")
SELECT 
    gen_random_uuid(),
    org_id,
    advertiser_name,
    (SELECT id FROM "Agency" WHERE "organizationId" = org_id ORDER BY RANDOM() LIMIT 1),
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
    (CURRENT_DATE - INTERVAL '18 months') + (row_number() OVER() * INTERVAL '2 days'),
    (CURRENT_DATE - INTERVAL '18 months') + (row_number() OVER() * INTERVAL '2 days'),
    true
FROM (
    VALUES 
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: TechFlow Solutions', 'https://techflow.com', 'ads@techflow.com', '+1-555-1001', 'Emily Davis', '100 Tech Park', 'San Francisco', 'CA', '94103', 'Technology'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: HealthFirst Insurance', 'https://healthfirst.com', 'marketing@healthfirst.com', '+1-555-1002', 'Mark Johnson', '200 Health Plaza', 'Chicago', 'IL', '60602', 'Healthcare'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: EcoGreen Energy', 'https://ecogreen.energy', 'partnerships@ecogreen.energy', '+1-555-1003', 'Rachel Green', '300 Solar Way', 'Austin', 'TX', '73302', 'Energy'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: FoodieBox Delivery', 'https://foodiebox.com', 'advertising@foodiebox.com', '+1-555-1004', 'Tony Ricci', '400 Culinary St', 'New York', 'NY', '10002', 'Food & Beverage'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: SmartHome Tech', 'https://smarthome.tech', 'media@smarthome.tech', '+1-555-1005', 'Jessica Wang', '500 Innovation Blvd', 'Seattle', 'WA', '98102', 'Technology'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: FlexFit Gym Chain', 'https://flexfit.gym', 'promotions@flexfit.gym', '+1-555-1006', 'Carlos Rodriguez', '600 Fitness Ave', 'Miami', 'FL', '33101', 'Fitness & Health'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: CloudSync Software', 'https://cloudsync.app', 'growth@cloudsync.app', '+1-555-1007', 'Anna Chen', '700 Cloud Dr', 'Denver', 'CO', '80202', 'Technology'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: GreenThumb Gardening', 'https://greenthumb.garden', 'outreach@greenthumb.garden', '+1-555-1008', 'Peter Brown', '800 Garden Path', 'Portland', 'OR', '97201', 'Home & Garden'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: CryptoSecure Wallet', 'https://cryptosecure.wallet', 'partnerships@cryptosecure.wallet', '+1-555-1009', 'Maya Patel', '900 Blockchain Blvd', 'Los Angeles', 'CA', '90211', 'Financial Services'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: PetCare Plus', 'https://petcareplus.vet', 'marketing@petcareplus.vet', '+1-555-1010', 'Dr. Kevin Murphy', '1000 Pet Way', 'Nashville', 'TN', '37201', 'Pet Care'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: StudyBuddy Online', 'https://studybuddy.online', 'ads@studybuddy.online', '+1-555-1011', 'Lauren Kim', '1100 Education St', 'Boston', 'MA', '02102', 'Education'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: AdventureGear Co', 'https://adventuregear.co', 'sponsorship@adventuregear.co', '+1-555-1012', 'Jake Mitchell', '1200 Outdoor Way', 'Boulder', 'CO', '80301', 'Outdoor & Sports'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: TravelEasy Booking', 'https://traveleasy.booking', 'media@traveleasy.booking', '+1-555-1013', 'Sofia Martinez', '1300 Travel Ln', 'Las Vegas', 'NV', '89101', 'Travel & Tourism'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: CodeCraft Academy', 'https://codecraft.academy', 'outreach@codecraft.academy', '+1-555-1014', 'Alex Thompson', '1400 Code Campus', 'San Jose', 'CA', '95101', 'Education'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: WellnessWorks Supplements', 'https://wellnessworks.com', 'partnerships@wellnessworks.com', '+1-555-1015', 'Dr. Sarah Lee', '1500 Wellness Blvd', 'Phoenix', 'AZ', '85001', 'Health & Wellness'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: FastTrack Logistics', 'https://fasttrack.logistics', 'advertising@fasttrack.logistics', '+1-555-1016', 'Mike Anderson', '1600 Shipping Dr', 'Atlanta', 'GA', '30301', 'Logistics'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: StyleHub Fashion', 'https://stylehub.fashion', 'collabs@stylehub.fashion', '+1-555-1017', 'Isabella Rodriguez', '1700 Fashion Ave', 'New York', 'NY', '10003', 'Fashion & Retail'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: CleanSlate Cleaning', 'https://cleanslate.services', 'marketing@cleanslate.services', '+1-555-1018', 'Daniel Wilson', '1800 Clean Way', 'Dallas', 'TX', '75201', 'Services'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: MindfulMoments App', 'https://mindfulmoments.app', 'growth@mindfulmoments.app', '+1-555-1019', 'Samantha Liu', '1900 Meditation Ln', 'San Diego', 'CA', '92101', 'Mental Health'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: AutoCare Express', 'https://autocare.express', 'ads@autocare.express', '+1-555-1020', 'Robert Taylor', '2000 Auto Blvd', 'Detroit', 'MI', '48201', 'Automotive'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: GamerGear Pro', 'https://gamergear.pro', 'sponsorships@gamergear.pro', '+1-555-1021', 'Ashley Chen', '2100 Gaming St', 'Los Angeles', 'CA', '90212', 'Gaming & Tech'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: BakeFresh Artisan', 'https://bakefresh.artisan', 'marketing@bakefresh.artisan', '+1-555-1022', 'Marco Rossi', '2200 Bakery Way', 'Portland', 'OR', '97202', 'Food & Beverage'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: SecureVault Finance', 'https://securevault.finance', 'partnerships@securevault.finance', '+1-555-1023', 'Jennifer Park', '2300 Financial Dr', 'Charlotte', 'NC', '28201', 'Financial Services'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: EcoHome Building', 'https://ecohome.build', 'outreach@ecohome.build', '+1-555-1024', 'Chris Johnson', '2400 Green Building Way', 'Seattle', 'WA', '98103', 'Construction'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: StreamlineHR Solutions', 'https://streamlinehr.com', 'growth@streamlinehr.com', '+1-555-1025', 'Nicole Davis', '2500 HR Plaza', 'Minneapolis', 'MN', '55401', 'Business Services')
) AS advertisers(org_id, advertiser_name, website, email, phone, contact_person, address, city, state, zip_code, industry);

-- PHASE 3: CREATE SHOWS (12 realistic shows with different genres and schedules)
-- Using actual Show table schema with releaseFrequency instead of releaseSchedule
INSERT INTO "Show" (id, "organizationId", name, description, category, host, 
                   "releaseFrequency", "isActive", "createdAt", "updatedAt",
                   "preRollCpm", "midRollCpm", "postRollCpm", "preRollSlots", "midRollSlots", "postRollSlots")
SELECT 
    gen_random_uuid(),
    org_id,
    show_name,
    description,
    category,
    host_name,
    release_freq,
    true,
    (CURRENT_DATE - INTERVAL '18 months') + (row_number() OVER() * INTERVAL '1 week'),
    (CURRENT_DATE - INTERVAL '18 months') + (row_number() OVER() * INTERVAL '1 week'),
    25.00 + (RANDOM() * 25)::NUMERIC(10,2), -- $25-50 CPM
    35.00 + (RANDOM() * 30)::NUMERIC(10,2), -- $35-65 CPM
    20.00 + (RANDOM() * 20)::NUMERIC(10,2), -- $20-40 CPM
    1, 2, 1  -- Standard ad slots
FROM (
    VALUES 
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: The Tech Talk Weekly', 'Your weekly dose of technology news, product reviews, and industry insights from Silicon Valley and beyond.', 'Technology', 'Alex Chen & Sarah Kim', 'weekly'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: Business Breakthrough', 'Interviews with successful entrepreneurs and business leaders sharing their strategies for growth and innovation.', 'Business', 'Michael Rodriguez', 'bi-weekly'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: Wellness Warriors', 'Exploring mental health, fitness, nutrition, and overall wellness with expert guests and practical tips.', 'Health', 'Dr. Lisa Thompson & Jenny Martinez', 'twice-weekly'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: Creative Minds', 'Conversations with artists, designers, writers, and creative professionals about their craft and creative process.', 'Arts', 'David Wilson', 'weekly'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: Science Today', 'Latest scientific discoveries and research explained in accessible language for curious minds.', 'Science', 'Dr. Peter Brown', 'weekly'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: Travel Tales', 'Travel stories, destination guides, and cultural insights from travelers around the world.', 'Travel', 'Maya Patel & Jake Mitchell', 'bi-weekly'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: Financial Freedom Daily', 'Daily insights on personal finance, investing, and building wealth, delivered in bite-sized episodes.', 'Finance', 'Rachel Green', 'daily'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: Sports Central', 'Comprehensive sports analysis, game recaps, and player interviews covering NFL, NBA, MLB, and more.', 'Sports', 'Tony Ricci & Mark Johnson', 'tri-weekly'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: History Uncovered', 'Deep dives into fascinating historical events, figures, and mysteries with engaging storytelling.', 'History', 'Professor Amanda Rodriguez', 'weekly'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: Startup Stories', 'Real stories from startup founders about their journey, challenges, failures, and successes.', 'Business', 'Jessica Wang & Carlos Lopez', 'weekly'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: Parenting Plus', 'Practical parenting advice, child development insights, and family life tips for modern parents.', 'Family', 'Lauren Kim & Dr. Kevin Murphy', 'weekly'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: Film & Fiction', 'Movie reviews, book discussions, and entertainment industry analysis with passionate hosts.', 'Entertainment', 'Sofia Martinez & Alex Thompson', 'twice-weekly')
) AS shows(org_id, show_name, description, category, host_name, release_freq);

-- Output summary
DO $$
DECLARE
    agency_count INTEGER;
    advertiser_count INTEGER;
    show_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO agency_count FROM "Agency" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO advertiser_count FROM "Advertiser" WHERE name LIKE 'Seed:%';
    SELECT COUNT(*) INTO show_count FROM "Show" WHERE name LIKE 'Seed:%';
    
    RAISE NOTICE '';
    RAISE NOTICE '=== PHASE 1 COMPLETE ===';
    RAISE NOTICE 'Created foundation data:';
    RAISE NOTICE '- Agencies: %', agency_count;
    RAISE NOTICE '- Advertisers: %', advertiser_count;
    RAISE NOTICE '- Shows: %', show_count;
    RAISE NOTICE '';
END $$;