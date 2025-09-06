# YouTube Data API v3 Integration Guide

This guide explains how to use the YouTube integration in PodcastFlow Pro, which supports both public data access (via API key) and private channel data (via OAuth 2.0) in a multi-tenant architecture.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Setup Instructions](#setup-instructions)
3. [API Endpoints](#api-endpoints)
4. [Usage Examples](#usage-examples)
5. [Security Considerations](#security-considerations)
6. [Troubleshooting](#troubleshooting)

## Architecture Overview

The YouTube integration is designed with the following principles:

- **Multi-tenant isolation**: Each organization has its own YouTube API configuration and connected channels
- **Dual authentication**: Supports both API key (public data) and OAuth 2.0 (private data)
- **Secure token storage**: All sensitive data (API keys, OAuth tokens) are encrypted at rest
- **Automatic token refresh**: OAuth tokens are automatically refreshed when expired
- **Quota management**: Tracks API usage to prevent quota exhaustion

### Database Schema

Each organization schema includes:
- `YouTubeChannel`: Stores OAuth tokens for connected channels
- `YouTubeVideo`: Caches public video data
- `YouTubeAnalytics`: Stores private analytics data
- `YouTubeSyncLog`: Tracks sync operations

The public schema includes:
- `YouTubeApiConfig`: Stores API keys and OAuth credentials per organization

## Setup Instructions

### 1. Obtain YouTube API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable YouTube Data API v3
4. Create credentials:
   - **API Key**: For public data access
   - **OAuth 2.0 Client ID**: For private data access

### 2. Configure OAuth Consent Screen

1. In Google Cloud Console, go to "OAuth consent screen"
2. Configure your app information
3. Add scopes:
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/yt-analytics.readonly`
   - `https://www.googleapis.com/auth/yt-analytics-monetary.readonly`
4. Add authorized redirect URI: `https://app.podcastflow.pro/api/youtube/auth/callback`

### 3. Apply Database Schema

```bash
# Apply the YouTube integration schema
PGPASSWORD=PodcastFlow2025Prod psql -U podcastflow -h localhost -d podcastflow_production < youtube_integration_schema.sql
```

### 4. Set Environment Variables

Add to `.env.production`:
```env
# YouTube Integration
YOUTUBE_ENCRYPTION_KEY=your-32-byte-hex-key-here
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Configure in UI

1. Log in as admin/master
2. Go to Settings > Integrations
3. Configure YouTube API:
   - Enter API Key
   - Enter OAuth Client ID and Secret
   - Set daily quota limit

## API Endpoints

### Public Data Endpoints (API Key)

#### Get Video Information
```bash
GET /api/youtube/public/video?videoId={videoId}

# Example
curl -X GET "https://app.podcastflow.pro/api/youtube/public/video?videoId=dQw4w9WgXcQ" \
  -H "Cookie: auth-token=your-session-token"

# Response
{
  "success": true,
  "data": {
    "id": "dQw4w9WgXcQ",
    "title": "Video Title",
    "description": "Video description...",
    "viewCount": 1234567,
    "likeCount": 12345,
    "commentCount": 1234,
    "publishedAt": "2024-01-01T00:00:00Z",
    "channelId": "UCxxxxxx",
    "channelTitle": "Channel Name"
  }
}
```

#### Get Channel Information
```bash
GET /api/youtube/public/channel?channelId={channelId}

# Example
curl -X GET "https://app.podcastflow.pro/api/youtube/public/channel?channelId=UCxxxxxx" \
  -H "Cookie: auth-token=your-session-token"
```

#### Search Videos
```bash
GET /api/youtube/public/search?q={query}&maxResults={number}

# Example
curl -X GET "https://app.podcastflow.pro/api/youtube/public/search?q=podcast&maxResults=10" \
  -H "Cookie: auth-token=your-session-token"
```

### Private Data Endpoints (OAuth)

#### Connect YouTube Channel
```bash
GET /api/youtube/auth/connect

# This redirects to Google OAuth consent screen
```

#### List Connected Channels
```bash
GET /api/youtube/channels

# Response
{
  "success": true,
  "channels": [
    {
      "id": "ytc_123",
      "channelId": "UCxxxxxx",
      "channelTitle": "My Channel",
      "channelThumbnail": "https://...",
      "connectedBy": "user-id",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Channel Analytics
```bash
GET /api/youtube/analytics/channel?channelId={channelId}&startDate={date}&endDate={date}

# Example
curl -X GET "https://app.podcastflow.pro/api/youtube/analytics/channel?channelId=UCxxxxxx&startDate=2024-01-01&endDate=2024-01-31" \
  -H "Cookie: auth-token=your-session-token"

# Response includes views, watch time, subscribers, revenue, etc.
```

#### Get Video Analytics
```bash
GET /api/youtube/analytics/video?channelId={channelId}&videoId={videoId}&startDate={date}&endDate={date}
```

## Usage Examples

### React Component Example

```typescript
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

// Example: Fetch public video data
function VideoInfo({ videoId }: { videoId: string }) {
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchVideo() {
      try {
        const response = await api.get(`/youtube/public/video?videoId=${videoId}`)
        setVideo(response.data)
      } catch (error) {
        console.error('Failed to fetch video:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchVideo()
  }, [videoId])

  if (loading) return <div>Loading...</div>
  if (!video) return <div>Video not found</div>

  return (
    <div>
      <h3>{video.title}</h3>
      <p>Views: {video.viewCount.toLocaleString()}</p>
      <p>Likes: {video.likeCount.toLocaleString()}</p>
    </div>
  )
}

// Example: Fetch private analytics
function ChannelAnalytics({ channelId }: { channelId: string }) {
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 30) // Last 30 days

        const response = await api.get('/youtube/analytics/channel', {
          params: {
            channelId,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
          }
        })
        
        setAnalytics(response.data.analytics)
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      }
    }
    
    fetchAnalytics()
  }, [channelId])

  // Render analytics data...
}
```

### API Integration Example

```typescript
// Example service for YouTube operations
class YouTubeApiService {
  // Search for videos related to a podcast episode
  async findRelatedVideos(episodeTitle: string, maxResults = 5) {
    try {
      const response = await api.get('/youtube/public/search', {
        params: { q: episodeTitle, maxResults }
      })
      
      return response.data.results
    } catch (error) {
      console.error('YouTube search failed:', error)
      return []
    }
  }

  // Get analytics for all connected channels
  async getAllChannelAnalytics(dateRange: { start: Date, end: Date }) {
    try {
      // First, get all connected channels
      const channelsResponse = await api.get('/youtube/channels')
      const channels = channelsResponse.channels

      // Fetch analytics for each channel
      const analyticsPromises = channels.map(channel =>
        api.get('/youtube/analytics/channel', {
          params: {
            channelId: channel.channelId,
            startDate: dateRange.start.toISOString().split('T')[0],
            endDate: dateRange.end.toISOString().split('T')[0]
          }
        })
      )

      const analyticsResults = await Promise.all(analyticsPromises)
      
      // Combine results
      return channels.map((channel, index) => ({
        ...channel,
        analytics: analyticsResults[index].data.analytics
      }))
    } catch (error) {
      console.error('Failed to fetch channel analytics:', error)
      return []
    }
  }
}
```

## Security Considerations

### 1. API Key Security
- Never expose API keys in client-side code
- Rotate API keys regularly
- Use separate API keys for development and production

### 2. OAuth Token Security
- Tokens are encrypted using AES-256-CBC encryption
- Refresh tokens are stored securely and never exposed to clients
- Implement token rotation on refresh

### 3. Rate Limiting
- YouTube API has daily quotas (default: 10,000 units)
- Search operations are expensive (100 units each)
- Implement caching to reduce API calls

### 4. Data Isolation
- Each organization can only access their own connected channels
- API keys and OAuth tokens are organization-specific
- Use role-based access control for sensitive operations

## Troubleshooting

### Common Issues

#### "YouTube API not configured"
- Ensure API key is set in Settings > Integrations
- Check that the API key is valid and has YouTube Data API v3 enabled

#### "YouTube channel not connected"
- The channel must be connected via OAuth first
- Check that OAuth credentials are configured
- Ensure the user has granted necessary permissions

#### "YouTube API quota exceeded"
- Check quota usage in Settings > Integrations
- Implement caching to reduce API calls
- Request quota increase from Google if needed

#### "Invalid video/channel ID format"
- Video IDs are 11 characters (e.g., dQw4w9WgXcQ)
- Channel IDs start with "UC" and are 24 characters total

### Debug Checklist

1. **Check API Configuration**
   ```sql
   SELECT * FROM public."YouTubeApiConfig" WHERE "organizationId" = 'your-org-id';
   ```

2. **Check Connected Channels**
   ```sql
   SELECT * FROM org_your_org."YouTubeChannel" WHERE "isActive" = true;
   ```

3. **Check API Logs**
   ```bash
   pm2 logs podcastflow-pro --lines 100 | grep youtube
   ```

4. **Test API Key**
   ```bash
   curl "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key=YOUR_API_KEY"
   ```

## Additional Resources

- [YouTube Data API v3 Documentation](https://developers.google.com/youtube/v3)
- [YouTube Analytics API Documentation](https://developers.google.com/youtube/analytics)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [API Quota Calculator](https://developers.google.com/youtube/v3/getting-started#quota)