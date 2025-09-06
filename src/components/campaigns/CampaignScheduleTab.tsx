'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  CalendarMonth as CalendarIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'

interface Schedule {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
  totalSpots: number
  totalImpressions: number
  netAmount?: number
  totalValue?: number
  itemCount: number
  showCount: number
  createdAt: string
  updatedAt: string
}

interface CampaignScheduleTabProps {
  campaignId: string
  campaign: any
}

export function CampaignScheduleTab({ campaignId, campaign }: CampaignScheduleTabProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSchedules()
  }, [campaignId])

  const fetchSchedules = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/schedules?campaignId=${campaignId}`)
      const data = await response.json()
      
      // Handle both successful responses and error responses gracefully
      if (response.ok) {
        // API now always returns schedules array, even if empty
        setSchedules(data.schedules || [])
        // Don't show error for empty results - that's a valid state
        if (data.message && data.schedules.length === 0) {
          // Message like "No schedules found for this campaign" is informational, not an error
          console.log(data.message)
        }
      } else if (response.status === 401 || response.status === 403) {
        // Authentication/authorization errors
        setError('You do not have permission to view schedules')
      } else {
        // Other errors - use the error message from the API if available
        setError(data.error || 'Unable to load schedules at this time')
      }
    } catch (err) {
      console.error('Error fetching schedules:', err)
      // Network or parsing errors
      setError('Unable to connect to the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSchedule = () => {
    // Navigate to Schedule Builder with campaign context
    // Ensure advertiserId is present and not undefined
    const advertiserId = campaign.advertiserId || campaign.advertiser?.id
    if (!advertiserId) {
      console.warn('Campaign missing advertiserId:', campaign)
    }
    
    // Build URL with only valid parameters
    let url = `/schedule-builder?campaignId=${campaignId}&campaignName=${encodeURIComponent(campaign.name)}`
    if (advertiserId && advertiserId !== 'undefined' && advertiserId !== 'null') {
      url += `&advertiserId=${advertiserId}`
    }
    if (campaign.budget) {
      url += `&budget=${campaign.budget}`
    }
    
    router.push(url)
  }

  const handleViewSchedule = (scheduleId: string) => {
    // Navigate to Schedule Builder with existing schedule
    router.push(`/schedule-builder?scheduleId=${scheduleId}&campaignId=${campaignId}`)
  }

  const handleExportSchedule = async (scheduleId: string, format: 'pdf' | 'xlsx') => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/export?format=${format}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `schedule-${campaign.name}-${format === 'pdf' ? 'proposal' : 'details'}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success(`Schedule exported as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export schedule')
    }
  }

  const handleDeleteSchedule = async (scheduleId: string, scheduleName: string) => {
    if (!confirm(`Are you sure you want to delete the schedule "${scheduleName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete schedule')
      }

      toast.success('Schedule deleted successfully')
      
      // Refresh the schedules list
      fetchSchedules()
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete schedule')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'active':
        return 'success'
      case 'pending_approval':
        return 'warning'
      case 'completed':
        return 'default'
      default:
        return 'info'
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    )
  }

  // Get the most recent schedule
  const currentSchedule = schedules.length > 0 ? schedules[0] : null

  return (
    <Box>
      {/* Header Section */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Campaign Schedule Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {schedules.length > 0 
              ? `${schedules.length} schedule${schedules.length !== 1 ? 's' : ''} created for this campaign`
              : 'Create and manage advertising schedules across multiple shows'}
          </Typography>
        </Box>
        <Box>
          <Button
            variant="contained"
            startIcon={currentSchedule ? <EditIcon /> : <AddIcon />}
            onClick={currentSchedule ? () => handleViewSchedule(currentSchedule.id) : handleCreateSchedule}
            size="large"
          >
            {currentSchedule ? 'Edit Schedule' : 'Create Schedule'}
          </Button>
        </Box>
      </Box>

      {/* Current Schedule Summary */}
      {currentSchedule && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <CalendarIcon color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Schedule Period
                  </Typography>
                </Box>
                <Typography variant="h6">
                  {format(new Date(currentSchedule.startDate), 'MMM d')} - {format(new Date(currentSchedule.endDate), 'MMM d, yyyy')}
                </Typography>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <Typography variant="body2" color="text.secondary">
                    {Math.ceil((new Date(currentSchedule.endDate).getTime() - new Date(currentSchedule.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <ScheduleIcon color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Spots
                  </Typography>
                </Box>
                <Typography variant="h6">
                  {currentSchedule.totalSpots || currentSchedule.itemCount}
                </Typography>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <Typography variant="body2" color="text.secondary">
                    Across {currentSchedule.showCount} shows
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <ViewIcon color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Est. Impressions
                  </Typography>
                </Box>
                <Typography variant="h6">
                  {currentSchedule.totalImpressions > 0 
                    ? (currentSchedule.totalImpressions / 1000).toFixed(0) + 'K'
                    : 'N/A'}
                </Typography>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <Typography variant="body2" color="text.secondary">
                    Per spot avg: {currentSchedule.totalImpressions > 0 && currentSchedule.itemCount > 0
                      ? Math.round(currentSchedule.totalImpressions / currentSchedule.itemCount).toLocaleString('en-US')
                      : 'N/A'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <MoneyIcon color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Schedule Value
                  </Typography>
                </Box>
                <Typography variant="h6">
                  ${Number(currentSchedule.totalValue || currentSchedule.netAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Typography>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <Chip 
                    label={currentSchedule.status.replace('_', ' ')} 
                    size="small"
                    color={getStatusColor(currentSchedule.status)}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Schedule History */}
      {schedules.length > 0 ? (
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Schedule History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {schedules.length} schedule{schedules.length !== 1 ? 's' : ''} created
            </Typography>
          </Box>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Schedule Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell align="center">Spots</TableCell>
                  <TableCell align="center">Shows</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedules.map((schedule, index) => (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {schedule.name}
                        {index === 0 && (
                          <Chip label="Current" size="small" color="primary" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={schedule.status.replace('_', ' ')} 
                        size="small"
                        color={getStatusColor(schedule.status)}
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(schedule.startDate), 'MMM d')} - {format(new Date(schedule.endDate), 'MMM d')}
                    </TableCell>
                    <TableCell align="center">{schedule.itemCount}</TableCell>
                    <TableCell align="center">{schedule.showCount}</TableCell>
                    <TableCell align="right">
                      ${Number(schedule.totalValue || schedule.netAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(schedule.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <Tooltip title="View/Edit Schedule">
                          <IconButton
                            size="small"
                            onClick={() => handleViewSchedule(schedule.id)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Export PDF">
                          <IconButton
                            size="small"
                            onClick={() => handleExportSchedule(schedule.id, 'pdf')}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Schedule">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteSchedule(schedule.id, schedule.name)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CalendarIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Schedule Created Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Create your first schedule to start booking ad placements across podcast shows
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateSchedule}
              size="large"
            >
              Create Schedule
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Features Info */}
      <Box mt={3}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={2}>
              <CheckCircleIcon color="success" />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Multi-Show Support
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Build schedules across multiple shows with different configurations
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={2}>
              <CheckCircleIcon color="success" />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Real-Time Inventory
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Check availability and pricing in real-time while building
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={2}>
              <CheckCircleIcon color="success" />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Export & Share
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Export schedules as PDF proposals or Excel spreadsheets
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}