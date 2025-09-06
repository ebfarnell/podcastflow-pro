'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Button,
  Grid,
  Stack,
  Avatar,
  Tooltip,
  TextField,
  MenuItem,
  Badge,
  Divider
} from '@mui/material'
import {
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Flag as FlagIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  Add as AddIcon
} from '@mui/icons-material'
import { format, formatDistanceToNow, isPast } from 'date-fns'
import { useRouter } from 'next/navigation'
import { AdRequest } from '@/types/workflow'
import { useAuth } from '@/lib/auth/client'
import AdRequestDialog from './AdRequestDialog'

interface AdRequestListProps {
  orderId?: string
  showId?: string
  assignedToMe?: boolean
  onRequestUpdate?: () => void
}

export default function AdRequestList({ 
  orderId, 
  showId, 
  assignedToMe = false,
  onRequestUpdate 
}: AdRequestListProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [adRequests, setAdRequests] = useState<AdRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedRequest, setSelectedRequest] = useState<AdRequest | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0
  })

  useEffect(() => {
    fetchAdRequests()
  }, [statusFilter, orderId, showId, assignedToMe])

  const fetchAdRequests = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (orderId) params.append('orderId', orderId)
      if (showId) params.append('showId', showId)
      if (assignedToMe) params.append('assignedToMe', 'true')

      const response = await fetch(`/api/ad-requests?${params}`)
      if (!response.ok) throw new Error('Failed to fetch ad requests')
      
      const data = await response.json()
      setAdRequests(data.adRequests)
      setStats(data.stats)
    } catch (error) {
      console.error('Error fetching ad requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/ad-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) throw new Error('Failed to update status')
      
      fetchAdRequests()
      if (onRequestUpdate) onRequestUpdate()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleDelete = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this ad request?')) return

    try {
      const response = await fetch(`/api/ad-requests/${requestId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete')
      
      fetchAdRequests()
      if (onRequestUpdate) onRequestUpdate()
    } catch (error) {
      console.error('Error deleting:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error'
      case 'high': return 'warning'
      case 'medium': return 'info'
      case 'low': return 'default'
      default: return 'default'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'info'
      case 'pending': return 'warning'
      case 'cancelled': return 'default'
      default: return 'default'
    }
  }

  const canEdit = (request: AdRequest) => {
    return user?.role === 'admin' || 
           user?.role === 'master' || 
           request.assignedToId === user?.id
  }

  const canDelete = () => {
    return user?.role === 'admin' || user?.role === 'master'
  }

  if (loading) {
    return <Typography>Loading ad requests...</Typography>
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentIcon />
          Ad Requests
          <Chip label={stats.total} size="small" />
        </Typography>

        <Stack direction="row" spacing={2}>
          <TextField
            select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </TextField>

          {(user?.role === 'admin' || user?.role === 'sales') && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setSelectedRequest(null)
                setDialogOpen(true)
              }}
              size="small"
            >
              New Request
            </Button>
          )}
        </Stack>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Pending</Typography>
              <Typography variant="h6">{stats.pending}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">In Progress</Typography>
              <Typography variant="h6">{stats.inProgress}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Completed</Typography>
              <Typography variant="h6">{stats.completed}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Overdue</Typography>
              <Typography variant="h6" color="error">{stats.overdue}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Request List */}
      <Stack spacing={2}>
        {adRequests.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="body1" color="text.secondary" align="center">
                No ad requests found
              </Typography>
            </CardContent>
          </Card>
        ) : (
          adRequests.map((request) => {
            const isOverdue = request.dueDate && request.status !== 'completed' && isPast(new Date(request.dueDate))
            
            return (
              <Card key={request.id} variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {request.title}
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Chip 
                          label={request.status.replace('_', ' ')} 
                          color={getStatusColor(request.status) as any}
                          size="small" 
                        />
                        <Chip 
                          label={request.priority} 
                          color={getPriorityColor(request.priority) as any}
                          size="small"
                          icon={<FlagIcon />}
                        />
                        {isOverdue && (
                          <Chip 
                            label="Overdue" 
                            color="error" 
                            size="small" 
                          />
                        )}
                      </Stack>
                    </Box>

                    <Stack direction="row" spacing={1}>
                      {canEdit(request) && (
                        <IconButton 
                          size="small"
                          onClick={() => {
                            setSelectedRequest(request)
                            setDialogOpen(true)
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      )}
                      {canDelete() && (
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDelete(request.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Stack>
                  </Box>

                  {request.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {request.description}
                    </Typography>
                  )}

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Assigned to
                          </Typography>
                          <Typography variant="body2">
                            {request.assignedTo?.name || request.assignedTo?.email}
                            {' '}
                            <Chip 
                              label={request.assignedToRole} 
                              size="small" 
                              variant="outlined" 
                            />
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AssignmentIcon fontSize="small" color="action" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Show
                          </Typography>
                          <Typography variant="body2">
                            {request.show?.name}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon fontSize="small" color="action" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Due Date
                          </Typography>
                          <Typography variant="body2" color={isOverdue ? 'error' : 'text.primary'}>
                            {request.dueDate 
                              ? format(new Date(request.dueDate), 'MMM d, yyyy')
                              : 'No due date'
                            }
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Order: {request.order?.orderNumber || 'N/A'}
                      </Typography>
                      {request.order?.campaign && (
                        <>
                          <Typography variant="caption" color="text.secondary">•</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Campaign: {request.order.campaign.name}
                          </Typography>
                        </>
                      )}
                    </Box>

                    {canEdit(request) && request.status !== 'completed' && (
                      <Stack direction="row" spacing={1}>
                        {request.status === 'pending' && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleStatusChange(request.id, 'in_progress')}
                          >
                            Start Work
                          </Button>
                        )}
                        {request.status === 'in_progress' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleStatusChange(request.id, 'completed')}
                          >
                            Mark Complete
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Box>
                </CardContent>
              </Card>
            )
          })
        )}
      </Stack>

      {/* Dialog */}
      {dialogOpen && (
        <AdRequestDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false)
            setSelectedRequest(null)
          }}
          adRequest={selectedRequest}
          orderId={orderId}
          showId={showId}
          onSuccess={() => {
            fetchAdRequests()
            if (onRequestUpdate) onRequestUpdate()
          }}
        />
      )}
    </Box>
  )
}