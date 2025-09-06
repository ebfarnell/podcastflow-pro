-- Create Proposal Templates tables in organization schemas

-- Function to create proposal template tables for a schema
CREATE OR REPLACE FUNCTION create_proposal_template_tables(schema_name text)
RETURNS void AS $$
BEGIN
    -- Create ProposalTemplate table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."ProposalTemplate" (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            "isActive" BOOLEAN DEFAULT true,
            "createdBy" VARCHAR(50) NOT NULL,
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("createdBy") REFERENCES public."User"(id)
        )', schema_name);

    -- Create ProposalTemplateItem table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."ProposalTemplateItem" (
            id VARCHAR(50) PRIMARY KEY,
            "templateId" VARCHAR(50) NOT NULL,
            "showId" VARCHAR(50),
            "placementType" VARCHAR(20),
            "slotCount" INTEGER DEFAULT 1,
            "weeklyDistribution" JSONB, -- e.g., {"monday": 2, "wednesday": 1, "friday": 2}
            "budgetPercentage" DECIMAL(5,2), -- percentage of total budget for this item
            "priority" INTEGER DEFAULT 0,
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("templateId") REFERENCES %I."ProposalTemplate"(id) ON DELETE CASCADE
        )', schema_name, schema_name);

    -- Create ProposalTemplateFilter table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."ProposalTemplateFilter" (
            id VARCHAR(50) PRIMARY KEY,
            "templateId" VARCHAR(50) NOT NULL,
            "filterType" VARCHAR(50) NOT NULL, -- e.g., "category", "audience_size", "price_range"
            "filterValue" JSONB NOT NULL,
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("templateId") REFERENCES %I."ProposalTemplate"(id) ON DELETE CASCADE
        )', schema_name, schema_name);

    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_template_active ON %I."ProposalTemplate"("isActive")', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_template_created ON %I."ProposalTemplate"("createdBy")', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_template_item_template ON %I."ProposalTemplateItem"("templateId")', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_template_filter_template ON %I."ProposalTemplateFilter"("templateId")', schema_name, schema_name);

END;
$$ LANGUAGE plpgsql;

-- Create tables for existing organizations
DO $$
DECLARE
    org RECORD;
    schema_name TEXT;
BEGIN
    FOR org IN SELECT DISTINCT slug FROM public."Organization" WHERE slug IS NOT NULL
    LOOP
        -- Replace hyphens with underscores for schema names
        schema_name := 'org_' || REPLACE(org.slug, '-', '_');
        PERFORM create_proposal_template_tables(schema_name);
        RAISE NOTICE 'Created proposal template tables for schema: %', schema_name;
    END LOOP;
END $$;

-- Create sample templates for podcastflow_pro
INSERT INTO org_podcastflow_pro."ProposalTemplate" (id, name, description, "createdBy") VALUES
('tmpl_starter_pack', 'Starter Campaign Template', 'Perfect for new advertisers looking to test podcast advertising', 'usr_d2f4g8j3k5m7n9p2'),
('tmpl_premium_multi', 'Premium Multi-Show Template', 'High-impact campaign across multiple premium shows', 'usr_d2f4g8j3k5m7n9p2'),
('tmpl_tech_focused', 'Tech Industry Focus', 'Optimized for technology companies targeting tech-savvy audiences', 'usr_d2f4g8j3k5m7n9p2');

-- Add template items for starter pack
INSERT INTO org_podcastflow_pro."ProposalTemplateItem" (id, "templateId", "placementType", "slotCount", "budgetPercentage", "priority") VALUES
('tmpl_item_1', 'tmpl_starter_pack', 'mid-roll', 10, 60.00, 1),
('tmpl_item_2', 'tmpl_starter_pack', 'pre-roll', 5, 25.00, 2),
('tmpl_item_3', 'tmpl_starter_pack', 'post-roll', 5, 15.00, 3);

-- Add filters for tech focused template
INSERT INTO org_podcastflow_pro."ProposalTemplateFilter" (id, "templateId", "filterType", "filterValue") VALUES
('tmpl_filter_1', 'tmpl_tech_focused', 'category', '{"value": "technology"}'),
('tmpl_filter_2', 'tmpl_tech_focused', 'audience_size', '{"min": 10000, "max": 100000}'),
('tmpl_filter_3', 'tmpl_tech_focused', 'price_range', '{"min": 200, "max": 1000}');