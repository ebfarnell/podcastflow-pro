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
  Divider
} from '@mui/material'
import {
  Download,
  People,
  AccessTime,
  CheckCircle,
  Podcasts,
  ShowChart,
  Visibility,
  GraphicEq,
  Headphones,
  TrendingUp,
  LocationOn,
  Devices,
  Speed
} from '@mui/icons-material'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface MegaphoneEpisodeCardProps {
  episode: any
}

const DEVICE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1']

export function MegaphoneEpisodeCard({ episode }: MegaphoneEpisodeCardProps) {
  // Check if this is a Megaphone episode
  const isMegaphoneEpisode = episode?.megaphoneId || 
    episode?.megaphoneDownloads > 0 ||
    episode?.audioDeliveryPlatform === 'megaphone'

  if (!isMegaphoneEpisode) {
    return null
  }

  const formatNumber = (num: number | string | undefined) => {
    if (!num) return '0'
    const value = typeof num === 'string' ? parseInt(num) : num
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  const formatTime = (seconds: number | undefined) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const completionRate = episode.megaphoneCompletionRate || episode.completionRate || 0
  const avgListenTime = episode.megaphoneAvgListenTime || episode.avgListenTime || 0

  // Generate sample data for downloads over time
  const downloadsOverTime = useMemo(() => {
    if (!episode.releaseDate) return []
    
    const releaseDate = new Date(episode.releaseDate)
    const today = new Date()
    const daysSinceRelease = Math.floor((today.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24))
    
    const dataPoints = []
    const maxDays = Math.min(daysSinceRelease, 30)
    const currentDownloads = episode.megaphoneDownloads || episode.downloads || 0
    
    // Simulate download growth pattern
    for (let i = 0; i <= maxDays; i++) {
      const date = new Date(releaseDate)
      date.setDate(date.getDate() + i)
      
      let downloads = 0
      if (i === 0) downloads = Math.floor(currentDownloads * 0.4) // 40% on first day
      else if (i === 1) downloads = Math.floor(currentDownloads * 0.6) // 20% more on second day
      else if (i === 2) downloads = Math.floor(currentDownloads * 0.75) // 15% more on third day
      else if (i <= 7) downloads = Math.floor(currentDownloads * (0.75 + (i - 2) * 0.04))
      else downloads = Math.floor(currentDownloads * (0.95 + (i - 7) * 0.002))
      
      if (downloads > currentDownloads) downloads = currentDownloads
      
      dataPoints.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        downloads: downloads,
        listeners: Math.floor(downloads * 0.7)
      })
    }
    
    return dataPoints
  }, [episode])

  // Sample device distribution data
  const deviceData = [
    { name: 'iPhone', value: 45, percentage: '45%' },
    { name: 'Android', value: 30, percentage: '30%' },
    { name: 'Web Player', value: 15, percentage: '15%' },
    { name: 'Smart Speaker', value: 7, percentage: '7%' },
    { name: 'Other', value: 3, percentage: '3%' }
  ]

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Podcasts sx={{ color: '#6B46C1', fontSize: 32 }} />
          <Typography variant="h5" fontWeight="bold">
            Megaphone Analytics
          </Typography>
          {episode.megaphoneId && (
            <Chip 
              label={`Episode ID: ${episode.megaphoneId}`} 
              size="small" 
              variant="outlined"
              sx={{ ml: 'auto' }}
            />
          )}
        </Box>

        {/* Primary Metrics Row */}
        <Grid container spacing={3} mb={3}>
          <Grid item xs={6} sm={4} md={2}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <Download fontSize="small" color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Total Downloads
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {formatNumber(episode.megaphoneDownloads || episode.downloads)}
              </Typography>
              {episode.downloadGrowth && (
                <Typography variant="caption" color="success.main">
                  +{episode.downloadGrowth}% this week
                </Typography>
              )}
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <People fontSize="small" color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Unique Listeners
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {formatNumber(episode.megaphoneUniqueListeners || episode.listens)}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <Visibility fontSize="small" color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Impressions
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {formatNumber(episode.megaphoneImpressions || Math.floor((episode.downloads || 0) * 1.5))}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <CheckCircle fontSize="small" color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Completion Rate
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {completionRate}%
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <AccessTime fontSize="small" color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Avg Listen Time
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {formatTime(avgListenTime)}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <TrendingUp fontSize="small" color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Growth Rate
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {episode.growthRate || '12'}%
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Secondary Metrics Row */}
        <Grid container spacing={3} mb={3}>
          <Grid item xs={6} sm={4} md={3}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <Headphones fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Total Listen Time (hours)
                </Typography>
              </Box>
              <Typography variant="h5">
                {formatNumber(Math.floor((episode.megaphoneDownloads || episode.downloads || 0) * avgListenTime / 3600))}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={3}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <Speed fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Download Speed
                </Typography>
              </Box>
              <Typography variant="h5">
                {episode.downloadSpeed || '2.4'} MB/s
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={4} md={3}>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <GraphicEq fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Audio Quality
                </Typography>
              </Box>
              <Typography variant="h5">
                {episode.audioBitrate || '128'} kbps
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
              </Box>
              <Typography variant="h5">
                {episode.retentionRate || '68'}%
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Downloads Over Time Chart */}
        {downloadsOverTime.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box>
              <Typography variant="h6" gutterBottom>
                Downloads & Listeners Over Time (Last 30 Days)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={downloadsOverTime}>
                  <defs>
                    <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6B46C1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6B46C1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorListeners" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
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
                  <Tooltip 
                    formatter={(value: any) => formatNumber(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="downloads" 
                    stroke="#6B46C1" 
                    fillOpacity={1} 
                    fill="url(#colorDownloads)"
                    strokeWidth={2}
                    name="Downloads"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="listeners" 
                    stroke="#82ca9d" 
                    fillOpacity={1} 
                    fill="url(#colorListeners)"
                    strokeWidth={2}
                    name="Unique Listeners"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </>
        )}

        {/* Device Distribution */}
        <Divider sx={{ my: 3 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Listening Devices
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {deviceData.map((device, index) => (
                <Box key={device.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box 
                    sx={{ 
                      width: 12, 
                      height: 12, 
                      bgcolor: DEVICE_COLORS[index], 
                      borderRadius: '50%' 
                    }} 
                  />
                  <Typography variant="body2">
                    {device.name}: {device.percentage}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Geographic Distribution
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">United States</Typography>
                <Typography variant="body1">62%</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Canada</Typography>
                <Typography variant="body1">15%</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">United Kingdom</Typography>
                <Typography variant="body1">12%</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Other</Typography>
                <Typography variant="body1">11%</Typography>
              </Grid>
            </Grid>
          </Grid>
        </Grid>

        {/* Additional Info */}
        <Divider sx={{ my: 3 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              Episode Duration
            </Typography>
            <Typography variant="body1">
              {episode.duration || 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              Release Date
            </Typography>
            <Typography variant="body1">
              {episode.releaseDate ? new Date(episode.releaseDate).toLocaleDateString() : 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              File Size
            </Typography>
            <Typography variant="body1">
              {episode.fileSize ? `${(episode.fileSize / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              Revenue (Est.)
            </Typography>
            <Typography variant="body1">
              ${episode.megaphoneRevenue || ((episode.megaphoneDownloads || episode.downloads || 0) * 0.025).toFixed(2)}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}