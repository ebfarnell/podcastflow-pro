-- Add platform integration fields to public schema
ALTER TABLE "public"."Organization" ADD COLUMN IF NOT EXISTS "youtubeChannelId" VARCHAR(255);
ALTER TABLE "public"."Organization" ADD COLUMN IF NOT EXISTS "megaphoneNetworkId" VARCHAR(255);

-- Add OrganizationSettings table if not exists
CREATE TABLE IF NOT EXISTS "public"."OrganizationSettings" (
    "id" TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
    "organizationId" TEXT NOT NULL UNIQUE,
    "youtubeAccessToken" TEXT,
    "youtubeRefreshToken" TEXT,
    "megaphoneApiKey" TEXT,
    "megaphoneNetworkId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE
);

-- Add platform fields to each org schema
DO $$
DECLARE
    org_schema TEXT;
BEGIN
    FOR org_schema IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'org_%'
    LOOP
        -- Add YouTube and Megaphone IDs to Show table
        EXECUTE format('ALTER TABLE %I."Show" ADD COLUMN IF NOT EXISTS "youtubeChannelId" VARCHAR(255)', org_schema);
        EXECUTE format('ALTER TABLE %I."Show" ADD COLUMN IF NOT EXISTS "megaphonePodcastId" VARCHAR(255)', org_schema);
        
        -- Add platform IDs to Episode table  
        EXECUTE format('ALTER TABLE %I."Episode" ADD COLUMN IF NOT EXISTS "youtubeVideoId" VARCHAR(255)', org_schema);
        EXECUTE format('ALTER TABLE %I."Episode" ADD COLUMN IF NOT EXISTS "megaphoneEpisodeId" VARCHAR(255)', org_schema);
        EXECUTE format('ALTER TABLE %I."Episode" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3)', org_schema);
        
        -- Create indexes for faster lookups
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_Show_youtubeChannelId_idx" ON %I."Show"("youtubeChannelId")', org_schema, org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_Show_megaphonePodcastId_idx" ON %I."Show"("megaphonePodcastId")', org_schema, org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_Episode_publishedAt_idx" ON %I."Episode"("publishedAt")', org_schema, org_schema);
    END LOOP;
END $$;