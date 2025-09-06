# YouTube API Quota Management System

## Overview

The PodcastFlow Pro YouTube integration now includes comprehensive quota management to prevent API overage charges and ensure reliable service availability. This system tracks API usage, enforces daily limits, sends threshold alerts, and automatically resets quotas at organization-local midnight.

## Features

### 1. Accurate Cost Tracking
- **Precise unit costs** for each YouTube API endpoint based on official Google documentation
- **Real-time tracking** of quota usage per API call
- **Atomic increment** operations to prevent race conditions
- **Cost calculation** considers parts, batch sizes, and custom overrides

### 2. Daily Limit Enforcement
- **Default limit**: 10,000 units per day (configurable per organization)
- **Pre-flight checks** before making API calls
- **Graceful blocking** when quota would be exceeded
- **Partial sync support** - processes as much as possible before quota limit

### 3. Threshold Alerts
- **80% warning threshold**: Sends notification to organization admins
- **100% exceeded alert**: Critical notification and automatic sync pause
- **In-app notifications**: Visible in the notification center
- **Email alerts**: Sent to admin users (when email is configured)

### 4. Organization-Local Midnight Reset
- **Timezone-aware**: Resets at midnight in each organization's timezone
- **Automatic re-enabling**: Paused syncs resume after reset
- **Reset notifications**: Admins notified when quota resets
- **Manual reset option**: For testing or emergency situations

### 5. UI Integration
- **Real-time quota bar**: Shows current usage with color coding
- **Sync status indicators**: Shows when sync is paused due to quota
- **Cost breakdown**: Displays API costs for different operations
- **Time until reset**: Countdown to next quota reset

## Configuration

### Environment Variables
```bash
# Enable quota enforcement (default: false)
YOUTUBE_QUOTA_ENFORCEMENT=true
NEXT_PUBLIC_YOUTUBE_QUOTA_ENFORCEMENT=true

# Optional: Custom encryption key for API keys
YOUTUBE_ENCRYPTION_KEY=your-256-bit-hex-key
```

### Organization Settings
Each organization can configure:
- **Daily Quota Limit**: Maximum units per day (default: 10,000)
- **Alert Threshold**: Percentage for warning alerts (default: 80%)
- **Auto-stop on Exceed**: Automatically pause sync when quota exceeded (default: true)
- **Timezone**: For midnight reset calculation (default: America/New_York)

## API Cost Reference

### Read Operations (Low Cost)
| Endpoint | Cost | Description |
|----------|------|-------------|
| videos.list | 1 per part | Get video details |
| channels.list | 1 per part | Get channel info |
| playlists.list | 1 per part | List playlists |
| playlistItems.list | 1 per part | Get playlist videos |
| comments.list | 1 per part | List comments |
| activities.list | 1 per part | Get activities |
| reports.query | 1 | Analytics queries |

### Search Operations (High Cost)
| Endpoint | Cost | Description |
|----------|------|-------------|
| search.list | 100 | Search for videos/channels |

### Write Operations (Medium-High Cost)
| Endpoint | Cost | Description |
|----------|------|-------------|
| videos.update | 50 | Update video metadata |
| videos.delete | 50 | Delete a video |
| videos.rate | 50 | Like/dislike video |
| playlists.insert | 50 | Create playlist |
| comments.insert | 50 | Post comment |
| thumbnails.set | 50 | Update thumbnail |

### Upload Operations (Very High Cost)
| Endpoint | Cost | Description |
|----------|------|-------------|
| videos.insert | 1600 | Upload new video |
| captions.insert | 400 | Add captions |
| captions.update | 450 | Update captions |

## Implementation Details

### Database Schema

#### Organization Schema Tables
```sql
-- Daily quota usage tracking
CREATE TABLE youtube_quota_usage (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    usage_date DATE NOT NULL,
    used_units INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, usage_date)
);

-- Sync settings with pause reason
CREATE TABLE "YouTubeSyncSettings" (
    id TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "syncEnabled" BOOLEAN DEFAULT true,
    "syncPausedReason" TEXT, -- 'QUOTA' when paused due to quota
    "syncPausedAt" TIMESTAMP,
    UNIQUE("organizationId")
);
```

#### Public Schema Enhancements
```sql
-- Added to YouTubeApiConfig
ALTER TABLE "YouTubeApiConfig" ADD COLUMN "dailyQuotaLimit" INTEGER DEFAULT 10000;
ALTER TABLE "YouTubeApiConfig" ADD COLUMN "quotaAlertThreshold" INTEGER DEFAULT 80;
ALTER TABLE "YouTubeApiConfig" ADD COLUMN "autoStopOnQuotaExceeded" BOOLEAN DEFAULT true;
ALTER TABLE "YouTubeApiConfig" ADD COLUMN "lastQuotaAlert80" TIMESTAMP;
ALTER TABLE "YouTubeApiConfig" ADD COLUMN "lastQuotaAlert100" TIMESTAMP;

-- Added to Organization
ALTER TABLE "Organization" ADD COLUMN timezone TEXT DEFAULT 'America/New_York';
```

### Service Architecture

#### QuotaManager (Singleton)
- Central service for all quota operations
- Handles cost calculation, checking, and recording
- Manages threshold alerts and sync pausing
- Provides quota status for UI components

#### YouTubeServiceWithQuota
- Enhanced version of YouTubeService
- Wraps all API calls with quota checking
- Handles QuotaExceededError gracefully
- Logs quota violations for monitoring

#### QuotaResetScheduler
- Cron-based job scheduler
- Runs at org-local midnight
- Resets quota usage records
- Re-enables paused syncs
- Sends reset notifications

### API Flow

1. **Before API Call**:
   - Check current quota usage
   - Calculate cost for the operation
   - Verify call won't exceed limit
   - Block if would exceed

