-- Simple Campaign Creation Script matching actual schema
-- Creates campaigns and basic associated data

-- Phase 1: Create Campaigns with proper schema
DO $$
DECLARE
    advertiser_record RECORD;
    campaign_id TEXT;
    campaign_start DATE;
    campaign_end DATE;
    campaign_budget NUMERIC;
    campaign_status TEXT;
    campaign_counter INTEGER := 1;
    current_date DATE := CURRENT_DATE;
    start_date DATE := CURRENT_DATE - INTERVAL '18 months';
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    admin_user_id TEXT;
BEGIN
    RAISE NOTICE 'Creating campaigns...';
    
    SELECT id INTO admin_user_id FROM "User" WHERE email = 'admin@podcastflow.pro' LIMIT 1;
    
    FOR advertiser_record IN 
        SELECT * FROM "Advertiser" WHERE name LIKE 'Seed:%'
    LOOP
        -- Create 3-4 campaigns per advertiser
        FOR i IN 1..(3 + (RANDOM() * 1)::INTEGER) LOOP
            campaign_start := start_date + ((RANDOM() * 500)::INTEGER * INTERVAL '1 day');
            campaign_end := campaign_start + ((30 + RANDOM() * 60)::INTEGER * INTERVAL '1 day');
            
            -- Determine status
            IF campaign_end < current_date - INTERVAL '30 days' THEN
                campaign_status := 'completed';
            ELSIF campaign_start > current_date THEN
                campaign_status := 'pending';
            ELSE
                campaign_status := 'active';
            END IF;
            
            campaign_budget := 20000 + RANDOM() * 180000;
            campaign_id := gen_random_uuid();
            
            INSERT INTO "Campaign" (
                id, "organizationId", name, "advertiserId", "agencyId",
                "startDate", "endDate", budget, "targetAudience", status,
                "createdBy", "paymentStatus", "paidAt",
                "createdAt", "updatedAt"
            ) VALUES (
                campaign_id,
                org_id,
                'Campaign ' || campaign_counter || ' - ' || advertiser_record.name,
                advertiser_record.id,
                advertiser_record."agencyId",
                campaign_start,
                campaign_end,
                campaign_budget,
                'Podcast listeners interested in ' || advertiser_record.industry,
                campaign_status::"CampaignStatus",
                admin_user_id,
                CASE 
                    WHEN campaign_status = 'completed' THEN 'paid'
                    WHEN campaign_status = 'active' THEN 'pending'
                    ELSE 'not_paid'
                END,
                CASE 
                    WHEN campaign_status = 'completed' THEN campaign_end + INTERVAL '30 days'
                    ELSE NULL
                END,
                campaign_start - INTERVAL '7 days',
                campaign_start
            );
            
            campaign_counter := campaign_counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % campaigns', campaign_counter - 1;
END $$;

-- Phase 2: Create Orders
DO $$
DECLARE
    campaign_record RECORD;
    order_id TEXT;
    order_counter INTEGER := 1;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating orders...';
    
    FOR campaign_record IN 
        SELECT * FROM "Campaign" WHERE "organizationId" = org_id
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
                WHEN campaign_record.status = 'completed' THEN 'fulfilled'
                WHEN campaign_record.status = 'active' THEN 'processing'
                ELSE 'pending'
            END,
            campaign_record."startDate" - INTERVAL '5 days',
            campaign_record."startDate"
        );
        
        order_counter := order_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Created % orders', order_counter - 1;
END $$;

-- Phase 3: Create Ad Approvals
DO $$
DECLARE
    campaign_record RECORD;
    approval_id TEXT;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating ad approvals...';
    
    FOR campaign_record IN 
        SELECT c.*, a.name as advertiser_name 
        FROM "Campaign" c
        JOIN "Advertiser" a ON c."advertiserId" = a.id
        WHERE c."organizationId" = org_id
    LOOP
        approval_id := gen_random_uuid();
        
        INSERT INTO "AdApproval" (
            id, "organizationId", "campaignId", "advertiserId",
            title, content, status, "submittedAt", "reviewedAt", "reviewedBy",
            notes, version, "isActive",
            "createdAt", "updatedAt"
        ) VALUES (
            approval_id,
            org_id,
            campaign_record.id,
            campaign_record."advertiserId",
            campaign_record.advertiser_name || ' - Ad Creative',
            'Visit ' || campaign_record.advertiser_name || ' today and save 20% with code PODCAST',
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') THEN 'approved'
                ELSE 'pending'
            END,
            campaign_record."startDate" - INTERVAL '7 days',
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN campaign_record."startDate" - INTERVAL '5 days'
                ELSE NULL
            END,
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN 'producer@podcastflow.pro'
                ELSE NULL
            END,
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN 'Approved for all shows'
                ELSE NULL
            END,
            1,
            true,
            campaign_record."startDate" - INTERVAL '7 days',
            campaign_record."startDate" - INTERVAL '5 days'
        );
    END LOOP;
    
    RAISE NOTICE 'Created ad approvals';
