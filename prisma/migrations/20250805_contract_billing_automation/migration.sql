-- =====================================================
-- Contract Templates and Billing Automation Migration
-- Phase 4 of Campaign Workflow Automation
-- =====================================================

-- Create ContractTemplate table in org schemas
DO $$
DECLARE
    org_schema TEXT;
BEGIN
    FOR org_schema IN 
        SELECT nspname 
        FROM pg_namespace 
        WHERE nspname LIKE 'org_%'
    LOOP
        -- ContractTemplate table
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."ContractTemplate" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "organizationId" TEXT NOT NULL,
                "name" TEXT NOT NULL,
                "description" TEXT,
                "templateType" TEXT NOT NULL DEFAULT ''insertion_order'',
                "htmlTemplate" TEXT NOT NULL,
                "variables" JSONB DEFAULT ''[]''::jsonb,
                "isActive" BOOLEAN NOT NULL DEFAULT true,
                "isDefault" BOOLEAN NOT NULL DEFAULT false,
                "version" INTEGER NOT NULL DEFAULT 1,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "createdById" TEXT,
                "updatedById" TEXT
            )', org_schema);

        -- Create indexes
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_ContractTemplate_organizationId_idx" ON %I."ContractTemplate"("organizationId")', org_schema, org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_ContractTemplate_templateType_idx" ON %I."ContractTemplate"("templateType")', org_schema, org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_ContractTemplate_isActive_idx" ON %I."ContractTemplate"("isActive")', org_schema, org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_ContractTemplate_isDefault_idx" ON %I."ContractTemplate"("isDefault")', org_schema, org_schema);

        -- BillingSettings table for organization-wide billing configuration
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."BillingSettings" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "organizationId" TEXT NOT NULL UNIQUE,
                "defaultInvoiceDay" INTEGER NOT NULL DEFAULT 1 CHECK ("defaultInvoiceDay" >= 1 AND "defaultInvoiceDay" <= 28),
                "defaultPaymentTerms" TEXT NOT NULL DEFAULT ''Net 30'',
                "autoGenerateInvoices" BOOLEAN NOT NULL DEFAULT true,
                "invoicePrefix" TEXT NOT NULL DEFAULT ''INV'',
                "invoiceStartNumber" INTEGER NOT NULL DEFAULT 1000,
                "lateFeePercentage" DECIMAL(5,2) DEFAULT 0,
                "gracePeriodDays" INTEGER DEFAULT 5,
                "preBillEnabled" BOOLEAN NOT NULL DEFAULT true,
                "preBillThresholdAmount" DECIMAL(10,2) DEFAULT 10000,
                "emailSettings" JSONB DEFAULT ''{}''::jsonb,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedById" TEXT
            )', org_schema);

        -- PreBillAdvertiser table for tracking advertisers without credit terms
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."PreBillAdvertiser" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "organizationId" TEXT NOT NULL,
                "advertiserId" TEXT NOT NULL,
                "reason" TEXT NOT NULL,
                "flaggedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "flaggedById" TEXT NOT NULL,
                "notes" TEXT,
                "isActive" BOOLEAN NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE("organizationId", "advertiserId")
            )', org_schema);

        -- Create indexes for PreBillAdvertiser
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_PreBillAdvertiser_organizationId_idx" ON %I."PreBillAdvertiser"("organizationId")', org_schema, org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_PreBillAdvertiser_advertiserId_idx" ON %I."PreBillAdvertiser"("advertiserId")', org_schema, org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_PreBillAdvertiser_isActive_idx" ON %I."PreBillAdvertiser"("isActive")', org_schema, org_schema);

        -- InvoiceSchedule table for automated invoice generation
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I."InvoiceSchedule" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "organizationId" TEXT NOT NULL,
                "orderId" TEXT NOT NULL,
                "scheduleType" TEXT NOT NULL DEFAULT ''monthly'',
                "dayOfMonth" INTEGER CHECK ("dayOfMonth" >= 1 AND "dayOfMonth" <= 28),
                "frequency" TEXT DEFAULT ''monthly'',
                "nextInvoiceDate" DATE NOT NULL,
                "lastInvoiceDate" DATE,
                "isActive" BOOLEAN NOT NULL DEFAULT true,
                "autoSend" BOOLEAN NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE("organizationId", "orderId")
            )', org_schema);

        -- Create indexes for InvoiceSchedule
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_InvoiceSchedule_organizationId_idx" ON %I."InvoiceSchedule"("organizationId")', org_schema, org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_InvoiceSchedule_orderId_idx" ON %I."InvoiceSchedule"("orderId")', org_schema, org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_InvoiceSchedule_nextInvoiceDate_idx" ON %I."InvoiceSchedule"("nextInvoiceDate")', org_schema, org_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS "%s_InvoiceSchedule_isActive_idx" ON %I."InvoiceSchedule"("isActive")', org_schema, org_schema);

        -- Add contract-related columns to Order table if not exist
        EXECUTE format('
            DO $inner$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = %L AND table_name = ''Order'' AND column_name = ''contractId'') 
                THEN
                    ALTER TABLE %I."Order" ADD COLUMN "contractId" TEXT;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = %L AND table_name = ''Order'' AND column_name = ''requiresPreBill'') 
                THEN
                    ALTER TABLE %I."Order" ADD COLUMN "requiresPreBill" BOOLEAN DEFAULT false;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = %L AND table_name = ''Order'' AND column_name = ''preBillStatus'') 
                THEN
                    ALTER TABLE %I."Order" ADD COLUMN "preBillStatus" TEXT;
                END IF;
            END $inner$;
        ', org_schema, org_schema, org_schema, org_schema, org_schema, org_schema);

        -- Add billing-related columns to Campaign table if not exist
        EXECUTE format('
            DO $inner$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = %L AND table_name = ''Campaign'' AND column_name = ''billingNotes'') 
                THEN
                    ALTER TABLE %I."Campaign" ADD COLUMN "billingNotes" TEXT;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = %L AND table_name = ''Campaign'' AND column_name = ''preBillFlag'') 
                THEN
                    ALTER TABLE %I."Campaign" ADD COLUMN "preBillFlag" BOOLEAN DEFAULT false;
                END IF;
            END $inner$;
        ', org_schema, org_schema, org_schema, org_schema);

    END LOOP;
