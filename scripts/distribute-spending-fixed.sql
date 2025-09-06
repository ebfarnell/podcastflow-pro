-- Distribute Campaign Spending Across 18 Months (Fixed Version)
-- Creates daily spending records for all campaigns

-- Create Campaign Analytics with proper daily spending
DO $$
DECLARE
    campaign_record RECORD;
    current_day DATE;
    days_in_campaign INTEGER;
    daily_budget NUMERIC;
    daily_impressions INTEGER;
    daily_clicks INTEGER;
    daily_conversions INTEGER;
    running_total NUMERIC;
    ctr NUMERIC;
    conversion_rate NUMERIC;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    analytics_created INTEGER := 0;
BEGIN
    RAISE NOTICE 'Creating campaign analytics with distributed spending...';
    
    -- Delete existing analytics to start fresh
    DELETE FROM "CampaignAnalytics" WHERE "organizationId" = org_id;
    
    FOR campaign_record IN 
        SELECT * FROM "Campaign" 
        WHERE "organizationId" = org_id 
        AND status IN ('active', 'completed')
        ORDER BY "startDate"
    LOOP
        -- Calculate daily budget
        days_in_campaign := GREATEST(1, (campaign_record."endDate"::DATE - campaign_record."startDate"::DATE));
        daily_budget := campaign_record.budget / days_in_campaign;
        running_total := 0;
        
        current_day := campaign_record."startDate"::DATE;
        
        -- Create daily records for the entire campaign duration
        WHILE current_day <= LEAST(campaign_record."endDate"::DATE, CURRENT_DATE) LOOP
            -- Vary metrics based on day of week and campaign progress
            daily_impressions := CASE 
                WHEN EXTRACT(DOW FROM current_day) IN (0, 6) THEN -- Weekend
                    (1000 + RANDOM() * 2000)::INTEGER
                ELSE -- Weekday
                    (2000 + RANDOM() * 4000)::INTEGER
            END;
            
            -- Add some randomness to spending (80-120% of daily budget)
            daily_budget := campaign_record.budget / days_in_campaign * (0.8 + RANDOM() * 0.4);
            running_total := running_total + daily_budget;
            
            -- Ensure we don't overspend
            IF running_total > campaign_record.budget THEN
                daily_budget := campaign_record.budget - (running_total - daily_budget);
                running_total := campaign_record.budget;
            END IF;
            
            -- Calculate realistic metrics
            ctr := 0.015 + RANDOM() * 0.025; -- 1.5-4% CTR
            conversion_rate := 0.03 + RANDOM() * 0.07; -- 3-10% conversion rate
            
            daily_clicks := (daily_impressions * ctr)::INTEGER;
            daily_conversions := (daily_clicks * conversion_rate)::INTEGER;
            
            INSERT INTO "CampaignAnalytics" (
                id, "campaignId", "organizationId", date,
                impressions, clicks, conversions,
                ctr, "conversionRate", spent,
                cpc, cpa, "engagementRate",
                "adPlaybacks", "completionRate",
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                campaign_record.id,
                org_id,
                current_day,
                daily_impressions,
                daily_clicks,
                daily_conversions,
                ctr,
                conversion_rate,
                daily_budget,
                CASE WHEN daily_clicks > 0 THEN daily_budget / daily_clicks ELSE 0 END, -- CPC
                CASE WHEN daily_conversions > 0 THEN daily_budget / daily_conversions ELSE 0 END, -- CPA
                ctr * 1.2, -- Engagement rate slightly higher than CTR
                daily_impressions, -- Ad playbacks = impressions
                0.85 + RANDOM() * 0.10, -- 85-95% completion rate
                current_day,
                current_day
            );
            
            analytics_created := analytics_created + 1;
            current_day := current_day + INTERVAL '1 day';
        END LOOP;
        
        -- Update campaign totals
        UPDATE "Campaign"
        SET spent = LEAST(running_total, budget),
            impressions = (SELECT SUM(impressions) FROM "CampaignAnalytics" WHERE "campaignId" = campaign_record.id),
            clicks = (SELECT SUM(clicks) FROM "CampaignAnalytics" WHERE "campaignId" = campaign_record.id),
            conversions = (SELECT SUM(conversions) FROM "CampaignAnalytics" WHERE "campaignId" = campaign_record.id)
        WHERE id = campaign_record.id;
    END LOOP;
    
    RAISE NOTICE 'Created % daily analytics records', analytics_created;
