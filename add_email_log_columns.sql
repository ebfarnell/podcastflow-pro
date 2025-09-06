-- Add missing columns to EmailLog table to match Prisma schema
ALTER TABLE public."EmailLog" 
ADD COLUMN IF NOT EXISTS "toEmail" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "fromEmail" VARCHAR(255);

-- Migrate existing data from recipient to toEmail
UPDATE public."EmailLog" 
SET "toEmail" = "recipient"
WHERE "toEmail" IS NULL AND "recipient" IS NOT NULL;

-- Set default fromEmail for existing records
UPDATE public."EmailLog" 
SET "fromEmail" = 'notifications@app.podcastflow.pro'
WHERE "fromEmail" IS NULL;