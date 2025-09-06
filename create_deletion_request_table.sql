-- Create DeletionRequest table in organization schemas
-- This table tracks deletion requests for various entities that require admin approval

-- For org_podcastflow_pro schema
CREATE TABLE IF NOT EXISTS org_podcastflow_pro."DeletionRequest" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "entityType" VARCHAR(50) NOT NULL CHECK ("entityType" IN ('advertiser', 'agency', 'campaign')),
    "entityId" TEXT NOT NULL,
    "entityName" VARCHAR(255) NOT NULL,
    reason TEXT,
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deletion_request_status ON org_podcastflow_pro."DeletionRequest"(status);
CREATE INDEX IF NOT EXISTS idx_deletion_request_entity ON org_podcastflow_pro."DeletionRequest"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_deletion_request_requester ON org_podcastflow_pro."DeletionRequest"("requestedBy");

-- For org_unfy schema
CREATE TABLE IF NOT EXISTS org_unfy."DeletionRequest" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "entityType" VARCHAR(50) NOT NULL CHECK ("entityType" IN ('advertiser', 'agency', 'campaign')),
    "entityId" TEXT NOT NULL,
    "entityName" VARCHAR(255) NOT NULL,
    reason TEXT,
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deletion_request_status ON org_unfy."DeletionRequest"(status);
CREATE INDEX IF NOT EXISTS idx_deletion_request_entity ON org_unfy."DeletionRequest"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_deletion_request_requester ON org_unfy."DeletionRequest"("requestedBy");

-- Verify tables were created
SELECT 
    n.nspname as schema,
    c.relname as table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'DeletionRequest'
AND n.nspname IN ('org_podcastflow_pro', 'org_unfy')
ORDER BY n.nspname;