-- Corrected Campaign Ecosystem Creation Script
-- Creates campaigns, contracts, orders, reservations, invoices, and ad approvals

-- First check who will be creating reservations
DO $$
DECLARE
    admin_user_id TEXT;
    sales_user_id TEXT;
    producer_user_id TEXT;
BEGIN
    SELECT id INTO admin_user_id FROM "User" WHERE email = 'admin@podcastflow.pro' LIMIT 1;
    SELECT id INTO sales_user_id FROM "User" WHERE role = 'sales' AND "organizationId" = 'cmd2qfeve0000og5y8hfwu795' LIMIT 1;
    SELECT id INTO producer_user_id FROM "User" WHERE role = 'producer' AND "organizationId" = 'cmd2qfeve0000og5y8hfwu795' LIMIT 1;
    
    RAISE NOTICE 'User IDs - Admin: %, Sales: %, Producer: %', admin_user_id, sales_user_id, producer_user_id;
END $$;

-- Phase 1: Create Campaigns
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
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795'; -- PodcastFlow Pro
    days_duration INTEGER;
BEGIN
    RAISE NOTICE 'Creating comprehensive campaign history spanning 18 months...';
    
    -- Create campaigns distributed across 18 months
    FOR advertiser_record IN 
        SELECT a.*, ag.id as agency_id, ag.name as agency_name 
        FROM "Advertiser" a
        LEFT JOIN "Agency" ag ON a."agencyId" = ag.id
        WHERE a.name LIKE 'Seed:%'
        ORDER BY a.id
    LOOP
        -- Create 3-5 campaigns per advertiser over 18 months
        FOR i IN 1..(3 + (RANDOM() * 2)::INTEGER) LOOP
            -- Distribute campaigns across the 18-month period
            campaign_start := start_date + ((RANDOM() * 500)::INTEGER) * INTERVAL '1 day';
            
            -- Campaign duration: 2 weeks to 3 months
            days_duration := 14 + (RANDOM() * 76)::INTEGER;
            campaign_end := campaign_start + days_duration * INTERVAL '1 day';
            
            -- Determine campaign status based on dates
            IF campaign_end < current_date - INTERVAL '30 days' THEN
                campaign_status := 'completed';
            ELSIF campaign_start > current_date THEN
                campaign_status := 'pending';
            ELSE
                campaign_status := 'active';
            END IF;
            
            -- Budget based on advertiser size and campaign duration
            campaign_budget := (20000 + RANDOM() * 180000) * (days_duration::NUMERIC / 30);
            
            campaign_id := gen_random_uuid();
            
            -- Create the campaign
            INSERT INTO "Campaign" (
                id, "organizationId", name, description, "advertiserId", "agencyId",
                "startDate", "endDate", budget, "targetAudience", status,
                "createdAt", "updatedAt", "isActive"
            ) VALUES (
                campaign_id,
                org_id,
                advertiser_record.name || ' - ' || 
                CASE (RANDOM() * 6)::INTEGER
                    WHEN 0 THEN 'Brand Awareness Q' || EXTRACT(QUARTER FROM campaign_start) || ' ' || EXTRACT(YEAR FROM campaign_start)
                    WHEN 1 THEN 'Product Launch Campaign'
                    WHEN 2 THEN 'Holiday Promotion ' || EXTRACT(YEAR FROM campaign_start)
                    WHEN 3 THEN 'Summer Series ' || EXTRACT(YEAR FROM campaign_start)
                    WHEN 4 THEN 'Year-End Push ' || EXTRACT(YEAR FROM campaign_start)
                    ELSE 'Engagement Drive ' || TO_CHAR(campaign_start, 'Mon YYYY')
                END,
                'Strategic podcast advertising campaign targeting key demographics with focus on ' ||
                CASE advertiser_record.industry
                    WHEN 'Technology' THEN 'tech-savvy early adopters and innovation enthusiasts'
                    WHEN 'Healthcare' THEN 'health-conscious individuals and wellness advocates'
                    WHEN 'Financial Services' THEN 'investors and financial planning audience'
                    WHEN 'Food & Beverage' THEN 'food enthusiasts and culinary explorers'
                    WHEN 'E-commerce' THEN 'online shoppers and deal seekers'
                    WHEN 'Education' THEN 'lifelong learners and professional development seekers'
                    ELSE 'engaged podcast listeners in the ' || advertiser_record.industry || ' sector'
                END,
                advertiser_record.id,
                advertiser_record.agency_id,
                campaign_start,
                campaign_end,
                campaign_budget::INTEGER,
                ('{
                    "demographics": {
                        "age_range": "25-54",
                        "gender": "all",
                        "income": "50k+"
                    },
                    "interests": ["' || advertiser_record.industry || '"],
                    "geo": ["US", "CA"],
                    "behavior": "regular_podcast_listeners"
                }')::JSONB,
                campaign_status,
                campaign_start - INTERVAL '7 days',
                campaign_start,
                campaign_status != 'completed'
            );
            
            campaign_counter := campaign_counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % campaigns', campaign_counter - 1;
