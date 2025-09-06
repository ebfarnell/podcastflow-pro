-- Create Episode Inventory Tracking System

-- First, create ReservationItem table to link reservations to specific inventory slots
DO $$
BEGIN
    -- For org_podcastflow_pro
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_podcastflow_pro' 
                   AND table_name = 'ReservationItem') THEN
        CREATE TABLE org_podcastflow_pro."ReservationItem" (
            id TEXT PRIMARY KEY,
            "reservationId" TEXT NOT NULL,
            "inventoryId" TEXT NOT NULL,
            "episodeId" TEXT,
            "showId" TEXT NOT NULL,
            "placementType" TEXT NOT NULL, -- pre-roll, mid-roll, post-roll
            "spotCount" INTEGER NOT NULL DEFAULT 1,
            "unitPrice" DOUBLE PRECISION NOT NULL,
            "totalPrice" DOUBLE PRECISION NOT NULL,
            "airDate" TIMESTAMP(3) NOT NULL,
            status TEXT NOT NULL DEFAULT 'reserved', -- reserved, confirmed, aired, cancelled
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX "ReservationItem_reservationId_idx" ON org_podcastflow_pro."ReservationItem"("reservationId");
        CREATE INDEX "ReservationItem_inventoryId_idx" ON org_podcastflow_pro."ReservationItem"("inventoryId");
        CREATE INDEX "ReservationItem_episodeId_idx" ON org_podcastflow_pro."ReservationItem"("episodeId");
        CREATE INDEX "ReservationItem_airDate_idx" ON org_podcastflow_pro."ReservationItem"("airDate");
    END IF;

    -- For org_unfy
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_unfy' 
                   AND table_name = 'ReservationItem') THEN
        CREATE TABLE org_unfy."ReservationItem" (
            id TEXT PRIMARY KEY,
            "reservationId" TEXT NOT NULL,
            "inventoryId" TEXT NOT NULL,
            "episodeId" TEXT,
            "showId" TEXT NOT NULL,
            "placementType" TEXT NOT NULL,
            "spotCount" INTEGER NOT NULL DEFAULT 1,
            "unitPrice" DOUBLE PRECISION NOT NULL,
            "totalPrice" DOUBLE PRECISION NOT NULL,
            "airDate" TIMESTAMP(3) NOT NULL,
            status TEXT NOT NULL DEFAULT 'reserved',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX "ReservationItem_reservationId_idx" ON org_unfy."ReservationItem"("reservationId");
        CREATE INDEX "ReservationItem_inventoryId_idx" ON org_unfy."ReservationItem"("inventoryId");
        CREATE INDEX "ReservationItem_episodeId_idx" ON org_unfy."ReservationItem"("episodeId");
        CREATE INDEX "ReservationItem_airDate_idx" ON org_unfy."ReservationItem"("airDate");
    END IF;
END $$;

-- Create Episode Inventory table to track available slots per episode
DO $$
BEGIN
    -- For org_podcastflow_pro
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_podcastflow_pro' 
                   AND table_name = 'EpisodeInventory') THEN
        CREATE TABLE org_podcastflow_pro."EpisodeInventory" (
            id TEXT PRIMARY KEY,
            "episodeId" TEXT NOT NULL,
            "showId" TEXT NOT NULL,
            "airDate" TIMESTAMP(3) NOT NULL,
            "preRollSlots" INTEGER NOT NULL DEFAULT 1,
            "preRollAvailable" INTEGER NOT NULL DEFAULT 1,
            "preRollReserved" INTEGER NOT NULL DEFAULT 0,
            "preRollBooked" INTEGER NOT NULL DEFAULT 0,
            "preRollPrice" DOUBLE PRECISION,
            "midRollSlots" INTEGER NOT NULL DEFAULT 2,
            "midRollAvailable" INTEGER NOT NULL DEFAULT 2,
            "midRollReserved" INTEGER NOT NULL DEFAULT 0,
            "midRollBooked" INTEGER NOT NULL DEFAULT 0,
            "midRollPrice" DOUBLE PRECISION,
            "postRollSlots" INTEGER NOT NULL DEFAULT 1,
            "postRollAvailable" INTEGER NOT NULL DEFAULT 1,
            "postRollReserved" INTEGER NOT NULL DEFAULT 0,
            "postRollBooked" INTEGER NOT NULL DEFAULT 0,
            "postRollPrice" DOUBLE PRECISION,
            "estimatedImpressions" INTEGER,
            "actualImpressions" INTEGER,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "EpisodeInventory_episodeId_key" UNIQUE ("episodeId")
        );
        
        CREATE INDEX "EpisodeInventory_showId_idx" ON org_podcastflow_pro."EpisodeInventory"("showId");
        CREATE INDEX "EpisodeInventory_airDate_idx" ON org_podcastflow_pro."EpisodeInventory"("airDate");
    END IF;

    -- For org_unfy
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_unfy' 
                   AND table_name = 'EpisodeInventory') THEN
        CREATE TABLE org_unfy."EpisodeInventory" (
            id TEXT PRIMARY KEY,
            "episodeId" TEXT NOT NULL,
            "showId" TEXT NOT NULL,
            "airDate" TIMESTAMP(3) NOT NULL,
            "preRollSlots" INTEGER NOT NULL DEFAULT 1,
            "preRollAvailable" INTEGER NOT NULL DEFAULT 1,
            "preRollReserved" INTEGER NOT NULL DEFAULT 0,
            "preRollBooked" INTEGER NOT NULL DEFAULT 0,
            "preRollPrice" DOUBLE PRECISION,
            "midRollSlots" INTEGER NOT NULL DEFAULT 2,
            "midRollAvailable" INTEGER NOT NULL DEFAULT 2,
            "midRollReserved" INTEGER NOT NULL DEFAULT 0,
            "midRollBooked" INTEGER NOT NULL DEFAULT 0,
            "midRollPrice" DOUBLE PRECISION,
            "postRollSlots" INTEGER NOT NULL DEFAULT 1,
            "postRollAvailable" INTEGER NOT NULL DEFAULT 1,
            "postRollReserved" INTEGER NOT NULL DEFAULT 0,
            "postRollBooked" INTEGER NOT NULL DEFAULT 0,
            "postRollPrice" DOUBLE PRECISION,
            "estimatedImpressions" INTEGER,
            "actualImpressions" INTEGER,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "EpisodeInventory_episodeId_key" UNIQUE ("episodeId")
        );
        
        CREATE INDEX "EpisodeInventory_showId_idx" ON org_unfy."EpisodeInventory"("showId");
        CREATE INDEX "EpisodeInventory_airDate_idx" ON org_unfy."EpisodeInventory"("airDate");
    END IF;
