-- Script to create _ShowToUser join table in all organization schemas
-- This table manages the many-to-many relationship between Shows and Users (producers/talent)

-- Function to create the table in a specific schema
CREATE OR REPLACE FUNCTION create_show_user_table(schema_name text)
RETURNS void AS $$
BEGIN
    -- Create the join table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."_ShowToUser" (
            "A" text NOT NULL,  -- Show ID
            "B" text NOT NULL,  -- User ID
            "role" text,        -- Optional: producer or talent
            "assignedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP,
            "assignedBy" text,  -- User who made the assignment
            PRIMARY KEY ("A", "B")
        )', schema_name);
    
    -- Add foreign key to Show table
    EXECUTE format('
        ALTER TABLE %I."_ShowToUser" 
        ADD CONSTRAINT "_ShowToUser_A_fkey" 
        FOREIGN KEY ("A") REFERENCES %I."Show"(id) 
        ON DELETE CASCADE ON UPDATE CASCADE', schema_name, schema_name);
    
    -- Note: User foreign key references public schema
    EXECUTE format('
        ALTER TABLE %I."_ShowToUser" 
        ADD CONSTRAINT "_ShowToUser_B_fkey" 
        FOREIGN KEY ("B") REFERENCES public."User"(id) 
        ON DELETE CASCADE ON UPDATE CASCADE', schema_name);
    
    -- Add indexes for performance
    EXECUTE format('CREATE INDEX IF NOT EXISTS "_ShowToUser_A_idx" ON %I."_ShowToUser"("A")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "_ShowToUser_B_idx" ON %I."_ShowToUser"("B")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "_ShowToUser_role_idx" ON %I."_ShowToUser"("role")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "_ShowToUser_A_B_idx" ON %I."_ShowToUser"("A", "B")', schema_name);
    
    RAISE NOTICE 'Created _ShowToUser table in schema %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Apply to all organization schemas
DO $$
DECLARE
    org_record RECORD;
BEGIN
    FOR org_record IN 
        SELECT DISTINCT 'org_' || LOWER(REPLACE(slug, '-', '_')) as schema_name, name
        FROM public."Organization"
        WHERE "isActive" = true
    LOOP
        -- Check if schema exists
        IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = org_record.schema_name) THEN
            BEGIN
                PERFORM create_show_user_table(org_record.schema_name);
                RAISE NOTICE 'Successfully created _ShowToUser table for organization: %', org_record.name;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE WARNING 'Failed to create table in schema %: %', org_record.schema_name, SQLERRM;
            END;
        ELSE
            RAISE WARNING 'Schema % does not exist for organization %', org_record.schema_name, org_record.name;
        END IF;
    END LOOP;
END $$;

-- Verify the tables were created
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename = '_ShowToUser' 
AND schemaname LIKE 'org_%'
ORDER BY schemaname;