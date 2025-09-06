-- CreateTable
CREATE TABLE "SystemMetric" (
    "id" TEXT NOT NULL,
    "cpuUsage" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "diskUsage" DOUBLE PRECISION,
    "serverLoad" DOUBLE PRECISION,
    "networkIncoming" DOUBLE PRECISION,
    "networkOutgoing" DOUBLE PRECISION,
    "activeConnections" INTEGER,
    "apiCalls" INTEGER,
    "avgLatency" DOUBLE PRECISION,
    "errorRate" DOUBLE PRECISION,
    "activeUsers" INTEGER,
    "dbConnections" INTEGER,
    "cacheHitRate" DOUBLE PRECISION,
    "cacheMissRate" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metric" TEXT,
    "threshold" DOUBLE PRECISION,
    "actualValue" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoringAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "endpoint" TEXT,
    "httpMethod" TEXT,
    "statusCode" INTEGER,
    "errorCode" TEXT,
    "errorStack" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceHealth" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "uptime" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "responseTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCheckTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastErrorTime" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemMetric_timestamp_idx" ON "SystemMetric"("timestamp");

-- CreateIndex
CREATE INDEX "MonitoringAlert_type_idx" ON "MonitoringAlert"("type");

-- CreateIndex
CREATE INDEX "MonitoringAlert_severity_idx" ON "MonitoringAlert"("severity");

-- CreateIndex
CREATE INDEX "MonitoringAlert_resolved_idx" ON "MonitoringAlert"("resolved");

-- CreateIndex
CREATE INDEX "MonitoringAlert_timestamp_idx" ON "MonitoringAlert"("timestamp");

-- CreateIndex
CREATE INDEX "MonitoringAlert_source_idx" ON "MonitoringAlert"("source");

-- CreateIndex
CREATE INDEX "SystemLog_level_idx" ON "SystemLog"("level");

-- CreateIndex
CREATE INDEX "SystemLog_source_idx" ON "SystemLog"("source");

-- CreateIndex
CREATE INDEX "SystemLog_userId_idx" ON "SystemLog"("userId");

-- CreateIndex
CREATE INDEX "SystemLog_organizationId_idx" ON "SystemLog"("organizationId");

-- CreateIndex
CREATE INDEX "SystemLog_timestamp_idx" ON "SystemLog"("timestamp");

-- CreateIndex
CREATE INDEX "SystemLog_endpoint_idx" ON "SystemLog"("endpoint");

-- CreateIndex
CREATE INDEX "SystemLog_statusCode_idx" ON "SystemLog"("statusCode");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceHealth_serviceName_key" ON "ServiceHealth"("serviceName");

-- CreateIndex
CREATE INDEX "ServiceHealth_status_idx" ON "ServiceHealth"("status");

-- CreateIndex
CREATE INDEX "ServiceHealth_lastCheckTime_idx" ON "ServiceHealth"("lastCheckTime");

-- AddForeignKey
ALTER TABLE "MonitoringAlert" ADD CONSTRAINT "MonitoringAlert_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;