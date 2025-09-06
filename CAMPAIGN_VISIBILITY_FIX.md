# Campaign Visibility Fix - July 18, 2025

## Issue
Campaigns were not showing up on the campaigns page even though they existed in the database.

## Root Cause
The application uses a multi-tenant architecture with PostgreSQL schemas:
- Each organization has its own schema (e.g., `org_podcastflow_pro`, `org_unfy`)
- The campaigns API was looking for data in organization-specific schemas
- Our test data was created in the `public` schema instead of the organization schemas

## Solution
Migrated all campaign-related data from the public schema to the organization-specific schemas:

1. **Campaigns**: 6 campaigns migrated to `org_podcastflow_pro`
2. **Agencies**: 3 agencies migrated
3. **Advertisers**: 3 advertisers migrated
4. **Shows**: 4 shows migrated
5. **Orders**: 6 orders migrated
6. **Order Items**: 7 order items migrated
7. **Contracts**: 3 contracts migrated
8. **Ad Approvals**: 9 ad approvals migrated

## Files Created
- `/home/ec2-user/podcastflow-pro/migrate_campaigns_to_schema.sql` - Main migration script
- `/home/ec2-user/podcastflow-pro/migrate_advertisers.sql` - Fixed advertiser migration

## Result
✅ Campaigns now appear correctly on the campaigns page
✅ All related data is properly isolated in organization schemas
✅ Multi-tenant architecture is functioning as designed

## Note on KPIs
The `CampaignKPI` table remains in the public schema as it's designed to be managed at the platform level, not per organization. The KPI system will continue to work correctly with this architecture.