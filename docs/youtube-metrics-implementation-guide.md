# YouTube Metrics Implementation Guide

## Immediate Enhancements for Episode Page

### Currently Displayed
- Views, Likes, Comments (basic engagement)
- Thumbnail, Duration, Published Date

### Priority 1: Add These Metrics Immediately (Data Already Available)

#### From YouTubeAnalytics Table
These metrics are already being synced and stored in the database:

1. **Watch Time & Retention**
   - `watchTimeMinutes` - Total watch time in minutes
   - `averageViewDuration` - Average watch duration in seconds  
   - `averageViewPercentage` - Average % of video watched
   - **Display as:** "Watch Time: 5,234 hrs • Avg Duration: 4:35 • Avg Watched: 65%"

2. **Discovery Metrics**
   - `impressions` - How many times thumbnail was shown
   - `clickThroughRate` - CTR from impressions to views
   - **Display as:** "Impressions: 45.2K • CTR: 8.4%"

3. **Subscriber Impact**
   - `subscribersGained` - New subscribers from this video
   - `subscribersLost` - Lost subscribers
   - **Net Subscriber Change** = gained - lost
   - **Display as:** "Subscribers: +127 net (+145 / -18)"

### Priority 2: Quick API Additions (Single API Call)

These require one additional API call to `videos.list` with the video ID:

1. **Content Details** (from contentDetails part)
   - HD/SD quality (`definition`)
   - Licensed content flag
   - Caption availability
   - Region restrictions

2. **Advanced Statistics** (from statistics part)
   - `favoriteCount` - Times added to favorites
   - `dislikeCount` - If available (YouTube hides this publicly now)

3. **Live Streaming Details** (if applicable)
   - Concurrent viewers (for live/premieres)
   - Actual start/end time
   - Chat message count

### Priority 3: Analytics API Enhancements (OAuth Required)

These require OAuth authentication and YouTube Analytics API access:

1. **Audience Retention**
   - Retention curve data points
   - Relative retention performance
   - Key moments for audience retention

2. **Traffic Sources**
   - Top 5 traffic sources with percentages
   - Search terms that led to video
   - External website referrers

3. **Demographics**
   - Age group distribution
   - Gender distribution  
   - Geographic distribution (top countries)

4. **Revenue Data** (if monetized)
   - Estimated revenue
   - CPM/RPM rates
   - Ad impressions

## Implementation Code Examples

### 1. Update Episode API to Include Analytics Data

```typescript
// src/app/api/episodes/[episodeId]/route.ts
// Add to existing GET handler:

// Fetch YouTube Analytics data if video ID exists
if (episode.youtubeVideoId) {
  const analyticsQuery = `
    SELECT 
      SUM(views) as totalViews,
      SUM("watchTimeMinutes") as totalWatchTime,
      AVG("averageViewDuration") as avgDuration,
      AVG("averageViewPercentage") as avgPercentage,
      SUM(impressions) as totalImpressions,
      AVG("clickThroughRate") as avgCTR,
      SUM("subscribersGained") as subsGained,
      SUM("subscribersLost") as subsLost,
      MAX(date) as lastUpdated
    FROM "YouTubeAnalytics"
    WHERE "videoId" = $1
      AND "organizationId" = $2
    GROUP BY "videoId"
  `
  
  const { data: analytics } = await safeQuerySchema(
    orgSlug,
    analyticsQuery,
    [episode.youtubeVideoId, organizationId]
  )
  
  if (analytics && analytics[0]) {
    episode.youtubeAnalytics = {
      totalWatchTimeHours: Math.round(analytics[0].totalWatchTime / 60),
      avgViewDuration: Math.round(analytics[0].avgDuration),
      avgViewPercentage: Math.round(analytics[0].avgPercentage),
      impressions: analytics[0].totalImpressions,
      clickThroughRate: parseFloat(analytics[0].avgCTR).toFixed(1),
      subscribersGained: analytics[0].subsGained,
      subscribersLost: analytics[0].subsLost,
      netSubscribers: analytics[0].subsGained - analytics[0].subsLost,
      lastUpdated: analytics[0].lastUpdated
    }
  }
}
```

### 2. Update Episode Page UI

```typescript
// src/app/episodes/[id]/page.tsx
// Add new metrics cards:

{episode.youtubeAnalytics && (
  <Card sx={{ mb: 2 }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        YouTube Performance Analytics
      </Typography>
      
      <Grid container spacing={3}>
        {/* Watch Time Metrics */}
        <Grid item xs={12} md={4}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Total Watch Time
            </Typography>
            <Typography variant="h4">
              {episode.youtubeAnalytics.totalWatchTimeHours.toLocaleString()} hrs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Avg Duration: {formatDuration(episode.youtubeAnalytics.avgViewDuration)} 
              ({episode.youtubeAnalytics.avgViewPercentage}% watched)
            </Typography>
          </Box>
        </Grid>
        
        {/* Discovery Metrics */}
        <Grid item xs={12} md={4}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Discovery Performance
            </Typography>
            <Typography variant="h4">
              {formatNumber(episode.youtubeAnalytics.impressions)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Impressions • CTR: {episode.youtubeAnalytics.clickThroughRate}%
            </Typography>
          </Box>
        </Grid>
        
        {/* Subscriber Impact */}
        <Grid item xs={12} md={4}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Subscriber Impact
            </Typography>
            <Typography variant="h4" color={
              episode.youtubeAnalytics.netSubscribers > 0 ? 'success.main' : 'error.main'
            }>
              {episode.youtubeAnalytics.netSubscribers > 0 ? '+' : ''}
              {episode.youtubeAnalytics.netSubscribers}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              +{episode.youtubeAnalytics.subscribersGained} / 
              -{episode.youtubeAnalytics.subscribersLost}
            </Typography>
          </Box>
        </Grid>
      </Grid>
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Last synced: {new Date(episode.youtubeAnalytics.lastUpdated).toLocaleDateString()}
      </Typography>
    </CardContent>
  </Card>
)}
```

### 3. Add Real-time Sync Button

```typescript
// Add a manual sync button for fresh data
const handleSyncYouTubeData = async () => {
  try {
    const response = await fetch(`/api/episodes/${episode.id}/sync-youtube`, {
      method: 'POST'
    })
    
    if (response.ok) {
      // Refresh episode data
      router.refresh()
      toast.success('YouTube data synced successfully')
    }
  } catch (error) {
    toast.error('Failed to sync YouTube data')
  }
}

// In the UI:
<Button
  startIcon={<Sync />}
  onClick={handleSyncYouTubeData}
  size="small"
>
  Sync YouTube Data
</Button>
```

## Next Steps

1. **Immediate:** Display existing YouTubeAnalytics data on episode page
2. **Next Sprint:** Add traffic source breakdown visualization
3. **Future:** Implement retention curve graph
4. **Long-term:** Build YouTube insights dashboard with trends

## Performance Considerations

- Cache YouTube data for 1 hour minimum
- Use background jobs for sync, not real-time API calls
- Batch multiple video requests into single API calls
- Monitor API quota usage (10,000 units/day limit)