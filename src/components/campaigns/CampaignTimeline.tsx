import { useState, useEffect } from 'react'
import { 
  Box, 
  Typography, 
  Avatar, 
  Chip, 
  LinearProgress,
  Alert,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material'
import { 
  PlayCircle as PlayIcon,
  Pause as PauseIcon,
  Edit as EditIcon,
  AttachMoney as MoneyIcon,
  Campaign as CampaignIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Article as ContractIcon,
  Receipt as InvoiceIcon,
  Assignment as OrderIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Inventory as InventoryIcon,
  TrendingUp,
} from '@mui/icons-material'
import { formatCurrency } from '@/lib/utils'

interface TimelineEvent {
  id: string
  type: string
  title: string
  description: string
  timestamp: string
  dueDate?: string
  status: 'completed' | 'pending' | 'overdue' | 'upcoming'
  priority: 'low' | 'medium' | 'high' | 'critical'
  actor?: string
  actorId?: string
  assigneeId?: string
  assigneeName?: string
  metadata?: any
  source: string
}

interface TimelineResponse {
  events: TimelineEvent[]
  nextCursor: string | null
  hasMore: boolean
  totalEvents: number
}

interface CampaignTimelineProps {
  campaignId: string
}

export function CampaignTimeline({ campaignId }: CampaignTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const eventTypes = [
    'contract_execution',
    'ad_approval',
    'schedule_approval',
    'prelaunch_milestone',
    'campaign_launch',
    'performance_review',
    'campaign_end',
    'final_reporting',
    'milestone'
  ]

  const fetchTimeline = async (cursor?: string, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }
      
      const params = new URLSearchParams({
        limit: '20',
      })
      
      if (cursor) params.append('cursor', cursor)
      if (typeFilter.length > 0) params.append('types', typeFilter.join(','))
      if (dateFromFilter) params.append('from', dateFromFilter)
      if (dateToFilter) params.append('to', dateToFilter)
      
      const response = await fetch(`/api/campaigns/${campaignId}/timeline?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch timeline')
      }
      
      const data: TimelineResponse = await response.json()
      
      if (reset) {
        setEvents(data.events || [])
      } else {
        setEvents(prev => [...prev, ...(data.events || [])])
      }
      
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (err) {
      console.error('Error fetching timeline:', err)
      setError(err instanceof Error ? err.message : 'Failed to load timeline')
      if (reset) setEvents([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchTimeline(undefined, true)
  }, [campaignId, typeFilter, dateFromFilter, dateToFilter])

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchTimeline(nextCursor, false)
    }
  }

  const handleFilterReset = () => {
    setTypeFilter([])
    setDateFromFilter('')
    setDateToFilter('')
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'contract_execution':
        return <ContractIcon />
      case 'ad_approval':
        return <ApprovedIcon />
      case 'schedule_approval':
        return <ScheduleIcon />
      case 'prelaunch_milestone':
        return <PlayIcon />
      case 'campaign_launch':
        return <CampaignIcon />
      case 'performance_review':
        return <TrendingUp />
      case 'campaign_end':
        return <PauseIcon />
      case 'final_reporting':
        return <InvoiceIcon />
      default:
        return <OrderIcon />
    }
  }

  const getColor = (event: TimelineEvent): 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' => {
    // Color primarily based on status for project management view
    switch (event.status) {
      case 'completed':
        return 'success'
      case 'overdue':
        return 'error'
      case 'pending':
        return 'warning'
      case 'upcoming':
        // Use type-specific colors for upcoming items
        switch (event.type) {
          case 'campaign_launch':
          case 'prelaunch_milestone':
            return 'primary'
          case 'performance_review':
          case 'final_reporting':
            return 'info'
          default:
            return 'secondary'
        }
      default:
        return 'primary'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`
    } else if (diffDays === 0) {
      return 'Due today'
    } else if (diffDays === 1) {
      return 'Due tomorrow'
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`
    } else {
      return `Due ${date.toLocaleDateString()}`
    }
  }

  const getStatusChip = (status: TimelineEvent['status'], priority: TimelineEvent['priority']) => {
    let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
    let label: string
    
    switch (status) {
      case 'completed':
        color = 'success'
        label = 'Completed'
        break
      case 'overdue':
        color = 'error'
        label = 'Overdue'
        break
      case 'pending':
        color = 'warning'
        label = 'Pending'
        break
      case 'upcoming':
        color = 'info'
        label = 'Upcoming'
        break
      default:
        color = 'default'
        label = status
    }

    return (
      <Chip 
        label={label} 
        size="small" 
        color={color}
        sx={{ 
          fontSize: '0.7rem', 
          height: 20,
          fontWeight: priority === 'critical' ? 'bold' : 'normal'
        }}
      />
    )
  }

  const getPriorityChip = (priority: TimelineEvent['priority']) => {
    if (priority === 'low') return null // Don't show chip for low priority
    
    let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
    let label: string
    
    switch (priority) {
      case 'critical':
        color = 'error'
        label = 'Critical'
        break
      case 'high':
        color = 'warning'
        label = 'High'
        break
      case 'medium':
        color = 'info'
        label = 'Medium'
        break
      default:
        return null
    }

    return (
      <Chip 
        label={label} 
        size="small" 
        color={color}
        variant="outlined"
        sx={{ fontSize: '0.7rem', height: 20 }}
      />
    )
  }

  const renderMetadata = (event: TimelineEvent) => {
    if (!event.metadata) return null

    const chips = []
    
    if (event.metadata.amount) {
      chips.push(
        <Chip
          key="amount"
          label={formatCurrency(event.metadata.amount)}
          size="small"
          color="secondary"
        />
      )
    }
    
    if (event.metadata.invoiceNumber) {
      chips.push(
        <Chip
          key="invoice"
          label={event.metadata.invoiceNumber}
          size="small"
          variant="outlined"
        />
      )
    }
    
    if (event.metadata.contractNumber) {
      chips.push(
        <Chip
          key="contract"
          label={event.metadata.contractNumber}
          size="small"
          variant="outlined"
        />
      )
    }

    if (event.metadata.orderNumber) {
      chips.push(
        <Chip
          key="order"
          label={event.metadata.orderNumber}
          size="small"
          variant="outlined"
        />
      )
    }

    return chips.length > 0 ? (
      <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {chips}
      </Box>
    ) : null
  }

  if (loading) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>Timeline</Typography>
        <LinearProgress />
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Loading timeline events...
        </Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>Timeline</Typography>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => fetchTimeline(undefined, true)} variant="outlined">
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header with filters toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Timeline</Typography>
        <Button
          startIcon={showFilters ? <ExpandLessIcon /> : <FilterIcon />}
          onClick={() => setShowFilters(!showFilters)}
          variant="outlined"
          size="small"
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </Box>

      {/* Filters */}
      {showFilters && (
        <Card sx={{ mb: 3, p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Event Types</InputLabel>
                <Select
                  multiple
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(Array.isArray(e.target.value) ? e.target.value : [])}
                  label="Event Types"
                  renderValue={(selected) => `${selected.length} types selected`}
                >
                  {eventTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                label="From Date"
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                label="To Date"
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                onClick={handleFilterReset}
                variant="outlined"
                size="small"
                fullWidth
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Card>
      )}

      {/* Timeline events */}
      {events.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            No timeline events found for this campaign
          </Typography>
        </Card>
      ) : (
        <Box>
          {events.map((event, index) => (
            <Box
              key={event.id}
              sx={{
                display: 'flex',
                pb: 3,
                position: 'relative',
                '&:not(:last-child)::before': {
                  content: '""',
                  position: 'absolute',
                  left: 20,
                  top: 40,
                  bottom: 0,
                  width: 2,
                  bgcolor: 'divider',
                },
              }}
            >
              <Avatar
                sx={{
                  bgcolor: `${getColor(event)}.light`,
                  color: `${getColor(event)}.main`,
                  width: 40,
                  height: 40,
                  mr: 2,
                }}
              >
                {getIcon(event.type)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    {event.title}
                  </Typography>
                  {getStatusChip(event.status, event.priority)}
                  {getPriorityChip(event.priority)}
                  <Chip 
                    label={event.source} 
                    size="small" 
                    variant="outlined" 
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                </Box>
                
                {/* Due date display for project management */}
                {event.dueDate && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      mb: 0.5, 
                      fontWeight: event.status === 'overdue' ? 'bold' : 'normal',
                      color: event.status === 'overdue' ? 'error.main' : 'text.secondary'
                    }}
                  >
                    📅 {formatDueDate(event.dueDate)}
                  </Typography>
                )}
                
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                  {event.description}
                </Typography>
                
                {/* Assignee display */}
                {event.assigneeName && (
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <PersonIcon fontSize="small" />
                    Assigned to: {event.assigneeName}
                  </Typography>
                )}
                
                {/* Actor display for historical events */}
                {event.actor && !event.assigneeName && (
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <PersonIcon fontSize="small" />
                    By {event.actor}
                  </Typography>
                )}
                {renderMetadata(event)}
              </Box>
            </Box>
          ))}

          {/* Load more button */}
          {hasMore && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button 
                onClick={handleLoadMore} 
                disabled={loadingMore}
                variant="outlined"
              >
                {loadingMore ? 'Loading...' : 'Load More Events'}
              </Button>
            </Box>
          )}

          {loadingMore && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}