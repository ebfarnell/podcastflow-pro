# Email Detail and Thread View Feature Documentation

## Overview
The Email Detail and Thread View feature enhances the All Emails tab by allowing administrators to click on any email row to view comprehensive email details, including full content, attachments, and conversation threads.

## Features

### 1. Email Detail View
- **Clickable Rows**: Each email in the All Emails tab is clickable
- **Modal Display**: Opens in a non-blocking modal dialog
- **Comprehensive Information**:
  - Subject, sender, recipients (To, CC, BCC)
  - Date sent and delivery timestamps
  - HTML-rendered email body
  - Status indicators (sent, delivered, opened, clicked, bounced)
  - Business context (Seller, Advertiser, Agency, Campaign)
  - Metadata and additional fields

### 2. Thread/Conversation View
- **Automatic Thread Detection**: Identifies emails in the same conversation using `threadId` or `conversationId` in metadata
- **Thread Navigation**: 
  - Separate tab for thread view
  - List of all emails in the thread with timestamps
  - Click any email in the thread to view its details
  - Current email highlighted in the thread list
- **Thread Ordering**: Emails displayed chronologically (oldest first)

### 3. Attachment Support
- **Secure Downloads**: S3 presigned URLs with 1-hour expiration
- **File Information**: Filename, size, MIME type
- **Download Button**: Direct download with original filename
- **Organization Isolation**: Only shows attachments belonging to the current organization

### 4. Security & Data Isolation
- **Strict Organization Filtering**: All queries enforce `organizationId`
- **No Cross-Org Access**: Emails and attachments isolated by organization
- **Admin/Master Only**: Feature restricted to admin and master roles
- **Session Validation**: All endpoints validate user sessions

## Technical Implementation

### API Endpoints

#### GET /api/email/[id]
Fetches detailed information for a single email.

**Response Structure:**
```json
{
  "id": "string",
  "toEmail": "string",
  "fromEmail": "string",
  "subject": "string",
  "status": "string",
  "sentAt": "datetime",
  "deliveredAt": "datetime",
  "openedAt": "datetime",
  "clickedAt": "datetime",
  "bouncedAt": "datetime",
  "bounceType": "string",
  "bounceReason": "string",
  "seller": {
    "name": "string",
    "email": "string"
  },
  "advertiser": "string",
  "agency": "string",
  "campaign": "string",
  "threadId": "string",
  "body": {
    "html": "string",
    "text": "string",
    "cc": ["string"],
    "bcc": ["string"]
  },
  "attachments": [
    {
      "id": "string",
      "originalName": "string",
      "fileSize": "number",
      "mimeType": "string",
      "downloadUrl": "string"
    }
  ],
  "metadata": {}
}
```

#### GET /api/email/[id]/thread
Fetches all emails in the same thread/conversation.

**Response Structure:**
```json
{
  "threadId": "string",
  "emails": [
    {
      "id": "string",
      "toEmail": "string",
      "fromEmail": "string",
      "subject": "string",
      "status": "string",
      "sentAt": "datetime",
      "isCurrentEmail": "boolean"
    }
  ],
  "total": "number"
}
```

### Frontend Components

#### EmailDetailModal
Location: `/src/components/email/EmailDetailModal.tsx`

**Features:**
- Two-tab interface (Email Content, Thread)
- Full email rendering with HTML support
- Business context display
- Attachment list with download buttons
- Thread navigation sidebar

#### EmailThreadView
Location: `/src/components/email/EmailThreadView.tsx`

**Features:**
- Displays single email details within thread context
- Reusable component for thread email viewing
- Consistent formatting with main email view

### Database Schema Usage

#### EmailLog Table
- Primary email record storage
- `metadata` JSON field stores:
  - `threadId` or `conversationId` for thread grouping
  - Business entity references (campaignId, advertiserId, etc.)
  - Additional context data

#### Email Table
- Stores full email content (HTML/text body)
- Referenced via `metadata.emailId` in EmailLog

#### UploadedFile Table
- Stores attachment information
- Linked to emails via:
  - `entityType = 'email'`
  - `entityId = emailLogId`

