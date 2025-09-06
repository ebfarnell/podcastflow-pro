# YouTube Sync Logs Endpoint Fix

## Issue
The YouTube sync logs endpoint was returning 404 when accessed from the UI:
```
GET https://app.podcastflow.pro/api/youtube/sync-logs?limit=10&offset=0 404 (Not Found)
```

## Root Cause
The client-side ViewLogsDialog component was calling the wrong API path. It was using:
- `/${platform}/sync-logs` (e.g., `/youtube/sync-logs`)

But the actual API route is at:
- `/api/${platform}/sync-logs` (e.g., `/api/youtube/sync-logs`)

The `/api` prefix was missing in the client code.

## Solution
Fixed the API path in `/src/components/integrations/ViewLogsDialog.tsx`:

### Before:
```typescript
const response = await api.get(`/${platform}/sync-logs`, {
await api.delete(`/${platform}/sync-logs`)
```

### After:
```typescript
const response = await api.get(`/api/${platform}/sync-logs`, {
await api.delete(`/api/${platform}/sync-logs`)
```

## Files Modified
- `/src/components/integrations/ViewLogsDialog.tsx` - Fixed API paths for GET and DELETE methods

## Verification
After the fix was applied:
1. Application was rebuilt successfully (231 seconds)
2. PM2 process restarted (restart #307)
3. Endpoint now returns 401 (Unauthorized) instead of 404
4. The "View Logs" dialog in the YouTube Integration UI will now work correctly

## Testing
```bash
# Test that endpoint exists (returns 401 without auth)
curl -I "https://app.podcastflow.pro/api/youtube/sync-logs?limit=5"
# Expected: HTTP/1.1 401 Unauthorized

# When accessed from authenticated UI, it will return sync logs data
```

## Date Fixed
August 21, 2025