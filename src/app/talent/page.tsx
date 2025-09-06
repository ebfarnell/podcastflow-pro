'use client'


import React from 'react'
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
} from '@mui/material'
import {
  Mic as MicIcon,
  Schedule as ScheduleIcon,
  PlayCircle as PlayIcon,
  Assignment as TaskIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'

export default function TalentDashboard() {
  const { user } = useAuth()
  const router = useRouter()

  // Fetch episodes assigned to talent
  const { data: episodesData, isLoading: episodesLoading } = useQuery({
    queryKey: ['talent', 'episodes', user?.id],
    queryFn: async () => {
      const response = await api.get('/episodes')
      // Filter episodes where current user is assigned as talent
      const episodes = response.data || []
      return episodes.filter((ep: any) => 
        ep.assignedTalent?.some((talent: any) => talent.id === user?.id)
      )
    },
    enabled: !!user?.id
  })

  // Fetch shows where talent is assigned
  const { data: showsData } = useQuery({
    queryKey: ['talent', 'shows', user?.id],
    queryFn: async () => {
      const response = await api.get('/shows')
      const shows = response.data || []
      return shows.filter((show: any) => 
        show.assignedTalent?.some((talent: any) => talent.id === user?.id)
      )
    },
    enabled: !!user?.id
  })

  // Calculate metrics
  const currentDate = new Date()
  const upcomingRecordings = episodesData?.filter((ep: any) => {
    const airDate = new Date(ep.airDate)
    return airDate > currentDate && ep.status === 'scheduled'
  }).slice(0, 5).map((ep: any) => ({
    id: ep.id,
    episodeName: ep.title,
    showName: showsData?.find((s: any) => s.id === ep.showId)?.name || 'Unknown Show',
    recordingDate: ep.airDate.split('T')[0],
    time: new Date(ep.airDate).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    }),
    status: ep.status || 'scheduled',
  })) || []

  const recentEpisodes = episodesData?.filter((ep: any) => {
    const airDate = new Date(ep.airDate)
    return airDate <= currentDate
  }).slice(0, 5).map((ep: any) => ({
    id: ep.id,
    episodeName: ep.title,
    showName: showsData?.find((s: any) => s.id === ep.showId)?.name || 'Unknown Show',
    recordedDate: ep.airDate.split('T')[0],
    status: ep.status === 'published' ? 'approved' : ep.status === 'draft' ? 'pending_review' : ep.status,
  })) || []

  // Calculate stats
  const thisMonth = new Date().getMonth()
  const thisYear = new Date().getFullYear()
  const episodesThisMonth = episodesData?.filter((ep: any) => {
    const epDate = new Date(ep.airDate)
    return epDate.getMonth() === thisMonth && epDate.getFullYear() === thisYear
  }).length || 0

  const approvedEpisodes = episodesData?.filter((ep: any) => 
    ep.status === 'published'
  ).length || 0

  // Fetch talent tasks
  const { data: tasksData } = useQuery({
    queryKey: ['talent', 'tasks'],
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
    enabled: !!user?.id
  })

  // Transform tasks for display
  const tasks = (tasksData?.tasks || []).map((task: any) => ({
    id: task.id,
    task: task.title,
    dueDate: task.dueDate,
    priority: task.priority,
  }))

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'info'
      case 'pending_review':
        return 'warning'
      case 'approved':
        return 'success'
      case 'rejected':
        return 'error'
      default:
        return 'default'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error'
      case 'medium':
        return 'warning'
      case 'low':
        return 'info'
      default:
        return 'default'
    }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.EPISODES_TALENT_MANAGE}>
      <DashboardLayout>
      <Box>
        <Typography variant="h4" gutterBottom>
          Welcome back, {user?.name || 'Talent'}!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Here's your recording schedule and episode status
        </Typography>

        <Grid container spacing={3}>
          {/* Stats Cards */}
          <Grid item xs={12} md={3}>
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
              onClick={() => router.push('/talent/schedule')}
            >
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <MicIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Upcoming Recordings
                    </Typography>
                    <Typography variant="h4">
                      {episodesLoading ? '-' : upcomingRecordings.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {upcomingRecordings.length > 0 ? 'Next recording soon' : 'No recordings scheduled'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
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
              onClick={() => router.push('/talent/episodes')}
            >
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PlayIcon sx={{ mr: 2, color: 'success.main' }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Episodes This Month
                    </Typography>
                    <Typography variant="h4">{episodesLoading ? '-' : episodesThisMonth}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {episodesThisMonth > 5 ? 'Above average' : 'This month'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
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
              onClick={() => router.push('/talent/episodes')}
            >
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CheckIcon sx={{ mr: 2, color: 'success.main' }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Approved Episodes
                    </Typography>
                    <Typography variant="h4">{episodesLoading ? '-' : approvedEpisodes}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      All time total
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
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
              onClick={() => router.push('/talent/dashboard')}
            >
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TaskIcon sx={{ mr: 2, color: 'warning.main' }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Pending Tasks
                    </Typography>
                    <Typography variant="h4">{tasks.length}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Due this week
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Upcoming Recordings */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Upcoming Recordings</Typography>
                <Button
                  startIcon={<CalendarIcon />}
                  onClick={() => router.push('/talent/schedule')}
                >
                  View Full Schedule
                </Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Episode</TableCell>
                      <TableCell>Show</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {upcomingRecordings.map((recording) => (
                      <TableRow key={recording.id}>
                        <TableCell>{recording.episodeName}</TableCell>
                        <TableCell>{recording.showName}</TableCell>
                        <TableCell>{recording.recordingDate}</TableCell>
                        <TableCell>{recording.time}</TableCell>
                        <TableCell>
                          <Chip
                            label={recording.status}
                            size="small"
                            color={getStatusColor(recording.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/episodes/${recording.id}`)
                          }}>
                            <ViewIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Tasks */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Tasks
              </Typography>
              <List>
                {tasks.map((task) => (
                  <ListItem key={task.id}>
                    <ListItemIcon>
                      <TaskIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={task.task}
                      secondary={`Due: ${task.dueDate}`}
                    />
                    <Chip
                      label={task.priority}
                      size="small"
                      color={getPriorityColor(task.priority)}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>

          {/* Recent Episodes */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Recent Episodes</Typography>
                <Button onClick={() => router.push('/talent/episodes')}>
                  View All Episodes
                </Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Episode</TableCell>
                      <TableCell>Show</TableCell>
                      <TableCell>Recorded Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentEpisodes.map((episode) => (
                      <TableRow key={episode.id}>
                        <TableCell>{episode.episodeName}</TableCell>
                        <TableCell>{episode.showName}</TableCell>
                        <TableCell>{episode.recordedDate}</TableCell>
                        <TableCell>
                          <Chip
                            label={episode.status.replace('_', ' ')}
                            size="small"
                            color={getStatusColor(episode.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/episodes/${episode.id}`)
                          }}>
                            <ViewIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
    </RouteProtection>
  )
}