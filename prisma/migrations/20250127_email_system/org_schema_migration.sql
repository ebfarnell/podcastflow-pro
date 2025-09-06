-- Organization Schema Email Tables
-- Run this for each organization schema (org_*)

-- Custom Email Templates per Organization
CREATE TABLE IF NOT EXISTS "EmailTemplate" (
  "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "key" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "subject" VARCHAR(500) NOT NULL,
  "htmlContent" TEXT NOT NULL,
  "textContent" TEXT NOT NULL,
  "variables" JSONB DEFAULT '[]'::jsonb,
  "category" VARCHAR(50) NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "basedOnSystemTemplate" VARCHAR(50), -- References SystemEmailTemplate.key
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID,
  UNIQUE("key")
);

CREATE INDEX "EmailTemplate_key_idx" ON "EmailTemplate"("key");
CREATE INDEX "EmailTemplate_category_idx" ON "EmailTemplate"("category");

-- Email Campaign Templates (for marketing campaigns)
CREATE TABLE IF NOT EXISTS "EmailCampaignTemplate" (
  "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "campaignId" UUID REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "subject" VARCHAR(500) NOT NULL,
  "htmlContent" TEXT NOT NULL,
  "textContent" TEXT NOT NULL,
  "variables" JSONB DEFAULT '[]'::jsonb,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID
);

CREATE INDEX "EmailCampaignTemplate_campaignId_idx" ON "EmailCampaignTemplate"("campaignId");

-- Trigger for updated_at
CREATE TRIGGER update_email_template_updated_at 
BEFORE UPDATE ON "EmailTemplate" 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_campaign_template_updated_at 
BEFORE UPDATE ON "EmailCampaignTemplate" 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();