-- Create YouTube API configuration tables
-- These store organization-specific YouTube API settings

-- Create YouTubeApiConfig table in public schema
CREATE TABLE IF NOT EXISTS public."YouTubeApiConfig" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL UNIQUE,
    "apiKey" TEXT, -- Encrypted API key
    "clientId" TEXT,
    "clientSecret" TEXT,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "quotaLimit" INTEGER DEFAULT 10000,
    "quotaUsed" INTEGER DEFAULT 0,
    "quotaResetAt" TIMESTAMP(3),
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YouTubeApiConfig_organizationId_fkey" 
        FOREIGN KEY ("organizationId") 
        REFERENCES public."Organization"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS "YouTubeApiConfig_organizationId_idx" 
    ON public."YouTubeApiConfig"("organizationId");

-- Now create YouTubeSyncLog table in each organization schema
DO $$
DECLARE
    org_schema TEXT;
BEGIN
    -- For each organization schema
    FOR org_schema IN 
        SELECT 'org_' || LOWER(REPLACE(slug, '-', '_')) 
        FROM public."Organization" 
        WHERE "isActive" = true
    LOOP
        -- Create YouTubeSyncLog table
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."YouTubeSyncLog" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "organizationId" TEXT NOT NULL,
                "syncType" TEXT NOT NULL,
                "status" TEXT NOT NULL,
                "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "completedAt" TIMESTAMP(3),
                "totalItems" INTEGER DEFAULT 0,
                "processedItems" INTEGER DEFAULT 0,
                "successfulItems" INTEGER DEFAULT 0,
                "failedItems" INTEGER DEFAULT 0,
                "errorMessage" TEXT,
                "errorDetails" JSONB,
                "syncConfig" JSONB,
                "results" JSONB,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )', org_schema);
        
        -- Create indexes
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "YouTubeSyncLog_organizationId_idx" 
            ON %I."YouTubeSyncLog"("organizationId")', org_schema);
        
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "YouTubeSyncLog_status_idx" 
            ON %I."YouTubeSyncLog"("status")', org_schema);
        
        RAISE NOTICE 'Created YouTubeSyncLog table in schema %', org_schema;
    END LOOP;
END $$;

-- Insert a default API configuration for PodcastFlow Pro organization
-- Using environment variable or a placeholder that can be updated
INSERT INTO public."YouTubeApiConfig" (
    "organizationId",
    "apiKey",
    "quotaLimit",
    "quotaUsed",
    "isActive"
) 
SELECT 
    id,
    'YOUR_YOUTUBE_API_KEY_HERE', -- This should be updated with actual API key
    10000,
    0,
    true
FROM public."Organization"
WHERE slug = 'podcastflow-pro'
ON CONFLICT ("organizationId") DO NOTHING;

-- Add a comment to remind about API key update
COMMENT ON TABLE public."YouTubeApiConfig" IS 'Stores YouTube API configuration for each organization. API keys should be encrypted before storage.';