END $$;

-- Phase 2: Create Contracts (instead of Insertion Orders)
DO $$
DECLARE
    campaign_record RECORD;
    contract_id TEXT;
    contract_counter INTEGER := 1001;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    admin_user_id TEXT;
BEGIN
    RAISE NOTICE 'Creating contracts for campaigns...';
    
    SELECT id INTO admin_user_id FROM "User" WHERE email = 'admin@podcastflow.pro' LIMIT 1;
    
    FOR campaign_record IN 
        SELECT c.*, a.name as advertiser_name
        FROM "Campaign" c
        JOIN "Advertiser" a ON c."advertiserId" = a.id
        WHERE c."organizationId" = org_id
        ORDER BY c."startDate"
    LOOP
        contract_id := gen_random_uuid();
        
        INSERT INTO "Contract" (
            id, "organizationId", "contractNumber", "campaignId", "advertiserId", "agencyId",
            "contractType", title, description, "startDate", "endDate", "totalValue",
            status, "signedDate", "signedBy", "approvedBy", "approvedDate",
            terms, "paymentTerms", "cancellationPolicy", "deliverables",
            "createdAt", "updatedAt"
        ) VALUES (
            contract_id,
            org_id,
            'CTR-' || EXTRACT(YEAR FROM campaign_record."startDate") || '-' || LPAD(contract_counter::TEXT, 4, '0'),
            campaign_record.id,
            campaign_record."advertiserId",
            campaign_record."agencyId",
            'sponsorship',
            'Podcast Sponsorship Agreement - ' || campaign_record.advertiser_name,
            'Comprehensive podcast advertising agreement for campaign: ' || campaign_record.name,
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
                THEN campaign_record.advertiser_name || ' Representative'
                ELSE NULL
            END,
            admin_user_id,
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN campaign_record."startDate" - INTERVAL '4 days'
                ELSE NULL
            END,
            'Standard podcast advertising terms apply. All placements subject to approval.',
            'NET 30 - Payment due within 30 days of invoice date',
            '14-day notice required for cancellation. Pro-rated refunds available.',
            'Host-read sponsorships, produced ads as specified in campaign brief',
            campaign_record."startDate" - INTERVAL '7 days',
            campaign_record."startDate" - INTERVAL '5 days'
        );
        
        contract_counter := contract_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Created contracts for all campaigns';
END $$;

