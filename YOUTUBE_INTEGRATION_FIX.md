# YouTube Integration API Fix

## Issue Resolved: August 19, 2025

### Problem
When saving YouTube fields in the Show settings page, the API returned a 500 error:
```
PUT https://app.podcastflow.pro/api/shows/[id] 500 (Internal Server Error)
Error: column "pricingModel" of relation "Show" does not exist
```

### Root Cause
The Show API route (`/api/shows/[id]/route.ts`) was attempting to update fields that don't exist in the database:
- Monetization fields (pricingModel, CPM rates, slot counts, etc.)
- These fields were referenced in the code but never added to the Show table
- The actual pricing data is stored in a separate `ShowRateCard` table

### Solution Applied
1. **Commented out non-existent fields in the PUT handler** (lines 271-318)
   - All monetization field updates are now disabled
   - YouTube fields remain functional

2. **Commented out non-existent fields in the GET response** (lines 176-195)
   - Prevents returning undefined values
   - Keeps revenue sharing fields that do exist

3. **Build and Deployment**
   - Build completed in 217 seconds
   - PM2 restarted (restart #179)
   - Application health verified

### YouTube Fields That ARE Working
The following YouTube fields were successfully added to the database and are now functional:
- `youtubeChannelUrl` - URL to YouTube channel/podcast page
- `youtubeChannelId` - YouTube channel identifier
- `youtubeChannelName` - Channel display name
- `youtubePlaylistId` - Playlist ID for episodes
- `youtubeSyncEnabled` - Toggle for sync functionality
- `youtubeAutoCreateEpisodes` - Toggle for auto-creating episodes
- `youtubeLastSyncAt` - Timestamp of last sync

### How to Use YouTube Integration
1. Navigate to Shows list
2. Click edit on any show
3. Scroll to "YouTube Integration" section
4. Enter YouTube channel URL
5. Configure sync options
6. Click "Save Changes" - this will now work without errors

### API Endpoints Available
- `GET /api/shows/[id]` - Returns show data including YouTube fields
- `PUT /api/shows/[id]` - Updates show data including YouTube fields
- `POST /api/shows/[id]/sync-youtube` - Syncs YouTube videos to episodes

### Testing Confirmation
- API error fixed: No more 500 errors when saving YouTube fields
- YouTube fields can be saved and retrieved successfully
- Application remains stable and operational

### Next Steps (Optional)
If monetization fields are needed in the future:
1. Add the fields to the Show table via database migration
2. Uncomment the relevant code sections
3. Or implement a proper relationship with ShowRateCard table