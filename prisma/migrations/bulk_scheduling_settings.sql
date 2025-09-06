-- Add bulk scheduling settings columns to Organization table in public schema
ALTER TABLE public."Organization" 
ADD COLUMN IF NOT EXISTS "defaultBulkFallbackStrategy" TEXT DEFAULT 'strict' 
  CHECK ("defaultBulkFallbackStrategy" IN ('strict', 'relaxed', 'fill_anywhere')),
ADD COLUMN IF NOT EXISTS "defaultAllowMultiplePerShowPerDay" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "maxSpotsPerShowPerDay" INTEGER DEFAULT 1 
  CHECK ("maxSpotsPerShowPerDay" >= 1),
ADD COLUMN IF NOT EXISTS "generateHeldReservationsOnSchedule" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "minSpotsForAutoReservation" INTEGER DEFAULT 10;