-- Distribute Campaign Spending Across 18 Months
-- Creates daily spending records for all campaigns

-- First, reset the spent column to 0 for all campaigns
UPDATE "Campaign" 
SET spent = 0 
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';

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
            
            daily_clicks := (daily_impressions * (0.015 + RANDOM() * 0.025))::INTEGER;
            daily_conversions := (daily_clicks * (0.03 + RANDOM() * 0.07))::INTEGER;
            
            INSERT INTO "CampaignAnalytics" (
                id, "campaignId", "organizationId", date,
                impressions, clicks, conversions,
                spent, revenue,
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                campaign_record.id,
                org_id,
                current_day,
                daily_impressions,
                daily_clicks,
                daily_conversions,
                daily_budget::INTEGER,
                (daily_conversions * (50 + RANDOM() * 150))::INTEGER,
                current_day,
                current_day
            );
            
            analytics_created := analytics_created + 1;
            current_day := current_day + INTERVAL '1 day';
        END LOOP;
        
        -- Update campaign spent amount
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
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Monthly Campaign Spending Distribution:';
    RAISE NOTICE '======================================';
    
    FOR month_record IN 
        SELECT 
            TO_CHAR(date, 'YYYY-MM') as month,
            COUNT(DISTINCT "campaignId") as active_campaigns,
            SUM(spent)::INTEGER as monthly_spent,
            SUM(revenue)::INTEGER as monthly_revenue,
            SUM(impressions) as impressions,
            SUM(conversions) as conversions
        FROM "CampaignAnalytics"
        WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795'
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY month
    LOOP
        RAISE NOTICE '% | Campaigns: % | Spent: $% | Revenue: $% | Impressions: %', 
            month_record.month, 
            month_record.active_campaigns, 
            TO_CHAR(month_record.monthly_spent, 'FM999,999'),
            TO_CHAR(month_record.monthly_revenue, 'FM999,999'),
            TO_CHAR(month_record.impressions, 'FM999,999');
        total_spent_all := total_spent_all + month_record.monthly_spent;
    END LOOP;
    
    RAISE NOTICE '======================================';
    RAISE NOTICE 'Total Spent Across All Months: $%', TO_CHAR(total_spent_all, 'FM999,999,999');
END $$;

-- Update campaign payment status based on completion
UPDATE "Campaign"
SET "paymentStatus" = CASE 
    WHEN status = 'completed' AND "endDate" < CURRENT_DATE - INTERVAL '30 days' THEN 'paid'
    WHEN status = 'completed' THEN 'invoiced'
    WHEN status = 'active' THEN 'pending'
    ELSE 'not_paid'
END,
"paidAt" = CASE 
    WHEN status = 'completed' AND "endDate" < CURRENT_DATE - INTERVAL '30 days' 
    THEN "endDate" + INTERVAL '30 days'
    ELSE NULL
END
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';

-- Final Summary
DO $$
DECLARE
    total_campaigns INTEGER;
    total_budget NUMERIC;
    total_spent NUMERIC;
    total_revenue NUMERIC;
    campaigns_with_analytics INTEGER;
    total_analytics_records INTEGER;
BEGIN
    SELECT 
        COUNT(*),
        SUM(budget),
        SUM(spent)
    INTO total_campaigns, total_budget, total_spent
    FROM "Campaign" 
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    SELECT 
        COUNT(DISTINCT "campaignId"),
        COUNT(*),
        SUM(revenue)
    INTO campaigns_with_analytics, total_analytics_records, total_revenue
    FROM "CampaignAnalytics"
    WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '    CAMPAIGN SPENDING DISTRIBUTION COMPLETE';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 CAMPAIGN TOTALS:';
    RAISE NOTICE '   ✓ Total Campaigns: %', total_campaigns;
    RAISE NOTICE '   ✓ Total Budget: $%', TO_CHAR(total_budget, 'FM999,999,999');
    RAISE NOTICE '   ✓ Total Spent: $%', TO_CHAR(total_spent, 'FM999,999,999');
    RAISE NOTICE '';
    RAISE NOTICE '📈 ANALYTICS:';
    RAISE NOTICE '   ✓ Campaigns with Analytics: %', campaigns_with_analytics;
    RAISE NOTICE '   ✓ Daily Analytics Records: %', total_analytics_records;
    RAISE NOTICE '   ✓ Total Revenue Generated: $%', TO_CHAR(total_revenue, 'FM999,999,999');
    RAISE NOTICE '';
    RAISE NOTICE '✅ Campaign spending is now properly distributed';
    RAISE NOTICE '   across the entire 18-month period!';
    RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;