-- Add sample reservation items to existing inventory
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

-- Show episode inventory status
SELECT 
    e.title as episode_title,
    e."airDate",
    s.name as show_name,
    ei."preRollSlots",
    ei."preRollAvailable",
    ei."preRollReserved",
    ei."midRollSlots",
    ei."midRollAvailable",
    ei."midRollReserved"
FROM org_podcastflow_pro."Episode" e
JOIN org_podcastflow_pro."Show" s ON s.id = e."showId"
LEFT JOIN org_podcastflow_pro."EpisodeInventory" ei ON ei."episodeId" = e.id
WHERE e.status = 'scheduled'
  AND e."airDate" > CURRENT_DATE
  AND e."airDate" < CURRENT_DATE + INTERVAL '2 weeks'
ORDER BY e."airDate"
LIMIT 10;