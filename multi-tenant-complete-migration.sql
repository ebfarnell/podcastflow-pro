-- Complete Multi-Tenant Schema Migration
-- Creates all necessary tables for complete data isolation

-- =====================================================
-- STEP 1: Clean up previous attempts
-- =====================================================

DROP FUNCTION IF EXISTS create_organization_schema CASCADE;
DROP FUNCTION IF EXISTS create_organization_tables CASCADE;
DROP FUNCTION IF EXISTS create_org_tables_from_public CASCADE;
DROP FUNCTION IF EXISTS migrate_organization_data CASCADE;
DROP FUNCTION IF EXISTS migrate_org_data CASCADE;
DROP FUNCTION IF EXISTS setup_new_organization CASCADE;
DROP FUNCTION IF EXISTS set_org_schema CASCADE;

-- Drop existing schemas
DROP SCHEMA IF EXISTS org_podcastflow_pro CASCADE;
DROP SCHEMA IF EXISTS org_unfy CASCADE;

-- =====================================================
-- STEP 2: Create comprehensive table creation function
-- =====================================================

CREATE OR REPLACE FUNCTION create_complete_org_schema(org_slug TEXT, org_id TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
BEGIN
    -- Sanitize slug for schema name
    schema_name := 'org_' || replace(lower(org_slug), '-', '_');
    
    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
    EXECUTE format('GRANT ALL ON SCHEMA %I TO podcastflow', schema_name);
    
    -- Set search path
    EXECUTE format('SET search_path TO %I, public', schema_name);
    
    -- =====================================================
    -- CORE BUSINESS TABLES
    -- =====================================================
    
    -- Campaign table
    CREATE TABLE IF NOT EXISTS "Campaign" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "advertiserId" TEXT NOT NULL,
        "agencyId" TEXT,
        "organizationId" TEXT NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "budget" DOUBLE PRECISION,
        "spent" DOUBLE PRECISION DEFAULT 0,
        "impressions" INTEGER DEFAULT 0,
        "targetImpressions" INTEGER DEFAULT 0,
        "clicks" INTEGER DEFAULT 0,
        "conversions" INTEGER DEFAULT 0,
        "targetAudience" TEXT,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdBy" TEXT,
        "updatedBy" TEXT,
        CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
    );
    
    -- Show table
    CREATE TABLE IF NOT EXISTS "Show" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "organizationId" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdBy" TEXT,
        "updatedBy" TEXT,
        "host" TEXT,
        "category" TEXT,
        "releaseFrequency" TEXT,
        "releaseDay" TEXT,
        "revenueSharingType" TEXT,
        "revenueSharingPercentage" DOUBLE PRECISION,
        "revenueSharingFixedAmount" DOUBLE PRECISION,
        "revenueSharingNotes" TEXT,
        CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
    );
    
    -- Episode table
    CREATE TABLE IF NOT EXISTS "Episode" (
        "id" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "episodeNumber" INTEGER NOT NULL,
        "airDate" TIMESTAMP(3),
        "duration" INTEGER,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdBy" TEXT,
        "updatedBy" TEXT,
        "organizationId" TEXT NOT NULL,
        "producerNotes" TEXT,
        "talentNotes" TEXT,
        "recordingDate" TIMESTAMP(3),
        "publishUrl" TEXT,
        CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
    );
    
    -- Agency table
    CREATE TABLE IF NOT EXISTS "Agency" (
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
        "createdBy" TEXT,
        "updatedBy" TEXT,
        CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
    );
    
    -- Advertiser table
    CREATE TABLE IF NOT EXISTS "Advertiser" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "contactEmail" TEXT,
        "contactPhone" TEXT,
        "website" TEXT,
        "industry" TEXT,
        "address" TEXT,
        "city" TEXT,
        "state" TEXT,
        "zipCode" TEXT,
        "country" TEXT,
        "agencyId" TEXT,
        "organizationId" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdBy" TEXT,
        "updatedBy" TEXT,
        CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
    );
    
    -- AdApproval table
    CREATE TABLE IF NOT EXISTS "AdApproval" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "advertiserId" TEXT NOT NULL,
        "advertiserName" TEXT NOT NULL,
        "campaignId" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "showName" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "duration" INTEGER NOT NULL,
        "script" TEXT,
        "talkingPoints" TEXT[],
        "priority" TEXT NOT NULL DEFAULT 'medium',
        "deadline" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'pending',
        "salesRepId" TEXT,
        "salesRepName" TEXT,
        "submittedBy" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "workflowStage" TEXT NOT NULL DEFAULT 'pending_creation',
        "revisionCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "approvedAt" TIMESTAMP(3),
        "rejectedAt" TIMESTAMP(3),
        CONSTRAINT "AdApproval_pkey" PRIMARY KEY ("id")
    );
    
    -- DeletionRequest table
    CREATE TABLE IF NOT EXISTS "DeletionRequest" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "entityType" VARCHAR(50) NOT NULL CHECK ("entityType" IN ('advertiser', 'agency', 'campaign')),
        "entityId" TEXT NOT NULL,
        "entityName" VARCHAR(255) NOT NULL,
        "reason" TEXT,
        "requestedBy" TEXT NOT NULL,
        "reviewedBy" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
        "reviewNotes" TEXT,
        "requestedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "reviewedAt" TIMESTAMP,
        CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
    );
    
    -- AdCreative table
    CREATE TABLE IF NOT EXISTS "AdCreative" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "organizationId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "format" TEXT NOT NULL,
        "duration" INTEGER NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'active',
        "script" TEXT,
        "talkingPoints" TEXT[],
        "audioUrl" TEXT,
        "videoUrl" TEXT,
        "thumbnailUrl" TEXT,
        "s3Key" TEXT,
        "fileSize" INTEGER,
        "fileType" TEXT,
        "advertiserId" TEXT,
        "campaignId" TEXT,
        "tags" TEXT[],
        "category" TEXT,
        "impressions" INTEGER DEFAULT 0,
        "clicks" INTEGER DEFAULT 0,
        "conversions" INTEGER DEFAULT 0,
        "revenue" DOUBLE PRECISION DEFAULT 0,
        "restrictedTerms" TEXT[],
        "legalDisclaimer" TEXT,
        "expiryDate" TIMESTAMP(3),
        "createdBy" TEXT NOT NULL,
        "updatedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "AdCreative_pkey" PRIMARY KEY ("id")
    );
    
    -- SpotSubmission table
    CREATE TABLE IF NOT EXISTS "SpotSubmission" (
        "id" TEXT NOT NULL,
        "adApprovalId" TEXT NOT NULL,
        "submittedBy" TEXT NOT NULL,
        "submitterRole" TEXT NOT NULL,
        "audioUrl" TEXT,
        "s3Key" TEXT,
        "fileName" TEXT,
        "fileSize" INTEGER,
        "fileType" TEXT,
        "audioDuration" INTEGER,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SpotSubmission_pkey" PRIMARY KEY ("id")
    );
    
    -- =====================================================
    -- FINANCIAL TABLES
    -- =====================================================
    
    -- Order table
    CREATE TABLE IF NOT EXISTS "Order" (
        "id" TEXT NOT NULL,
        "orderNumber" TEXT NOT NULL,
        "campaignId" TEXT NOT NULL,
        "version" INTEGER NOT NULL DEFAULT 1,
        "parentOrderId" TEXT,
        "organizationId" TEXT NOT NULL,
        "advertiserId" TEXT NOT NULL,
        "agencyId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "totalAmount" DOUBLE PRECISION NOT NULL,
        "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "discountReason" TEXT,
        "netAmount" DOUBLE PRECISION NOT NULL,
        "submittedAt" TIMESTAMP(3),
        "submittedBy" TEXT,
        "approvedAt" TIMESTAMP(3),
        "approvedBy" TEXT,
        "bookedAt" TIMESTAMP(3),
        "bookedBy" TEXT,
        "confirmedAt" TIMESTAMP(3),
        "confirmedBy" TEXT,
        "ioNumber" TEXT,
        "ioGeneratedAt" TIMESTAMP(3),
        "contractUrl" TEXT,
        "signedContractUrl" TEXT,
        "contractSignedAt" TIMESTAMP(3),
        "notes" TEXT,
        "internalNotes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdBy" TEXT NOT NULL,
        CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
    );
    
    -- OrderItem table
    CREATE TABLE IF NOT EXISTS "OrderItem" (
        "id" TEXT NOT NULL,
        "orderId" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "episodeId" TEXT,
        "placementType" TEXT NOT NULL,
        "spotNumber" INTEGER,
        "airDate" TIMESTAMP(3) NOT NULL,
        "length" INTEGER NOT NULL,
        "isLiveRead" BOOLEAN NOT NULL DEFAULT false,
        "rate" DOUBLE PRECISION NOT NULL,
        "actualRate" DOUBLE PRECISION NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "adTitle" TEXT,
        "adScript" TEXT,
        "adTalkingPoints" TEXT[],
        "adAudioUrl" TEXT,
        "adApprovalStatus" TEXT NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
    );
    
    -- Invoice table
    CREATE TABLE IF NOT EXISTS "Invoice" (
        "id" TEXT NOT NULL,
        "invoiceNumber" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'USD',
        "description" TEXT NOT NULL,
        "billingPeriod" TEXT,
        "plan" TEXT NOT NULL DEFAULT 'starter',
        "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "dueDate" TIMESTAMP(3) NOT NULL,
        "paidDate" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'pending',
        "notes" TEXT,
        "taxAmount" DOUBLE PRECISION,
        "discountAmount" DOUBLE PRECISION,
        "totalAmount" DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdById" TEXT,
        CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
    );
    
    -- InvoiceItem table
    CREATE TABLE IF NOT EXISTS "InvoiceItem" (
        "id" TEXT NOT NULL,
        "invoiceId" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
        "unitPrice" DOUBLE PRECISION NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "campaignId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
    );
    
    -- Payment table
    CREATE TABLE IF NOT EXISTS "Payment" (
        "id" TEXT NOT NULL,
        "paymentNumber" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "invoiceId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'USD',
        "paymentMethod" TEXT NOT NULL,
        "transactionId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processedDate" TIMESTAMP(3),
        "notes" TEXT,
        "processorFee" DOUBLE PRECISION,
        "netAmount" DOUBLE PRECISION,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdById" TEXT,
        CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
    );
    
    -- Contract table
    CREATE TABLE IF NOT EXISTS "Contract" (
        "id" TEXT NOT NULL,
        "contractNumber" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "campaignId" TEXT,
        "orderId" TEXT,
        "advertiserId" TEXT NOT NULL,
        "agencyId" TEXT,
        "contractType" TEXT NOT NULL DEFAULT 'insertion_order',
        "title" TEXT NOT NULL,
        "description" TEXT,
        "totalAmount" DOUBLE PRECISION NOT NULL,
        "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "netAmount" DOUBLE PRECISION NOT NULL,
        "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "paymentTerms" TEXT NOT NULL DEFAULT 'Net 30',
        "cancellationTerms" TEXT,
        "deliveryTerms" TEXT,
        "specialTerms" TEXT,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "isExecuted" BOOLEAN NOT NULL DEFAULT false,
        "executedAt" TIMESTAMP(3),
        "executedById" TEXT,
        "templateId" TEXT,
        "generatedDocument" JSONB,
        "documentUrl" TEXT,
        "signatureUrl" TEXT,
        "sentAt" TIMESTAMP(3),
        "signedAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdById" TEXT NOT NULL,
        CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
    );
    
    -- ContractLineItem table
    CREATE TABLE IF NOT EXISTS "ContractLineItem" (
        "id" TEXT NOT NULL,
        "contractId" TEXT NOT NULL,
        "orderItemId" TEXT,
        "description" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "unitPrice" DOUBLE PRECISION NOT NULL,
        "totalPrice" DOUBLE PRECISION NOT NULL,
        "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "netPrice" DOUBLE PRECISION NOT NULL,
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "showId" TEXT,
        "episodeCount" INTEGER,
        "spotLength" INTEGER,
        "spotPosition" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ContractLineItem_pkey" PRIMARY KEY ("id")
    );
    
    -- Expense table
    CREATE TABLE IF NOT EXISTS "Expense" (
        "id" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "vendor" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "category" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'oneTime',
        "frequency" TEXT,
        "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endDate" TIMESTAMP(3),
        "nextDueDate" TIMESTAMP(3),
        "organizationId" TEXT NOT NULL,
        "createdBy" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "notes" TEXT,
        "invoiceNumber" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
    );
    
    -- BudgetCategory table  
    CREATE TABLE IF NOT EXISTS "BudgetCategory" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "parentCategoryId" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id")
    );
    
    -- BudgetEntry table
    CREATE TABLE IF NOT EXISTS "BudgetEntry" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "year" INTEGER NOT NULL,
        "month" INTEGER NOT NULL,
        "budgetAmount" DOUBLE PRECISION NOT NULL,
        "actualAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdBy" TEXT NOT NULL,
        CONSTRAINT "BudgetEntry_pkey" PRIMARY KEY ("id")
    );
    
    -- =====================================================
    -- ANALYTICS TABLES
    -- =====================================================
    
    -- CampaignAnalytics table
    CREATE TABLE IF NOT EXISTS "CampaignAnalytics" (
        "id" TEXT NOT NULL,
        "campaignId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "impressions" INTEGER DEFAULT 0,
        "clicks" INTEGER DEFAULT 0,
        "conversions" INTEGER DEFAULT 0,
        "ctr" DOUBLE PRECISION DEFAULT 0,
        "conversionRate" DOUBLE PRECISION DEFAULT 0,
        "spent" DOUBLE PRECISION DEFAULT 0,
        "cpc" DOUBLE PRECISION DEFAULT 0,
        "cpa" DOUBLE PRECISION DEFAULT 0,
        "engagementRate" DOUBLE PRECISION DEFAULT 0,
        "averageViewTime" INTEGER DEFAULT 0,
        "bounceRate" DOUBLE PRECISION DEFAULT 0,
        "adPlaybacks" INTEGER DEFAULT 0,
        "completionRate" DOUBLE PRECISION DEFAULT 0,
        "skipRate" DOUBLE PRECISION DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CampaignAnalytics_pkey" PRIMARY KEY ("id")
    );
    
    -- EpisodeAnalytics table
    CREATE TABLE IF NOT EXISTS "EpisodeAnalytics" (
        "id" TEXT NOT NULL,
        "episodeId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "downloads" INTEGER DEFAULT 0,
        "uniqueListeners" INTEGER DEFAULT 0,
        "completions" INTEGER DEFAULT 0,
        "avgListenTime" DOUBLE PRECISION DEFAULT 0,
        "spotifyListens" INTEGER DEFAULT 0,
        "appleListens" INTEGER DEFAULT 0,
        "googleListens" INTEGER DEFAULT 0,
        "otherListens" INTEGER DEFAULT 0,
        "shares" INTEGER DEFAULT 0,
        "likes" INTEGER DEFAULT 0,
        "comments" INTEGER DEFAULT 0,
        "adRevenue" DOUBLE PRECISION DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "EpisodeAnalytics_pkey" PRIMARY KEY ("id")
    );
    
    -- ShowAnalytics table
    CREATE TABLE IF NOT EXISTS "ShowAnalytics" (
        "id" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "periodType" TEXT NOT NULL DEFAULT 'daily',
        "totalDownloads" INTEGER DEFAULT 0,
        "totalListeners" INTEGER DEFAULT 0,
        "avgDownloadsPerEpisode" DOUBLE PRECISION DEFAULT 0,
        "avgRating" DOUBLE PRECISION DEFAULT 0,
        "totalRatings" INTEGER DEFAULT 0,
        "newSubscribers" INTEGER DEFAULT 0,
        "lostSubscribers" INTEGER DEFAULT 0,
        "netSubscribers" INTEGER DEFAULT 0,
        "totalRevenue" DOUBLE PRECISION DEFAULT 0,
        "adRevenue" DOUBLE PRECISION DEFAULT 0,
        "sponsorRevenue" DOUBLE PRECISION DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ShowAnalytics_pkey" PRIMARY KEY ("id")
    );
    
    -- AnalyticsEvent table
    CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "userId" TEXT,
        "sessionId" TEXT,
        "platform" TEXT,
        "deviceType" TEXT,
        "location" TEXT,
        "referrer" TEXT,
        "metadata" JSONB DEFAULT '{}',
        "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
    );
    
    -- ShowMetrics table
    CREATE TABLE IF NOT EXISTS "ShowMetrics" (
        "id" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "totalSubscribers" INTEGER DEFAULT 0,
        "newSubscribers" INTEGER DEFAULT 0,
        "lostSubscribers" INTEGER DEFAULT 0,
        "subscriberGrowth" DOUBLE PRECISION DEFAULT 0,
        "averageListeners" INTEGER DEFAULT 0,
        "totalDownloads" INTEGER DEFAULT 0,
        "monthlyDownloads" INTEGER DEFAULT 0,
        "averageCompletion" DOUBLE PRECISION DEFAULT 0,
        "totalRevenue" DOUBLE PRECISION DEFAULT 0,
        "monthlyRevenue" DOUBLE PRECISION DEFAULT 0,
        "averageCPM" DOUBLE PRECISION DEFAULT 0,
        "totalEpisodes" INTEGER DEFAULT 0,
        "publishedEpisodes" INTEGER DEFAULT 0,
        "averageEpisodeLength" INTEGER DEFAULT 0,
        "socialShares" INTEGER DEFAULT 0,
        "socialMentions" INTEGER DEFAULT 0,
        "sentimentScore" DOUBLE PRECISION DEFAULT 0,
        "spotifyListeners" INTEGER DEFAULT 0,
        "appleListeners" INTEGER DEFAULT 0,
        "googleListeners" INTEGER DEFAULT 0,
        "otherListeners" INTEGER DEFAULT 0,
        "demographics" JSONB DEFAULT '{}',
        "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "periodEnd" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ShowMetrics_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ShowMetrics_showId_key" UNIQUE ("showId")
    );
    
    -- UsageRecord table
    CREATE TABLE IF NOT EXISTS "UsageRecord" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "apiCalls" INTEGER DEFAULT 0,
        "storage" DOUBLE PRECISION DEFAULT 0,
        "bandwidth" DOUBLE PRECISION DEFAULT 0,
        "campaigns" INTEGER DEFAULT 0,
        "emailSends" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
    );
    
    -- =====================================================
    -- CONTENT & WORKFLOW TABLES
    -- =====================================================
    
    -- Comment table
    CREATE TABLE IF NOT EXISTS "Comment" (
        "id" TEXT NOT NULL,
        "adApprovalId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
    );
    
    -- EpisodeSpot table
    CREATE TABLE IF NOT EXISTS "EpisodeSpot" (
        "id" TEXT NOT NULL,
        "episodeId" TEXT NOT NULL,
        "orderItemId" TEXT,
        "placementType" TEXT NOT NULL,
        "spotNumber" INTEGER NOT NULL,
        "startTime" INTEGER,
        "endTime" INTEGER,
        "actualLength" INTEGER,
        "status" TEXT NOT NULL DEFAULT 'scheduled',
        "audioUrl" TEXT,
        "transcript" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "EpisodeSpot_pkey" PRIMARY KEY ("id")
    );
    
    -- UploadedFile table
    CREATE TABLE IF NOT EXISTS "UploadedFile" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "originalName" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "fileSize" INTEGER NOT NULL,
        "mimeType" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "s3Key" TEXT NOT NULL,
        "s3Url" TEXT NOT NULL,
        "entityType" TEXT,
        "entityId" TEXT,
        "description" TEXT,
        "uploadedById" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
    );
    
    -- CreativeUsage table
    CREATE TABLE IF NOT EXISTS "CreativeUsage" (
        "id" TEXT NOT NULL,
        "creativeId" TEXT NOT NULL,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "entityName" TEXT,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3),
        "impressions" INTEGER DEFAULT 0,
        "clicks" INTEGER DEFAULT 0,
        "conversions" INTEGER DEFAULT 0,
        "revenue" DOUBLE PRECISION DEFAULT 0,
        "notes" TEXT,
        "createdBy" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CreativeUsage_pkey" PRIMARY KEY ("id")
    );
    
    -- Reservation table
    CREATE TABLE IF NOT EXISTS "Reservation" (
        "id" TEXT NOT NULL,
        "reservationNumber" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "campaignId" TEXT,
        "advertiserId" TEXT NOT NULL,
        "agencyId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'held',
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
        "priority" TEXT NOT NULL DEFAULT 'normal',
        "source" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
    );
    
    -- ReservationItem table
    CREATE TABLE IF NOT EXISTS "ReservationItem" (
        "id" TEXT NOT NULL,
        "reservationId" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "episodeId" TEXT,
        "date" TIMESTAMP(3) NOT NULL,
        "placementType" TEXT NOT NULL,
        "spotNumber" INTEGER,
        "length" INTEGER NOT NULL,
        "rate" DOUBLE PRECISION NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'held',
        "inventoryId" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("id")
    );
    
    -- ReservationStatusHistory table
    CREATE TABLE IF NOT EXISTS "ReservationStatusHistory" (
        "id" TEXT NOT NULL,
        "reservationId" TEXT NOT NULL,
        "fromStatus" TEXT,
        "toStatus" TEXT NOT NULL,
        "reason" TEXT,
        "notes" TEXT,
        "changedBy" TEXT NOT NULL,
        "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ReservationStatusHistory_pkey" PRIMARY KEY ("id")
    );
    
    -- BlockedSpot table
    CREATE TABLE IF NOT EXISTS "BlockedSpot" (
        "id" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "placementType" TEXT NOT NULL,
        "spotNumber" INTEGER NOT NULL,
        "advertiserId" TEXT,
        "campaignId" TEXT,
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "reason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BlockedSpot_pkey" PRIMARY KEY ("id")
    );
    
    -- Inventory table
    CREATE TABLE IF NOT EXISTS "Inventory" (
        "id" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "placementType" TEXT NOT NULL,
        "totalSpots" INTEGER NOT NULL,
        "availableSpots" INTEGER NOT NULL,
        "reservedSpots" INTEGER NOT NULL DEFAULT 0,
        "bookedSpots" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Inventory_showId_date_placementType_key" UNIQUE ("showId", "date", "placementType")
    );
    
    -- ShowPlacement table
    CREATE TABLE IF NOT EXISTS "ShowPlacement" (
        "id" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "placementType" TEXT NOT NULL,
        "totalSpots" INTEGER NOT NULL DEFAULT 1,
        "liveReadSpots" INTEGER NOT NULL DEFAULT 0,
        "liveReadPercentage" DOUBLE PRECISION,
        "defaultLength" INTEGER NOT NULL DEFAULT 30,
        "availableLengths" INTEGER[],
        "baseRate" DOUBLE PRECISION NOT NULL,
        "rates" JSONB NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ShowPlacement_pkey" PRIMARY KEY ("id")
    );
    
    -- CampaignSchedule table
    CREATE TABLE IF NOT EXISTS "CampaignSchedule" (
        "id" TEXT NOT NULL,
        "campaignId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "version" INTEGER NOT NULL DEFAULT 1,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "exportedAt" TIMESTAMP(3),
        "exportedBy" TEXT,
        "exportUrl" TEXT,
        "clientApprovedAt" TIMESTAMP(3),
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdBy" TEXT NOT NULL,
        CONSTRAINT "CampaignSchedule_pkey" PRIMARY KEY ("id")
    );
    
    -- ScheduleItem table
    CREATE TABLE IF NOT EXISTS "ScheduleItem" (
        "id" TEXT NOT NULL,
        "scheduleId" TEXT NOT NULL,
        "showId" TEXT NOT NULL,
        "airDate" TIMESTAMP(3) NOT NULL,
        "placementType" TEXT NOT NULL,
        "length" INTEGER NOT NULL,
        "rate" DOUBLE PRECISION NOT NULL,
        "isLiveRead" BOOLEAN NOT NULL DEFAULT false,
        "notes" TEXT,
        "sortOrder" INTEGER,
        CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
    );
    
    -- =====================================================
    -- INTEGRATION TABLES
    -- =====================================================
    
    -- MegaphoneIntegration table
    CREATE TABLE IF NOT EXISTS "MegaphoneIntegration" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "apiToken" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "syncFrequency" TEXT NOT NULL DEFAULT 'daily',
        "lastSyncAt" TIMESTAMP(3),
        "syncStatus" TEXT NOT NULL DEFAULT 'idle',
        "lastError" TEXT,
        "settings" JSONB DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "MegaphoneIntegration_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "MegaphoneIntegration_organizationId_key" UNIQUE ("organizationId")
    );
    
    -- QuickBooksIntegration table
    CREATE TABLE IF NOT EXISTS "QuickBooksIntegration" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "accessToken" TEXT NOT NULL,
        "refreshToken" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "companyName" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "syncSettings" JSONB NOT NULL,
        "lastSyncAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "QuickBooksIntegration_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "QuickBooksIntegration_organizationId_key" UNIQUE ("organizationId")
    );
    
    -- QuickBooksSync table
    CREATE TABLE IF NOT EXISTS "QuickBooksSync" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "syncType" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "startDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
        "errors" JSONB,
        "startedAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "QuickBooksSync_pkey" PRIMARY KEY ("id")
    );
    
    -- FinancialData table
    CREATE TABLE IF NOT EXISTS "FinancialData" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "accountCode" TEXT NOT NULL,
        "accountName" TEXT NOT NULL,
        "accountType" TEXT NOT NULL,
        "year" INTEGER NOT NULL,
        "month" INTEGER NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "quickbooksId" TEXT,
        "syncId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "FinancialData_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "FinancialData_organizationId_accountCode_year_month_key" UNIQUE ("organizationId", "accountCode", "year", "month")
    );
    
    -- Create all indexes
    CREATE INDEX IF NOT EXISTS "Campaign_organizationId_idx" ON "Campaign"("organizationId");
    CREATE INDEX IF NOT EXISTS "Show_organizationId_idx" ON "Show"("organizationId");
    CREATE INDEX IF NOT EXISTS "Episode_organizationId_idx" ON "Episode"("organizationId");
    CREATE INDEX IF NOT EXISTS "Episode_showId_idx" ON "Episode"("showId");
    CREATE INDEX IF NOT EXISTS "Agency_organizationId_idx" ON "Agency"("organizationId");
    CREATE INDEX IF NOT EXISTS "Advertiser_organizationId_idx" ON "Advertiser"("organizationId");
    CREATE INDEX IF NOT EXISTS "AdApproval_organizationId_idx" ON "AdApproval"("organizationId");
    CREATE INDEX IF NOT EXISTS "DeletionRequest_status_idx" ON "DeletionRequest"("status");
    CREATE INDEX IF NOT EXISTS "DeletionRequest_entity_idx" ON "DeletionRequest"("entityType", "entityId");
    CREATE INDEX IF NOT EXISTS "DeletionRequest_requestedBy_idx" ON "DeletionRequest"("requestedBy");
    CREATE INDEX IF NOT EXISTS "Order_organizationId_idx" ON "Order"("organizationId");
    CREATE INDEX IF NOT EXISTS "Order_orderNumber_idx" ON "Order"("orderNumber");
    CREATE INDEX IF NOT EXISTS "Invoice_organizationId_idx" ON "Invoice"("organizationId");
    CREATE INDEX IF NOT EXISTS "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");
    CREATE INDEX IF NOT EXISTS "Contract_organizationId_idx" ON "Contract"("organizationId");
    CREATE INDEX IF NOT EXISTS "Contract_contractNumber_idx" ON "Contract"("contractNumber");
    
    -- Reset search path
    SET search_path TO public;
    
    RAISE NOTICE 'Created schema % with all tables', schema_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 3: Create function to migrate existing data
