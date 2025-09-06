-- Migrate advertisers with correct column names
INSERT INTO org_podcastflow_pro."Advertiser" (
    id, name, "contactEmail", "contactPhone", website,
    industry, address, city, state, "zipCode",
    country, "agencyId", "organizationId", "isActive",
    "createdAt", "updatedAt", "createdBy", "updatedBy"
)
SELECT 
    id, name, "contactEmail", "contactPhone", website,
    industry, address, city, state, "zipCode",
    country, "agencyId", "organizationId", "isActive",
    "createdAt", "updatedAt", "createdBy", "updatedBy"
FROM public."Advertiser"
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795'
ON CONFLICT (id) DO NOTHING;

-- Check migration results
SELECT 'Advertisers migrated:' as entity, COUNT(*) as count FROM org_podcastflow_pro."Advertiser";