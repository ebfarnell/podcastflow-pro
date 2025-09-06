-- Comprehensive Database Seeding Script for PodcastFlow Pro - CORRECTED VERSION
-- Generates 18 months of realistic data with daily granularity
-- Based on actual database schema and proper foreign key handling

-- Clear existing seed data in proper dependency order
DO $$
DECLARE
    start_date DATE := CURRENT_DATE - INTERVAL '18 months';
    org_podcastflow_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    org_unfy_id TEXT := 'cmd6ntwt00001og415m69qh50';
BEGIN
    RAISE NOTICE 'Starting comprehensive data seeding for 18 months...';
    RAISE NOTICE 'Date range: % to %', start_date, CURRENT_DATE;
    
    -- Delete in proper dependency order to avoid foreign key violations
    DELETE FROM "EpisodeRating" WHERE "episodeId" IN (SELECT id FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%'));
    DELETE FROM "EpisodeAnalytics" WHERE "episodeId" IN (SELECT id FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%'));
    DELETE FROM "ShowAnalytics" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    DELETE FROM "CampaignAnalytics" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE name LIKE 'Seed Campaign%');
    DELETE FROM "AdApproval" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE name LIKE 'Seed Campaign%');
    DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE name LIKE 'Seed Campaign%'));
    DELETE FROM "Order" WHERE "campaignId" IN (SELECT id FROM "Campaign" WHERE name LIKE 'Seed Campaign%');
    DELETE FROM "Campaign" WHERE name LIKE 'Seed Campaign%';
    DELETE FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    DELETE FROM "Show" WHERE name LIKE 'Seed:%';
    DELETE FROM "Advertiser" WHERE name LIKE 'Seed:%';
    DELETE FROM "Agency" WHERE name LIKE 'Seed:%';
    
    RAISE NOTICE 'Cleared existing seed data in proper dependency order';
END $$;

-- PHASE 1: CREATE AGENCIES (8 realistic agencies)
INSERT INTO "Agency" (id, "organizationId", name, website, "contactEmail", "contactPhone", 
                     address, city, state, "zipCode", country, "createdAt", "updatedAt", "isActive")
VALUES 
(gen_random_uuid(), 'cmd2qfeve0000og5y8hfwu795', 'Seed: Waveform Media Group', 'https://waveformmedia.com', 'contact@waveformmedia.com', '+1-555-0101', '123 Media Ave', 'New York', 'NY', '10001', 'US', CURRENT_DATE - INTERVAL '17 months', CURRENT_DATE - INTERVAL '17 months', true),
(gen_random_uuid(), 'cmd2qfeve0000og5y8hfwu795', 'Seed: Podcast Partners Agency', 'https://podcastpartners.co', 'hello@podcastpartners.co', '+1-555-0102', '456 Audio St', 'Los Angeles', 'CA', '90210', 'US', CURRENT_DATE - INTERVAL '16 months', CURRENT_DATE - INTERVAL '16 months', true),
(gen_random_uuid(), 'cmd2qfeve0000og5y8hfwu795', 'Seed: Digital Sound Solutions', 'https://digitalsound.agency', 'info@digitalsound.agency', '+1-555-0103', '789 Broadcast Blvd', 'Chicago', 'IL', '60601', 'US', CURRENT_DATE - INTERVAL '15 months', CURRENT_DATE - INTERVAL '15 months', true),
(gen_random_uuid(), 'cmd2qfeve0000og5y8hfwu795', 'Seed: Amplify Marketing', 'https://amplifymarketing.com', 'team@amplifymarketing.com', '+1-555-0104', '321 Creative Circle', 'Austin', 'TX', '73301', 'US', CURRENT_DATE - INTERVAL '14 months', CURRENT_DATE - INTERVAL '14 months', true),
(gen_random_uuid(), 'cmd6ntwt00001og415m69qh50', 'Seed: NextGen Audio Agency', 'https://nextgenaudio.com', 'hello@nextgenaudio.com', '+1-555-0106', '987 Future Way', 'San Francisco', 'CA', '94102', 'US', CURRENT_DATE - INTERVAL '13 months', CURRENT_DATE - INTERVAL '13 months', true),
(gen_random_uuid(), 'cmd6ntwt00001og415m69qh50', 'Seed: SoundBridge Media', 'https://soundbridge.media', 'contact@soundbridge.media', '+1-555-0107', '147 Bridge St', 'Boston', 'MA', '02101', 'US', CURRENT_DATE - INTERVAL '12 months', CURRENT_DATE - INTERVAL '12 months', true),
(gen_random_uuid(), 'cmd6ntwt00001og415m69qh50', 'Seed: Pinnacle Podcast Group', 'https://pinnaclepodcast.com', 'info@pinnaclepodcast.com', '+1-555-0108', '258 Summit Ave', 'Denver', 'CO', '80201', 'US', CURRENT_DATE - INTERVAL '11 months', CURRENT_DATE - INTERVAL '11 months', true),
(gen_random_uuid(), 'cmd6ntwt00001og415m69qh50', 'Seed: Echo Entertainment', 'https://echoentertainment.net', 'contact@echoentertainment.net', '+1-555-0105', '654 Innovation Dr', 'Seattle', 'WA', '98101', 'US', CURRENT_DATE - INTERVAL '10 months', CURRENT_DATE - INTERVAL '10 months', true);