-- =====================================================

CREATE OR REPLACE FUNCTION migrate_existing_org_data(org_id TEXT, org_slug TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
    record_count INTEGER;
    total_count INTEGER := 0;
    table_name TEXT;
BEGIN
    schema_name := 'org_' || replace(lower(org_slug), '-', '_');
    
    RAISE NOTICE 'Migrating data for % to schema %', org_slug, schema_name;
    
    -- Array of tables to migrate
    FOR table_name IN SELECT unnest(ARRAY[
        'Campaign', 'Show', 'Episode', 'Agency', 'Advertiser', 
        'AdApproval', 'Order', 'Invoice', 'Contract', 'Expense'
    ])
    LOOP
        BEGIN
            -- Check if table exists in public schema
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = table_name
            ) THEN
                -- Migrate data
                EXECUTE format('
                    INSERT INTO %I.%I 
                    SELECT * FROM public.%I 
                    WHERE "organizationId" = %L
                    ON CONFLICT DO NOTHING',
                    schema_name, table_name, table_name, org_id
                );
                GET DIAGNOSTICS record_count = ROW_COUNT;
                total_count := total_count + record_count;
                IF record_count > 0 THEN
                    RAISE NOTICE 'Migrated % records from %', record_count, table_name;
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not migrate % - %', table_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Total records migrated for %: %', org_slug, total_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 4: Run the migration
-- =====================================================

