-- YouTube Quota Management Migration
-- Adds quota tracking tables to organization schemas

-- Function to add YouTube quota tables to an organization schema
CREATE OR REPLACE FUNCTION add_youtube_quota_tables(schema_name text)
RETURNS void AS $$
BEGIN
    -- Create youtube_quota_usage table for daily quota tracking
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.youtube_quota_usage (
            id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
            org_id text NOT NULL,
            usage_date date NOT NULL,
            used_units integer NOT NULL DEFAULT 0,
            created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT youtube_quota_usage_org_date_key UNIQUE (org_id, usage_date)
        )', schema_name);
    
    -- Add indexes for performance
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS youtube_quota_usage_org_id_idx 
        ON %I.youtube_quota_usage(org_id)', schema_name);
    
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS youtube_quota_usage_date_idx 
        ON %I.youtube_quota_usage(usage_date)', schema_name);
    
    -- Add YouTubeSyncSettings table if not exists
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."YouTubeSyncSettings" (
            id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "organizationId" text NOT NULL,
            "syncEnabled" boolean NOT NULL DEFAULT true,
            "syncFrequency" text DEFAULT ''daily'',
            "syncPausedReason" text,
            "syncPausedAt" timestamp(3),
            "lastSuccessfulSync" timestamp(3),
            "nextScheduledSync" timestamp(3),
            "defaultImportSettings" jsonb,
            "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "YouTubeSyncSettings_org_key" UNIQUE ("organizationId")
        )', schema_name);
    
    -- Add Notification table if not exists (for quota alerts)
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."Notification" (
            id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "organizationId" text NOT NULL,
            "userId" text,
            type text NOT NULL,
            title text NOT NULL,
            message text,
            severity text DEFAULT ''info'',
            "isRead" boolean NOT NULL DEFAULT false,
            "readAt" timestamp(3),
            metadata jsonb,
            "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )', schema_name);
    
    -- Add indexes for Notification table
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS notification_org_id_idx 
        ON %I."Notification"("organizationId")', schema_name);
    
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS notification_user_id_idx 
        ON %I."Notification"("userId")', schema_name);
    
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS notification_is_read_idx 
        ON %I."Notification"("isRead")', schema_name);
    
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS notification_type_idx 
        ON %I."Notification"(type)', schema_name);
    
    -- Add daily_quota_limit to Show table if not exists
    EXECUTE format('
        ALTER TABLE %I."Show" 
        ADD COLUMN IF NOT EXISTS "youtubeDailyQuotaLimit" integer DEFAULT NULL', schema_name);
    
    RAISE NOTICE ''YouTube quota tables added to schema: %'', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Apply to existing organization schemas
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        PERFORM add_youtube_quota_tables(schema_record.schema_name);
    END LOOP;
END $$;

-- Update the create_organization_schema function to include quota tables
CREATE OR REPLACE FUNCTION create_organization_schema(org_slug text)
RETURNS void AS $$
DECLARE
    schema_name text;
    existing_function text;
BEGIN
    schema_name := 'org_' || org_slug;
    
    -- Create schema if not exists
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
    
    -- Call existing schema creation (preserves all current tables)
    -- First check if the original function exists
    SELECT proname INTO existing_function
    FROM pg_proc 
    WHERE proname = 'create_organization_schema_original'
    LIMIT 1;
    
    IF existing_function IS NOT NULL THEN
        EXECUTE format('SELECT create_organization_schema_original(%L)', org_slug);
    END IF;
    
    -- Add YouTube quota tables
    PERFORM add_youtube_quota_tables(schema_name);
    
    RAISE NOTICE 'Organization schema % created/updated with YouTube quota tables', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Add quota-related columns to public.YouTubeApiConfig if not exists
ALTER TABLE public."YouTubeApiConfig"
ADD COLUMN IF NOT EXISTS "dailyQuotaLimit" integer DEFAULT 10000,
ADD COLUMN IF NOT EXISTS "quotaAlertThreshold" integer DEFAULT 80,
ADD COLUMN IF NOT EXISTS "autoStopOnQuotaExceeded" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "lastQuotaAlert80" timestamp(3),
ADD COLUMN IF NOT EXISTS "lastQuotaAlert100" timestamp(3);

-- Add organization timezone if not exists (for org-local midnight calculation)
ALTER TABLE public."Organization"
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';

-- Create a view for monitoring quota usage across all organizations
CREATE OR REPLACE VIEW public.youtube_quota_monitoring AS
WITH org_usage AS (
    SELECT 
        o.id as org_id,
        o.name as org_name,
        o.slug as org_slug,
        o.timezone,
        c.quotaLimit as daily_limit,
        c.quotaUsed as current_usage,
        c.quotaResetAt as reset_at,
        CASE 
            WHEN c.quotaLimit > 0 THEN (c.quotaUsed::float / c.quotaLimit * 100)
            ELSE 0
        END as usage_percentage
    FROM public."Organization" o
    LEFT JOIN public."YouTubeApiConfig" c ON o.id = c."organizationId"
    WHERE c.id IS NOT NULL
)
SELECT 
    org_id,
    org_name,
    org_slug,
    timezone,
    daily_limit,
    current_usage,
    usage_percentage,
    reset_at,
    CASE
        WHEN usage_percentage >= 100 THEN 'EXCEEDED'
        WHEN usage_percentage >= 80 THEN 'WARNING'
        WHEN usage_percentage >= 50 THEN 'MODERATE'
        ELSE 'NORMAL'
    END as status,
    daily_limit - current_usage as remaining_quota
FROM org_usage
ORDER BY usage_percentage DESC;

-- Grant permissions
GRANT SELECT ON public.youtube_quota_monitoring TO podcastflow;

COMMENT ON VIEW public.youtube_quota_monitoring IS 'Monitor YouTube API quota usage across all organizations';