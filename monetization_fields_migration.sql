-- Add monetization fields to Show model
ALTER TABLE "Show" 
ADD COLUMN IF NOT EXISTS "pricingModel" TEXT DEFAULT 'cpm',
ADD COLUMN IF NOT EXISTS "preRollCpm" DECIMAL(10,2) DEFAULT 25.00,
ADD COLUMN IF NOT EXISTS "preRollSpotCost" DECIMAL(10,2) DEFAULT 500.00,
ADD COLUMN IF NOT EXISTS "midRollCpm" DECIMAL(10,2) DEFAULT 35.00,
ADD COLUMN IF NOT EXISTS "midRollSpotCost" DECIMAL(10,2) DEFAULT 750.00,
ADD COLUMN IF NOT EXISTS "postRollCpm" DECIMAL(10,2) DEFAULT 20.00,
ADD COLUMN IF NOT EXISTS "postRollSpotCost" DECIMAL(10,2) DEFAULT 400.00,
ADD COLUMN IF NOT EXISTS "preRollSlots" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "midRollSlots" INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS "postRollSlots" INTEGER DEFAULT 1;

-- Add check constraint for pricing model
ALTER TABLE "Show" 
ADD CONSTRAINT check_pricing_model CHECK ("pricingModel" IN ('cpm', 'spot', 'both'));

-- Create index for pricing model for performance
CREATE INDEX IF NOT EXISTS idx_show_pricing_model ON "Show"("pricingModel");