-- Add DeletionRequest table to existing organization schemas
-- This script adds the DeletionRequest table to org_podcastflow_pro and org_unfy schemas

-- Add to org_podcastflow_pro
SET search_path TO org_podcastflow_pro, public;

CREATE TABLE IF NOT EXISTS "DeletionRequest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "entityType" VARCHAR(50) NOT NULL CHECK ("entityType" IN ('advertiser', 'agency', 'campaign')),
    "entityId" TEXT NOT NULL,
    "entityName" VARCHAR(255) NOT NULL,
    "reason" TEXT,
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
    "reviewNotes" TEXT,
    "requestedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP,
    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deletion_request_status ON "DeletionRequest"(status);
CREATE INDEX IF NOT EXISTS idx_deletion_request_entity ON "DeletionRequest"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_deletion_request_requester ON "DeletionRequest"("requestedBy");

-- Add to org_unfy
SET search_path TO org_unfy, public;

CREATE TABLE IF NOT EXISTS "DeletionRequest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "entityType" VARCHAR(50) NOT NULL CHECK ("entityType" IN ('advertiser', 'agency', 'campaign')),
    "entityId" TEXT NOT NULL,
    "entityName" VARCHAR(255) NOT NULL,
    "reason" TEXT,
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
    "reviewNotes" TEXT,
    "requestedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP,
    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deletion_request_status ON "DeletionRequest"(status);
CREATE INDEX IF NOT EXISTS idx_deletion_request_entity ON "DeletionRequest"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_deletion_request_requester ON "DeletionRequest"("requestedBy");

-- Reset search path
SET search_path TO public;

-- Now update the create_complete_org_schema function to include DeletionRequest
-- We need to recreate the entire function with the DeletionRequest table included

-- First, save the current function definition
CREATE OR REPLACE FUNCTION create_complete_org_schema_v2(org_slug TEXT, org_id TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
BEGIN
    -- Call the original function
    PERFORM create_complete_org_schema(org_slug, org_id);
    
    -- Then add the DeletionRequest table
    schema_name := 'org_' || replace(lower(org_slug), '-', '_');
    EXECUTE format('SET search_path TO %I, public', schema_name);
    
    -- Create DeletionRequest table
    CREATE TABLE IF NOT EXISTS "DeletionRequest" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "entityType" VARCHAR(50) NOT NULL CHECK ("entityType" IN ('advertiser', 'agency', 'campaign')),
        "entityId" TEXT NOT NULL,
        "entityName" VARCHAR(255) NOT NULL,
        "reason" TEXT,
        "requestedBy" TEXT NOT NULL,
        "reviewedBy" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
        "reviewNotes" TEXT,
        "requestedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "reviewedAt" TIMESTAMP,
        CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_deletion_request_status ON "DeletionRequest"(status);
    CREATE INDEX IF NOT EXISTS idx_deletion_request_entity ON "DeletionRequest"("entityType", "entityId");
    CREATE INDEX IF NOT EXISTS idx_deletion_request_requester ON "DeletionRequest"("requestedBy");
    
    -- Reset search path
    SET search_path TO public;
END;
$$ LANGUAGE plpgsql;

-- Verify tables were created
SELECT 
    n.nspname as schema,
    c.relname as table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'DeletionRequest'
AND n.nspname IN ('org_podcastflow_pro', 'org_unfy')
ORDER BY n.nspname;