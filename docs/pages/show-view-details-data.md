# Show View Details Page - Data Dependencies Inventory

## Current Implementation Status
**Generated**: 2025-08-23
**Page Location**: `/src/app/shows/[id]/page.tsx` (main show details)
**Metrics Page**: `/src/app/shows/[id]/metrics/page.tsx` (detailed metrics view)

## API Endpoints Currently Used

### 1. Main Show Details Page (`/shows/[id]`)

#### Core APIs:
- **GET `/api/shows/[id]`** - Show details
  - Returns: Show metadata (name, host, category, status, etc.)
  - Data Source: PostgreSQL org schema `Show` table
  - Mock Data: ❌ None - uses real DB

- **GET `/api/episodes?showId=[id]`** - Episodes list
  - Returns: Episode list with YouTube/Megaphone metrics per episode
  - Data Source: PostgreSQL org schema `Episode` table
  - YouTube Data: Partial (stored viewCount, likeCount, commentCount)
  - Megaphone Data: Partial (stored downloads, impressions)
  - Mock Data: ❌ None - uses real DB

- **GET `/api/campaigns?showId=[id]`** - Campaigns
  - Returns: Active campaigns for the show
  - Data Source: PostgreSQL org schema `Campaign` table
  - Mock Data: ❌ None - uses real DB

### 2. Metrics Page (`/shows/[id]/metrics`)

#### Metrics APIs:
- **GET `/api/shows/[id]/metrics`** - Core metrics
  - Returns: Aggregated YouTube/Megaphone metrics
  - YouTube Source: `YouTubeAnalytics` table (when available) or `Episode` table snapshots
  - Megaphone Source: `Episode` table stored values
  - Mock Data: ⚠️ Returns zeros/defaults when no real data

- **GET `/api/shows/[id]/metrics/history`** - Historical trends
  - Returns: Daily/monthly subscriber history
  - Data Source: `YouTubeAnalytics` table aggregations
  - Mock Data: ⚠️ Empty arrays when no data

- **GET `/api/shows/[id]/metrics/summary`** - Enhanced summary
  - Returns: Downloads, completion rates (VTR/LTR)
  - YouTube VTR: Requires OAuth (currently returns 0 if not configured)
  - Megaphone LTR: Not implemented (returns 0)
  - Mock Data: ⚠️ Returns N/A for unavailable metrics

- **GET `/api/shows/[id]/metrics/daily-trend`** - Daily trends
  - Returns: Daily views/listens timeseries
  - Data Source: `YouTubeAnalytics` and `Episode` aggregations
  - Mock Data: ⚠️ Empty when no data

### 3. YouTube Sync APIs

- **POST `/api/youtube/sync-channel-data`**
  - Triggers manual YouTube data sync
  - Uses: YouTube Data API v3 (requires API key)
  - Updates: Episode table with latest stats

## Current Data Sources

### YouTube Data
1. **YouTube Data API v3** (Implemented in `/src/services/youtube-data.ts`)
   - ✅ Channel statistics (subscribers, total views)
   - ✅ Video statistics (views, likes, comments)
   - ❌ Analytics API (view duration, demographics) - Not implemented
   - Auth: API Key only (no OAuth yet)

2. **Storage Tables**:
   - `Episode` table: Stores snapshot values
   - `YouTubeAnalytics` table: Daily historical data
   - `YouTubeMetrics` table: Point-in-time snapshots

### Megaphone Data
1. **Megaphone API** (Partial in `/src/services/megaphoneService.ts`)
   - ⚠️ Service exists but not fully integrated
   - ❌ Downloads API not connected
   - ❌ Listen-through rates not fetched

2. **Storage**:
   - `Episode` table: Has columns but mostly empty
   - No dedicated Megaphone analytics tables

## Data Gaps & Mock Data Issues

### Currently Using Mock/Default Data:
1. **Megaphone Downloads**: Always 0 or missing
2. **Listen-through Rate (LTR)**: Always "N/A"
3. **Unique Listeners**: Always "N/A"
4. **Platform Distribution**: Only YouTube data if available
5. **Average View Duration**: Not fetched (requires YouTube Analytics API)
6. **Demographics**: Empty/null
7. **Geographic Data**: Not implemented

### Missing Integrations:
1. **YouTube Analytics API** (OAuth required):
   - Average view duration
   - View percentage/retention
   - Demographics
   - Geography
   - Traffic sources

2. **Megaphone Full Integration**:
   - Episode downloads by date
   - Show-level aggregations
   - Listen-through rates
   - Unique listeners
   - Demographics

## Required API Credentials

### YouTube (Per Organization):
- ✅ API Key: Stored in org settings (partially working)
- ❌ OAuth Token: Not implemented (needed for Analytics API)
- ❌ Refresh Token: Not stored

### Megaphone (Per Organization):
- ⚠️ API credentials structure exists
- ❌ Not actively fetching data
- ❌ No background sync jobs

## Quota & Rate Limiting

### Current State:
- ❌ No quota tracking for YouTube API
- ❌ No rate limiting implementation
- ❌ No retry logic for 429 errors
- ❌ No quota alerting

## Tenant Isolation Status

### ✅ Properly Isolated:
- All database queries use `safeQuerySchema`
- Organization-scoped data access
- No public schema business data

### ⚠️ Needs Review:
- YouTube API credentials per org
- Megaphone credentials per org
- Quota tracking per org

## Summary

The View Details and Metrics pages currently:
1. **Use real database data** for basic show/episode info
2. **Partially integrate YouTube** via Data API (views, likes, comments only)
3. **Do not fetch Megaphone data** (columns exist but empty)
4. **Return empty/zero values** instead of proper "not connected" states
5. **Lack OAuth for YouTube Analytics** (no duration, retention, demographics)
6. **Have no quota management** or rate limiting
7. **Properly isolate by tenant** at the database level

Next steps will be to:
1. Wire up full YouTube integration (OAuth + Analytics API)
2. Connect Megaphone API for downloads/listens
3. Create proper data aggregation layer
4. Add quota tracking and rate limiting
5. Implement proper "disconnected" UI states