-- First, let's identify campaigns without a valid seller (createdBy not in sales/admin users)
SELECT 
    c.id,
    c.name,
    c."createdBy",
    u.name as creator_name,
    u.role as creator_role,
    u.email as creator_email
FROM org_podcastflow_pro."Campaign" c
LEFT JOIN public."User" u ON c."createdBy" = u.id
WHERE c.status IN ('draft', 'active', 'paused')
  AND (u.role NOT IN ('sales', 'admin') OR u.id IS NULL);

-- Count how many campaigns are affected
SELECT COUNT(*) as unassigned_campaigns
FROM org_podcastflow_pro."Campaign" c
LEFT JOIN public."User" u ON c."createdBy" = u.id
WHERE c.status IN ('draft', 'active', 'paused')
  AND (u.role NOT IN ('sales', 'admin') OR u.id IS NULL);

-- Get the first sales user to assign these campaigns to
SELECT id, name, email 
FROM public."User" 
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795' 
  AND role = 'sales' 
LIMIT 1;

-- Update the campaigns to assign them to the seller
-- (We'll run this after confirming the seller ID)
-- UPDATE org_podcastflow_pro."Campaign" 
-- SET "createdBy" = 'SELLER_ID_HERE'
-- WHERE id IN (
--     SELECT c.id
--     FROM org_podcastflow_pro."Campaign" c
--     LEFT JOIN public."User" u ON c."createdBy" = u.id
--     WHERE c.status IN ('draft', 'active', 'paused')
--       AND (u.role NOT IN ('sales', 'admin') OR u.id IS NULL)
-- );