-- Migration for Bulk Scheduling with Inventory Awareness
-- This needs to be run in each org schema

-- Create idempotency table for bulk schedule commits
CREATE TABLE IF NOT EXISTS "BulkScheduleIdempotency" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- Add index for cleanup queries
CREATE INDEX IF NOT EXISTS "BulkScheduleIdempotency_expiresAt_idx" 
  ON "BulkScheduleIdempotency"("expiresAt");

-- Add index for key lookups
CREATE INDEX IF NOT EXISTS "BulkScheduleIdempotency_key_idx" 
  ON "BulkScheduleIdempotency"("key");

-- Add org settings columns for bulk scheduling defaults (in public schema)
DO $$ 
BEGIN
  -- Check if columns don't exist before adding them
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'OrganizationSettings' 
    AND column_name = 'defaultBulkFallbackStrategy'
  ) THEN
    ALTER TABLE public."OrganizationSettings" 
    ADD COLUMN "defaultBulkFallbackStrategy" TEXT DEFAULT 'strict' 
    CHECK ("defaultBulkFallbackStrategy" IN ('strict', 'relaxed', 'fill_anywhere'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'OrganizationSettings' 
    AND column_name = 'defaultAllowMultiplePerShowPerDay'
  ) THEN
    ALTER TABLE public."OrganizationSettings" 
    ADD COLUMN "defaultAllowMultiplePerShowPerDay" BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'OrganizationSettings' 
    AND column_name = 'maxSpotsPerShowPerDay'
  ) THEN
    ALTER TABLE public."OrganizationSettings" 
    ADD COLUMN "maxSpotsPerShowPerDay" INTEGER DEFAULT 1 CHECK ("maxSpotsPerShowPerDay" >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'OrganizationSettings' 
    AND column_name = 'generateHeldReservationsOnSchedule'
  ) THEN
    ALTER TABLE public."OrganizationSettings" 
    ADD COLUMN "generateHeldReservationsOnSchedule" BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'OrganizationSettings' 
    AND column_name = 'minSpotsForAutoReservation'
  ) THEN
    ALTER TABLE public."OrganizationSettings" 
    ADD COLUMN "minSpotsForAutoReservation" INTEGER DEFAULT 10;
  END IF;
END $$;

-- Add RateCardDelta table if it doesn't exist (in org schemas)
CREATE TABLE IF NOT EXISTS "RateCardDelta" (
  "id" TEXT PRIMARY KEY,
  "campaignId" TEXT,
  "showId" TEXT NOT NULL,
  "placementType" TEXT NOT NULL,
  "originalRate" DECIMAL(10, 2) NOT NULL,
  "actualRate" DECIMAL(10, 2) NOT NULL,
  "delta" DECIMAL(10, 2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE,
  FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE
);

-- Add indexes for RateCardDelta
CREATE INDEX IF NOT EXISTS "RateCardDelta_campaignId_idx" ON "RateCardDelta"("campaignId");
CREATE INDEX IF NOT EXISTS "RateCardDelta_showId_idx" ON "RateCardDelta"("showId");
CREATE INDEX IF NOT EXISTS "RateCardDelta_createdAt_idx" ON "RateCardDelta"("createdAt");

-- Add ShowRateCard table if it doesn't exist (in org schemas)
CREATE TABLE IF NOT EXISTS "ShowRateCard" (
  "id" TEXT PRIMARY KEY,
  "showId" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "preRollRate" DECIMAL(10, 2) DEFAULT 0,
  "midRollRate" DECIMAL(10, 2) DEFAULT 0,
  "postRollRate" DECIMAL(10, 2) DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE
);

-- Add indexes for ShowRateCard
CREATE INDEX IF NOT EXISTS "ShowRateCard_showId_idx" ON "ShowRateCard"("showId");
CREATE INDEX IF NOT EXISTS "ShowRateCard_effectiveDate_idx" ON "ShowRateCard"("effectiveDate");

-- Create EpisodeInventory table if it doesn't exist (in org schemas)
CREATE TABLE IF NOT EXISTS "EpisodeInventory" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "episodeId" TEXT NOT NULL UNIQUE,
  "preRollSlots" INTEGER DEFAULT 1,
  "midRollSlots" INTEGER DEFAULT 0,
  "postRollSlots" INTEGER DEFAULT 1,
  "preRollAvailable" INTEGER DEFAULT 1,
  "midRollAvailable" INTEGER DEFAULT 0,
  "postRollAvailable" INTEGER DEFAULT 1,
  "preRollReserved" INTEGER DEFAULT 0,
  "midRollReserved" INTEGER DEFAULT 0,
  "postRollReserved" INTEGER DEFAULT 0,
  "preRollBooked" INTEGER DEFAULT 0,
  "midRollBooked" INTEGER DEFAULT 0,
  "postRollBooked" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE
);

