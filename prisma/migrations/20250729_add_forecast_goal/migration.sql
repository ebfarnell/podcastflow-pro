-- Add forecast and goal fields to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "yearlyForecast" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "yearlyGoal" DOUBLE PRECISION DEFAULT 0;