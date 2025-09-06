'use client'

import React, { useMemo } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Divider,
  Tooltip
} from '@mui/material'
import {
  PlayCircle,
  ThumbUp,
  ThumbDown,
  Comment,
  Visibility,
  AccessTime,
  TrendingUp,
  YouTube,
  Share,
  WatchLater,
  Group,
  Speed,
  Analytics,
  HelpOutline,
  ShowChart
} from '@mui/icons-material'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

interface YouTubeEpisodeCardProps {
  episode: any
}

export function YouTubeEpisodeCard({ episode }: YouTubeEpisodeCardProps) {
  // Check if this is a YouTube episode
  const isYouTubeEpisode = episode?.youtubeVideoId || 
    (episode?.publishUrl && (episode.publishUrl.includes('youtube.com') || episode.publishUrl.includes('youtu.be')))

  if (!isYouTubeEpisode) {
    return null
  }

  const formatNumber = (num: number | string | undefined) => {
    if (!num) return '0'
    const value = typeof num === 'string' ? parseInt(num) : num
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  const getEngagementRate = () => {
    const views = typeof episode.youtubeViewCount === 'number' ? episode.youtubeViewCount : parseInt(episode.youtubeViewCount || '0')
    const likes = typeof episode.youtubeLikeCount === 'number' ? episode.youtubeLikeCount : parseInt(episode.youtubeLikeCount || '0')
    const comments = typeof episode.youtubeCommentCount === 'number' ? episode.youtubeCommentCount : parseInt(episode.youtubeCommentCount || '0')
    
    if (views === 0) return 0
    return ((likes + comments) / views * 100).toFixed(2)
  }

  const getLikeRatio = () => {
    const likes = typeof episode.youtubeLikeCount === 'number' ? episode.youtubeLikeCount : parseInt(episode.youtubeLikeCount || '0')
    const dislikes = typeof episode.youtubeDislikeCount === 'number' ? episode.youtubeDislikeCount : parseInt(episode.youtubeDislikeCount || '0')
    
    if (likes + dislikes === 0) return 100
    return ((likes / (likes + dislikes)) * 100).toFixed(1)
  }

  const getAvgViewDuration = () => {
    if (!episode.youtubeAvgViewDuration) return 'N/A'
    const seconds = parseInt(episode.youtubeAvgViewDuration)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Views over time data - will come from YouTube Analytics API
  // Currently not connected - showing empty state
  const viewsOverTime = useMemo(() => {
    // TODO: Fetch from YouTube Analytics API endpoint
    // This would require calling /api/episodes/[id]/youtube-metrics with daily granularity
    return []
  }, [episode])

  // Metric with tooltip helper component
  const MetricBox = ({ icon, label, value, subValue, tooltip, gridProps = {} }: any) => (
    <Grid item xs={6} sm={4} md={2} {...gridProps}>
      <Box>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          {icon}
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Tooltip title={tooltip} placement="top" arrow>
            <HelpOutline sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        </Box>
        <Typography variant="h4" fontWeight="bold">
          {value}
        </Typography>
        {subValue && (
          <Typography variant="caption" color="text.secondary">
            {subValue}
          </Typography>
        )}
      </Box>
    </Grid>
  )

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <YouTube sx={{ color: '#FF0000', fontSize: 32 }} />
          <Typography variant="h5" fontWeight="bold">
            YouTube Analytics
          </Typography>
          {episode.youtubeVideoId && (
            <Chip 
              label={`Video ID: ${episode.youtubeVideoId}`} 
              size="small" 
              variant="outlined"
              sx={{ ml: 'auto' }}
            />
          )}
        </Box>

        {/* Primary Metrics Row */}
        <Grid container spacing={3} mb={3}>
          <MetricBox
            icon={<Visibility fontSize="small" color="primary" />}
            label="Total Views"
            value={formatNumber(episode.youtubeViewCount)}
            subValue={episode.youtubeViewGrowth && `+${episode.youtubeViewGrowth}% this week`}
            tooltip="The total number of times your video has been watched. Each view is counted when a viewer watches your video for at least 30 seconds."
          />

          <MetricBox
            icon={<ThumbUp fontSize="small" color="primary" />}
            label="Likes"
            value={formatNumber(episode.youtubeLikeCount)}
            subValue={`${getLikeRatio()}% positive`}
            tooltip="The number of viewers who gave your video a thumbs up. A higher like ratio indicates positive audience sentiment."
          />

          <MetricBox
            icon={<Comment fontSize="small" color="primary" />}
            label="Comments"
            value={formatNumber(episode.youtubeCommentCount)}
            tooltip="The total number of comments on your video. High comment counts indicate strong audience engagement."
          />

          <MetricBox
            icon={<TrendingUp fontSize="small" color="primary" />}
            label="Engagement Rate"
            value={`${getEngagementRate()}%`}
            tooltip="The percentage of viewers who interacted with your video through likes or comments. Higher rates indicate more engaged audiences."
          />

          <MetricBox
            icon={<WatchLater fontSize="small" color="primary" />}
            label="Watch Time (hrs)"
            value={episode.youtubeWatchTimeHours ? formatNumber(episode.youtubeWatchTimeHours) : 'N/A'}
            tooltip="The total amount of time viewers have spent watching your video, measured in hours. This is a key metric for YouTube's algorithm."
          />

          <MetricBox
            icon={<Speed fontSize="small" color="primary" />}
            label="Click-Through Rate"
            value={episode.youtubeCTR ? `${episode.youtubeCTR}%` : 'N/A'}
            tooltip="The percentage of people who clicked on your video after seeing the thumbnail. Average CTR is between 2-10%."
          />
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Secondary Metrics Row */}
        <Grid container spacing={3} mb={3}>
          <Grid item xs={6} sm={4} md={3}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <AccessTime fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Avg View Duration
                </Typography>
                <Tooltip title="The average time viewers spend watching your video. Higher durations indicate more engaging content." placement="top" arrow>
                  <HelpOutline sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Typography variant="h5">
                {getAvgViewDuration()}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={3}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <Analytics fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Impressions
                </Typography>
                <Tooltip title="The number of times your video thumbnail was shown to viewers on YouTube." placement="top" arrow>
                  <HelpOutline sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Typography variant="h5">
                {episode.youtubeImpressions ? formatNumber(episode.youtubeImpressions) : 'N/A'}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={3}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <ShowChart fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Retention Rate
                </Typography>
                <Tooltip title="The percentage of your video that viewers watch on average. Higher retention rates lead to better YouTube recommendations." placement="top" arrow>
                  <HelpOutline sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Typography variant="h5">
                {episode.youtubeRetentionRate ? `${episode.youtubeRetentionRate}%` : 'N/A'}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={3}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <Group fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  New Subscribers
                </Typography>
                <Tooltip title="The number of new channel subscribers gained from this video." placement="top" arrow>
                  <HelpOutline sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Typography variant="h5">
                {episode.youtubeNewSubscribers !== undefined ? formatNumber(episode.youtubeNewSubscribers) : 'N/A'}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Views Over Time Chart */}
        {viewsOverTime.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="h6">
                  Views Over Time (Last 30 Days)
                </Typography>
                <Tooltip title="Daily view count since the video was published. The chart shows how your video's popularity has grown over time." placement="top" arrow>
                  <HelpOutline sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
                </Tooltip>
              </Box>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={viewsOverTime}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF0000" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#FF0000" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <ChartTooltip 
                    formatter={(value: any) => formatNumber(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stroke="#FF0000" 
                    fillOpacity={1} 
                    fill="url(#colorViews)"
                    strokeWidth={2}
                    name="Views"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </>
        )}

        {/* Thumbnail */}
        {episode.youtubeThumbnailUrl && (
          <Box mt={3}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Video Thumbnail
            </Typography>
            <img 
              src={episode.youtubeThumbnailUrl} 
              alt="YouTube Thumbnail"
              style={{ 
                width: '100%', 
                maxWidth: 480,
                height: 'auto',
                borderRadius: 8
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  )
}