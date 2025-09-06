'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Divider,
  LinearProgress,
  Menu,
  MenuItem,
} from '@mui/material'
import {
  ArrowBack,
  Edit,
  MoreVert,
  PlayCircle,
  Download,
  Schedule,
  AttachMoney,
  People,
  Assessment,
  Mic,
  AccessTime,
  CalendarToday,
  CheckCircle,
  Campaign,
  Share,
  Delete,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { useAudio } from '@/contexts/AudioContext'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { useQuery } from '@tanstack/react-query'
import { episodesApi } from '@/services/api'
import { analyticsApiService } from '@/services/analytics-api'
import { EpisodeInventory } from '@/components/episodes/EpisodeInventory'
import { useAuth } from '@/contexts/AuthContext'
import { parseApiError, getUserFriendlyErrorMessage, logApiError } from '@/lib/api/error-handler'

interface Episode {
  episodeId: string
  showId: string
  showName: string
  number: number
  title: string
  description: string
  duration: string
  releaseDate: string
  status: 'published' | 'scheduled' | 'draft' | 'recording'
  downloads: number
  listens: number
  completionRate: number
  avgListenTime: string
  audioUrl: string
  transcriptUrl?: string
  explicit: boolean
  tags: string[]
  guests: string[]
  adSlots: {
    id: string
    position: string
    duration: number
    advertiser: string
    campaign: string
    revenue: number
    filled: boolean
  }[]
}

function EpisodeDetailPageContent() {
  const router = useRouter()
  const params = useParams()
  const episodeId = params.id as string
  const { play } = useAudio()
  const { user, isLoading: authLoading } = useAuth()

  const [selectedTab, setSelectedTab] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [debugInfo, setDebugInfo] = useState<any[]>([])

  // Log everything that happens
  const addDebug = (message: string, data?: any) => {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      data
    }
    console.log(`[EPISODE DEBUG] ${message}`, data || '')
    setDebugInfo(prev => [...prev, entry])
  }

  useEffect(() => {
    addDebug('Component mounted', { episodeId, user: user?.email })
  }, [])

  useEffect(() => {
    addDebug('Auth state changed', { 
      user: user?.email,
      authLoading,
      isAuthenticated: !!user
    })
  }, [user, authLoading])

  // Query episode data
  const {
    data: episode,
    isLoading: episodeLoading,
    error: episodeError,
  } = useQuery({
    queryKey: ['episode', episodeId],
    queryFn: async () => {
      addDebug('Fetching episode', { episodeId })
      try {
        const response = await episodesApi.getById(episodeId)
        addDebug('Episode fetched successfully', response)
        return response
      } catch (error: any) {
        addDebug('Episode fetch error', { 
          error: error.message,
          status: error.response?.status,
          data: error.response?.data
        })
        throw error
      }
    },
    enabled: !!episodeId,
    retry: 1,
  })

  // Query episode analytics
  const {
    data: analytics,
    isLoading: analyticsLoading,
  } = useQuery({
    queryKey: ['episode-analytics', episodeId],
    queryFn: async () => {
      addDebug('Fetching analytics', { episodeId })
      try {
        const response = await analyticsApiService.getEpisodeAnalytics(episodeId)
        addDebug('Analytics fetched successfully', response)
        return response
      } catch (error: any) {
        addDebug('Analytics fetch error', { 
          error: error.message,
          status: error.response?.status,
          data: error.response?.data
        })
        return null
      }
    },
    enabled: !!episodeId && !!episode,
  })

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleEdit = () => {
    router.push(`/episodes/${episodeId}/edit`)
    handleMenuClose()
  }

  const handleShare = () => {
    // Implement share functionality
    handleMenuClose()
  }

  const handleDelete = () => {
    // Implement delete functionality
    handleMenuClose()
  }

  const handlePlay = () => {
    if (episode?.audioUrl) {
      play({
        url: episode.audioUrl,
        title: `${episode.showName} - ${episode.title}`,
        artist: episode.showName,
      })
    }
  }

  const isLoading = episodeLoading || analyticsLoading || authLoading

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading episode details..." />
      </DashboardLayout>
    )
  }

  if (episodeError) {
    const errorInfo = parseApiError(episodeError)
    logApiError('Failed to load episode', episodeError, { episodeId })
    
    return (
      <DashboardLayout>
        <ErrorState 
          message={getUserFriendlyErrorMessage(errorInfo)}
          onRetry={() => window.location.reload()}
        />
      </DashboardLayout>
    )
  }

  if (!episode) {
    return (
      <DashboardLayout>
        <ErrorState 
          message="Episode not found"
          onRetry={() => router.push('/episodes')}
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Debug Panel */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.100' }}>
          <Typography variant="h6" gutterBottom>Debug Information</Typography>
          <Box sx={{ maxHeight: 200, overflow: 'auto', fontSize: '0.75rem', fontFamily: 'monospace' }}>
            {debugInfo.map((entry, i) => (
              <Box key={i} sx={{ mb: 0.5 }}>
                <strong>{entry.timestamp}:</strong> {entry.message}
                {entry.data && (
                  <Box sx={{ ml: 2, color: 'text.secondary' }}>
                    {JSON.stringify(entry.data, null, 2)}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Paper>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/episodes')}
              sx={{ color: 'text.secondary' }}
            >
              Back to Episodes
            </Button>
            <Typography variant="h4" fontWeight="bold">
              Episode Details
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Share />}
              onClick={handleShare}
            >
              Share
            </Button>
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={handleEdit}
            >
              Edit Episode
            </Button>
            <IconButton onClick={handleMenuClick}>
              <MoreVert />
            </IconButton>
          </Box>
        </Box>

        {/* Episode Info Card */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      {episode.showName} • Episode {episode.number}
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" gutterBottom>
                      {episode.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Chip
                        label={episode.status}
                        color={episode.status === 'published' ? 'success' : 'default'}
                        size="small"
                      />
                      {episode.explicit && (
                        <Chip label="Explicit" color="warning" size="small" />
                      )}
                      <Typography variant="body2" color="text.secondary">
                        <CalendarToday sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                        {new Date(episode.releaseDate).toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <AccessTime sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                        {episode.duration}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<PlayCircle />}
                    onClick={handlePlay}
                    disabled={!episode.audioUrl}
                  >
                    Play Episode
                  </Button>
                </Box>

                <Typography variant="body1" paragraph>
                  {episode.description}
                </Typography>

                {episode.guests.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Guests
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {episode.guests.map((guest, index) => (
                        <Chip
                          key={index}
                          avatar={<Avatar>{guest[0]}</Avatar>}
                          label={guest}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {episode.tags.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Tags
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {episode.tags.map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Stats Card */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Performance Metrics
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <Download />
                    </ListItemIcon>
                    <ListItemText
                      primary={episode.downloads.toLocaleString()}
                      secondary="Downloads"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <PlayCircle />
                    </ListItemIcon>
                    <ListItemText
                      primary={episode.listens.toLocaleString()}
                      secondary="Listens"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Assessment />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${episode.completionRate}%`}
                      secondary="Completion Rate"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <AccessTime />
                    </ListItemIcon>
                    <ListItemText
                      primary={episode.avgListenTime}
                      secondary="Avg Listen Time"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs for detailed sections */}
        <Box sx={{ mt: 3 }}>
          <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)}>
            <Tab label="Ad Inventory" />
            <Tab label="Analytics" />
            <Tab label="Resources" />
          </Tabs>

          <Box sx={{ mt: 3 }}>
            {selectedTab === 0 && (
              <EpisodeInventory
                episodeId={episodeId}
                showId={episode.showId}
                adSlots={episode.adSlots}
                onUpdate={() => {}}
              />
            )}
            
            {selectedTab === 1 && analytics && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Episode Analytics
                  </Typography>
                  {/* Analytics content would go here */}
                  <Typography variant="body2" color="text.secondary">
                    Detailed analytics coming soon...
                  </Typography>
                </CardContent>
              </Card>
            )}
            
            {selectedTab === 2 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Episode Resources
                  </Typography>
                  <List>
                    {episode.audioUrl && (
                      <ListItem>
                        <ListItemIcon>
                          <Mic />
                        </ListItemIcon>
                        <ListItemText
                          primary="Audio File"
                          secondary={
                            <Button
                              size="small"
                              startIcon={<Download />}
                              href={episode.audioUrl}
                              download
                            >
                              Download
                            </Button>
                          }
                        />
                      </ListItem>
                    )}
                    {episode.transcriptUrl && (
                      <ListItem>
                        <ListItemIcon>
                          <Description />
                        </ListItemIcon>
                        <ListItemText
                          primary="Transcript"
                          secondary={
                            <Button
                              size="small"
                              startIcon={<Download />}
                              href={episode.transcriptUrl}
                              download
                            >
                              Download
                            </Button>
                          }
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            )}
          </Box>
        </Box>

        {/* Action Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleEdit}>
            <Edit sx={{ mr: 1 }} /> Edit
          </MenuItem>
          <MenuItem onClick={handleShare}>
            <Share sx={{ mr: 1 }} /> Share
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <Delete sx={{ mr: 1 }} /> Delete
          </MenuItem>
        </Menu>
      </Box>
    </DashboardLayout>
  )
}

export default function EpisodeDetailPage() {
  return <EpisodeDetailPageContent />
}