-- Complete Campaign Data Creation
-- Fills in missing Orders, Ad Approvals, Analytics, etc.

-- Phase 1: Create Orders for campaigns that don't have them
DO $$
DECLARE
    campaign_record RECORD;
    order_id TEXT;
    order_counter INTEGER := 1;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating orders for campaigns...';
    
    FOR campaign_record IN 
        SELECT c.* FROM "Campaign" c
        LEFT JOIN "Order" o ON c.id = o."campaignId"
        WHERE c."organizationId" = org_id
        AND o.id IS NULL
    LOOP
        order_id := gen_random_uuid();
        
        INSERT INTO "Order" (
            id, "organizationId", "campaignId", "advertiserId", "agencyId",
            "orderNumber", "totalAmount", status,
            "createdAt", "updatedAt"
        ) VALUES (
            order_id,
            org_id,
            campaign_record.id,
            campaign_record."advertiserId",
            campaign_record."agencyId",
            'ORD-' || TO_CHAR(campaign_record."startDate", 'YYYY') || '-' || LPAD(order_counter::TEXT, 5, '0'),
            campaign_record.budget,
            CASE 
                WHEN campaign_record.status = 'completed' THEN 'confirmed'::"OrderStatus"
                WHEN campaign_record.status = 'active' THEN 'booked'::"OrderStatus"
                ELSE 'draft'::"OrderStatus"
            END,
            campaign_record."startDate" - INTERVAL '5 days',
            campaign_record."startDate"
        );
        
        order_counter := order_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Created % orders', order_counter - 1;
END $$;

-- Phase 2: Create Ad Approvals with proper schema (requires showId)
DO $$
DECLARE
    campaign_record RECORD;
    show_record RECORD;
    approval_id TEXT;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    admin_user_id TEXT;
    approval_counter INTEGER := 0;
BEGIN
    RAISE NOTICE 'Creating ad approvals...';
    
    SELECT id INTO admin_user_id FROM "User" WHERE email = 'admin@podcastflow.pro' LIMIT 1;
    
    FOR campaign_record IN 
        SELECT c.*, a.name as advertiser_name 
        FROM "Campaign" c
        JOIN "Advertiser" a ON c."advertiserId" = a.id
        LEFT JOIN "AdApproval" aa ON c.id = aa."campaignId"
        WHERE c."organizationId" = org_id
        AND aa.id IS NULL
    LOOP
        -- Create 2-3 ad approvals per campaign for different shows
        FOR show_record IN 
            SELECT id, name FROM "Show" 
            WHERE "organizationId" = org_id 
            ORDER BY RANDOM() 
            LIMIT (2 + (RANDOM() * 1)::INTEGER)
        LOOP
            approval_id := gen_random_uuid();
            
            INSERT INTO "AdApproval" (
                id, title, "advertiserId", "advertiserName", "campaignId",
                "showId", "showName", type, duration, script,
                "talkingPoints", priority, deadline, status,
                "submittedBy", "organizationId", "workflowStage",
                "approvedAt", "createdAt", "updatedAt"
            ) VALUES (
                approval_id,
                campaign_record.advertiser_name || ' - ' || show_record.name || ' Sponsorship',
                campaign_record."advertiserId",
                campaign_record.advertiser_name,
                campaign_record.id,
                show_record.id,
                show_record.name,
                'host-read',
                30,
                'Welcome back to ' || show_record.name || '. Today''s episode is brought to you by ' || 
                campaign_record.advertiser_name || '. [Personal endorsement about product/service] ' ||
                'Visit their website and use promo code PODCAST for an exclusive discount.',
                ARRAY[
                    'Mention special offer for podcast listeners',
                    'Include personal testimonial if applicable',
                    'Clear call-to-action with promo code'
                ],
                CASE 
                    WHEN campaign_record.budget > 100000 THEN 'high'::"Priority"
                    ELSE 'medium'::"Priority"
                END,
                campaign_record."startDate",
                CASE 
                    WHEN campaign_record.status IN ('completed', 'active') THEN 'approved'::"ApprovalStatus"
                    ELSE 'pending'::"ApprovalStatus"
                END,
                admin_user_id,
                org_id,
                CASE 
                    WHEN campaign_record.status = 'completed' THEN 'completed'
                    WHEN campaign_record.status = 'active' THEN 'in_production'
                    ELSE 'pending_creation'
                END,
                CASE 
                    WHEN campaign_record.status IN ('completed', 'active') 
                    THEN campaign_record."startDate" - INTERVAL '3 days'
                    ELSE NULL
                END,
                campaign_record."startDate" - INTERVAL '7 days',
                campaign_record."startDate" - INTERVAL '5 days'
            );
            
            approval_counter := approval_counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % ad approvals', approval_counter;
END $$;

-- Phase 3: Create Campaign Analytics with correct schema
DO $$
DECLARE
    campaign_record RECORD;
    current_day DATE;
    daily_impressions INTEGER;
    daily_clicks INTEGER;
    daily_conversions INTEGER;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    analytics_counter INTEGER := 0;
