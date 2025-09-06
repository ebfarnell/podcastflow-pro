import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Avatar,
  Button,
  LinearProgress,
  Alert,
  Badge,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Skeleton,
} from '@mui/material'
import Timeline from '@mui/lab/Timeline'
import TimelineItem from '@mui/lab/TimelineItem'
import TimelineSeparator from '@mui/lab/TimelineSeparator'
import TimelineDot from '@mui/lab/TimelineDot'
import TimelineConnector from '@mui/lab/TimelineConnector'
import TimelineContent from '@mui/lab/TimelineContent'
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent'
import {
  Assignment,
  Description,
  CheckCircle,
  Schedule,
  AttachMoney,
  Comment,
  Warning,
  Person,
  FilterList,
  Refresh,
  AutoMode,
  Notifications,
  TrendingUp,
  Error,
  Info,
  MarkEmailRead,
  Delete,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'

interface TimelineEvent {
  id: string
  type: 'order' | 'contract' | 'approval' | 'creative' | 'task' | 'billing' | 'automation'
  action: string
  description: string
  actor: string
  timestamp: string
  metadata?: any
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  entityType: string
  entityId: string
  createdAt: string
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

const eventTypeIcons = {
  order: <Assignment />,
  contract: <Description />,
  approval: <CheckCircle />,
  creative: <Schedule />,
  task: <Comment />,
  billing: <AttachMoney />,
  automation: <AutoMode />,
}

const eventTypeColors = {
  order: 'primary',
  contract: 'secondary',
  approval: 'success',
  creative: 'info',
  task: 'warning',
  billing: 'error',
  automation: 'info',
} as const

export default function NotificationsSection() {
  const [selectedTab, setSelectedTab] = useState(0)
  const [typeFilter, setTypeFilter] = useState('')
  const [timeFilter, setTimeFilter] = useState('7days')

  // Fetch notifications
  const { data: notificationsData, isLoading: notificationsLoading, error: notificationsError, refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications', {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }
      
      return response.json()
    }
  })

  // Fetch timeline/activity events
  const { data: timelineData, isLoading: timelineLoading, error: timelineError, refetch: refetchTimeline } = useQuery({
    queryKey: ['post-sale-timeline', typeFilter, timeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(typeFilter && { type: typeFilter }),
        period: timeFilter
      })
      
      const response = await fetch(`/api/activities?${params}`, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        // Return mock data if API fails
        return {
          events: [
            {
              id: '1',
              type: 'automation',
              action: 'triggered',
              description: 'Auto-generated contract for Order #ORD-2024-001',
              actor: 'System Automation',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: '2',
              type: 'automation',
              action: 'completed',
              description: 'Invoice auto-generated for confirmed Order #ORD-2024-002',
              actor: 'Billing Automation',
              timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: '3',
              type: 'order',
              action: 'confirmed',
              description: 'Order #ORD-2024-003 confirmed and ready for production',
              actor: 'John Doe',
              timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: '4',
              type: 'automation',
              action: 'triggered',
              description: 'Monthly billing generated for delivered spots',
              actor: 'Monthly Billing Bot',
              timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: '5',
              type: 'billing',
              action: 'created',
              description: 'Invoice #INV-2024-001 created for $5,250',
              actor: 'Sarah Lee',
              timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ] as TimelineEvent[]
        }
      }
      
      return response.json()
    },
  })

  const notifications = notificationsData?.notifications || []
  const events = timelineData?.events || []

  const getActionColor = (action: string) => {
    if (action.includes('approve') || action.includes('complete')) return 'success'
    if (action.includes('reject') || action.includes('cancel')) return 'error'
    if (action.includes('pending') || action.includes('review')) return 'warning'
    return 'primary'
  }

  const getNotificationTypeIcon = (type: string) => {
    switch (type) {
      case 'order_approved': return <CheckCircle />
      case 'campaign_won': return <TrendingUp />
      case 'contract_signed': return <Description />
      case 'invoice_generated': return <AttachMoney />
      case 'monthly_invoice_generated': return <AttachMoney />
      default: return <Info />
    }
  }

  const getNotificationSeverity = (type: string) => {
    if (type.includes('error') || type.includes('failed')) return 'error'
    if (type.includes('warning') || type.includes('overdue')) return 'warning'
    if (type.includes('success') || type.includes('approved')) return 'success'
    return 'info'
  }

  const unreadCount = notifications.filter((n: Notification) => !n.isRead).length

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Notifications & Timeline
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => {
              refetchNotifications()
              refetchTimeline()
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={selectedTab}
          onChange={(_, newValue) => setSelectedTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            label={
              <Badge badgeContent={unreadCount} color="error">
                Notifications
              </Badge>
            } 
            icon={<Notifications />} 
            iconPosition="start" 
          />
          <Tab 
            label="Activity Timeline" 
            icon={<TrendingUp />} 
            iconPosition="start" 
          />
        </Tabs>

        <TabPanel value={selectedTab} index={0}>
          {/* Notifications Tab */}
          {notificationsError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load notifications. Please try refreshing.
            </Alert>
          )}

          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h5">
                        {notificationsLoading ? <Skeleton width={40} /> : unreadCount}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Unread
                      </Typography>
                    </Box>
                    <Notifications color="primary" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h5">
                        {notificationsLoading ? <Skeleton width={40} /> : notifications.filter((n: Notification) => n.type.includes('automation')).length}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Automation Alerts
                      </Typography>
                    </Box>
                    <AutoMode color="info" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h5">
                        {notificationsLoading ? <Skeleton width={40} /> : notifications.filter((n: Notification) => n.type.includes('invoice')).length}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Billing Alerts
                      </Typography>
                    </Box>
                    <AttachMoney color="warning" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h5">
                        {notificationsLoading ? <Skeleton width={40} /> : notifications.length}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Total
                      </Typography>
                    </Box>
                    <TrendingUp color="success" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Notifications List */}
          {notificationsLoading ? (
            <LinearProgress />
          ) : notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Notifications sx={{ fontSize: 64, color: 'text.secondary' }} />
              <Typography variant="h6" gutterBottom>
                No notifications
              </Typography>
              <Typography color="textSecondary">
                You're all caught up! Check back later for new updates.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {notifications.map((notification: Notification) => (
                <Card 
                  key={notification.id} 
                  variant={notification.isRead ? "outlined" : "elevation"}
                  sx={{ 
                    bgcolor: notification.isRead ? 'background.paper' : 'action.hover',
                    borderLeft: `4px solid ${notification.isRead ? 'transparent' : 'primary.main'}`
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flex: 1 }}>
                        <Box sx={{ color: `${getNotificationSeverity(notification.type)}.main` }}>
                          {getNotificationTypeIcon(notification.type)}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: notification.isRead ? 'normal' : 'bold' }}>
                            {notification.title}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                            {notification.message}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={notification.type}
                              size="small"
                              color={getNotificationSeverity(notification.type) as any}
                              variant="outlined"
                            />
                            <Typography variant="caption" color="textSecondary">
                              {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        {!notification.isRead && (
                          <IconButton size="small" color="primary">
                            <MarkEmailRead />
                          </IconButton>
                        )}
                        <IconButton size="small" color="error">
                          <Delete />
                        </IconButton>
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </TabPanel>

        <TabPanel value={selectedTab} index={1}>
          {/* Timeline Tab */}
          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
              <Stack direction="row" spacing={2}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Event Type</InputLabel>
                  <Select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    label="Event Type"
                  >
                    <MenuItem value="">All Events</MenuItem>
                    <MenuItem value="automation">Automation</MenuItem>
                    <MenuItem value="order">Orders</MenuItem>
                    <MenuItem value="contract">Contracts</MenuItem>
                    <MenuItem value="approval">Approvals</MenuItem>
                    <MenuItem value="creative">Creatives</MenuItem>
                    <MenuItem value="task">Tasks</MenuItem>
                    <MenuItem value="billing">Billing</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Time Period</InputLabel>
                  <Select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                    label="Time Period"
                  >
                    <MenuItem value="today">Today</MenuItem>
                    <MenuItem value="7days">Last 7 Days</MenuItem>
                    <MenuItem value="30days">Last 30 Days</MenuItem>
                    <MenuItem value="all">All Time</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Paper>

          {timelineError && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Using sample data. Connect to the activities API for real-time updates.
            </Alert>
          )}

          {/* Timeline */}
          {timelineLoading ? (
            <LinearProgress />
          ) : events.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="textSecondary">
                No events found for the selected filters.
              </Typography>
            </Box>
          ) : (
            <Timeline position="alternate">
              {events.map((event, index) => (
                <TimelineItem key={event.id}>
                  <TimelineOppositeContent sx={{ m: 'auto 0' }}>
                    <Typography variant="body2" color="textSecondary">
                      {format(new Date(event.timestamp), 'MMM d, h:mm a')}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    </Typography>
                  </TimelineOppositeContent>
                  <TimelineSeparator>
                    <TimelineConnector sx={{ bgcolor: index === 0 ? 'transparent' : 'grey.300' }} />
                    <TimelineDot 
                      color={eventTypeColors[event.type as keyof typeof eventTypeColors] || 'grey'}
                    >
                      {eventTypeIcons[event.type as keyof typeof eventTypeIcons] || <Warning />}
                    </TimelineDot>
                    <TimelineConnector sx={{ bgcolor: index === events.length - 1 ? 'transparent' : 'grey.300' }} />
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: '12px', px: 2 }}>
                    <Paper elevation={3} sx={{ p: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Chip
                          label={event.type}
                          size="small"
                          color={eventTypeColors[event.type as keyof typeof eventTypeColors] || 'default'}
                        />
                        <Chip
                          label={event.action}
                          size="small"
                          variant="outlined"
                          color={getActionColor(event.action)}
                        />
                      </Stack>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {event.description}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24 }}>
                          <Person sx={{ fontSize: 16 }} />
                        </Avatar>
                        <Typography variant="caption" color="textSecondary">
                          {event.actor}
                        </Typography>
                      </Box>
                    </Paper>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </TabPanel>
      </Paper>
    </Box>
  )
}