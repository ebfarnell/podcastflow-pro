-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Advertiser" ADD COLUMN "website" TEXT,
ADD COLUMN "industry" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "zipCode" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "agencyId" TEXT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "agencyId" TEXT;

-- CreateTable
CREATE TABLE "_AgencyClients" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_AdvertiserClients" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Agency_organizationId_idx" ON "Agency"("organizationId");

-- CreateIndex
CREATE INDEX "Advertiser_agencyId_idx" ON "Advertiser"("agencyId");

-- CreateIndex
CREATE INDEX "Campaign_agencyId_idx" ON "Campaign"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "_AgencyClients_AB_unique" ON "_AgencyClients"("A", "B");

-- CreateIndex
CREATE INDEX "_AgencyClients_B_index" ON "_AgencyClients"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_AdvertiserClients_AB_unique" ON "_AdvertiserClients"("A", "B");

-- CreateIndex
CREATE INDEX "_AdvertiserClients_B_index" ON "_AdvertiserClients"("B");

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertiser" ADD CONSTRAINT "Advertiser_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgencyClients" ADD CONSTRAINT "_AgencyClients_A_fkey" FOREIGN KEY ("A") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgencyClients" ADD CONSTRAINT "_AgencyClients_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdvertiserClients" ADD CONSTRAINT "_AdvertiserClients_A_fkey" FOREIGN KEY ("A") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdvertiserClients" ADD CONSTRAINT "_AdvertiserClients_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;