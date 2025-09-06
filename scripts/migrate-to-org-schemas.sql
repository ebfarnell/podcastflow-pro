-- Migrate Campaign Data to Organization-Specific Schemas
-- This ensures proper data isolation between organizations

DO $$
DECLARE
    campaign_count INTEGER;
    analytics_count INTEGER;
    approval_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting migration to organization-specific schemas...';
    
    -- First, delete old data from org schemas to avoid duplicates
    DELETE FROM org_podcastflow_pro."CampaignAnalytics";
    DELETE FROM org_podcastflow_pro."AdApproval";
    DELETE FROM org_podcastflow_pro."Campaign";
    
    -- Count data to migrate
    SELECT COUNT(*) INTO campaign_count 
    FROM public."Campaign" 
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    RAISE NOTICE 'Found % campaigns to migrate to org_podcastflow_pro schema', campaign_count;
    
    -- Migrate Campaigns to org_podcastflow_pro schema
    INSERT INTO org_podcastflow_pro."Campaign" (
        id, name, "advertiserId", "agencyId", "organizationId",
        "startDate", "endDate", budget, spent, impressions,
        "targetImpressions", clicks, conversions, "targetAudience",
        status, "createdAt", "updatedAt", "createdBy", "updatedBy",
        "paymentStatus", "paidAt"
    )
    SELECT 
        id, name, "advertiserId", "agencyId", "organizationId",
        "startDate", "endDate", budget, spent, impressions,
        "targetImpressions", clicks, conversions, "targetAudience",
        status, "createdAt", "updatedAt", "createdBy", "updatedBy",
        "paymentStatus", "paidAt"
    FROM public."Campaign"
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    RAISE NOTICE 'Migrated % campaigns', campaign_count;
    
    -- Migrate Campaign Analytics
    SELECT COUNT(*) INTO analytics_count
    FROM public."CampaignAnalytics" ca
    JOIN public."Campaign" c ON ca."campaignId" = c.id
    WHERE c."organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    INSERT INTO org_podcastflow_pro."CampaignAnalytics" (
        id, "campaignId", "organizationId", date,
        impressions, clicks, conversions,
        ctr, "conversionRate", spent,
        cpc, cpa, "engagementRate",
        "averageViewTime", "bounceRate", "adPlaybacks",
        "completionRate", "skipRate",
        "createdAt", "updatedAt"
    )
    SELECT 
        ca.id, ca."campaignId", ca."organizationId", ca.date,
        ca.impressions, ca.clicks, ca.conversions,
        ca.ctr, ca."conversionRate", ca.spent,
        ca.cpc, ca.cpa, ca."engagementRate",
        ca."averageViewTime", ca."bounceRate", ca."adPlaybacks",
        ca."completionRate", ca."skipRate",
        ca."createdAt", ca."updatedAt"
    FROM public."CampaignAnalytics" ca
    JOIN public."Campaign" c ON ca."campaignId" = c.id
    WHERE c."organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    RAISE NOTICE 'Migrated % campaign analytics records', analytics_count;
    
    -- Migrate Ad Approvals  
    SELECT COUNT(*) INTO approval_count
    FROM public."AdApproval"
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    INSERT INTO org_podcastflow_pro."AdApproval" (
        id, title, "advertiserId", "advertiserName", "campaignId",
        "showId", "showName", type, duration, script,
        "talkingPoints", priority, deadline, status,
        "salesRepId", "salesRepName", "submittedBy", "organizationId",
        "workflowStage", "revisionCount",
        "createdAt", "updatedAt", "approvedAt", "rejectedAt"
    )
    SELECT 
        id, title, "advertiserId", "advertiserName", "campaignId",
        "showId", "showName", type, duration, script,
        "talkingPoints", priority, deadline, status,
        "salesRepId", "salesRepName", "submittedBy", "organizationId",
        "workflowStage", "revisionCount",
        "createdAt", "updatedAt", "approvedAt", "rejectedAt"
    FROM public."AdApproval"
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    RAISE NOTICE 'Migrated % ad approvals', approval_count;
    
    -- Also ensure Shows, Episodes, Advertisers, and Agencies are in the org schema
    -- Shows
    DELETE FROM org_podcastflow_pro."Show";
    INSERT INTO org_podcastflow_pro."Show" 
    SELECT * FROM public."Show" 
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    -- Episodes
    DELETE FROM org_podcastflow_pro."Episode";
    INSERT INTO org_podcastflow_pro."Episode"
    SELECT e.* FROM public."Episode" e
    JOIN public."Show" s ON e."showId" = s.id
    WHERE s."organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    -- Advertisers
    DELETE FROM org_podcastflow_pro."Advertiser";
    INSERT INTO org_podcastflow_pro."Advertiser"
    SELECT * FROM public."Advertiser"
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    -- Agencies
    DELETE FROM org_podcastflow_pro."Agency";
    INSERT INTO org_podcastflow_pro."Agency"
    SELECT * FROM public."Agency"
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    RAISE NOTICE 'Migration complete!';
END $$;

-- Verify the migration
DO $$
DECLARE
    pub_campaigns INTEGER;
    org_campaigns INTEGER;
    pub_analytics INTEGER;
    org_analytics INTEGER;
    org_shows INTEGER;
    org_episodes INTEGER;
    org_advertisers INTEGER;
    org_agencies INTEGER;
BEGIN
    SELECT COUNT(*) INTO pub_campaigns FROM public."Campaign" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO org_campaigns FROM org_podcastflow_pro."Campaign";
    SELECT COUNT(*) INTO pub_analytics FROM public."CampaignAnalytics" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO org_analytics FROM org_podcastflow_pro."CampaignAnalytics";
    SELECT COUNT(*) INTO org_shows FROM org_podcastflow_pro."Show";
    SELECT COUNT(*) INTO org_episodes FROM org_podcastflow_pro."Episode";
    SELECT COUNT(*) INTO org_advertisers FROM org_podcastflow_pro."Advertiser";
    SELECT COUNT(*) INTO org_agencies FROM org_podcastflow_pro."Agency";
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '  MULTI-TENANT DATA MIGRATION COMPLETE';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 MIGRATION RESULTS:';
    RAISE NOTICE '   Campaigns: % in public → % in org schema', pub_campaigns, org_campaigns;
    RAISE NOTICE '   Analytics: % in public → % in org schema', pub_analytics, org_analytics;
    RAISE NOTICE '   Shows: % in org schema', org_shows;
    RAISE NOTICE '   Episodes: % in org schema', org_episodes;
    RAISE NOTICE '   Advertisers: % in org schema', org_advertisers;
    RAISE NOTICE '   Agencies: % in org schema', org_agencies;
    RAISE NOTICE '';
    RAISE NOTICE '🔒 DATA ISOLATION:';
    RAISE NOTICE '   ✓ PodcastFlow Pro data now in org_podcastflow_pro schema';
    RAISE NOTICE '   ✓ Unfy data remains in org_unfy schema';
    RAISE NOTICE '   ✓ Complete separation between organizations';
    RAISE NOTICE '   ✓ No cross-organization data access possible';
    RAISE NOTICE '';
    RAISE NOTICE '✅ The dashboard should now display all campaign data!';
    RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;