-- Create schemas for existing organizations
SELECT create_complete_org_schema('podcastflow-pro', 'cmd2qfeve0000og5y8hfwu795');
SELECT create_complete_org_schema('unfy', 'cmd6ntwt00001og415m69qh50');

-- Migrate any existing data
SELECT migrate_existing_org_data('cmd2qfeve0000og5y8hfwu795', 'podcastflow-pro');
SELECT migrate_existing_org_data('cmd6ntwt00001og415m69qh50', 'unfy');

-- =====================================================
-- STEP 5: Create views for master account
-- =====================================================

CREATE OR REPLACE VIEW master_all_campaigns AS
SELECT 'podcastflow_pro' as org_schema, 'cmd2qfeve0000og5y8hfwu795' as org_id, * 
FROM org_podcastflow_pro."Campaign"
UNION ALL
SELECT 'unfy' as org_schema, 'cmd6ntwt00001og415m69qh50' as org_id, * 
FROM org_unfy."Campaign";

CREATE OR REPLACE VIEW master_all_shows AS
SELECT 'podcastflow_pro' as org_schema, 'cmd2qfeve0000og5y8hfwu795' as org_id, * 
FROM org_podcastflow_pro."Show"
UNION ALL
SELECT 'unfy' as org_schema, 'cmd6ntwt00001og415m69qh50' as org_id, * 
FROM org_unfy."Show";

