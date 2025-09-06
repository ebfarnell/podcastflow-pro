-- Add new email tracking tables

-- Create Email table
CREATE TABLE IF NOT EXISTS "Email" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "messageId" VARCHAR(255) NOT NULL,
    "from" VARCHAR(255) NOT NULL,
    "to" TEXT[] NOT NULL,
    "cc" TEXT[],
    "bcc" TEXT[],
    "subject" VARCHAR(500) NOT NULL,
    "html" TEXT,
    "text" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "organizationId" TEXT,
    "providerMessageId" VARCHAR(255),
    "response" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- Create unique index on messageId
CREATE UNIQUE INDEX IF NOT EXISTS "Email_messageId_key" ON "Email"("messageId");

-- Create indexes
CREATE INDEX IF NOT EXISTS "Email_organizationId_idx" ON "Email"("organizationId");
CREATE INDEX IF NOT EXISTS "Email_status_idx" ON "Email"("status");
CREATE INDEX IF NOT EXISTS "Email_createdAt_idx" ON "Email"("createdAt");

-- Create EmailMetrics table
CREATE TABLE IF NOT EXISTS "EmailMetrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT 'platform',
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "complained" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "EmailMetrics_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "EmailMetrics_date_organizationId_key" ON "EmailMetrics"("date", "organizationId");

-- Create indexes
CREATE INDEX IF NOT EXISTS "EmailMetrics_organizationId_idx" ON "EmailMetrics"("organizationId");
CREATE INDEX IF NOT EXISTS "EmailMetrics_date_idx" ON "EmailMetrics"("date");

-- Create EmailTrackingEvent table
CREATE TABLE IF NOT EXISTS "EmailTrackingEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "emailLogId" UUID NOT NULL,
    "eventType" VARCHAR(20) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "EmailTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "EmailTrackingEvent_emailLogId_idx" ON "EmailTrackingEvent"("emailLogId");
CREATE INDEX IF NOT EXISTS "EmailTrackingEvent_eventType_idx" ON "EmailTrackingEvent"("eventType");
CREATE INDEX IF NOT EXISTS "EmailTrackingEvent_timestamp_idx" ON "EmailTrackingEvent"("timestamp");

-- Add missing columns to EmailLog if they don't exist
DO $$ 
BEGIN
    -- Add toEmail column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='EmailLog' AND column_name='toEmail') THEN
        ALTER TABLE "EmailLog" ADD COLUMN "toEmail" VARCHAR(255);
        
        -- Copy data from recipient to toEmail
        UPDATE "EmailLog" SET "toEmail" = "recipient" WHERE "toEmail" IS NULL;
        
        -- Make toEmail NOT NULL after data is copied
        ALTER TABLE "EmailLog" ALTER COLUMN "toEmail" SET NOT NULL;
    END IF;

    -- Add fromEmail column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='EmailLog' AND column_name='fromEmail') THEN
        ALTER TABLE "EmailLog" ADD COLUMN "fromEmail" VARCHAR(255);
        
        -- Set default fromEmail
        UPDATE "EmailLog" SET "fromEmail" = 'noreply@podcastflow.pro' WHERE "fromEmail" IS NULL;
        
        -- Make fromEmail NOT NULL
        ALTER TABLE "EmailLog" ALTER COLUMN "fromEmail" SET NOT NULL;
    END IF;

    -- Add messageId column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='EmailLog' AND column_name='messageId') THEN
        ALTER TABLE "EmailLog" ADD COLUMN "messageId" VARCHAR(255);
    END IF;

    -- Add bounceType column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='EmailLog' AND column_name='bounceType') THEN
        ALTER TABLE "EmailLog" ADD COLUMN "bounceType" VARCHAR(20);
    END IF;

    -- Add bounceReason column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='EmailLog' AND column_name='bounceReason') THEN
        ALTER TABLE "EmailLog" ADD COLUMN "bounceReason" TEXT;
    END IF;
END $$;