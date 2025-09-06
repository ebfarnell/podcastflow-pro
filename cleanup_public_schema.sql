-- Public Schema Cleanup Script
-- Date: 2025-07-20
-- Purpose: Remove organization-specific tables from public schema
-- These tables should only exist in organization schemas (org_*)

-- First, drop dependent objects and constraints
-- Drop junction tables first
DROP TABLE IF EXISTS public."_ShowProducers" CASCADE;
DROP TABLE IF EXISTS public."_ShowTalent" CASCADE;
DROP TABLE IF EXISTS public."_EpisodeProducers" CASCADE;
DROP TABLE IF EXISTS public."_EpisodeTalent" CASCADE;
DROP TABLE IF EXISTS public."_AdvertiserClients" CASCADE;
DROP TABLE IF EXISTS public."_AgencyClients" CASCADE;

-- Drop analytics tables
DROP TABLE IF EXISTS public."ShowAnalytics" CASCADE;
DROP TABLE IF EXISTS public."EpisodeAnalytics" CASCADE;
DROP TABLE IF EXISTS public."EpisodeRating" CASCADE;
DROP TABLE IF EXISTS public."CampaignAnalytics" CASCADE;
DROP TABLE IF EXISTS public."AnalyticsEvent" CASCADE;

-- Drop dependent business tables
DROP TABLE IF EXISTS public."AdApproval" CASCADE;
DROP TABLE IF EXISTS public."ShowMetrics" CASCADE;
DROP TABLE IF EXISTS public."ShowPlacement" CASCADE;
DROP TABLE IF EXISTS public."BlockedSpot" CASCADE;
DROP TABLE IF EXISTS public."OrderItem" CASCADE;
DROP TABLE IF EXISTS public."InvoiceItem" CASCADE;
DROP TABLE IF EXISTS public."Inventory" CASCADE;
DROP TABLE IF EXISTS public."ScheduleItem" CASCADE;
DROP TABLE IF EXISTS public."ContractLineItem" CASCADE;
DROP TABLE IF EXISTS public."ContractSignature" CASCADE;
DROP TABLE IF EXISTS public."ContractDocument" CASCADE;
DROP TABLE IF EXISTS public."ContractHistory" CASCADE;
DROP TABLE IF EXISTS public."ReservationItem" CASCADE;
DROP TABLE IF EXISTS public."ReservationStatusHistory" CASCADE;
DROP TABLE IF EXISTS public."Activity" CASCADE;
DROP TABLE IF EXISTS public."Comment" CASCADE;
DROP TABLE IF EXISTS public."Notification" CASCADE;
DROP TABLE IF EXISTS public."EpisodeSpot" CASCADE;
DROP TABLE IF EXISTS public."EpisodeTalentNote" CASCADE;
DROP TABLE IF EXISTS public."EpisodeTalentTask" CASCADE;
DROP TABLE IF EXISTS public."SpotSubmission" CASCADE;
DROP TABLE IF EXISTS public."CreativeUsage" CASCADE;
DROP TABLE IF EXISTS public."CampaignVersion" CASCADE;
DROP TABLE IF EXISTS public."CampaignChangeHistory" CASCADE;
DROP TABLE IF EXISTS public."CampaignApproval" CASCADE;
DROP TABLE IF EXISTS public."CampaignSchedule" CASCADE;
DROP TABLE IF EXISTS public."CampaignKPI" CASCADE;
DROP TABLE IF EXISTS public."KPIHistory" CASCADE;
DROP TABLE IF EXISTS public."KPIUpdateToken" CASCADE;
DROP TABLE IF EXISTS public."OrderChangeHistory" CASCADE;
DROP TABLE IF EXISTS public."OrderStatusHistory" CASCADE;
DROP TABLE IF EXISTS public."OrderVersion" CASCADE;

-- Drop megaphone integration tables (org-specific)
DROP TABLE IF EXISTS public."MegaphoneEpisode" CASCADE;
DROP TABLE IF EXISTS public."MegaphonePodcast" CASCADE;
DROP TABLE IF EXISTS public."MegaphoneNetwork" CASCADE;
DROP TABLE IF EXISTS public."MegaphoneSyncLog" CASCADE;
DROP TABLE IF EXISTS public."MegaphoneIntegration" CASCADE;

-- Drop financial tables (org-specific)
DROP TABLE IF EXISTS public."Payment" CASCADE;
DROP TABLE IF EXISTS public."Invoice" CASCADE;
DROP TABLE IF EXISTS public."Expense" CASCADE;
DROP TABLE IF EXISTS public."FinancialData" CASCADE;
DROP TABLE IF EXISTS public."BudgetEntry" CASCADE;
DROP TABLE IF EXISTS public."BudgetCategory" CASCADE;
DROP TABLE IF EXISTS public."EmployeeCompensation" CASCADE;

-- Drop quickbooks tables (org-specific)
DROP TABLE IF EXISTS public."QuickBooksIntegration" CASCADE;
DROP TABLE IF EXISTS public."QuickBooksSync" CASCADE;

-- Drop other org-specific tables
DROP TABLE IF EXISTS public."UploadedFile" CASCADE;
DROP TABLE IF EXISTS public."AdCreative" CASCADE;
DROP TABLE IF EXISTS public."ReportTemplate" CASCADE;
DROP TABLE IF EXISTS public."ContractTemplate" CASCADE;
DROP TABLE IF EXISTS public."DeletionRequest" CASCADE;
DROP TABLE IF EXISTS public."Reservation" CASCADE;
DROP TABLE IF EXISTS public."Order" CASCADE;
DROP TABLE IF EXISTS public."Contract" CASCADE;

-- Drop core business tables last
DROP TABLE IF EXISTS public."Episode" CASCADE;
DROP TABLE IF EXISTS public."Campaign" CASCADE;
DROP TABLE IF EXISTS public."Advertiser" CASCADE;
DROP TABLE IF EXISTS public."Agency" CASCADE;
DROP TABLE IF EXISTS public."Show" CASCADE;

-- Tables that should REMAIN in public schema:
-- User, Organization, Session, BillingPlan
-- MonitoringAlert, SystemMetric, SystemLog, ServiceHealth
-- UsageRecord (platform usage tracking)