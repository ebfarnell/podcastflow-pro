'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Button,
  CircularProgress,
  Chip,
  Tooltip,
  IconButton,
  LinearProgress,
  Tab,
  Tabs,
  Paper,
  Divider,
  Alert
} from '@mui/material'
import {
  YouTube,
  Sync,
  TrendingUp,
  Visibility,
  ThumbUp,
  Comment,
  AccessTime,
  People,
  Speed,
  TouchApp,
  Search,
  LiveTv,
  Analytics,
  Info,
  PlayCircle,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'

interface YouTubeAnalyticsData {
  totalMetrics: {
    totalViews: number
    totalWatchTimeHours: number
    totalLikes: number
    totalComments: number
    avgViewDuration: number
    avgViewPercentage: number
    totalImpressions: number
    avgCTR: number
    subscribersGained: number
    subscribersLost: number
    netSubscribers: number
  }
  retentionData?: {
    curve: Array<{ timeRatio: number; watchRatio: number }>
    keyMoments: Array<{ timeRatio: number; type: string; significance: number }>
    avgWatchRatio: number
  }
  trafficSources?: Array<{
    source: string
    views: number
    percentage: number
  }>
  realTimeData?: {
    last48Hours: Array<{ hour: string; views: number; likes: number }>
    currentViewers?: number
    isLive: boolean
  }
  topVideos?: Array<{
    id: string
    title: string
    views: number
    watchTime: number
    ctr: number
  }>
  demographics?: {
    ageGroups: Array<{ group: string; percentage: number }>
    gender: { male: number; female: number; other: number }
    geography: Array<{ country: string; views: number }>
  }
}

interface YouTubeAnalyticsCardProps {
  showId: string
  showName: string
  channelId?: string
}

export default function YouTubeAnalyticsCard({ showId, showName, channelId }: YouTubeAnalyticsCardProps) {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [data, setData] = useState<YouTubeAnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Fetch YouTube analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/shows/${showId}/youtube-analytics`)
      if (!response.ok) {
        throw new Error('Failed to fetch YouTube analytics')
      }
      
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (err) {
      console.error('Error fetching YouTube analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  // Sync YouTube data
  const handleSync = async () => {
    try {
      setSyncing(true)
      setSyncMessage(null)
      
      const response = await fetch('/api/youtube/sync-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId, syncType: 'all' })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSyncMessage(`Successfully synced ${result.videosProcessed || 1} video(s)`)
        // Refresh analytics data
        await fetchAnalytics()
      } else {
        setSyncMessage(result.message || 'Sync completed with some issues')
      }
    } catch (err) {
      console.error('Sync error:', err)
      setSyncMessage('Failed to sync YouTube data')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [showId])

  // Format numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Colors for charts
  const COLORS = ['#FF0000', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD', '#F4A460']

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">No YouTube analytics data available</Typography>
          <Button 
            startIcon={<YouTube />}
            variant="contained"
            sx={{ mt: 2 }}
            onClick={handleSync}
          >
            Connect YouTube Channel
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <YouTube sx={{ color: '#FF0000', fontSize: 32 }} />
            <Box>
              <Typography variant="h5" fontWeight="bold">
                YouTube Analytics
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {showName}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            {syncMessage && (
              <Chip 
                label={syncMessage} 
                color={syncMessage.includes('Success') ? 'success' : 'warning'}
                size="small"
              />
            )}
            <Button
              startIcon={syncing ? <CircularProgress size={16} /> : <Sync />}
              onClick={handleSync}
              disabled={syncing}
              variant="outlined"
              size="small"
            >
              {syncing ? 'Syncing...' : 'Sync Data'}
            </Button>
          </Box>
        </Box>

        {/* Key Metrics Summary */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
              <Visibility sx={{ color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" fontWeight="bold">
                {formatNumber(data.totalMetrics.totalViews)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Views
              </Typography>
            </Paper>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
              <AccessTime sx={{ color: 'success.main', mb: 1 }} />
              <Typography variant="h4" fontWeight="bold">
                {formatNumber(data.totalMetrics.totalWatchTimeHours)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Watch Hours
              </Typography>
            </Paper>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
              <People sx={{ color: data.totalMetrics.netSubscribers >= 0 ? 'success.main' : 'error.main', mb: 1 }} />
              <Typography 
                variant="h4" 
                fontWeight="bold"
                color={data.totalMetrics.netSubscribers >= 0 ? 'success.main' : 'error.main'}
              >
                {data.totalMetrics.netSubscribers >= 0 ? '+' : ''}{formatNumber(data.totalMetrics.netSubscribers)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Net Subscribers
              </Typography>
            </Paper>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
              <TouchApp sx={{ color: 'info.main', mb: 1 }} />
              <Typography variant="h4" fontWeight="bold">
                {data.totalMetrics.avgCTR.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg CTR
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Tabbed Content */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="Engagement" />
            <Tab label="Retention" />
            <Tab label="Traffic Sources" />
            <Tab label="Real-time" />
            <Tab label="Demographics" />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        {activeTab === 0 && (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Engagement Metrics
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ThumbUp fontSize="small" />
                      <Typography>Likes</Typography>
                    </Box>
                    <Typography fontWeight="bold">{formatNumber(data.totalMetrics.totalLikes)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Comment fontSize="small" />
                      <Typography>Comments</Typography>
                    </Box>
                    <Typography fontWeight="bold">{formatNumber(data.totalMetrics.totalComments)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Speed fontSize="small" />
                      <Typography>Avg View Duration</Typography>
                    </Box>
                    <Typography fontWeight="bold">{formatDuration(data.totalMetrics.avgViewDuration)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Analytics fontSize="small" />
                      <Typography>Avg View %</Typography>
                    </Box>
                    <Typography fontWeight="bold">{data.totalMetrics.avgViewPercentage.toFixed(1)}%</Typography>
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Discovery Performance
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Impressions</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatNumber(data.totalMetrics.totalImpressions)}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min(100, (data.totalMetrics.totalViews / data.totalMetrics.totalImpressions) * 100)}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {((data.totalMetrics.totalViews / data.totalMetrics.totalImpressions) * 100).toFixed(1)}% conversion rate
                  </Typography>
                </Box>
                
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Subscriber Conversion</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      +{data.totalMetrics.subscribersGained} / -{data.totalMetrics.subscribersLost}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min(100, (data.totalMetrics.subscribersGained / (data.totalMetrics.subscribersGained + data.totalMetrics.subscribersLost)) * 100)}
                    color={data.totalMetrics.netSubscribers >= 0 ? 'success' : 'error'}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeTab === 1 && (
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Audience Retention
            </Typography>
            {data.retentionData ? (
              <Box>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.retentionData.curve}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timeRatio" 
                      tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                      label={{ value: 'Video Progress', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                      label={{ value: 'Viewers Watching', angle: -90, position: 'insideLeft' }}
                    />
                    <ChartTooltip 
                      formatter={(value: any) => `${(value * 100).toFixed(1)}%`}
                      labelFormatter={(label) => `At ${(label * 100).toFixed(0)}% of video`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="watchRatio" 
                      stroke="#FF0000" 
                      fill="#FF0000" 
                      fillOpacity={0.3}
                      name="Retention"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                
                {data.retentionData.keyMoments && data.retentionData.keyMoments.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      Key Moments
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {data.retentionData.keyMoments.slice(0, 5).map((moment, idx) => (
                        <Chip
                          key={idx}
                          label={`${(moment.timeRatio * 100).toFixed(0)}% - ${moment.type}`}
                          size="small"
                          color={moment.type === 'gain' ? 'success' : 'error'}
                          icon={moment.type === 'gain' ? <ArrowUpward /> : <ArrowDownward />}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Average retention: <strong>{(data.retentionData.avgWatchRatio * 100).toFixed(1)}%</strong> of viewers watch to this point
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Typography color="text.secondary">
                Retention data not available. Connect YouTube channel for detailed analytics.
              </Typography>
            )}
          </Box>
        )}

        {activeTab === 2 && (
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Traffic Sources
            </Typography>
            {data.trafficSources && data.trafficSources.length > 0 ? (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.trafficSources}
                        dataKey="views"
                        nameKey="source"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.source}: ${entry.percentage.toFixed(1)}%`}
                      >
                        {data.trafficSources.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {data.trafficSources.slice(0, 5).map((source, idx) => (
                      <Box key={idx}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">{source.source}</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {formatNumber(source.views)} views
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={source.percentage}
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <Typography color="text.secondary">
                Traffic source data not available
              </Typography>
            )}
          </Box>
        )}

        {activeTab === 3 && (
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Real-time Performance
            </Typography>
            {data.realTimeData ? (
              <Box>
                {data.realTimeData.isLive && (
                  <Chip 
                    icon={<LiveTv />}
                    label={`LIVE - ${formatNumber(data.realTimeData.currentViewers || 0)} watching now`}
                    color="error"
                    sx={{ mb: 2 }}
                  />
                )}
                
                {data.realTimeData.last48Hours && data.realTimeData.last48Hours.length > 0 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.realTimeData.last48Hours}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <ChartTooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="views" 
                        stroke="#FF0000" 
                        name="Views"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="likes" 
                        stroke="#4ECDC4" 
                        name="Likes"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Box>
            ) : (
              <Typography color="text.secondary">
                Real-time data not available
              </Typography>
            )}
          </Box>
        )}

        {activeTab === 4 && (
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Audience Demographics
            </Typography>
            {data.demographics ? (
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Age Distribution
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {data.demographics.ageGroups.map((group) => (
                      <Box key={group.group}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption">{group.group}</Typography>
                          <Typography variant="caption">{group.percentage.toFixed(1)}%</Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={group.percentage}
                          sx={{ height: 4 }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Gender Distribution
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Male</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {data.demographics.gender.male.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Female</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {data.demographics.gender.female.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Other</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {data.demographics.gender.other.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Top Countries
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {data.demographics.geography.slice(0, 5).map((country) => (
                      <Box key={country.country} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">{country.country}</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatNumber(country.views)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <Typography color="text.secondary">
                Demographic data not available
              </Typography>
            )}
          </Box>
        )}

        {/* Footer */}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            Data aggregated from all YouTube episodes
          </Typography>
          <Tooltip title="YouTube Analytics API provides detailed insights about your content performance">
            <IconButton size="small">
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  )
}