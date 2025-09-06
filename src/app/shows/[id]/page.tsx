'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Divider,
} from '@mui/material'
import YouTubeAnalyticsCard from '@/components/shows/YouTubeAnalyticsCard'
import { MegaphoneAnalyticsCard } from '@/components/shows/MegaphoneAnalyticsCard'
import {
  Edit,
  MoreVert,
  Download,
  Share,
  Podcasts,
  TrendingUp,
  AttachMoney,
  Visibility,
  Schedule,
  CalendarMonth,
  Analytics,
  Campaign,
  People,
  PlayArrow,
  LocalShipping,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { ProductTrackingModal, ProductShipment } from '@/components/campaigns/ProductTrackingModal'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { useAudio } from '@/contexts/AudioContext'
import { LoadingState } from '@/components/common/LoadingState'
import { QueryErrorBoundary } from '@/components/common/QueryErrorBoundary'
import { useQuery } from '@tanstack/react-query'
import { showsApi, episodesApi, campaignApi } from '@/services/api'
import { formatDuration, formatCompactNumber } from '@/lib/utils/format'
import { RevenueProjectionForm } from '@/components/shows/RevenueProjectionForm'
import RateHistoryManager from '@/components/shows/RateHistoryManager'
import CategoryExclusivityManager from '@/components/shows/CategoryExclusivityManager'
import RateTrendsAnalytics from '@/components/analytics/RateTrendsAnalytics'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import { buildShowMetricsHref, extractDateRangeParams } from '@/lib/utils/show-navigation'
import { useSearchParams } from 'next/navigation'

interface Show {
  showId: string
  name: string
  description: string
  host: string
  category: string
  status: 'active' | 'inactive'
  totalEpisodes: number
  avgDuration: number
  totalRevenue: number
  monthlyRevenue: number
  activeCampaigns: number
  publishSchedule: string
  website?: string
  socialMedia: {
    twitter?: string
    instagram?: string
    facebook?: string
  }
}

interface Episode {
  episodeId: string
  episodeNumber: number
  title: string
  airDate: string
  duration: string
  durationSeconds?: number
  status: 'published' | 'scheduled' | 'draft'
  audioUrl?: string
  // YouTube Analytics (Video)
  youtubeVideoId?: string
  youtubeViewCount?: number
  youtubeLikeCount?: number
  youtubeCommentCount?: number
  youtubeUrl?: string
  // Megaphone Analytics (Audio)
  megaphoneId?: string
  megaphoneDownloads?: number
  megaphoneImpressions?: number
  megaphoneUniqueListeners?: number
  megaphoneAvgListenTime?: number
  megaphoneCompletionRate?: number
}

interface Campaign {
  id: string
  name: string
  advertiser: string
  status: 'active' | 'completed' | 'paused'
  budget: number
  spent: number
  impressions: number
  startDate: string
  endDate: string
  productShipments?: ProductShipment[]
}

// Tab configuration
type ShowTabKey = 'episodes' | 'campaigns' | 'revenue' | 'youtube' | 'megaphone' | 'rateHistory' | 'exclusivity' | 'rateAnalytics' | 'settings'

const TAB_LIST: { key: ShowTabKey; label: string; requiresRole?: string[]; condition?: (show: any) => boolean }[] = [
  { key: 'episodes', label: 'Episodes' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'revenue', label: 'Revenue Projections', requiresRole: ['admin', 'master'] },
  { key: 'youtube', label: 'YouTube Analytics', condition: (show) => !!show?.youtubeChannelId },
  { key: 'megaphone', label: 'Megaphone Analytics', condition: (show) => !!(show?.megaphonePodcastId || show?.audioDeliveryPlatform === 'megaphone') },
  { key: 'rateHistory', label: 'Rate History', requiresRole: ['admin', 'master', 'sales'] },
  { key: 'exclusivity', label: 'Category Exclusivity', requiresRole: ['admin', 'master', 'sales'] },
  { key: 'rateAnalytics', label: 'Rate Analytics', requiresRole: ['admin', 'master', 'sales'] },
  { key: 'settings', label: 'Settings' },
]

export default function ShowDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { play } = useAudio()
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()
  
  // Initialize tab from URL or default (localStorage check happens in useEffect)
  const getInitialTab = (): ShowTabKey => {
    const urlTab = searchParams.get('tab') as ShowTabKey
    if (urlTab && TAB_LIST.some(t => t.key === urlTab)) {
      return urlTab
    }
    return 'episodes'
  }
  
  const [selectedTab, setSelectedTab] = useState<ShowTabKey>(getInitialTab)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [editDialog, setEditDialog] = useState(false)
  const [trackingModalOpen, setTrackingModalOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [playingEpisode, setPlayingEpisode] = useState<Episode | null>(null)

  const showId = params.id as string
  
  // Check localStorage after mount (client-side only)
  useEffect(() => {
    // Only check localStorage if no URL tab param
    const urlTab = searchParams.get('tab') as ShowTabKey
    if (!urlTab || !TAB_LIST.some(t => t.key === urlTab)) {
      const savedTab = localStorage.getItem('showTab') as ShowTabKey
      if (savedTab && TAB_LIST.some(t => t.key === savedTab)) {
        setSelectedTab(savedTab)
      }
    }
  }, []) // Run once on mount
  
  // Update URL and localStorage when tab changes
  const handleTabChange = (newTab: ShowTabKey) => {
    setSelectedTab(newTab)
    
    // Update URL without navigation (client-side only)
    if (typeof window !== 'undefined') {
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.set('tab', newTab)
      window.history.pushState({}, '', newUrl)
      
      // Save to localStorage
      localStorage.setItem('showTab', newTab)
    }
  }
  
  // Sync with URL changes (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const urlTab = new URLSearchParams(window.location.search).get('tab') as ShowTabKey
      if (urlTab && TAB_LIST.some(t => t.key === urlTab)) {
        setSelectedTab(urlTab)
      }
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Fetch show details
  const { data: show, isLoading: showLoading, error: showError } = useQuery({
    queryKey: ['show', showId],
    queryFn: () => showsApi.get(showId),
  })

  // Fetch episodes for this show
  const { data: episodesData, isLoading: episodesLoading } = useQuery({
    queryKey: ['episodes', showId],
    queryFn: () => episodesApi.list({ showId }),
    enabled: !!show
  })

  // Fetch campaigns for this show
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns', showId],
    queryFn: () => campaignApi.list({ showId: showId }),
    enabled: !!show && !!showId
  })

  const episodes = episodesData?.episodes || []
  const campaigns = campaignsData?.campaigns || []
  
  const isLoading = showLoading || episodesLoading || campaignsLoading

  const handleEdit = () => {
    setEditDialog(true)
    setAnchorEl(null)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Show link copied to clipboard!')
    setAnchorEl(null)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Show link copied to clipboard!')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'paused': return 'warning'
      case 'inactive': return 'error'
      default: return 'default'
    }
  }

  const getEpisodeStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'success'
      case 'scheduled': return 'info'
      case 'draft': return 'default'
      default: return 'default'
    }
  }

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'paused': return 'warning'
      case 'completed': return 'default'
      default: return 'default'
    }
  }

  const handleOpenTracking = (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setTrackingModalOpen(true)
  }

  const handleSaveTracking = (shipments: ProductShipment[]) => {
    console.log('Saving tracking for campaign:', selectedCampaign?.id, shipments)
  }

  const getDeliveryStatus = (campaign: Campaign) => {
    const shipments = campaign.productShipments || []
    if (shipments.length === 0) return null
    const delivered = shipments.filter(s => s.status === 'delivered').length
    return { delivered, total: shipments.length }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.SHOWS_VIEW}>
      <DashboardLayout>
        <QueryErrorBoundary
          error={showError}
          isLoading={isLoading}
          loadingComponent={
            <LoadingState 
              message="Loading show details..." 
              variant="detailed" 
            />
          }
          errorTitle="Show Not Found"
          errorMessage="Unable to load show details. The show may not exist or you may not have permission to view it."
          backUrl="/shows"
          onRetry={() => window.location.reload()}
        >
          {!show ? (
            <LoadingState message="No show data available" height="30vh" />
          ) : (
            <ShowContent 
              show={show} 
              episodes={episodes} 
              campaigns={campaigns} 
              isLoading={isLoading}
              router={router}
              play={play}
              user={user}
              currentOrganization={currentOrganization}
              searchParams={searchParams}
              selectedTab={selectedTab}
              setSelectedTab={handleTabChange}
              tabList={TAB_LIST}
              anchorEl={anchorEl}
              setAnchorEl={setAnchorEl}
              editDialog={editDialog}
              setEditDialog={setEditDialog}
              trackingModalOpen={trackingModalOpen}
              setTrackingModalOpen={setTrackingModalOpen}
              selectedCampaign={selectedCampaign}
              setSelectedCampaign={setSelectedCampaign}
              playingEpisode={playingEpisode}
              setPlayingEpisode={setPlayingEpisode}
              handleCopyLink={handleCopyLink}
              getStatusColor={getStatusColor}
              getEpisodeStatusColor={getEpisodeStatusColor}
              getCampaignStatusColor={getCampaignStatusColor}
              handleOpenTracking={handleOpenTracking}
              handleSaveTracking={handleSaveTracking}
              getDeliveryStatus={getDeliveryStatus}
            />
          )}
        </QueryErrorBoundary>
      </DashboardLayout>
    </RouteProtection>
  )
}

