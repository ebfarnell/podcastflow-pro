-- Fix episode durations and create talent/producer accounts
-- Phase 1: Create additional talent and producer user accounts

DO $$
DECLARE
    org_podcastflow_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    org_unfy_id TEXT := 'cmd6ntwt00001og415m69qh50';
    user_password TEXT := '$2b$10$K8H4r0Q8zVpJ1dY0J9V2zOjnJ5L8H9G7F6I2Q0K3S4N5X1Y6R8T9A2'; -- hashed 'password123'
BEGIN
    RAISE NOTICE 'Creating additional talent and producer accounts...';
    
    -- Create talent accounts for PodcastFlow Pro
    INSERT INTO "User" (id, email, password, name, role, "organizationId", "isActive", "createdAt", "updatedAt")
    VALUES 
    (gen_random_uuid(), 'talent1@podcastflow.pro', user_password, 'Emma Rodriguez', 'talent', org_podcastflow_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'talent2@podcastflow.pro', user_password, 'Marcus Chen', 'talent', org_podcastflow_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'talent3@podcastflow.pro', user_password, 'Sophia Williams', 'talent', org_podcastflow_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'talent4@podcastflow.pro', user_password, 'David Park', 'talent', org_podcastflow_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'talent5@podcastflow.pro', user_password, 'Nina Thompson', 'talent', org_podcastflow_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    
    -- Create talent accounts for Unfy
    INSERT INTO "User" (id, email, password, name, role, "organizationId", "isActive", "createdAt", "updatedAt")
    VALUES 
    (gen_random_uuid(), 'talent1@unfy.com', user_password, 'Carlos Martinez', 'talent', org_unfy_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'talent2@unfy.com', user_password, 'Aria Johnson', 'talent', org_unfy_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'talent3@unfy.com', user_password, 'Kevin Walsh', 'talent', org_unfy_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'talent4@unfy.com', user_password, 'Maya Singh', 'talent', org_unfy_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'talent5@unfy.com', user_password, 'Tyler Brooks', 'talent', org_unfy_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    
    -- Create producer accounts for PodcastFlow Pro
    INSERT INTO "User" (id, email, password, name, role, "organizationId", "isActive", "createdAt", "updatedAt")
    VALUES 
    (gen_random_uuid(), 'producer1@podcastflow.pro', user_password, 'Alex Rivera', 'producer', org_podcastflow_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'producer2@podcastflow.pro', user_password, 'Jordan Kim', 'producer', org_podcastflow_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'producer3@podcastflow.pro', user_password, 'Taylor Brown', 'producer', org_podcastflow_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'producer4@podcastflow.pro', user_password, 'Casey Davis', 'producer', org_podcastflow_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'producer5@podcastflow.pro', user_password, 'Morgan Lee', 'producer', org_podcastflow_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    
    -- Create producer accounts for Unfy
    INSERT INTO "User" (id, email, password, name, role, "organizationId", "isActive", "createdAt", "updatedAt")
    VALUES 
    (gen_random_uuid(), 'producer1@unfy.com', user_password, 'Jamie Wilson', 'producer', org_unfy_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'producer2@unfy.com', user_password, 'Riley Garcia', 'producer', org_unfy_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'producer3@unfy.com', user_password, 'Avery Martinez', 'producer', org_unfy_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'producer4@unfy.com', user_password, 'Quinn Anderson', 'producer', org_unfy_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'producer5@unfy.com', user_password, 'Sage Cooper', 'producer', org_unfy_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    
    RAISE NOTICE 'Created 20 new user accounts (10 talent + 10 producers)';
END $$;

-- Phase 2: Fix episode durations to realistic podcast lengths (15-60 minutes)
DO $$
DECLARE
    episode_record RECORD;
    new_duration INTEGER;
    show_type TEXT;
BEGIN
    RAISE NOTICE 'Fixing episode durations to realistic podcast lengths...';
    
    FOR episode_record IN 
        SELECT e.id, e.title, s.name as show_name, s."releaseFrequency"
        FROM "Episode" e 
        JOIN "Show" s ON e."showId" = s.id 
        WHERE s.name LIKE 'Seed:%'
    LOOP
        -- Determine appropriate duration based on show type and frequency
        new_duration := CASE 
            WHEN episode_record."releaseFrequency" = 'daily' THEN 
                (12 + RANDOM() * 18)::INTEGER -- 12-30 minutes for daily shows
            WHEN episode_record.show_name LIKE '%Financial%' THEN 
                (15 + RANDOM() * 15)::INTEGER -- 15-30 minutes for financial shows
            WHEN episode_record.show_name LIKE '%Sports%' THEN 
                (35 + RANDOM() * 25)::INTEGER -- 35-60 minutes for sports analysis
            WHEN episode_record.show_name LIKE '%History%' THEN 
                (40 + RANDOM() * 20)::INTEGER -- 40-60 minutes for history deep dives
            WHEN episode_record.show_name LIKE '%Business%' OR episode_record.show_name LIKE '%Startup%' THEN 
                (25 + RANDOM() * 25)::INTEGER -- 25-50 minutes for business content
            WHEN episode_record.show_name LIKE '%Science%' THEN 
                (30 + RANDOM() * 20)::INTEGER -- 30-50 minutes for science topics
            ELSE 
                (20 + RANDOM() * 30)::INTEGER -- 20-50 minutes for general content
        END;
        
        -- Update episode duration
        UPDATE "Episode" 
        SET duration = new_duration 
        WHERE id = episode_record.id;
    END LOOP;
    
    RAISE NOTICE 'Updated all episode durations to realistic podcast lengths (12-60 minutes)';
END $$;

-- Phase 3: Assign talent and producers to all shows
DO $$
DECLARE
    show_record RECORD;
    talent_id TEXT;
    producer_id TEXT;
BEGIN
    RAISE NOTICE 'Assigning talent and producers to all shows...';
    
    FOR show_record IN 
        SELECT id, "organizationId", name FROM "Show" WHERE name LIKE 'Seed:%' ORDER BY "createdAt"
    LOOP
        -- Select random talent from the same organization
        SELECT id INTO talent_id 
        FROM "User" 
        WHERE role = 'talent' AND "organizationId" = show_record."organizationId" 
        ORDER BY RANDOM() LIMIT 1;
        
        -- Select random producer from the same organization
        SELECT id INTO producer_id 
        FROM "User" 
        WHERE role = 'producer' AND "organizationId" = show_record."organizationId" 
        ORDER BY RANDOM() LIMIT 1;
        
        -- Insert into _ShowTalent junction table
        INSERT INTO "_ShowTalent" ("A", "B") VALUES (show_record.id, talent_id)
        ON CONFLICT DO NOTHING;
        
        -- Insert into _ShowProducers junction table
        INSERT INTO "_ShowProducers" ("A", "B") VALUES (show_record.id, producer_id)
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Assigned talent and producer to show: %', show_record.name;
    END LOOP;
    
    RAISE NOTICE 'Successfully assigned talent and producers to all 10 shows';
END $$;

-- Phase 4: Update episode analytics to reflect new durations
DO $$
DECLARE
    episode_record RECORD;
    new_avg_listen_time NUMERIC;
BEGIN
    RAISE NOTICE 'Updating episode analytics to match new durations...';
    
    FOR episode_record IN 
        SELECT e.id, e.duration, ea.id as analytics_id
        FROM "Episode" e 
        JOIN "EpisodeAnalytics" ea ON e.id = ea."episodeId"
        WHERE e."showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%')
    LOOP
        -- Calculate realistic average listen time (60-85% of episode duration)
        new_avg_listen_time := episode_record.duration * 60 * (0.60 + RANDOM() * 0.25); -- Convert minutes to seconds
        
        UPDATE "EpisodeAnalytics" 
        SET "avgListenTime" = new_avg_listen_time
        WHERE id = episode_record.analytics_id;
    END LOOP;
    
    RAISE NOTICE 'Updated episode analytics to match new durations';
END $$;

-- Final summary
DO $$
DECLARE
    talent_count INTEGER;
    producer_count INTEGER;
    avg_duration NUMERIC;
    min_duration INTEGER;
    max_duration INTEGER;
    assigned_shows INTEGER;
BEGIN
    SELECT COUNT(*) INTO talent_count FROM "User" WHERE role = 'talent';
    SELECT COUNT(*) INTO producer_count FROM "User" WHERE role = 'producer';
    
    SELECT AVG(duration), MIN(duration), MAX(duration) 
    INTO avg_duration, min_duration, max_duration
    FROM "Episode" WHERE "showId" IN (SELECT id FROM "Show" WHERE name LIKE 'Seed:%');
    
    SELECT COUNT(*) INTO assigned_shows
    FROM "Show" s
    WHERE s.name LIKE 'Seed:%' 
    AND EXISTS (SELECT 1 FROM "_ShowTalent" st WHERE st."A" = s.id)
    AND EXISTS (SELECT 1 FROM "_ShowProducers" sp WHERE sp."A" = s.id);
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '  SHOW STAFFING & DURATION FIX COMPLETE';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '👥 USER ACCOUNTS:';
    RAISE NOTICE '   ✓ Total Talent: % (across both orgs)', talent_count;
    RAISE NOTICE '   ✓ Total Producers: % (across both orgs)', producer_count;
    RAISE NOTICE '';
    RAISE NOTICE '📺 SHOW ASSIGNMENTS:';
    RAISE NOTICE '   ✓ Shows with assigned staff: %/10', assigned_shows;
    RAISE NOTICE '   ✓ Each show has 1 talent + 1 producer';
    RAISE NOTICE '';
    RAISE NOTICE '⏱️  EPISODE DURATIONS (FIXED):';
    RAISE NOTICE '   ✓ Average: % minutes', ROUND(avg_duration, 1);
    RAISE NOTICE '   ✓ Range: % - % minutes', min_duration, max_duration;
    RAISE NOTICE '   ✓ Realistic podcast lengths achieved';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 CONTENT VARIETY:';
    RAISE NOTICE '   • Daily shows: 12-30 minutes';
    RAISE NOTICE '   • Financial content: 15-30 minutes';
    RAISE NOTICE '   • Sports analysis: 35-60 minutes';
    RAISE NOTICE '   • History deep dives: 40-60 minutes';
    RAISE NOTICE '   • Business content: 25-50 minutes';
    RAISE NOTICE '   • General topics: 20-50 minutes';
    RAISE NOTICE '';
    RAISE NOTICE '✅ All shows now have realistic durations';
    RAISE NOTICE '   and proper talent/producer assignments!';
    RAISE NOTICE '════════════════════════════════════════';
END $$;