'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Skeleton,
} from '@mui/material'
import {
  ArrowBack,
  Download,
  TrendingUp,
  TrendingDown,
  People,
  PlayCircle,
  AttachMoney,
  Assessment,
  CalendarMonth,
  LocationOn,
  DevicesOther,
} from '@mui/icons-material'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ChartContainer } from '@/components/charts/ChartContainer'
import { queryKeys } from '@/config/queryClient'
import { api } from '@/services/api'
import { Rating } from '@mui/material'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function ShowAnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const showId = params.id as string

  const [timeRange, setTimeRange] = useState('30d')
  const [metricType, setMetricType] = useState('all')

  // Fetch show details
  const { data: show, isLoading: showLoading } = useQuery({
    queryKey: [...queryKeys.shows.detail(showId), 'details'],
    queryFn: async () => {
      const res = await fetch(`/api/shows/${showId}`)
      if (!res.ok) throw new Error('Failed to fetch show')
      return res.json()
    }
  })

  // Fetch real analytics data
  const { data: showAnalytics, isLoading: showAnalyticsLoading } = useQuery({
    queryKey: ['show', 'analytics', showId, timeRange],
    queryFn: async () => {
      const response = await api.get(`/api/analytics/shows/${showId}`, {
        params: { periodType: 'monthly' }
      })
      return response.data
    },
    staleTime: 5 * 60 * 1000
  })

  // Fetch analytics trends
  const { data: downloadTrends } = useQuery({
    queryKey: ['show', 'trends', showId, timeRange],
    queryFn: async () => {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365
      const response = await api.get(`/api/analytics/shows/${showId}/trends`, {
        params: { metric: 'downloads', periodType: 'daily', periods: days }
      })
      return response.data.trends
    },
    staleTime: 5 * 60 * 1000
  })

  // Fetch episodes for this show
  const { data: episodes = [], isLoading: episodesLoading } = useQuery({
    queryKey: [...queryKeys.shows.detail(showId), 'episodes'],
    queryFn: async () => {
      const res = await fetch(`/api/episodes?showId=${showId}`)
      if (!res.ok) throw new Error('Failed to fetch episodes')
      const data = await res.json()
      return data.episodes || []
    }
  })

  const isLoading = showLoading || showAnalyticsLoading || episodesLoading

  // Calculate metrics from real analytics data
  const metrics = {
    totalDownloads: showAnalytics?.downloads || 0,
    totalStreams: showAnalytics?.streams || 0,
    uniqueListeners: showAnalytics?.uniqueListeners || 0,
    totalRevenue: showAnalytics?.totalRevenue || 0,
    avgRating: showAnalytics?.avgRating || 0,
    downloadGrowth: showAnalytics?.audienceGrowth || 0,
    listenerGrowth: showAnalytics?.audienceGrowth || 0,
    revenueGrowth: 0,
  }

  // Transform episodes data for top episodes table
  const topEpisodes = episodes
    .slice(0, 5)
    .map((episode: any) => ({
      title: episode.title,
      downloads: episode.downloads || 0, // Real data from episode analytics
      revenue: episode.revenue || 0, // Real data from episode analytics
      rating: episode.rating || '0.0', // Real data from episode ratings
    }))

  // Use only real performance trend data from analytics
  const performanceData = analytics?.performanceTrend || []

  // Default data structures for empty states
  const audienceData = analytics?.audienceData || [
    { name: '18-24', value: 0 },
    { name: '25-34', value: 0 },
    { name: '35-44', value: 0 },
    { name: '45-54', value: 0 },
    { name: '55+', value: 0 },
  ]

  const platformData = analytics?.platformData || [
    { name: 'Apple Podcasts', value: 0 },
    { name: 'Spotify', value: 0 },
    { name: 'Google Podcasts', value: 0 },
    { name: 'Website', value: 0 },
    { name: 'Other', value: 0 },
  ]

  const geographicData = analytics?.geographicData || [
    { country: 'No data', listeners: 0, percentage: 0 },
  ]

  const advertisingMetrics = analytics?.advertisingMetrics || {
    totalAdSlots: 0,
    filledSlots: 0,
    fillRate: 0,
    avgCPM: 0,
    totalRevenue: 0,
    topAdvertiser: 'N/A',
    repeatAdvertisers: 0,
  }

  const showName = show?.name || 'Loading...'

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Skeleton variant="text" width={300} height={40} />
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {[1, 2, 3, 4].map((i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Skeleton variant="rectangular" height={120} />
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} lg={8}>
              <Skeleton variant="rectangular" height={350} />
            </Grid>
            <Grid item xs={12} lg={4}>
              <Skeleton variant="rectangular" height={350} />
            </Grid>
          </Grid>
        </Box>
      </DashboardLayout>
    )
  }

  const handleExportReport = () => {
    // TODO: Implement export functionality
    console.log('Exporting report...')
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push(`/shows/${showId}`)} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {showName} - Analytics
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Performance metrics, audience insights, and revenue analytics
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(_, newValue) => newValue && setTimeRange(newValue)}
              size="small"
            >
              <ToggleButton value="7d">7 Days</ToggleButton>
              <ToggleButton value="30d">30 Days</ToggleButton>
              <ToggleButton value="90d">90 Days</ToggleButton>
              <ToggleButton value="1y">1 Year</ToggleButton>
            </ToggleButtonGroup>
            <Button startIcon={<Download />} variant="outlined" onClick={handleExportReport}>
              Export Report
            </Button>
          </Box>
        </Box>

        {/* Key Metrics */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Downloads
                    </Typography>
                    <Typography variant="h5">
                      {metrics.totalDownloads > 1000 
                        ? `${(metrics.totalDownloads / 1000).toFixed(1)}K`
                        : metrics.totalDownloads}
                    </Typography>
                    {metrics.downloadGrowth !== 0 && (
                      <Chip
                        label={`${metrics.downloadGrowth > 0 ? '+' : ''}${metrics.downloadGrowth}%`}
                        size="small"
                        color={metrics.downloadGrowth > 0 ? 'success' : 'error'}
                        icon={metrics.downloadGrowth > 0 ? <TrendingUp /> : <TrendingDown />}
                      />
                    )}
                  </Box>
                  <PlayCircle color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
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
                      {metrics.uniqueListeners > 1000 
                        ? `${(metrics.uniqueListeners / 1000).toFixed(1)}K`
                        : metrics.uniqueListeners}
                    </Typography>
                    {metrics.listenerGrowth !== 0 && (
                      <Chip
                        label={`${metrics.listenerGrowth > 0 ? '+' : ''}${metrics.listenerGrowth}%`}
                        size="small"
                        color={metrics.listenerGrowth > 0 ? 'success' : 'error'}
                        icon={metrics.listenerGrowth > 0 ? <TrendingUp /> : <TrendingDown />}
                      />
                    )}
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
                      Revenue
                    </Typography>
                    <Typography variant="h5">
                      ${metrics.totalRevenue > 1000 
                        ? `${(metrics.totalRevenue / 1000).toFixed(1)}K`
                        : metrics.totalRevenue}
                    </Typography>
                    {metrics.revenueGrowth !== 0 && (
                      <Chip
                        label={`${metrics.revenueGrowth > 0 ? '+' : ''}${metrics.revenueGrowth}%`}
                        size="small"
                        color={metrics.revenueGrowth > 0 ? 'success' : 'error'}
                        icon={metrics.revenueGrowth > 0 ? <TrendingUp /> : <TrendingDown />}
                      />
                    )}
                  </Box>
                  <AttachMoney color="success" sx={{ fontSize: 40, opacity: 0.3 }} />
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
                      Avg. Rating
                    </Typography>
                    <Typography variant="h5">
                      {metrics.avgRating > 0 ? `${metrics.avgRating}/5` : 'N/A'}
                    </Typography>
                    {metrics.avgRating >= 4.5 && (
                      <Chip
                        label="Excellent"
                        size="small"
                        color="primary"
                      />
                    )}
                  </Box>
                  <Assessment color="warning" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Empty State Alert */}
        {metrics.totalDownloads === 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            No analytics data available yet. Analytics will appear once your show has episodes and listeners.
          </Alert>
        )}

        {/* Charts Grid */}
        <Grid container spacing={3}>
          {/* Performance Trend */}
          <Grid item xs={12} lg={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Performance Trend
              </Typography>
              <ChartContainer height={300}>
                <AreaChart data={performanceData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="downloads" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="listens" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                  <Line type="monotone" dataKey="revenue" stroke="#ffc658" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </Paper>
          </Grid>

          {/* Audience Demographics */}
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Audience by Age
              </Typography>
              {audienceData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={audienceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {audienceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary">No audience data available</Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Platform Distribution */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Listening Platforms
              </Typography>
              {platformData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={platformData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary">No platform data available</Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Geographic Distribution */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Geographic Distribution
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Country</TableCell>
                      <TableCell align="right">Listeners</TableCell>
                      <TableCell align="right">Percentage</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {geographicData.length > 0 && geographicData[0].listeners > 0 ? (
                      geographicData.map((row) => (
                        <TableRow key={row.country}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LocationOn fontSize="small" color="action" />
                              {row.country}
                            </Box>
                          </TableCell>
                          <TableCell align="right">{row.listeners.toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Chip label={`${row.percentage}%`} size="small" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          <Typography color="text.secondary" sx={{ py: 2 }}>
                            No geographic data available
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Top Episodes */}
          <Grid item xs={12} lg={7}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Top Episodes by Downloads
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Episode Title</TableCell>
                      <TableCell align="right">Downloads</TableCell>
                      <TableCell align="right">Revenue</TableCell>
                      <TableCell align="right">Rating</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topEpisodes.length > 0 ? (
                      topEpisodes.map((episode, index) => (
                        <TableRow key={index}>
                          <TableCell>{episode.title}</TableCell>
                          <TableCell align="right">{episode.downloads.toLocaleString()}</TableCell>
                          <TableCell align="right">${episode.revenue.toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={episode.rating} 
                              size="small" 
                              color={parseFloat(episode.rating) >= 4.5 ? 'success' : 'default'}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography color="text.secondary" sx={{ py: 2 }}>
                            No episodes available
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Advertising Metrics */}
          <Grid item xs={12} lg={5}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Advertising Performance
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Ad Fill Rate</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {advertisingMetrics.fillRate}%
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Average CPM</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    ${advertisingMetrics.avgCPM}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Total Ad Revenue</Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">
                    ${advertisingMetrics.totalRevenue.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Top Advertiser</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {advertisingMetrics.topAdvertiser}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Repeat Advertisers</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {advertisingMetrics.repeatAdvertisers}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  )
}