-- Add index for EpisodeInventory
CREATE INDEX IF NOT EXISTS "EpisodeInventory_episodeId_idx" ON "EpisodeInventory"("episodeId");

-- Create Reservation table if it doesn't exist (in org schemas)
CREATE TABLE IF NOT EXISTS "Reservation" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "reservationNumber" TEXT NOT NULL UNIQUE,
  "campaignId" TEXT,
  "advertiserId" TEXT NOT NULL,
  "agencyId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'held' CHECK ("status" IN ('held', 'pending', 'confirmed', 'released', 'expired', 'converted')),
  "holdDuration" INTEGER DEFAULT 48, -- hours
  "expiresAt" TIMESTAMP(3),
  "priority" TEXT DEFAULT 'normal' CHECK ("priority" IN ('low', 'normal', 'high', 'urgent')),
  "totalAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "estimatedRevenue" DECIMAL(10, 2) DEFAULT 0,
  "notes" TEXT,
  "source" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL,
  FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE,
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL
);

-- Add indexes for Reservation
CREATE INDEX IF NOT EXISTS "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX IF NOT EXISTS "Reservation_advertiserId_idx" ON "Reservation"("advertiserId");
CREATE INDEX IF NOT EXISTS "Reservation_campaignId_idx" ON "Reservation"("campaignId");
CREATE INDEX IF NOT EXISTS "Reservation_expiresAt_idx" ON "Reservation"("expiresAt");

-- Create ReservationItem table if it doesn't exist (in org schemas)
CREATE TABLE IF NOT EXISTS "ReservationItem" (
  "id" TEXT PRIMARY KEY,
  "reservationId" TEXT NOT NULL,
  "showId" TEXT NOT NULL,
  "episodeId" TEXT,
  "airDate" TIMESTAMP(3) NOT NULL,
  "placementType" TEXT NOT NULL,
  "spotNumber" INTEGER DEFAULT 1,
  "length" INTEGER NOT NULL DEFAULT 30,
  "rate" DECIMAL(10, 2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE,
  FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE,
  FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL
);

-- Add indexes for ReservationItem
CREATE INDEX IF NOT EXISTS "ReservationItem_reservationId_idx" ON "ReservationItem"("reservationId");
CREATE INDEX IF NOT EXISTS "ReservationItem_showId_idx" ON "ReservationItem"("showId");
CREATE INDEX IF NOT EXISTS "ReservationItem_episodeId_idx" ON "ReservationItem"("episodeId");
CREATE INDEX IF NOT EXISTS "ReservationItem_airDate_idx" ON "ReservationItem"("airDate");

-- Function to automatically clean up expired idempotency records
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_records()
RETURNS void AS $$
BEGIN
  DELETE FROM "BulkScheduleIdempotency" 
  WHERE "expiresAt" < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Comment on tables for documentation
COMMENT ON TABLE "BulkScheduleIdempotency" IS 'Stores idempotency keys for bulk schedule commits to prevent duplicate inserts';
COMMENT ON TABLE "RateCardDelta" IS 'Tracks differences between standard rate cards and actual scheduled spot prices';
COMMENT ON TABLE "ShowRateCard" IS 'Stores rate card information for each show with effective dates';
COMMENT ON TABLE "EpisodeInventory" IS 'Tracks available inventory slots for each episode';
COMMENT ON TABLE "Reservation" IS 'Manages inventory reservations and holds';
COMMENT ON TABLE "ReservationItem" IS 'Individual line items within a reservation';