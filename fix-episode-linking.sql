-- Fix Episode Linking for Schedule Items
-- This migration adds episodeId to ScheduleItem table and backfills data

-- Step 1: Add episodeId column to ScheduleItem table if it doesn't exist
DO $$
BEGIN
    -- For org_podcastflow_pro schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'org_podcastflow_pro' 
        AND table_name = 'ScheduleItem' 
        AND column_name = 'episodeId'
    ) THEN
        ALTER TABLE org_podcastflow_pro."ScheduleItem" 
        ADD COLUMN "episodeId" TEXT;
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS "ScheduleItem_episodeId_idx" 
        ON org_podcastflow_pro."ScheduleItem" ("episodeId");
    END IF;

    -- For org_unfy schema
    IF EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = 'org_unfy'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'org_unfy' 
            AND table_name = 'ScheduleItem' 
            AND column_name = 'episodeId'
        ) THEN
            ALTER TABLE org_unfy."ScheduleItem" 
            ADD COLUMN "episodeId" TEXT;
            
            CREATE INDEX IF NOT EXISTS "ScheduleItem_episodeId_idx" 
            ON org_unfy."ScheduleItem" ("episodeId");
        END IF;
    END IF;
END $$;

-- Step 2: Create or update episodes for ScheduleBuilderItem records
DO $$
DECLARE
    item RECORD;
    episode_id TEXT;
    episode_num INTEGER;
    show_name TEXT;
BEGIN
    -- Process each ScheduleBuilderItem that lacks an episodeId
    FOR item IN 
        SELECT sbi.*, s.name as show_name
        FROM org_podcastflow_pro."ScheduleBuilderItem" sbi
        JOIN org_podcastflow_pro."Show" s ON s.id = sbi."showId"
        WHERE sbi."episodeId" IS NULL OR sbi."episodeId" = ''
    LOOP
        -- Check if an episode exists for this show and date
        SELECT e.id INTO episode_id
        FROM org_podcastflow_pro."Episode" e
        WHERE e."showId" = item."showId"
        AND DATE(e."airDate") = item."airDate"
        LIMIT 1;
        
        IF episode_id IS NULL THEN
            -- Create a new episode
            -- First, get the next episode number for this show
            SELECT COALESCE(MAX("episodeNumber"), 0) + 1 INTO episode_num
            FROM org_podcastflow_pro."Episode"
            WHERE "showId" = item."showId";
            
            -- Generate episode ID
            episode_id := 'ep_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
            
            -- Get show name for episode title
            SELECT name INTO show_name 
            FROM org_podcastflow_pro."Show" 
            WHERE id = item."showId";
            
            -- Insert new episode
            INSERT INTO org_podcastflow_pro."Episode" (
                id,
                "showId",
                title,
                "episodeNumber",
                "airDate",
                duration,
                status,
                "createdAt",
                "updatedAt",
                "organizationId"
            ) VALUES (
                episode_id,
                item."showId",
                COALESCE(show_name, 'Show') || ' - Episode ' || episode_num,
                episode_num,
                item."airDate",
                30, -- Default duration
                'scheduled',
                NOW(),
                NOW(),
                'org_podcastflow_pro'
            );
            
            RAISE NOTICE 'Created episode % for show % on date %', episode_id, item."showId", item."airDate";
        END IF;
        
        -- Update the ScheduleBuilderItem with the episode ID
        UPDATE org_podcastflow_pro."ScheduleBuilderItem"
        SET "episodeId" = episode_id
        WHERE id = item.id;
    END LOOP;
END $$;

-- Step 3: Backfill ScheduleItem records if any exist
UPDATE org_podcastflow_pro."ScheduleItem" si
SET "episodeId" = (
    SELECT e.id 
    FROM org_podcastflow_pro."Episode" e
    WHERE e."showId" = si."showId"
    AND DATE(e."airDate") = DATE(si."airDate")
    LIMIT 1
)
WHERE si."episodeId" IS NULL;

-- Step 4: Create missing EpisodeInventory records for new episodes
INSERT INTO org_podcastflow_pro."EpisodeInventory" (
    id,
    "episodeId",
    "showId",
    "airDate",
    "preRollSlots",
    "preRollAvailable",
    "preRollReserved",
    "preRollBooked",
    "midRollSlots",
    "midRollAvailable",
    "midRollReserved",
    "midRollBooked",
    "postRollSlots",
    "postRollAvailable",
    "postRollReserved",
    "postRollBooked",
    "createdAt",
    "updatedAt"
)
SELECT 
    'ei_' || substr(md5(random()::text || e.id), 1, 16),
    e.id,
    e."showId",
    e."airDate",
    2, 2, 0, 0,  -- Pre-roll: 2 slots available
    3, 3, 0, 0,  -- Mid-roll: 3 slots available  
    2, 2, 0, 0,  -- Post-roll: 2 slots available
    NOW(),
    NOW()
FROM org_podcastflow_pro."Episode" e
WHERE NOT EXISTS (
    SELECT 1 FROM org_podcastflow_pro."EpisodeInventory" ei
    WHERE ei."episodeId" = e.id
)
AND e.status = 'scheduled';

-- Step 5: Update inventory based on existing schedule builder items
UPDATE org_podcastflow_pro."EpisodeInventory" ei
SET "preRollReserved" = subq.reserved_count,
    "preRollAvailable" = GREATEST(0, ei."preRollSlots" - subq.reserved_count)
FROM (
    SELECT "episodeId", COUNT(*) as reserved_count
    FROM org_podcastflow_pro."ScheduleBuilderItem"
    WHERE "placementType" = 'pre-roll'
    AND "episodeId" IS NOT NULL
    GROUP BY "episodeId"
) subq
WHERE ei."episodeId" = subq."episodeId";

UPDATE org_podcastflow_pro."EpisodeInventory" ei
SET "midRollReserved" = subq.reserved_count,
    "midRollAvailable" = GREATEST(0, ei."midRollSlots" - subq.reserved_count)
FROM (
    SELECT "episodeId", COUNT(*) as reserved_count
    FROM org_podcastflow_pro."ScheduleBuilderItem"
    WHERE "placementType" = 'mid-roll'
    AND "episodeId" IS NOT NULL
    GROUP BY "episodeId"
) subq
WHERE ei."episodeId" = subq."episodeId";

UPDATE org_podcastflow_pro."EpisodeInventory" ei
SET "postRollReserved" = subq.reserved_count,
    "postRollAvailable" = GREATEST(0, ei."postRollSlots" - subq.reserved_count)
FROM (
    SELECT "episodeId", COUNT(*) as reserved_count
    FROM org_podcastflow_pro."ScheduleBuilderItem"
    WHERE "placementType" = 'post-roll'
    AND "episodeId" IS NOT NULL
    GROUP BY "episodeId"
) subq
WHERE ei."episodeId" = subq."episodeId";

-- Verification
SELECT 
    'ScheduleBuilderItems with episodes' as metric,
    COUNT(*) as count
FROM org_podcastflow_pro."ScheduleBuilderItem"
WHERE "episodeId" IS NOT NULL
UNION ALL
SELECT 
    'ScheduleBuilderItems without episodes',
    COUNT(*)
FROM org_podcastflow_pro."ScheduleBuilderItem"
WHERE "episodeId" IS NULL
UNION ALL
SELECT 
    'Episodes created',
    COUNT(*)
FROM org_podcastflow_pro."Episode"
WHERE "createdAt" >= NOW() - INTERVAL '1 minute';