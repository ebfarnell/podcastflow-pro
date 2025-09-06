import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tooltip,
  LinearProgress,
  Button,
  Avatar,
} from '@mui/material'
import {
  Search,
  AudioFile,
  VideoFile,
  Description,
  PlayCircle,
  Download,
  TrendingUp,
  Visibility,
  CheckCircle,
  Schedule,
  Warning,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

interface Creative {
  id: string
  name: string
  description?: string
  type: string
  format: string
  duration: number
  status: string
  impressions: number
  clicks: number
  conversions: number
  advertiser?: {
    id: string
    name: string
  }
  campaign?: {
    id: string
    name: string
  }
  createdAt: string
}

const formatIcons = {
  audio: <AudioFile />,
  video: <VideoFile />,
  script: <Description />,
}

export default function CreativesSection() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [formatFilter, setFormatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Fetch creatives data
  const { data, isLoading, error } = useQuery({
    queryKey: ['post-sale-creatives', searchQuery, typeFilter, formatFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '20',
      })
      if (searchQuery) params.append('search', searchQuery)
      if (typeFilter) params.append('type', typeFilter)
      if (formatFilter) params.append('format', formatFilter)
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/creatives?${params}`)
      if (!response.ok) throw new Error('Failed to fetch creatives')
      return response.json()
    },
  })

  const creatives = data?.creatives || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'inactive': return 'warning'
      case 'pending_approval': return 'info'
      case 'archived': return 'default'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle fontSize="small" />
      case 'inactive': return <Warning fontSize="small" />
      case 'pending_approval': return <Schedule fontSize="small" />
      default: return null
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}:${remainingSeconds.toString().padStart(2, '0')}` : `${minutes}:00`
  }

  const getPerformanceColor = (value: number, type: 'impressions' | 'ctr' | 'conversions') => {
    if (type === 'impressions') {
      if (value > 10000) return 'success.main'
      if (value > 5000) return 'info.main'
      return 'text.secondary'
    } else if (type === 'ctr') {
      if (value > 2) return 'success.main'
      if (value > 1) return 'info.main'
      return 'text.secondary'
    } else {
      if (value > 100) return 'success.main'
      if (value > 50) return 'info.main'
      return 'text.secondary'
    }
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="error">Failed to load creatives. Please try again.</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            size="small"
            placeholder="Search creatives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              label="Type"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pre-roll">Pre-Roll</MenuItem>
              <MenuItem value="mid-roll">Mid-Roll</MenuItem>
              <MenuItem value="post-roll">Post-Roll</MenuItem>
              <MenuItem value="host-read">Host Read</MenuItem>
              <MenuItem value="produced">Produced</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Format</InputLabel>
            <Select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              label="Format"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="audio">Audio</MenuItem>
              <MenuItem value="video">Video</MenuItem>
              <MenuItem value="script">Script</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="pending_approval">Pending Approval</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Creatives Grid */}
      {isLoading ? (
        <LinearProgress />
      ) : creatives.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="textSecondary">
            No creatives found. Adjust your filters or create a new creative.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {creatives.map((creative: Creative) => (
            <Grid item xs={12} sm={6} md={4} key={creative.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {formatIcons[creative.format as keyof typeof formatIcons] || <Description />}
                    </Avatar>
                    <Chip
                      icon={getStatusIcon(creative.status)}
                      label={creative.status.replace('_', ' ')}
                      size="small"
                      color={getStatusColor(creative.status)}
                    />
                  </Box>
                  
                  <Typography variant="h6" gutterBottom noWrap>
                    {creative.name}
                  </Typography>
                  
                  {creative.description && (
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2, height: 40, overflow: 'hidden' }}>
                      {creative.description}
                    </Typography>
                  )}
                  
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="textSecondary">Type:</Typography>
                      <Typography variant="caption">{creative.type.replace('-', ' ')}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="textSecondary">Duration:</Typography>
                      <Typography variant="caption">{formatDuration(creative.duration)}</Typography>
                    </Box>
                    {creative.advertiser && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="textSecondary">Advertiser:</Typography>
                        <Typography variant="caption" noWrap sx={{ maxWidth: 120 }}>
                          {creative.advertiser.name}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                  
                  {/* Performance Metrics */}
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" gutterBottom>Performance</Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography 
                            variant="h6" 
                            sx={{ color: getPerformanceColor(creative.impressions, 'impressions') }}
                          >
                            {creative.impressions > 1000 ? `${(creative.impressions / 1000).toFixed(1)}k` : creative.impressions}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">Impressions</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography 
                            variant="h6" 
                            sx={{ color: getPerformanceColor(creative.clicks / creative.impressions * 100, 'ctr') }}
                          >
                            {creative.impressions > 0 ? `${(creative.clicks / creative.impressions * 100).toFixed(1)}%` : '0%'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">CTR</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography 
                            variant="h6" 
                            sx={{ color: getPerformanceColor(creative.conversions, 'conversions') }}
                          >
                            {creative.conversions}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">Conversions</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Typography variant="caption" color="textSecondary">
                    {format(new Date(creative.createdAt), 'MMM d, yyyy')}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {creative.format !== 'script' && (
                      <Tooltip title="Preview">
                        <IconButton size="small">
                          <PlayCircle />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="View Details">
                      <IconButton 
                        size="small" 
                        onClick={() => router.push(`/creatives/${creative.id}`)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}