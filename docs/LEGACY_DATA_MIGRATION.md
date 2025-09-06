# Legacy Data Migration Documentation

## Overview
This document tracks the status of legacy data in the public schema and the migration plan to organization-specific schemas.

## Current State (as of 2025-07-20)

### Multi-Tenant Architecture
- **Public Schema**: Contains shared data (Users, Organizations, Sessions, BillingPlans)
- **Organization Schemas**: `org_podcastflow_pro`, `org_unfy` - contain organization-specific data

### Legacy Data in Public Schema
The following tables contain legacy data from before the multi-tenant migration:

| Table | Record Count | Description |
|-------|--------------|-------------|
| Show | 13 | Legacy shows from before migration |
| Episode | 778 | Episodes linked to legacy shows |
| ShowAnalytics | 760 | Analytics for legacy shows |
| AdApproval | 198 | Ad approvals for legacy content |
| Activity | 86 | Activity logs |
| ShowMetrics | 13 | Metrics for legacy shows |
| _ShowProducers | 13 | Producer assignments |
| _ShowTalent | 13 | Talent assignments |
| OrderItem | 7 | Order items referencing shows |

### APIs Using Correct Schemas ✅
- `/api/shows/*` - All show endpoints use organization schemas
- `/api/shows/[id]/metrics` - Uses organization schemas  
- `/api/campaigns/*` - Uses organization schemas
- `/api/dashboard` - Aggregates from organization schemas
- `/api/inventory/*` - Uses organization schemas

### APIs Still Using Public Schema ❌
- `/api/episodes/*` - Uses Prisma directly (needs migration)
- Legacy endpoints that may still reference public schema data

## Phase 1: Current Implementation (COMPLETED)

### Actions Taken:
1. **Fixed test data issues** - Updated organizationId for test shows
2. **Cleaned up incorrect data** - Removed shows from wrong schemas
3. **Documented legacy state** - This document
4. **Verified new data flow** - All new data goes to organization schemas

### Verification:
- New shows created via UI go to organization schemas ✅
- Shows API queries organization schemas ✅
- Metrics API uses organization schemas ✅
- No new data being added to public schema tables ✅

## Phase 2: API Migration (COMPLETED - 2025-07-20)

### Actions Taken:
1. **Updated Episodes API** - Converted to use `querySchema` and organization schemas ✅
   - GET /api/episodes - Lists episodes from org schema
   - POST /api/episodes - Creates episodes in org schema
   - GET/PUT/DELETE /api/episodes/[episodeId] - All use org schema
2. **Verified other APIs** - Confirmed no other APIs use Prisma directly for business data ✅
3. **Data Migration Status** - All 778 legacy episodes already exist in org schema ✅

### Current State:
- Episodes API fully migrated to organization schemas
- All business data APIs (shows, episodes, campaigns) use org schemas
- Legacy data remains in public schema but is not used
- No data corruption or loss

## Phase 3: Schema Cleanup (FUTURE)

### Remaining Tasks:
- [ ] Drop legacy tables from public schema (after thorough testing)
- [ ] Update Prisma schema to remove public schema business models
- [ ] Remove any remaining references to public schema tables
- [ ] Archive legacy data before deletion

## Important Notes

1. **DO NOT** manually delete public schema tables until Phase 2 is complete
2. **All new data** must use organization schemas via `querySchema`
3. **Legacy data** is read-only - no updates should be made to public schema data
4. **Test thoroughly** before removing any public schema tables

## Monitoring

To verify no new data is being added to public schema:
```sql
-- Check for recent data in public schema (should be empty)
SELECT 'Show' as table_name, MAX("createdAt") as last_created 
FROM public."Show"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'Episode', MAX("createdAt") 
FROM public."Episode"
WHERE "createdAt" > NOW() - INTERVAL '7 days';
```

## Migration Timeline
- Phase 1: ✅ Completed 2025-07-20 - Documentation and verification
- Phase 2: ✅ Completed 2025-07-20 - API migration to org schemas
- Phase 3: Planned for future sprint (priority: low) - Schema cleanup