END $$;

-- Create monthly spending summary to verify distribution
DO $$
DECLARE
    month_record RECORD;
    total_spent_all NUMERIC := 0;
    total_conversions_all INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Monthly Campaign Spending Distribution:';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    RAISE NOTICE 'Month    | Campaigns | Spent      | Impressions | Conversions';
    RAISE NOTICE '---------|-----------|------------|-------------|------------';
    
    FOR month_record IN 
        SELECT 
            TO_CHAR(date, 'YYYY-MM') as month,
            COUNT(DISTINCT "campaignId") as active_campaigns,
            SUM(spent)::INTEGER as monthly_spent,
            SUM(impressions) as impressions,
            SUM(conversions) as conversions
        FROM "CampaignAnalytics"
        WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795'
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY month
    LOOP
        RAISE NOTICE '% |    %     | $% | % | %', 
            month_record.month, 
            LPAD(month_record.active_campaigns::TEXT, 2),
            LPAD(TO_CHAR(month_record.monthly_spent, 'FM999,999'), 8),
            LPAD(TO_CHAR(month_record.impressions, 'FM999,999'), 11),
            LPAD(TO_CHAR(month_record.conversions, 'FM999,999'), 10);
        total_spent_all := total_spent_all + month_record.monthly_spent;
        total_conversions_all := total_conversions_all + month_record.conversions;
    END LOOP;
    
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    RAISE NOTICE 'TOTAL    |           | $% |             | %',
        LPAD(TO_CHAR(total_spent_all, 'FM999,999'), 8),
        LPAD(TO_CHAR(total_conversions_all, 'FM999,999'), 10);
    RAISE NOTICE '';
    RAISE NOTICE 'Average ROI: %x (based on $100 per conversion value)', 
        ROUND((total_conversions_all * 100 / NULLIF(total_spent_all, 0))::NUMERIC, 2);
END $$;

-- Final Summary
DO $$
DECLARE
    total_campaigns INTEGER;
    active_campaigns INTEGER;
    completed_campaigns INTEGER;
    total_budget NUMERIC;
    total_spent NUMERIC;
    campaigns_with_analytics INTEGER;
    total_analytics_records INTEGER;
    date_range_start DATE;
    date_range_end DATE;
BEGIN
    SELECT 
        COUNT(*),
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
        SUM(budget),
        SUM(spent)
    INTO total_campaigns, active_campaigns, completed_campaigns, total_budget, total_spent
    FROM "Campaign" 
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    SELECT 
        COUNT(DISTINCT "campaignId"),
        COUNT(*),
        MIN(date),
        MAX(date)
    INTO campaigns_with_analytics, total_analytics_records, date_range_start, date_range_end
    FROM "CampaignAnalytics"
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '    CAMPAIGN SPENDING DISTRIBUTION COMPLETE';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 CAMPAIGN SUMMARY:';
    RAISE NOTICE '   ✓ Total Campaigns: % (Active: %, Completed: %)', 
        total_campaigns, active_campaigns, completed_campaigns;
    RAISE NOTICE '   ✓ Total Budget: $%', TO_CHAR(total_budget, 'FM999,999,999');
    RAISE NOTICE '   ✓ Total Spent: $%', TO_CHAR(total_spent, 'FM999,999,999');
    RAISE NOTICE '   ✓ Budget Utilization: %', ROUND((total_spent / NULLIF(total_budget, 0) * 100)::NUMERIC, 1) || '%';
    RAISE NOTICE '';
    RAISE NOTICE '📈 ANALYTICS COVERAGE:';
    RAISE NOTICE '   ✓ Campaigns with Analytics: %', campaigns_with_analytics;
    RAISE NOTICE '   ✓ Daily Analytics Records: %', TO_CHAR(total_analytics_records, 'FM999,999');
    RAISE NOTICE '   ✓ Date Range: % to %', date_range_start, date_range_end;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Campaign spending is now properly distributed';
    RAISE NOTICE '   across the entire 18-month period with daily';
    RAISE NOTICE '   granularity for accurate financial reporting!';
    RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;