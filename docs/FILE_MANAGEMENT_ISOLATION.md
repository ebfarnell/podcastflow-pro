# File Management Organization Isolation

## Overview

The PodcastFlow Pro file management system implements strict organization-level data isolation. This ensures that files uploaded by one organization are completely inaccessible to users from any other organization, maintaining data privacy and security in our multi-tenant SaaS platform.

## Database Schema

### UploadedFile Table

```sql
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,  -- CRITICAL: Links file to organization
    "originalName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL UNIQUE,
    "s3Url" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT
);
```

### Key Indexes for Performance

- `organizationId` - Fast filtering by organization
- `uploadedById` - Fast filtering by uploader
- `category` - Fast filtering by file type
- `status` - Fast filtering for active/deleted files
- `s3Key` - Unique constraint prevents duplicate uploads

## API Endpoints

All file management endpoints enforce organization isolation:

### POST /api/upload/documents
- **Isolation**: Automatically assigns `session.organizationId` to uploaded files
- **S3 Path**: Files stored at `uploads/{organizationId}/{category}/{fileName}`
- **Access**: Only authenticated users can upload files to their organization

### GET /api/upload/documents
- **Isolation**: WHERE clause always includes `organizationId = session.organizationId`
- **Filters**: Additional filters (category, entityType) are AND'ed with org filter
- **Pagination**: Organization-scoped pagination

### GET /api/files/[id]
- **Isolation**: Query includes both `id` AND `organizationId = session.organizationId`
- **Response**: 404 if file doesn't exist OR belongs to different organization
- **Security**: Generates time-limited presigned URLs for S3 access

### PUT /api/files/[id]
- **Isolation**: Update query includes `organizationId = session.organizationId`
- **Response**: 404 if file doesn't exist OR belongs to different organization
- **Allowed Updates**: description, entityType, entityId only

### DELETE /api/files/[id]
- **Isolation**: First queries with `organizationId = session.organizationId`
- **Soft Delete**: Sets status to 'deleted' rather than hard delete
- **S3 Cleanup**: Attempts to delete from S3 but continues if it fails

## Code Examples

### Uploading a File

```typescript
// Frontend component
const formData = new FormData()
formData.append('file', selectedFile)
formData.append('category', 'document')
formData.append('description', 'Quarterly report')

const response = await fetch('/api/upload/documents', {
  method: 'POST',
  body: formData
})

// Backend automatically assigns organizationId from session
const fileRecord = await prisma.uploadedFile.create({
  data: {
    organizationId: session.organizationId, // Automatic from session
    uploadedById: session.userId,
    // ... other fields
  }
})
```

### Fetching Files

```typescript
// Always filtered by organization
const files = await prisma.uploadedFile.findMany({
  where: {
    organizationId: session.organizationId, // REQUIRED
    status: 'active',
    category: 'document' // Optional additional filter
  }
})
```

### Accessing Specific File

```typescript
// Must match both ID and organization
const file = await prisma.uploadedFile.findFirst({
  where: {
    id: fileId,
    organizationId: session.organizationId // CRITICAL
  }
})

if (!file) {
  return new Response('File not found', { status: 404 })
}
```

## Security Patterns

### 1. Session-Based Organization Filtering

Every API endpoint starts with:
```typescript
const session = await getSessionFromCookie(request)
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// session.organizationId is used in ALL queries
```

### 2. Double-Check Pattern

For destructive operations (update/delete), we:
1. First fetch with organization filter to verify ownership
2. Only then perform the operation
3. Return 404 for both "not found" and "wrong org" (no information leak)

### 3. S3 Path Isolation

Files are stored with organization-specific paths:
```
uploads/{organizationId}/{category}/{fileName}
```

This provides an additional layer of isolation at the storage level.

### 4. Soft Deletes

Files are marked as 'deleted' rather than removed from the database, maintaining audit trails while excluding them from normal queries.

## Testing Organization Isolation

### Unit Tests

Located in `/src/test/file-isolation.test.ts`:
- Tests that files can only be accessed within the same organization
- Verifies cross-organization access attempts fail
- Ensures update/delete operations respect organization boundaries

### Integration Tests

Located in `/src/test/api/file-api-isolation.test.ts`:
- Tests actual API endpoints with mock sessions
- Verifies 404 responses for cross-org access
- Tests edge cases and security scenarios

### Manual Testing Checklist

1. **Multi-Org Test**:
   - Create 2 test organizations
   - Upload files to each
   - Verify complete isolation

2. **Direct Access Test**:
   - Get file ID from Org A
   - Login as Org B user
   - Try direct access - should fail

3. **Search Test**:
   - Upload similar files to different orgs
   - Verify search results are org-specific

## Migration Guide

If you have existing files without organization isolation:

1. **Add organizationId to existing records**:
```sql
-- Assuming you can derive org from uploadedBy user
UPDATE "UploadedFile" f
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE f."uploadedById" = u.id
AND f."organizationId" IS NULL;
```

2. **Add NOT NULL constraint**:
```sql
ALTER TABLE "UploadedFile" 
ALTER COLUMN "organizationId" SET NOT NULL;
```

3. **Update S3 paths** (if needed):
   - Create migration script to move files to org-specific paths
   - Update s3Key and s3Url in database

## Best Practices

1. **Always use session.organizationId** - Never accept organizationId from request body
2. **Return 404 for both cases** - Don't differentiate between "not found" and "wrong org"
3. **Use Prisma's type safety** - Let TypeScript catch missing organizationId
4. **Test with multiple orgs** - Always test features with at least 2 organizations
5. **Monitor access patterns** - Log suspicious access attempts for security review

## Common Pitfalls to Avoid

1. **Forgetting organization filter**: Always include organizationId in WHERE clause
2. **Accepting org from client**: Organization must come from authenticated session
3. **Leaking information**: Use generic 404 for all not-found/not-authorized cases
4. **Hard deletes**: Use soft deletes to maintain audit trail
5. **Missing indexes**: Ensure organizationId is indexed for performance

## Monitoring and Auditing

Consider implementing:
- Access logs for file operations
- Alerts for cross-org access attempts
- Regular audits of file access patterns
- Metrics on file usage per organization

## Future Enhancements

Potential improvements to consider:
- File sharing between organizations (with explicit permissions)
- File versioning with organization isolation
- Bulk operations with organization safety checks
- Organization-level storage quotas
- Automated file expiration policies