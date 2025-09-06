-- Rollback Script for Inventory Integration
-- WARNING: This will remove all inventory integration changes
-- Make sure to backup current data before running

-- Function to rollback changes in all organization schemas
CREATE OR REPLACE FUNCTION rollback_inventory_integration()
RETURNS void AS $$
DECLARE
    org_schema TEXT;
    rollback_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting rollback of inventory integration changes...';
    
    -- Loop through all organization schemas
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        RAISE NOTICE 'Rolling back schema: %', org_schema;
        
        -- Drop new tables (in reverse dependency order)
        EXECUTE format('DROP TABLE IF EXISTS %I."InventoryAlert" CASCADE', org_schema);
        EXECUTE format('DROP TABLE IF EXISTS %I."InventoryChangeLog" CASCADE', org_schema);
        EXECUTE format('DROP TABLE IF EXISTS %I."InventoryVisibility" CASCADE', org_schema);
        
        -- Drop new functions
        EXECUTE format('DROP FUNCTION IF EXISTS %I.calculate_episode_spots(INTEGER, TEXT) CASCADE', org_schema);
        EXECUTE format('DROP FUNCTION IF EXISTS %I.update_episode_inventory() CASCADE', org_schema);
        EXECUTE format('DROP FUNCTION IF EXISTS %I.create_inventory_hold(TEXT, TEXT, TEXT) CASCADE', org_schema);
        
        -- Drop triggers
        EXECUTE format('DROP TRIGGER IF EXISTS episode_inventory_update ON %I."Episode"', org_schema);
        
        -- Remove new columns from Show table
        EXECUTE format('
            ALTER TABLE %I."Show" 
            DROP COLUMN IF EXISTS "spotConfiguration",
            DROP COLUMN IF EXISTS "defaultSpotLoadType",
            DROP COLUMN IF EXISTS "enableDynamicSpots"
        ', org_schema);
        
        -- Remove new columns from ShowConfiguration
        EXECUTE format('
            ALTER TABLE %I."ShowConfiguration" 
            DROP COLUMN IF EXISTS "spotThresholds",
            DROP COLUMN IF EXISTS "customSpotRules"
        ', org_schema);
        
        -- Remove new columns from EpisodeInventory
        EXECUTE format('
            ALTER TABLE %I."EpisodeInventory" 
            DROP COLUMN IF EXISTS "calculatedFromLength",
            DROP COLUMN IF EXISTS "spotConfiguration",
            DROP COLUMN IF EXISTS "lastSyncedAt",
            DROP COLUMN IF EXISTS "holdExpiresAt"
        ', org_schema);
        
        -- Remove new columns from InventoryReservation
        EXECUTE format('
            ALTER TABLE %I."InventoryReservation" 
            DROP COLUMN IF EXISTS "holdType",
            DROP COLUMN IF EXISTS "orderId",
            DROP COLUMN IF EXISTS "approvalStatus",
            DROP COLUMN IF EXISTS "approvedBy",
            DROP COLUMN IF EXISTS "approvedAt",
            DROP COLUMN IF EXISTS "rejectionReason"
        ', org_schema);
        
        -- Remove foreign key constraint from Order table
        EXECUTE format('
            ALTER TABLE %I."Order" 
            DROP CONSTRAINT IF EXISTS "Order_scheduleId_fkey"
        ', org_schema);
        
        -- Remove new columns from Order table
        EXECUTE format('
            ALTER TABLE %I."Order" 
            DROP COLUMN IF EXISTS "scheduleId",
            DROP COLUMN IF EXISTS "requiresClientApproval",
            DROP COLUMN IF EXISTS "clientApprovedAt",
            DROP COLUMN IF EXISTS "clientApprovedBy",
            DROP COLUMN IF EXISTS "approvalWorkflow",
            DROP COLUMN IF EXISTS "contractTerms",
            DROP COLUMN IF EXISTS "paymentTerms",
            DROP COLUMN IF EXISTS "specialInstructions"
        ', org_schema);
        
        -- Reset any inventory holds to original state
        EXECUTE format('
            UPDATE %I."InventoryReservation"
            SET status = ''reserved''
            WHERE status IN (''confirmed'', ''released'', ''expired'')
              AND "createdAt" > ''2025-07-28''::date
        ', org_schema);
        
        rollback_count := rollback_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Rollback completed for % organization schemas', rollback_count;
    
    -- Drop the migration record (if using Prisma migrations)
    DELETE FROM "_prisma_migrations" 
    WHERE migration_name = '20250728_inventory_integration';
    
END;
$$ LANGUAGE plpgsql;

-- Execute the rollback
SELECT rollback_inventory_integration();

-- Drop the rollback function
DROP FUNCTION rollback_inventory_integration();

-- Verification queries
DO $$
DECLARE
    org_schema TEXT;
    table_count INTEGER;
    column_count INTEGER;
BEGIN
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
        LIMIT 1
    LOOP
        -- Check if new tables were dropped
        SELECT COUNT(*) INTO table_count
        FROM information_schema.tables
        WHERE table_schema = org_schema
          AND table_name IN ('InventoryAlert', 'InventoryChangeLog', 'InventoryVisibility');
        
        IF table_count > 0 THEN
            RAISE WARNING 'Rollback may be incomplete - found % new tables still exist in %', table_count, org_schema;
        END IF;
        
        -- Check if new columns were dropped
        SELECT COUNT(*) INTO column_count
        FROM information_schema.columns
        WHERE table_schema = org_schema
          AND table_name = 'Show'
          AND column_name IN ('spotConfiguration', 'defaultSpotLoadType', 'enableDynamicSpots');
        
        IF column_count > 0 THEN
            RAISE WARNING 'Rollback may be incomplete - found % new columns still exist in %.Show', column_count, org_schema;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Rollback verification complete';
END $$;

-- Summary
SELECT 'Inventory Integration Rollback Complete' as status,
       NOW() as completed_at;