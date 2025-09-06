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
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import {
  Palette as PaletteIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Flag as FlagIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Feedback as FeedbackIcon,
  AttachFile as AttachFileIcon,
  Add as AddIcon
} from '@mui/icons-material'
import { format, formatDistanceToNow, isPast } from 'date-fns'
import { useRouter } from 'next/navigation'
import { CreativeRequest } from '@/types/workflow'
import { useAuth } from '@/lib/auth/client'
import CreativeRequestDialog from './CreativeRequestDialog'
import CreativeAssetsDialog from './CreativeAssetsDialog'

interface CreativeRequestListProps {
  orderId?: string
  campaignId?: string
  assignedToMe?: boolean
  onRequestUpdate?: () => void
}

export default function CreativeRequestList({ 
  orderId, 
  campaignId, 
  assignedToMe = false,
  onRequestUpdate 
}: CreativeRequestListProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [creativeRequests, setCreativeRequests] = useState<CreativeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedRequest, setSelectedRequest] = useState<CreativeRequest | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [assetsDialogOpen, setAssetsDialogOpen] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    submitted: 0,
    approved: 0,
    revisionNeeded: 0,
    overdue: 0
  })

  useEffect(() => {
    fetchCreativeRequests()
  }, [statusFilter, orderId, campaignId, assignedToMe])

  const fetchCreativeRequests = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (orderId) params.append('orderId', orderId)
      if (campaignId) params.append('campaignId', campaignId)
      if (assignedToMe) params.append('assignedToMe', 'true')

      const response = await fetch(`/api/creative-requests?${params}`)
      if (!response.ok) throw new Error('Failed to fetch creative requests')
      
      const data = await response.json()
      setCreativeRequests(data.creativeRequests)
      setStats(data.stats)
    } catch (error) {
      console.error('Error fetching creative requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/creative-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) throw new Error('Failed to update status')
      
      fetchCreativeRequests()
      if (onRequestUpdate) onRequestUpdate()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleDelete = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this creative request?')) return

    try {
      const response = await fetch(`/api/creative-requests/${requestId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete')
      
      fetchCreativeRequests()
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
      case 'approved': return 'success'
      case 'submitted': return 'info'
      case 'in_progress': return 'info'
      case 'pending': return 'warning'
      case 'revision_needed': return 'error'
      default: return 'default'
    }
  }

  const canEdit = (request: CreativeRequest) => {
    return user?.role === 'admin' || 
           user?.role === 'master' || 
           request.assignedToId === user?.id
  }

  const canDelete = () => {
    return user?.role === 'admin' || user?.role === 'master'
  }

  const canApprove = () => {
    return user?.role === 'admin' || user?.role === 'master'
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'script': return <AttachFileIcon />
      case 'audio': return <AttachFileIcon />
      case 'video': return <AttachFileIcon />
      case 'artwork': return <PaletteIcon />
      case 'guidelines': return <AttachFileIcon />
      default: return <AttachFileIcon />
    }
  }

  if (loading) {
    return <Typography>Loading creative requests...</Typography>
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaletteIcon />
          Creative Requests
          <Chip label={stats.total} size="small" />
        </Typography>

        <Stack direction="row" spacing={2}>
          <TextField
            select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="submitted">Submitted</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="revision_needed">Revision Needed</MenuItem>
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
        <Grid item xs={4} sm={2}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Pending</Typography>
              <Typography variant="h6">{stats.pending}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={2}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">In Progress</Typography>
              <Typography variant="h6">{stats.inProgress}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={2}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Submitted</Typography>
              <Typography variant="h6">{stats.submitted}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={2}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Approved</Typography>
              <Typography variant="h6">{stats.approved}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={2}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Needs Revision</Typography>
              <Typography variant="h6">{stats.revisionNeeded}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} sm={2}>
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
        {creativeRequests.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="body1" color="text.secondary" align="center">
                No creative requests found
              </Typography>
            </CardContent>
          </Card>
        ) : (
          creativeRequests.map((request) => {
            const isOverdue = request.dueDate && 
              !['approved', 'submitted'].includes(request.status) && 
              isPast(new Date(request.dueDate))
            
            const submittedCount = request.submittedAssets?.length || 0
            const requiredCount = request.requiredAssets?.length || 0
            const progress = requiredCount > 0 ? (submittedCount / requiredCount) * 100 : 0
            
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

                  {/* Required Assets */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Required Assets ({submittedCount}/{requiredCount})
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={progress} 
                      sx={{ mb: 1, height: 8, borderRadius: 1 }}
                    />
                    <List dense>
                      {request.requiredAssets?.map((asset, index) => (
                        <ListItem key={index}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {getAssetIcon(asset.type)}
                          </ListItemIcon>
                          <ListItemText 
                            primary={asset.type}
                            secondary={asset.description}
                          />
                          {request.submittedAssets?.some(s => s.type === asset.type) && (
                            <CheckIcon color="success" fontSize="small" />
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </Box>

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
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PaletteIcon fontSize="small" color="action" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Campaign
                          </Typography>
                          <Typography variant="body2">
                            {request.campaign?.name}
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
                      {request.feedbackHistory && request.feedbackHistory.length > 0 && (
                        <>
                          <Typography variant="caption" color="text.secondary">•</Typography>
                          <Chip 
                            label={`${request.feedbackHistory.length} feedback`}
                            size="small"
                            icon={<FeedbackIcon />}
                            variant="outlined"
                          />
                        </>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AttachFileIcon />}
                        onClick={() => {
                          setSelectedRequest(request)
                          setAssetsDialogOpen(true)
                        }}
                      >
                        View Assets
                      </Button>

                      {canEdit(request) && request.status === 'pending' && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleStatusChange(request.id, 'in_progress')}
                        >
                          Start Work
                        </Button>
                      )}

                      {canEdit(request) && request.status === 'in_progress' && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<UploadIcon />}
                          onClick={() => {
                            setSelectedRequest(request)
                            setAssetsDialogOpen(true)
                          }}
                        >
                          Submit Assets
                        </Button>
                      )}

                      {canApprove() && request.status === 'submitted' && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleStatusChange(request.id, 'approved')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleStatusChange(request.id, 'revision_needed')}
                          >
                            Request Revision
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            )
          })
        )}
      </Stack>

      {/* Dialogs */}
      {dialogOpen && (
        <CreativeRequestDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false)
            setSelectedRequest(null)
          }}
          creativeRequest={selectedRequest}
          orderId={orderId}
          campaignId={campaignId}
          onSuccess={() => {
            fetchCreativeRequests()
            if (onRequestUpdate) onRequestUpdate()
          }}
        />
      )}

      {assetsDialogOpen && selectedRequest && (
        <CreativeAssetsDialog
          open={assetsDialogOpen}
          onClose={() => {
            setAssetsDialogOpen(false)
            setSelectedRequest(null)
          }}
          creativeRequest={selectedRequest}
          onUpdate={() => {
            fetchCreativeRequests()
            if (onRequestUpdate) onRequestUpdate()
          }}
        />
      )}
    </Box>
  )
}