2. **During API Call**:
   - Execute the YouTube API request
   - Handle rate limiting with exponential backoff
   - Catch quota errors from YouTube

3. **After API Call**:
   - Record usage atomically
   - Check for threshold crossings
   - Send alerts if needed
   - Update UI status

## Usage Examples

### Basic API Call with Quota
```typescript
import { quotaManager } from '@/lib/youtube'

// Check quota before expensive operation
const quotaCheck = await quotaManager.checkQuota(
  organizationId,
  'search.list',
  100 // Search costs 100 units
)

if (!quotaCheck.allowed) {
  console.log(`Cannot search: ${quotaCheck.message}`)
  return
}

// Execute with automatic quota management
const results = await quotaManager.executeWithQuota(
  organizationId,
  'search.list',
  async () => {
    return await youtube.search.list({
      q: 'podcast',
      type: ['video'],
      maxResults: 10
    })
  },
  { cost: 100 }
)
```

### Sync with Quota Awareness
```typescript
import { syncYouTubeUploadsWithQuota } from '@/lib/youtube'

const result = await syncYouTubeUploadsWithQuota({
  orgSlug: 'podcastflow_pro',
  showId: 'show-123',
  apiKey: encryptedKey,
  organizationId,
  maxPages: 10
})

if (result.stoppedDueToQuota) {
  console.log('Sync stopped due to quota limit')
  console.log(`Processed ${result.videosProcessed} videos`)
}
```

### Manual Quota Reset (Admin Only)
```typescript
import { quotaResetScheduler } from '@/lib/youtube/quota-reset-job'

// Manual reset for testing
await quotaResetScheduler.manualReset(organizationId)
```

## Monitoring

### Quota Monitoring View
```sql
-- Check quota usage across all organizations
SELECT * FROM public.youtube_quota_monitoring
ORDER BY usage_percentage DESC;
```

### Alert History
```sql
-- View recent quota alerts
SELECT * FROM org_podcastflow_pro."Notification"
WHERE type IN ('youtube_quota_alert', 'youtube_quota_reset')
ORDER BY "createdAt" DESC
LIMIT 10;
```

## Troubleshooting

### Common Issues

1. **Sync Stopped Unexpectedly**
   - Check quota status in YouTube Integration UI
   - Verify daily limit configuration
   - Review sync logs for quota errors

2. **Quota Not Resetting**
   - Verify organization timezone setting
   - Check cron job status
   - Review reset job logs

3. **False Quota Exceeded Errors**
   - Ensure feature flag is set correctly
   - Check for duplicate API calls
   - Verify cost calculations

### Manual Interventions

```bash
# Check current quota status
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost \
  -d podcastflow_production \
  -c "SELECT * FROM public.youtube_quota_monitoring;"

# Reset quota manually (emergency)
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost \
  -d podcastflow_production \
  -c "UPDATE public.\"YouTubeApiConfig\" 
      SET \"quotaUsed\" = 0, \"quotaResetAt\" = NOW() + INTERVAL '24 hours' 
      WHERE \"organizationId\" = 'your-org-id';"
```

## Best Practices

1. **Optimize API Calls**:
   - Batch video ID requests (up to 50 per call)
   - Cache frequently accessed data
   - Use filtering to reduce result sets

2. **Schedule Wisely**:
   - Run intensive syncs during off-peak hours
   - Spread sync operations throughout the day
   - Use incremental syncs instead of full refreshes

3. **Monitor Usage**:
   - Set up alerts for 50% usage (custom)
   - Review daily usage patterns
   - Adjust limits based on actual needs

4. **Cost Optimization**:
   - Avoid search.list when possible (100 units)
   - Use specific video/channel IDs instead
   - Minimize parts in list requests

## Migration Guide

### Enabling Quota Enforcement

1. **Set Environment Variables**:
```bash
echo "YOUTUBE_QUOTA_ENFORCEMENT=true" >> .env.production
echo "NEXT_PUBLIC_YOUTUBE_QUOTA_ENFORCEMENT=true" >> .env.production
```

2. **Run Database Migration**:
```bash
psql -U podcastflow -d podcastflow_production -f youtube_quota_migration.sql
```

3. **Configure Organization Settings**:
   - Navigate to YouTube Integration settings
   - Set daily quota limit (default: 10,000)
   - Configure alert threshold (default: 80%)
   - Enable auto-stop on exceed

4. **Restart Application**:
```bash
npm run build
pm2 restart podcastflow-pro --update-env
```

### Rollback Procedure

1. **Disable Feature Flag**:
```bash
# Set to false in .env.production
YOUTUBE_QUOTA_ENFORCEMENT=false
NEXT_PUBLIC_YOUTUBE_QUOTA_ENFORCEMENT=false
```

2. **Restart Application**:
```bash
pm2 restart podcastflow-pro --update-env
```

The system will continue tracking usage but won't enforce limits.

## Performance Impact

- **Minimal overhead**: ~5-10ms per API call for quota checking
- **Database queries**: Optimized with indexes on org_id and usage_date
- **Memory usage**: Singleton pattern minimizes memory footprint
- **Network calls**: No additional external API calls

## Security Considerations

- **API keys encrypted** at rest using AES-256-CBC
- **Quota data isolated** per organization schema
- **Admin-only access** to quota configuration
- **Audit logging** for all quota-related actions

## Future Enhancements

1. **Quota Pooling**: Share quota across multiple organizations
2. **Dynamic Limits**: Adjust limits based on usage patterns
3. **Cost Alerts**: Notify when approaching Google's billing threshold
4. **Usage Analytics**: Detailed reports and trends
5. **Quota Reservation**: Reserve quota for critical operations
6. **Webhook Integration**: Send quota events to external systems