END $$;

-- Create function to generate contract from template
CREATE OR REPLACE FUNCTION generate_contract_from_template(
    p_schema TEXT,
    p_template_id TEXT,
    p_order_id TEXT,
    p_variables JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_template_html TEXT;
    v_result_html TEXT;
    v_var_key TEXT;
    v_var_value TEXT;
BEGIN
    -- Get template HTML
    EXECUTE format('
        SELECT "htmlTemplate"
        FROM %I."ContractTemplate"
        WHERE id = $1 AND "isActive" = true
    ', p_schema)
    INTO v_template_html
    USING p_template_id;
    
    IF v_template_html IS NULL THEN
        RAISE EXCEPTION 'Template not found or inactive';
    END IF;
    
    v_result_html := v_template_html;
    
    -- Replace variables
    FOR v_var_key, v_var_value IN SELECT * FROM jsonb_each_text(p_variables)
    LOOP
        v_result_html := REPLACE(v_result_html, '{{' || v_var_key || '}}', COALESCE(v_var_value, ''));
    END LOOP;
    
    RETURN jsonb_build_object(
        'html', v_result_html,
        'generatedAt', CURRENT_TIMESTAMP,
        'templateId', p_template_id,
        'variables', p_variables
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to check pre-bill requirements
CREATE OR REPLACE FUNCTION check_prebill_requirements(
    p_schema TEXT,
    p_advertiser_id TEXT,
    p_order_amount DECIMAL
)
RETURNS JSONB AS $$
DECLARE
    v_is_prebill_required BOOLEAN := false;
    v_prebill_reason TEXT;
    v_settings RECORD;
BEGIN
    -- Get billing settings
    EXECUTE format('
        SELECT "preBillEnabled", "preBillThresholdAmount"
        FROM %I."BillingSettings"
        WHERE "organizationId" = (SELECT "organizationId" FROM %I."Advertiser" WHERE id = $1 LIMIT 1)
        LIMIT 1
    ', p_schema, p_schema)
    INTO v_settings
    USING p_advertiser_id;
    
    -- Check if advertiser is flagged for pre-bill
    EXECUTE format('
        SELECT EXISTS(
            SELECT 1 FROM %I."PreBillAdvertiser"
            WHERE "advertiserId" = $1 AND "isActive" = true
        )
    ', p_schema)
    INTO v_is_prebill_required
    USING p_advertiser_id;
    
    IF v_is_prebill_required THEN
        v_prebill_reason := 'Advertiser flagged for pre-payment';
    ELSIF v_settings."preBillEnabled" AND p_order_amount >= v_settings."preBillThresholdAmount" THEN
        v_is_prebill_required := true;
        v_prebill_reason := 'Order amount exceeds threshold';
    END IF;
    
    RETURN jsonb_build_object(
        'required', v_is_prebill_required,
        'reason', v_prebill_reason,
        'thresholdAmount', v_settings."preBillThresholdAmount"
    );
END;
$$ LANGUAGE plpgsql;

-- Create default contract template for each organization
DO $$
DECLARE
    org_rec RECORD;
BEGIN
    FOR org_rec IN 
        SELECT DISTINCT o.id, o.slug, n.nspname as schema_name
        FROM public."Organization" o
        JOIN pg_namespace n ON n.nspname = 'org_' || o.slug
    LOOP
        EXECUTE format('
            INSERT INTO %I."ContractTemplate" (
                "organizationId", "name", "description", "templateType", "htmlTemplate", "variables", "isDefault"
            ) 
            SELECT %L, ''Standard Insertion Order'', ''Default insertion order template'', ''insertion_order'', 
                ''<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .header { text-align: center; margin-bottom: 30px; }
        .contract-title { font-size: 24px; font-weight: bold; }
        .section { margin: 20px 0; }
        .field { margin: 10px 0; }
        .field-label { font-weight: bold; }
        .signature-block { margin-top: 50px; }
        .signature-line { border-bottom: 1px solid black; width: 300px; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="contract-title">ADVERTISING INSERTION ORDER</div>
        <div>Contract #: {{contractNumber}}</div>
        <div>Date: {{contractDate}}</div>
    </div>
    
    <div class="section">
        <div class="field">
            <span class="field-label">Advertiser:</span> {{advertiserName}}
        </div>
        <div class="field">
            <span class="field-label">Agency:</span> {{agencyName}}
        </div>
        <div class="field">
            <span class="field-label">Campaign:</span> {{campaignName}}
        </div>
    </div>
    
    <div class="section">
        <div class="field">
            <span class="field-label">Flight Dates:</span> {{startDate}} - {{endDate}}
        </div>
        <div class="field">
            <span class="field-label">Total Spots:</span> {{totalSpots}}
        </div>
        <div class="field">
            <span class="field-label">Total Amount:</span> ${{totalAmount}}
        </div>
    </div>
    
    <div class="section">
        <h3>Shows and Placements:</h3>
        {{showsPlacements}}
    </div>
    
    <div class="section">
        <h3>Terms and Conditions:</h3>
        <div class="field">
            <span class="field-label">Payment Terms:</span> {{paymentTerms}}
        </div>
        <div class="field">
            <span class="field-label">Cancellation Policy:</span> {{cancellationTerms}}
        </div>
    </div>
    
    <div class="signature-block">
        <div style="float: left; width: 45%;">
            <div>Advertiser/Agency Signature</div>
            <div class="signature-line"></div>
            <div>Name: _________________________</div>
            <div>Date: _________________________</div>
        </div>
        <div style="float: right; width: 45%;">
            <div>Publisher Signature</div>
            <div class="signature-line"></div>
            <div>Name: _________________________</div>
            <div>Date: _________________________</div>
        </div>
        <div style="clear: both;"></div>
    </div>
</body>
</html>'',
                ''["contractNumber", "contractDate", "advertiserName", "agencyName", "campaignName", "startDate", "endDate", "totalSpots", "totalAmount", "showsPlacements", "paymentTerms", "cancellationTerms"]''::jsonb,
                true
            WHERE NOT EXISTS (
                SELECT 1 FROM %I."ContractTemplate" 
                WHERE "organizationId" = %L AND "isDefault" = true
            )', org_rec.schema_name, org_rec.id, org_rec.schema_name, org_rec.id);

        -- Insert default billing settings
        EXECUTE format('
            INSERT INTO %I."BillingSettings" ("organizationId")
            SELECT %L
            WHERE NOT EXISTS (
                SELECT 1 FROM %I."BillingSettings" WHERE "organizationId" = %L
            );', org_rec.schema_name, org_rec.id, org_rec.schema_name, org_rec.id);
    END LOOP;
END $$;

-- =====================================================
-- Migration completed successfully
-- =====================================================