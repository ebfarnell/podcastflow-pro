-- =====================================================
-- AD SLOT RESERVATION SYSTEM MIGRATION
-- =====================================================
-- This migration adds comprehensive ad slot reservation functionality
-- to support holding inventory temporarily before confirmation

-- Create ReservationStatus enum
CREATE TYPE "ReservationStatus" AS ENUM ('held', 'confirmed', 'expired', 'cancelled', 'failed');

-- Create ReservationItemStatus enum
CREATE TYPE "ReservationItemStatus" AS ENUM ('held', 'confirmed', 'released', 'blocked');

-- Create ReservationPriority enum
CREATE TYPE "ReservationPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- Main reservation table
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "reservationNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "advertiserId" TEXT NOT NULL,
    "agencyId" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'held',
    "holdDuration" INTEGER NOT NULL DEFAULT 48,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "estimatedRevenue" DOUBLE PRECISION NOT NULL,
    "createdBy" TEXT NOT NULL,
    "confirmedBy" TEXT,
    "cancelledBy" TEXT,
    "notes" TEXT,
    "priority" "ReservationPriority" NOT NULL DEFAULT 'normal',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- Reservation items table
CREATE TABLE "ReservationItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "episodeId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "placementType" TEXT NOT NULL,
    "spotNumber" INTEGER,
    "length" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "status" "ReservationItemStatus" NOT NULL DEFAULT 'held',
    "inventoryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("id")
);

-- Reservation status history table
CREATE TABLE "ReservationStatusHistory" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fromStatus" "ReservationStatus",
    "toStatus" "ReservationStatus" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on reservation number
CREATE UNIQUE INDEX "Reservation_reservationNumber_key" ON "Reservation"("reservationNumber");

-- Create indexes for performance
CREATE INDEX "Reservation_organizationId_idx" ON "Reservation"("organizationId");
CREATE INDEX "Reservation_advertiserId_idx" ON "Reservation"("advertiserId");
CREATE INDEX "Reservation_campaignId_idx" ON "Reservation"("campaignId");
CREATE INDEX "Reservation_agencyId_idx" ON "Reservation"("agencyId");
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX "Reservation_expiresAt_idx" ON "Reservation"("expiresAt");
CREATE INDEX "Reservation_createdBy_idx" ON "Reservation"("createdBy");
CREATE INDEX "Reservation_createdAt_idx" ON "Reservation"("createdAt");

CREATE INDEX "ReservationItem_reservationId_idx" ON "ReservationItem"("reservationId");
CREATE INDEX "ReservationItem_showId_idx" ON "ReservationItem"("showId");
CREATE INDEX "ReservationItem_episodeId_idx" ON "ReservationItem"("episodeId");
CREATE INDEX "ReservationItem_date_idx" ON "ReservationItem"("date");
CREATE INDEX "ReservationItem_placementType_idx" ON "ReservationItem"("placementType");
CREATE INDEX "ReservationItem_status_idx" ON "ReservationItem"("status");

CREATE INDEX "ReservationStatusHistory_reservationId_idx" ON "ReservationStatusHistory"("reservationId");
CREATE INDEX "ReservationStatusHistory_changedBy_idx" ON "ReservationStatusHistory"("changedBy");
CREATE INDEX "ReservationStatusHistory_changedAt_idx" ON "ReservationStatusHistory"("changedAt");

-- Add foreign key constraints
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReservationStatusHistory" ADD CONSTRAINT "ReservationStatusHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationStatusHistory" ADD CONSTRAINT "ReservationStatusHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add function to generate reservation numbers
CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'RES-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('reservation_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Create sequence for reservation numbers
CREATE SEQUENCE IF NOT EXISTS reservation_number_seq START 1;

-- Add trigger to auto-generate reservation numbers
CREATE OR REPLACE FUNCTION set_reservation_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."reservationNumber" IS NULL OR NEW."reservationNumber" = '' THEN
        NEW."reservationNumber" = generate_reservation_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservation_number_trigger
    BEFORE INSERT ON "Reservation"
    FOR EACH ROW
    EXECUTE FUNCTION set_reservation_number();

-- Add function to automatically expire reservations
CREATE OR REPLACE FUNCTION expire_reservations()
RETURNS void AS $$
BEGIN
    -- Update expired reservations
    UPDATE "Reservation"
    SET 
        "status" = 'expired',
        "updatedAt" = NOW()
    WHERE 
        "status" = 'held' 
        AND "expiresAt" < NOW();
        
    -- Log status changes
    INSERT INTO "ReservationStatusHistory" ("id", "reservationId", "fromStatus", "toStatus", "reason", "changedBy", "changedAt")
    SELECT 
        gen_random_uuid()::text,
        "id",
        'held',
        'expired',
        'Automatic expiration - hold period exceeded',
        "createdBy",
        NOW()
    FROM "Reservation"
    WHERE 
        "status" = 'expired'
        AND "updatedAt" >= NOW() - INTERVAL '1 minute';
        
    -- Release inventory for expired reservations
    UPDATE "Inventory"
    SET 
        "reservedSpots" = "reservedSpots" - COALESCE(expired_counts.reserved_count, 0),
        "availableSpots" = "availableSpots" + COALESCE(expired_counts.reserved_count, 0),
        "updatedAt" = NOW()
    FROM (
        SELECT 
            i."id" as inventory_id,
            COUNT(ri."id") as reserved_count
        FROM "Inventory" i
        JOIN "ReservationItem" ri ON i."showId" = ri."showId" 
            AND DATE(i."date") = DATE(ri."date") 
            AND i."placementType" = ri."placementType"
        JOIN "Reservation" r ON ri."reservationId" = r."id"
        WHERE 
            r."status" = 'expired'
            AND r."updatedAt" >= NOW() - INTERVAL '1 minute'
            AND ri."status" = 'held'
        GROUP BY i."id"
    ) expired_counts
    WHERE "Inventory"."id" = expired_counts.inventory_id;
    
    -- Update reservation items to released status
    UPDATE "ReservationItem"
    SET 
        "status" = 'released',
        "updatedAt" = NOW()
    WHERE "reservationId" IN (
        SELECT "id" FROM "Reservation" 
        WHERE "status" = 'expired' 
        AND "updatedAt" >= NOW() - INTERVAL '1 minute'
    ) AND "status" = 'held';
END;
$$ LANGUAGE plpgsql;

-- Create comments for documentation
COMMENT ON TABLE "Reservation" IS 'Main table for ad slot reservations - holds inventory temporarily before confirmation';
COMMENT ON TABLE "ReservationItem" IS 'Individual ad slots within a reservation';
COMMENT ON TABLE "ReservationStatusHistory" IS 'Audit trail of reservation status changes';
COMMENT ON FUNCTION expire_reservations() IS 'Automatically expires held reservations past their expiration time and releases inventory';
COMMENT ON FUNCTION generate_reservation_number() IS 'Generates unique reservation numbers in format RES-YYYY-######';

-- Insert initial test data (optional - for development/testing)
-- Uncomment the following lines if you want sample data

/*
-- Sample reservation (replace IDs with actual values from your database)
INSERT INTO "Reservation" (
    "id", "reservationNumber", "organizationId", "advertiserId", 
    "status", "expiresAt", "totalAmount", "estimatedRevenue", "createdBy"
) VALUES (
    gen_random_uuid()::text,
    'RES-2025-000001',
    'your-org-id',
    'your-advertiser-id',
    'held',
    NOW() + INTERVAL '48 hours',
    5000.00,
    5000.00,
    'your-user-id'
);
*/