-- Insert default contract templates and billing settings
DO $$
DECLARE
    org_rec RECORD;
BEGIN
    FOR org_rec IN 
        SELECT DISTINCT o.id, o.slug, n.nspname as schema_name
        FROM public."Organization" o
        JOIN pg_namespace n ON n.nspname = 'org_' || o.slug
    LOOP
        -- Insert default contract template
        EXECUTE format($fmt$
            INSERT INTO %I."ContractTemplate" (
                "organizationId", "name", "description", "templateType", "htmlTemplate", "variables", "isDefault"
            ) 
            SELECT %L, 'Standard Insertion Order', 'Default insertion order template', 'insertion_order', 
                '<html>
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
        <div style="float: left; width: 45%%;">
            <div>Advertiser/Agency Signature</div>
            <div class="signature-line"></div>
            <div>Name: _________________________</div>
            <div>Date: _________________________</div>
        </div>
        <div style="float: right; width: 45%%;">
            <div>Publisher Signature</div>
            <div class="signature-line"></div>
            <div>Name: _________________________</div>
            <div>Date: _________________________</div>
        </div>
        <div style="clear: both;"></div>
    </div>
</body>
</html>',
                '["contractNumber", "contractDate", "advertiserName", "agencyName", "campaignName", "startDate", "endDate", "totalSpots", "totalAmount", "showsPlacements", "paymentTerms", "cancellationTerms"]'::jsonb,
                true
            WHERE NOT EXISTS (
                SELECT 1 FROM %I."ContractTemplate" 
                WHERE "organizationId" = %L AND "isDefault" = true
            )
        $fmt$, org_rec.schema_name, org_rec.id, org_rec.schema_name, org_rec.id);

        -- Insert default billing settings
        EXECUTE format($fmt$
            INSERT INTO %I."BillingSettings" ("organizationId")
            SELECT %L
            WHERE NOT EXISTS (
                SELECT 1 FROM %I."BillingSettings" WHERE "organizationId" = %L
            )
        $fmt$, org_rec.schema_name, org_rec.id, org_rec.schema_name, org_rec.id);
    END LOOP;
END $$;