-- Phase 3: Create Orders
DO $$
DECLARE
    campaign_record RECORD;
    order_id TEXT;
    order_counter INTEGER := 1;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating orders for campaigns...';
    
    FOR campaign_record IN 
        SELECT * FROM "Campaign" 
        WHERE "organizationId" = org_id
        ORDER BY "startDate"
    LOOP
        order_id := gen_random_uuid();
        
        INSERT INTO "Order" (
            id, "organizationId", "campaignId", "advertiserId", "agencyId",
            "orderNumber", "totalAmount", status, "paymentStatus",
            "createdAt", "updatedAt", "submittedAt", "approvedAt"
        ) VALUES (
            order_id,
            org_id,
            campaign_record.id,
            campaign_record."advertiserId",
            campaign_record."agencyId",
            'ORD-' || EXTRACT(YEAR FROM campaign_record."startDate") || '-' || LPAD(order_counter::TEXT, 5, '0'),
            campaign_record.budget,
            CASE 
                WHEN campaign_record.status = 'completed' THEN 'fulfilled'
                WHEN campaign_record.status = 'active' THEN 'processing'
                ELSE 'pending'
            END,
            CASE 
                WHEN campaign_record.status = 'completed' THEN 'paid'
                WHEN campaign_record.status = 'active' THEN 'pending'
                ELSE 'not_paid'
            END,
            campaign_record."startDate" - INTERVAL '5 days',
            campaign_record."startDate" - INTERVAL '3 days',
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN campaign_record."startDate" - INTERVAL '4 days'
                ELSE NULL
            END,
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') 
                THEN campaign_record."startDate" - INTERVAL '3 days'
                ELSE NULL
            END
        );
        
        order_counter := order_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Created orders for all campaigns';
END $$;

-- Phase 4: Create Reservations with proper structure
DO $$
DECLARE
    campaign_record RECORD;
    reservation_id TEXT;
    reservation_counter INTEGER := 1;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    admin_user_id TEXT;
    sales_user_id TEXT;
    slots_to_reserve INTEGER;
BEGIN
    RAISE NOTICE 'Creating inventory reservations...';
    
    SELECT id INTO admin_user_id FROM "User" WHERE email = 'admin@podcastflow.pro' LIMIT 1;
    SELECT id INTO sales_user_id FROM "User" WHERE role = 'sales' AND "organizationId" = org_id LIMIT 1;
    
    -- Use admin if no sales user found
    IF sales_user_id IS NULL THEN
        sales_user_id := admin_user_id;
    END IF;
    
    FOR campaign_record IN 
        SELECT c.*, a.name as advertiser_name
        FROM "Campaign" c
        JOIN "Advertiser" a ON c."advertiserId" = a.id
        WHERE c."organizationId" = org_id
        ORDER BY c."startDate"
    LOOP
        -- Create 1-3 reservations per campaign
        FOR i IN 1..(1 + (RANDOM() * 2)::INTEGER) LOOP
            reservation_id := gen_random_uuid();
            slots_to_reserve := 10 + (RANDOM() * 40)::INTEGER;
            
            INSERT INTO "Reservation" (
                id, "reservationNumber", "organizationId", "campaignId", 
                "advertiserId", "agencyId", status, "holdDuration",
                "expiresAt", "confirmedAt", "totalAmount", "estimatedRevenue",
                "createdBy", "confirmedBy", notes, priority,
                "createdAt", "updatedAt"
            ) VALUES (
                reservation_id,
                'RES-' || EXTRACT(YEAR FROM campaign_record."startDate") || '-' || LPAD(reservation_counter::TEXT, 5, '0'),
                org_id,
                campaign_record.id,
                campaign_record."advertiserId",
                campaign_record."agencyId",
                CASE 
                    WHEN campaign_record.status = 'completed' THEN 'completed'
                    WHEN campaign_record.status = 'active' THEN 'confirmed'
                    ELSE 'held'
                END,
                48, -- 48 hour hold
                campaign_record."endDate" + INTERVAL '7 days',
                CASE 
                    WHEN campaign_record.status IN ('completed', 'active') 
                    THEN campaign_record."startDate" - INTERVAL '3 days'
                    ELSE NULL
                END,
                (campaign_record.budget * 0.33)::NUMERIC, -- About 1/3 of budget per reservation
                (campaign_record.budget * 0.33 * 1.15)::NUMERIC, -- 15% markup
                sales_user_id,
                CASE 
                    WHEN campaign_record.status IN ('completed', 'active') 
                    THEN admin_user_id
                    ELSE NULL
                END,
                'Reservation for ' || slots_to_reserve || ' ad slots across multiple shows for ' || 
                campaign_record.advertiser_name || ' campaign',
                CASE 
                    WHEN campaign_record.budget > 100000 THEN 'high'
                    WHEN campaign_record.budget > 50000 THEN 'medium'
                    ELSE 'normal'
                END,
                campaign_record."startDate" - INTERVAL '6 days',
                campaign_record."startDate" - INTERVAL '5 days'
            );
            
            reservation_counter := reservation_counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % reservations', reservation_counter - 1;
