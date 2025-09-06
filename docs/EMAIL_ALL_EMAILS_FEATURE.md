# All Emails Tab - Email Analytics Feature Documentation

## Overview
The All Emails tab is a comprehensive email history viewer within the Email Analytics section that allows administrators to view, search, sort, and export all emails sent through the PodcastFlow Pro platform.

## Features

### 1. Email List View
- Displays all non-system emails sent from the organization
- Shows key information: recipient, subject, date sent, status
- Real-time status indicators (sent, delivered, opened, clicked, bounced, etc.)
- Pagination with 25-50 emails per page

### 2. Search Functionality
- Full-text search across email subjects and recipient addresses
- Case-insensitive partial matching
- Debounced search (500ms) to optimize performance
- Search persists across pagination

### 3. Sorting Capabilities
- Sort by date (newest/oldest first)
- Sort by subject (A-Z/Z-A)
- Sort by status
- Default sort: newest emails first

### 4. Email Metadata Display
- **Seller Information**: Name and email of the sales representative
- **Advertiser**: Company receiving the advertising services
- **Agency**: Agency representing the advertiser (if applicable)
- **Campaign**: Associated campaign name
- All metadata extracted from the email's metadata field

### 5. Export Functionality
- Export filtered results to CSV format
- Includes all visible columns plus additional metadata
- Filename includes export date for easy tracking
- CSV properly escapes special characters

### 6. Organization Isolation
- Strict data isolation by organization
- No cross-organization data exposure
- System emails (password reset, verification) excluded
- Master role access logged for compliance

## Technical Implementation

### API Endpoints

#### GET /api/email/all-emails
Retrieves paginated email list with filtering options.

**Query Parameters:**
- `page` (number): Page number (1-based)
- `limit` (number): Items per page (default: 25)
- `search` (string): Search term for subject/recipient
- `sortBy` (string): Field to sort by (date, subject, status)
- `sortOrder` (string): Sort direction (asc, desc)

**Response:**
```json
{
  "emails": [
    {
      "id": "string",
      "toEmail": "string",
      "subject": "string",
      "status": "string",
      "sentAt": "datetime",
      "openedAt": "datetime",
      "clickedAt": "datetime",
      "seller": {
        "name": "string",
        "email": "string"
      },
      "advertiser": "string",
      "agency": "string",
      "campaign": "string"
    }
  ],
  "pagination": {
    "total": "number",
    "page": "number",
    "limit": "number",
    "pages": "number"
  }
}
```

#### GET /api/email/all-emails/export
Exports filtered emails to CSV format.

**Query Parameters:**
- Same as all-emails endpoint plus:
- `dateFrom` (string): Start date filter
- `dateTo` (string): End date filter
- `format` (string): Export format (currently only CSV)

### Frontend Components

#### AllEmailsTab Component
Location: `/src/components/email/AllEmailsTab.tsx`

**Features:**
- Material-UI DataTable with custom toolbar
- Search input with debouncing
- Sortable columns
- Pagination controls
- Export button
- Loading and error states

#### useDebounce Hook
Location: `/src/hooks/useDebounce.ts`

Custom hook for debouncing search input to reduce API calls.

### Database Schema

The feature uses the existing `EmailLog` table with enhanced metadata storage:

```prisma
model EmailLog {
  id              String    @id @default(cuid())
  organizationId  String
  userId          String?
  toEmail         String
  fromEmail       String
  subject         String?
  templateKey     String?
  status          String
  metadata        Json?     // Stores entity relationships
  sentAt          DateTime?
  openedAt        DateTime?
  clickedAt       DateTime?
  // ... other fields
}
```

### Metadata Structure
When emails are sent, the following metadata should be included:

```javascript
metadata: {
  campaignId: "string",
  campaignName: "string",
  advertiserId: "string",
  advertiserName: "string",
  agencyId: "string",
  agencyName: "string",
  sellerId: "string",
  sellerName: "string",
  sellerEmail: "string"
}
```

## Security Considerations

### Organization Isolation
- All queries filtered by `organizationId`
- No direct ID access across organizations
- System emails excluded from all queries

### Access Control
- Feature restricted to admin and master roles
- Session validation on all endpoints
- Master cross-org access logged

### Data Protection
- No sensitive email content exposed
- Email bodies not stored or displayed
- Only metadata and headers shown

## Usage Guide

### For Administrators

1. **Accessing the Feature**
   - Navigate to Admin → Email Analytics
   - Click on "All Emails" tab

2. **Searching Emails**
   - Enter search term in the search box
   - Results update automatically after typing stops
   - Search includes subject lines and recipient emails

3. **Sorting Results**
   - Click column headers to sort
   - Click again to reverse sort order
   - Sort indicator shows current sort column/direction

4. **Exporting Data**
   - Click "Export" button in toolbar
   - CSV file downloads automatically
   - File includes all current filters/search

### For Developers

1. **Adding Metadata to New Email Types**
   ```javascript
   await emailService.sendEmail({
     to: recipient,
     subject: subject,
     html: emailHtml,
     organizationId: organizationId,
     metadata: {
       // Include relevant entity information
       campaignId: campaign.id,
       campaignName: campaign.name,
       // ... etc
     }
   })
   ```

2. **Extending the Feature**
   - Add new columns: Update API response and frontend table
   - Add filters: Extend WHERE clause in API
   - Add new export formats: Implement in export endpoint

## Testing

### Unit Tests
- Organization isolation tests: `/src/test/email/all-emails-isolation.test.ts`
- Verifies strict data separation
- Tests search and filtering
- Validates metadata extraction

### Manual Testing Checklist
- [ ] Search returns relevant results
- [ ] Sort works for all columns
- [ ] Pagination maintains search/sort
- [ ] Export includes filtered results
- [ ] No cross-org data visible
- [ ] Loading states display correctly
- [ ] Error handling works properly

## Troubleshooting

### Common Issues

1. **Missing Seller/Entity Information**
   - Check if email was sent with metadata
   - Verify metadata structure matches expected format
   - For older emails, metadata may not be available

2. **Search Not Working**
   - Ensure search term is at least 2 characters
   - Check browser console for API errors
   - Verify database indexes are created

3. **Export Failing**
   - Check browser download settings
   - Verify user has admin permissions
   - Check server logs for memory issues with large exports

## Future Enhancements

1. **Advanced Filtering**
   - Date range filters
   - Status filters
   - Entity-specific filters (by advertiser, agency, etc.)

2. **Email Preview**
   - Modal to view email details
   - Template preview
   - Delivery timeline

3. **Bulk Operations**
   - Resend failed emails
   - Bulk status updates
   - Bulk export by criteria

4. **Analytics Integration**
   - Click-through rates by entity
   - Engagement metrics
   - Delivery performance trends

## Maintenance

### Regular Tasks
- Monitor query performance as data grows
- Review and archive old email logs
- Update metadata structure as needed
- Maintain database indexes

### Performance Optimization
- Email logs older than 90 days could be archived
- Consider pagination limits for large organizations
- Add database indexes on frequently searched fields
- Implement caching for common queries