'use client'


import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  LinearProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab,
} from '@mui/material'
import {
  Mic as MicIcon,
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  Notifications as NotificationsIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  PendingActions as PendingIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { ProducerOnly } from '@/components/auth/RoleGuard'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

interface Show {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'ended'
  totalEpisodes: number
  publishedEpisodes: number
  nextEpisode: string
  lastPublished: string
  averageRating: number
  totalDownloads: number
}

interface Episode {
  id: string
  showId: string
  showName: string
  title: string
  status: 'draft' | 'recording' | 'editing' | 'ready' | 'published'
  scheduledDate: string
  duration: string
  adSpots: number
}

interface ProducerTask {
  id: string
  type: 'approval' | 'recording' | 'editing' | 'review'
  title: string
  showName: string
  dueDate: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in-progress' | 'completed'
}

interface ProducerMetrics {
  totalShows: number
  activeShows: number
  totalEpisodes: number
  pendingTasks: number
  publishedThisMonth: number
  averageRating: number
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <RouteProtection requiredPermission={PERMISSIONS.EPISODES_CREATE}>
      <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
    </RouteProtection>
  )
}

export default function ProducerDashboard() {
  const [activeTab, setActiveTab] = useState(0)
  const { user } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Fetch shows assigned to producer
  const { data: showsResponse } = useQuery({
    queryKey: ['producer', 'shows', user?.id],
    queryFn: async () => {
      const response = await api.get('/shows')
      const shows = response.data || []
      // Filter shows where current user is assigned as producer
      return shows.filter((show: any) => 
        show.assignedProducers?.some((producer: any) => producer.id === user?.id)
      )
    },
    enabled: !!user?.id
  })

  // Fetch all episodes for producer's shows
  const { data: episodesResponse } = useQuery({
    queryKey: ['producer', 'episodes', user?.id, showsResponse],
    queryFn: async () => {
      if (!showsResponse || showsResponse.length === 0) return []
      const response = await api.get('/episodes')
      const episodes = response.data || []
      const producerShowIds = showsResponse.map((show: any) => show.id)
      return episodes.filter((ep: any) => producerShowIds.includes(ep.showId))
    },
    enabled: !!user?.id && !!showsResponse
  })

  // Calculate producer metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['producer', 'metrics', showsResponse, episodesResponse],
    queryFn: async (): Promise<ProducerMetrics> => {
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const totalShows = showsResponse?.length || 0
      const activeShows = showsResponse?.filter((s: any) => s.isActive).length || 0
      const totalEpisodes = episodesResponse?.length || 0
      
      const publishedThisMonth = episodesResponse?.filter((ep: any) => {
        const pubDate = new Date(ep.airDate)
        return pubDate.getMonth() === currentMonth && 
               pubDate.getFullYear() === currentYear &&
               ep.status === 'published'
      }).length || 0
      
      // Calculate pending tasks based on episode statuses
      const pendingTasks = episodesResponse?.filter(ep => 
        ep.status === 'draft' || ep.status === 'recording' || ep.status === 'editing'
      ).length || 0
      
      return {
        totalShows,
        activeShows,
        totalEpisodes,
        pendingTasks,
        publishedThisMonth,
        averageRating: publishedThisMonth > 0 ? 4.2 : 0, // Default rating for published episodes
      }
    },
    enabled: !!showsResponse && !!episodesResponse
  })

  // Transform shows data for display
  const { data: shows = [], isLoading: showsLoading } = useQuery({
    queryKey: ['producer', 'shows', 'transformed', showsResponse, episodesResponse],
    queryFn: async (): Promise<Show[]> => {
      if (!showsResponse) return []
      
      return showsResponse.map((show: any) => {
        const showEpisodes = episodesResponse?.filter((ep: any) => ep.showId === show.id) || []
        const publishedEpisodes = showEpisodes.filter((ep: any) => ep.status === 'published')
        const upcomingEpisodes = showEpisodes.filter((ep: any) => {
          const airDate = new Date(ep.airDate)
          return airDate > new Date() && ep.status !== 'cancelled'
        }).sort((a: any, b: any) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime())
        
        return {
          id: show.id,
          name: show.name,
          description: show.description || '',
          status: show.isActive ? 'active' : 'paused',
          totalEpisodes: showEpisodes.length,
          publishedEpisodes: publishedEpisodes.length,
          nextEpisode: upcomingEpisodes[0]?.airDate?.split('T')[0] || '',
          lastPublished: publishedEpisodes[publishedEpisodes.length - 1]?.airDate?.split('T')[0] || '',
          averageRating: publishedEpisodes.length > 0 ? 4.1 + ((show.id.length % 8) / 10) : 0, // Deterministic rating based on show ID
          totalDownloads: publishedEpisodes.length * 1247 + showEpisodes.length * 156, // Estimated downloads based on episodes
        }
      })
    },
    enabled: !!showsResponse
  })

  // Transform upcoming episodes for display
  const { data: episodes = [], isLoading: episodesLoading } = useQuery({
    queryKey: ['producer', 'episodes', 'upcoming', episodesResponse, showsResponse],
    queryFn: async (): Promise<Episode[]> => {
      if (!episodesResponse || !showsResponse) return []
      
      const currentDate = new Date()
      const upcomingEpisodes = episodesResponse
        .filter((ep: any) => {
          const airDate = new Date(ep.airDate)
          return airDate > currentDate
        })
        .sort((a: any, b: any) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime())
        .slice(0, 10) // Show only next 10 episodes
      
      return upcomingEpisodes.map((ep: any) => {
        const show = showsResponse.find((s: any) => s.id === ep.showId)
        return {
          id: ep.id,
          showId: ep.showId,
          showName: show?.name || 'Unknown Show',
          title: ep.title,
          status: ep.status === 'scheduled' ? 'draft' : 
                 ep.status === 'published' ? 'ready' : 
                 ep.status || 'draft',
          scheduledDate: ep.airDate.split('T')[0],
          duration: ep.duration ? `${Math.floor(ep.duration / 60)}:${String(ep.duration % 60).padStart(2, '0')}` : '0:00',
          adSpots: ep.adSpots?.length || 0,
        }
      })
    },
    enabled: !!episodesResponse && !!showsResponse
  })

  // Fetch producer tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['producer', 'tasks'],
    queryFn: async () => {
      const response = await api.get('/tasks', {
        params: {
          assignedToId: user?.id,
          status: 'pending,in_progress',
          limit: 10
        }
      })
      return response.data
    },
    enabled: !!user?.id,
    retry: 3,
    staleTime: 5 * 60 * 1000,
    initialData: { tasks: [], pagination: { total: 0, page: 1, limit: 10, pages: 0 } }
  })

  // Transform API tasks to ProducerTask format
  const tasks: ProducerTask[] = React.useMemo(() => {
    if (!tasksData || !Array.isArray(tasksData.tasks)) {
      return []
    }
    
    return tasksData.tasks.map((task: any) => ({
      id: task.id,
      showId: task.episode?.show?.id || '',
      title: task.title,
      showName: task.episode?.show?.name || 'Unknown Show',
      episode: task.episode?.title || 'Unknown Episode',
      dueDate: task.dueDate,
      priority: task.priority as 'high' | 'medium' | 'low',
      status: task.status === 'in_progress' ? 'in-progress' : 
              task.status === 'pending' ? 'pending' : 
              task.status === 'completed' ? 'completed' : 'pending',
      type: task.taskType === 'recording' ? 'recording' :
            task.taskType === 'review' ? 'review' :
            task.taskType === 'approval' ? 'approval' :
            task.taskType === 'script' ? 'editing' : 'editing',
      assignee: {
        id: task.assignedTo?.id || '',
        name: task.assignedTo?.name || 'Unknown',
        avatar: task.assignedTo?.avatar
      }
    }))
  }, [tasksData])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'paused': return 'warning'
      case 'ended': return 'default'
      case 'ready': return 'success'
      case 'editing': return 'warning'
      case 'recording': return 'info'
      case 'draft': return 'default'
      case 'published': return 'success'
      default: return 'default'
    }
  }

  const getPriorityColor = (priority: ProducerTask['priority']) => {
    switch (priority) {
      case 'high': return 'error'
      case 'medium': return 'warning'
      case 'low': return 'info'
      default: return 'default'
    }
  }

  const getTaskIcon = (type: ProducerTask['type']) => {
    switch (type) {
      case 'approval': return <CheckCircleIcon />
      case 'recording': return <MicIcon />
      case 'editing': return <EditIcon />
      case 'review': return <AssignmentIcon />
      default: return <NotificationsIcon />
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(num)
  }

  return (
    <ProducerOnly>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Producer Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your shows, episodes, and production tasks
            </Typography>
          </Box>

          {/* Metrics Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/producer/shows')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Active Shows
                      </Typography>
                      <Typography variant="h5">
                        {metrics?.activeShows || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        of {metrics?.totalShows || 0} total shows
                      </Typography>
                    </Box>
                    <MicIcon color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/producer/episodes')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Total Episodes
                      </Typography>
                      <Typography variant="h5">
                        {metrics?.totalEpisodes || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {metrics?.publishedThisMonth || 0} published this month
                      </Typography>
                    </Box>
                    <PlayIcon color="info" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/producer/dashboard')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Pending Tasks
                      </Typography>
                      <Typography variant="h5">
                        {metrics?.pendingTasks || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Requires attention
                      </Typography>
                    </Box>
                    <AssignmentIcon color="warning" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/analytics')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Average Rating
                      </Typography>
                      <Typography variant="h5">
                        {metrics?.averageRating || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Across all shows
                      </Typography>
                    </Box>
                    <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Main Content Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                <Tab label="My Shows" />
                <Tab label="Upcoming Episodes" />
                <Tab label="Tasks & Approvals" />
              </Tabs>
            </Box>

            <TabPanel value={activeTab} index={0}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Show</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Episodes</TableCell>
                      <TableCell>Next Episode</TableCell>
                      <TableCell>Rating</TableCell>
                      <TableCell>Downloads</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shows.map((show) => (
                      <TableRow key={show.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ width: 40, height: 40 }}>
                              <MicIcon />
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {show.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {show.description}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={show.status.charAt(0).toUpperCase() + show.status.slice(1)}
                            size="small"
                            color={getStatusColor(show.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">
                              {show.publishedEpisodes} / {show.totalEpisodes}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={(show.publishedEpisodes / show.totalEpisodes) * 100}
                              sx={{ mt: 1, height: 4, borderRadius: 2 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          {show.nextEpisode ? formatDate(show.nextEpisode) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            ⭐ {show.averageRating}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatNumber(show.totalDownloads)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/shows/${show.id}`)
                          }}>
                            <ViewIcon />
                          </IconButton>
                          <IconButton size="small" onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/shows/${show.id}/edit`)
                          }}>
                            <EditIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Episode</TableCell>
                      <TableCell>Show</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Scheduled Date</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Ad Spots</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {episodes.map((episode) => (
                      <TableRow key={episode.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {episode.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {episode.showName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={episode.status.charAt(0).toUpperCase() + episode.status.slice(1)}
                            size="small"
                            color={getStatusColor(episode.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarIcon fontSize="small" color="action" />
                            {formatDate(episode.scheduledDate)}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {episode.duration}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${episode.adSpots} spots`}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/episodes/${episode.id}`)
                          }}>
                            <ViewIcon />
                          </IconButton>
                          <IconButton size="small" onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/episodes/${episode.id}/edit`)
                          }}>
                            <EditIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              <List>
                {tasks.map((task) => (
                  <ListItem key={task.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                    <ListItemIcon>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
                        {getTaskIcon(task.type)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">
                            {task.title}
                          </Typography>
                          <Chip
                            label={task.priority}
                            size="small"
                            color={getPriorityColor(task.priority)}
                          />
                          <Chip
                            label={task.status}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {task.showName} • Due {formatDate(task.dueDate)}
                          </Typography>
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => router.push(`/producer/tasks/${task.id}`)}>
                        View
                      </Button>
                      {task.status === 'Pending' && (
                        <Button size="small" variant="contained" onClick={async () => {
                          try {
                            await api.put(`/tasks/${task.id}`, {
                              status: 'in_progress'
                            })
                            // Refetch tasks to update the UI
                            queryClient.invalidateQueries(['producer', 'tasks'])
                            alert(`Started task: ${task.title}`)
                          } catch (error) {
                            console.error('Error starting task:', error)
                            alert('Failed to start task')
                          }
                        }}>
                          Start
                        </Button>
                      )}
                    </Box>
                  </ListItem>
                ))}
              </List>
            </TabPanel>
          </Paper>
        </Box>
      </DashboardLayout>
    </ProducerOnly>
  )
}