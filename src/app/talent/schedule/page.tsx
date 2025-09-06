'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Divider,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import {
  CalendarMonth,
  Schedule,
  Mic,
  PlayCircle,
  LocationOn,
  VideoCall,
  Description,
  ChevronLeft,
  ChevronRight,
  Today,
  ViewWeek,
  ViewModule,
  Add,
  Edit,
  NotificationsActive,
  CheckCircle,
  Warning
} from '@mui/icons-material'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  addHours,
  isBefore,
  isAfter
} from 'date-fns'

interface ScheduledRecording {
  id: string
  episodeId: string
  episodeTitle: string
  showName: string
  showHost: string
  recordingDate: string
  duration: number
  location: 'studio' | 'remote'
  studioName?: string
  meetingLink?: string
  script?: string
  scriptUrl?: string
  notes?: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  reminder?: boolean
}

type ViewType = 'month' | 'week' | 'list'

export default function TalentSchedulePage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recordings, setRecordings] = useState<ScheduledRecording[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<ViewType>('month')
  const [selectedRecording, setSelectedRecording] = useState<ScheduledRecording | null>(null)
  const [detailsDialog, setDetailsDialog] = useState(false)
  const [rescheduleDialog, setRescheduleDialog] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchSchedule()
    }
  }, [user, sessionLoading, currentDate])

  const fetchSchedule = async () => {
    try {
      setLoading(true)
      const start = viewType === 'week' 
        ? startOfWeek(currentDate)
        : startOfMonth(currentDate)
      const end = viewType === 'week'
        ? endOfWeek(currentDate)
        : endOfMonth(currentDate)

      const params = new URLSearchParams({
        talentId: user?.id || '',
        startDate: start.toISOString(),
        endDate: end.toISOString()
      })

      const response = await fetch(`/api/talent/schedule?${params}`)
      if (!response.ok) throw new Error('Failed to fetch schedule')
      
      const data = await response.json()
      
      // Transform the data
      const transformedRecordings = data.recordings.map((recording: any) => ({
        id: recording.id,
        episodeId: recording.episodeId,
        episodeTitle: recording.episode?.title || '',
        showName: recording.episode?.show?.name || '',
        showHost: recording.episode?.show?.host || '',
        recordingDate: recording.recordingDate,
        duration: recording.duration || 60,
        location: recording.location || 'studio',
        studioName: recording.studioName,
        meetingLink: recording.meetingLink,
        script: recording.episode?.script,
        scriptUrl: recording.episode?.scriptUrl,
        notes: recording.notes,
        status: recording.status || 'scheduled',
        reminder: recording.reminder || false
      }))

      setRecordings(transformedRecordings)
    } catch (err) {
      console.error('Error fetching schedule:', err)
      setError('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousPeriod = () => {
    setCurrentDate(prev => subMonths(prev, 1))
  }

  const handleNextPeriod = () => {
    setCurrentDate(prev => addMonths(prev, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleViewDetails = (recording: ScheduledRecording) => {
    setSelectedRecording(recording)
    setDetailsDialog(true)
  }

  const handleReschedule = () => {
    if (selectedRecording) {
      const date = new Date(selectedRecording.recordingDate)
      setNewDate(format(date, 'yyyy-MM-dd'))
      setNewTime(format(date, 'HH:mm'))
      setDetailsDialog(false)
      setRescheduleDialog(true)
    }
  }

  const confirmReschedule = async () => {
    if (!selectedRecording || !newDate || !newTime) return

    try {
      const newDateTime = new Date(`${newDate}T${newTime}`)
      
      const response = await fetch(`/api/talent/schedule/${selectedRecording.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingDate: newDateTime.toISOString() })
      })
      
      if (!response.ok) throw new Error('Failed to reschedule')
      
      setRescheduleDialog(false)
      setSelectedRecording(null)
      fetchSchedule()
    } catch (err) {
      console.error('Error rescheduling:', err)
      setError('Failed to reschedule recording')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'success'
      case 'completed':
        return 'info'
      case 'cancelled':
        return 'error'
      case 'scheduled':
      default:
        return 'warning'
    }
  }

  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentDate))
    const end = endOfWeek(endOfMonth(currentDate))
    return eachDayOfInterval({ start, end })
  }

  const getRecordingsForDay = (day: Date) => {
    return recordings.filter(recording => 
      isSameDay(parseISO(recording.recordingDate), day)
    )
  }

  const upcomingRecordings = recordings
    .filter(r => isAfter(parseISO(r.recordingDate), new Date()))
    .sort((a, b) => parseISO(a.recordingDate).getTime() - parseISO(b.recordingDate).getTime())
    .slice(0, 5)

  if (sessionLoading || loading) {
    return (
      <RouteProtection requiredPermission={PERMISSIONS.EPISODES_TALENT_MANAGE}>
        <DashboardLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
          </Box>
        </DashboardLayout>
      </RouteProtection>
    )
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.EPISODES_TALENT_MANAGE}>
      <DashboardLayout>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                Recording Schedule
              </Typography>
              <Typography variant="body1" color="text.secondary">
                View and manage your recording schedule
              </Typography>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Grid container spacing={3}>
            {/* Calendar View */}
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 2 }}>
                {/* Calendar Controls */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={handlePreviousPeriod}>
                      <ChevronLeft />
                    </IconButton>
                    <Typography variant="h6">
                      {format(currentDate, 'MMMM yyyy')}
                    </Typography>
                    <IconButton onClick={handleNextPeriod}>
                      <ChevronRight />
                    </IconButton>
                    <Button
                      size="small"
                      startIcon={<Today />}
                      onClick={handleToday}
                    >
                      Today
                    </Button>
                  </Box>
                  <ToggleButtonGroup
                    value={viewType}
                    exclusive
                    onChange={(e, v) => v && setViewType(v)}
                    size="small"
                  >
                    <ToggleButton value="month">
                      <ViewModule />
                    </ToggleButton>
                    <ToggleButton value="week">
                      <ViewWeek />
                    </ToggleButton>
                    <ToggleButton value="list">
                      <Description />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {/* Calendar Grid */}
                {viewType === 'month' && (
                  <>
                    <Grid container spacing={0}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <Grid item xs={12 / 7} key={day}>
                          <Box sx={{ p: 1, textAlign: 'center', fontWeight: 'bold' }}>
                            {day}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                    <Divider />
                    <Grid container spacing={0}>
                      {getDaysInMonth().map((day, index) => {
                        const dayRecordings = getRecordingsForDay(day)
                        return (
                          <Grid item xs={12 / 7} key={index}>
                            <Box
                              sx={{
                                p: 1,
                                minHeight: 100,
                                borderRight: '1px solid',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                bgcolor: !isSameMonth(day, currentDate) ? 'grey.50' : 'background.paper',
                                position: 'relative'
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: isToday(day) ? 'bold' : 'normal',
                                  color: isToday(day) ? 'primary.main' : 'text.primary'
                                }}
                              >
                                {format(day, 'd')}
                              </Typography>
                              {dayRecordings.map((recording, idx) => (
                                <Box
                                  key={recording.id}
                                  sx={{
                                    mt: 0.5,
                                    p: 0.5,
                                    bgcolor: 'primary.light',
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'primary.main' }
                                  }}
                                  onClick={() => handleViewDetails(recording)}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      display: 'block',
                                      color: 'primary.contrastText',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {format(parseISO(recording.recordingDate), 'h:mm a')}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      display: 'block',
                                      color: 'primary.contrastText',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {recording.showName}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </Grid>
                        )
                      })}
                    </Grid>
                  </>
                )}

                {viewType === 'list' && (
                  <List>
                    {recordings.length === 0 ? (
                      <ListItem>
                        <ListItemText
                          primary="No recordings scheduled"
                          secondary="Your recording schedule is empty for this period"
                        />
                      </ListItem>
                    ) : (
                      recordings.map((recording) => (
                        <ListItem
                          key={recording.id}
                          button
                          onClick={() => handleViewDetails(recording)}
                        >
                          <ListItemIcon>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              <Mic />
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={recording.episodeTitle}
                            secondary={
                              <Box>
                                <Typography variant="body2" component="span">
                                  {recording.showName} • {format(parseISO(recording.recordingDate), 'PPp')}
                                </Typography>
                                <br />
                                <Chip
                                  label={recording.location}
                                  size="small"
                                  icon={recording.location === 'remote' ? <VideoCall /> : <LocationOn />}
                                  sx={{ mt: 0.5 }}
                                />
                              </Box>
                            }
                          />
                          <Chip
                            label={recording.status}
                            color={getStatusColor(recording.status)}
                            size="small"
                          />
                        </ListItem>
                      ))
                    )}
                  </List>
                )}
              </Paper>
            </Grid>

            {/* Sidebar */}
            <Grid item xs={12} lg={4}>
              {/* Upcoming Recordings */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Upcoming Recordings
                  </Typography>
                  <List dense>
                    {upcomingRecordings.length === 0 ? (
                      <ListItem>
                        <ListItemText
                          primary="No upcoming recordings"
                          secondary="Your schedule is clear"
                        />
                      </ListItem>
                    ) : (
                      upcomingRecordings.map((recording) => (
                        <ListItem key={recording.id}>
                          <ListItemIcon>
                            <Schedule color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={recording.episodeTitle}
                            secondary={
                              <>
                                {recording.showName}
                                <br />
                                {format(parseISO(recording.recordingDate), 'PPp')}
                              </>
                            }
                          />
                        </ListItem>
                      ))
                    )}
                  </List>
                </CardContent>
              </Card>

              {/* Recording Stats */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    This Month
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">
                          {recordings.filter(r => r.status === 'scheduled' || r.status === 'confirmed').length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Scheduled
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="success.main">
                          {recordings.filter(r => r.status === 'completed').length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Completed
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Recording Details Dialog */}
          <Dialog open={detailsDialog} onClose={() => setDetailsDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Recording Details</DialogTitle>
            <DialogContent>
              {selectedRecording && (
                <Box sx={{ pt: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>
                        {selectedRecording.episodeTitle}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Show</Typography>
                      <Typography variant="body1">{selectedRecording.showName}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Host</Typography>
                      <Typography variant="body1">{selectedRecording.showHost}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Date & Time</Typography>
                      <Typography variant="body1">
                        {format(parseISO(selectedRecording.recordingDate), 'PPp')}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Duration</Typography>
                      <Typography variant="body1">{Math.round(selectedRecording.duration / 60)} minutes</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Location</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        {selectedRecording.location === 'remote' ? (
                          <>
                            <VideoCall color="primary" />
                            <Typography variant="body1">
                              Remote Recording
                              {selectedRecording.meetingLink && (
                                <Button
                                  size="small"
                                  href={selectedRecording.meetingLink}
                                  target="_blank"
                                  sx={{ ml: 2 }}
                                >
                                  Join Meeting
                                </Button>
                              )}
                            </Typography>
                          </>
                        ) : (
                          <>
                            <LocationOn color="primary" />
                            <Typography variant="body1">
                              {selectedRecording.studioName || 'Studio Recording'}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Grid>
                    {selectedRecording.scriptUrl && (
                      <Grid item xs={12}>
                        <Button
                          variant="outlined"
                          startIcon={<Description />}
                          href={selectedRecording.scriptUrl}
                          target="_blank"
                          fullWidth
                        >
                          View Script
                        </Button>
                      </Grid>
                    )}
                    {selectedRecording.notes && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">Notes</Typography>
                        <Typography variant="body1">{selectedRecording.notes}</Typography>
                      </Grid>
                    )}
                    <Grid item xs={12}>
                      <Chip
                        label={selectedRecording.status}
                        color={getStatusColor(selectedRecording.status)}
                        sx={{ mr: 1 }}
                      />
                      {selectedRecording.reminder && (
                        <Chip
                          label="Reminder Set"
                          icon={<NotificationsActive />}
                          color="info"
                          variant="outlined"
                        />
                      )}
                    </Grid>
                  </Grid>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              {selectedRecording?.status === 'scheduled' && (
                <Button onClick={handleReschedule} startIcon={<Edit />}>
                  Request Reschedule
                </Button>
              )}
              <Button onClick={() => setDetailsDialog(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* Reschedule Dialog */}
          <Dialog open={rescheduleDialog} onClose={() => setRescheduleDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Request Reschedule</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Request a new date and time for this recording session.
                </Typography>
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="New Date"
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="New Time"
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRescheduleDialog(false)}>Cancel</Button>
              <Button onClick={confirmReschedule} variant="contained" disabled={!newDate || !newTime}>
                Submit Request
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}