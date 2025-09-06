# Show View Details - Real Data Implementation

## Implementation Summary
**Date**: 2025-08-23
**Feature Flag**: `SHOW_VIEW_DETAILS_REAL_DATA=true`

## What Was Implemented

### 1. Service Layer (✅ Complete)

#### YouTube Service (`/src/server/services/youtube.ts`)
- Full YouTube Data API v3 integration with API key authentication
- YouTube Analytics API v2 support with OAuth2
- Quota management integration (uses existing quota manager)
- Intelligent caching (12h for channel data, 30m for video stats, 10m for analytics)
- Retry logic with exponential backoff and jitter
- Methods:
  - `getChannelStats()`: Channel subscribers, views, video count
  - `getPlaylistItems()`: Videos in a playlist with pagination
  - `getVideosStats()`: Batch video statistics (views, likes, comments)
  - `getAnalyticsTimeseries()`: Daily metrics (requires OAuth)

#### Megaphone Service (`/src/server/services/megaphone.ts`)
- Full Megaphone API integration
- Rate limiting (1000 requests/hour)
- Dynamic cache durations based on data freshness
- Retry logic with exponential backoff
- Methods:
  - `getShowDownloads()`: Daily download statistics
  - `getEpisodeDownloads()`: Episode-level metrics
  - `getListenThroughRates()`: Completion metrics
  - `getShowInfo()`: Show metadata

### 2. Data Aggregation Layer (✅ Complete)

#### ShowMetricsAggregator (`/src/server/aggregators/showMetrics.ts`)
- Combines YouTube and Megaphone data into unified format
- Handles missing/partial data gracefully
- Date alignment and gap filling
- Calculates engagement rates
- Returns typed response with:
  - Totals (views, downloads, engagement)
  - Daily timeseries data
  - Connection status for each service
  - Error messages for disconnected services

### 3. API Endpoints (✅ Complete)

#### New v2 Metrics Endpoint (`/api/shows/[id]/metrics/v2`)
- Uses the aggregator for real data
- Feature flag controlled (`SHOW_VIEW_DETAILS_REAL_DATA`)
- Returns normalized response format
- Handles errors gracefully with partial data
- Maintains backward compatibility

### 4. UI Components (✅ Complete)

#### ShowViewDetails Component (`/src/components/shows/ShowViewDetails.tsx`)
- Displays YouTube and Megaphone metrics side-by-side
- Connection status indicators
- "Connect" CTAs for disconnected services
- Dual-line timeseries chart (views vs downloads)
- Real-time refresh capability
- Proper number formatting (K/M suffixes)
- Duration formatting (mm:ss)
- Data freshness timestamps

### 5. Quota & Rate Limiting (✅ Complete)

- **YouTube Quota Management**:
  - Uses existing `/src/lib/youtube/quota-manager.ts`
  - Tracks API costs per endpoint
  - Daily limit enforcement (10,000 units default)
  - 80% and 100% threshold alerts
  - Organization-scoped tracking

- **Megaphone Rate Limiting**:
  - 1000 requests/hour limit
  - Automatic reset tracking
  - Pre-flight checks before requests

### 6. Error Handling (✅ Complete)

- Service initialization failures don't crash the app
- Missing credentials return clear error messages
- Quota exceeded errors are caught and reported
- Partial data is returned when one service fails
- Retry logic for transient failures (429, 5xx)

### 7. Tests (✅ Complete)

#### Test Coverage (`/tests/aggregators/showMetrics.test.ts`)
- Date merging and alignment
- Service fallback scenarios
- Quota blocking handling
- Null value preservation
- Date range calculations

## Configuration Required

### YouTube Configuration (Per Organization)
1. Go to Settings → Integrations → YouTube
2. Add YouTube API Key (from Google Cloud Console)
3. Optional: Configure OAuth for advanced metrics

### Megaphone Configuration (Per Organization)
1. Go to Settings → Integrations → Megaphone
2. Add Megaphone API credentials
3. Configure podcast/network IDs

### Database Schema Updates
Shows must have external IDs configured:
- `youtubeChannelId`: YouTube channel ID
- `youtubePlaylistId`: YouTube uploads playlist ID
- `megaphoneShowId`: Megaphone show/podcast ID

## Feature Flag

The feature is controlled by the `SHOW_VIEW_DETAILS_REAL_DATA` environment variable:

```bash
# Enable in .env.production
SHOW_VIEW_DETAILS_REAL_DATA=true
```

