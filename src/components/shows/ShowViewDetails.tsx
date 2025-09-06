'use client'

/**
 * Enhanced Show View Details Component
 * Displays real YouTube and Megaphone metrics with proper error handling
 * and connection status indicators
 */

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  Button,
  Stack,
  Divider,
  Skeleton,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  Visibility,
  CloudDownload,
  ThumbUp,
  Comment,
  People,
  Timer,
  TrendingUp,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Refresh,
  Settings,
  YouTube,
  Headphones,
} from '@mui/icons-material'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format } from 'date-fns'

interface ShowViewDetailsProps {
  showId: string
  dateRange?: '30d' | '90d' | 'custom'
  startDate?: string
  endDate?: string
  onRefresh?: () => void
}

interface MetricsData {
  show: {
    id: string
    name: string
    externalIds: {
      youtubeChannelId?: string
      youtubePlaylistId?: string
      megaphoneShowId?: string
    }
  }
  totals: {
    youtubeViews: number | null
    megaphoneDownloads: number | null
    likes: number | null
    comments: number | null
    avgViewDurationSec: number | null
    uniqueViewers: number | null
    uniqueListeners: number | null
    subscriberCount: number | null
  }
  timeseries: {
    daily: Array<{
      date: string
      youtubeViews?: number
      megaphoneDownloads?: number
      likes?: number
      comments?: number
      uniqueListeners?: number
    }>
  }
  engagement: {
    likeRate: number | null
    commentRate: number | null
    viewThroughRate: number | null
    listenThroughRate: number | null
  }
  freshness: {
    youtubeUpdatedAt?: string
    megaphoneUpdatedAt?: string
  }
  status: {
    youtubeConnected: boolean
    megaphoneConnected: boolean
    youtubeOAuthRequired: boolean
    partialData: boolean
    errors: string[]
  }
}

// Format number with K/M suffix
function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toLocaleString()
}

// Format duration from seconds
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return 'N/A'
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Format percentage
function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A'
  return `${value.toFixed(1)}%`
}

