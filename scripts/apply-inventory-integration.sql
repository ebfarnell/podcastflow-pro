-- Safe Inventory Integration Application Script
-- This script applies changes only where tables exist

DO $$
DECLARE
    org_schema TEXT;
    table_exists BOOLEAN;
BEGIN
    -- Process each organization schema
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        RAISE NOTICE 'Processing schema: %', org_schema;
        
        -- 1. Add columns to Show table if it exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = org_schema AND table_name = 'Show'
        ) INTO table_exists;
        
        IF table_exists THEN
            EXECUTE format('
                ALTER TABLE %I."Show" 
                ADD COLUMN IF NOT EXISTS "spotConfiguration" JSONB DEFAULT ''{}''::jsonb,
                ADD COLUMN IF NOT EXISTS "defaultSpotLoadType" TEXT DEFAULT ''standard'',
                ADD COLUMN IF NOT EXISTS "enableDynamicSpots" BOOLEAN DEFAULT true
            ', org_schema);
            RAISE NOTICE '  ✓ Updated Show table';
        END IF;
        
        -- 2. Add columns to ShowConfiguration if it exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = org_schema AND table_name = 'ShowConfiguration'
        ) INTO table_exists;
        
        IF table_exists THEN
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
            RAISE NOTICE '  ✓ Updated ShowConfiguration table';
        END IF;
        
        -- 3. Add length to Episode if table exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = org_schema AND table_name = 'Episode'
        ) INTO table_exists;
        
        IF table_exists THEN
            EXECUTE format('
                ALTER TABLE %I."Episode" 
                ADD COLUMN IF NOT EXISTS "length" INTEGER DEFAULT 30
            ', org_schema);
            RAISE NOTICE '  ✓ Updated Episode table';
        END IF;
        
        -- 4. Update EpisodeInventory if it exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = org_schema AND table_name = 'EpisodeInventory'
        ) INTO table_exists;
        
        IF table_exists THEN
            EXECUTE format('
                ALTER TABLE %I."EpisodeInventory" 
                ADD COLUMN IF NOT EXISTS "calculatedFromLength" BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS "spotConfiguration" JSONB DEFAULT ''{}''::jsonb,
                ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3),
                ADD COLUMN IF NOT EXISTS "holdExpiresAt" TIMESTAMP(3)
            ', org_schema);
            RAISE NOTICE '  ✓ Updated EpisodeInventory table';
        END IF;
        
        -- 5. Update InventoryReservation if it exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = org_schema AND table_name = 'InventoryReservation'
        ) INTO table_exists;
        
        IF table_exists THEN
            EXECUTE format('
                ALTER TABLE %I."InventoryReservation" 
                ADD COLUMN IF NOT EXISTS "holdType" TEXT DEFAULT ''manual'',
                ADD COLUMN IF NOT EXISTS "orderId" TEXT,
                ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT DEFAULT ''pending'',
                ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
                ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
                ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT
            ', org_schema);
            RAISE NOTICE '  ✓ Updated InventoryReservation table';
        END IF;
        
        -- 6. Update Order table if it exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = org_schema AND table_name = 'Order'
        ) INTO table_exists;
        
        IF table_exists THEN
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
            RAISE NOTICE '  ✓ Updated Order table';
            
            -- Add foreign key if ScheduleBuilder exists
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = org_schema AND table_name = 'ScheduleBuilder'
            ) INTO table_exists;
            
            IF table_exists THEN
                BEGIN
                    EXECUTE format('
                        ALTER TABLE %I."Order" 
                        ADD CONSTRAINT "Order_scheduleId_fkey" 
                        FOREIGN KEY ("scheduleId") 
                        REFERENCES %I."ScheduleBuilder"("id") 
                        ON DELETE SET NULL ON UPDATE CASCADE
                    ', org_schema, org_schema);
                    RAISE NOTICE '  ✓ Added Order->ScheduleBuilder foreign key';
                EXCEPTION WHEN duplicate_object THEN
                    RAISE NOTICE '  - Foreign key already exists';
                END;
            END IF;
        END IF;
        
        -- 7. Create new tables
        -- InventoryVisibility
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."InventoryVisibility" (
                "id" TEXT NOT NULL,
                "showId" TEXT NOT NULL,
                "userId" TEXT,
                "role" TEXT,
                "accessType" TEXT NOT NULL DEFAULT ''view'',
                "grantedBy" TEXT NOT NULL,
                "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "expiresAt" TIMESTAMP(3),
                "notes" TEXT,
                CONSTRAINT "InventoryVisibility_pkey" PRIMARY KEY ("id")
            );
        ', org_schema);
        
        -- Add unique constraint if not exists
        BEGIN
            EXECUTE format('
                ALTER TABLE %I."InventoryVisibility"
                ADD CONSTRAINT "InventoryVisibility_unique" 
                UNIQUE ("showId", "userId", "role")
            ', org_schema);
        EXCEPTION WHEN duplicate_table OR duplicate_object THEN
            NULL;
        END;
        
        -- InventoryChangeLog
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."InventoryChangeLog" (
                "id" TEXT NOT NULL,
                "episodeId" TEXT NOT NULL,
                "changeType" TEXT NOT NULL,
                "previousValue" JSONB,
                "newValue" JSONB,
                "affectedOrders" TEXT[],
                "changedBy" TEXT NOT NULL,
                "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "notificationsSent" BOOLEAN DEFAULT false,
                CONSTRAINT "InventoryChangeLog_pkey" PRIMARY KEY ("id")
            );
        ', org_schema);
        
        -- InventoryAlert
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."InventoryAlert" (
                "id" TEXT NOT NULL,
                "alertType" TEXT NOT NULL,
                "severity" TEXT NOT NULL DEFAULT ''medium'',
                "episodeId" TEXT,
                "showId" TEXT,
                "affectedOrders" TEXT[],
                "affectedSchedules" TEXT[],
                "details" JSONB NOT NULL,
                "status" TEXT NOT NULL DEFAULT ''active'',
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "acknowledgedBy" TEXT,
                "acknowledgedAt" TIMESTAMP(3),
                "resolvedBy" TEXT,
                "resolvedAt" TIMESTAMP(3),
                "resolution" TEXT,
                CONSTRAINT "InventoryAlert_pkey" PRIMARY KEY ("id")
            );
        ', org_schema);
        
        RAISE NOTICE '  ✓ Created new inventory tables';
        
        -- 8. Create indexes
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
        
        RAISE NOTICE '  ✓ Created indexes';
        
        -- 9. Create functions only if Episode table has length column
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = org_schema 
            AND table_name = 'Episode' 
            AND column_name = 'length'
        ) INTO table_exists;
        
        IF table_exists THEN
            -- Create calculate_episode_spots function
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
                    LIMIT 1;
                    
                    -- If no ShowConfiguration, use defaults
                    IF v_thresholds IS NULL THEN
                        v_thresholds := ''[
                            {"minLength": 0, "maxLength": 15, "preRoll": 1, "midRoll": 0, "postRoll": 0},
                            {"minLength": 15, "maxLength": 30, "preRoll": 1, "midRoll": 1, "postRoll": 1},
                            {"minLength": 30, "maxLength": 60, "preRoll": 1, "midRoll": 2, "postRoll": 1},
                            {"minLength": 60, "maxLength": 120, "preRoll": 2, "midRoll": 3, "postRoll": 1}
                        ]''::jsonb;
                    END IF;
                    
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
            
            RAISE NOTICE '  ✓ Created calculate_episode_spots function';
            
            -- Create inventory hold function
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
                    v_available INTEGER;
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
                            v_available := CASE v_item."placementType"
                                WHEN ''pre-roll'' THEN v_inventory."preRollAvailable"
                                WHEN ''mid-roll'' THEN v_inventory."midRollAvailable"
                                WHEN ''post-roll'' THEN v_inventory."postRollAvailable"
                                ELSE 0
                            END;
                            
                            IF v_available > 0 THEN
                                -- Create hold
                                INSERT INTO %I."InventoryReservation" (
                                    id, "episodeId", "placementType", "slotNumber",
                                    "scheduleId", "scheduleItemId", "orderId",
                                    status, "holdType", "reservedBy", "expiresAt"
                                ) VALUES (
                                    ''hold_'' || substr(md5(random()::text), 1, 16),
                                    v_item."episodeId", v_item."placementType", 
                                    COALESCE(v_item."slotNumber", 1), p_schedule_id, v_item.id,
                                    p_order_id, ''reserved'', ''order'', p_user_id,
                                    CURRENT_TIMESTAMP + INTERVAL ''48 hours''
                                );
                                
                                -- Update available inventory
                                IF v_item."placementType" = ''pre-roll'' THEN
                                    UPDATE %I."EpisodeInventory"
                                    SET "preRollAvailable" = "preRollAvailable" - 1,
                                        "preRollReserved" = "preRollReserved" + 1
                                    WHERE id = v_inventory.id;
                                ELSIF v_item."placementType" = ''mid-roll'' THEN
                                    UPDATE %I."EpisodeInventory"
                                    SET "midRollAvailable" = "midRollAvailable" - 1,
                                        "midRollReserved" = "midRollReserved" + 1
                                    WHERE id = v_inventory.id;
                                ELSIF v_item."placementType" = ''post-roll'' THEN
                                    UPDATE %I."EpisodeInventory"
                                    SET "postRollAvailable" = "postRollAvailable" - 1,
                                        "postRollReserved" = "postRollReserved" + 1
                                    WHERE id = v_inventory.id;
                                END IF;
                                
                                v_hold_count := v_hold_count + 1;
                            ELSE
                                v_errors := v_errors || jsonb_build_object(
                                    ''episodeId'', v_item."episodeId",
                                    ''placementType'', v_item."placementType",
                                    ''error'', ''No available inventory''
                                );
                            END IF;
                        ELSE
                            v_errors := v_errors || jsonb_build_object(
                                ''episodeId'', v_item."episodeId",
                                ''error'', ''No inventory record found''
                            );
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
            
            RAISE NOTICE '  ✓ Created inventory hold function';
        ELSE
            RAISE NOTICE '  ! Skipped functions - Episode.length column not found';
        END IF;
        
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Inventory integration applied successfully!';
END $$;