END $$;

-- Phase 5: Create Ad Approvals
DO $$
DECLARE
    campaign_record RECORD;
    approval_id TEXT;
    creative_versions INTEGER;
    version_num INTEGER;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating ad approvals and creative assets...';
    
    FOR campaign_record IN 
        SELECT c.*, a.name as advertiser_name 
        FROM "Campaign" c
        JOIN "Advertiser" a ON c."advertiserId" = a.id
        WHERE c."organizationId" = org_id
    LOOP
        -- Create 1-3 creative versions per campaign
        creative_versions := 1 + (RANDOM() * 2)::INTEGER;
        
        FOR version_num IN 1..creative_versions LOOP
            approval_id := gen_random_uuid();
            
            INSERT INTO "AdApproval" (
                id, "organizationId", "campaignId", "advertiserId",
                "adTitle", "adContent", "scriptContent", "audioFileUrl",
                status, "submittedAt", "reviewedAt", "reviewedBy",
                "reviewNotes", version, "isActive",
                "createdAt", "updatedAt"
            ) VALUES (
                approval_id,
                org_id,
                campaign_record.id,
                campaign_record."advertiserId",
                campaign_record.advertiser_name || ' - Creative v' || version_num,
                'Experience the future with ' || campaign_record.advertiser_name || '. ' ||
                CASE (RANDOM() * 4)::INTEGER
                    WHEN 0 THEN 'Transform your daily routine with our innovative solutions.'
                    WHEN 1 THEN 'Join thousands who have already made the switch.'
                    WHEN 2 THEN 'Limited time offer - visit our website today!'
                    WHEN 3 THEN 'Discover why we''re the industry leader.'
                    ELSE 'Your journey to excellence starts here.'
                END,
                'HOST READ: Welcome back to the show. Today''s episode is brought to you by ' || 
                campaign_record.advertiser_name || '. [PAUSE] ' ||
                'You know, I''ve been using their products for months now, and I have to say... [PERSONAL ANECDOTE] ' ||
                'If you''re looking for [BENEFIT], you need to check them out. ' ||
                'Visit [WEBSITE] and use promo code PODCAST for 20% off your first order. ' ||
                'That''s [WEBSITE], promo code PODCAST.',
                '/audio/campaigns/' || campaign_record.id || '/creative_v' || version_num || '.mp3',
                CASE 
                    WHEN campaign_record.status = 'completed' THEN 
                        CASE 
                            WHEN version_num = 1 THEN 'approved'
                            ELSE 'rejected'
                        END
                    WHEN campaign_record.status = 'active' THEN 
                        CASE 
                            WHEN version_num = 1 THEN 'approved'
                            ELSE 'pending'
                        END
                    ELSE 'pending'
                END,
                campaign_record."startDate" - ((7 - version_num) * INTERVAL '1 day'),
                CASE 
                    WHEN campaign_record.status IN ('completed', 'active') AND version_num = 1 
                        THEN campaign_record."startDate" - INTERVAL '4 days'
                    WHEN campaign_record.status = 'completed' AND version_num > 1
                        THEN campaign_record."startDate" - INTERVAL '5 days'
                    ELSE NULL
                END,
                CASE 
                    WHEN campaign_record.status IN ('completed', 'active') AND version_num = 1 
                        THEN 'producer@podcastflow.pro'
                    WHEN campaign_record.status = 'completed' AND version_num > 1
                        THEN 'producer@podcastflow.pro'
                    ELSE NULL
                END,
                CASE 
                    WHEN version_num = 1 AND campaign_record.status IN ('completed', 'active') 
                        THEN 'Approved for all shows. Great energy and clear CTA.'
                    WHEN version_num > 1 AND campaign_record.status = 'completed'
                        THEN 'Audio quality issues. Please resubmit with cleaner recording.'
                    ELSE NULL
                END,
                version_num,
                version_num = 1,
                campaign_record."startDate" - ((7 - version_num) * INTERVAL '1 day'),
                campaign_record."startDate" - ((7 - version_num) * INTERVAL '1 day')
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created ad approvals for all campaigns';
END $$;

-- Phase 6: Create Invoices and Payments for Completed Campaigns
DO $$
DECLARE
    campaign_record RECORD;
    invoice_id TEXT;
    invoice_number INTEGER := 1001;
    payment_id TEXT;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
    payment_days INTEGER;
BEGIN
    RAISE NOTICE 'Creating invoices for completed campaigns...';
    
    FOR campaign_record IN 
        SELECT c.*, a.name as advertiser_name
        FROM "Campaign" c
        JOIN "Advertiser" a ON c."advertiserId" = a.id
        WHERE c."organizationId" = org_id AND c.status = 'completed'
        ORDER BY c."endDate"
    LOOP
        invoice_id := gen_random_uuid();
        payment_days := 15 + (RANDOM() * 20)::INTEGER;
        
        -- Create invoice
        INSERT INTO "Invoice" (
            id, "organizationId", "campaignId", "orderId", "advertiserId", "agencyId",
            "invoiceNumber", "invoiceDate", "dueDate", "subtotal", "tax", "total",
            status, "paidAt", "paymentMethod", "notes",
            "createdAt", "updatedAt", "sentAt"
        ) VALUES (
            invoice_id,
            org_id,
            campaign_record.id,
            (SELECT id FROM "Order" WHERE "campaignId" = campaign_record.id LIMIT 1),
            campaign_record."advertiserId",
            campaign_record."agencyId",
            'INV-' || EXTRACT(YEAR FROM campaign_record."endDate") || '-' || LPAD(invoice_number::TEXT, 4, '0'),
            campaign_record."endDate" + INTERVAL '3 days',
            campaign_record."endDate" + INTERVAL '33 days',
            campaign_record.budget,
            (campaign_record.budget * 0.08)::INTEGER,
            (campaign_record.budget * 1.08)::INTEGER,
            'paid',
            campaign_record."endDate" + (payment_days * INTERVAL '1 day'),
            CASE (RANDOM() * 3)::INTEGER
                WHEN 0 THEN 'wire_transfer'
                WHEN 1 THEN 'check'
                WHEN 2 THEN 'ach'
                ELSE 'credit_card'
            END,
            'Campaign: ' || campaign_record.advertiser_name || ' - Successfully completed',
            campaign_record."endDate" + INTERVAL '3 days',
            campaign_record."endDate" + INTERVAL '3 days',
            campaign_record."endDate" + INTERVAL '4 days'
        );
        
        -- Create payment record
        payment_id := gen_random_uuid();
        INSERT INTO "Payment" (
            id, "organizationId", "invoiceId", "campaignId", "advertiserId",
            amount, "paymentDate", "paymentMethod", "transactionId",
            status, "notes", "createdAt", "updatedAt"
        ) VALUES (
            payment_id,
            org_id,
            invoice_id,
            campaign_record.id,
            campaign_record."advertiserId",
            (campaign_record.budget * 1.08)::INTEGER,
            campaign_record."endDate" + (payment_days * INTERVAL '1 day'),
            CASE (RANDOM() * 3)::INTEGER
                WHEN 0 THEN 'wire_transfer'
                WHEN 1 THEN 'check'
                WHEN 2 THEN 'ach'
                ELSE 'credit_card'
            END,
            'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((RANDOM() * 999999)::INTEGER::TEXT, 6, '0'),
            'completed',
            'Payment received',
            campaign_record."endDate" + (payment_days * INTERVAL '1 day'),
            campaign_record."endDate" + (payment_days * INTERVAL '1 day')
        );
        
        invoice_number := invoice_number + 1;
    END LOOP;
    
    RAISE NOTICE 'Created invoices and payments for completed campaigns';
END $$;

-- Phase 7: Create Campaign Analytics
DO $$
DECLARE
    campaign_record RECORD;
    current_day DATE;
    daily_impressions INTEGER;
    daily_clicks INTEGER;
    daily_conversions INTEGER;
    daily_spend NUMERIC;
    days_in_campaign INTEGER;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating campaign analytics for active and completed campaigns...';
    
    FOR campaign_record IN 
        SELECT * FROM "Campaign"
        WHERE "organizationId" = org_id 
        AND status IN ('active', 'completed')
    LOOP
        days_in_campaign := (campaign_record."endDate" - campaign_record."startDate")::INTEGER;
        current_day := campaign_record."startDate";
        
        WHILE current_day <= LEAST(campaign_record."endDate", CURRENT_DATE) LOOP
            -- Calculate realistic daily metrics
            daily_impressions := CASE 
                WHEN EXTRACT(DOW FROM current_day) IN (0, 6) THEN
                    (1500 + RANDOM() * 2500)::INTEGER
                ELSE
                    (3000 + RANDOM() * 5000)::INTEGER
            END;
            
            daily_clicks := (daily_impressions * (0.02 + RANDOM() * 0.03))::INTEGER;
            daily_conversions := (daily_clicks * (0.05 + RANDOM() * 0.10))::INTEGER;
            daily_spend := campaign_record.budget / NULLIF(days_in_campaign, 0) * (0.8 + RANDOM() * 0.4);
            
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
                daily_clicks,
                daily_conversions,
                daily_clicks::NUMERIC / NULLIF(daily_impressions, 0),
                daily_conversions::NUMERIC / NULLIF(daily_clicks, 0),
                daily_spend::INTEGER,
                (daily_conversions * (50 + RANDOM() * 150))::INTEGER,
                current_day + INTERVAL '1 day',
                current_day + INTERVAL '1 day'
            );
            
            current_day := current_day + INTERVAL '1 day';
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created daily analytics for all active and completed campaigns';
END $$;

