-- CreateTable
CREATE TABLE "ShowMetrics" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "totalSubscribers" INTEGER NOT NULL DEFAULT 0,
    "newSubscribers" INTEGER NOT NULL DEFAULT 0,
    "lostSubscribers" INTEGER NOT NULL DEFAULT 0,
    "subscriberGrowth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageListeners" INTEGER NOT NULL DEFAULT 0,
    "totalDownloads" INTEGER NOT NULL DEFAULT 0,
    "monthlyDownloads" INTEGER NOT NULL DEFAULT 0,
    "averageCompletion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageCPM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEpisodes" INTEGER NOT NULL DEFAULT 0,
    "publishedEpisodes" INTEGER NOT NULL DEFAULT 0,
    "averageEpisodeLength" INTEGER NOT NULL DEFAULT 0,
    "socialShares" INTEGER NOT NULL DEFAULT 0,
    "socialMentions" INTEGER NOT NULL DEFAULT 0,
    "sentimentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spotifyListeners" INTEGER NOT NULL DEFAULT 0,
    "appleListeners" INTEGER NOT NULL DEFAULT 0,
    "googleListeners" INTEGER NOT NULL DEFAULT 0,
    "otherListeners" INTEGER NOT NULL DEFAULT 0,
    "demographics" JSONB NOT NULL DEFAULT '{}',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowSubscriberHistory" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscribers" INTEGER NOT NULL DEFAULT 0,
    "dailyChange" INTEGER NOT NULL DEFAULT 0,
    "weeklyChange" INTEGER NOT NULL DEFAULT 0,
    "monthlyChange" INTEGER NOT NULL DEFAULT 0,
    "growthRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "churnRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowSubscriberHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowMetrics_showId_key" ON "ShowMetrics"("showId");

-- CreateIndex
CREATE INDEX "ShowMetrics_organizationId_idx" ON "ShowMetrics"("organizationId");

-- CreateIndex
CREATE INDEX "ShowMetrics_lastUpdated_idx" ON "ShowMetrics"("lastUpdated");

-- CreateIndex
CREATE INDEX "ShowSubscriberHistory_showId_idx" ON "ShowSubscriberHistory"("showId");

-- CreateIndex
CREATE INDEX "ShowSubscriberHistory_date_idx" ON "ShowSubscriberHistory"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ShowSubscriberHistory_showId_date_key" ON "ShowSubscriberHistory"("showId", "date");

-- AddForeignKey
ALTER TABLE "ShowMetrics" ADD CONSTRAINT "ShowMetrics_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowMetrics" ADD CONSTRAINT "ShowMetrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSubscriberHistory" ADD CONSTRAINT "ShowSubscriberHistory_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;