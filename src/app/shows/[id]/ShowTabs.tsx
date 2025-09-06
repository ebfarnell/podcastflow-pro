'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Box,
  Tab,
  Tabs,
  Paper,
  Grid,
  Button,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  LinearProgress,
} from '@mui/material'
import {
  Edit,
  Visibility,
  PlayArrow,
} from '@mui/icons-material'
import { formatDuration, formatCompactNumber } from '@/lib/utils/format'
import { RevenueProjectionForm } from '@/components/shows/RevenueProjectionForm'
import RateHistoryManager from '@/components/shows/RateHistoryManager'
import CategoryExclusivityManager from '@/components/shows/CategoryExclusivityManager'
import RateTrendsAnalytics from '@/components/analytics/RateTrendsAnalytics'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { ProductShipment } from '@/components/campaigns/ProductTrackingModal'

// Tab configuration with string keys for stability
export type ShowTabKey = 'episodes' | 'campaigns' | 'revenue' | 'rateHistory' | 'exclusivity' | 'rateAnalytics' | 'settings'

interface TabConfig {
  key: ShowTabKey
  label: string
  requiredRoles?: string[] // If specified, only these roles can see the tab
  alwaysVisible?: boolean // If true, always show (default tabs)
}

const TAB_CONFIGS: TabConfig[] = [
  { key: 'episodes', label: 'Episodes', alwaysVisible: true },
  { key: 'campaigns', label: 'Campaigns', alwaysVisible: true },
  { key: 'revenue', label: 'Revenue Projections', alwaysVisible: true },
  { key: 'rateHistory', label: 'Rate History', requiredRoles: ['admin', 'master', 'sales'] },
  { key: 'exclusivity', label: 'Category Exclusivity', requiredRoles: ['admin', 'master', 'sales'] },
  { key: 'rateAnalytics', label: 'Rate Analytics', requiredRoles: ['admin', 'master', 'sales'] },
  { key: 'settings', label: 'Settings', alwaysVisible: true },
]

interface TabPanelProps {
  children?: React.ReactNode
  value: ShowTabKey
  selectedValue: ShowTabKey
}

function TabPanel(props: TabPanelProps) {
  const { children, value, selectedValue, ...other } = props
  
  return (
    <div
      role="tabpanel"
      hidden={value !== selectedValue}
      id={`show-tabpanel-${value}`}
      aria-labelledby={`show-tab-${value}`}
      {...other}
    >
      {value === selectedValue && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

interface ShowTabsProps {
  show: any
  episodes: any[]
  campaigns: any[]
  router: any
  play: any
  user: any
  currentOrganization: any
  searchParams: URLSearchParams
  playingEpisode: any
  setPlayingEpisode: (episode: any) => void
  getEpisodeStatusColor: (status: string) => any
  getCampaignStatusColor: (status: string) => any
}

export function ShowTabs(props: ShowTabsProps) {
  const {
    show,
    episodes,
    campaigns,
    router,
    play,
    user,
    currentOrganization,
    searchParams,
    playingEpisode,
    setPlayingEpisode,
    getEpisodeStatusColor,
    getCampaignStatusColor,
  } = props

  // Get visible tabs based on user role
  const visibleTabs = useMemo(() => {
    return TAB_CONFIGS.filter(tab => {
      if (tab.alwaysVisible) return true
      if (!tab.requiredRoles) return true
      if (!user) return false
      return tab.requiredRoles.includes(user.role)
    })
  }, [user])

  // Initialize selected tab from URL, localStorage, or default
  const getInitialTab = (): ShowTabKey => {
    // First check URL query param
    const urlTab = searchParams.get('tab')
    if (urlTab && visibleTabs.some(t => t.key === urlTab)) {
      return urlTab as ShowTabKey
    }
    
    // Then check localStorage
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem(`showTab-${show.showId}`)
      if (savedTab && visibleTabs.some(t => t.key === savedTab)) {
        return savedTab as ShowTabKey
      }
    }
    
    // Default to first visible tab
    return visibleTabs[0]?.key || 'episodes'
  }

  const [selectedTab, setSelectedTab] = useState<ShowTabKey>(getInitialTab())

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

  // Update URL and localStorage when tab changes
  useEffect(() => {
    // Update URL query param (shallow routing)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', selectedTab)
    window.history.replaceState(null, '', url.toString())
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`showTab-${show.showId}`, selectedTab)
    }
  }, [selectedTab, show.showId])

  // Sync with URL changes (e.g., browser back/forward)
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && visibleTabs.some(t => t.key === urlTab) && urlTab !== selectedTab) {
      setSelectedTab(urlTab as ShowTabKey)
    }
  }, [searchParams, visibleTabs, selectedTab])

  const handleTabChange = (event: React.SyntheticEvent, newValue: ShowTabKey) => {
    setSelectedTab(newValue)
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
    <Box>
      {/* Tabs Header */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={selectedTab} 
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Show detail tabs"
        >
          {visibleTabs.map((tab) => (
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

      {/* Episodes Tab */}
      <TabPanel value="episodes" selectedValue={selectedTab}>
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
      </TabPanel>

      {/* Campaigns Tab */}
      <TabPanel value="campaigns" selectedValue={selectedTab}>
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
      </TabPanel>

      {/* Revenue Projections Tab */}
      <TabPanel value="revenue" selectedValue={selectedTab}>
        <RevenueProjectionForm 
          show={{
            id: show.showId,
            name: show.name,
            ...show
          }}
          onUpdate={() => {
            window.location.reload()
          }}
        />
      </TabPanel>

      {/* Rate History Tab */}
      <TabPanel value="rateHistory" selectedValue={selectedTab}>
        <RateHistoryManager 
          showId={show.showId}
          showName={show.name}
          onRateUpdated={() => {
            console.log('Rate updated for show:', show.showId)
          }}
        />
      </TabPanel>

      {/* Category Exclusivity Tab */}
      <TabPanel value="exclusivity" selectedValue={selectedTab}>
        <CategoryExclusivityManager 
          showId={show.showId}
          showName={show.name}
          onExclusivityUpdated={() => {
            console.log('Exclusivity updated for show:', show.showId)
          }}
        />
      </TabPanel>

      {/* Rate Analytics Tab */}
      <TabPanel value="rateAnalytics" selectedValue={selectedTab}>
        <RateTrendsAnalytics 
          showId={show.showId}
          organizationSlug={currentOrganization?.domain || currentOrganization?.id || ''}
        />
      </TabPanel>

      {/* Settings Tab */}
      <TabPanel value="settings" selectedValue={selectedTab}>
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
      </TabPanel>
    </Box>
  )
}