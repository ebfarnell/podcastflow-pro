'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AdminOnly } from '@/components/auth/RoleGuard'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  TextField,
  Button,
  Alert,
  Divider,
  LinearProgress,
  Chip,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ButtonGroup,
  Tooltip as MuiTooltip
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  People,
  Download,
  Headphones,
  AttachMoney,
  Update,
  Sync,
  DateRange,
  CalendarToday,
  Analytics,
  CloudDownload,
  PlayCircle,
  GraphicEq,
  Info,
  Visibility,
  Speed
} from '@mui/icons-material'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, ReferenceDot } from 'recharts'
import { format } from 'date-fns'
import { DateRangeSelector } from '@/components/common/DateRangeSelector'
import dayjs, { Dayjs } from 'dayjs'
import { getDateRange, getDateRangeLabel, DATE_RANGE_OPTIONS } from '@/lib/utils/dateRanges'

interface ShowMetrics {
  id: string
  showId: string
  showName?: string
  // YouTube metrics
  totalYoutubeViews?: number
  totalYoutubeLikes?: number
  totalYoutubeComments?: number
  avgYoutubeViews?: number
  avgYoutubeLikes?: number
  avgYoutubeComments?: number
  episodesWithYoutubeData?: number
  // Core metrics
  totalSubscribers: number
  newSubscribers: number
  lostSubscribers: number
  subscriberGrowth: number
  averageListeners: number
  totalDownloads: number
  monthlyDownloads: number
  weeklyDownloads?: number
  avgEpisodeDownloads?: number
  averageCompletion: number
  totalRevenue: number
  monthlyRevenue: number
  averageCPM: number
  totalEpisodes: number
  publishedEpisodes: number
  recentEpisodes?: number
  averageEpisodeLength: number
  socialShares: number
  socialMentions: number
  sentimentScore: number
  youtubeListeners?: number
  spotifyListeners: number
  appleListeners: number
  googleListeners: number
  otherListeners: number
  demographics?: any
  lastUpdated: string
  timestamp?: string
  correlationId?: string
}

// Helper function to format large numbers intelligently
function formatMetricNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (value >= 100000) {
    return `${(value / 1000).toFixed(0)}K`
  } else if (value >= 10000) {
    return `${(value / 1000).toFixed(1)}K`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  } else {
    return value.toLocaleString()
  }
}

// Helper functions are now imported from dateRanges.ts

interface SubscriberHistory {
  date: string
  subscribers: number
  dailyChange: number
  weeklyChange: number
  monthlyChange: number
  growthRate: number
  churnRate: number
}

const PLATFORM_COLORS = {
  youtube: '#FF0000',
  spotify: '#1DB954',
  apple: '#FC3C44',
  google: '#4285F4',
  other: '#666666'
}

