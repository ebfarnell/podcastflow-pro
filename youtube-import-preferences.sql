-- Add YouTube import preferences to each organization schema
DO $$
DECLARE
    org_schema TEXT;
BEGIN
    -- Add columns to Show table for import preferences
    FOR org_schema IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Add import preference columns to Show table
        EXECUTE format('
            ALTER TABLE %I."Show" 
            ADD COLUMN IF NOT EXISTS "youtubeImportPodcasts" BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS "youtubeImportShorts" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "youtubeImportClips" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "youtubeImportLive" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "youtubeMinDuration" INTEGER DEFAULT 600,
            ADD COLUMN IF NOT EXISTS "youtubeMaxDuration" INTEGER DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS "youtubeTitleFilter" TEXT DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS "youtubeExcludeFilter" TEXT DEFAULT NULL
        ', org_schema);

        -- Create YouTube import log table for tracking what was imported/skipped
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."YouTubeImportLog" (
                id TEXT PRIMARY KEY,
                "showId" TEXT NOT NULL,
                "organizationId" TEXT NOT NULL,
                "videoId" TEXT NOT NULL,
                "videoTitle" TEXT NOT NULL,
                "videoDuration" INTEGER,
                "videoType" TEXT,
                "action" TEXT NOT NULL, -- imported, skipped, updated
                "reason" TEXT,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY ("showId") REFERENCES %I."Show"(id) ON DELETE CASCADE
            )
        ', org_schema, org_schema);

        -- Create index for efficient queries
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS "YouTubeImportLog_showId_idx" 
            ON %I."YouTubeImportLog"("showId", "createdAt" DESC)
        ', org_schema);
    END LOOP;
END $$;

-- Add content type detection rules to public schema
CREATE TABLE IF NOT EXISTS "YouTubeContentRules" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT,
    "ruleName" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL, -- 'podcast', 'short', 'clip', 'live'
    "priority" INTEGER DEFAULT 0,
    "titlePattern" TEXT,
    "durationMin" INTEGER,
    "durationMax" INTEGER,
    "channelPattern" TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default content detection rules
INSERT INTO "YouTubeContentRules" ("ruleName", "ruleType", "priority", "titlePattern", "durationMin", "durationMax") VALUES
-- Podcast detection rules
('Full Episode Pattern', 'podcast', 100, '#\d+|Episode \d+|Ep\. \d+|Ep \d+', 1200, NULL),
('This Past Weekend Pattern', 'podcast', 100, 'This Past Weekend.*#\d+', 1200, NULL),
('Long Form Content', 'podcast', 50, NULL, 2400, NULL),

-- Shorts detection rules  
('YouTube Shorts Duration', 'short', 100, NULL, NULL, 60),
('Shorts Title Pattern', 'short', 90, '#shorts|#short', NULL, 90),

-- Clips detection rules
('Clip Pattern', 'clip', 80, 'clip|highlight|best of|moments', 60, 600),
('Short Clip Duration', 'clip', 70, NULL, 60, 600),

-- Live stream detection rules
('Live Stream Pattern', 'live', 100, 'LIVE|Live Stream|Livestream', 3600, NULL),
('Live Q&A Pattern', 'live', 90, 'Q&A|AMA|Ask Me Anything', 1800, NULL)
ON CONFLICT DO NOTHING;