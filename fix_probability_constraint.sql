-- Fix probability constraint to allow 0 for lost campaigns
-- This updates both organization schemas

-- Update constraint for org_podcastflow_pro
ALTER TABLE org_podcastflow_pro."Campaign" 
DROP CONSTRAINT IF EXISTS "Campaign_probability_check";

ALTER TABLE org_podcastflow_pro."Campaign" 
ADD CONSTRAINT "Campaign_probability_check" 
CHECK (probability = ANY (ARRAY[0, 10, 35, 65, 90, 100]));

-- Update constraint for org_unfy  
ALTER TABLE org_unfy."Campaign" 
DROP CONSTRAINT IF EXISTS "Campaign_probability_check";

ALTER TABLE org_unfy."Campaign" 
ADD CONSTRAINT "Campaign_probability_check" 
CHECK (probability = ANY (ARRAY[0, 10, 35, 65, 90, 100]));

-- Verify the changes
SELECT 
    n.nspname as schema,
    c.conname as constraint_name,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE t.relname = 'Campaign' 
AND c.conname = 'Campaign_probability_check'
AND n.nspname IN ('org_podcastflow_pro', 'org_unfy');