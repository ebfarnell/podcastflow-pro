-- Add guest information and sponsorship data to future episodes

-- First, let's create a table to track guest information if it doesn't exist
DO $$
BEGIN
    -- Create guest info table for each organization
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_podcastflow_pro' 
                   AND table_name = 'EpisodeGuest') THEN
        CREATE TABLE org_podcastflow_pro."EpisodeGuest" (
            id TEXT PRIMARY KEY,
            "episodeId" TEXT NOT NULL,
            "guestName" TEXT NOT NULL,
            "guestTitle" TEXT,
            "guestCompany" TEXT,
            "guestBio" TEXT,
            "contactEmail" TEXT,
            "contactPhone" TEXT,
            "confirmationStatus" TEXT DEFAULT 'pending',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX "EpisodeGuest_episodeId_idx" ON org_podcastflow_pro."EpisodeGuest"("episodeId");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_unfy' 
                   AND table_name = 'EpisodeGuest') THEN
        CREATE TABLE org_unfy."EpisodeGuest" (
            id TEXT PRIMARY KEY,
            "episodeId" TEXT NOT NULL,
            "guestName" TEXT NOT NULL,
            "guestTitle" TEXT,
            "guestCompany" TEXT,
            "guestBio" TEXT,
            "contactEmail" TEXT,
            "contactPhone" TEXT,
            "confirmationStatus" TEXT DEFAULT 'pending',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX "EpisodeGuest_episodeId_idx" ON org_unfy."EpisodeGuest"("episodeId");
    END IF;
END $$;

-- Add sponsorship allocation table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_podcastflow_pro' 
                   AND table_name = 'EpisodeSponsor') THEN
        CREATE TABLE org_podcastflow_pro."EpisodeSponsor" (
            id TEXT PRIMARY KEY,
            "episodeId" TEXT NOT NULL,
            "campaignId" TEXT NOT NULL,
            "slotType" TEXT NOT NULL, -- pre-roll, mid-roll, post-roll
            "slotDuration" INTEGER NOT NULL, -- in seconds
            "slotPosition" INTEGER DEFAULT 1,
            "talkingPoints" TEXT,
            "scriptStatus" TEXT DEFAULT 'pending', -- pending, approved, recorded
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX "EpisodeSponsor_episodeId_idx" ON org_podcastflow_pro."EpisodeSponsor"("episodeId");
        CREATE INDEX "EpisodeSponsor_campaignId_idx" ON org_podcastflow_pro."EpisodeSponsor"("campaignId");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_unfy' 
                   AND table_name = 'EpisodeSponsor') THEN
        CREATE TABLE org_unfy."EpisodeSponsor" (
            id TEXT PRIMARY KEY,
            "episodeId" TEXT NOT NULL,
            "campaignId" TEXT NOT NULL,
            "slotType" TEXT NOT NULL,
            "slotDuration" INTEGER NOT NULL,
            "slotPosition" INTEGER DEFAULT 1,
            "talkingPoints" TEXT,
            "scriptStatus" TEXT DEFAULT 'pending',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX "EpisodeSponsor_episodeId_idx" ON org_unfy."EpisodeSponsor"("episodeId");
        CREATE INDEX "EpisodeSponsor_campaignId_idx" ON org_unfy."EpisodeSponsor"("campaignId");
    END IF;
END $$;

-- Now add guest information to some future episodes
DO $$
DECLARE
    episode_record RECORD;
    guest_count INTEGER := 0;
    guest_names TEXT[] := ARRAY[
        'Sarah Johnson, CEO of TechStart',
        'Dr. Michael Chen, AI Research Lead at Stanford',
        'Jessica Williams, Marketing Director at GrowthCo',
        'Robert Davis, Bestselling Author',
        'Emily Rodriguez, Venture Partner at Innovation Fund',
        'David Kim, Product Manager at MegaCorp',
        'Lisa Thompson, Health & Wellness Expert',
        'James Anderson, Financial Advisor',
        'Maria Garcia, Startup Founder',
        'Christopher Lee, Industry Analyst'
    ];
    guest_titles TEXT[] := ARRAY[
        'Building the Future of Tech',
        'AI and Machine Learning Insights',
        'Growth Marketing Strategies',
        'Writing for Success',
        'Venture Capital Trends',
        'Product Development Excellence',
        'Holistic Health Approaches',
        'Financial Planning for Entrepreneurs',
        'From Idea to IPO',
        'Industry Trends and Analysis'
    ];
BEGIN
    -- Add guests to episodes with "Expert Interview" in the title
    FOR episode_record IN
        SELECT e.id, e."showId", e.title
        FROM org_podcastflow_pro."Episode" e
        WHERE e.status = 'scheduled'
          AND e."airDate" > CURRENT_DATE
          AND e."airDate" <= CURRENT_DATE + INTERVAL '1 month'
          AND e.title LIKE '%Expert Interview%'
        LIMIT 20
    LOOP
        INSERT INTO org_podcastflow_pro."EpisodeGuest" (
            id,
            "episodeId",
            "guestName",
            "guestTitle",
            "guestCompany",
            "guestBio",
            "contactEmail",
            "confirmationStatus"
        ) VALUES (
            'guest_' || substr(md5(random()::text), 1, 16),
            episode_record.id,
            guest_names[1 + (random() * 9)::INTEGER],
            guest_titles[1 + (random() * 9)::INTEGER],
            'Industry Leader',
            'Accomplished professional with over 15 years of experience in their field.',
            'booking@podcastflow.pro',
            CASE WHEN random() < 0.7 THEN 'confirmed' ELSE 'pending' END
        );
        
        guest_count := guest_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Added % guest records', guest_count;
END $$;

-- Add sponsorship allocations to future episodes
DO $$
DECLARE
    episode_record RECORD;
    campaign_record RECORD;
    sponsor_count INTEGER := 0;
    current_org TEXT;
BEGIN
    -- Process each organization
    FOR current_org IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Get active campaigns
        FOR campaign_record IN
            EXECUTE format('
                SELECT c.id, c.name, c."organizationId"
                FROM %I."Campaign" c
                WHERE c.status = ''active''
                  AND c."endDate" > CURRENT_DATE
                LIMIT 5
            ', current_org)
        LOOP
            -- Allocate to future episodes
            FOR episode_record IN
                EXECUTE format('
                    SELECT e.id
                    FROM %I."Episode" e
                    WHERE e.status = ''scheduled''
                      AND e."airDate" > CURRENT_DATE
                      AND e."airDate" <= CURRENT_DATE + INTERVAL ''2 weeks''
                    ORDER BY RANDOM()
                    LIMIT 10
                ', current_org)
            LOOP
                -- Add sponsorship slot
                EXECUTE format('
                    INSERT INTO %I."EpisodeSponsor" (
                        id,
                        "episodeId",
                        "campaignId",
                        "slotType",
                        "slotDuration",
                        "slotPosition",
                        "talkingPoints",
                        "scriptStatus"
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8
                    )
                ', current_org)
                USING
                    'sponsor_' || substr(md5(random()::text), 1, 16),
                    episode_record.id,
                    campaign_record.id,
                    CASE (random() * 3)::INTEGER
                        WHEN 0 THEN 'pre-roll'
                        WHEN 1 THEN 'mid-roll'
                        ELSE 'post-roll'
                    END,
                    CASE (random() * 3)::INTEGER
                        WHEN 0 THEN 15
                        WHEN 1 THEN 30
                        ELSE 60
                    END,
                    1,
                    'Key talking points: Product benefits, special offer code PODCAST20, call to action to visit website',
                    CASE WHEN random() < 0.5 THEN 'approved' ELSE 'pending' END;
                    
                sponsor_count := sponsor_count + 1;
            END LOOP;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Added % sponsorship allocations', sponsor_count;
END $$;

-- Update episode metadata with additional pre-release information
UPDATE org_podcastflow_pro."Episode" e
SET 
    "producerNotes" = CASE 
        WHEN e.title LIKE '%Q&A%' THEN 
            E'Questions prepared:\n1. Industry trends and challenges\n2. Personal journey and lessons learned\n3. Advice for listeners\n4. Future predictions\n\nTechnical notes: Extra mic for audience Q&A segment'
        WHEN e.title LIKE '%Deep Dive%' THEN 
            E'Research completed. Key topics:\n- Historical context\n- Current state analysis\n- Case studies prepared\n- Expert quotes gathered\n\nRuntime target: 45-50 minutes'
        WHEN e.title LIKE '%Expert Interview%' THEN 
            E'Pre-interview completed. Guest bio and talking points finalized.\n\nTechnical setup: Remote recording via riverside.fm\nBackup: Local recording on both ends'
        ELSE "producerNotes"
    END,
    "talentNotes" = CASE 
        WHEN e.title LIKE '%Special Episode%' THEN 
            E'Special format episode:\n- Extended intro segment\n- Multiple ad placements approved\n- Include listener feedback segment\n- Social media CTA at end'
        WHEN e.title LIKE '%Industry Insights%' THEN 
            E'Focus areas:\n- Recent industry news\n- Market analysis\n- Competitor updates\n- Trend predictions\n\nTone: Professional but conversational'
        ELSE "talentNotes"
    END
WHERE e.status = 'scheduled' 
  AND e."airDate" > CURRENT_DATE
  AND e."producerNotes" NOT LIKE '%Questions prepared%';

-- Summary report
SELECT 'Episode Metadata Summary' as report;

-- Count episodes by type and status
SELECT 
    CASE 
        WHEN title LIKE '%Expert Interview%' THEN 'Expert Interview'
        WHEN title LIKE '%Q&A%' THEN 'Q&A Session'
        WHEN title LIKE '%Deep Dive%' THEN 'Deep Dive'
        WHEN title LIKE '%Industry Insights%' THEN 'Industry Insights'
        WHEN title LIKE '%Weekly Update%' THEN 'Weekly Update'
        ELSE 'Other'
    END as episode_type,
    COUNT(*) as count,
    MIN("airDate") as first_air_date,
    MAX("airDate") as last_air_date
FROM org_podcastflow_pro."Episode"
WHERE status = 'scheduled'
  AND "airDate" > CURRENT_DATE
GROUP BY episode_type
ORDER BY count DESC;

-- Show guest bookings
SELECT 
    'Guest Bookings' as report,
    COUNT(*) as total_guests,
    SUM(CASE WHEN "confirmationStatus" = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
    SUM(CASE WHEN "confirmationStatus" = 'pending' THEN 1 ELSE 0 END) as pending
FROM org_podcastflow_pro."EpisodeGuest";

-- Show sponsorship allocations
SELECT 
    'Sponsorship Allocations' as report,
    "slotType",
    COUNT(*) as slots_allocated,
    SUM(CASE WHEN "scriptStatus" = 'approved' THEN 1 ELSE 0 END) as scripts_approved
FROM org_podcastflow_pro."EpisodeSponsor"
GROUP BY "slotType";