CREATE OR REPLACE VIEW master_all_orders AS
SELECT 'podcastflow_pro' as org_schema, 'cmd2qfeve0000og5y8hfwu795' as org_id, * 
FROM org_podcastflow_pro."Order"
UNION ALL
SELECT 'unfy' as org_schema, 'cmd6ntwt00001og415m69qh50' as org_id, * 
FROM org_unfy."Order";

-- Grant permissions
GRANT SELECT ON master_all_campaigns TO podcastflow;
GRANT SELECT ON master_all_shows TO podcastflow;
GRANT SELECT ON master_all_orders TO podcastflow;

-- =====================================================
-- STEP 6: Create schema switching function
-- =====================================================

CREATE OR REPLACE FUNCTION set_org_context(org_slug TEXT)
RETURNS void AS $$
DECLARE
    schema_name TEXT;
BEGIN
    IF org_slug IS NULL THEN
        SET search_path TO public;
    ELSE
        schema_name := 'org_' || replace(lower(org_slug), '-', '_');
        EXECUTE format('SET search_path TO %I, public', schema_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check created schemas
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name LIKE 'org_%'
ORDER BY schema_name;

-- Check tables in each schema
SELECT 
    table_schema,
    COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema LIKE 'org_%'
GROUP BY table_schema
ORDER BY table_schema;