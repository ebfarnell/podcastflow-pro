-- Add RevenueForecast table to organization schemas
-- This table stores monthly revenue forecasts for budget planning

-- Function to add RevenueForecast table to a schema
CREATE OR REPLACE FUNCTION add_revenue_forecast_table(schema_name TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."RevenueForecast" (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "organizationId" TEXT NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            "forecastAmount" NUMERIC(10,2) DEFAULT 0,
            notes TEXT,
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "createdBy" TEXT,
            "updatedBy" TEXT,
            CONSTRAINT unique_org_year_month UNIQUE ("organizationId", year, month)
        )', schema_name);
    
    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_revenue_forecast_org ON %I."RevenueForecast" ("organizationId")', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_revenue_forecast_year_month ON %I."RevenueForecast" (year, month)', schema_name);
    
    RAISE NOTICE 'Added RevenueForecast table to schema %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Add table to org_podcastflow_pro
SELECT add_revenue_forecast_table('org_podcastflow_pro');

-- Add table to org_unfy  
SELECT add_revenue_forecast_table('org_unfy');

-- Drop the function after use
DROP FUNCTION add_revenue_forecast_table(TEXT);