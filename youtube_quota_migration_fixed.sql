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
    
    RAISE NOTICE 'YouTube quota tables added to schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Apply to existing organization schemas
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name::text as schema_name
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        PERFORM add_youtube_quota_tables(schema_record.schema_name);
    END LOOP;
END $$;

-- Add quota-related columns to public.YouTubeApiConfig if not exists (using sudo permissions)
DO $$
BEGIN
    -- Check if columns exist before adding
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'YouTubeApiConfig' 
                   AND column_name = 'dailyQuotaLimit') THEN
        ALTER TABLE public."YouTubeApiConfig"
        ADD COLUMN "dailyQuotaLimit" integer DEFAULT 10000;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'YouTubeApiConfig' 
                   AND column_name = 'quotaAlertThreshold') THEN
        ALTER TABLE public."YouTubeApiConfig"
        ADD COLUMN "quotaAlertThreshold" integer DEFAULT 80;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'YouTubeApiConfig' 
                   AND column_name = 'autoStopOnQuotaExceeded') THEN
        ALTER TABLE public."YouTubeApiConfig"
        ADD COLUMN "autoStopOnQuotaExceeded" boolean DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'YouTubeApiConfig' 
                   AND column_name = 'lastQuotaAlert80') THEN
        ALTER TABLE public."YouTubeApiConfig"
        ADD COLUMN "lastQuotaAlert80" timestamp(3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'YouTubeApiConfig' 
                   AND column_name = 'lastQuotaAlert100') THEN
        ALTER TABLE public."YouTubeApiConfig"
        ADD COLUMN "lastQuotaAlert100" timestamp(3);
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privileges to alter YouTubeApiConfig table';
END $$;

-- Add organization timezone if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'Organization' 
                   AND column_name = 'timezone') THEN
        ALTER TABLE public."Organization"
        ADD COLUMN timezone text DEFAULT 'America/New_York';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privileges to alter Organization table';
END $$;

-- Create a view for monitoring quota usage across all organizations
CREATE OR REPLACE VIEW public.youtube_quota_monitoring AS
WITH org_usage AS (
    SELECT 
        o.id as org_id,
        o.name as org_name,
        o.slug as org_slug,
        COALESCE(o.timezone, 'America/New_York') as timezone,
        COALESCE(c."quotaLimit", 10000) as daily_limit,
        COALESCE(c."quotaUsed", 0) as current_usage,
        c."quotaResetAt" as reset_at,
        CASE 
            WHEN COALESCE(c."quotaLimit", 10000) > 0 
            THEN (COALESCE(c."quotaUsed", 0)::float / COALESCE(c."quotaLimit", 10000) * 100)
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