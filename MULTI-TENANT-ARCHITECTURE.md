# PodcastFlow Pro - Multi-Tenant Architecture Documentation

## Overview
PodcastFlow Pro now implements complete data isolation using PostgreSQL schemas. Each organization's data is stored in its own schema, providing true isolation, security, and independent backup/restore capabilities.

## Architecture Design

### Schema Structure
- **Public Schema**: Shared system tables (users, organizations, sessions, billing plans)
- **Organization Schemas**: `org_{slug}` format (e.g., `org_podcastflow_pro`, `org_unfy`)
  - Each contains ~40 tables specific to that organization
  - Complete isolation from other organizations

### Tables Per Organization Schema
1. **Core Business Data**
   - Campaign, Show, Episode, Agency, Advertiser
   - AdApproval, AdCreative, SpotSubmission
   
2. **Financial Data**
   - Order, OrderItem, Invoice, InvoiceItem, Payment
   - Contract, ContractLineItem, Expense
   - BudgetCategory, BudgetEntry

3. **Analytics & Metrics**
   - CampaignAnalytics, EpisodeAnalytics, ShowAnalytics
   - AnalyticsEvent, ShowMetrics, UsageRecord

4. **Content & Workflow**
   - Comment, EpisodeSpot, CreativeUsage
   - Reservation, ReservationItem, BlockedSpot
   - Inventory, ShowPlacement, CampaignSchedule

5. **Integrations**
   - MegaphoneIntegration, QuickBooksIntegration
   - Related sync and data tables

## Implementation Details

### Database Connection (`/src/lib/db/schema-db.ts`)
```typescript
// Get schema name from organization
export function getSchemaName(orgSlug: string): string {
  const sanitized = orgSlug.toLowerCase().replace(/-/g, '_')
  return `org_${sanitized}`
}

// Query specific schema
export async function querySchema<T>(
  orgSlug: string,
  query: string,
  params?: any[]
): Promise<T[]>

// Schema-aware models
export const SchemaModels = {
  campaign: { findMany, findUnique, create, update, delete },
  show: { findMany, findUnique, create },
  advertiser: { findMany, findUnique, create },
  // ... more models
}
```

### API Updates
All API endpoints now use schema-based queries:
```typescript
// Get organization context
const orgSlug = await getUserOrgSlug(user.id)

// Query organization-specific data
const campaigns = await SchemaModels.campaign.findMany(orgSlug, where, options)
```

### New Organization Setup (`/src/lib/organizations/org-setup.ts`)
```typescript
export async function createOrganizationWithSchema(data: CreateOrganizationData) {
  // 1. Create organization in public schema
  // 2. Create schema and all tables for the organization
  // 3. Return success
}
```

### Organization Data Export (`/api/organizations/[id]/export`)
- Exports complete schema data as SQL dump
- Includes metadata and import instructions
- Returns compressed `.tar.gz` file
- Available to admin and master users

### Master Account Aggregation
Master APIs aggregate data across all schemas:
```typescript
const allCampaigns = await queryAllSchemas(async (orgSlug) => {
  return SchemaModels.campaign.findMany(orgSlug, where)
})
```

## Migration Process

### Initial Migration (`multi-tenant-complete-migration.sql`)
1. Creates complete schema for each existing organization
2. Creates all 40+ tables in each schema
3. Migrates existing data (if any)
4. Creates master views for aggregation

### Running the Migration
```bash
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production -f multi-tenant-complete-migration.sql
```

## Security Benefits

1. **Complete Data Isolation**: Each organization's data is physically separated
2. **No Cross-Contamination**: Corrupted data in one org cannot affect others
3. **Schema-Level Permissions**: Can grant database access per schema
4. **Independent Backups**: Each organization can be backed up separately

## Operational Benefits

1. **Easy Backup/Restore**: Export single schema for organization
2. **Performance**: No need to filter by organizationId in queries
3. **Scalability**: Schemas can be moved to different servers
4. **Compliance**: Data residency requirements easier to meet

## Usage Examples

### Creating a New Organization
```typescript
import { createOrganizationWithSchema } from '@/lib/organizations/org-setup'

const result = await createOrganizationWithSchema({
  name: 'New Company',
  slug: 'new-company',
  email: 'admin@newcompany.com',
  plan: 'professional'
})
```

### Exporting Organization Data
```typescript
// Frontend component
<ExportDataButton 
  organizationId={org.id} 
  organizationName={org.name} 
/>

// API call
GET /api/organizations/{id}/export
```

### Querying Organization Data
```typescript
// In API route
const orgSlug = await getUserOrgSlug(user.id)
const campaigns = await SchemaModels.campaign.findMany(orgSlug, {
  status: 'active'
})
```

## Monitoring & Maintenance

### Check Schema Status
```sql
-- List all organization schemas
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name LIKE 'org_%';

-- Count tables per schema
SELECT table_schema, COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema LIKE 'org_%'
GROUP BY table_schema;
```

### Manual Schema Creation
```sql
-- For new organization
SELECT create_complete_org_schema('company-slug', 'org-id-here');
```

## Current Status
- ✅ Schemas created for: `podcastflow-pro`, `unfy`
- ✅ 40 tables per organization schema
- ✅ Export functionality implemented
- ✅ Master aggregation working
- ✅ Campaign API updated to use schemas
- ✅ Analytics API aggregates across schemas

## Next Steps
1. Update remaining API endpoints to use schema approach
2. Add automated tests for multi-tenant isolation
3. Implement cross-schema query optimization
4. Add schema migration tooling for updates
5. Create admin UI for organization management

## Important Notes
- Always use `SchemaModels` for organization data
- Never query organization tables directly from public schema
- Master account uses aggregation views and functions
- Each schema is self-contained with all necessary tables
- **File Management**: UploadedFile table is in the public schema with strict organizationId isolation (see `/docs/FILE_MANAGEMENT_ISOLATION.md`)