BEGIN
    RAISE NOTICE 'Creating campaign analytics...';
    
    FOR campaign_record IN 
        SELECT c.* FROM "Campaign" c
        LEFT JOIN "CampaignAnalytics" ca ON c.id = ca."campaignId"
        WHERE c."organizationId" = org_id 
        AND c.status IN ('active', 'completed')
        AND ca.id IS NULL
        GROUP BY c.id
    LOOP
        current_day := campaign_record."startDate"::DATE;
        
        WHILE current_day <= LEAST(campaign_record."endDate"::DATE, CURRENT_DATE) LOOP
            daily_impressions := CASE 
                WHEN EXTRACT(DOW FROM current_day) IN (0, 6) THEN 
                    1500 + (RANDOM() * 2000)::INTEGER
                ELSE 
                    3000 + (RANDOM() * 4000)::INTEGER
            END;
            
            daily_clicks := (daily_impressions * (0.02 + RANDOM() * 0.02))::INTEGER;
            daily_conversions := (daily_clicks * (0.05 + RANDOM() * 0.05))::INTEGER;
            
            INSERT INTO "CampaignAnalytics" (
                id, "campaignId", "organizationId", date,
                impressions, clicks, conversions,
                spend, revenue,
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                campaign_record.id,
                org_id,
                current_day,
                daily_impressions,
                daily_clicks,
                daily_conversions,
                (campaign_record.budget / 30)::INTEGER,
                (daily_conversions * (50 + RANDOM() * 100))::INTEGER,
                current_day,
                current_day
            );
            
            analytics_counter := analytics_counter + 1;
            current_day := current_day + INTERVAL '1 day';
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % analytics records', analytics_counter;
END $$;

-- Phase 4: Create Contracts for campaigns
DO $$
DECLARE
    campaign_record RECORD;
    contract_id TEXT;
    contract_counter INTEGER := 1001;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    admin_user_id TEXT;
BEGIN
    RAISE NOTICE 'Creating contracts...';
    
    SELECT id INTO admin_user_id FROM "User" WHERE email = 'admin@podcastflow.pro' LIMIT 1;
    
    FOR campaign_record IN 
        SELECT c.*, a.name as advertiser_name
        FROM "Campaign" c
        JOIN "Advertiser" a ON c."advertiserId" = a.id
        LEFT JOIN "Contract" ct ON c.id = ct."campaignId"
        WHERE c."organizationId" = org_id
        AND ct.id IS NULL
    LOOP
        contract_id := gen_random_uuid();
        
        INSERT INTO "Contract" (
            id, "organizationId", "contractNumber", "campaignId", 
            "advertiserId", "agencyId", "contractType", title, 
            "startDate", "endDate", "totalValue", status,
            "signedDate", "signedBy", "approvedBy", "approvedDate",
            "createdAt", "updatedAt"
        ) VALUES (
            contract_id,
            org_id,
            'CTR-' || TO_CHAR(campaign_record."startDate", 'YYYY') || '-' || LPAD(contract_counter::TEXT, 4, '0'),
            campaign_record.id,
            campaign_record."advertiserId",
            campaign_record."agencyId",
            'standard',
            'Podcast Advertising Agreement - ' || campaign_record.advertiser_name,
            campaign_record."startDate",
            campaign_record."endDate",
            campaign_record.budget,
            CASE 
                WHEN campaign_record.status = 'completed' THEN 'completed'
                WHEN campaign_record.status = 'active' THEN 'active'
                ELSE 'draft'
            END,
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN campaign_record."startDate" - INTERVAL '5 days'
                ELSE NULL
            END,
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN campaign_record.advertiser_name
                ELSE NULL
            END,
            admin_user_id,
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN campaign_record."startDate" - INTERVAL '4 days'
                ELSE NULL
            END,
            campaign_record."startDate" - INTERVAL '7 days',
            campaign_record."startDate" - INTERVAL '5 days'
        );
        
        contract_counter := contract_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Created contracts';
END $$;

-- Phase 5: Create Reservations
DO $$
DECLARE
    campaign_record RECORD;
    reservation_id TEXT;
    reservation_counter INTEGER := 1;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    admin_user_id TEXT;
    sales_user_id TEXT;
