-- Create test YouTube episodes to demonstrate integration
-- These will be created in the org_podcastflow_pro schema

-- Get a show ID from the first show (This Past Weekend w/ Theo Von)
DO $$
DECLARE
    v_show_id TEXT;
    v_org_id TEXT;
BEGIN
    -- Get the first show and its organization
    SELECT id, "organizationId" INTO v_show_id, v_org_id
    FROM org_podcastflow_pro."Show"
    WHERE name = 'This Past Weekend w/ Theo Von'
    LIMIT 1;
    
    IF v_show_id IS NOT NULL THEN
        -- Insert 3 sample YouTube-synced episodes
        INSERT INTO org_podcastflow_pro."Episode" (
            id, "showId", "organizationId", "episodeNumber", 
            title, duration, "durationSeconds",
            "airDate", status, "createdBy", "updatedAt", "youtubeVideoId", 
            "youtubeUrl", "youtubeViewCount", "youtubeLikeCount",
            "youtubeCommentCount", "thumbnailUrl", "publishUrl"
        ) VALUES 
        (
            'ep_youtube_001',
            v_show_id,
            v_org_id,
            501,
            'E501 - Theo Von on Comedy, Life & Everything',
            3600,
            3600,
            NOW() - INTERVAL '1 day',
            'published',
            'youtube-sync',
            NOW(),
            'dQw4w9WgXcQ',
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            1500000,
            85000,
            4200,
            'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        ),
        (
            'ep_youtube_002',
            v_show_id,
            v_org_id,
            502,
            'E502 - Special Guest Interview',
            4200,
            4200,
            NOW() - INTERVAL '3 days',
            'published',
            'youtube-sync',
            NOW(),
            'jNQXAC9IVRw',
            'https://www.youtube.com/watch?v=jNQXAC9IVRw',
            980000,
            52000,
            3100,
            'https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
            'https://www.youtube.com/watch?v=jNQXAC9IVRw'
        ),
        (
            'ep_youtube_003',
            v_show_id,
            v_org_id,
            503,
            'E503 - Behind the Scenes & Q&A',
            2700,
            2700,
            NOW() - INTERVAL '5 days',
            'published',
            'youtube-sync',
            NOW(),
            'kJQP7kiw5Fk',
            'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
            2100000,
            120000,
            8500,
            'https://i.ytimg.com/vi/kJQP7kiw5Fk/maxresdefault.jpg',
            'https://www.youtube.com/watch?v=kJQP7kiw5Fk'
        )
        ON CONFLICT (id) DO UPDATE SET
            "youtubeViewCount" = EXCLUDED."youtubeViewCount",
            "youtubeLikeCount" = EXCLUDED."youtubeLikeCount",
            "youtubeCommentCount" = EXCLUDED."youtubeCommentCount",
            "updatedAt" = NOW();
        
        -- Create a sync log entry to show successful sync
        INSERT INTO org_podcastflow_pro."YouTubeSyncLog" (
            id, "organizationId", "syncType", status, 
            "completedAt", "totalItems", "processedItems", 
            "successfulItems", "failedItems", "quotaUsed",
            "syncConfig", results
        ) VALUES (
            'sync_demo_001',
            v_org_id,
            'videos',
            'completed',
            NOW(),
            3,
            3,
            3,
            0,
            15,
            jsonb_build_object('showId', v_show_id, 'demo', true),
            jsonb_build_object(
                'created', 3,
                'updated', 0,
                'skipped', 0,
                'message', 'Demo sync completed successfully'
            )
        );
        
        -- Update the show's last sync time
        UPDATE org_podcastflow_pro."Show"
        SET "youtubeLastSyncAt" = NOW()
        WHERE id = v_show_id;
        
        RAISE NOTICE 'Successfully created 3 YouTube demo episodes for show %', v_show_id;
    ELSE
        RAISE NOTICE 'Show "This Past Weekend w/ Theo Von" not found';
    END IF;
END $$;