## Implementation Guide

### Adding Thread Support to Emails

When sending emails, include thread information in metadata:

```javascript
await emailService.sendEmail({
  to: recipient,
  subject: subject,
  html: emailHtml,
  organizationId: organizationId,
  metadata: {
    threadId: threadId, // Use consistent ID for all emails in thread
    // or
    conversationId: conversationId,
    // ... other metadata
  }
})
```

### Linking Attachments to Emails

After uploading a file, link it to the email:

```javascript
await prisma.uploadedFile.create({
  data: {
    organizationId: organizationId,
    entityType: 'email',
    entityId: emailLogId,
    // ... other file data
  }
})
```

## Usage Guide

### For Administrators

1. **Viewing Email Details**
   - Navigate to Admin → Email Analytics → All Emails
   - Click any email row to open details
   - View full email content, metadata, and attachments

2. **Navigating Threads**
   - If email is part of a thread, click "Thread" tab
   - Click any email in the thread list to view it
   - Current email is highlighted in the list

3. **Downloading Attachments**
   - Click download button next to any attachment
   - File downloads with original filename
   - Links expire after 1 hour for security

### For Developers

1. **Testing Thread Features**
   ```bash
   npm test src/test/email/email-detail-thread.test.ts
   ```

2. **Adding New Metadata Fields**
   - Update EmailDetail interface in components
   - Add fields to API response
   - Update documentation

## Performance Considerations

### Optimizations Implemented
- Lazy loading of email bodies
- Separate API calls for thread data
- Presigned URLs generated on-demand
- Query optimization with proper indexes

### Handling Large Threads
- Frontend displays all emails in thread (up to reasonable limit)
- Consider pagination for threads > 50 emails
- Thread list uses virtual scrolling for performance

## Security Best Practices

### Organization Isolation
```javascript
// Always filter by organizationId
const email = await prisma.emailLog.findFirst({
  where: {
    id: emailId,
    organizationId: session.organizationId // Critical
  }
})
```

### Attachment Security
- S3 presigned URLs expire after 1 hour
- URLs include secure signatures
- Direct S3 access bypasses application server

## Troubleshooting

### Common Issues

1. **Email Details Not Loading**
   - Check browser console for API errors
   - Verify user has admin/master role
   - Ensure email exists in database

2. **Thread Not Showing**
   - Verify emails have threadId/conversationId in metadata
   - Check that all thread emails belong to same organization
   - Ensure consistent thread ID across emails

3. **Attachments Not Downloading**
   - Check S3 bucket permissions
   - Verify AWS credentials in environment
   - Ensure attachment record exists in database

4. **Missing Email Body**
   - Check if Email record exists (via metadata.emailId)
   - Verify email content was stored when sent
   - Some emails may only have metadata without body

## Future Enhancements

1. **Reply/Forward Functionality**
   - Add buttons to reply or forward emails
   - Maintain thread context in new emails

2. **Advanced Thread Features**
   - Thread search and filtering
   - Collapse/expand thread messages
   - Thread-level actions (archive, mark as read)

3. **Email Preview**
   - Thumbnail previews for image attachments
   - Inline attachment viewing
   - PDF preview without download

4. **Performance Improvements**
   - Virtual scrolling for large threads
   - Cached presigned URLs
   - Progressive email body loading

## Edge Cases Handled

1. **Emails Without Threads**
   - Single email displayed without thread tab
   - Thread API returns single-item array

2. **Missing Metadata**
   - Graceful fallbacks for missing fields
   - Empty states for missing business context

3. **Large Attachments**
   - File size formatting (KB, MB, GB)
   - Download progress indicators (future)

4. **Deleted Attachments**
   - Only shows active attachments (status = 'active')
   - Handles S3 deletion failures gracefully

## Testing Checklist

- [x] Click email row opens detail modal
- [x] Email details display correctly
- [x] Thread tab appears for threaded emails
- [x] Thread navigation works properly
- [x] Attachments download successfully
- [x] Organization isolation enforced
- [x] Error states handled gracefully
- [x] Performance acceptable for large threads
- [x] Security: no cross-org data exposure