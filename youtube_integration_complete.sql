-- Complete YouTube Integration Database Schema
-- This script creates all necessary tables for YouTube integration functionality

-- First, ensure syncFrequency is added to YouTubeApiConfig (in case it's missing)
ALTER TABLE "YouTubeApiConfig" ADD COLUMN IF NOT EXISTS "syncFrequency" TEXT DEFAULT 'daily';

-- Create YouTubeChannel table for tracking connected channels
CREATE TABLE IF NOT EXISTS "YouTubeChannel" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL, -- YouTube's channel ID
    "channelName" TEXT NOT NULL, -- Channel handle (@username)
    "channelTitle" TEXT NOT NULL, -- Display name
    "description" TEXT,
    "customUrl" TEXT,
    "publishedAt" TIMESTAMP,
    
    -- Statistics
    "subscriberCount" BIGINT DEFAULT 0,
    "videoCount" INTEGER DEFAULT 0,
    "viewCount" BIGINT DEFAULT 0,
    
    -- Thumbnails (stored as JSON)
    "thumbnails" JSONB DEFAULT '{}',
    
    -- Channel branding
    "bannerImageUrl" TEXT,
    "profileImageUrl" TEXT,
    
    -- Monetization and features
    "monetizationEnabled" BOOLEAN DEFAULT false,
    "verificationStatus" TEXT DEFAULT 'unverified', -- unverified, verified, partner
    
    -- Sync tracking
    "isActive" BOOLEAN DEFAULT true,
    "lastSyncAt" TIMESTAMP,
    "syncStatus" TEXT DEFAULT 'pending', -- pending, syncing, completed, failed
    "syncError" TEXT,
    
    -- Timestamps
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE("organizationId", "channelId"),
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- Create YouTubeVideo table for tracking videos
CREATE TABLE IF NOT EXISTS "YouTubeVideo" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL, -- Foreign key to YouTubeChannel
    "videoId" TEXT NOT NULL, -- YouTube's video ID
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publishedAt" TIMESTAMP,
    "duration" TEXT, -- ISO 8601 duration (PT4M13S)
    "durationSeconds" INTEGER, -- Parsed duration in seconds
    
    -- Video status and privacy
    "privacyStatus" TEXT DEFAULT 'public', -- public, private, unlisted
    "uploadStatus" TEXT DEFAULT 'processed', -- processed, uploaded, failed
    "license" TEXT DEFAULT 'youtube', -- youtube, creativeCommon
    
    -- Statistics
    "viewCount" BIGINT DEFAULT 0,
    "likeCount" INTEGER DEFAULT 0,
    "commentCount" INTEGER DEFAULT 0,
    "favoriteCount" INTEGER DEFAULT 0,
    
    -- Thumbnails and media
    "thumbnails" JSONB DEFAULT '{}',
    "tags" TEXT[], -- Array of tags
    "categoryId" TEXT,
    "defaultLanguage" TEXT,
    "defaultAudioLanguage" TEXT,
    
    -- Monetization
    "monetizationDetails" JSONB DEFAULT '{}',
    
    -- Content ratings and restrictions
    "contentRating" JSONB DEFAULT '{}',
    "restrictions" TEXT[],
    
    -- Sync tracking
    "lastSyncAt" TIMESTAMP,
    "syncStatus" TEXT DEFAULT 'pending',
    
    -- Timestamps
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE("organizationId", "videoId"),
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- Create YouTubePlaylist table for tracking playlists
CREATE TABLE IF NOT EXISTS "YouTubePlaylist" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL, -- Foreign key to YouTubeChannel
    "playlistId" TEXT NOT NULL, -- YouTube's playlist ID
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publishedAt" TIMESTAMP,
    
    -- Playlist configuration
    "privacyStatus" TEXT DEFAULT 'public',
    "itemCount" INTEGER DEFAULT 0,
    
    -- Thumbnails
    "thumbnails" JSONB DEFAULT '{}',
    
    -- Sync tracking
    "lastSyncAt" TIMESTAMP,
    "syncStatus" TEXT DEFAULT 'pending',
    
    -- Timestamps
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE("organizationId", "playlistId"),
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- Create YouTubeAnalytics table for storing analytics data
CREATE TABLE IF NOT EXISTS "YouTubeAnalytics" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "channelId" TEXT, -- Can be null for account-level analytics
    "videoId" TEXT, -- Can be null for channel-level analytics
    "date" DATE NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'day', -- day, week, month, year
    
    -- View metrics
    "views" BIGINT DEFAULT 0,
    "impressions" BIGINT DEFAULT 0,
    "clickThroughRate" DECIMAL(5,4) DEFAULT 0,
    
    -- Engagement metrics
    "likes" INTEGER DEFAULT 0,
    "dislikes" INTEGER DEFAULT 0,
    "comments" INTEGER DEFAULT 0,
    "shares" INTEGER DEFAULT 0,
    "subscribersGained" INTEGER DEFAULT 0,
    "subscribersLost" INTEGER DEFAULT 0,
    
    -- Watch time metrics
    "watchTimeMinutes" BIGINT DEFAULT 0,
    "averageViewDuration" INTEGER DEFAULT 0, -- in seconds
    "averageViewPercentage" DECIMAL(5,2) DEFAULT 0,
    
    -- Revenue metrics (if monetized)
    "estimatedRevenue" DECIMAL(10,2) DEFAULT 0,
    "adImpressions" BIGINT DEFAULT 0,
    "cpm" DECIMAL(8,2) DEFAULT 0, -- Cost per mille
    "rpm" DECIMAL(8,2) DEFAULT 0, -- Revenue per mille
    
    -- Traffic source breakdown (stored as JSON)
    "trafficSources" JSONB DEFAULT '{}',
    "deviceTypes" JSONB DEFAULT '{}',
    "geography" JSONB DEFAULT '{}',
    "demographics" JSONB DEFAULT '{}',
    
    -- Timestamps
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE("organizationId", "channelId", "videoId", "date", "period"),
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- Create YouTubeSyncLog table for tracking sync operations
CREATE TABLE IF NOT EXISTS "YouTubeSyncLog" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL, -- 'channels', 'videos', 'analytics', 'playlists'
    "status" TEXT NOT NULL DEFAULT 'started', -- started, completed, failed
    "startedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP,
    
    -- Progress tracking
    "totalItems" INTEGER DEFAULT 0,
    "processedItems" INTEGER DEFAULT 0,
    "successfulItems" INTEGER DEFAULT 0,
    "failedItems" INTEGER DEFAULT 0,
    
    -- Error tracking
    "errorMessage" TEXT,
    "errorDetails" JSONB DEFAULT '{}',
    
    -- Quota usage
    "quotaUsed" INTEGER DEFAULT 0,
    
    -- Sync configuration
    "syncConfig" JSONB DEFAULT '{}',
    
    -- Results summary
    "results" JSONB DEFAULT '{}',
    
    -- Timestamps
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_youtube_channel_org_id" ON "YouTubeChannel"("organizationId");
CREATE INDEX IF NOT EXISTS "idx_youtube_channel_channel_id" ON "YouTubeChannel"("channelId");
CREATE INDEX IF NOT EXISTS "idx_youtube_channel_active" ON "YouTubeChannel"("isActive");
CREATE INDEX IF NOT EXISTS "idx_youtube_channel_last_sync" ON "YouTubeChannel"("lastSyncAt");

CREATE INDEX IF NOT EXISTS "idx_youtube_video_org_id" ON "YouTubeVideo"("organizationId");
CREATE INDEX IF NOT EXISTS "idx_youtube_video_channel_id" ON "YouTubeVideo"("channelId");
CREATE INDEX IF NOT EXISTS "idx_youtube_video_video_id" ON "YouTubeVideo"("videoId");
CREATE INDEX IF NOT EXISTS "idx_youtube_video_published" ON "YouTubeVideo"("publishedAt");
CREATE INDEX IF NOT EXISTS "idx_youtube_video_views" ON "YouTubeVideo"("viewCount");

CREATE INDEX IF NOT EXISTS "idx_youtube_playlist_org_id" ON "YouTubePlaylist"("organizationId");
CREATE INDEX IF NOT EXISTS "idx_youtube_playlist_channel_id" ON "YouTubePlaylist"("channelId");
CREATE INDEX IF NOT EXISTS "idx_youtube_playlist_playlist_id" ON "YouTubePlaylist"("playlistId");

CREATE INDEX IF NOT EXISTS "idx_youtube_analytics_org_id" ON "YouTubeAnalytics"("organizationId");
CREATE INDEX IF NOT EXISTS "idx_youtube_analytics_channel_id" ON "YouTubeAnalytics"("channelId");
CREATE INDEX IF NOT EXISTS "idx_youtube_analytics_video_id" ON "YouTubeAnalytics"("videoId");
CREATE INDEX IF NOT EXISTS "idx_youtube_analytics_date" ON "YouTubeAnalytics"("date");
CREATE INDEX IF NOT EXISTS "idx_youtube_analytics_period" ON "YouTubeAnalytics"("period");

CREATE INDEX IF NOT EXISTS "idx_youtube_sync_log_org_id" ON "YouTubeSyncLog"("organizationId");
CREATE INDEX IF NOT EXISTS "idx_youtube_sync_log_type" ON "YouTubeSyncLog"("syncType");
CREATE INDEX IF NOT EXISTS "idx_youtube_sync_log_status" ON "YouTubeSyncLog"("status");
CREATE INDEX IF NOT EXISTS "idx_youtube_sync_log_started" ON "YouTubeSyncLog"("startedAt");

-- Add comments for documentation
COMMENT ON TABLE "YouTubeChannel" IS 'Stores connected YouTube channels for each organization';
COMMENT ON TABLE "YouTubeVideo" IS 'Stores YouTube videos from connected channels';
COMMENT ON TABLE "YouTubePlaylist" IS 'Stores YouTube playlists from connected channels';
COMMENT ON TABLE "YouTubeAnalytics" IS 'Stores YouTube analytics data aggregated by date and period';
COMMENT ON TABLE "YouTubeSyncLog" IS 'Tracks YouTube data synchronization operations';

COMMENT ON COLUMN "YouTubeChannel"."channelId" IS 'YouTube Channel ID (UCxxxxx format)';
COMMENT ON COLUMN "YouTubeChannel"."channelName" IS 'Channel handle (@username)';
COMMENT ON COLUMN "YouTubeChannel"."channelTitle" IS 'Channel display name';
COMMENT ON COLUMN "YouTubeVideo"."videoId" IS 'YouTube Video ID (11 characters)';
COMMENT ON COLUMN "YouTubeVideo"."duration" IS 'ISO 8601 duration format (PT4M13S)';
COMMENT ON COLUMN "YouTubeVideo"."durationSeconds" IS 'Duration converted to seconds for easier querying';
COMMENT ON COLUMN "YouTubeAnalytics"."cpm" IS 'Cost per thousand impressions';
COMMENT ON COLUMN "YouTubeAnalytics"."rpm" IS 'Revenue per thousand impressions';