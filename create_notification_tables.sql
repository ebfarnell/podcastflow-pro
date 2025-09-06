-- Create Notification tables in organization schemas
-- Date: 2025-07-20
-- Purpose: Add missing Notification tables for multi-tenant architecture

-- Create Notification table in org_podcastflow_pro schema
CREATE TABLE IF NOT EXISTS org_podcastflow_pro."Notification" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    "actionUrl" TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON org_podcastflow_pro."Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_read_idx" ON org_podcastflow_pro."Notification"(read);
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON org_podcastflow_pro."Notification"("createdAt" DESC);

-- Create Notification table in org_unfy schema
CREATE TABLE IF NOT EXISTS org_unfy."Notification" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    "actionUrl" TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON org_unfy."Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_read_idx" ON org_unfy."Notification"(read);
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON org_unfy."Notification"("createdAt" DESC);

-- Verify tables were created
SELECT 
    schemaname,
    tablename,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = t.schemaname AND tablename = t.tablename) as index_count
FROM pg_tables t
WHERE tablename = 'Notification'
AND schemaname IN ('org_podcastflow_pro', 'org_unfy')
ORDER BY schemaname;