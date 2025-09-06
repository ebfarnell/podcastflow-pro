-- Fix Lost Campaigns Probability Constraint
-- This script updates the Campaign probability check constraint to allow 0 for lost campaigns

-- Update constraint for org_podcastflow_pro schema
ALTER TABLE org_podcastflow_pro."Campaign" 
DROP CONSTRAINT IF EXISTS "Campaign_probability_check";

ALTER TABLE org_podcastflow_pro."Campaign" 
ADD CONSTRAINT "Campaign_probability_check" 
CHECK (probability = ANY (ARRAY[0, 10, 35, 65, 90, 100]));

-- Update constraint for org_unfy schema
ALTER TABLE org_unfy."Campaign" 
DROP CONSTRAINT IF EXISTS "Campaign_probability_check";

ALTER TABLE org_unfy."Campaign" 
ADD CONSTRAINT "Campaign_probability_check" 
CHECK (probability = ANY (ARRAY[0, 10, 35, 65, 90, 100]));

-- Verify the changes
SELECT 
    n.nspname as schema_name,
    c.conname as constraint_name,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class cl ON c.conrelid = cl.oid
JOIN pg_namespace n ON cl.relnamespace = n.oid
WHERE cl.relname = 'Campaign' 
AND c.contype = 'c'
AND n.nspname IN ('org_podcastflow_pro', 'org_unfy')
AND c.conname = 'Campaign_probability_check';