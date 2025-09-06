-- Create Proposal and ProposalItem tables for schedule builder

DO $$
BEGIN
    -- For org_podcastflow_pro
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_podcastflow_pro' 
                   AND table_name = 'Proposal') THEN
        CREATE TABLE org_podcastflow_pro."Proposal" (
            id TEXT PRIMARY KEY,
            "organizationId" TEXT NOT NULL,
            name TEXT NOT NULL,
            "campaignId" TEXT, -- Link to campaign if converted
            "advertiserId" TEXT,
            budget DOUBLE PRECISION,
            status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, accepted, rejected, expired
            "validUntil" TIMESTAMP(3),
            notes TEXT,
            "createdBy" TEXT NOT NULL,
            "approvedBy" TEXT,
            "approvedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX "Proposal_organizationId_idx" ON org_podcastflow_pro."Proposal"("organizationId");
        CREATE INDEX "Proposal_status_idx" ON org_podcastflow_pro."Proposal"(status);
        CREATE INDEX "Proposal_createdBy_idx" ON org_podcastflow_pro."Proposal"("createdBy");
        CREATE INDEX "Proposal_campaignId_idx" ON org_podcastflow_pro."Proposal"("campaignId");
        CREATE INDEX "Proposal_advertiserId_idx" ON org_podcastflow_pro."Proposal"("advertiserId");
    END IF;

    -- For org_unfy
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_unfy' 
                   AND table_name = 'Proposal') THEN
        CREATE TABLE org_unfy."Proposal" (
            id TEXT PRIMARY KEY,
            "organizationId" TEXT NOT NULL,
            name TEXT NOT NULL,
            "campaignId" TEXT,
            "advertiserId" TEXT,
            budget DOUBLE PRECISION,
            status TEXT NOT NULL DEFAULT 'draft',
            "validUntil" TIMESTAMP(3),
            notes TEXT,
            "createdBy" TEXT NOT NULL,
            "approvedBy" TEXT,
            "approvedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX "Proposal_organizationId_idx" ON org_unfy."Proposal"("organizationId");
        CREATE INDEX "Proposal_status_idx" ON org_unfy."Proposal"(status);
        CREATE INDEX "Proposal_createdBy_idx" ON org_unfy."Proposal"("createdBy");
        CREATE INDEX "Proposal_campaignId_idx" ON org_unfy."Proposal"("campaignId");
        CREATE INDEX "Proposal_advertiserId_idx" ON org_unfy."Proposal"("advertiserId");
    END IF;
END $$;

-- Create ProposalItem table
DO $$
BEGIN
    -- For org_podcastflow_pro
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_podcastflow_pro' 
                   AND table_name = 'ProposalItem') THEN
        CREATE TABLE org_podcastflow_pro."ProposalItem" (
            id TEXT PRIMARY KEY,
            "proposalId" TEXT NOT NULL,
            "episodeId" TEXT NOT NULL,
            "showId" TEXT NOT NULL,
            "placementType" TEXT NOT NULL, -- pre-roll, mid-roll, post-roll
            quantity INTEGER NOT NULL DEFAULT 1,
            "unitPrice" DOUBLE PRECISION NOT NULL,
            "airDate" TIMESTAMP(3) NOT NULL,
            notes TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX "ProposalItem_proposalId_idx" ON org_podcastflow_pro."ProposalItem"("proposalId");
        CREATE INDEX "ProposalItem_episodeId_idx" ON org_podcastflow_pro."ProposalItem"("episodeId");
        CREATE INDEX "ProposalItem_showId_idx" ON org_podcastflow_pro."ProposalItem"("showId");
        CREATE INDEX "ProposalItem_airDate_idx" ON org_podcastflow_pro."ProposalItem"("airDate");
    END IF;

    -- For org_unfy
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_unfy' 
                   AND table_name = 'ProposalItem') THEN
        CREATE TABLE org_unfy."ProposalItem" (
            id TEXT PRIMARY KEY,
            "proposalId" TEXT NOT NULL,
            "episodeId" TEXT NOT NULL,
            "showId" TEXT NOT NULL,
            "placementType" TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            "unitPrice" DOUBLE PRECISION NOT NULL,
            "airDate" TIMESTAMP(3) NOT NULL,
            notes TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX "ProposalItem_proposalId_idx" ON org_unfy."ProposalItem"("proposalId");
        CREATE INDEX "ProposalItem_episodeId_idx" ON org_unfy."ProposalItem"("episodeId");
        CREATE INDEX "ProposalItem_showId_idx" ON org_unfy."ProposalItem"("showId");
        CREATE INDEX "ProposalItem_airDate_idx" ON org_unfy."ProposalItem"("airDate");
    END IF;
END $$;

-- Create ProposalVersion table for tracking changes
DO $$
BEGIN
    -- For org_podcastflow_pro
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_podcastflow_pro' 
                   AND table_name = 'ProposalVersion') THEN
        CREATE TABLE org_podcastflow_pro."ProposalVersion" (
            id TEXT PRIMARY KEY,
            "proposalId" TEXT NOT NULL,
            "versionNumber" INTEGER NOT NULL,
            "snapshot" JSONB NOT NULL, -- Full proposal data at this version
            "changedBy" TEXT NOT NULL,
            "changeNotes" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX "ProposalVersion_proposalId_idx" ON org_podcastflow_pro."ProposalVersion"("proposalId");
        CREATE INDEX "ProposalVersion_createdAt_idx" ON org_podcastflow_pro."ProposalVersion"("createdAt");
    END IF;

    -- For org_unfy
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'org_unfy' 
                   AND table_name = 'ProposalVersion') THEN
        CREATE TABLE org_unfy."ProposalVersion" (
            id TEXT PRIMARY KEY,
            "proposalId" TEXT NOT NULL,
            "versionNumber" INTEGER NOT NULL,
            snapshot JSONB NOT NULL,
            "changedBy" TEXT NOT NULL,
            "changeNotes" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX "ProposalVersion_proposalId_idx" ON org_unfy."ProposalVersion"("proposalId");
        CREATE INDEX "ProposalVersion_createdAt_idx" ON org_unfy."ProposalVersion"("createdAt");
    END IF;
END $$;

-- Create view for proposal summary
CREATE OR REPLACE VIEW org_podcastflow_pro."ProposalSummary" AS
SELECT 
    p.id,
    p.name,
    p.budget,
    p.status,
    p."validUntil",
    p."createdAt",
    u.name as "createdByName",
    COUNT(DISTINCT pi."showId") as "showCount",
    COUNT(DISTINCT pi."episodeId") as "episodeCount",
    COUNT(pi.id) as "slotCount",
    SUM(pi.quantity) as "totalQuantity",
    SUM(pi.quantity * pi."unitPrice") as "totalValue",
    MIN(pi."airDate") as "startDate",
    MAX(pi."airDate") as "endDate"
FROM org_podcastflow_pro."Proposal" p
LEFT JOIN public."User" u ON u.id = p."createdBy"
LEFT JOIN org_podcastflow_pro."ProposalItem" pi ON pi."proposalId" = p.id
GROUP BY p.id, p.name, p.budget, p.status, p."validUntil", p."createdAt", u.name;

-- Create similar view for org_unfy
CREATE OR REPLACE VIEW org_unfy."ProposalSummary" AS
SELECT 
    p.id,
    p.name,
    p.budget,
    p.status,
    p."validUntil",
    p."createdAt",
    u.name as "createdByName",
    COUNT(DISTINCT pi."showId") as "showCount",
    COUNT(DISTINCT pi."episodeId") as "episodeCount",
    COUNT(pi.id) as "slotCount",
    SUM(pi.quantity) as "totalQuantity",
    SUM(pi.quantity * pi."unitPrice") as "totalValue",
    MIN(pi."airDate") as "startDate",
    MAX(pi."airDate") as "endDate"
FROM org_unfy."Proposal" p
LEFT JOIN public."User" u ON u.id = p."createdBy"
LEFT JOIN org_unfy."ProposalItem" pi ON pi."proposalId" = p.id
GROUP BY p.id, p.name, p.budget, p.status, p."validUntil", p."createdAt", u.name;

-- Summary
SELECT 'Proposal tables created successfully' as status;