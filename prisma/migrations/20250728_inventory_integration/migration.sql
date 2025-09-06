-- Enhanced Inventory Integration Migration
-- This migration enhances the inventory system with dynamic spot assignment,
-- role-based visibility, and improved order integration

-- Function to apply migration to all organization schemas
CREATE OR REPLACE FUNCTION apply_inventory_integration_to_all_orgs()
RETURNS void AS $$
DECLARE
    org_schema TEXT;
BEGIN
    -- Loop through all organization schemas
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        RAISE NOTICE 'Applying inventory integration to schema: %', org_schema;
        
        -- 1. Add spot configuration fields to Show table
        EXECUTE format('
            ALTER TABLE %I."Show" 
            ADD COLUMN IF NOT EXISTS "spotConfiguration" JSONB DEFAULT ''{}''::jsonb,
            ADD COLUMN IF NOT EXISTS "defaultSpotLoadType" TEXT DEFAULT ''standard'',
            ADD COLUMN IF NOT EXISTS "enableDynamicSpots" BOOLEAN DEFAULT true
        ', org_schema);
        
        -- 2. Add episode length thresholds to ShowConfiguration
        EXECUTE format('
            ALTER TABLE %I."ShowConfiguration" 
            ADD COLUMN IF NOT EXISTS "spotThresholds" JSONB DEFAULT ''[
                {"minLength": 0, "maxLength": 15, "preRoll": 1, "midRoll": 0, "postRoll": 0},
                {"minLength": 15, "maxLength": 30, "preRoll": 1, "midRoll": 1, "postRoll": 1},
                {"minLength": 30, "maxLength": 60, "preRoll": 1, "midRoll": 2, "postRoll": 1},
                {"minLength": 60, "maxLength": 120, "preRoll": 2, "midRoll": 3, "postRoll": 1}
            ]''::jsonb,
            ADD COLUMN IF NOT EXISTS "customSpotRules" JSONB DEFAULT ''{}''::jsonb
        ', org_schema);
        
        -- 3. Add length field to Episode if missing
        EXECUTE format('
            ALTER TABLE %I."Episode" 
            ADD COLUMN IF NOT EXISTS "length" INTEGER DEFAULT 30
        ', org_schema);
        
        -- 4. Enhance EpisodeInventory with dynamic spot calculation
        EXECUTE format('
            ALTER TABLE %I."EpisodeInventory" 
            ADD COLUMN IF NOT EXISTS "calculatedFromLength" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "spotConfiguration" JSONB DEFAULT ''{}''::jsonb,
            ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3),
            ADD COLUMN IF NOT EXISTS "holdExpiresAt" TIMESTAMP(3)
        ', org_schema);
        
        -- 5. Add inventory hold status to InventoryReservation
        EXECUTE format('
            ALTER TABLE %I."InventoryReservation" 
            ADD COLUMN IF NOT EXISTS "holdType" TEXT DEFAULT ''manual'', -- manual, order, schedule
            ADD COLUMN IF NOT EXISTS "orderId" TEXT,
            ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT DEFAULT ''pending'', -- pending, approved, rejected
            ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
            ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
            ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT
        ', org_schema);
        
        -- 6. Link Orders to ScheduleBuilder
        EXECUTE format('
            ALTER TABLE %I."Order" 
            ADD COLUMN IF NOT EXISTS "scheduleId" TEXT,
            ADD COLUMN IF NOT EXISTS "requiresClientApproval" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "clientApprovedAt" TIMESTAMP(3),
            ADD COLUMN IF NOT EXISTS "clientApprovedBy" TEXT,
            ADD COLUMN IF NOT EXISTS "approvalWorkflow" JSONB DEFAULT ''{}''::jsonb,
            ADD COLUMN IF NOT EXISTS "contractTerms" JSONB DEFAULT ''{}''::jsonb,
            ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT,
            ADD COLUMN IF NOT EXISTS "specialInstructions" TEXT
        ', org_schema);
        
        -- 7. Add foreign key constraint for Order -> ScheduleBuilder
        EXECUTE format('
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_schema = ''%I''
                    AND table_name = ''Order''
                    AND constraint_name = ''Order_scheduleId_fkey''
                ) THEN
                    ALTER TABLE %I."Order" 
                    ADD CONSTRAINT "Order_scheduleId_fkey" 
                    FOREIGN KEY ("scheduleId") 
                    REFERENCES %I."ScheduleBuilder"("id") 
                    ON DELETE SET NULL ON UPDATE CASCADE;
                END IF;
            END $$;
        ', org_schema, org_schema, org_schema);
        
        -- 8. Create InventoryVisibility table for role-based access
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."InventoryVisibility" (
                "id" TEXT NOT NULL,
                "showId" TEXT NOT NULL,
                "userId" TEXT,
                "role" TEXT,
                "accessType" TEXT NOT NULL DEFAULT ''view'', -- view, manage
                "grantedBy" TEXT NOT NULL,
                "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "expiresAt" TIMESTAMP(3),
                "notes" TEXT,
                CONSTRAINT "InventoryVisibility_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "InventoryVisibility_unique" UNIQUE ("showId", "userId", "role")
            );
        ', org_schema);
        
        -- 9. Create InventoryChangeLog for tracking updates
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."InventoryChangeLog" (
                "id" TEXT NOT NULL,
                "episodeId" TEXT NOT NULL,
                "changeType" TEXT NOT NULL, -- spot_update, hold_created, hold_released, etc
                "previousValue" JSONB,
                "newValue" JSONB,
                "affectedOrders" TEXT[],
                "changedBy" TEXT NOT NULL,
                "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "notificationsSent" BOOLEAN DEFAULT false,
                CONSTRAINT "InventoryChangeLog_pkey" PRIMARY KEY ("id")
            );
        ', org_schema);
        
        -- 10. Create InventoryAlert table for overbooking notifications
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."InventoryAlert" (
                "id" TEXT NOT NULL,
                "alertType" TEXT NOT NULL, -- overbooking, deletion_impact, update_impact
                "severity" TEXT NOT NULL DEFAULT ''medium'', -- low, medium, high, critical
                "episodeId" TEXT,
                "showId" TEXT,
                "affectedOrders" TEXT[],
                "affectedSchedules" TEXT[],
                "details" JSONB NOT NULL,
                "status" TEXT NOT NULL DEFAULT ''active'', -- active, acknowledged, resolved
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "acknowledgedBy" TEXT,
                "acknowledgedAt" TIMESTAMP(3),
                "resolvedBy" TEXT,
                "resolvedAt" TIMESTAMP(3),
                "resolution" TEXT,
                CONSTRAINT "InventoryAlert_pkey" PRIMARY KEY ("id")
            );
        ', org_schema);
        
        -- 11. Create indexes for performance
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "InventoryVisibility_showId_idx" 
                ON %I."InventoryVisibility"("showId");
            CREATE INDEX IF NOT EXISTS "InventoryVisibility_userId_idx" 
                ON %I."InventoryVisibility"("userId");
            CREATE INDEX IF NOT EXISTS "InventoryChangeLog_episodeId_idx" 
                ON %I."InventoryChangeLog"("episodeId");
            CREATE INDEX IF NOT EXISTS "InventoryChangeLog_changedAt_idx" 
                ON %I."InventoryChangeLog"("changedAt");
            CREATE INDEX IF NOT EXISTS "InventoryAlert_status_idx" 
                ON %I."InventoryAlert"("status");
            CREATE INDEX IF NOT EXISTS "InventoryAlert_createdAt_idx" 
                ON %I."InventoryAlert"("createdAt");
        ', org_schema, org_schema, org_schema, org_schema, org_schema, org_schema);
        
        -- 12. Create function to calculate spots based on episode length
        EXECUTE format('
            CREATE OR REPLACE FUNCTION %I.calculate_episode_spots(
                p_episode_length INTEGER,
                p_show_id TEXT
            ) RETURNS JSONB AS $func$
            DECLARE
                v_thresholds JSONB;
                v_threshold JSONB;
                v_result JSONB;
            BEGIN
                -- Get thresholds from ShowConfiguration or use defaults
                SELECT COALESCE(sc."spotThresholds", ''[
                    {"minLength": 0, "maxLength": 15, "preRoll": 1, "midRoll": 0, "postRoll": 0},
                    {"minLength": 15, "maxLength": 30, "preRoll": 1, "midRoll": 1, "postRoll": 1},
                    {"minLength": 30, "maxLength": 60, "preRoll": 1, "midRoll": 2, "postRoll": 1},
                    {"minLength": 60, "maxLength": 120, "preRoll": 2, "midRoll": 3, "postRoll": 1}
                ]''::jsonb)
                INTO v_thresholds
                FROM %I."ShowConfiguration" sc
                WHERE sc."showId" = p_show_id
                AND sc."episodeLength" = p_episode_length
                LIMIT 1;
                
                -- Find matching threshold
                FOR v_threshold IN SELECT * FROM jsonb_array_elements(v_thresholds)
                LOOP
                    IF p_episode_length >= (v_threshold->>''minLength'')::INTEGER 
                       AND p_episode_length <= (v_threshold->>''maxLength'')::INTEGER THEN
                        v_result := jsonb_build_object(
                            ''preRollSlots'', (v_threshold->>''preRoll'')::INTEGER,
                            ''midRollSlots'', (v_threshold->>''midRoll'')::INTEGER,
                            ''postRollSlots'', (v_threshold->>''postRoll'')::INTEGER
                        );
                        RETURN v_result;
                    END IF;
                END LOOP;
                
                -- Default if no threshold matches
                RETURN jsonb_build_object(
                    ''preRollSlots'', 1,
                    ''midRollSlots'', 2,
                    ''postRollSlots'', 1
                );
            END;
            $func$ LANGUAGE plpgsql;
        ', org_schema, org_schema);
        
        -- 13. Create trigger to auto-calculate inventory on episode insert/update
        EXECUTE format('
            CREATE OR REPLACE FUNCTION %I.update_episode_inventory()
            RETURNS TRIGGER AS $func$
            DECLARE
                v_spots JSONB;
                v_inventory_id TEXT;
            BEGIN
                -- Only process if episode is scheduled and has a future air date
                IF NEW.status = ''scheduled'' AND NEW."airDate" > CURRENT_DATE THEN
                    -- Calculate spots based on episode length
                    v_spots := %I.calculate_episode_spots(COALESCE(NEW.length, 30), NEW."showId");
                    
                    -- Check if inventory record exists
                    SELECT id INTO v_inventory_id
                    FROM %I."EpisodeInventory"
                    WHERE "episodeId" = NEW.id;
                    
                    IF v_inventory_id IS NULL THEN
                        -- Create new inventory record
                        INSERT INTO %I."EpisodeInventory" (
                            id, "episodeId", "showId", "airDate",
                            "preRollSlots", "preRollAvailable",
                            "midRollSlots", "midRollAvailable",
                            "postRollSlots", "postRollAvailable",
                            "calculatedFromLength", "spotConfiguration"
                        ) VALUES (
                            ''einv_'' || substr(md5(random()::text), 1, 16),
                            NEW.id, NEW."showId", NEW."airDate",
                            (v_spots->>''preRollSlots'')::INTEGER, 
                            (v_spots->>''preRollSlots'')::INTEGER,
                            (v_spots->>''midRollSlots'')::INTEGER, 
                            (v_spots->>''midRollSlots'')::INTEGER,
                            (v_spots->>''postRollSlots'')::INTEGER, 
                            (v_spots->>''postRollSlots'')::INTEGER,
                            true, v_spots
                        );
                    ELSE
                        -- Update existing inventory if spots changed
                        UPDATE %I."EpisodeInventory"
                        SET "preRollSlots" = (v_spots->>''preRollSlots'')::INTEGER,
                            "midRollSlots" = (v_spots->>''midRollSlots'')::INTEGER,
                            "postRollSlots" = (v_spots->>''postRollSlots'')::INTEGER,
                            "calculatedFromLength" = true,
                            "spotConfiguration" = v_spots,
                            "lastSyncedAt" = CURRENT_TIMESTAMP
                        WHERE id = v_inventory_id
                        AND "preRollReserved" = 0 
                        AND "preRollBooked" = 0
                        AND "midRollReserved" = 0 
                        AND "midRollBooked" = 0
                        AND "postRollReserved" = 0 
                        AND "postRollBooked" = 0;
                    END IF;
                END IF;
                
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql;
        ', org_schema, org_schema, org_schema, org_schema, org_schema);
        
        -- 14. Create or replace the trigger
        EXECUTE format('
            DROP TRIGGER IF EXISTS episode_inventory_update ON %I."Episode";
            CREATE TRIGGER episode_inventory_update
            AFTER INSERT OR UPDATE OF status, "airDate", length
            ON %I."Episode"
            FOR EACH ROW
            EXECUTE FUNCTION %I.update_episode_inventory();
        ', org_schema, org_schema, org_schema);
        
        -- 15. Create function to handle inventory holds from orders
        EXECUTE format('
            CREATE OR REPLACE FUNCTION %I.create_inventory_hold(
                p_schedule_id TEXT,
                p_order_id TEXT,
                p_user_id TEXT
            ) RETURNS JSONB AS $func$
            DECLARE
                v_item RECORD;
                v_inventory RECORD;
                v_hold_count INTEGER := 0;
                v_errors JSONB := ''[]''::jsonb;
            BEGIN
                -- Process each schedule item
                FOR v_item IN
                    SELECT * FROM %I."ScheduleBuilderItem"
                    WHERE "scheduleId" = p_schedule_id
                    AND status = ''scheduled''
                LOOP
                    -- Get current inventory
                    SELECT * INTO v_inventory
                    FROM %I."EpisodeInventory"
                    WHERE "episodeId" = v_item."episodeId";
                    
                    -- Check availability based on placement type
                    IF v_inventory.id IS NOT NULL THEN
                        DECLARE
                            v_available INTEGER;
                        BEGIN
                            CASE v_item."placementType"
                                WHEN ''pre-roll'' THEN v_available := v_inventory."preRollAvailable";
                                WHEN ''mid-roll'' THEN v_available := v_inventory."midRollAvailable";
                                WHEN ''post-roll'' THEN v_available := v_inventory."postRollAvailable";
                            END CASE;
                            
                            IF v_available > 0 THEN
                                -- Create hold
                                INSERT INTO %I."InventoryReservation" (
                                    id, "episodeId", "placementType", "slotNumber",
                                    "scheduleId", "scheduleItemId", "orderId",
                                    status, "holdType", "reservedBy", "expiresAt"
                                ) VALUES (
                                    ''hold_'' || substr(md5(random()::text), 1, 16),
                                    v_item."episodeId", v_item."placementType", 
                                    v_item."slotNumber", p_schedule_id, v_item.id,
                                    p_order_id, ''reserved'', ''order'', p_user_id,
                                    CURRENT_TIMESTAMP + INTERVAL ''48 hours''
                                );
                                
                                -- Update available inventory
                                CASE v_item."placementType"
                                    WHEN ''pre-roll'' THEN
                                        UPDATE %I."EpisodeInventory"
                                        SET "preRollAvailable" = "preRollAvailable" - 1,
                                            "preRollReserved" = "preRollReserved" + 1
                                        WHERE id = v_inventory.id;
                                    WHEN ''mid-roll'' THEN
                                        UPDATE %I."EpisodeInventory"
                                        SET "midRollAvailable" = "midRollAvailable" - 1,
                                            "midRollReserved" = "midRollReserved" + 1
                                        WHERE id = v_inventory.id;
                                    WHEN ''post-roll'' THEN
                                        UPDATE %I."EpisodeInventory"
                                        SET "postRollAvailable" = "postRollAvailable" - 1,
                                            "postRollReserved" = "postRollReserved" + 1
                                        WHERE id = v_inventory.id;
                                END CASE;
                                
                                v_hold_count := v_hold_count + 1;
                            ELSE
                                v_errors := v_errors || jsonb_build_object(
                                    ''episodeId'', v_item."episodeId",
                                    ''placementType'', v_item."placementType",
                                    ''error'', ''No available inventory''
                                );
                            END IF;
                        END;
                    END IF;
                END LOOP;
                
                RETURN jsonb_build_object(
                    ''success'', v_hold_count > 0,
                    ''holdsCreated'', v_hold_count,
                    ''errors'', v_errors
                );
            END;
            $func$ LANGUAGE plpgsql;
        ', org_schema, org_schema, org_schema, org_schema, org_schema, org_schema, org_schema);
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT apply_inventory_integration_to_all_orgs();

-- Drop the function after use
DROP FUNCTION apply_inventory_integration_to_all_orgs();