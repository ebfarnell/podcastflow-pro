-- Migrate campaigns from public schema to organization schemas

-- First, migrate campaigns to org_podcastflow_pro schema
INSERT INTO org_podcastflow_pro."Campaign" (
    id, name, "advertiserId", "agencyId", "organizationId", 
    "startDate", "endDate", budget, spent, impressions, 
    "targetImpressions", clicks, conversions, "targetAudience", 
    status, "createdAt", "updatedAt", "createdBy"
)
SELECT 
    id, name, "advertiserId", "agencyId", "organizationId",
    "startDate", "endDate", budget, spent, impressions,
    "targetImpressions", clicks, conversions, "targetAudience",
    status, "createdAt", "updatedAt", "createdBy"
FROM public."Campaign"
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795';

-- Migrate agencies
INSERT INTO org_podcastflow_pro."Agency" (
    id, name, website, "contactPhone", "contactEmail", 
    address, city, state, "zipCode", country, 
    "isActive", "organizationId", "createdAt", "updatedAt"
)
SELECT 
    id, name, website, "contactPhone", "contactEmail",
    address, city, state, "zipCode", country,
    "isActive", "organizationId", "createdAt", "updatedAt"
FROM public."Agency"
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795'
ON CONFLICT (id) DO NOTHING;

-- Migrate advertisers
INSERT INTO org_podcastflow_pro."Advertiser" (
    id, name, website, "contactName", "contactEmail", 
    "contactPhone", address, city, state, "zipCode", 
    country, industry, "isActive", "organizationId", 
    "agencyId", "createdAt", "updatedAt"
)
SELECT 
    id, name, website, "contactName", "contactEmail",
    "contactPhone", address, city, state, "zipCode",
    country, industry, "isActive", "organizationId",
    "agencyId", "createdAt", "updatedAt"
FROM public."Advertiser"
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795'
ON CONFLICT (id) DO NOTHING;

-- Migrate shows
INSERT INTO org_podcastflow_pro."Show" (
    id, name, "organizationId", "isActive", "createdAt", "updatedAt"
)
SELECT 
    id, name, "organizationId", "isActive", "createdAt", "updatedAt"
FROM public."Show"
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795'
ON CONFLICT (id) DO NOTHING;

-- Migrate orders
INSERT INTO org_podcastflow_pro."Order" (
    id, "orderNumber", "campaignId", version, "parentOrderId",
    "organizationId", "advertiserId", "agencyId", status,
    "totalAmount", "discountAmount", "discountReason", "netAmount",
    "submittedAt", "submittedBy", "approvedAt", "approvedBy",
    "bookedAt", "bookedBy", "confirmedAt", "confirmedBy",
    "ioNumber", "ioGeneratedAt", "contractUrl", "signedContractUrl",
    "contractSignedAt", notes, "internalNotes", "createdAt",
    "updatedAt", "createdBy"
)
SELECT 
    id, "orderNumber", "campaignId", version, "parentOrderId",
    "organizationId", "advertiserId", "agencyId", status,
    "totalAmount", "discountAmount", "discountReason", "netAmount",
    "submittedAt", "submittedBy", "approvedAt", "approvedBy",
    "bookedAt", "bookedBy", "confirmedAt", "confirmedBy",
    "ioNumber", "ioGeneratedAt", "contractUrl", "signedContractUrl",
    "contractSignedAt", notes, "internalNotes", "createdAt",
    "updatedAt", "createdBy"
FROM public."Order"
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795'
ON CONFLICT (id) DO NOTHING;

-- Migrate order items
INSERT INTO org_podcastflow_pro."OrderItem" (
    id, "orderId", "showId", "placementType", "airDate",
    length, rate, "actualRate", "isLiveRead", status,
    "adTitle", "createdAt", "updatedAt"
)
SELECT 
    id, "orderId", "showId", "placementType", "airDate",
    length, rate, "actualRate", "isLiveRead", status,
    "adTitle", "createdAt", "updatedAt"
FROM public."OrderItem"
WHERE "orderId" IN (SELECT id FROM public."Order" WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795')
ON CONFLICT (id) DO NOTHING;

-- Migrate contracts
INSERT INTO org_podcastflow_pro."Contract" (
    id, "contractNumber", "organizationId", "campaignId", "orderId",
    "advertiserId", "agencyId", "contractType", title, description,
    "totalAmount", "discountAmount", "netAmount", "commissionRate",
    "startDate", "endDate", "paymentTerms", "cancellationTerms",
    "deliveryTerms", "specialTerms", status, "isExecuted",
    "executedAt", "executedById", "templateId", "generatedDocument",
    "documentUrl", "signatureUrl", "sentAt", "signedAt",
    "completedAt", "createdAt", "updatedAt", "createdById"
)
SELECT 
    id, "contractNumber", "organizationId", "campaignId", "orderId",
    "advertiserId", "agencyId", "contractType", title, description,
    "totalAmount", "discountAmount", "netAmount", "commissionRate",
    "startDate", "endDate", "paymentTerms", "cancellationTerms",
    "deliveryTerms", "specialTerms", status, "isExecuted",
    "executedAt", "executedById", "templateId", "generatedDocument",
    "documentUrl", "signatureUrl", "sentAt", "signedAt",
    "completedAt", "createdAt", "updatedAt", "createdById"
FROM public."Contract"
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795'
ON CONFLICT (id) DO NOTHING;

-- Migrate ad approvals
INSERT INTO org_podcastflow_pro."AdApproval" (
    id, title, "advertiserId", "advertiserName", "campaignId",
    "showId", "showName", type, duration, script,
    "talkingPoints", priority, deadline, status, "salesRepId",
    "salesRepName", "submittedBy", "organizationId", "workflowStage",
    "revisionCount", "createdAt", "updatedAt", "approvedAt", "rejectedAt"
)
SELECT 
    id, title, "advertiserId", "advertiserName", "campaignId",
    "showId", "showName", type, duration, script,
    "talkingPoints", priority, deadline, status, "salesRepId",
    "salesRepName", "submittedBy", "organizationId", "workflowStage",
    "revisionCount", "createdAt", "updatedAt", "approvedAt", "rejectedAt"
FROM public."AdApproval"
WHERE "organizationId" = 'cmd2qfeve0000og5y8hfwu795'
ON CONFLICT (id) DO NOTHING;

-- Display migration summary
SELECT 'Campaigns migrated:' as entity, COUNT(*) as count FROM org_podcastflow_pro."Campaign"
UNION ALL
SELECT 'Agencies migrated:', COUNT(*) FROM org_podcastflow_pro."Agency"
UNION ALL
SELECT 'Advertisers migrated:', COUNT(*) FROM org_podcastflow_pro."Advertiser"
UNION ALL
SELECT 'Shows migrated:', COUNT(*) FROM org_podcastflow_pro."Show"
UNION ALL
SELECT 'Orders migrated:', COUNT(*) FROM org_podcastflow_pro."Order"
UNION ALL
SELECT 'Order Items migrated:', COUNT(*) FROM org_podcastflow_pro."OrderItem"
UNION ALL
SELECT 'Contracts migrated:', COUNT(*) FROM org_podcastflow_pro."Contract"
UNION ALL
SELECT 'Ad Approvals migrated:', COUNT(*) FROM org_podcastflow_pro."AdApproval";