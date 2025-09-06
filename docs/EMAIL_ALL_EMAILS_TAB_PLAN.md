# All Emails Tab Implementation Plan

## Overview
Add a new "All Emails" tab to the Email Analytics page that displays all emails sent for the current organization with advanced filtering, sorting, and search capabilities.

## Current State Analysis

### EmailLog Table Structure
- Located in public schema
- Has `metadata` JSON field that can store entity references
- Currently not linked to business entities (Campaign, Advertiser, Agency)

### Business Entity Locations
- **Seller**: User table (public schema) with role='sales'
- **Advertiser**: In tenant schemas (org_*)
- **Agency**: In tenant schemas (org_*)
- **Campaign**: In tenant schemas (org_*)

## Implementation Strategy

### Phase 1: Update Email Sending to Include Metadata

When emails are sent from the application, we need to include entity context in the metadata field:

```typescript
// Example when sending campaign-related email
await sendEmail({
  to: recipient,
  subject: 'Campaign Update',
  template: 'campaign_update',
  metadata: {
    campaignId: campaign.id,
    campaignName: campaign.name,
    advertiserId: campaign.advertiserId,
    advertiserName: advertiser.name,
    agencyId: campaign.agencyId,
    agencyName: agency?.name,
    sellerId: campaign.salesUserId,
    sellerName: seller.name,
    sellerEmail: seller.email
  }
})
```

### Phase 2: Create New API Endpoint

Create `/api/email/all-emails` endpoint that:
1. Queries EmailLog with organization filter
2. Extracts entity information from metadata
3. Supports pagination, sorting, and search
4. Returns enriched email data

### Phase 3: Frontend Implementation

Add new tab to EmailAnalyticsDashboard:
1. "All Emails" tab with data table
2. Search bar for subject/body search
3. Column sorting (Seller, Advertiser, Agency, Date)
4. Pagination controls
5. Export functionality

### Phase 4: Testing

1. Unit tests for API endpoint
2. Integration tests for org isolation
3. Frontend component tests
4. E2E tests for full flow

## API Design

### Endpoint: GET /api/email/all-emails

#### Query Parameters
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 25, max: 100)
- `search` (string): Search in subject/body
- `sortBy` (string): Column to sort by (seller, advertiser, agency, date)
- `sortOrder` (string): asc/desc (default: desc)
- `dateFrom` (string): Start date filter
- `dateTo` (string): End date filter

#### Response
```json
{
  "emails": [
    {
      "id": "email-id",
      "toEmail": "recipient@example.com",
      "fromEmail": "sender@podcastflow.pro",
      "subject": "Campaign Update",
      "status": "delivered",
      "sentAt": "2025-01-27T10:00:00Z",
      "openedAt": "2025-01-27T10:30:00Z",
      "clickedAt": null,
      "seller": {
        "id": "user-id",
        "name": "John Doe",
        "email": "john@podcastflow.pro"
      },
      "advertiser": {
        "id": "advertiser-id",
        "name": "Acme Corp"
      },
      "agency": {
        "id": "agency-id",
        "name": "Creative Agency"
      },
      "campaign": {
        "id": "campaign-id",
        "name": "Q1 2025 Campaign"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150,
    "pages": 6
  }
}
```

## Frontend Design

### All Emails Tab Component Structure
```typescript
interface AllEmailsTabProps {
  organizationId: string
}

interface EmailRecord {
  id: string
  toEmail: string
  subject: string
  status: string
  sentAt: string
  openedAt?: string
  clickedAt?: string
  seller?: {
    id: string
    name: string
    email: string
  }
  advertiser?: {
    id: string
    name: string
  }
  agency?: {
    id: string
    name: string
  }
}
```

### Features
1. **Search Bar**: Debounced search input
2. **Sortable Columns**: Click headers to sort
3. **Status Indicators**: Visual status badges
4. **Engagement Tracking**: Open/click indicators
5. **Pagination**: Next.js-style pagination
6. **Export**: CSV export of filtered results

## Security Considerations

1. **Organization Isolation**: Always filter by session.organizationId
2. **SQL Injection Prevention**: Use parameterized queries
3. **Search Sanitization**: Escape special characters
4. **Rate Limiting**: Limit API calls to prevent abuse
5. **Data Validation**: Validate all query parameters

## Performance Optimizations

1. **Indexes**: Ensure proper indexes on EmailLog table
2. **Pagination**: Limit results to prevent large payloads
3. **Caching**: Cache frequently accessed data
4. **Debouncing**: Debounce search input
5. **Lazy Loading**: Load data as needed

## Migration Strategy

### Step 1: Backward Compatibility
- New feature doesn't affect existing functionality
- Emails without metadata show empty entity fields
- Gradual adoption as new emails include metadata

### Step 2: Historical Data Enhancement
- Optional script to backfill metadata for existing emails
- Match emails to entities based on timestamps and recipients

### Step 3: Future Improvements
- Direct foreign keys when EmailLog moves to tenant schemas
- Advanced filtering by multiple entities
- Saved filter presets

## Testing Plan

### Unit Tests
1. API endpoint with various filters
2. Organization isolation verification
3. Search functionality
4. Sorting logic
5. Pagination edge cases

### Integration Tests
1. Full API flow with database
2. Multi-tenant isolation
3. Performance with large datasets

### E2E Tests
1. Tab navigation
2. Search and filter interaction
3. Sort functionality
4. Pagination navigation
5. Export functionality

## Documentation Updates

1. **API Documentation**: Document new endpoint
2. **User Guide**: How to use All Emails tab
3. **Developer Guide**: How to include metadata when sending emails
4. **Testing Guide**: How to test the feature

## Rollout Plan

1. **Phase 1**: Deploy API endpoint (feature flagged)
2. **Phase 2**: Deploy frontend (hidden tab)
3. **Phase 3**: Update email sending to include metadata
4. **Phase 4**: Enable for beta users
5. **Phase 5**: General availability

## Success Metrics

1. **Performance**: Page load < 2 seconds
2. **Search**: Results < 500ms
3. **Accuracy**: 100% org isolation
4. **Adoption**: 50% of users use within first month
5. **Satisfaction**: Positive user feedback