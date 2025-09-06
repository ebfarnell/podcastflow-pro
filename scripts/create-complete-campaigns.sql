-- Complete Campaign Ecosystem Creation Script
-- Creates campaigns, IOs, orders, reservations, invoices, and ad approvals
-- Spanning 18 months of realistic podcast advertising activity

-- Phase 1: Create Campaigns
DO $$
DECLARE
    advertiser_record RECORD;
    agency_record RECORD;
    campaign_id TEXT;
    campaign_start DATE;
    campaign_end DATE;
    campaign_budget NUMERIC;
    campaign_status TEXT;
    campaign_counter INTEGER := 1;
    io_id TEXT;
    order_id TEXT;
    invoice_id TEXT;
    current_date DATE := CURRENT_DATE;
    start_date DATE := CURRENT_DATE - INTERVAL '18 months';
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795'; -- PodcastFlow Pro
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
            campaign_start := start_date + ((RANDOM() * 500)::INTEGER * INTERVAL '1 day');
            
            -- Campaign duration: 2 weeks to 3 months
            campaign_end := campaign_start + ((14 + RANDOM() * 76)::INTEGER * INTERVAL '1 day');
            
            -- Determine campaign status based on dates
            IF campaign_end < current_date - INTERVAL '30 days' THEN
                campaign_status := 'completed';
            ELSIF campaign_start > current_date THEN
                campaign_status := 'pending';
            ELSE
                campaign_status := 'active';
            END IF;
            
            -- Budget based on advertiser size and campaign duration
            campaign_budget := (20000 + RANDOM() * 180000) * 
                              (EXTRACT(EPOCH FROM (campaign_end - campaign_start))/86400/30);
            
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
                campaign_start - INTERVAL '7 days', -- Created a week before start
                campaign_start,
                campaign_status != 'completed'
            );
            
            -- Create Insertion Order for the campaign
            io_id := gen_random_uuid();
            INSERT INTO "InsertionOrder" (
                id, "organizationId", "campaignId", "advertiserId", "agencyId",
                "ioNumber", "startDate", "endDate", "totalBudget", "terms",
                status, "createdAt", "updatedAt", "approvedAt", "approvedBy"
            ) VALUES (
                io_id,
                org_id,
                campaign_id,
                advertiser_record.id,
                advertiser_record.agency_id,
                'IO-' || EXTRACT(YEAR FROM campaign_start) || '-' || LPAD(campaign_counter::TEXT, 4, '0'),
                campaign_start,
                campaign_end,
                campaign_budget::INTEGER,
                'Standard terms and conditions apply. Payment due NET 30. ' ||
                'Includes podcast sponsorships across multiple shows with ' ||
                'pre-roll, mid-roll, and post-roll placements as specified.',
                CASE 
                    WHEN campaign_status = 'completed' THEN 'executed'
                    WHEN campaign_status = 'active' THEN 'approved'
                    ELSE 'pending'
                END,
                campaign_start - INTERVAL '7 days',
                campaign_start - INTERVAL '5 days',
                CASE 
                    WHEN campaign_status IN ('completed', 'active') THEN campaign_start - INTERVAL '5 days'
                    ELSE NULL
                END,
                CASE 
                    WHEN campaign_status IN ('completed', 'active') THEN 'admin@podcastflow.pro'
                    ELSE NULL
                END
            );
            
            campaign_counter := campaign_counter + 1;
            
            -- Store campaign info for later phases
            PERFORM pg_temp.store_campaign_info(
                campaign_id, 
                campaign_status, 
                campaign_start, 
                campaign_end, 
                campaign_budget,
                advertiser_record.id,
                advertiser_record.agency_id,
                io_id
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % campaigns with insertion orders', campaign_counter - 1;
END $$;

-- Create temp function to store campaign info
CREATE OR REPLACE FUNCTION pg_temp.store_campaign_info(
    p_campaign_id TEXT,
    p_status TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_budget NUMERIC,
    p_advertiser_id TEXT,
    p_agency_id TEXT,
    p_io_id TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO pg_temp.campaign_info VALUES (
        p_campaign_id, p_status, p_start_date, p_end_date, 
        p_budget, p_advertiser_id, p_agency_id, p_io_id
    );
END;
$$ LANGUAGE plpgsql;

-- Create temp table for campaign info
CREATE TEMP TABLE campaign_info (
    campaign_id TEXT,
    status TEXT,
    start_date DATE,
    end_date DATE,
    budget NUMERIC,
    advertiser_id TEXT,
    agency_id TEXT,
    io_id TEXT
);

-- Phase 2: Create Orders and Reservations
DO $$
DECLARE
    campaign_record RECORD;
    show_record RECORD;
    episode_record RECORD;
    order_id TEXT;
    reservation_id TEXT;
    order_counter INTEGER := 1;
    slots_needed INTEGER;
    slot_rate NUMERIC;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating orders and inventory reservations...';
    
    FOR campaign_record IN 
        SELECT * FROM pg_temp.campaign_info
    LOOP
        -- Calculate slots needed based on budget and campaign duration
        slots_needed := GREATEST(
            4, -- Minimum 4 slots
            LEAST(
                50, -- Maximum 50 slots per campaign
                (campaign_record.budget / 1000)::INTEGER -- $1000 per slot average
            )
        );
        
        slot_rate := campaign_record.budget / slots_needed;
        
        -- Create order for the campaign
        order_id := gen_random_uuid();
        INSERT INTO "Order" (
            id, "organizationId", "campaignId", "advertiserId", "agencyId",
            "orderNumber", "totalAmount", status, "paymentStatus",
            "createdAt", "updatedAt", "submittedAt", "approvedAt"
        ) VALUES (
            order_id,
            org_id,
            campaign_record.campaign_id,
            campaign_record.advertiser_id,
            campaign_record.agency_id,
            'ORD-' || EXTRACT(YEAR FROM campaign_record.start_date) || '-' || LPAD(order_counter::TEXT, 5, '0'),
            campaign_record.budget::INTEGER,
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
            campaign_record.start_date - INTERVAL '5 days',
            campaign_record.start_date - INTERVAL '3 days',
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') THEN campaign_record.start_date - INTERVAL '4 days'
                ELSE NULL
            END,
            CASE 
                WHEN campaign_record.status IN ('completed', 'active') THEN campaign_record.start_date - INTERVAL '3 days'
                ELSE NULL
            END
        );
        
        -- Create inventory reservations for shows
        FOR show_record IN 
            SELECT id, name FROM "Show" 
            WHERE "organizationId" = org_id AND name LIKE 'Seed:%'
            ORDER BY RANDOM()
            LIMIT (2 + (RANDOM() * 3)::INTEGER) -- 2-5 shows per campaign
        LOOP
            -- Reserve episodes within campaign date range
            FOR episode_record IN 
                SELECT id, title, "airDate" 
                FROM "Episode" 
                WHERE "showId" = show_record.id 
                  AND "airDate" >= campaign_record.start_date
                  AND "airDate" <= campaign_record.end_date
                ORDER BY RANDOM()
                LIMIT GREATEST(1, slots_needed / 3) -- Distribute slots across shows
            LOOP
                reservation_id := gen_random_uuid();
                INSERT INTO "Reservation" (
                    id, "organizationId", "orderId", "campaignId", 
                    "showId", "episodeId", "slotType", "slotPosition",
                    rate, status, "reservedAt", "expiresAt",
                    "createdAt", "updatedAt"
                ) VALUES (
                    reservation_id,
                    org_id,
                    order_id,
                    campaign_record.campaign_id,
                    show_record.id,
                    episode_record.id,
                    CASE (RANDOM() * 2)::INTEGER
                        WHEN 0 THEN 'pre-roll'
                        WHEN 1 THEN 'mid-roll'
                        ELSE 'post-roll'
                    END,
                    (RANDOM() * 3 + 1)::INTEGER, -- Position 1-4
                    slot_rate::INTEGER,
                    CASE 
                        WHEN campaign_record.status = 'completed' THEN 'used'
                        WHEN campaign_record.status = 'active' THEN 'confirmed'
                        ELSE 'pending'
                    END,
                    campaign_record.start_date - INTERVAL '3 days',
                    campaign_record.end_date + INTERVAL '7 days',
                    campaign_record.start_date - INTERVAL '3 days',
                    campaign_record.start_date - INTERVAL '3 days'
                );
            END LOOP;
        END LOOP;
        
        order_counter := order_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Created % orders with inventory reservations', order_counter - 1;
END $$;

-- Phase 3: Create Ad Approvals
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
        FROM pg_temp.campaign_info c
        JOIN "Advertiser" a ON c.advertiser_id = a.id
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
                campaign_record.campaign_id,
                campaign_record.advertiser_id,
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
                '/audio/campaigns/' || campaign_record.campaign_id || '/creative_v' || version_num || '.mp3',
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
                campaign_record.start_date - INTERVAL (7 - version_num) || ' days',
                CASE 
                    WHEN campaign_record.status IN ('completed', 'active') AND version_num = 1 
                        THEN campaign_record.start_date - INTERVAL '4 days'
                    WHEN campaign_record.status = 'completed' AND version_num > 1
                        THEN campaign_record.start_date - INTERVAL '5 days'
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
                version_num = 1, -- First version is active
                campaign_record.start_date - INTERVAL (7 - version_num) || ' days',
                campaign_record.start_date - INTERVAL (7 - version_num) || ' days'
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created ad approvals for all campaigns';
END $$;

-- Phase 4: Create Invoices for Completed Campaigns
DO $$
DECLARE
    campaign_record RECORD;
    invoice_id TEXT;
    invoice_number INTEGER := 1001;
    payment_id TEXT;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating invoices for completed campaigns...';
    
    FOR campaign_record IN 
        SELECT c.*, a.name as advertiser_name, a."contactEmail" as advertiser_email
        FROM pg_temp.campaign_info c
        JOIN "Advertiser" a ON c.advertiser_id = a.id
        WHERE c.status = 'completed'
    LOOP
        invoice_id := gen_random_uuid();
        
        -- Create invoice
        INSERT INTO "Invoice" (
            id, "organizationId", "campaignId", "orderId", "advertiserId", "agencyId",
            "invoiceNumber", "invoiceDate", "dueDate", "subtotal", "tax", "total",
            status, "paidAt", "paymentMethod", "notes",
            "createdAt", "updatedAt", "sentAt"
        ) VALUES (
            invoice_id,
            org_id,
            campaign_record.campaign_id,
            (SELECT id FROM "Order" WHERE "campaignId" = campaign_record.campaign_id LIMIT 1),
            campaign_record.advertiser_id,
            campaign_record.agency_id,
            'INV-' || EXTRACT(YEAR FROM campaign_record.end_date) || '-' || LPAD(invoice_number::TEXT, 4, '0'),
            campaign_record.end_date + INTERVAL '3 days',
            campaign_record.end_date + INTERVAL '33 days', -- NET 30
            campaign_record.budget::INTEGER,
            (campaign_record.budget * 0.08)::INTEGER, -- 8% tax
            (campaign_record.budget * 1.08)::INTEGER, -- Total with tax
            'paid',
            campaign_record.end_date + INTERVAL (15 + RANDOM() * 20) || ' days', -- Paid within 15-35 days
            CASE (RANDOM() * 3)::INTEGER
                WHEN 0 THEN 'wire_transfer'
                WHEN 1 THEN 'check'
                WHEN 2 THEN 'ach'
                ELSE 'credit_card'
            END,
            'Campaign: ' || campaign_record.advertiser_name || ' - Successfully completed with ' ||
            (SELECT COUNT(*) FROM "Reservation" WHERE "campaignId" = campaign_record.campaign_id) ||
            ' ad placements delivered.',
            campaign_record.end_date + INTERVAL '3 days',
            campaign_record.end_date + INTERVAL '3 days',
            campaign_record.end_date + INTERVAL '4 days'
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
            campaign_record.campaign_id,
            campaign_record.advertiser_id,
            (campaign_record.budget * 1.08)::INTEGER,
            campaign_record.end_date + INTERVAL (15 + RANDOM() * 20) || ' days',
            CASE (RANDOM() * 3)::INTEGER
                WHEN 0 THEN 'wire_transfer'
                WHEN 1 THEN 'check'
                WHEN 2 THEN 'ach'
                ELSE 'credit_card'
            END,
            'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((RANDOM() * 999999)::INTEGER::TEXT, 6, '0'),
            'completed',
            'Payment received for invoice INV-' || EXTRACT(YEAR FROM campaign_record.end_date) || '-' || LPAD(invoice_number::TEXT, 4, '0'),
            campaign_record.end_date + INTERVAL (15 + RANDOM() * 20) || ' days',
            campaign_record.end_date + INTERVAL (15 + RANDOM() * 20) || ' days'
        );
        
        invoice_number := invoice_number + 1;
    END LOOP;
    
    RAISE NOTICE 'Created invoices and payments for completed campaigns';
END $$;

-- Phase 5: Create Campaign Analytics for Active and Completed Campaigns
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
        SELECT * FROM pg_temp.campaign_info
        WHERE status IN ('active', 'completed')
    LOOP
        days_in_campaign := (campaign_record.end_date - campaign_record.start_date)::INTEGER;
        current_day := campaign_record.start_date;
        
        WHILE current_day <= LEAST(campaign_record.end_date, CURRENT_DATE) LOOP
            -- Calculate realistic daily metrics
            daily_impressions := CASE 
                WHEN EXTRACT(DOW FROM current_day) IN (0, 6) THEN -- Weekend
                    (1500 + RANDOM() * 2500)::INTEGER
                ELSE -- Weekday
                    (3000 + RANDOM() * 5000)::INTEGER
            END;
            
            daily_clicks := (daily_impressions * (0.02 + RANDOM() * 0.03))::INTEGER; -- 2-5% CTR
            daily_conversions := (daily_clicks * (0.05 + RANDOM() * 0.10))::INTEGER; -- 5-15% conversion
            daily_spend := campaign_record.budget / days_in_campaign * (0.8 + RANDOM() * 0.4);
            
            INSERT INTO "CampaignAnalytics" (
                id, "campaignId", "organizationId", date,
                impressions, clicks, conversions,
                "clickThroughRate", "conversionRate",
                spend, revenue,
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                campaign_record.campaign_id,
                org_id,
                current_day,
                daily_impressions,
                daily_clicks,
                daily_conversions,
                daily_clicks::NUMERIC / NULLIF(daily_impressions, 0),
                daily_conversions::NUMERIC / NULLIF(daily_clicks, 0),
                daily_spend::INTEGER,
                (daily_conversions * (50 + RANDOM() * 150))::INTEGER, -- $50-200 per conversion
                current_day + INTERVAL '1 day',
                current_day + INTERVAL '1 day'
            );
            
            current_day := current_day + INTERVAL '1 day';
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created daily analytics for all active and completed campaigns';
END $$;

-- Phase 6: Create Order Items for detailed billing
DO $$
DECLARE
    order_record RECORD;
    reservation_record RECORD;
    item_counter INTEGER;
    org_id TEXT := 'cmd2qfeve0000og5y8hfwu795';
BEGIN
    RAISE NOTICE 'Creating order items for detailed billing...';
    
    FOR order_record IN 
        SELECT DISTINCT o.id as order_id, o."campaignId"
        FROM "Order" o
        WHERE o."organizationId" = org_id
    LOOP
        item_counter := 1;
        
        FOR reservation_record IN 
            SELECT r.*, s.name as show_name, e.title as episode_title
            FROM "Reservation" r
            JOIN "Show" s ON r."showId" = s.id
            JOIN "Episode" e ON r."episodeId" = e.id
            WHERE r."orderId" = order_record.order_id
        LOOP
            INSERT INTO "OrderItem" (
                id, "orderId", "organizationId", "showId", "episodeId",
                "itemType", description, quantity, "unitPrice", "totalPrice",
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(),
                order_record.order_id,
                org_id,
                reservation_record."showId",
                reservation_record."episodeId",
                reservation_record."slotType",
                reservation_record."slotType" || ' sponsorship on ' || 
                reservation_record.show_name || ' - Episode: ' || 
                reservation_record.episode_title,
                1,
                reservation_record.rate::INTEGER,
                reservation_record.rate::INTEGER,
                NOW(),
                NOW()
            );
            
            item_counter := item_counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created order items for all orders';
END $$;

-- Final Summary
DO $$
DECLARE
    total_campaigns INTEGER;
    total_ios INTEGER;
    total_orders INTEGER;
    total_reservations INTEGER;
    total_invoices INTEGER;
    total_payments INTEGER;
    total_approvals INTEGER;
    total_analytics INTEGER;
    campaign_revenue NUMERIC;
BEGIN
    SELECT COUNT(*) INTO total_campaigns FROM "Campaign" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
    SELECT COUNT(*) INTO total_ios FROM "InsertionOrder" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';
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
    RAISE NOTICE '   ✓ Insertion Orders: % (all campaigns have IOs)', total_ios;
    RAISE NOTICE '   ✓ Orders: % (with inventory reservations)', total_orders;
    RAISE NOTICE '   ✓ Ad Slots Reserved: % (across all shows)', total_reservations;
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
    RAISE NOTICE '🎯 REALISTIC FEATURES:';
    RAISE NOTICE '   • 18 months of historical data';
    RAISE NOTICE '   • Completed campaigns have full lifecycle';
    RAISE NOTICE '   • Active campaigns have partial data';
    RAISE NOTICE '   • Future campaigns are pending approval';
    RAISE NOTICE '   • All tied to real advertisers & agencies';
    RAISE NOTICE '   • Inventory properly reserved and tracked';
    RAISE NOTICE '   • Financial records complete with payments';
    RAISE NOTICE '';
    RAISE NOTICE '✅ The system now appears to have been actively used';
    RAISE NOTICE '   for podcast advertising over the last 18 months!';
    RAISE NOTICE '════════════════════════════════════════════════════════';
END $$;

-- Clean up temp objects
DROP FUNCTION IF EXISTS pg_temp.store_campaign_info(TEXT, TEXT, DATE, DATE, NUMERIC, TEXT, TEXT, TEXT);
DROP TABLE IF EXISTS pg_temp.campaign_info;