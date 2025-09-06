'use client'

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Tabs,
  Tab,
  CircularProgress,
  Button,
  Alert,
  Chip,
  LinearProgress,
  Divider
} from '@mui/material'
import {
  Download,
  People,
  TrendingUp,
  AccessTime,
  Headphones,
  Sync,
  Podcasts,
  GraphicEq,
  ShowChart,
  Assessment
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  ResponsiveContainer
} from 'recharts'

interface MegaphoneAnalyticsCardProps {
  showId: string
  showName: string
  megaphonePodcastId?: string
}

interface MegaphoneMetrics {
  totalMetrics: {
    totalDownloads: number
    totalImpressions: number
    uniqueListeners: number
    avgListenTime: number
    avgCompletionRate: number
    totalEpisodes: number
    avgDownloadsPerEpisode: number
    listenerGrowthRate: number
  }
  downloadTrend: Array<{
    date: string
    downloads: number
    listeners: number
    impressions: number
  }>
  episodePerformance: Array<{
    id: string
    title: string
    downloads: number
    listeners: number
    completionRate: number
    avgListenTime: number
  }>
  listenerDemographics?: {
    platforms: Array<{
      platform: string
      percentage: number
      count: number
    }>
    geography?: Array<{
      country: string
      downloads: number
    }>
  }
  completionMetrics: {
    distribution: Array<{
      range: string
      count: number
      percentage: number
    }>
    averageDropoffPoint: number
  }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export function MegaphoneAnalyticsCard({ showId, showName, megaphonePodcastId }: MegaphoneAnalyticsCardProps) {
  const [activeTab, setActiveTab] = useState(0)
  const queryClient = useQueryClient()

  // Fetch Megaphone analytics data
  const { data: analytics, isLoading, error } = useQuery<MegaphoneMetrics>({
    queryKey: ['megaphone-analytics', showId],
    queryFn: async () => {
      const response = await fetch(`/api/shows/${showId}/megaphone-analytics`)
      if (!response.ok) {
        throw new Error('Failed to fetch Megaphone analytics')
      }
      return response.json()
    },
    enabled: !!showId,
    refetchInterval: 5 * 60 * 1000 // Refresh every 5 minutes
  })

  // Sync Megaphone data mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/megaphone/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId, podcastId: megaphonePodcastId })
      })
      if (!response.ok) {
        throw new Error('Failed to sync Megaphone data')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['megaphone-analytics', showId] })
    }
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (error || !analytics) {
    return (
      <Card>
        <CardContent>
          <Alert severity="info">
            Megaphone analytics not available. Please ensure Megaphone integration is configured.
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Podcasts color="primary" />
            <Typography variant="h6">
              Megaphone Analytics - {showName}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Sync />}
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            size="small"
          >
            {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
          </Button>
        </Box>

        {/* Summary Metrics */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Downloads
              </Typography>
              <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Download fontSize="small" color="primary" />
                {formatNumber(analytics.totalMetrics.totalDownloads)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Unique Listeners
              </Typography>
              <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <People fontSize="small" color="primary" />
                {formatNumber(analytics.totalMetrics.uniqueListeners)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Avg Listen Time
              </Typography>
              <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTime fontSize="small" color="primary" />
                {formatTime(analytics.totalMetrics.avgListenTime)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Completion Rate
              </Typography>
              <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assessment fontSize="small" color="primary" />
                {analytics.totalMetrics.avgCompletionRate.toFixed(1)}%
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="Downloads" />
          <Tab label="Episodes" />
          <Tab label="Audience" />
          <Tab label="Completion" />
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ minHeight: 350 }}>
          {/* Downloads Tab */}
          {activeTab === 0 && analytics.downloadTrend && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Download Trend (Last 30 Days)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.downloadTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    formatter={(value: number) => formatNumber(value)}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="downloads" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} name="Downloads" />
                  <Area type="monotone" dataKey="listeners" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} name="Listeners" />
                  <Area type="monotone" dataKey="impressions" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} name="Impressions" />
                </AreaChart>
              </ResponsiveContainer>
              
              {analytics.totalMetrics.listenerGrowthRate !== 0 && (
                <Box mt={2} display="flex" alignItems="center" gap={1}>
                  <TrendingUp color={analytics.totalMetrics.listenerGrowthRate > 0 ? "success" : "error"} />
                  <Typography variant="body2">
                    Listener Growth: {analytics.totalMetrics.listenerGrowthRate > 0 ? '+' : ''}{analytics.totalMetrics.listenerGrowthRate.toFixed(1)}% vs last period
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Episodes Tab */}
          {activeTab === 1 && analytics.episodePerformance && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Top Performing Episodes
              </Typography>
              <Box sx={{ maxHeight: 350, overflowY: 'auto' }}>
                {analytics.episodePerformance.map((episode, index) => (
                  <Box key={episode.id} sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight="medium" noWrap>
                      {index + 1}. {episode.title}
                    </Typography>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={3}>
                        <Typography variant="caption" color="text.secondary">Downloads</Typography>
                        <Typography variant="body2">{formatNumber(episode.downloads)}</Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Typography variant="caption" color="text.secondary">Listeners</Typography>
                        <Typography variant="body2">{formatNumber(episode.listeners)}</Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Typography variant="caption" color="text.secondary">Completion</Typography>
                        <Typography variant="body2">{episode.completionRate.toFixed(1)}%</Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Typography variant="caption" color="text.secondary">Avg Listen</Typography>
                        <Typography variant="body2">{formatTime(episode.avgListenTime)}</Typography>
                      </Grid>
                    </Grid>
                    <LinearProgress 
                      variant="determinate" 
                      value={episode.completionRate} 
                      sx={{ mt: 1, height: 4, borderRadius: 2 }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Audience Tab */}
          {activeTab === 2 && analytics.listenerDemographics && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Listening Platforms
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.listenerDemographics.platforms}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.platform}: ${entry.percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="percentage"
                  >
                    {analytics.listenerDemographics.platforms.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>

              {analytics.listenerDemographics.geography && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Top Countries
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {analytics.listenerDemographics.geography.slice(0, 10).map((country) => (
                      <Chip
                        key={country.country}
                        label={`${country.country}: ${formatNumber(country.downloads)}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}

          {/* Completion Tab */}
          {activeTab === 3 && analytics.completionMetrics && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Completion Rate Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.completionMetrics.distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Bar dataKey="percentage" fill="#8884d8">
                    {analytics.completionMetrics.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              
              <Box mt={2}>
                <Alert severity="info">
                  Average drop-off point: {formatTime(analytics.completionMetrics.averageDropoffPoint)} into episode
                </Alert>
              </Box>

              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  <GraphicEq sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Episodes analyzed: {analytics.totalMetrics.totalEpisodes}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <ShowChart sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Avg downloads per episode: {formatNumber(analytics.totalMetrics.avgDownloadsPerEpisode)}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}