'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { showsApi, episodesApi } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  IconButton,
  Tab,
  Tabs,
} from '@mui/material'
import {
  PlayCircle,
  Mic,
  Description,
  Edit,
  PodcastsOutlined,
  TrendingUp,
  People,
  AttachMoney,
  Analytics,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`producer-tabpanel-${index}`}
      aria-labelledby={`producer-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function ProducerDashboard() {
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState(0)
  const { user } = useAuth()

  // Fetch shows assigned to this producer
  const { data: showsData, isLoading: showsLoading } = useQuery({
    queryKey: ['producer-shows', user?.id],
    queryFn: async () => {
      const response = await showsApi.list({ producerId: user?.id })
      return response.shows || []
    },
    enabled: !!user?.id
  })

  // Fetch episodes for assigned shows
  const { data: episodesData, isLoading: episodesLoading } = useQuery({
    queryKey: ['producer-episodes', user?.id],
    queryFn: async () => {
      const response = await episodesApi.list({ producerId: user?.id })
      return response.episodes || []
    },
    enabled: !!user?.id
  })

  const isLoading = showsLoading || episodesLoading

  // Calculate metrics
  const totalShows = showsData?.length || 0
  const activeShows = showsData?.filter((show: any) => show.isActive)?.length || 0
  const totalEpisodes = episodesData?.length || 0
  const upcomingEpisodes = episodesData?.filter((ep: any) => {
    if (!ep.airDate) return false
    return new Date(ep.airDate) > new Date()
  })?.length || 0
  const recordedEpisodes = episodesData?.filter((ep: any) => 
    ep.status === 'recorded' || ep.status === 'edited' || ep.status === 'published'
  )?.length || 0
  const drafts = episodesData?.filter((ep: any) => ep.status === 'draft')?.length || 0

  // Calculate total downloads and revenue from shows
  const totalDownloads = showsData?.reduce((sum: number, show: any) => 
    sum + (show.totalDownloads || 0), 0
  ) || 0
  const totalRevenue = showsData?.reduce((sum: number, show: any) => 
    sum + (show.totalRevenue || 0), 0
  ) || 0

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Producer Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your podcast shows and episodes
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              variant="contained" 
              startIcon={<PodcastsOutlined />}
              onClick={() => router.push('/producer/shows')}
            >
              My Shows
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<Mic />}
              onClick={() => router.push('/producer/episodes')}
            >
              Episodes
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Active Shows
                    </Typography>
                    <Typography variant="h4">
                      {activeShows}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      of {totalShows} total
                    </Typography>
                  </Box>
                  <PodcastsOutlined color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Total Episodes
                    </Typography>
                    <Typography variant="h4">
                      {totalEpisodes}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {recordedEpisodes} recorded
                    </Typography>
                  </Box>
                  <Mic color="info" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Downloads
                    </Typography>
                    <Typography variant="h4">
                      {totalDownloads.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      <TrendingUp fontSize="small" sx={{ verticalAlign: 'middle' }} /> All time
                    </Typography>
                  </Box>
                  <People color="success" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Revenue
                    </Typography>
                    <Typography variant="h4">
                      ${totalRevenue.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total earnings
                    </Typography>
                  </Box>
                  <AttachMoney color="warning" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={selectedTab}
            onChange={(_, newValue) => setSelectedTab(newValue)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Shows" />
            <Tab label="Episodes" />
            <Tab label="Analytics" />
          </Tabs>
        </Paper>

        {/* Shows Tab */}
        <TabPanel value={selectedTab} index={0}>
          <Grid container spacing={3}>
            {!showsData || showsData.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    No shows assigned to you yet
                  </Typography>
                </Paper>
              </Grid>
            ) : (
              showsData.map((show: any) => (
                <Grid item xs={12} md={6} key={show.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {show.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {show.host}
                          </Typography>
                        </Box>
                        <Chip
                          label={show.isActive ? 'Active' : 'Inactive'}
                          color={show.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          <strong>Category:</strong> {show.category || 'General'}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          <strong>Episodes:</strong> {show._count?.episodes || 0}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          <strong>Subscribers:</strong> {show.subscriberCount?.toLocaleString() || 0}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          <strong>Total Downloads:</strong> {show.totalDownloads?.toLocaleString() || 0}
                        </Typography>
                      </Box>

                      {show.description && (
                        <Box sx={{ mb: 2 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              p: 1,
                              bgcolor: 'grey.100',
                              borderRadius: 1,
                              fontStyle: 'italic',
                            }}
                          >
                            {show.description.substring(0, 150)}...
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<Description />}
                        onClick={() => router.push(`/shows/${show.id}`)}
                      >
                        View Details
                      </Button>
                      <Button
                        size="small"
                        color="primary"
                        startIcon={<Mic />}
                        onClick={() => router.push(`/producer/episodes?showId=${show.id}`)}
                      >
                        Manage Episodes
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </TabPanel>

        {/* Episodes Tab */}
        <TabPanel value={selectedTab} index={1}>
          <List>
            {!episodesData || episodesData.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  No episodes found for your shows
                </Typography>
              </Paper>
            ) : (
              episodesData.map((episode: any, index: number) => (
                <React.Fragment key={episode.id}>
                  <ListItem>
                    <ListItemText
                      primary={`Episode ${episode.episodeNumber}: ${episode.title}`}
                      secondary={
                        <Box>
                          <Typography variant="body2" component="span">
                            {episode.show?.name} • {Math.floor(episode.duration / 60)}m {episode.duration % 60}s
                          </Typography>
                          <br />
                          <Typography variant="caption" component="span">
                            Air Date: {episode.airDate ? new Date(episode.airDate).toLocaleDateString() : 'Not scheduled'}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip
                          label={episode.status}
                          color={episode.status === 'published' ? 'success' : episode.status === 'scheduled' ? 'info' : 'default'}
                          size="small"
                        />
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/episodes/${episode.id}`)}
                        >
                          <Edit />
                        </IconButton>
                        {episode.status === 'published' && episode.audioUrl && (
                          <IconButton size="small">
                            <PlayCircle />
                          </IconButton>
                        )}
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < episodesData.length - 1 && <Divider />}
                </React.Fragment>
              ))
            )}
          </List>
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={selectedTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Performance Overview</Typography>
                <Box sx={{ mt: 3 }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" color="primary">
                          {totalDownloads.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Downloads
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" color="success.main">
                          ${totalRevenue.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Revenue
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" color="info.main">
                          {showsData?.reduce((sum: number, show: any) => 
                            sum + (show.subscriberCount || 0), 0
                          )?.toLocaleString() || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Subscribers
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
                <Divider sx={{ my: 3 }} />
                <Typography variant="body2" color="text.secondary">
                  Analytics data is updated daily. For detailed analytics per show, visit the individual show pages.
                </Typography>
              </Paper>
            </Grid>
            {showsData && showsData.map((show: any) => (
              <Grid item xs={12} md={6} key={show.id}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>{show.name}</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Episodes" secondary={show._count?.episodes || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Subscribers" secondary={show.subscriberCount?.toLocaleString() || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Avg. Listeners" secondary={show.avgListeners?.toLocaleString() || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Downloads" secondary={show.totalDownloads?.toLocaleString() || 0} />
                    </ListItem>
                  </List>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Analytics />}
                    onClick={() => router.push(`/analytics?showId=${show.id}`)}
                    sx={{ mt: 2 }}
                  >
                    View Detailed Analytics
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </TabPanel>
      </Box>
    </DashboardLayout>
  )
}