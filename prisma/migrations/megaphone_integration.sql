-- Megaphone Integration Tables
-- Each organization gets its own set of tables to ensure data isolation

-- Integration credentials and settings
CREATE TABLE IF NOT EXISTS "MegaphoneIntegration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncFrequency" TEXT DEFAULT 'daily', -- 'manual', 'hourly', 'daily', 'weekly'
    "syncStatus" TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'error', 'success'
    "lastError" TEXT,
    "settings" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MegaphoneIntegration_pkey" PRIMARY KEY ("id")
);

-- Megaphone Networks (organizations can have multiple networks)
CREATE TABLE IF NOT EXISTS "MegaphoneNetwork" (
    "id" TEXT NOT NULL,
    "megaphoneId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "podcastCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "megaphoneCreatedAt" TIMESTAMP(3),
    "rawData" JSONB,

    CONSTRAINT "MegaphoneNetwork_pkey" PRIMARY KEY ("id")
);

-- Megaphone Podcasts
CREATE TABLE IF NOT EXISTS "MegaphonePodcast" (
    "id" TEXT NOT NULL,
    "megaphoneId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "networkId" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT,
    "author" TEXT,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "copyright" TEXT,
    "language" TEXT,
    "link" TEXT,
    "imageFile" TEXT,
    "feedUrl" TEXT,
    "explicit" TEXT,
    "itunesCategories" TEXT[],
    "uid" TEXT,
    "slug" TEXT,
    "episodesCount" INTEGER DEFAULT 0,
    "podtracEnabled" BOOLEAN DEFAULT false,
    "itunesIdentifier" TEXT,
    "spotifyIdentifier" TEXT,
    "externalId" TEXT,
    "podcastType" TEXT,
    "advertisingTags" TEXT[],
    "spanOptIn" TEXT,
    "adFree" BOOLEAN DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "megaphoneCreatedAt" TIMESTAMP(3),
    "megaphoneUpdatedAt" TIMESTAMP(3),
    "rawData" JSONB,

    CONSTRAINT "MegaphonePodcast_pkey" PRIMARY KEY ("id")
);

-- Megaphone Episodes
CREATE TABLE IF NOT EXISTS "MegaphoneEpisode" (
    "id" TEXT NOT NULL,
    "megaphoneId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT,
    "author" TEXT,
    "pubdate" TIMESTAMP(3),
    "link" TEXT,
    "imageFile" TEXT,
    "audioFile" TEXT,
    "downloadUrl" TEXT,
    "duration" DOUBLE PRECISION,
    "size" BIGINT,
    "explicit" TEXT,
    "episodeType" TEXT,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "uid" TEXT,
    "guid" TEXT,
    "bitrate" INTEGER,
    "samplerate" INTEGER,
    "channelMode" TEXT,
    "preCount" INTEGER DEFAULT 0,
    "postCount" INTEGER DEFAULT 0,
    "insertionPoints" DOUBLE PRECISION[],
    "cuepoints" JSONB,
    "draft" BOOLEAN DEFAULT false,
    "externalId" TEXT,
    "cleanTitle" TEXT,
    "customFields" JSONB,
    "advertisingTags" TEXT[],
    "status" TEXT,
    "audioFileStatus" TEXT,
    "adFree" BOOLEAN DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "megaphoneCreatedAt" TIMESTAMP(3),
    "megaphoneUpdatedAt" TIMESTAMP(3),
    "rawData" JSONB,

    CONSTRAINT "MegaphoneEpisode_pkey" PRIMARY KEY ("id")
);

-- Sync logs for audit trail
CREATE TABLE IF NOT EXISTS "MegaphoneSyncLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL, -- 'full', 'incremental', 'podcast', 'episode'
    "status" TEXT NOT NULL, -- 'started', 'completed', 'failed'
    "itemsProcessed" INTEGER DEFAULT 0,
    "itemsFailed" INTEGER DEFAULT 0,
    "errors" JSONB,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MegaphoneSyncLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "MegaphoneIntegration_organizationId_key" ON "MegaphoneIntegration"("organizationId");
CREATE INDEX "MegaphoneNetwork_organizationId_idx" ON "MegaphoneNetwork"("organizationId");
CREATE UNIQUE INDEX "MegaphoneNetwork_megaphoneId_organizationId_key" ON "MegaphoneNetwork"("megaphoneId", "organizationId");
CREATE INDEX "MegaphonePodcast_organizationId_idx" ON "MegaphonePodcast"("organizationId");
CREATE INDEX "MegaphonePodcast_networkId_idx" ON "MegaphonePodcast"("networkId");
CREATE UNIQUE INDEX "MegaphonePodcast_megaphoneId_organizationId_key" ON "MegaphonePodcast"("megaphoneId", "organizationId");
CREATE INDEX "MegaphoneEpisode_organizationId_idx" ON "MegaphoneEpisode"("organizationId");
CREATE INDEX "MegaphoneEpisode_podcastId_idx" ON "MegaphoneEpisode"("podcastId");
CREATE UNIQUE INDEX "MegaphoneEpisode_megaphoneId_organizationId_key" ON "MegaphoneEpisode"("megaphoneId", "organizationId");
CREATE INDEX "MegaphoneSyncLog_organizationId_idx" ON "MegaphoneSyncLog"("organizationId");
CREATE INDEX "MegaphoneSyncLog_status_idx" ON "MegaphoneSyncLog"("status");

-- Add foreign keys
ALTER TABLE "MegaphoneIntegration" ADD CONSTRAINT "MegaphoneIntegration_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MegaphoneNetwork" ADD CONSTRAINT "MegaphoneNetwork_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MegaphonePodcast" ADD CONSTRAINT "MegaphonePodcast_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MegaphonePodcast" ADD CONSTRAINT "MegaphonePodcast_networkId_fkey" 
    FOREIGN KEY ("networkId") REFERENCES "MegaphoneNetwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MegaphoneEpisode" ADD CONSTRAINT "MegaphoneEpisode_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MegaphoneEpisode" ADD CONSTRAINT "MegaphoneEpisode_podcastId_fkey" 
    FOREIGN KEY ("podcastId") REFERENCES "MegaphonePodcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MegaphoneSyncLog" ADD CONSTRAINT "MegaphoneSyncLog_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;