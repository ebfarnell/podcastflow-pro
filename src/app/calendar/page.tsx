'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  LinearProgress,
  Alert,
  Stack,
} from '@mui/material'
import {
  Add,
  Today,
  PlayCircle,
  Campaign,
  AccessTime,
  Refresh,
  CalendarToday,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import moment from 'moment'
import { useQuery } from '@tanstack/react-query'
import { CalendarView } from '@/components/calendar/CalendarView'


interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: 'episode' | 'campaign' | 'deadline' | 'task'
  entityId?: string
  entityType?: string
  show?: string
  campaign?: string
  description?: string
  status?: string
  color?: string
}

export default function CalendarPage() {
  const router = useRouter()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [date, setDate] = useState(new Date())
  const [eventDialog, setEventDialog] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'episode' as 'episode' | 'campaign' | 'deadline',
    date: '',
    time: '',
    description: '',
    show: ''
  })

  // Fetch calendar events from API
  const { data: eventsData, isLoading, error, refetch } = useQuery({
    queryKey: ['calendar-events', date],
    queryFn: async () => {
      // Calculate date range for the month view with buffer
      const start = moment(date).startOf('month').subtract(7, 'days').toISOString()
      const end = moment(date).endOf('month').add(7, 'days').toISOString()
      
      const response = await fetch(`/api/calendar/events?start=${start}&end=${end}`)
      if (!response.ok) {
        throw new Error('Failed to fetch calendar events')
      }
      return response.json()
    },
    refetchInterval: 60000 // Refresh every minute
  })

  // Update events when data changes
  useEffect(() => {
    if (eventsData?.events) {
      const formattedEvents = eventsData.events.map((event: any) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      }))
      setEvents(formattedEvents)
    }
  }, [eventsData])

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setEventDialog(true)
  }

  const handleCreateEvent = () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) {
      alert('Please fill in all required fields')
      return
    }

    const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}:00`)
    const endDateTime = new Date(eventDateTime.getTime() + 60 * 60 * 1000) // Add 1 hour

    const createdEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: newEvent.title,
      start: eventDateTime,
      end: endDateTime,
      type: newEvent.type,
      description: newEvent.description || undefined,
      show: newEvent.show || undefined
    }

    setEvents(prev => [...prev, createdEvent])
    setEventDialog(false)
    setSelectedEvent(null)
    setNewEvent({
      title: '',
      type: 'episode',
      date: '',
      time: '',
      description: '',
      show: ''
    })
    alert('Event created successfully!')
  }

  const resetDialog = () => {
    setEventDialog(false)
    setSelectedEvent(null)
    setNewEvent({
      title: '',
      type: 'episode',
      date: '',
      time: '',
      description: '',
      show: ''
    })
  }

  const upcomingEvents = events
    .filter(e => e.start > new Date())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 5)

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Calendar
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage episodes, campaigns, and important deadlines
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<Today />} onClick={() => setDate(new Date())}>
              Today
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => {
              setSelectedEvent(null)
              setEventDialog(true)
            }}>
              Add Event
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Box sx={{ position: 'relative' }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <IconButton size="small" onClick={() => refetch()} disabled={isLoading}>
                  <Refresh />
                </IconButton>
              </Box>
              
              {isLoading && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
                  <LinearProgress />
                </Box>
              )}
              
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Failed to load calendar events. Please try refreshing.
                </Alert>
              )}
              
              {!isLoading && !error && events.length === 0 && (
                <Paper sx={{ p: 4 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'text.secondary'
                  }}>
                    <CalendarToday sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                    <Typography variant="h6" gutterBottom>
                      No events scheduled
                    </Typography>
                    <Typography variant="body2">
                      Your calendar is empty for the selected date range
                    </Typography>
                  </Box>
                </Paper>
              )}
              
              {!isLoading && (
                <CalendarView
                  events={events}
                  currentDate={date}
                  onDateChange={setDate}
                  onEventClick={handleSelectEvent}
                />
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Upcoming Events
                </Typography>
                {isLoading ? (
                  <Box sx={{ pt: 2 }}>
                    <LinearProgress />
                  </Box>
                ) : upcomingEvents.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    <Typography variant="body2">
                      No upcoming events
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {upcomingEvents.map((event) => (
                    <ListItem key={event.id} button onClick={() => handleSelectEvent(event)}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: event.type === 'episode' ? 'success.main' : 'primary.main' }}>
                          {event.type === 'episode' ? <PlayCircle /> : <Campaign />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={event.title}
                        secondary={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <AccessTime fontSize="small" />
                              <Typography variant="caption">
                                {moment(event.start).format('MMM D, h:mm A')}
                              </Typography>
                            </Box>
                            {event.show && (
                              <Chip label={event.show} size="small" sx={{ mt: 0.5 }} />
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Event Types
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, bgcolor: '#4caf50', borderRadius: 1 }} />
                    <Typography variant="body2">Episode Recording</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, bgcolor: '#ff9800', borderRadius: 1 }} />
                    <Typography variant="body2">Campaign</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, bgcolor: '#f44336', borderRadius: 1 }} />
                    <Typography variant="body2">Deadline</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Event Dialog */}
        <Dialog open={eventDialog} onClose={() => setEventDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {selectedEvent ? selectedEvent.title : 'Add New Event'}
          </DialogTitle>
          <DialogContent>
            {selectedEvent ? (
              <Box sx={{ pt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Type
                </Typography>
                <Chip 
                  label={selectedEvent.type} 
                  color={selectedEvent.type === 'episode' ? 'success' : 'primary'}
                  sx={{ mb: 2 }}
                />
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Date & Time
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {moment(selectedEvent.start).format('MMMM D, YYYY')} at {moment(selectedEvent.start).format('h:mm A')}
                </Typography>
                
                {selectedEvent.description && (
                  <>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                      Description
                    </Typography>
                    <Typography variant="body1">
                      {selectedEvent.description}
                    </Typography>
                  </>
                )}
                
                {selectedEvent.show && (
                  <>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                      Show
                    </Typography>
                    <Typography variant="body1">
                      {selectedEvent.show}
                    </Typography>
                  </>
                )}
              </Box>
            ) : (
              <Box sx={{ pt: 2 }}>
                <TextField 
                  fullWidth 
                  label="Event Title" 
                  margin="normal"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  required
                />
                <TextField 
                  fullWidth 
                  label="Event Type" 
                  select 
                  margin="normal"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({...newEvent, type: e.target.value as 'episode' | 'campaign' | 'deadline'})}
                >
                  <MenuItem value="episode">Episode Recording</MenuItem>
                  <MenuItem value="campaign">Campaign</MenuItem>
                  <MenuItem value="deadline">Deadline</MenuItem>
                </TextField>
                <TextField 
                  fullWidth 
                  label="Date" 
                  type="date" 
                  margin="normal" 
                  InputLabelProps={{ shrink: true }}
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                  required
                />
                <TextField 
                  fullWidth 
                  label="Time" 
                  type="time" 
                  margin="normal" 
                  InputLabelProps={{ shrink: true }}
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                  required
                />
                {newEvent.type === 'episode' && (
                  <TextField 
                    fullWidth 
                    label="Show Name" 
                    margin="normal"
                    value={newEvent.show}
                    onChange={(e) => setNewEvent({...newEvent, show: e.target.value})}
                  />
                )}
                <TextField 
                  fullWidth 
                  label="Description" 
                  multiline 
                  rows={3} 
                  margin="normal"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={resetDialog}>
              Cancel
            </Button>
            {selectedEvent ? (
              <Button variant="contained" onClick={async () => {
                // Debug logging function that persists to localStorage
                const debugLog = (message: string, data?: any) => {
                  const timestamp = new Date().toISOString()
                  const logEntry = {
                    timestamp,
                    page: 'calendar',
                    message,
                    data: data ? JSON.stringify(data) : undefined,
                    url: window.location.href
                  }
                  
                  console.log(`[${timestamp}] ${message}`, data || '')
                  
                  const existingLogs = JSON.parse(localStorage.getItem('podcastflow-debug-logs') || '[]')
                  existingLogs.push(logEntry)
                  if (existingLogs.length > 100) existingLogs.shift()
                  localStorage.setItem('podcastflow-debug-logs', JSON.stringify(existingLogs))
                }

                debugLog('📅 Calendar View Details clicked', {
                  eventType: selectedEvent.type,
                  entityId: selectedEvent.entityId,
                  fullEvent: selectedEvent
                })
                
                // First verify authentication before navigation
                try {
                  const authResponse = await fetch('/api/auth/check', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                      'Content-Type': 'application/json',
                    }
                  })
                  
                  debugLog('📅 Auth check response', {
                    status: authResponse.status,
                    ok: authResponse.ok
                  })
                  
                  const authData = await authResponse.json()
                  debugLog('📅 Auth data received', authData)
                  
                  if (!authData.authenticated) {
                    debugLog('📅 ❌ User not authenticated', authData)
                    alert('Debug: Auth failed. Check /debug-logs page for details.')
                    return
                  }
                  
                  debugLog('📅 ✅ Auth verified, navigating', {
                    targetType: selectedEvent.type,
                    targetId: selectedEvent.entityId
                  })
                  
                  if (selectedEvent.type === 'episode') {
                    const targetUrl = '/episodes/' + selectedEvent.entityId
                    debugLog('📅 Navigating to episode', { url: targetUrl })
                    router.push(targetUrl)
                  } else if (selectedEvent.type === 'campaign') {
                    const targetUrl = '/campaigns/' + selectedEvent.entityId
                    debugLog('📅 Navigating to campaign', { url: targetUrl })
                    router.push(targetUrl)
                  }
                } catch (error: any) {
                  debugLog('📅 🔴 Error during navigation', {
                    message: error.message,
                    stack: error.stack
                  })
                  alert('Error occurred. Check /debug-logs page for details.')
                }
              }}>
                View Details
              </Button>
            ) : (
              <Button 
                variant="contained" 
                onClick={handleCreateEvent}
                disabled={!newEvent.title || !newEvent.date || !newEvent.time}
              >
                Create Event
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}