-- PHASE 2: CREATE ADVERTISERS (20 realistic advertisers across various industries)
INSERT INTO "Advertiser" (id, "organizationId", name, "agencyId", website, "contactEmail", "contactPhone", 
                         address, city, state, "zipCode", country, industry, "createdAt", "updatedAt", "isActive")
SELECT 
    gen_random_uuid(),
    org_id,
    advertiser_name,
    (SELECT id FROM "Agency" WHERE "organizationId" = org_id ORDER BY RANDOM() LIMIT 1),
    website,
    contact_email,
    contact_phone,
    address,
    city,
    state,
    zip_code,
    'US',
    industry,
    CURRENT_DATE - INTERVAL '16 months' + (row_number() OVER() * INTERVAL '5 days'),
    CURRENT_DATE - INTERVAL '16 months' + (row_number() OVER() * INTERVAL '5 days'),
    true
FROM (
    VALUES 
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: TechFlow Solutions', 'https://techflow.com', 'ads@techflow.com', '+1-555-1001', '100 Tech Park', 'San Francisco', 'CA', '94103', 'Technology'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: HealthFirst Insurance', 'https://healthfirst.com', 'marketing@healthfirst.com', '+1-555-1002', '200 Health Plaza', 'Chicago', 'IL', '60602', 'Healthcare'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: EcoGreen Energy', 'https://ecogreen.energy', 'partnerships@ecogreen.energy', '+1-555-1003', '300 Solar Way', 'Austin', 'TX', '73302', 'Energy'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: FoodieBox Delivery', 'https://foodiebox.com', 'advertising@foodiebox.com', '+1-555-1004', '400 Culinary St', 'New York', 'NY', '10002', 'Food & Beverage'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: SmartHome Tech', 'https://smarthome.tech', 'media@smarthome.tech', '+1-555-1005', '500 Innovation Blvd', 'Seattle', 'WA', '98102', 'Technology'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: FlexFit Gym Chain', 'https://flexfit.gym', 'promotions@flexfit.gym', '+1-555-1006', '600 Fitness Ave', 'Miami', 'FL', '33101', 'Fitness & Health'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: CloudSync Software', 'https://cloudsync.app', 'growth@cloudsync.app', '+1-555-1007', '700 Cloud Dr', 'Denver', 'CO', '80202', 'Technology'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: GreenThumb Gardening', 'https://greenthumb.garden', 'outreach@greenthumb.garden', '+1-555-1008', '800 Garden Path', 'Portland', 'OR', '97201', 'Home & Garden'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: CryptoSecure Wallet', 'https://cryptosecure.wallet', 'partnerships@cryptosecure.wallet', '+1-555-1009', '900 Blockchain Blvd', 'Los Angeles', 'CA', '90211', 'Financial Services'),
    ('cmd2qfeve0000og5y8hfwu795', 'Seed: PetCare Plus', 'https://petcareplus.vet', 'marketing@petcareplus.vet', '+1-555-1010', '1000 Pet Way', 'Nashville', 'TN', '37201', 'Pet Care'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: StudyBuddy Online', 'https://studybuddy.online', 'ads@studybuddy.online', '+1-555-1011', '1100 Education St', 'Boston', 'MA', '02102', 'Education'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: AdventureGear Co', 'https://adventuregear.co', 'sponsorship@adventuregear.co', '+1-555-1012', '1200 Outdoor Way', 'Boulder', 'CO', '80301', 'Outdoor & Sports'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: TravelEasy Booking', 'https://traveleasy.booking', 'media@traveleasy.booking', '+1-555-1013', '1300 Travel Ln', 'Las Vegas', 'NV', '89101', 'Travel & Tourism'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: CodeCraft Academy', 'https://codecraft.academy', 'outreach@codecraft.academy', '+1-555-1014', '1400 Code Campus', 'San Jose', 'CA', '95101', 'Education'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: WellnessWorks Supplements', 'https://wellnessworks.com', 'partnerships@wellnessworks.com', '+1-555-1015', '1500 Wellness Blvd', 'Phoenix', 'AZ', '85001', 'Health & Wellness'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: FastTrack Logistics', 'https://fasttrack.logistics', 'advertising@fasttrack.logistics', '+1-555-1016', '1600 Shipping Dr', 'Atlanta', 'GA', '30301', 'Logistics'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: StyleHub Fashion', 'https://stylehub.fashion', 'collabs@stylehub.fashion', '+1-555-1017', '1700 Fashion Ave', 'New York', 'NY', '10003', 'Fashion & Retail'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: CleanSlate Cleaning', 'https://cleanslate.services', 'marketing@cleanslate.services', '+1-555-1018', '1800 Clean Way', 'Dallas', 'TX', '75201', 'Services'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: MindfulMoments App', 'https://mindfulmoments.app', 'growth@mindfulmoments.app', '+1-555-1019', '1900 Meditation Ln', 'San Diego', 'CA', '92101', 'Mental Health'),
    ('cmd6ntwt00001og415m69qh50', 'Seed: AutoCare Express', 'https://autocare.express', 'ads@autocare.express', '+1-555-1020', '2000 Auto Blvd', 'Detroit', 'MI', '48201', 'Automotive')
) AS advertisers(org_id, advertiser_name, website, contact_email, contact_phone, address, city, state, zip_code, industry);

-- PHASE 3: CREATE SHOWS (10 realistic shows with different genres and schedules)
INSERT INTO "Show" (id, "organizationId", name, description, category, host, 
                   "releaseFrequency", "isActive", "createdAt", "updatedAt",
                   "preRollCpm", "midRollCpm", "postRollCpm", "preRollSlots", "midRollSlots", "postRollSlots")
VALUES 
(gen_random_uuid(), 'cmd2qfeve0000og5y8hfwu795', 'Seed: The Tech Talk Weekly', 'Your weekly dose of technology news, product reviews, and industry insights from Silicon Valley and beyond.', 'Technology', 'Alex Chen & Sarah Kim', 'weekly', true, CURRENT_DATE - INTERVAL '15 months', CURRENT_DATE - INTERVAL '15 months', 28.50, 42.75, 22.30, 1, 2, 1),
(gen_random_uuid(), 'cmd2qfeve0000og5y8hfwu795', 'Seed: Business Breakthrough', 'Interviews with successful entrepreneurs and business leaders sharing strategies for growth.', 'Business', 'Michael Rodriguez', 'bi-weekly', true, CURRENT_DATE - INTERVAL '14 months', CURRENT_DATE - INTERVAL '14 months', 32.00, 48.50, 24.75, 1, 2, 1),
(gen_random_uuid(), 'cmd2qfeve0000og5y8hfwu795', 'Seed: Wellness Warriors', 'Exploring mental health, fitness, nutrition with expert guests and practical tips.', 'Health', 'Dr. Lisa Thompson & Jenny Martinez', 'twice-weekly', true, CURRENT_DATE - INTERVAL '13 months', CURRENT_DATE - INTERVAL '13 months', 30.25, 45.80, 21.90, 1, 2, 1),
(gen_random_uuid(), 'cmd2qfeve0000og5y8hfwu795', 'Seed: Creative Minds', 'Conversations with artists, designers, writers about their craft and creative process.', 'Arts', 'David Wilson', 'weekly', true, CURRENT_DATE - INTERVAL '12 months', CURRENT_DATE - INTERVAL '12 months', 26.75, 39.60, 20.15, 1, 2, 1),
(gen_random_uuid(), 'cmd2qfeve0000og5y8hfwu795', 'Seed: Science Today', 'Latest scientific discoveries explained in accessible language for curious minds.', 'Science', 'Dr. Peter Brown', 'weekly', true, CURRENT_DATE - INTERVAL '11 months', CURRENT_DATE - INTERVAL '11 months', 29.80, 44.20, 23.50, 1, 2, 1),
(gen_random_uuid(), 'cmd6ntwt00001og415m69qh50', 'Seed: Financial Freedom Daily', 'Daily insights on personal finance, investing, and building wealth in bite-sized episodes.', 'Finance', 'Rachel Green', 'daily', true, CURRENT_DATE - INTERVAL '10 months', CURRENT_DATE - INTERVAL '10 months', 35.40, 52.80, 26.70, 1, 2, 1),
(gen_random_uuid(), 'cmd6ntwt00001og415m69qh50', 'Seed: Sports Central', 'Comprehensive sports analysis, game recaps, and player interviews covering major leagues.', 'Sports', 'Tony Ricci & Mark Johnson', 'tri-weekly', true, CURRENT_DATE - INTERVAL '9 months', CURRENT_DATE - INTERVAL '9 months', 33.90, 50.25, 25.60, 1, 2, 1),
(gen_random_uuid(), 'cmd6ntwt00001og415m69qh50', 'Seed: History Uncovered', 'Deep dives into fascinating historical events, figures, and mysteries with engaging storytelling.', 'History', 'Professor Amanda Rodriguez', 'weekly', true, CURRENT_DATE - INTERVAL '8 months', CURRENT_DATE - INTERVAL '8 months', 27.35, 41.10, 21.45, 1, 2, 1),
(gen_random_uuid(), 'cmd6ntwt00001og415m69qh50', 'Seed: Startup Stories', 'Real stories from startup founders about their journey, challenges, failures, and successes.', 'Business', 'Jessica Wang & Carlos Lopez', 'weekly', true, CURRENT_DATE - INTERVAL '7 months', CURRENT_DATE - INTERVAL '7 months', 31.65, 47.30, 24.20, 1, 2, 1),
(gen_random_uuid(), 'cmd6ntwt00001og415m69qh50', 'Seed: Film & Fiction', 'Movie reviews, book discussions, and entertainment industry analysis with passionate hosts.', 'Entertainment', 'Sofia Martinez & Alex Thompson', 'twice-weekly', true, CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE - INTERVAL '6 months', 28.90, 43.45, 22.85, 1, 2, 1);

-- Output summary for Phase 1-3
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
    RAISE NOTICE '=== FOUNDATION DATA CREATED ===';
    RAISE NOTICE 'Successfully created:';
    RAISE NOTICE '- Agencies: %', agency_count;
    RAISE NOTICE '- Advertisers: %', advertiser_count;
    RAISE NOTICE '- Shows: %', show_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for episode and campaign generation...';
END $$;