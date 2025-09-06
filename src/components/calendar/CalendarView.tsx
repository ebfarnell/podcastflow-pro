'use client'

import { useState, useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Tooltip,
  Badge,
} from '@mui/material'
import {
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  Campaign,
  Event,
  Task,
  RadioButtonChecked,
  Schedule,
  CalendarToday,
} from '@mui/icons-material'
import moment from 'moment'
import { useRouter } from 'next/navigation'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: 'episode' | 'campaign' | 'deadline' | 'task'
  entityId?: string
  entityType?: string
  description?: string
  show?: string
  campaign?: string
  status?: string
  color?: string
}

interface CalendarViewProps {
  events: CalendarEvent[]
  currentDate: Date
  onDateChange: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
}

export function CalendarView({ events, currentDate, onDateChange, onEventClick }: CalendarViewProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayEventsDialog, setDayEventsDialog] = useState(false)

  // Get calendar grid data
  const calendarData = useMemo(() => {
    const start = moment(currentDate).startOf('month').startOf('week')
    const end = moment(currentDate).endOf('month').endOf('week')
    const days = []
    const current = start.clone()

    while (current.isSameOrBefore(end)) {
      days.push(current.clone().toDate())
      current.add(1, 'day')
    }

    return days
  }, [currentDate])

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: { [key: string]: CalendarEvent[] } = {}
    
    events.forEach(event => {
      const dateKey = moment(event.start).format('YYYY-MM-DD')
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(event)
    })

    return grouped
  }, [events])

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const dateKey = moment(date).format('YYYY-MM-DD')
    return eventsByDate[dateKey] || []
  }

  // Group events by type for a date
  const groupEventsByType = (events: CalendarEvent[]) => {
    const grouped: { [key: string]: CalendarEvent[] } = {}
    
    events.forEach(event => {
      if (!grouped[event.type]) {
        grouped[event.type] = []
      }
      grouped[event.type].push(event)
    })

    return grouped
  }

  const handleDateClick = (date: Date, events: CalendarEvent[]) => {
    if (events.length === 0) return
    
    setSelectedDate(date)
    setDayEventsDialog(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    if (onEventClick) {
      onEventClick(event)
    } else {
      // Default navigation behavior
      if (event.type === 'episode' && event.entityId) {
        router.push(`/episodes/${event.entityId}`)
      } else if (event.type === 'campaign' && event.entityId) {
        router.push(`/campaigns/${event.entityId}`)
      }
    }
    setDayEventsDialog(false)
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'episode': return <PlayCircle />
      case 'campaign': return <Campaign />
      case 'deadline': return <Schedule />
      case 'task': return <Task />
      default: return <Event />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'episode': return 'success'
      case 'campaign': return 'primary'
      case 'deadline': return 'error'
      case 'task': return 'secondary'
      default: return 'default'
    }
  }

  const getEventLabel = (type: string, count: number) => {
    const labels: { [key: string]: string } = {
      episode: 'Episode',
      campaign: 'Campaign',
      deadline: 'Deadline',
      task: 'Task'
    }
    const label = labels[type] || 'Event'
    return count > 1 ? `${count} ${label}s` : label
  }

  return (
    <>
      <Paper sx={{ p: 2 }}>
        {/* Calendar Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={() => {
              const newDate = moment(currentDate).subtract(1, 'month').toDate()
              onDateChange(newDate)
            }}>
              <ChevronLeft />
            </IconButton>
            <Typography variant="h6">
              {moment(currentDate).format('MMMM YYYY')}
            </Typography>
            <IconButton onClick={() => {
              const newDate = moment(currentDate).add(1, 'month').toDate()
              onDateChange(newDate)
            }}>
              <ChevronRight />
            </IconButton>
          </Box>
          <Button 
            variant="outlined" 
            startIcon={<CalendarToday />}
            onClick={() => onDateChange(new Date())}
          >
            Today
          </Button>
        </Box>

        {/* Days of Week Header */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, mb: 1 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <Box key={day} sx={{ p: 1, textAlign: 'center' }}>
              <Typography variant="body2" fontWeight="bold" color="text.secondary">
                {day}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Calendar Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
          {calendarData.map((date, index) => {
            const dayEvents = getEventsForDate(date)
            const groupedEvents = groupEventsByType(dayEvents)
            const isCurrentMonth = moment(date).isSame(currentDate, 'month')
            const isToday = moment(date).isSame(moment(), 'day')
            
            return (
              <Box
                key={index}
                sx={{
                  minHeight: 120,
                  border: '1px solid',
                  borderColor: isToday ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  p: 0.5,
                  bgcolor: isCurrentMonth ? 'background.paper' : 'action.hover',
                  cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                  '&:hover': dayEvents.length > 0 ? {
                    bgcolor: 'action.selected',
                  } : {}
                }}
                onClick={() => handleDateClick(date, dayEvents)}
              >
                {/* Date Number */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: isToday ? 'bold' : 'normal',
                      color: isToday ? 'primary.main' : isCurrentMonth ? 'text.primary' : 'text.secondary'
                    }}
                  >
                    {moment(date).format('D')}
                  </Typography>
                  {dayEvents.length > 3 && (
                    <Typography variant="caption" color="text.secondary">
                      +{dayEvents.length - 3}
                    </Typography>
                  )}
                </Box>

                {/* Event Chips */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  {Object.entries(groupedEvents).slice(0, 3).map(([type, typeEvents]) => (
                    <Tooltip 
                      key={type}
                      title={`${getEventLabel(type, typeEvents.length)} - Click to view`}
                      placement="top"
                    >
                      <Chip
                        size="small"
                        label={
                          typeEvents.length > 1 
                            ? `${typeEvents.length} ${type}s`
                            : typeEvents[0].title.length > 15
                              ? typeEvents[0].title.substring(0, 12) + '...'
                              : typeEvents[0].title
                        }
                        color={getEventColor(type) as any}
                        sx={{ 
                          height: 20,
                          fontSize: '0.7rem',
                          '& .MuiChip-label': {
                            px: 0.5,
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (typeEvents.length === 1) {
                            handleEventClick(typeEvents[0])
                          } else {
                            handleDateClick(date, dayEvents)
                          }
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            )
          })}
        </Box>
      </Paper>

      {/* Day Events Dialog */}
      <Dialog
        open={dayEventsDialog}
        onClose={() => setDayEventsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Events for {selectedDate && moment(selectedDate).format('MMMM D, YYYY')}
        </DialogTitle>
        <DialogContent dividers>
          {selectedDate && (
            <List>
              {getEventsForDate(selectedDate).map(event => (
                <ListItem
                  key={event.id}
                  button
                  onClick={() => handleEventClick(event)}
                  sx={{ borderRadius: 1, mb: 1, bgcolor: 'action.hover' }}
                >
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: event.color || 'primary.main' }}>
                      {getEventIcon(event.type)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={event.title}
                    secondary={
                      <>
                        <Typography variant="caption" component="span">
                          {moment(event.start).format('h:mm A')}
                        </Typography>
                        {event.description && (
                          <>
                            <br />
                            <Typography variant="caption" component="span">
                              {event.description}
                            </Typography>
                          </>
                        )}
                        {(event.show || event.campaign) && (
                          <>
                            <br />
                            <Chip 
                              label={event.show || event.campaign} 
                              size="small" 
                              sx={{ mt: 0.5, height: 18 }}
                            />
                          </>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDayEventsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}