When disabled, the v2 endpoint returns a mock response for backward compatibility.

## Files Changed

### New Files Created:
1. `/src/server/services/youtube.ts` - YouTube service layer
2. `/src/server/services/megaphone.ts` - Megaphone service layer
3. `/src/server/aggregators/showMetrics.ts` - Data aggregation layer
4. `/src/app/api/shows/[id]/metrics/v2/route.ts` - New v2 metrics endpoint
5. `/src/components/shows/ShowViewDetails.tsx` - Enhanced UI component
6. `/tests/aggregators/showMetrics.test.ts` - Unit tests
7. `/docs/pages/show-view-details-data.md` - Data inventory documentation
8. `/docs/implementation/show-view-details-real-data.md` - This document

### Modified Files:
1. `.env.production` - Added `SHOW_VIEW_DETAILS_REAL_DATA=true` flag

## How to Validate

### 1. Check Feature Flag
```bash
grep SHOW_VIEW_DETAILS_REAL_DATA .env.production
# Should output: SHOW_VIEW_DETAILS_REAL_DATA=true
```

### 2. Test v2 Endpoint
```bash
# Get auth token first
AUTH_TOKEN=$(curl -s -X POST https://app.podcastflow.pro/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@podcastflow.pro","password":"admin123"}' \
  | jq -r '.token')

# Test v2 metrics endpoint
curl -s https://app.podcastflow.pro/api/shows/[SHOW_ID]/metrics/v2 \
  -H "Cookie: auth-token=$AUTH_TOKEN" \
  | jq '.status'
```

### 3. Check UI
1. Navigate to any show's View Details page
2. Look for connection status indicators
3. Verify real data is displayed (not zeros/mocks)
4. Check for "Connect YouTube" or "Connect Megaphone" alerts if not configured

## Quota Consumption Estimates

### YouTube API Costs (per request):
- Channel stats: 2 units (snippet + statistics)
- Playlist items: 1 unit per page
- Video stats: 3 units per 50 videos
- Analytics queries: 1 unit

### Typical Usage Pattern:
- Show page load: ~6 units (channel + recent videos)
- With analytics: +1 unit
- Daily sync for 10 shows: ~60 units
- **Daily budget**: 10,000 units (plenty of headroom)

### Megaphone API:
- Rate limit: 1000 requests/hour
- Typical usage: 10-20 requests per show page
- **Well within limits**

## Monitoring

### Check Quota Usage:
```sql
-- Check YouTube quota usage for an org
SELECT * FROM "YouTubeQuotaUsage" 
WHERE "organizationId" = '[ORG_ID]'
AND date = CURRENT_DATE;
```

### Check Error Logs:
```bash
# Check PM2 logs for API errors
pm2 logs podcastflow-pro --lines 100 | grep -E "YouTube|Megaphone|quota"
```

## Rollback Plan

If issues arise, disable the feature flag:

```bash
# 1. Edit .env.production
SHOW_VIEW_DETAILS_REAL_DATA=false

# 2. Restart application
pm2 restart podcastflow-pro --update-env
```

The application will immediately revert to the previous behavior without any data loss.

## Next Steps

1. **Monitor quota usage** for the first few days
2. **Collect user feedback** on data accuracy
3. **Add background sync jobs** for regular data updates
4. **Implement OAuth flow** for YouTube Analytics
5. **Add more Megaphone metrics** (demographics, geography)
6. **Create admin dashboard** for quota monitoring

## Success Metrics

- ✅ No mock data returned by the metrics APIs
- ✅ YouTube views, likes, comments displayed
- ✅ Megaphone downloads displayed (when connected)
- ✅ Clear "not connected" messages for missing integrations
- ✅ Timeseries chart shows dual lines
- ✅ No 500 errors on missing credentials
- ✅ Quota limits enforced without crashes
- ✅ Page loads successfully even with partial data

## Known Limitations

1. **YouTube Analytics** requires OAuth (not just API key)
2. **Average view duration** only available with OAuth
3. **Demographics** not implemented (requires OAuth)
4. **Geography** not implemented (requires additional API calls)
5. **Unique viewers/listeners** approximated (platform limitations)

## Support

For issues or questions:
1. Check PM2 logs: `pm2 logs podcastflow-pro`
2. Verify credentials are configured in organization settings
3. Check quota usage in database
4. Ensure show has external IDs configured