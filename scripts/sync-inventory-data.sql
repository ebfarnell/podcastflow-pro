-- Sync Episode Inventory Data
-- This script populates inventory for all existing future episodes

DO $$
DECLARE
    org_schema TEXT;
    episode_count INTEGER;
    inventory_created INTEGER;
    total_created INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting inventory sync for all organizations...';
    RAISE NOTICE '=========================================';
    
    -- Process each organization
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        inventory_created := 0;
        
        -- Check if Episode table has length column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = org_schema 
            AND table_name = 'Episode' 
            AND column_name = 'length'
        ) THEN
            RAISE NOTICE '';
            RAISE NOTICE 'Processing %:', org_schema;
            
            -- Count future episodes
            EXECUTE format('
                SELECT COUNT(*) 
                FROM %I."Episode" e
                WHERE e.status = ''scheduled''
                  AND e."airDate" > CURRENT_DATE
                  AND NOT EXISTS (
                      SELECT 1 FROM %I."EpisodeInventory" ei 
                      WHERE ei."episodeId" = e.id
                  )
            ', org_schema, org_schema) INTO episode_count;
            
            RAISE NOTICE '  Found % future episodes without inventory', episode_count;
            
            -- Create inventory for each episode
            EXECUTE format('
                INSERT INTO %I."EpisodeInventory" (
                    id, "episodeId", "showId", "airDate",
                    "preRollSlots", "preRollAvailable", "preRollReserved", "preRollBooked",
                    "midRollSlots", "midRollAvailable", "midRollReserved", "midRollBooked",
                    "postRollSlots", "postRollAvailable", "postRollReserved", "postRollBooked",
                    "calculatedFromLength", "spotConfiguration", "lastSyncedAt"
                )
                SELECT 
                    ''einv_'' || substr(md5(random()::text || e.id), 1, 16),
                    e.id,
                    e."showId",
                    e."airDate",
                    (spots->>''preRollSlots'')::INTEGER,
                    (spots->>''preRollSlots'')::INTEGER,
                    0, 0,
                    (spots->>''midRollSlots'')::INTEGER,
                    (spots->>''midRollSlots'')::INTEGER,
                    0, 0,
                    (spots->>''postRollSlots'')::INTEGER,
                    (spots->>''postRollSlots'')::INTEGER,
                    0, 0,
                    true,
                    spots,
                    CURRENT_TIMESTAMP
                FROM %I."Episode" e
                CROSS JOIN LATERAL %I.calculate_episode_spots(COALESCE(e.length, 30), e."showId") spots
                WHERE e.status = ''scheduled''
                  AND e."airDate" > CURRENT_DATE
                  AND NOT EXISTS (
                      SELECT 1 FROM %I."EpisodeInventory" ei 
                      WHERE ei."episodeId" = e.id
                  )
            ', org_schema, org_schema, org_schema, org_schema);
            
            GET DIAGNOSTICS inventory_created = ROW_COUNT;
            total_created := total_created + inventory_created;
            
            RAISE NOTICE '  Created % inventory records', inventory_created;
            
            -- Update existing inventory for episodes that have no bookings
            EXECUTE format('
                UPDATE %I."EpisodeInventory" ei
                SET "preRollSlots" = (spots->>''preRollSlots'')::INTEGER,
                    "preRollAvailable" = GREATEST(
                        (spots->>''preRollSlots'')::INTEGER - ei."preRollReserved" - ei."preRollBooked", 
                        0
                    ),
                    "midRollSlots" = (spots->>''midRollSlots'')::INTEGER,
                    "midRollAvailable" = GREATEST(
                        (spots->>''midRollSlots'')::INTEGER - ei."midRollReserved" - ei."midRollBooked", 
                        0
                    ),
                    "postRollSlots" = (spots->>''postRollSlots'')::INTEGER,
                    "postRollAvailable" = GREATEST(
                        (spots->>''postRollSlots'')::INTEGER - ei."postRollReserved" - ei."postRollBooked", 
                        0
                    ),
                    "calculatedFromLength" = true,
                    "spotConfiguration" = spots,
                    "lastSyncedAt" = CURRENT_TIMESTAMP
                FROM (
                    SELECT e.id, %I.calculate_episode_spots(COALESCE(e.length, 30), e."showId") as spots
                    FROM %I."Episode" e
                    WHERE e.id = ei."episodeId"
                ) calc
                WHERE ei."episodeId" = calc.id
                  AND ei."preRollReserved" = 0 
                  AND ei."preRollBooked" = 0
                  AND ei."midRollReserved" = 0 
                  AND ei."midRollBooked" = 0
                  AND ei."postRollReserved" = 0 
                  AND ei."postRollBooked" = 0
                  AND ei."calculatedFromLength" = false
            ', org_schema, org_schema, org_schema);
            
            GET DIAGNOSTICS episode_count = ROW_COUNT;
            IF episode_count > 0 THEN
                RAISE NOTICE '  Updated % existing inventory records', episode_count;
            END IF;
            
        ELSE
            RAISE NOTICE 'Skipping % - Episode table missing length column', org_schema;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Inventory sync completed!';
    RAISE NOTICE 'Total inventory records created: %', total_created;
    
    -- Summary report
    RAISE NOTICE '';
    RAISE NOTICE 'Inventory Summary by Organization:';
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = org_schema 
            AND table_name = 'EpisodeInventory'
        ) THEN
            EXECUTE format('
                SELECT 
                    COUNT(DISTINCT ei."episodeId") as episodes,
                    SUM(ei."preRollSlots" + ei."midRollSlots" + ei."postRollSlots") as total_slots,
                    SUM(ei."preRollAvailable" + ei."midRollAvailable" + ei."postRollAvailable") as available,
                    SUM(ei."preRollReserved" + ei."midRollReserved" + ei."postRollReserved") as reserved,
                    SUM(ei."preRollBooked" + ei."midRollBooked" + ei."postRollBooked") as booked
                FROM %I."EpisodeInventory" ei
            ', org_schema) INTO episode_count, inventory_created;
            
            RAISE NOTICE '  %: % episodes with inventory', org_schema, episode_count;
        END IF;
    END LOOP;
    
END $$;