export default function ShowMetricsPage() {
  const params = useParams()
  const showId = params.id as string
  const queryClient = useQueryClient()
  const [updateForm, setUpdateForm] = useState({
    totalSubscribers: '',
    monthlyDownloads: '',
    averageListeners: '',
    averageCompletion: ''
  })

  // Date filtering state
  const [dateRange, setDateRange] = useState('last30Days')
  const [customStartDate, setCustomStartDate] = useState<Dayjs | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Dayjs | null>(null)

  // Fetch show details
  const { data: show } = useQuery({
    queryKey: ['show', showId],
    queryFn: async () => {
      const response = await fetch(`/api/shows/${showId}`)
      if (!response.ok) throw new Error('Failed to fetch show')
      return response.json()
    }
  })

  // Helper to calculate date range
  const getDateRangeParams = () => {
    const range = getDateRange(dateRange, customStartDate, customEndDate)
    return `?startDate=${range.startDate}&endDate=${range.endDate}`
  }

  // Fetch show metrics
  const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['show-metrics', showId, dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      const dateParams = getDateRangeParams()
      const response = await fetch(`/api/shows/${showId}/metrics${dateParams}`)
      if (!response.ok) {
        const error = await response.json()
        console.error('Metrics API error:', error)
        throw new Error(error.message || 'Failed to fetch metrics')
      }
      const data = await response.json()
      console.log('Metrics data received:', data)
      return data
    },
    refetchInterval: false
  })


  // Fetch subscriber history
  const { data: historyData } = useQuery({
    queryKey: ['subscriber-history', showId, dateRange, customStartDate?.format('YYYY-MM-DD'), customEndDate?.format('YYYY-MM-DD')],
    queryFn: async () => {
      const dateParams = getDateRangeParams()
      const response = await fetch(`/api/shows/${showId}/metrics/history${dateParams}`)
      if (!response.ok) throw new Error('Failed to fetch history')
      return response.json()
    }
  })

  // Fetch enhanced summary with downloads and completion rates
  const { data: summaryData } = useQuery({
    queryKey: ['show-metrics-summary', showId, dateRange, customStartDate?.format('YYYY-MM-DD'), customEndDate?.format('YYYY-MM-DD')],
    queryFn: async () => {
      const dateParams = getDateRangeParams()
      const response = await fetch(`/api/shows/${showId}/metrics/summary${dateParams.replace('startDate', 'start').replace('endDate', 'end')}`)
      if (!response.ok) throw new Error('Failed to fetch summary')
      return response.json()
    }
  })

  // Fetch daily trend data for views/listens
  const { data: trendData } = useQuery({
    queryKey: ['show-metrics-trend', showId, dateRange, customStartDate?.format('YYYY-MM-DD'), customEndDate?.format('YYYY-MM-DD')],
    queryFn: async () => {
      const dateParams = getDateRangeParams()
      const response = await fetch(`/api/shows/${showId}/metrics/daily-trend${dateParams.replace('startDate', 'start').replace('endDate', 'end')}`)
      if (!response.ok) throw new Error('Failed to fetch trend')
      return response.json()
    }
  })

  // Update metrics mutation
  const updateMetrics = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/shows/${showId}/metrics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to update metrics')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['show-metrics', showId] })
      queryClient.invalidateQueries({ queryKey: ['subscriber-history', showId] })
      setUpdateForm({
        totalSubscribers: '',
        monthlyDownloads: '',
        averageListeners: '',
        averageCompletion: ''
      })
    }
  })

  // Sync platform metrics
  const syncPlatform = useMutation({
    mutationFn: async (platform: string) => {
      const response = await fetch(`/api/shows/${showId}/metrics/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          data: {
            listeners: 0, // TODO: Integrate with real Megaphone API
            downloads: 0  // TODO: Integrate with real Megaphone API
          }
        })
      })
      if (!response.ok) throw new Error('Failed to sync platform')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['show-metrics', showId] })
    }
  })

  // Sync YouTube data
  const syncYouTubeData = async () => {
    try {
      const response = await fetch('/api/youtube/sync-channel-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sync YouTube data')
      }
      
      const result = await response.json()
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['show-metrics', showId] })
      queryClient.invalidateQueries({ queryKey: ['subscriber-history', showId] })
      
      // Show success message (you might want to add a snackbar/toast here)
      console.log('YouTube data synced successfully:', result)
    } catch (error) {
      console.error('Failed to sync YouTube data:', error)
      // Show error message (you might want to add a snackbar/toast here)
    }
  }

  // The API returns the metrics directly, not wrapped in a metrics property
  const metrics = metricsData as ShowMetrics
  const history = historyData?.history as SubscriberHistory[]

  // Prepare platform distribution data
  const platformData = metrics ? [
    { name: 'YouTube', value: metrics.youtubeListeners || metrics.totalYoutubeViews || 0, color: PLATFORM_COLORS.youtube },
    { name: 'Spotify', value: metrics.spotifyListeners, color: PLATFORM_COLORS.spotify },
    { name: 'Apple', value: metrics.appleListeners, color: PLATFORM_COLORS.apple },
    { name: 'Google', value: metrics.googleListeners, color: PLATFORM_COLORS.google },
    { name: 'Other', value: metrics.otherListeners, color: PLATFORM_COLORS.other }
  ].filter(p => p.value > 0) : []

  const handleUpdateSubmit = () => {
    const updates: any = {}
    if (updateForm.totalSubscribers) updates.totalSubscribers = parseInt(updateForm.totalSubscribers)
    if (updateForm.monthlyDownloads) updates.monthlyDownloads = parseInt(updateForm.monthlyDownloads)
    if (updateForm.averageListeners) updates.averageListeners = parseInt(updateForm.averageListeners)
    if (updateForm.averageCompletion) updates.averageCompletion = parseFloat(updateForm.averageCompletion)
    
    if (Object.keys(updates).length > 0) {
      updateMetrics.mutate(updates)
    }
  }

  return (
    <DashboardLayout>
      <AdminOnly>
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" gutterBottom>
              Show Metrics: {show?.name || 'Loading...'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last updated: {metrics ? format(new Date(metrics.lastUpdated), 'PPpp') : 'Never'}
            </Typography>
          </Box>

          {/* Date Filtering */}
          <Box sx={{ mb: 4 }}>
            <DateRangeSelector
              value={dateRange}
              onChange={setDateRange}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomDateChange={(start, end) => {
                setCustomStartDate(start)
                setCustomEndDate(end)
              }}
            />
          </Box>

          {metricsError ? (
            <Alert severity="error" sx={{ mb: 3 }}>
              Error loading metrics: {metricsError.message}
            </Alert>
          ) : metricsLoading ? (
            <LinearProgress />
          ) : metrics ? (
            <>
              {/* Core Metrics - Two Row Layout */}
              {metrics.totalYoutubeViews && metrics.totalYoutubeViews > 0 && (
                <>
                  <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                    Show Metrics
                  </Typography>
                  
                  {/* First Row - Reorganized Primary Metrics */}
                  <Grid container spacing={3} sx={{ mb: 4 }}>
                    {/* Total Episodes - First */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                              <Headphones sx={{ mr: 1, color: 'primary.main' }} />
                              <Typography variant="h6">Total Episodes</Typography>
                            </Box>
                            <Typography variant="h4">{metrics.totalEpisodes.toLocaleString()}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {metrics.recentEpisodes} published recently
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Total Views - Second */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                              <Visibility sx={{ mr: 1, color: 'primary.main' }} />
                              <Typography variant="h6">Total Views</Typography>
                            </Box>
                            <Typography variant="h4">
                              {formatMetricNumber(metrics.totalYoutubeViews)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Avg: {formatMetricNumber(metrics.avgYoutubeViews)} per episode
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Total Downloads - Third */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                              <CloudDownload sx={{ mr: 1, color: 'primary.main' }} />
                              <Typography variant="h6">Total Downloads</Typography>
                            </Box>
                            <Typography variant="h4">
                              {formatMetricNumber(summaryData?.totals?.totalDownloads || metrics.totalDownloads || 0)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Avg: {formatMetricNumber(metrics.avgEpisodeDownloads || 0)} per episode
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Completion Rates - Fourth */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Speed sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="h6">Completion Rates</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                            <MuiTooltip 
                              title={
                                <Box>
                                  <Typography variant="body2" sx={{ mb: 1 }}>
                                    View-through Rate (YouTube): Average % of video watched
                                  </Typography>
                                  {summaryData?.rates?.vtr?.value > 0 ? (
                                    <Typography variant="body2">
                                      Coverage: {summaryData?.rates?.vtr?.coveragePct?.toFixed(0) || 0}% of episodes
                                    </Typography>
                                  ) : (
                                    <>
                                      <Typography variant="body2" sx={{ mb: 1, color: 'warning.light' }}>
                                        ⚠️ OAuth2 configuration required for VTR data
                                      </Typography>
                                      <Typography 
                                        variant="body2" 
                                        component="a" 
                                        href="/settings/integrations/youtube"
                                        sx={{ 
                                          color: 'primary.light', 
                                          textDecoration: 'underline',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Configure OAuth2 in Settings → Integrations → YouTube
                                      </Typography>
                                    </>
                                  )}
                                </Box>
                              }
                            >
                              <Box sx={{ textAlign: 'center', cursor: 'help' }}>
                                <Typography variant="subtitle2" color="text.secondary">
                                  VTR
                                  {summaryData?.rates?.vtr?.value === 0 && (
                                    <Info sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', color: 'warning.main' }} />
                                  )}
                                </Typography>
                                <Typography 
                                  variant="h5"
                                  color={summaryData?.rates?.vtr?.value > 0 ? 'inherit' : 'text.disabled'}
                                >
                                  {summaryData?.rates?.vtr?.value > 0 
                                    ? `${summaryData?.rates?.vtr?.value?.toFixed(1)}%`
                                    : 'N/A'}
                                </Typography>
                              </Box>
                            </MuiTooltip>
                            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                            <MuiTooltip title={`Listen-through Rate (Megaphone): ${summaryData?.rates?.ltr?.value > 0 ? 'From Megaphone API' : 'No Megaphone data connected'}. Coverage: ${summaryData?.rates?.ltr?.coveragePct?.toFixed(0) || 0}% of episodes`}>
                              <Box sx={{ textAlign: 'center', cursor: 'help' }}>
                                <Typography variant="subtitle2" color="text.secondary">LTR</Typography>
                                <Typography variant="h5" color={summaryData?.rates?.ltr?.value > 0 ? 'inherit' : 'text.disabled'}>
                                  {summaryData?.rates?.ltr?.value > 0 ? `${summaryData.rates.ltr.value.toFixed(1)}%` : 'N/A'}
                                </Typography>
                              </Box>
                            </MuiTooltip>
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                            Video & audio completion
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Second Row - Engagement & Megaphone Metrics */}
                  <Grid container spacing={3} sx={{ mb: 4 }}>
                    {/* Average Comments per Episode */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Analytics sx={{ mr: 1, color: 'success.main' }} />
                            <Typography variant="h6">Avg Comments/Episode</Typography>
                          </Box>
                          <Typography variant="h4">
                            {formatMetricNumber(metrics.avgYoutubeComments || 0)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {metrics.avgYoutubeViews > 0 
                              ? `${((metrics.avgYoutubeComments / metrics.avgYoutubeViews) * 100).toFixed(3)}% engagement`
                              : 'Community engagement'
                            }
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Average Likes per Episode with Engagement % */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <People sx={{ mr: 1, color: 'success.main' }} />
                            <Typography variant="h6">Avg Likes/Episode</Typography>
                          </Box>
                          <Typography variant="h4">
                            {formatMetricNumber(metrics.avgYoutubeLikes)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {metrics.avgYoutubeViews > 0 
                              ? `${((metrics.avgYoutubeLikes / metrics.avgYoutubeViews) * 100).toFixed(2)}% engagement`
                              : 'Per episode average'
                            }
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Megaphone Unique Listeners */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <GraphicEq sx={{ mr: 1, color: 'info.main' }} />
                            <Typography variant="h6">Unique Listeners</Typography>
                          </Box>
                          <Typography variant="h4">
                            {summaryData?.megaphone?.uniqueListeners ? 
                              formatMetricNumber(summaryData.megaphone.uniqueListeners) : 
                              'N/A'
                            }
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {summaryData?.megaphone?.uniqueListeners ? 'Megaphone data' : 'No Megaphone connection'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* YouTube Unique Viewers */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <People sx={{ mr: 1, color: 'info.main' }} />
                            <Typography variant="h6">Unique Viewers</Typography>
                          </Box>
                          <Typography variant="h4">
                            {summaryData?.youtube?.uniqueViewers ? 
                              formatMetricNumber(summaryData.youtube.uniqueViewers) : 
                              'N/A'
                            }
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {summaryData?.youtube?.uniqueViewers ? 'YouTube Analytics' : 'No YouTube data'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </>
              )}

              {/* Charts */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {/* Average Daily Views/Listens Chart */}
                <Grid item xs={12} md={8}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6">
                          Average Daily Views / Listens ({getDateRangeLabel(dateRange, customStartDate, customEndDate)})
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Chip 
                            label="Views" 
                            size="small" 
                            sx={{ backgroundColor: '#FF6B6B', color: 'white' }}
                          />
                          <Chip 
                            label="Listens" 
                            size="small" 
                            sx={{ backgroundColor: '#4ECDC4', color: 'white' }}
                          />
                        </Stack>
                      </Box>
                      {trendData?.days && trendData.days.length > 0 ? (
                        <Box sx={{ height: 300, mt: 2 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart 
                              data={trendData.days.map(d => ({
                                ...d,
                                avgViews: d.avgViews === null ? 0 : d.avgViews,
                                avgListens: d.avgListens === null ? 0 : d.avgListens
                              }))}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="date"
                                tickFormatter={(date) => format(new Date(date), 'MMM d')}
                              />
                              <YAxis 
                                domain={[0, 'dataMax']}
                                allowDataOverflow={false}
                                tickFormatter={(value) => {
                                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
                                  return Math.round(value).toLocaleString()
                                }}
                              />
                              <Tooltip
                                labelFormatter={(date) => format(new Date(date), 'PPP')}
                                formatter={(value: number | null, name: string) => {
                                  if (value === null) return ['No data', name]
                                  const outlier = name === 'avgViews' ? 
                                    trendData.outliers?.views?.find((o: any) => o.date === trendData.days.find((d: any) => d.avgViews === value)?.date) :
                                    trendData.outliers?.listens?.find((o: any) => o.date === trendData.days.find((d: any) => d.avgListens === value)?.date)
                                  const label = outlier ? `${Math.round(value).toLocaleString()} (Spike! z=${outlier.zscore})` : Math.round(value).toLocaleString()
                                  return [label, name === 'avgViews' ? 'Views' : 'Listens']
                                }}
                              />
                              <Legend 
                                verticalAlign="top" 
                                height={36}
                                iconType="line"
                                formatter={(value) => value === 'avgViews' ? 'Views' : 'Listens'}
                              />
                              <Line
                                type="monotone"
                                dataKey="avgViews"
                                stroke="#FF6B6B"
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                              />
                              <Line
                                type="monotone"
                                dataKey="avgListens"
                                stroke="#4ECDC4"
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                              />
                              {/* Mark outliers with dots */}
                              {trendData.outliers?.views?.map((outlier: any, idx: number) => {
                                const point = trendData.days.find((d: any) => d.date === outlier.date)
                                if (!point) return null
                                return (
                                  <ReferenceDot
                                    key={`view-outlier-${idx}`}
                                    x={outlier.date}
                                    y={outlier.value}
                                    r={5}
                                    fill="#FF6B6B"
                                    stroke="#FF6B6B"
                                  />
                                )
                              })}
                              {trendData.outliers?.listens?.map((outlier: any, idx: number) => {
                                const point = trendData.days.find((d: any) => d.date === outlier.date)
                                if (!point) return null
                                return (
                                  <ReferenceDot
                                    key={`listen-outlier-${idx}`}
                                    x={outlier.date}
                                    y={outlier.value}
                                    r={5}
                                    fill="#4ECDC4"
                                    stroke="#4ECDC4"
                                  />
                                )
                              })}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </Box>
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                          <Typography color="text.secondary">
                            {trendData ? 'No trend data available for this period' : 'Loading trend data...'}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Platform Distribution */}
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Platform Distribution
                      </Typography>
                      {platformData.length > 0 ? (
                        <Box sx={{ height: 300, mt: 2 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                              <Pie
                                data={platformData}
                                cx="50%"
                                cy="45%"
                                innerRadius={0}
                                outerRadius={65}
                                fill="#8884d8"
                                dataKey="value"
                                label={false}
                              >
                                {platformData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: number) => value.toLocaleString()}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                height={36}
                                formatter={(value, entry: any) => {
                                  const total = platformData.reduce((sum, item) => sum + item.value, 0)
                                  const percentage = total > 0 ? ((entry.payload.value / total) * 100).toFixed(0) : '0'
                                  return `${value} (${percentage}%)`
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </Box>
                      ) : (
                        <Typography color="text.secondary">No platform data available</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Update Metrics Form */}
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Update Metrics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        label="Total Subscribers"
                        type="number"
                        value={updateForm.totalSubscribers}
                        onChange={(e) => setUpdateForm({...updateForm, totalSubscribers: e.target.value})}
                        placeholder={metrics.totalSubscribers.toString()}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        label="Monthly Downloads"
                        type="number"
                        value={updateForm.monthlyDownloads}
                        onChange={(e) => setUpdateForm({...updateForm, monthlyDownloads: e.target.value})}
                        placeholder={metrics.monthlyDownloads.toString()}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        label="Average Listeners"
                        type="number"
                        value={updateForm.averageListeners}
                        onChange={(e) => setUpdateForm({...updateForm, averageListeners: e.target.value})}
                        placeholder={metrics.averageListeners.toString()}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        label="Avg Completion %"
                        type="number"
                        value={updateForm.averageCompletion}
                        onChange={(e) => setUpdateForm({...updateForm, averageCompletion: e.target.value})}
                        placeholder={metrics.averageCompletion.toString()}
                        inputProps={{ step: 0.1, min: 0, max: 100 }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        startIcon={<Update />}
                        onClick={handleUpdateSubmit}
                        disabled={updateMetrics.isPending}
                      >
                        Update Metrics
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Platform Sync */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Platform Sync
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Sync listener and download data from streaming platforms
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      startIcon={<Sync />}
                      onClick={() => syncPlatform.mutate('spotify')}
                      disabled={syncPlatform.isPending}
                      sx={{ color: PLATFORM_COLORS.spotify, borderColor: PLATFORM_COLORS.spotify }}
                    >
                      Sync Spotify
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Sync />}
                      onClick={() => syncPlatform.mutate('apple')}
                      disabled={syncPlatform.isPending}
                      sx={{ color: PLATFORM_COLORS.apple, borderColor: PLATFORM_COLORS.apple }}
                    >
                      Sync Apple
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Sync />}
                      onClick={() => syncPlatform.mutate('google')}
                      disabled={syncPlatform.isPending}
                      sx={{ color: PLATFORM_COLORS.google, borderColor: PLATFORM_COLORS.google }}
                    >
                      Sync Google
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </>
          ) : (
            <Alert severity="info">No metrics available for this show yet.</Alert>
          )}
        </Box>
      </AdminOnly>
    </DashboardLayout>
  )
}