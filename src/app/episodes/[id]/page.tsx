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
  Alert,
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
  Description,
  ThumbUp,
  Comment,
} from '@mui/icons-material'
import CircularProgress from '@mui/material/CircularProgress'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { useAudio } from '@/contexts/AudioContext'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { useQuery } from '@tanstack/react-query'
import { episodesApi } from '@/services/episodesApi'
import { analyticsApiService } from '@/services/analytics-api'
import { EpisodeInventory } from '@/components/episodes/EpisodeInventory'
import { useAuth } from '@/contexts/AuthContext'
import { parseApiError, getUserFriendlyErrorMessage, logApiError } from '@/lib/api/error-handler'
import { YouTubeEpisodeCard } from '@/components/episodes/YouTubeEpisodeCard'
import { MegaphoneEpisodeCard } from '@/components/episodes/MegaphoneEpisodeCard'

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
  // YouTube fields
  youtubeVideoId?: string
  youtubeUrl?: string
  youtubeViewCount?: number
  youtubeLikeCount?: number
  youtubeCommentCount?: number
  youtubeThumbnailUrl?: string
  publishUrl?: string
}

function EpisodeDetailPageContent() {
  const router = useRouter()
  const params = useParams()
  const episodeId = params.id as string
  const { play } = useAudio()
  const { user, isLoading: authLoading } = useAuth()
  
  // Helper function to format duration
  const formatDuration = (duration: string | number | undefined) => {
    if (!duration) return '00:00'
    
    // If already in HH:MM:SS or MM:SS format, return as is
    if (typeof duration === 'string' && duration.includes(':')) {
      return duration
    }
    
    // If it's a number (seconds), convert to MM:SS or HH:MM:SS
    const totalSeconds = typeof duration === 'string' ? parseInt(duration) : duration
    if (isNaN(totalSeconds)) return '00:00'
    
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const [selectedTab, setSelectedTab] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  
  // Debug logging
  useEffect(() => {
    console.log('🎬 Episode Page - Auth state:', {
      authLoading,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      episodeId,
      timestamp: new Date().toISOString()
    })
  }, [authLoading, user, episodeId])

  // Query episode data
  const {
    data: episode,
    isLoading: episodeLoading,
    error: episodeError,
  } = useQuery({
    queryKey: ['episode', episodeId],
    queryFn: async () => {
      // Make sure we have auth before fetching
      if (!user) {
        console.log('⏳ Episode Page - Waiting for user auth...')
        throw new Error('Authentication required')
      }
      
      try {
        console.log('📡 Episode Page - Fetching episode:', episodeId)
        const response = await episodesApi.getEpisode(episodeId)
        console.log('📡 Episode Page - Episode response:', response)
        
        // Transform API response to match component's Episode interface
        const transformedEpisode = {
          episodeId: response.episodeId || response.id,
          showId: response.showId,
          showName: response.showName || response.show?.name,
          number: response.episodeNumber || response.number || 1,
          title: response.title,
          description: response.description || '',
          duration: response.duration || '00:00',
          releaseDate: response.releaseDate || response.airDate || response.createdAt,
          status: response.status || 'draft',
          downloads: response.megaphoneDownloads || response.downloads || 0,
          listens: response.megaphoneUniqueListeners || response.listens || 0,
          completionRate: response.megaphoneCompletionRate || response.completionRate || 0,
          avgListenTime: response.avgListenTime || '00:00',
          audioUrl: response.youtubeUrl || response.audioUrl || '',
          transcriptUrl: response.transcriptUrl || '',
          explicit: response.explicit || false,
          tags: response.tags || [],
          guests: response.guests || [],
          adSlots: response.adSlots || [],
          // YouTube-specific fields
          youtubeVideoId: response.youtubeVideoId,
          youtubeUrl: response.youtubeUrl,
          youtubeViewCount: response.youtubeViewCount,
          youtubeLikeCount: response.youtubeLikeCount,
          youtubeCommentCount: response.youtubeCommentCount,
          youtubeThumbnailUrl: response.youtubeThumbnailUrl,
          publishUrl: response.youtubeUrl
        }
        
        return transformedEpisode
      } catch (error: any) {
        console.error('Episode fetch error:', error)
        // If we get a 401, don't redirect - let the component handle it
        if (error.response?.status === 401) {
          console.log('🔐 Episode Page - 401 error, but not redirecting. Let component handle auth.')
          throw new Error('Session expired. Please log in again.')
        }
        throw error
      }
    },
    enabled: !!episodeId && !!user && !authLoading,
    retry: 1,
  })

  // Query episode analytics - only if authenticated and not a YouTube episode
  // Check both audioUrl and publishUrl for YouTube links
  const isYouTubeEpisode = episode && (
    (episode.audioUrl && (episode.audioUrl.includes('youtube.com') || episode.audioUrl.includes('youtu.be'))) ||
    (episode.publishUrl && (episode.publishUrl.includes('youtube.com') || episode.publishUrl.includes('youtu.be')))
  )
  
  const {
    data: analytics,
    isLoading: analyticsLoading,
  } = useQuery({
    queryKey: ['episode-analytics', episodeId],
    queryFn: async () => {
      // Skip if not authenticated
      if (!user) {
        console.log('🔐 Episode Page - Skipping analytics fetch, user not authenticated')
        return null
      }
      
      // Skip analytics for YouTube episodes - they don't have traditional analytics
      const isYouTube = episode && (
        (episode.audioUrl && (episode.audioUrl.includes('youtube.com') || episode.audioUrl.includes('youtu.be'))) ||
        (episode.publishUrl && (episode.publishUrl.includes('youtube.com') || episode.publishUrl.includes('youtu.be')))
      )
      if (isYouTube || episodeId?.includes('youtube')) {
        return {
          totalDownloads: 0,
          totalListeners: 0,
          totalCompletions: 0,
          avgCompletionRate: 0,
          totalRevenue: 0,
          platformBreakdown: {
            spotify: 0,
            apple: 0,
            google: 0,
            other: 0,
            youtube: 0
          },
          engagement: {
            totalShares: 0,
            totalLikes: 0,
            totalComments: 0,
            avgListenTime: 0
          },
          trends: {
            downloadsChange: 0,
            listenersChange: 0,
            revenueChange: 0
          },
          isYouTubeEpisode: true
        }
      }
      
      try {
        const response = await analyticsApiService.getEpisodeAnalytics(episodeId)
        return response
      } catch (error) {
        // Silently handle errors - analytics service already handles logging
        return null
      }
    },
    enabled: !!episodeId && !!episode && !!user && !isYouTubeEpisode, // Don't fetch for YouTube episodes
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
    // Prefer YouTube URL if available
    const playUrl = episode?.youtubeUrl || episode?.audioUrl
    
    if (playUrl) {
      // Check if it's a YouTube URL
      if (playUrl.includes('youtube.com') || playUrl.includes('youtu.be')) {
        // Open YouTube URL in new tab
        window.open(playUrl, '_blank')
      } else {
        // Play regular audio file
        play({
          url: playUrl,
          title: `${episode.showName} - ${episode.title}`,
          artist: episode.showName,
        })
      }
    }
  }

  // Add a small delay state to prevent immediate redirect
  const [authCheckComplete, setAuthCheckComplete] = useState(false)
  
  useEffect(() => {
    // Give auth context 2 seconds to load before showing login prompt
    const timer = setTimeout(() => {
      setAuthCheckComplete(true)
    }, 2000)
    
    return () => clearTimeout(timer)
  }, [])

  // Fetch YouTube metrics for YouTube episodes
  const { 
    data: youtubeMetrics, 
    isLoading: youtubeLoading 
  } = useQuery({
    queryKey: ['youtube-metrics', episodeId],
    queryFn: async () => {
      if (!episodeId || !episode) return null
      
      // Check if YouTube episode inside the query function
      const isYouTube = episode?.publishUrl && 
        (episode.publishUrl.includes('youtube.com') || episode.publishUrl.includes('youtu.be'))
      
      if (!isYouTube) return null
      
      try {
        const response = await api.get(`/episodes/${episodeId}/youtube-metrics?period=30d`)
        return response
      } catch (error) {
        console.log('Could not fetch YouTube metrics:', error)
        return null
      }
    },
    enabled: !!episodeId && !!episode && !!user && !!episode?.publishUrl && 
             (episode?.publishUrl?.includes('youtube.com') || episode?.publishUrl?.includes('youtu.be')),
    retry: false
  })

  const isLoading = episodeLoading || analyticsLoading || authLoading

  // Show authentication required message if not logged in
  // But wait for auth check to complete first
  if (!authLoading && !user && authCheckComplete) {
    console.log('🚫 Episode Page - No user after auth check, showing login prompt')
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="warning">
            Please log in to view episode details.
            <Button 
              variant="contained" 
              sx={{ ml: 2 }}
              onClick={() => router.push('/login?redirect=/episodes/' + episodeId)}
            >
              Log In
            </Button>
          </Alert>
        </Box>
      </DashboardLayout>
    )
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading episode details..." />
      </DashboardLayout>
    )
  }

  if (episodeError) {
    const errorInfo = parseApiError(episodeError)
    logApiError('Failed to load episode', episodeError)
    
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
          <IconButton onClick={handleMenuClick}>
            <MoreVert />
          </IconButton>
        </Box>

        {/* Episode Info Section (Not in Card) */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="overline" color="text.secondary">
            {episode.showName} • Episode {episode.number}
          </Typography>
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            {episode.title}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Chip
              label={episode.status}
              color={episode.status === 'published' ? 'success' : 'default'}
              size="medium"
            />
            {episode.explicit && (
              <Chip label="Explicit" color="warning" size="medium" />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarToday sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body1" color="text.secondary">
                {new Date(episode.releaseDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTime sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body1" color="text.secondary">
                {formatDuration(episode.duration)}
              </Typography>
            </Box>
            {episode.youtubeUrl && (
              <Button
                variant="contained"
                startIcon={<PlayCircle />}
                onClick={handlePlay}
                size="medium"
                sx={{ ml: 'auto' }}
              >
                Watch on YouTube
              </Button>
            )}
          </Box>

          <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.7 }}>
            {episode.description}
          </Typography>

          {episode.guests.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Guests
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {episode.guests.map((guest, index) => (
                  <Chip
                    key={index}
                    avatar={<Avatar>{guest[0]}</Avatar>}
                    label={guest}
                    variant="outlined"
                    size="medium"
                  />
                ))}
              </Box>
            </Box>
          )}

          {episode.tags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
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
        </Box>

        {/* Analytics Cards */}
        <Grid container spacing={3}>
          {/* YouTube Metrics Card - Full Width */}
          {(episode?.youtubeVideoId || episode?.youtubeUrl || (episode?.publishUrl && (episode.publishUrl.includes('youtube.com') || episode.publishUrl.includes('youtu.be')))) && (
            <Grid item xs={12}>
              <YouTubeEpisodeCard episode={episode} />
            </Grid>
          )}

          {/* Megaphone Metrics Card - Full Width */}
          {(episode?.megaphoneId || episode?.megaphoneDownloads > 0 || episode?.audioDeliveryPlatform === 'megaphone') && (
            <Grid item xs={12}>
              <MegaphoneEpisodeCard episode={episode} />
            </Grid>
          )}
        </Grid>

        {/* Tabs for detailed sections */}
        <Box sx={{ mt: 3 }}>
          <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)}>
            <Tab label="Ad Inventory" />
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
            
            {selectedTab === 1 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Episode Resources
                  </Typography>
                  <List>
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
                    {!episode.transcriptUrl && (
                      <ListItem>
                        <ListItemText
                          primary="No additional resources available"
                          secondary="Transcript and other resources will appear here when available"
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