-- Monitoring Tables for PodcastFlow Pro

-- System Metrics table
CREATE TABLE "SystemMetric" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memoryUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diskUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serverLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "networkIncoming" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "networkOutgoing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeConnections" INTEGER NOT NULL DEFAULT 0,
    "apiCalls" INTEGER NOT NULL DEFAULT 0,
    "avgLatency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "dbConnections" INTEGER NOT NULL DEFAULT 0,
    "cacheHitRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cacheMissRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMetric_pkey" PRIMARY KEY ("id")
);

-- Monitoring Alert table
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
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringAlert_pkey" PRIMARY KEY ("id")
);

-- System Log table
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- Service Health table
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceHealth_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "SystemMetric_timestamp_idx" ON "SystemMetric"("timestamp");
CREATE INDEX "SystemMetric_createdAt_idx" ON "SystemMetric"("createdAt");

CREATE INDEX "MonitoringAlert_type_idx" ON "MonitoringAlert"("type");
CREATE INDEX "MonitoringAlert_severity_idx" ON "MonitoringAlert"("severity");
CREATE INDEX "MonitoringAlert_resolved_idx" ON "MonitoringAlert"("resolved");
CREATE INDEX "MonitoringAlert_timestamp_idx" ON "MonitoringAlert"("timestamp");
CREATE INDEX "MonitoringAlert_source_idx" ON "MonitoringAlert"("source");

CREATE INDEX "SystemLog_level_idx" ON "SystemLog"("level");
CREATE INDEX "SystemLog_source_idx" ON "SystemLog"("source");
CREATE INDEX "SystemLog_userId_idx" ON "SystemLog"("userId");
CREATE INDEX "SystemLog_organizationId_idx" ON "SystemLog"("organizationId");
CREATE INDEX "SystemLog_timestamp_idx" ON "SystemLog"("timestamp");
CREATE INDEX "SystemLog_requestId_idx" ON "SystemLog"("requestId");

CREATE UNIQUE INDEX "ServiceHealth_serviceName_key" ON "ServiceHealth"("serviceName");
CREATE INDEX "ServiceHealth_status_idx" ON "ServiceHealth"("status");

-- Add foreign key constraints
ALTER TABLE "MonitoringAlert" ADD CONSTRAINT "MonitoringAlert_resolvedBy_fkey" 
    FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add updated_at trigger for tables that need it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_monitoring_alert_updated_at BEFORE UPDATE ON "MonitoringAlert"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_health_updated_at BEFORE UPDATE ON "ServiceHealth"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();