BEGIN
    RAISE NOTICE 'Creating reservations...';
    
    SELECT id INTO admin_user_id FROM "User" WHERE email = 'admin@podcastflow.pro' LIMIT 1;
    SELECT id INTO sales_user_id FROM "User" WHERE role = 'sales' AND "organizationId" = org_id LIMIT 1;
    
    IF sales_user_id IS NULL THEN
        sales_user_id := admin_user_id;
    END IF;
    
    FOR campaign_record IN 
        SELECT c.* FROM "Campaign" c
        LEFT JOIN "Reservation" r ON c.id = r."campaignId"
        WHERE c."organizationId" = org_id
        AND r.id IS NULL
        LIMIT 30 -- Create reservations for first 30 campaigns
    LOOP
        reservation_id := gen_random_uuid();
        
        INSERT INTO "Reservation" (
            id, "reservationNumber", "organizationId", "campaignId", 
            "advertiserId", "agencyId", status, "holdDuration",
            "expiresAt", "confirmedAt", "totalAmount", "estimatedRevenue",
            "createdBy", "confirmedBy", notes, priority,
            "createdAt", "updatedAt"
        ) VALUES (
            reservation_id,
            'RES-' || TO_CHAR(campaign_record."startDate", 'YYYY') || '-' || LPAD(reservation_counter::TEXT, 5, '0'),
            org_id,
            campaign_record.id,
            campaign_record."advertiserId",
            campaign_record."agencyId",
            CASE 
                WHEN campaign_record.status = 'completed' THEN 'completed'::"ReservationStatus"
                WHEN campaign_record.status = 'active' THEN 'confirmed'::"ReservationStatus"
                ELSE 'held'::"ReservationStatus"
            END,
            48,
            campaign_record."endDate" + INTERVAL '7 days',
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN campaign_record."startDate" - INTERVAL '3 days'
                ELSE NULL
            END,
            campaign_record.budget * 0.5,
            campaign_record.budget * 0.5 * 1.15,
            sales_user_id,
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN admin_user_id
                ELSE NULL
            END,
            'Inventory reservation for campaign',
            CASE 
                WHEN campaign_record.budget > 100000 THEN 'high'::"ReservationPriority"
                WHEN campaign_record.budget > 50000 THEN 'medium'::"ReservationPriority"
                ELSE 'normal'::"ReservationPriority"
            END,
            campaign_record."startDate" - INTERVAL '6 days',
            campaign_record."startDate" - INTERVAL '5 days'
        );
        
        reservation_counter := reservation_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Created % reservations', reservation_counter - 1;
END $$;

-- Phase 6: Update campaign metrics
DO $$
DECLARE
    campaign_record RECORD;
    total_impressions INTEGER;
    total_clicks INTEGER;
    total_conversions INTEGER;
    total_spend NUMERIC;
BEGIN
    RAISE NOTICE 'Updating campaign metrics...';
    
    FOR campaign_record IN 
        SELECT c.id, 
               SUM(ca.impressions) as total_impressions,
               SUM(ca.clicks) as total_clicks,
               SUM(ca.conversions) as total_conversions,
               SUM(ca.spend) as total_spend
        FROM "Campaign" c
        JOIN "CampaignAnalytics" ca ON c.id = ca."campaignId"
        WHERE c."organizationId" = 'cmd2qfeve0000og5y8hfwu795'
        GROUP BY c.id
    LOOP
        UPDATE "Campaign"
        SET impressions = campaign_record.total_impressions,
            clicks = campaign_record.total_clicks,
            conversions = campaign_record.total_conversions,
            spent = campaign_record.total_spend
        WHERE id = campaign_record.id;
    END LOOP;
    
    RAISE NOTICE 'Updated campaign metrics';
END $$;

-- Final Summary
DO $$
DECLARE
    total_campaigns INTEGER;
    total_orders INTEGER;
    total_approvals INTEGER;
    total_analytics INTEGER;
    total_contracts INTEGER;
    total_reservations INTEGER;
    active_campaigns INTEGER;
    completed_campaigns INTEGER;
    pending_campaigns INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_campaigns FROM "Campaign" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO active_campaigns FROM "Campaign" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795' AND status = 'active';
    SELECT COUNT(*) INTO completed_campaigns FROM "Campaign" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795' AND status = 'completed';
    SELECT COUNT(*) INTO pending_campaigns FROM "Campaign" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795' AND status = 'pending';
    SELECT COUNT(*) INTO total_orders FROM "Order" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_approvals FROM "AdApproval" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_analytics FROM "CampaignAnalytics" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_contracts FROM "Contract" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_reservations FROM "Reservation" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '    CAMPAIGN ECOSYSTEM CREATION COMPLETE';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 CAMPAIGNS:';
    RAISE NOTICE '   ✓ Total Campaigns: %', total_campaigns;
    RAISE NOTICE '   ✓ Active: % | Completed: % | Pending: %', active_campaigns, completed_campaigns, pending_campaigns;
    RAISE NOTICE '';
    RAISE NOTICE '📋 OPERATIONAL DATA:';
    RAISE NOTICE '   ✓ Orders: %', total_orders;
    RAISE NOTICE '   ✓ Contracts: %', total_contracts;
    RAISE NOTICE '   ✓ Reservations: %', total_reservations;
    RAISE NOTICE '   ✓ Ad Approvals: %', total_approvals;
    RAISE NOTICE '';
    RAISE NOTICE '📈 ANALYTICS:';
    RAISE NOTICE '   ✓ Daily Analytics Records: %', total_analytics;
    RAISE NOTICE '';
    RAISE NOTICE '✅ The PodcastFlow Pro system now has:';
    RAISE NOTICE '   • 18 months of campaign history';
    RAISE NOTICE '   • Complete order management records';
    RAISE NOTICE '   • Ad approval workflows';
    RAISE NOTICE '   • Daily performance analytics';
    RAISE NOTICE '   • Contracts and reservations';
    RAISE NOTICE '';
    RAISE NOTICE '   Ready for demonstration and use!';
    RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;