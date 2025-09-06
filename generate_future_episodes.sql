-- Generate 3 months of future episodes for all active shows
-- This script creates episodes with relevant pre-release data

DO $$
DECLARE
    show_record RECORD;
    episode_date DATE;
    episode_number INTEGER;
    episode_count INTEGER;
    end_date DATE;
    release_interval INTERVAL;
    episode_title TEXT;
    episode_duration INTEGER;
    current_org TEXT;
BEGIN
    -- Set the end date to 3 months from now
    end_date := CURRENT_DATE + INTERVAL '3 months';
    
    -- Process each organization schema
    FOR current_org IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        RAISE NOTICE 'Processing organization: %', current_org;
        
        -- Get all active shows for this organization
        FOR show_record IN 
            EXECUTE format('
                SELECT 
                    s.id,
                    s.name,
                    s."organizationId",
                    s."releaseFrequency",
                    s."releaseDay",
                    s."createdBy",
                    COALESCE(MAX(e."episodeNumber"), 0) as last_episode_number,
                    COALESCE(MAX(e."airDate"), CURRENT_DATE) as last_air_date
                FROM %I."Show" s
                LEFT JOIN %I."Episode" e ON e."showId" = s.id
                WHERE s."isActive" = true
                GROUP BY s.id, s.name, s."organizationId", s."releaseFrequency", s."releaseDay", s."createdBy"
            ', current_org, current_org)
        LOOP
            RAISE NOTICE 'Processing show: % (ID: %)', show_record.name, show_record.id;
            
            -- Determine release interval based on frequency
            CASE show_record."releaseFrequency"
                WHEN 'daily' THEN release_interval := INTERVAL '1 day';
                WHEN 'weekly' THEN release_interval := INTERVAL '7 days';
                WHEN 'biweekly' THEN release_interval := INTERVAL '14 days';
                WHEN 'monthly' THEN release_interval := INTERVAL '1 month';
                ELSE release_interval := INTERVAL '7 days'; -- Default to weekly
            END CASE;
            
            -- Start from the next episode date
            episode_date := show_record.last_air_date + release_interval;
            episode_number := show_record.last_episode_number + 1;
            episode_count := 0;
            
            -- Generate episodes until we reach the end date
            WHILE episode_date <= end_date LOOP
                -- Generate episode title with variety
                CASE (episode_number % 5)
                    WHEN 0 THEN episode_title := format('Special Episode: %s Deep Dive', show_record.name);
                    WHEN 1 THEN episode_title := format('%s Episode %s: Industry Insights', show_record.name, episode_number);
                    WHEN 2 THEN episode_title := format('%s Episode %s: Expert Interview', show_record.name, episode_number);
                    WHEN 3 THEN episode_title := format('%s Episode %s: Q&A Session', show_record.name, episode_number);
                    ELSE episode_title := format('%s Episode %s: Weekly Update', show_record.name, episode_number);
                END CASE;
                
                -- Vary episode duration (25-60 minutes)
                episode_duration := 1500 + (random() * 2100)::INTEGER; -- 25-60 minutes in seconds
                
                -- Insert the episode
                EXECUTE format('
                    INSERT INTO %I."Episode" (
                        id,
                        "showId",
                        title,
                        "episodeNumber",
                        "airDate",
                        duration,
                        status,
                        "createdAt",
                        "updatedAt",
                        "createdBy",
                        "organizationId",
                        "producerNotes",
                        "talentNotes",
                        "recordingDate"
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
                    )
                ', current_org)
                USING
                    'ep_' || substr(md5(random()::text), 1, 16) || '_' || extract(epoch from now())::integer,
                    show_record.id,
                    episode_title,
                    episode_number,
                    episode_date,
                    episode_duration,
                    'scheduled',
                    NOW(),
                    NOW(),
                    show_record."createdBy",
                    show_record."organizationId",
                    CASE 
                        WHEN random() < 0.3 THEN 'Guest confirmed. Pre-interview completed.'
                        WHEN random() < 0.6 THEN 'Topic research in progress. Script outline ready.'
                        ELSE 'Standard episode format. No special requirements.'
                    END,
                    CASE 
                        WHEN random() < 0.3 THEN 'Please review talking points before recording.'
                        WHEN random() < 0.6 THEN 'Ad reads to be inserted at 10min and 30min marks.'
                        ELSE NULL
                    END,
                    episode_date - INTERVAL '3 days'; -- Recording date is 3 days before air date
                
                episode_count := episode_count + 1;
                episode_number := episode_number + 1;
                episode_date := episode_date + release_interval;
            END LOOP;
            
            RAISE NOTICE 'Created % episodes for show %', episode_count, show_record.name;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Episode generation complete!';
END $$;

-- Now let's also add some campaign placements for these future episodes
-- This creates ad placements for episodes in the next month

DO $$
DECLARE
    campaign_record RECORD;
    episode_record RECORD;
    placement_count INTEGER;
    current_org TEXT;
BEGIN
    -- Process each organization
    FOR current_org IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Get active campaigns that extend into the future
        FOR campaign_record IN
            EXECUTE format('
                SELECT 
                    c.id,
                    c.name,
                    c."organizationId",
                    c."startDate",
                    c."endDate",
                    c.budget,
                    c."targetImpressions"
                FROM %I."Campaign" c
                WHERE c.status = ''active''
                  AND c."endDate" > CURRENT_DATE
            ', current_org)
        LOOP
            placement_count := 0;
            
            -- Find episodes within the campaign period
            FOR episode_record IN
                EXECUTE format('
                    SELECT 
                        e.id,
                        e."showId",
                        e."airDate"
                    FROM %I."Episode" e
                    WHERE e.status = ''scheduled''
                      AND e."airDate" BETWEEN $1 AND $2
                      AND e."airDate" > CURRENT_DATE
                      AND e."airDate" <= CURRENT_DATE + INTERVAL ''1 month''
                    ORDER BY RANDOM()
                    LIMIT 10
                ', current_org)
                USING campaign_record."startDate", campaign_record."endDate"
            LOOP
                -- Create ad placement record (if the table exists)
                BEGIN
                    EXECUTE format('
                        INSERT INTO %I."AdPlacement" (
                            id,
                            "campaignId",
                            "episodeId",
                            "placementType",
                            "position",
                            duration,
                            "scheduledDate",
                            status,
                            "createdAt",
                            "updatedAt",
                            "organizationId"
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                        )
                    ', current_org)
                    USING
                        'adp_' || substr(md5(random()::text), 1, 16),
                        campaign_record.id,
                        episode_record.id,
                        CASE (random() * 3)::INTEGER
                            WHEN 0 THEN 'pre-roll'
                            WHEN 1 THEN 'mid-roll'
                            ELSE 'post-roll'
                        END,
                        CASE (random() * 3)::INTEGER
                            WHEN 0 THEN 1
                            WHEN 1 THEN 2
                            ELSE 3
                        END,
                        CASE (random() * 3)::INTEGER
                            WHEN 0 THEN 15
                            WHEN 1 THEN 30
                            ELSE 60
                        END,
                        episode_record."airDate",
                        'scheduled',
                        NOW(),
                        NOW(),
                        campaign_record."organizationId";
                        
                    placement_count := placement_count + 1;
                EXCEPTION WHEN undefined_table THEN
                    -- AdPlacement table doesn't exist, skip
                    NULL;
                END;
            END LOOP;
            
            IF placement_count > 0 THEN
                RAISE NOTICE 'Created % ad placements for campaign %', placement_count, campaign_record.name;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Summary of what was created
SELECT 
    'Summary of Future Episodes Created' as report;

-- Show episode counts by organization and status
WITH org_episodes AS (
    SELECT 
        'org_podcastflow_pro' as org,
        s.name as show_name,
        COUNT(e.id) as future_episodes,
        MIN(e."airDate") as first_episode,
        MAX(e."airDate") as last_episode
    FROM org_podcastflow_pro."Show" s
    JOIN org_podcastflow_pro."Episode" e ON e."showId" = s.id
    WHERE e.status = 'scheduled'
      AND e."airDate" > CURRENT_DATE
    GROUP BY s.name
    
    UNION ALL
    
    SELECT 
        'org_unfy' as org,
        s.name as show_name,
        COUNT(e.id) as future_episodes,
        MIN(e."airDate") as first_episode,
        MAX(e."airDate") as last_episode
    FROM org_unfy."Show" s
    JOIN org_unfy."Episode" e ON e."showId" = s.id
    WHERE e.status = 'scheduled'
      AND e."airDate" > CURRENT_DATE
    GROUP BY s.name
)
SELECT * FROM org_episodes
ORDER BY org, show_name;