// Separate component to contain the main show content
interface ShowContentProps {
  show: Show
  episodes: Episode[]
  campaigns: Campaign[]
  isLoading: boolean
  router: any
  play: any
  user: any
  currentOrganization: any
  searchParams: URLSearchParams
  selectedTab: ShowTabKey
  setSelectedTab: (tab: ShowTabKey) => void
  tabList: typeof TAB_LIST
  anchorEl: null | HTMLElement
  setAnchorEl: (el: null | HTMLElement) => void
  editDialog: boolean
  setEditDialog: (open: boolean) => void
  trackingModalOpen: boolean
  setTrackingModalOpen: (open: boolean) => void
  selectedCampaign: Campaign | null
  setSelectedCampaign: (campaign: Campaign | null) => void
  playingEpisode: Episode | null
  setPlayingEpisode: (episode: Episode | null) => void
  handleCopyLink: () => void
  getStatusColor: (status: string) => any
  getEpisodeStatusColor: (status: string) => any
  getCampaignStatusColor: (status: string) => any
  handleOpenTracking: (campaign: Campaign) => void
  handleSaveTracking: (shipments: ProductShipment[]) => void
  getDeliveryStatus: (campaign: Campaign) => any
}

function ShowContent(props: ShowContentProps) {
  const {
    show,
    episodes,
    campaigns,
    router,
    play,
    user,
    currentOrganization,
    searchParams,
    selectedTab,
    setSelectedTab,
    tabList,
    anchorEl,
    setAnchorEl,
    editDialog,
    setEditDialog,
    trackingModalOpen,
    setTrackingModalOpen,
    selectedCampaign,
    setSelectedCampaign,
    playingEpisode,
    setPlayingEpisode,
    handleCopyLink,
    getStatusColor,
    getEpisodeStatusColor,
    getCampaignStatusColor,
    handleOpenTracking,
    handleSaveTracking,
    getDeliveryStatus
  } = props

  // State for Settings tab form fields
  const [settingsForm, setSettingsForm] = useState({
    name: show.name || '',
    description: show.description || '',
    host: show.host || '',
    category: show.category || '',
    website: show.website || '',
    socialMedia: {
      twitter: show.socialMedia?.twitter || '',
      instagram: show.socialMedia?.instagram || '',
      facebook: show.socialMedia?.facebook || ''
    }
  })

  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const handleEdit = () => {
    router.push(`/shows/${show.id || show.showId}/edit`)
    setAnchorEl(null)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Show link copied to clipboard!')
    setAnchorEl(null)
  }

  const handleExportData = async () => {
    try {
      const response = await fetch(`/api/shows/${show.id || show.showId}/export`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `show-${show.id || show.showId}-export.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export data')
    }
    setAnchorEl(null)
  }

  const handleSettingsChange = (field: string, value: any) => {
    if (field.startsWith('socialMedia.')) {
      const socialField = field.split('.')[1]
      setSettingsForm(prev => ({
        ...prev,
        socialMedia: {
          ...prev.socialMedia,
          [socialField]: value
        }
      }))
    } else {
      setSettingsForm(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleSaveSettings = async () => {
    setIsSavingSettings(true)
    try {
      const response = await fetch(`/api/shows/${show.id || show.showId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsForm)
      })

      if (response.ok) {
        alert('Settings saved successfully!')
        // Optionally refresh the page to get updated data
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to save settings: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Save failed:', error)
      alert('Failed to save settings')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleCancelSettings = () => {
    // Reset form to original values
    setSettingsForm({
      name: show.name || '',
      description: show.description || '',
      host: show.host || '',
      category: show.category || '',
      website: show.website || '',
      socialMedia: {
        twitter: show.socialMedia?.twitter || '',
        instagram: show.socialMedia?.instagram || '',
        facebook: show.socialMedia?.facebook || ''
      }
    })
  }

  return (
    <Box sx={{ mb: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main' }}>
                <Podcasts sx={{ fontSize: 40 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  {show.name}
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  Hosted by {show.host} • {show.category}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip 
                    label={show.status} 
                    color={getStatusColor(show.status)} 
                    size="small" 
                  />
                  <Chip 
                    label={`${show.totalEpisodes || episodes.length} Episodes`} 
                    variant="outlined" 
                    size="small" 
                  />
                  <Chip 
                    label={`${show.activeCampaigns || 0} Campaigns`} 
                    variant="outlined" 
                    size="small" 
                  />
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                variant="outlined" 
                startIcon={<Analytics />} 
                onClick={() => {
                  // Extract current date range params if any
                  const dateParams = extractDateRangeParams(searchParams)
                  // Navigate to the same metrics route as the Shows list graph button
                  const metricsUrl = buildShowMetricsHref(show.id || show.showId, dateParams)
                  router.push(metricsUrl)
                }}
                disabled={!user || !['admin', 'master'].includes(user.role)}
                title={!user || !['admin', 'master'].includes(user.role) ? 'You need admin permissions to view metrics' : 'View show metrics'}
              >
                Analytics
              </Button>
              <Button variant="outlined" startIcon={<Campaign />} onClick={() => router.push('/campaigns/new')}>
                New Campaign
              </Button>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                <MoreVert />
              </IconButton>
            </Box>
          </Box>

          {/* Description */}
          <Typography variant="body1" paragraph sx={{ mb: 3 }}>
            {show.description}
          </Typography>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <People color="primary" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Total Episodes
                      </Typography>
                      <Typography variant="h5">
                        {show.totalEpisodes || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <AttachMoney color="success" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Total Revenue
                      </Typography>
                      <Typography variant="h5">
                        ${(show.totalRevenue || 0).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TrendingUp color="info" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Active Campaigns
                      </Typography>
                      <Typography variant="h5">
                        {show.activeCampaigns || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Schedule color="warning" />
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Frequency
                      </Typography>
                      <Typography variant="h5">
                        {show.publishSchedule || 'Not set'}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs 
              value={selectedTab} 
              onChange={(e, value) => setSelectedTab(value as ShowTabKey)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="show tabs"
            >
              {tabList
                .filter(tab => {
                  // Check role requirements
                  if (tab.requiresRole && (!user || !tab.requiresRole.includes(user.role))) {
                    return false
                  }
                  // Check custom conditions (like YouTube/Megaphone availability)
                  if (tab.condition && !tab.condition(show)) {
                    return false
                  }
                  return true
                })
                .map(tab => (
                  <Tab 
                    key={tab.key}
                    value={tab.key}
                    label={tab.label}
                    id={`show-tab-${tab.key}`}
                    aria-controls={`show-tabpanel-${tab.key}`}
                  />
                ))}
            </Tabs>
          </Paper>

          {/* Tab Content */}
          <Box role="tabpanel" hidden={selectedTab !== 'episodes'} id="show-tabpanel-episodes" aria-labelledby="show-tab-episodes">
            {selectedTab === 'episodes' && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="h6">Recent Episodes</Typography>
                    <Button variant="contained" onClick={() => router.push(`/episodes/new?showId=${show.id || show.showId}`)}>
                      New Episode
                    </Button>
                  </Box>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Episode</TableCell>
                          <TableCell>Air Date</TableCell>
                          <TableCell>Duration</TableCell>
                          <TableCell align="center">Video (YouTube)</TableCell>
                          <TableCell align="center">Audio (Megaphone)</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {episodes.map((episode) => (
                          <TableRow key={episode.episodeId} hover>
                            <TableCell>
                              <Typography variant="subtitle2">
                                Episode {episode.episodeNumber}: {episode.title}
                              </Typography>
                            </TableCell>
                            <TableCell>{new Date(episode.airDate).toLocaleDateString()}</TableCell>
                            <TableCell>{formatDuration(episode.durationSeconds || parseInt(episode.duration))}</TableCell>
                            <TableCell align="center">
                              {episode.youtubeViewCount ? (
                                <Box>
                                  <Typography variant="caption" color="text.secondary">Views</Typography>
                                  <Typography variant="body2">{formatCompactNumber(episode.youtubeViewCount)}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatCompactNumber(episode.youtubeLikeCount || 0)} likes
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.disabled">-</Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {episode.megaphoneDownloads ? (
                                <Box>
                                  <Typography variant="caption" color="text.secondary">Downloads</Typography>
                                  <Typography variant="body2">{formatCompactNumber(episode.megaphoneDownloads)}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatCompactNumber(episode.megaphoneUniqueListeners || 0)} listeners
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.disabled">-</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={episode.status} 
                                color={getEpisodeStatusColor(episode.status)} 
                                size="small" 
                              />
                            </TableCell>
                            <TableCell align="right">
                              <IconButton size="small" onClick={() => router.push(`/episodes/${episode.episodeId}`)}>
                                <Visibility />
                              </IconButton>
                              <IconButton size="small" onClick={() => router.push(`/episodes/${episode.episodeId}/edit`)}>
                                <Edit />
                              </IconButton>
                              {episode.status === 'published' && episode.audioUrl && (
                                <IconButton 
                                  size="small" 
                                  onClick={() => {
                                    setPlayingEpisode(episode)
                                    play({
                                      src: episode.audioUrl || '',
                                      title: episode.title,
                                      subtitle: `${show.name} - Episode ${episode.episodeNumber}`,
                                      coverImage: '/podcast-cover.jpg'
                                    })
                                  }}
                                  color={playingEpisode?.episodeId === episode.episodeId ? 'primary' : 'default'}
                                >
                                  <PlayArrow />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
              
              {playingEpisode && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 3 }}>
                    <AudioPlayer
                      src={playingEpisode.audioUrl!}
                      title={playingEpisode.title}
                      subtitle={`${show.name} - Episode ${playingEpisode.episodeNumber}`}
                      coverImage="/podcast-cover.jpg"
                    />
                  </Paper>
                </Grid>
              )}
            </Grid>
            )}
          </Box>

          <Box role="tabpanel" hidden={selectedTab !== 'campaigns'} id="show-tabpanel-campaigns" aria-labelledby="show-tab-campaigns">
            {selectedTab === 'campaigns' && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="h6">Active Campaigns</Typography>
                    <Button variant="contained" onClick={() => router.push(`/campaigns/new?showId=${show.id || show.showId}`)}>
                      New Campaign
                    </Button>
                  </Box>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Campaign</TableCell>
                          <TableCell>Advertiser</TableCell>
                          <TableCell>Budget</TableCell>
                          <TableCell>Progress</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {campaigns.map((campaign) => {
                          const progress = (campaign.spent / campaign.budget) * 100
                          return (
                            <TableRow key={campaign.id} hover>
                              <TableCell>
                                <Typography variant="subtitle2">{campaign.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                                </Typography>
                              </TableCell>
                              <TableCell>{campaign.advertiser}</TableCell>
                              <TableCell>${campaign.budget.toLocaleString()}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={progress}
                                    sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                                  />
                                  <Typography variant="caption">{progress.toFixed(0)}%</Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={campaign.status} 
                                  color={getCampaignStatusColor(campaign.status)} 
                                  size="small" 
                                />
                              </TableCell>
                              <TableCell align="right">
                                <IconButton size="small" onClick={() => router.push(`/campaigns/${campaign.id}`)}>
                                  <Visibility />
                                </IconButton>
                                <IconButton size="small" onClick={() => router.push(`/campaigns/${campaign.id}/edit`)}>
                                  <Edit />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
            )}
          </Box>

          <Box role="tabpanel" hidden={selectedTab !== 'revenue'} id="show-tabpanel-revenue" aria-labelledby="show-tab-revenue">
            {selectedTab === 'revenue' && (
            <RevenueProjectionForm 
              show={{
                id: show.showId,
                name: show.name,
                ...show
              }}
              onUpdate={() => {
                // Refresh show data after update
                window.location.reload()
              }}
            />
            )}
          </Box>

          {/* YouTube Analytics Tab */}
          <Box role="tabpanel" hidden={selectedTab !== 'youtube'} id="show-tabpanel-youtube" aria-labelledby="show-tab-youtube">
            {selectedTab === 'youtube' && show.youtubeChannelId && (
              <YouTubeAnalyticsCard 
                showId={show.id || show.showId || id}
                showName={show.name}
                channelId={show.youtubeChannelId}
              />
            )}
          </Box>

          {/* Megaphone Analytics Tab */}
          <Box role="tabpanel" hidden={selectedTab !== 'megaphone'} id="show-tabpanel-megaphone" aria-labelledby="show-tab-megaphone">
            {selectedTab === 'megaphone' && (show.megaphonePodcastId || show.audioDeliveryPlatform === 'megaphone') && (
              <MegaphoneAnalyticsCard 
                showId={show.id || show.showId || id}
                showName={show.name}
                megaphonePodcastId={show.megaphonePodcastId}
              />
            )}
          </Box>

          {/* Rate History Tab */}
          <Box role="tabpanel" hidden={selectedTab !== 'rateHistory'} id="show-tabpanel-rateHistory" aria-labelledby="show-tab-rateHistory">
            {selectedTab === 'rateHistory' && (
            <RateHistoryManager 
              showId={show.showId}
              showName={show.name}
              onRateUpdated={() => {
                // Could refresh show data or specific rate data
                console.log('Rate updated for show:', show.showId)
              }}
            />
            )}
          </Box>

          {/* Category Exclusivity Tab */}
          <Box role="tabpanel" hidden={selectedTab !== 'exclusivity'} id="show-tabpanel-exclusivity" aria-labelledby="show-tab-exclusivity">
            {selectedTab === 'exclusivity' && (
            <CategoryExclusivityManager 
              showId={show.showId}
              showName={show.name}
              onExclusivityUpdated={() => {
                // Could refresh show data or specific exclusivity data
                console.log('Exclusivity updated for show:', show.showId)
              }}
            />
            )}
          </Box>

          {/* Rate Analytics Tab */}
          <Box role="tabpanel" hidden={selectedTab !== 'rateAnalytics'} id="show-tabpanel-rateAnalytics" aria-labelledby="show-tab-rateAnalytics">
            {selectedTab === 'rateAnalytics' && (
            <RateTrendsAnalytics 
              showId={show.showId}
              organizationSlug={currentOrganization?.domain || currentOrganization?.id || ''}
            />
            )}
          </Box>

          {/* Settings Tab */}
          <Box role="tabpanel" hidden={selectedTab !== 'settings'} id="show-tabpanel-settings" aria-labelledby="show-tab-settings">
            {selectedTab === 'settings' && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>Show Information</Typography>
                  <TextField
                    fullWidth
                    label="Show Name"
                    value={settingsForm.name}
                    onChange={(e) => handleSettingsChange('name', e.target.value)}
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    label="Description"
                    value={settingsForm.description}
                    onChange={(e) => handleSettingsChange('description', e.target.value)}
                    multiline
                    rows={3}
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    label="Host"
                    value={settingsForm.host}
                    onChange={(e) => handleSettingsChange('host', e.target.value)}
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    label="Category"
                    value={settingsForm.category}
                    onChange={(e) => handleSettingsChange('category', e.target.value)}
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    label="Website"
                    value={settingsForm.website}
                    onChange={(e) => handleSettingsChange('website', e.target.value)}
                    margin="normal"
                  />
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>Social Media</Typography>
                  <TextField
                    fullWidth
                    label="Twitter"
                    value={settingsForm.socialMedia.twitter}
                    onChange={(e) => handleSettingsChange('socialMedia.twitter', e.target.value)}
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    label="Instagram"
                    value={settingsForm.socialMedia.instagram}
                    onChange={(e) => handleSettingsChange('socialMedia.instagram', e.target.value)}
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    label="Facebook"
                    value={settingsForm.socialMedia.facebook}
                    onChange={(e) => handleSettingsChange('socialMedia.facebook', e.target.value)}
                    margin="normal"
                  />
                  <Box sx={{ mt: 3 }}>
                    <Button 
                      variant="contained" 
                      sx={{ mr: 2 }}
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                    >
                      {isSavingSettings ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button 
                      variant="outlined"
                      onClick={handleCancelSettings}
                      disabled={isSavingSettings}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
            )}
          </Box>

          {/* Action Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem onClick={handleEdit}>
              <Edit fontSize="small" sx={{ mr: 1 }} />
              Edit Show
            </MenuItem>
            <MenuItem onClick={handleShare}>
              <Share fontSize="small" sx={{ mr: 1 }} />
              Share Show
            </MenuItem>
            <MenuItem onClick={handleExportData}>
              <Download fontSize="small" sx={{ mr: 1 }} />
              Export Data
            </MenuItem>
          </Menu>


          {/* Product Tracking Modal */}
          {selectedCampaign && (
            <ProductTrackingModal
              open={trackingModalOpen}
              onClose={() => {
                setTrackingModalOpen(false)
                setSelectedCampaign(null)
              }}
              campaign={selectedCampaign}
              onSave={handleSaveTracking}
            />
          )}
    </Box>
  )
}