END $$;

-- Phase 4: Create Campaign Analytics for completed/active campaigns
DO $$
DECLARE
    campaign_record RECORD;
    current_day DATE;
    daily_impressions INTEGER;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating campaign analytics...';
    
    FOR campaign_record IN 
        SELECT * FROM "Campaign"
        WHERE "organizationId" = org_id 
        AND status IN ('active', 'completed')
    LOOP
        current_day := campaign_record."startDate"::DATE;
        
        WHILE current_day <= LEAST(campaign_record."endDate"::DATE, CURRENT_DATE) LOOP
            daily_impressions := 2000 + (RANDOM() * 5000)::INTEGER;
            
            INSERT INTO "CampaignAnalytics" (
                id, "campaignId", "organizationId", date,
                impressions, clicks, conversions,
                "clickThroughRate", "conversionRate",
                spend, revenue,
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                campaign_record.id,
                org_id,
                current_day,
                daily_impressions,
                (daily_impressions * 0.03)::INTEGER,
                (daily_impressions * 0.001)::INTEGER,
                0.03,
                0.033,
                (campaign_record.budget / 30)::INTEGER,
                (daily_impressions * 0.001 * 100)::INTEGER,
                current_day,
                current_day
            );
            
            current_day := current_day + INTERVAL '1 day';
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created campaign analytics';
END $$;

-- Phase 5: Create Invoices for completed campaigns
DO $$
DECLARE
    campaign_record RECORD;
    order_record RECORD;
    invoice_id TEXT;
    invoice_counter INTEGER := 1001;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating invoices...';
    
    FOR campaign_record IN 
        SELECT * FROM "Campaign" 
        WHERE "organizationId" = org_id AND status = 'completed'
    LOOP
        -- Get the order for this campaign
        SELECT * INTO order_record FROM "Order" WHERE "campaignId" = campaign_record.id LIMIT 1;
        
        IF order_record.id IS NOT NULL THEN
            invoice_id := gen_random_uuid();
            
            INSERT INTO "Invoice" (
                id, "organizationId", "orderId", "advertiserId", "agencyId",
                "invoiceNumber", "invoiceDate", "dueDate", "subtotal", "tax", "total",
                status, "paidAt", "paymentMethod",
                "createdAt", "updatedAt"
            ) VALUES (
                invoice_id,
                org_id,
                order_record.id,
                campaign_record."advertiserId",
                campaign_record."agencyId",
                'INV-' || TO_CHAR(campaign_record."endDate", 'YYYY') || '-' || LPAD(invoice_counter::TEXT, 4, '0'),
                campaign_record."endDate"::DATE + INTERVAL '3 days',
                campaign_record."endDate"::DATE + INTERVAL '33 days',
                campaign_record.budget,
                (campaign_record.budget * 0.08)::INTEGER,
                (campaign_record.budget * 1.08)::INTEGER,
                'paid',
                campaign_record."paidAt",
                'wire_transfer',
                campaign_record."endDate" + INTERVAL '3 days',
                campaign_record."endDate" + INTERVAL '3 days'
            );
            
            invoice_counter := invoice_counter + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Created invoices';
END $$;

-- Summary
DO $$
DECLARE
    total_campaigns INTEGER;
    total_orders INTEGER;
    total_approvals INTEGER;
    total_analytics INTEGER;
    total_invoices INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_campaigns FROM "Campaign" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_orders FROM "Order" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_approvals FROM "AdApproval" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_analytics FROM "CampaignAnalytics" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_invoices FROM "Invoice" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '   CAMPAIGN ECOSYSTEM CREATED';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '✓ Campaigns: %', total_campaigns;
    RAISE NOTICE '✓ Orders: %', total_orders;
    RAISE NOTICE '✓ Ad Approvals: %', total_approvals;
    RAISE NOTICE '✓ Analytics Records: %', total_analytics;
    RAISE NOTICE '✓ Invoices: %', total_invoices;
    RAISE NOTICE '════════════════════════════════════════';
END $$;