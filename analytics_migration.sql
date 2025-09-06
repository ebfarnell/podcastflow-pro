-- Analytics Migration SQL
-- Add analytics models for tracking downloads, ratings, and revenue

-- Episode Analytics table
CREATE TABLE "EpisodeAnalytics" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "uniqueListeners" INTEGER NOT NULL DEFAULT 0,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "avgListenTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spotifyListens" INTEGER NOT NULL DEFAULT 0,
    "appleListens" INTEGER NOT NULL DEFAULT 0,
    "googleListens" INTEGER NOT NULL DEFAULT 0,
    "otherListens" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "adRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeAnalytics_pkey" PRIMARY KEY ("id")
);

-- Episode Ratings table
CREATE TABLE "EpisodeRating" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "userId" TEXT,
    "rating" DOUBLE PRECISION NOT NULL,
    "review" TEXT,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeRating_pkey" PRIMARY KEY ("id")
);

-- Show Analytics table
CREATE TABLE "ShowAnalytics" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodType" TEXT NOT NULL DEFAULT 'daily',
    "totalDownloads" INTEGER NOT NULL DEFAULT 0,
    "totalListeners" INTEGER NOT NULL DEFAULT 0,
    "avgDownloadsPerEpisode" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRatings" INTEGER NOT NULL DEFAULT 0,
    "newSubscribers" INTEGER NOT NULL DEFAULT 0,
    "lostSubscribers" INTEGER NOT NULL DEFAULT 0,
    "netSubscribers" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sponsorRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowAnalytics_pkey" PRIMARY KEY ("id")
);

-- Analytics Events table
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "platform" TEXT,
    "deviceType" TEXT,
    "location" TEXT,
    "referrer" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX "EpisodeAnalytics_episodeId_date_key" ON "EpisodeAnalytics"("episodeId", "date");
CREATE UNIQUE INDEX "EpisodeRating_episodeId_userId_key" ON "EpisodeRating"("episodeId", "userId");
CREATE UNIQUE INDEX "ShowAnalytics_showId_date_periodType_key" ON "ShowAnalytics"("showId", "date", "periodType");

-- Create indexes for performance
CREATE INDEX "EpisodeAnalytics_episodeId_idx" ON "EpisodeAnalytics"("episodeId");
CREATE INDEX "EpisodeAnalytics_date_idx" ON "EpisodeAnalytics"("date");
CREATE INDEX "EpisodeAnalytics_organizationId_idx" ON "EpisodeAnalytics"("organizationId");

CREATE INDEX "EpisodeRating_episodeId_idx" ON "EpisodeRating"("episodeId");
CREATE INDEX "EpisodeRating_userId_idx" ON "EpisodeRating"("userId");
CREATE INDEX "EpisodeRating_rating_idx" ON "EpisodeRating"("rating");

CREATE INDEX "ShowAnalytics_showId_idx" ON "ShowAnalytics"("showId");
CREATE INDEX "ShowAnalytics_date_idx" ON "ShowAnalytics"("date");
CREATE INDEX "ShowAnalytics_organizationId_idx" ON "ShowAnalytics"("organizationId");

CREATE INDEX "AnalyticsEvent_organizationId_idx" ON "AnalyticsEvent"("organizationId");
CREATE INDEX "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");
CREATE INDEX "AnalyticsEvent_entityType_entityId_idx" ON "AnalyticsEvent"("entityType", "entityId");
CREATE INDEX "AnalyticsEvent_timestamp_idx" ON "AnalyticsEvent"("timestamp");
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");

-- Add foreign key constraints
ALTER TABLE "EpisodeAnalytics" ADD CONSTRAINT "EpisodeAnalytics_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpisodeAnalytics" ADD CONSTRAINT "EpisodeAnalytics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EpisodeRating" ADD CONSTRAINT "EpisodeRating_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpisodeRating" ADD CONSTRAINT "EpisodeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShowAnalytics" ADD CONSTRAINT "ShowAnalytics_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShowAnalytics" ADD CONSTRAINT "ShowAnalytics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;