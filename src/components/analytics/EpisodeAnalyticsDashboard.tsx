'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Download,
  People,
  PlayCircle,
  AttachMoney,
  Share,
  ThumbUp,
  Comment,
  AccessTime
} from '@mui/icons-material'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import { format } from 'date-fns'
import { analyticsApiService } from '@/services/analytics-api'

interface EpisodeAnalyticsDashboardProps {
  episodeId: string
  episodeTitle?: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

export function EpisodeAnalyticsDashboard({ episodeId, episodeTitle }: EpisodeAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [selectedTab, setSelectedTab] = useState(0)

  // Fetch episode analytics summary
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['episode-analytics', episodeId, timeRange],
    queryFn: () => analyticsApiService.getEpisodeAnalytics(episodeId, { period: timeRange }),
    enabled: !!episodeId,
    staleTime: 5 * 60 * 1000
  })

  // Fetch trends data
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['episode-trends', episodeId, timeRange],
    queryFn: () => analyticsApiService.getEpisodeTrends(episodeId, { period: timeRange }),
    enabled: !!episodeId,
    staleTime: 5 * 60 * 1000
  })

  const isLoading = analyticsLoading || trendsLoading

  // Prepare platform data for pie chart
  const platformData = analytics ? [
    { name: 'Spotify', value: analytics.platformBreakdown.spotify, color: '#1DB954' },
    { name: 'Apple Podcasts', value: analytics.platformBreakdown.apple, color: '#A855F7' },
    { name: 'Google Podcasts', value: analytics.platformBreakdown.google, color: '#4285F4' },
    { name: 'Other', value: analytics.platformBreakdown.other, color: '#6B7280' }
  ].filter(item => item.value > 0) : []

  // Format trends data for line charts
  const chartData = trends?.map(trend => ({
    ...trend,
    date: format(new Date(trend.date), 'MMM d')
  })) || []

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp color="success" fontSize="small" />
    if (change < 0) return <TrendingDown color="error" fontSize="small" />
    return null
  }

  const getTrendColor = (change: number) => {
    if (change > 0) return 'success.main'
    if (change < 0) return 'error.main'
    return 'text.secondary'
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!analytics) {
    return (
      <Alert severity="info">
        No analytics data available for this episode yet.
      </Alert>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Analytics {episodeTitle && `- ${episodeTitle}`}
        </Typography>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={(e, value) => value && setTimeRange(value)}
          size="small"
        >
          <ToggleButton value="7d">7 days</ToggleButton>
          <ToggleButton value="30d">30 days</ToggleButton>
          <ToggleButton value="90d">90 days</ToggleButton>
          <ToggleButton value="1y">1 year</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Downloads
                  </Typography>
                  <Typography variant="h5">
                    {formatNumber(analytics.totalDownloads)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getTrendIcon(analytics.trends.downloadsChange)}
                    <Typography 
                      variant="body2" 
                      color={getTrendColor(analytics.trends.downloadsChange)}
                    >
                      {analytics.trends.downloadsChange > 0 ? '+' : ''}{analytics.trends.downloadsChange.toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>
                <Download color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Unique Listeners
                  </Typography>
                  <Typography variant="h5">
                    {formatNumber(analytics.totalListeners)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getTrendIcon(analytics.trends.listenersChange)}
                    <Typography 
                      variant="body2" 
                      color={getTrendColor(analytics.trends.listenersChange)}
                    >
                      {analytics.trends.listenersChange > 0 ? '+' : ''}{analytics.trends.listenersChange.toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>
                <People color="info" sx={{ fontSize: 40, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Completion Rate
                  </Typography>
                  <Typography variant="h5">
                    {analytics.avgCompletionRate.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatNumber(analytics.totalCompletions)} completions
                  </Typography>
                </Box>
                <PlayCircle color="success" sx={{ fontSize: 40, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Revenue
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(analytics.totalRevenue)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getTrendIcon(analytics.trends.revenueChange)}
                    <Typography 
                      variant="body2" 
                      color={getTrendColor(analytics.trends.revenueChange)}
                    >
                      {analytics.trends.revenueChange > 0 ? '+' : ''}{analytics.trends.revenueChange.toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>
                <AttachMoney color="warning" sx={{ fontSize: 40, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Paper sx={{ p: 3 }}>
        <Tabs value={selectedTab} onChange={(e, value) => setSelectedTab(value)} sx={{ mb: 3 }}>
          <Tab label="Performance Trends" />
          <Tab label="Platform Distribution" />
          <Tab label="Engagement Metrics" />
        </Tabs>

        {selectedTab === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Downloads & Listeners Over Time
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value, name) => [formatNumber(Number(value)), name]} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="downloads" 
                  stroke="#0088FE" 
                  name="Downloads"
                  strokeWidth={3}
                />
                <Line 
                  type="monotone" 
                  dataKey="listeners" 
                  stroke="#00C49F" 
                  name="Unique Listeners"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {selectedTab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Listening Platform Distribution
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={platformData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {platformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                  {platformData.map((platform, index) => (
                    <Box key={platform.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box 
                          sx={{ 
                            width: 16, 
                            height: 16, 
                            backgroundColor: platform.color || COLORS[index % COLORS.length],
                            borderRadius: 1 
                          }} 
                        />
                        <Typography variant="body2">{platform.name}</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="bold">
                        {formatNumber(platform.value)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {selectedTab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Engagement Metrics
            </Typography>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Share color="primary" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h5">{analytics.engagement.totalShares}</Typography>
                    <Typography variant="body2" color="text.secondary">Shares</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <ThumbUp color="success" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h5">{analytics.engagement.totalLikes}</Typography>
                    <Typography variant="body2" color="text.secondary">Likes</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Comment color="info" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h5">{analytics.engagement.totalComments}</Typography>
                    <Typography variant="body2" color="text.secondary">Comments</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            <Typography variant="h6" gutterBottom>
              Revenue Trends
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Revenue"]} />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#FFBB28" 
                  fill="#FFBB28" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Paper>
    </Box>
  )
}