-- Final Summary
DO $$
DECLARE
    total_campaigns INTEGER;
    total_contracts INTEGER;
    total_orders INTEGER;
    total_reservations INTEGER;
    total_invoices INTEGER;
    total_payments INTEGER;
    total_approvals INTEGER;
    total_analytics INTEGER;
    campaign_revenue NUMERIC;
BEGIN
    SELECT COUNT(*) INTO total_campaigns FROM "Campaign" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_contracts FROM "Contract" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_orders FROM "Order" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_reservations FROM "Reservation" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_invoices FROM "Invoice" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_payments FROM "Payment" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_approvals FROM "AdApproval" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_analytics FROM "CampaignAnalytics" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT SUM(budget) INTO campaign_revenue FROM "Campaign" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795' AND status = 'completed';
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '     COMPREHENSIVE CAMPAIGN ECOSYSTEM CREATED';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 CAMPAIGNS & ORDERS:';
    RAISE NOTICE '   ✓ Campaigns: % (spanning 18 months)', total_campaigns;
    RAISE NOTICE '   ✓ Contracts: % (all campaigns have contracts)', total_contracts;
    RAISE NOTICE '   ✓ Orders: % (with proper tracking)', total_orders;
    RAISE NOTICE '   ✓ Reservations: % (inventory reserved)', total_reservations;
    RAISE NOTICE '';
    RAISE NOTICE '💰 FINANCIAL RECORDS:';
    RAISE NOTICE '   ✓ Invoices: % (for completed campaigns)', total_invoices;
    RAISE NOTICE '   ✓ Payments: % (all invoices paid)', total_payments;
    RAISE NOTICE '   ✓ Total Revenue: $%', COALESCE(campaign_revenue, 0)::MONEY;
    RAISE NOTICE '';
    RAISE NOTICE '🎨 CREATIVE & APPROVALS:';
    RAISE NOTICE '   ✓ Ad Approvals: % (multiple versions per campaign)', total_approvals;
    RAISE NOTICE '   ✓ Status: Approved (past), Pending (future)';
    RAISE NOTICE '';
    RAISE NOTICE '📈 ANALYTICS & PERFORMANCE:';
    RAISE NOTICE '   ✓ Daily Analytics: % records', total_analytics;
    RAISE NOTICE '   ✓ Metrics: Impressions, Clicks, Conversions, Revenue';
    RAISE NOTICE '';
    RAISE NOTICE '✅ The system now appears to have been actively used';
    RAISE NOTICE '   for podcast advertising over the last 18 months!';
    RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;