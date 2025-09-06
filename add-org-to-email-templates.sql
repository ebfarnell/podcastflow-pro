-- Add organizationId column to EmailTemplate table
ALTER TABLE "EmailTemplate" 
ADD COLUMN "organizationId" UUID DEFAULT NULL,
ADD COLUMN "isSystemDefault" BOOLEAN DEFAULT FALSE;

-- Add foreign key constraint
ALTER TABLE "EmailTemplate" 
ADD CONSTRAINT "EmailTemplate_organizationId_fkey" 
FOREIGN KEY ("organizationId") 
REFERENCES "Organization"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Remove the unique constraint on key column
ALTER TABLE "EmailTemplate" DROP CONSTRAINT "EmailTemplate_key_key";

-- Add composite unique constraint on key and organizationId
ALTER TABLE "EmailTemplate" 
ADD CONSTRAINT "EmailTemplate_key_organizationId_key" 
UNIQUE ("key", "organizationId");

-- Add index on organizationId for performance
CREATE INDEX "EmailTemplate_organizationId_idx" ON "EmailTemplate"("organizationId");

-- Update existing templates to be system defaults
UPDATE "EmailTemplate" 
SET "isSystemDefault" = TRUE 
WHERE "organizationId" IS NULL;