END $$;

-- Now populate EpisodeInventory for all future episodes
DO $$
DECLARE
    episode_record RECORD;
    show_record RECORD;
    inventory_count INTEGER := 0;
    current_org TEXT;
BEGIN
    -- Process each organization
    FOR current_org IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Get episodes that need inventory records
        FOR episode_record IN
            EXECUTE format('
                SELECT 
                    e.id as episode_id,
                    e."showId",
                    e."airDate",
                    s.name as show_name,
                    s.category
                FROM %I."Episode" e
                JOIN %I."Show" s ON s.id = e."showId"
                WHERE e.status = ''scheduled''
                  AND e."airDate" > CURRENT_DATE
                  AND NOT EXISTS (
                      SELECT 1 FROM %I."EpisodeInventory" ei 
                      WHERE ei."episodeId" = e.id
                  )
            ', current_org, current_org, current_org)
        LOOP
            -- Insert inventory record with pricing based on show category
            EXECUTE format('
                INSERT INTO %I."EpisodeInventory" (
                    id,
                    "episodeId",
                    "showId",
                    "airDate",
                    "preRollSlots",
                    "preRollAvailable",
                    "preRollPrice",
                    "midRollSlots",
                    "midRollAvailable",
                    "midRollPrice",
                    "postRollSlots",
                    "postRollAvailable",
                    "postRollPrice",
                    "estimatedImpressions"
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
                )
            ', current_org)
            USING
                'einv_' || substr(md5(random()::text), 1, 16),
                episode_record.episode_id,
                episode_record."showId",
                episode_record."airDate",
                1, -- preRollSlots
                1, -- preRollAvailable
                CASE -- preRollPrice based on category
                    WHEN episode_record.category = 'technology' THEN 500
                    WHEN episode_record.category = 'business' THEN 450
                    WHEN episode_record.category = 'health' THEN 400
                    ELSE 350
                END,
                2, -- midRollSlots
                2, -- midRollAvailable
                CASE -- midRollPrice
                    WHEN episode_record.category = 'technology' THEN 750
                    WHEN episode_record.category = 'business' THEN 700
                    WHEN episode_record.category = 'health' THEN 650
                    ELSE 600
                END,
                1, -- postRollSlots
                1, -- postRollAvailable
                CASE -- postRollPrice
                    WHEN episode_record.category = 'technology' THEN 300
                    WHEN episode_record.category = 'business' THEN 275
                    WHEN episode_record.category = 'health' THEN 250
                    ELSE 225
                END,
                5000 + (random() * 10000)::INTEGER; -- estimatedImpressions
                
            inventory_count := inventory_count + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % episode inventory records', inventory_count;
END $$;

-- Create some sample reservations with inventory allocations
DO $$
DECLARE
    reservation_count INTEGER := 0;
    item_count INTEGER := 0;
    current_org TEXT := 'org_podcastflow_pro';
    reservation_id TEXT;
    campaign_record RECORD;
    inventory_record RECORD;
BEGIN
    -- Get a few active campaigns to create reservations for
    FOR campaign_record IN
        EXECUTE format('
            SELECT 
                c.id,
                c.name,
                c."advertiserId",
                c."organizationId",
                c.budget
            FROM %I."Campaign" c
            WHERE c.status = ''active''
              AND c."endDate" > CURRENT_DATE
            LIMIT 3
        ', current_org)
    LOOP
        -- Create a reservation
        reservation_id := 'res_' || substr(md5(random()::text), 1, 16);
        
        EXECUTE format('
            INSERT INTO %I."Reservation" (
                id,
                "reservationNumber",
                "organizationId",
                "campaignId",
                "advertiserId",
                status,
                "holdDuration",
                "expiresAt",
                "totalAmount",
                "estimatedRevenue",
                "createdBy",
                notes,
                "createdAt",
                "updatedAt"
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )
        ', current_org)
        USING
            reservation_id,
            'RES-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 4),
            campaign_record."organizationId",
            campaign_record.id,
            campaign_record."advertiserId",
            'confirmed',
            48,
            CURRENT_TIMESTAMP + INTERVAL '48 hours',
            0, -- will update after adding items
            0, -- will update after adding items
            'system',
            'Auto-generated reservation for inventory allocation demo',
            NOW(),
            NOW();
            
        reservation_count := reservation_count + 1;
        
        -- Add reservation items (allocate inventory)
        FOR inventory_record IN
            EXECUTE format('
                SELECT 
                    ei.id as inventory_id,
                    ei."episodeId",
                    ei."showId",
                    ei."airDate",
                    ei."preRollAvailable",
                    ei."preRollPrice",
                    ei."midRollAvailable",
                    ei."midRollPrice"
                FROM %I."EpisodeInventory" ei
                WHERE ei."airDate" > CURRENT_DATE
                  AND ei."airDate" <= CURRENT_DATE + INTERVAL ''2 weeks''
                  AND (ei."preRollAvailable" > 0 OR ei."midRollAvailable" > 0)
                ORDER BY ei."airDate"
                LIMIT 5
            ', current_org)
        LOOP
            -- Add pre-roll if available
            IF inventory_record."preRollAvailable" > 0 THEN
                EXECUTE format('
                    INSERT INTO %I."ReservationItem" (
                        id,
                        "reservationId",
                        "inventoryId",
                        "episodeId",
                        "showId",
                        "placementType",
                        "spotCount",
                        "unitPrice",
                        "totalPrice",
                        "airDate",
                        status
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                    )
                ', current_org)
                USING
                    'ritem_' || substr(md5(random()::text), 1, 16),
                    reservation_id,
                    inventory_record.inventory_id,
                    inventory_record."episodeId",
                    inventory_record."showId",
                    'pre-roll',
                    1,
                    inventory_record."preRollPrice",
                    inventory_record."preRollPrice",
                    inventory_record."airDate",
                    'confirmed';
                    
                -- Update inventory availability
                EXECUTE format('
                    UPDATE %I."EpisodeInventory"
                    SET "preRollAvailable" = "preRollAvailable" - 1,
                        "preRollReserved" = "preRollReserved" + 1
                    WHERE id = $1
                ', current_org)
                USING inventory_record.inventory_id;
                
                item_count := item_count + 1;
            END IF;
            
            -- Add mid-roll if available
            IF inventory_record."midRollAvailable" > 0 AND random() > 0.5 THEN
                EXECUTE format('
                    INSERT INTO %I."ReservationItem" (
                        id,
                        "reservationId",
                        "inventoryId",
                        "episodeId",
                        "showId",
                        "placementType",
                        "spotCount",
                        "unitPrice",
                        "totalPrice",
                        "airDate",
                        status
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                    )
                ', current_org)
                USING
                    'ritem_' || substr(md5(random()::text), 1, 16),
                    reservation_id,
                    inventory_record.inventory_id,
                    inventory_record."episodeId",
                    inventory_record."showId",
                    'mid-roll',
                    1,
                    inventory_record."midRollPrice",
                    inventory_record."midRollPrice",
                    inventory_record."airDate",
                    'confirmed';
                    
                -- Update inventory availability
                EXECUTE format('
                    UPDATE %I."EpisodeInventory"
                    SET "midRollAvailable" = "midRollAvailable" - 1,
                        "midRollReserved" = "midRollReserved" + 1
                    WHERE id = $1
                ', current_org)
                USING inventory_record.inventory_id;
                
                item_count := item_count + 1;
            END IF;
        END LOOP;
        
        -- Update reservation total
        EXECUTE format('
            UPDATE %I."Reservation" r
            SET "totalAmount" = (
                SELECT COALESCE(SUM(ri."totalPrice"), 0)
                FROM %I."ReservationItem" ri
                WHERE ri."reservationId" = r.id
            ),
            "estimatedRevenue" = (
                SELECT COALESCE(SUM(ri."totalPrice"), 0) * 0.85
                FROM %I."ReservationItem" ri
                WHERE ri."reservationId" = r.id
            )
            WHERE r.id = $1
        ', current_org, current_org, current_org)
        USING reservation_id;
    END LOOP;
    
    RAISE NOTICE 'Created % reservations with % inventory items', reservation_count, item_count;
END $$;

-- Create views to easily see episode inventory status
CREATE OR REPLACE VIEW org_podcastflow_pro."EpisodeInventoryStatus" AS
SELECT 
    e.id as episode_id,
    e.title as episode_title,
    e."airDate",
    s.name as show_name,
    ei."preRollSlots",
    ei."preRollAvailable",
    ei."preRollReserved",
    ei."preRollBooked",
    ei."preRollPrice",
    ei."midRollSlots",
    ei."midRollAvailable",
    ei."midRollReserved",
    ei."midRollBooked",
    ei."midRollPrice",
    ei."postRollSlots",
    ei."postRollAvailable",
    ei."postRollReserved",
    ei."postRollBooked",
    ei."postRollPrice",
    ei."estimatedImpressions",
    (ei."preRollSlots" - ei."preRollAvailable" - ei."preRollReserved" - ei."preRollBooked") +
    (ei."midRollSlots" - ei."midRollAvailable" - ei."midRollReserved" - ei."midRollBooked") +
    (ei."postRollSlots" - ei."postRollAvailable" - ei."postRollReserved" - ei."postRollBooked") as total_sold,
    ei."preRollSlots" + ei."midRollSlots" + ei."postRollSlots" as total_slots
FROM org_podcastflow_pro."Episode" e
JOIN org_podcastflow_pro."Show" s ON s.id = e."showId"
LEFT JOIN org_podcastflow_pro."EpisodeInventory" ei ON ei."episodeId" = e.id
WHERE e.status = 'scheduled'
  AND e."airDate" > CURRENT_DATE
ORDER BY e."airDate";

-- Summary reports
SELECT 'Inventory System Summary' as report;

-- Show inventory allocation summary
SELECT 
    COUNT(DISTINCT ei."episodeId") as episodes_with_inventory,
    SUM(ei."preRollSlots" + ei."midRollSlots" + ei."postRollSlots") as total_slots,
    SUM(ei."preRollAvailable" + ei."midRollAvailable" + ei."postRollAvailable") as total_available,
    SUM(ei."preRollReserved" + ei."midRollReserved" + ei."postRollReserved") as total_reserved,
    SUM(ei."preRollBooked" + ei."midRollBooked" + ei."postRollBooked") as total_booked
FROM org_podcastflow_pro."EpisodeInventory" ei;

-- Show reservations with items
SELECT 
    r."reservationNumber",
    r.status as reservation_status,
    c.name as campaign_name,
    COUNT(ri.id) as items_count,
    SUM(ri."totalPrice") as total_value,
    MIN(ri."airDate") as first_air_date,
    MAX(ri."airDate") as last_air_date
FROM org_podcastflow_pro."Reservation" r
LEFT JOIN org_podcastflow_pro."ReservationItem" ri ON ri."reservationId" = r.id
LEFT JOIN org_podcastflow_pro."Campaign" c ON c.id = r."campaignId"
WHERE ri.id IS NOT NULL
GROUP BY r."reservationNumber", r.status, c.name
ORDER BY MIN(ri."airDate");