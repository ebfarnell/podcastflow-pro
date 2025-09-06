-- Create Webhook table for webhook management
CREATE TABLE IF NOT EXISTS "Webhook" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] DEFAULT '{}',
    headers JSONB DEFAULT '{}',
    "isActive" BOOLEAN DEFAULT true,
    secret TEXT,
    "signingKeyId" TEXT,
    "lastTriggered" TIMESTAMP(3),
    "failureCount" INTEGER DEFAULT 0,
    "consecutiveFailures" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Webhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE,
    CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
    CONSTRAINT "Webhook_signingKeyId_fkey" FOREIGN KEY ("signingKeyId") REFERENCES "WebhookSigningKey"("keyId") ON DELETE SET NULL
);

-- Create indexes for Webhook table
CREATE INDEX IF NOT EXISTS "Webhook_organizationId_idx" ON "Webhook"("organizationId");
CREATE INDEX IF NOT EXISTS "Webhook_userId_idx" ON "Webhook"("userId");
CREATE INDEX IF NOT EXISTS "Webhook_isActive_idx" ON "Webhook"("isActive");

-- Create WebhookLog table to track webhook deliveries
CREATE TABLE IF NOT EXISTS "WebhookLog" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "webhookId" TEXT NOT NULL,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    "statusCode" INTEGER,
    response TEXT,
    error TEXT,
    "attemptNumber" INTEGER DEFAULT 1,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"(id) ON DELETE CASCADE
);

-- Create indexes for WebhookLog table
CREATE INDEX IF NOT EXISTS "WebhookLog_webhookId_idx" ON "WebhookLog"("webhookId");
CREATE INDEX IF NOT EXISTS "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");
CREATE INDEX IF NOT EXISTS "WebhookLog_event_idx" ON "WebhookLog"(event);

-- Update trigger for Webhook updatedAt
CREATE OR REPLACE FUNCTION update_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_updated_at
BEFORE UPDATE ON "Webhook"
FOR EACH ROW
EXECUTE FUNCTION update_webhook_updated_at();

-- Add missing ApiKey user relation if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ApiKey' AND column_name = 'userId'
    ) THEN
        ALTER TABLE "ApiKey" ADD COLUMN "userId" TEXT;
        ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
        CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
    END IF;
END $$;