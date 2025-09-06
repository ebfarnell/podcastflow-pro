-- Public Schema Cleanup Script - Proper Order
-- Date: 2025-07-20
-- Purpose: Remove organization-specific tables from public schema in dependency order

-- Start transaction
BEGIN;

-- 1. Drop tables that depend on Episode
DROP TABLE IF EXISTS public."EpisodeSpot";
DROP TABLE IF EXISTS public."EpisodeTalentNote";
DROP TABLE IF EXISTS public."EpisodeTalentTask";
DROP TABLE IF EXISTS public."EpisodeAnalytics";
DROP TABLE IF EXISTS public."EpisodeRating";
DROP TABLE IF EXISTS public."_EpisodeProducers";
DROP TABLE IF EXISTS public."_EpisodeTalent";
DROP TABLE IF EXISTS public."MegaphoneEpisode";

-- 2. Drop tables that depend on Show
DROP TABLE IF EXISTS public."ShowPlacement";
DROP TABLE IF EXISTS public."ShowAnalytics";
DROP TABLE IF EXISTS public."ShowMetrics";
DROP TABLE IF EXISTS public."_ShowProducers";
DROP TABLE IF EXISTS public."_ShowTalent";
DROP TABLE IF EXISTS public."BlockedSpot";
DROP TABLE IF EXISTS public."Inventory";
DROP TABLE IF EXISTS public."ScheduleItem";
DROP TABLE IF EXISTS public."Activity";
DROP TABLE IF EXISTS public."MegaphonePodcast";

-- 3. Drop tables that depend on Campaign
DROP TABLE IF EXISTS public."CampaignVersion";
DROP TABLE IF EXISTS public."CampaignChangeHistory";
DROP TABLE IF EXISTS public."CampaignApproval";
DROP TABLE IF EXISTS public."CampaignSchedule";
DROP TABLE IF EXISTS public."CampaignKPI";
DROP TABLE IF EXISTS public."CampaignAnalytics";
DROP TABLE IF EXISTS public."KPIHistory";
DROP TABLE IF EXISTS public."KPIUpdateToken";
DROP TABLE IF EXISTS public."SpotSubmission";
DROP TABLE IF EXISTS public."CreativeUsage";

-- 4. Drop tables that depend on Order
DROP TABLE IF EXISTS public."OrderItem";
DROP TABLE IF EXISTS public."OrderChangeHistory";
DROP TABLE IF EXISTS public."OrderStatusHistory";
DROP TABLE IF EXISTS public."OrderVersion";

-- 5. Drop tables that depend on Contract
DROP TABLE IF EXISTS public."ContractLineItem";
DROP TABLE IF EXISTS public."ContractSignature";
DROP TABLE IF EXISTS public."ContractDocument";
DROP TABLE IF EXISTS public."ContractHistory";

-- 6. Drop tables that depend on Advertiser/Agency
DROP TABLE IF EXISTS public."_AdvertiserClients";
DROP TABLE IF EXISTS public."_AgencyClients";

-- 7. Drop tables that depend on Invoice
DROP TABLE IF EXISTS public."InvoiceItem";

-- 8. Drop tables that depend on Reservation
DROP TABLE IF EXISTS public."ReservationItem";
DROP TABLE IF EXISTS public."ReservationStatusHistory";

-- 9. Drop AdApproval (depends on Show, Campaign, Episode)
DROP TABLE IF EXISTS public."AdApproval";

-- 10. Drop financial tables
DROP TABLE IF EXISTS public."Payment";
DROP TABLE IF EXISTS public."Expense";
DROP TABLE IF EXISTS public."FinancialData";
DROP TABLE IF EXISTS public."BudgetEntry";
DROP TABLE IF EXISTS public."BudgetCategory";
DROP TABLE IF EXISTS public."EmployeeCompensation";

-- 11. Drop integration tables
DROP TABLE IF EXISTS public."MegaphoneNetwork";
DROP TABLE IF EXISTS public."MegaphoneSyncLog";
DROP TABLE IF EXISTS public."MegaphoneIntegration";
DROP TABLE IF EXISTS public."QuickBooksIntegration";
DROP TABLE IF EXISTS public."QuickBooksSync";

-- 12. Drop other dependent tables
DROP TABLE IF EXISTS public."UploadedFile";
DROP TABLE IF EXISTS public."AdCreative";
DROP TABLE IF EXISTS public."ReportTemplate";
DROP TABLE IF EXISTS public."ContractTemplate";
DROP TABLE IF EXISTS public."DeletionRequest";
DROP TABLE IF EXISTS public."Comment";
DROP TABLE IF EXISTS public."Notification";
DROP TABLE IF EXISTS public."AnalyticsEvent";

-- 13. Now drop the main tables
DROP TABLE IF EXISTS public."Episode";
DROP TABLE IF EXISTS public."Reservation";
DROP TABLE IF EXISTS public."Order";
DROP TABLE IF EXISTS public."Invoice";
DROP TABLE IF EXISTS public."Contract";
DROP TABLE IF EXISTS public."Campaign";
DROP TABLE IF EXISTS public."Show";
DROP TABLE IF EXISTS public."Advertiser";
DROP TABLE IF EXISTS public."Agency";

-- Commit transaction
COMMIT;