export default function ShowViewDetails({
  showId,
  dateRange = '30d',
  startDate,
  endDate,
  onRefresh,
}: ShowViewDetailsProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch metrics data using v2 endpoint
  const { data: metrics, isLoading, error, refetch } = useQuery<MetricsData>({
    queryKey: ['show-metrics-v2', showId, dateRange, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        window: dateRange,
      })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/shows/${showId}/metrics/v2?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false,
  })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    onRefresh?.()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  if (isLoading) {
    return (
      <Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" height={40} />
                  <Skeleton variant="text" width="80%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Error Loading Metrics</AlertTitle>
        {(error as Error).message}
      </Alert>
    )
  }

  if (!metrics) {
    return null
  }

  // Connection status banners
  const showConnectionBanners = !metrics.status.youtubeConnected || !metrics.status.megaphoneConnected

  return (
    <Box>
      {/* Connection Status Banners */}
      {showConnectionBanners && (
        <Stack spacing={2} sx={{ mb: 3 }}>
          {!metrics.status.youtubeConnected && metrics.show.externalIds.youtubeChannelId && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  href="/settings/integrations/youtube"
                  startIcon={<Settings />}
                >
                  Connect YouTube
                </Button>
              }
            >
              YouTube not connected. Configure API credentials to see YouTube metrics.
            </Alert>
          )}
          
          {metrics.status.youtubeOAuthRequired && (
            <Alert
              severity="info"
              action={
                <Button
                  color="inherit"
                  size="small"
                  href="/settings/integrations/youtube"
                  startIcon={<Settings />}
                >
                  Enable OAuth
                </Button>
              }
            >
              YouTube OAuth required for advanced metrics (view duration, demographics).
            </Alert>
          )}
          
          {!metrics.status.megaphoneConnected && metrics.show.externalIds.megaphoneShowId && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  href="/settings/integrations/megaphone"
                  startIcon={<Settings />}
                >
                  Connect Megaphone
                </Button>
              }
            >
              Megaphone not connected. Configure API credentials to see download metrics.
            </Alert>
          )}
        </Stack>
      )}

      {/* Refresh Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <IconButton
          onClick={handleRefresh}
          disabled={isRefreshing}
          color="primary"
        >
          <Refresh className={isRefreshing ? 'rotating' : ''} />
        </IconButton>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* YouTube Views */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <YouTube sx={{ mr: 1, color: '#FF0000' }} />
                <Typography variant="h6">Total Views</Typography>
              </Box>
              <Typography variant="h4">
                {formatCompactNumber(metrics.totals.youtubeViews)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {metrics.status.youtubeConnected ? (
                  <Chip
                    icon={<CheckCircle />}
                    label="Connected"
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                ) : (
                  <Chip
                    icon={<Warning />}
                    label="Not Connected"
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Megaphone Downloads */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Headphones sx={{ mr: 1, color: '#1DB954' }} />
                <Typography variant="h6">Total Downloads</Typography>
              </Box>
              <Typography variant="h4">
                {formatCompactNumber(metrics.totals.megaphoneDownloads)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {metrics.status.megaphoneConnected ? (
                  <Chip
                    icon={<CheckCircle />}
                    label="Connected"
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                ) : (
                  <Chip
                    icon={<Warning />}
                    label="Not Connected"
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Engagement */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ThumbUp sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Engagement</Typography>
              </Box>
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  <strong>{formatCompactNumber(metrics.totals.likes)}</strong> likes
                </Typography>
                <Typography variant="body2">
                  <strong>{formatCompactNumber(metrics.totals.comments)}</strong> comments
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatPercentage(metrics.engagement.likeRate)} like rate
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Completion Rates */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Timer sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Completion</Typography>
              </Box>
              <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Video
                  </Typography>
                  <Typography variant="h6">
                    {formatPercentage(metrics.engagement.viewThroughRate)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Audio
                  </Typography>
                  <Typography variant="h6">
                    {formatPercentage(metrics.engagement.listenThroughRate)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Additional Metrics Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Subscribers */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <People sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="subtitle1">Subscribers</Typography>
              </Box>
              <Typography variant="h5">
                {formatCompactNumber(metrics.totals.subscriberCount)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Avg View Duration */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Timer sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="subtitle1">Avg Duration</Typography>
              </Box>
              <Typography variant="h5">
                {formatDuration(metrics.totals.avgViewDurationSec)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Unique Viewers */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Visibility sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle1">Unique Viewers</Typography>
              </Box>
              <Typography variant="h5">
                {formatCompactNumber(metrics.totals.uniqueViewers)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Unique Listeners */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Headphones sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="subtitle1">Unique Listeners</Typography>
              </Box>
              <Typography variant="h5">
                {formatCompactNumber(metrics.totals.uniqueListeners)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Timeseries Chart */}
      {metrics.timeseries.daily.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Daily Trends
            </Typography>
            <Box sx={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={metrics.timeseries.daily}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => format(new Date(date), 'MMM d')}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCompactNumber(value)}
                  />
                  <ChartTooltip
                    labelFormatter={(date) => format(new Date(date), 'PPP')}
                    formatter={(value: number) => formatCompactNumber(value)}
                  />
                  <Legend />
                  {metrics.status.youtubeConnected && (
                    <Line
                      type="monotone"
                      dataKey="youtubeViews"
                      name="YouTube Views"
                      stroke="#FF0000"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  {metrics.status.megaphoneConnected && (
                    <Line
                      type="monotone"
                      dataKey="megaphoneDownloads"
                      name="Downloads"
                      stroke="#1DB954"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </Box>
            
            {/* Data Freshness */}
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              {metrics.freshness.youtubeUpdatedAt && (
                <Typography variant="caption" color="text.secondary">
                  YouTube updated: {format(new Date(metrics.freshness.youtubeUpdatedAt), 'p')}
                </Typography>
              )}
              {metrics.freshness.megaphoneUpdatedAt && (
                <Typography variant="caption" color="text.secondary">
                  Megaphone updated: {format(new Date(metrics.freshness.megaphoneUpdatedAt), 'p')}
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Error Messages */}
      {metrics.status.errors.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <AlertTitle>Data Issues</AlertTitle>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {metrics.status.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      <style jsx>{`
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .rotating {
          animation: rotate 1s linear infinite;
        }
      `}</style>
    </Box>
  )
}