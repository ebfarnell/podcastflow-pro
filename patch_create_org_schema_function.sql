-- This script patches the create_complete_org_schema function to include DeletionRequest table
-- It extracts the existing function, adds DeletionRequest, and recreates it

-- First, let's drop and recreate the function
DROP FUNCTION IF EXISTS create_complete_org_schema(TEXT, TEXT);

-- Copy the entire function from multi-tenant-complete-migration.sql and add DeletionRequest
-- This is done by sourcing the original file and modifying it
\i /home/ec2-user/podcastflow-pro/multi-tenant-complete-migration-with-deletion-request.sql