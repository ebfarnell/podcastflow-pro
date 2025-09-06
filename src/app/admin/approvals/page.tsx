'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Alert,
  Snackbar,
  Badge,
  Tab,
  Tabs,
  TextField
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Visibility,
  AttachMoney,
  CalendarToday,
  TrendingUp,
  Warning,
  Info,
  Schedule,
  Campaign as CampaignIcon,
  Assignment,
  Business,
  Person,
  Check,
  Close,
  Store,
  Delete as DeleteIcon
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { AdminOnly } from '@/components/auth/RoleGuard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import axios from 'axios'

interface PendingApproval {
  id: string
  type: 'campaign' | 'reservation' | 'deletion'
  campaignId?: string
  campaignName: string
  advertiserName: string
  agencyName?: string
  status: string
  probability: number
  budget: number
  startDate: string
  endDate: string
  createdBy: string
  createdAt: string
  
  // Approval specific fields
  rateCardRate: number
  negotiatedRate: number
  rateAchievement: number // percentage of rate card achieved
  totalSpots: number
  totalImpressions: number
  cpm: number
  
  // Inventory details
  shows: {
    id: string
    name: string
    spots: number
    rate: number
    dates: string[]
  }[]
  
  // For deletion requests
  deletionRequest?: DeletionRequest
}

interface DeletionRequest {
  id: string
  entityType: string
  entityId: string
  entityName: string
  entityValue?: number
  requestedBy: string
  requester: {
    id: string
    name: string
    email: string
    role: string
  }
  requestedAt: string
  reviewedBy?: string
  reviewer?: {
    id: string
    name: string
    email: string
    role: string
  }
  reviewedAt?: string
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  reason?: string
  reviewNotes?: string
}

export default function AdminApprovalsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(true) 
  const [activeTab, setActiveTab] = useState(0)
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [allPendingData, setAllPendingData] = useState<PendingApproval[]>([]) // Store all data for badge counts
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null)
  const [detailsDialog, setDetailsDialog] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })
  
  // Deletion requests state
  const [deletionPage, setDeletionPage] = useState(0)
  const [deletionRowsPerPage, setDeletionRowsPerPage] = useState(10)
  const [deletionTabValue, setDeletionTabValue] = useState(0)
  const [reviewDialog, setReviewDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewAction, setReviewAction] = useState<'approve' | 'deny'>('approve')

  useEffect(() => {
    fetchPendingApprovals()
  }, [activeTab])

  // Reset activeTab if non-admin user somehow gets to deletion requests tab
  useEffect(() => {
    if (activeTab === 3 && user?.role !== 'admin') {
      setActiveTab(0) // Reset to first tab
    }
  }, [activeTab, user?.role])

  // Fetch deletion requests with proper cache invalidation
  const { data: deletionRequests = [], isLoading: deletionLoading, refetch: refetchDeletions } = useQuery({
    queryKey: ['deletion-requests', deletionTabValue],
    queryFn: async () => {
      const status = deletionTabValue === 0 ? 'pending' : deletionTabValue === 1 ? 'approved' : 'denied'
      const response = await axios.get(`/api/deletion-requests?status=${status}`)
      return response.data
    },
    // Refetch when the page becomes visible to ensure fresh data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Always refetch to ensure latest data
    enabled: activeTab === 3 && user?.role === 'admin', // Only fetch when on deletion requests tab and user is admin
  })

  // Always fetch pending deletion requests count for the badge
  const { data: pendingDeletionCount = 0 } = useQuery({
    queryKey: ['deletion-requests-count', 'pending'],
    queryFn: async () => {
      const response = await axios.get('/api/deletion-requests?status=pending&countOnly=true')
      return response.data.count || 0
    },
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: user?.role === 'admin', // Only fetch for admin users
  })

  // Deletion request review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes: string }) => {
      const response = await axios.put(`/api/deletion-requests/${id}`, {
        status,
        reviewNotes,
      })
      return response.data
    },
    onSuccess: (data, variables) => {
      // Store current scroll position
      const scrollY = window.scrollY
      
      // Immediately remove the item from pendingApprovals
      setPendingApprovals(prev => prev.filter(item => 
        !(item.type === 'deletion' && item.deletionRequest?.id === variables.id)
      ))
      
      // Also update allPendingData
      setAllPendingData(prev => prev.filter(item => 
        !(item.type === 'deletion' && item.deletionRequest?.id === variables.id)
      ))
      
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] })
      queryClient.invalidateQueries({ queryKey: ['deletion-requests-count'] })
      // Invalidate the relevant entity lists to reflect the changes
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['post-sale-orders'] })
      queryClient.invalidateQueries({ queryKey: ['post-sale-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['pre-sale-dashboard'] })
      setReviewDialog(false)
      setSelectedRequest(null)
      setReviewNotes('')
      setSnackbar({ open: true, message: 'Deletion request reviewed successfully', severity: 'success' })
      
      // Restore scroll position after state update
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
      })
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: `Failed to review deletion request: ${error.response?.data?.error || error.message}`, severity: 'error' })
    },
  })

  const fetchPendingApprovals = async () => {
    setLoading(true)
    try {
      // Always fetch all data for badge counts
      const allResponse = await fetch('/api/admin/approvals?type=all')
      if (!allResponse.ok) throw new Error('Failed to fetch all approvals')
      const allData = await allResponse.json()
      setAllPendingData(Array.isArray(allData) ? allData : [])
      
      // For "All Pending" tab, also fetch deletion requests
      let combinedData = allData
      if (activeTab === 0 && user?.role === 'admin') {
        try {
          const deletionResponse = await fetch('/api/deletion-requests?status=pending')
          if (deletionResponse.ok) {
            const deletionData = await deletionResponse.json()
            // Transform deletion requests to match approval structure
            const transformedDeletions = deletionData.map((dr: DeletionRequest) => ({
              id: dr.id,
              type: 'deletion' as const,
              campaignName: dr.entityName,
              advertiserName: `Delete ${dr.entityType}`,
              agencyName: '',
              status: dr.status,
              probability: 0,
              budget: dr.entityValue || 0,
              startDate: dr.requestedAt,
              endDate: dr.requestedAt,
              createdBy: dr.requester?.name || 'Unknown',
              createdAt: dr.requestedAt,
              rateAchievement: 0,
              totalSpots: 0,
              totalImpressions: 0,
              cpm: 0,
              rateCardRate: 0,
              negotiatedRate: 0,
              shows: [],
              deletionRequest: dr // Keep original for actions
            }))
            combinedData = [...allData, ...transformedDeletions]
          }
        } catch (error) {
          console.error('Error fetching deletion requests:', error)
        }
      }
      
      // Filter data based on active tab
      let filteredData = combinedData
      if (activeTab === 1) {
        filteredData = allData.filter((item: any) => item.type === 'campaign')
      } else if (activeTab === 2) {
        filteredData = allData.filter((item: any) => item.type === 'reservation')
      } else if (activeTab === 3) {
        // Deletion requests are handled separately
        filteredData = []
      }
      
      setPendingApprovals(Array.isArray(filteredData) ? filteredData : [])
    } catch (error) {
      console.error('Error fetching approvals:', error)
      setPendingApprovals([]) // Reset to empty array on error
      setAllPendingData([])
      setSnackbar({ open: true, message: 'Failed to load pending approvals', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (approval: PendingApproval) => {
    try {
      // Store current scroll position
      const scrollY = window.scrollY
      
      const endpoint = approval.type === 'reservation' 
        ? `/api/reservations/${approval.id}/confirm`
        : `/api/campaigns/${approval.campaignId}/approve`
      
      const response = await fetch(endpoint, { method: 'POST' })
      if (!response.ok) throw new Error('Failed to approve')
      
      // Immediately remove the approved item from both states
      setPendingApprovals(prev => prev.filter(item => item.id !== approval.id))
      setAllPendingData(prev => prev.filter(item => item.id !== approval.id))
      
      setSnackbar({ open: true, message: `${approval.type === 'reservation' ? 'Reservation' : 'Campaign'} approved successfully`, severity: 'success' })
      setDetailsDialog(false)
      
      // Restore scroll position
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
      })
    } catch (error) {
      console.error('Error approving:', error)
      setSnackbar({ open: true, message: 'Failed to approve', severity: 'error' })
    }
  }

  const handleReject = async (approval: PendingApproval, reason?: string) => {
    try {
      // Store current scroll position
      const scrollY = window.scrollY
      
      const endpoint = approval.type === 'reservation' 
        ? `/api/reservations/${approval.id}/reject`
        : `/api/campaigns/${approval.campaignId}/reject`
      
      console.log('[REJECT] Starting rejection for:', {
        type: approval.type,
        id: approval.type === 'reservation' ? approval.id : approval.campaignId,
        endpoint,
        reason
      })
      
      const response = await fetch(endpoint, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      
      // Enhanced error handling with response details
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Failed to reject'
        let errorDetails = ''
        
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorMessage
          errorDetails = errorJson.details || ''
          
          // Log detailed error for debugging
          console.error('[REJECT] Error response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            error: errorJson
          })
        } catch (parseError) {
          console.error('[REJECT] Non-JSON error response:', errorText)
          errorDetails = errorText
        }
        
        // Provide specific error messages based on status code
        if (response.status === 401) {
          setSnackbar({ 
            open: true, 
            message: 'Unauthorized: Please log in again', 
            severity: 'error' 
          })
        } else if (response.status === 403) {
          setSnackbar({ 
            open: true, 
            message: 'Permission denied: You do not have permission to reject campaigns', 
            severity: 'error' 
          })
        } else if (response.status === 404) {
          setSnackbar({ 
            open: true, 
            message: 'Campaign not found', 
            severity: 'error' 
          })
        } else {
          setSnackbar({ 
            open: true, 
            message: errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage, 
            severity: 'error' 
          })
        }
        
        throw new Error(`${errorMessage} (${response.status})`)
      }
      
      // Parse successful response
      const result = await response.json()
      console.log('[REJECT] Success response:', result)
      
      // Immediately remove the rejected item from both states
      setPendingApprovals(prev => prev.filter(item => item.id !== approval.id))
      setAllPendingData(prev => prev.filter(item => item.id !== approval.id))
      
      // Show detailed success message with workflow actions
      let successMessage = `${approval.type === 'reservation' ? 'Reservation' : 'Campaign'} rejected successfully`
      if (result.workflowActions && result.workflowActions.length > 0) {
        successMessage += ` (${result.workflowActions.join(', ')})`
      }
      
      setSnackbar({ 
        open: true, 
        message: successMessage, 
        severity: 'success' 
      })
      
      // Close dialog
      setDetailsDialog(false)
      
      // Restore scroll position
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
      })
      
    } catch (error) {
      console.error('[REJECT] Error during rejection:', error)
      // Error already handled above with specific messages
    }
  }

  // Deletion request handlers
  const handleReview = (request: DeletionRequest, action: 'approve' | 'deny') => {
    setSelectedRequest(request)
    setReviewAction(action)
    setReviewDialog(true)
  }

  const submitReview = () => {
    if (selectedRequest) {
      reviewMutation.mutate({
        id: selectedRequest.id,
        status: reviewAction === 'approve' ? 'approved' : 'denied',
        reviewNotes,
      })
    }
  }

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'advertiser':
        return <Store fontSize="small" />
      case 'agency':
        return <Business fontSize="small" />
      case 'campaign':
        return <CampaignIcon fontSize="small" />
      default:
        return <Store fontSize="small" />
    }
  }

  const getDeletionStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning'
      case 'approved':
        return 'success'
      case 'denied':
        return 'error'
      case 'cancelled':
        return 'default'
      default:
        return 'default'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning'
      case 'proposal': return 'info'
      case 'approved': return 'success'
      case 'rejected': return 'error'
      default: return 'default'
    }
  }

  const getRateAchievementColor = (percentage: number) => {
    if (percentage >= 95) return 'success.main'
    if (percentage >= 80) return 'warning.main'
    return 'error.main'
  }

  const renderSummaryCards = () => {
    // Use the appropriate data based on active tab
    const displayData = activeTab === 0 ? pendingApprovals : 
                       activeTab === 1 ? pendingApprovals.filter(a => a.type === 'campaign') :
                       activeTab === 2 ? pendingApprovals.filter(a => a.type === 'reservation') :
                       []
    
    const totalPending = displayData.length
    const totalValue = displayData.reduce((sum, a) => sum + (a.budget || 0), 0)
    const avgRateAchievement = displayData.filter(a => a.type !== 'deletion').length > 0
      ? displayData.filter(a => a.type !== 'deletion').reduce((sum, a) => sum + (a.rateAchievement || 0), 0) / displayData.filter(a => a.type !== 'deletion').length
      : 0

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Pending Approvals
              </Typography>
              <Typography variant="h4">
                {totalPending}
              </Typography>
              <Chip
                label="Awaiting review"
                size="small"
                sx={{ 
                  mt: 1,
                  bgcolor: 'warning.main',
                  color: 'warning.contrastText',
                  fontWeight: 500,
                }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Value
              </Typography>
              <Typography variant="h4">
                {formatCurrency(totalValue)}
              </Typography>
              <Chip
                label="Potential revenue"
                size="small"
                sx={{ 
                  mt: 1,
                  bgcolor: 'success.main',
                  color: 'success.contrastText',
                  fontWeight: 500,
                }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg Rate Achievement
              </Typography>
              <Typography variant="h4" color={getRateAchievementColor(avgRateAchievement)}>
                {avgRateAchievement.toFixed(1)}%
              </Typography>
              <Chip
                label="Of rate card"
                size="small"
                sx={{ 
                  mt: 1,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontWeight: 500,
                }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Urgent Items
              </Typography>
              <Typography variant="h4" color="error.main">
                {displayData.filter(a => {
                  if (a.type === 'deletion') return false // Deletion requests don't have start dates
                  const startDate = new Date(a.startDate)
                  const daysUntilStart = Math.ceil((startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  return daysUntilStart <= 7
                }).length}
              </Typography>
              <Chip
                label="Starting within 7 days"
                size="small"
                sx={{ 
                  mt: 1,
                  bgcolor: 'error.main',
                  color: 'error.contrastText',
                  fontWeight: 500,
                }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  const renderApprovalDetails = () => {
    if (!selectedApproval) return null

    const daysUntilStart = Math.ceil((new Date(selectedApproval.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    const flightDuration = Math.ceil((new Date(selectedApproval.endDate).getTime() - new Date(selectedApproval.startDate).getTime()) / (1000 * 60 * 60 * 24))

    return (
      <Dialog 
        open={detailsDialog} 
        onClose={() => setDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Approval Details</Typography>
            {daysUntilStart <= 7 && (
              <Chip 
                icon={<Warning />} 
                label={`Starts in ${daysUntilStart} days`} 
                color="error" 
                size="small"
              />
            )}
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Campaign Info */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                <CampaignIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Campaign Information
              </Typography>
              <Box sx={{ pl: 4 }}>
                <Typography><strong>Campaign:</strong> {selectedApproval.campaignName}</Typography>
                <Typography><strong>Advertiser:</strong> {selectedApproval.advertiserName}</Typography>
                {selectedApproval.agencyName && (
                  <Typography><strong>Agency:</strong> {selectedApproval.agencyName}</Typography>
                )}
                <Typography><strong>Created by:</strong> {selectedApproval.createdBy}</Typography>
                <Typography><strong>Probability:</strong> {selectedApproval.probability}%</Typography>
              </Box>
            </Grid>

            <Divider sx={{ width: '100%', my: 2 }} />

            {/* Flight Dates */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                <CalendarToday sx={{ mr: 1, verticalAlign: 'middle' }} />
                Flight Dates
              </Typography>
              <Box sx={{ pl: 4 }}>
                <Typography><strong>Start:</strong> {formatDate(selectedApproval.startDate)}</Typography>
                <Typography><strong>End:</strong> {formatDate(selectedApproval.endDate)}</Typography>
                <Typography><strong>Duration:</strong> {flightDuration} days</Typography>
                <Chip 
                  label={daysUntilStart > 0 ? `Starts in ${daysUntilStart} days` : 'Already started'}
                  color={daysUntilStart <= 7 ? 'error' : 'default'}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </Box>
            </Grid>

            {/* Financial Details */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                Financial Details
              </Typography>
              <Box sx={{ pl: 4 }}>
                <Typography><strong>Budget:</strong> {formatCurrency(selectedApproval.budget)}</Typography>
                <Typography><strong>Rate Card:</strong> {formatCurrency(selectedApproval.rateCardRate)}/spot</Typography>
                <Typography><strong>Negotiated:</strong> {formatCurrency(selectedApproval.negotiatedRate)}/spot</Typography>
                <Typography color={getRateAchievementColor(selectedApproval.rateAchievement)}>
                  <strong>Rate Achievement:</strong> {selectedApproval.rateAchievement}% of rate card
                </Typography>
              </Box>
            </Grid>

            <Divider sx={{ width: '100%', my: 2 }} />

            {/* Performance Metrics */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                Performance Projections
              </Typography>
              <Box sx={{ pl: 4 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Total Spots</Typography>
                    <Typography variant="h6">{selectedApproval.totalSpots}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Est. Impressions</Typography>
                    <Typography variant="h6">{selectedApproval.totalImpressions.toLocaleString()}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">CPM</Typography>
                    <Typography variant="h6">{formatCurrency(selectedApproval.cpm)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Cost per Spot</Typography>
                    <Typography variant="h6">{formatCurrency(selectedApproval.budget / selectedApproval.totalSpots)}</Typography>
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            {/* Show Breakdown */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                <Assignment sx={{ mr: 1, verticalAlign: 'middle' }} />
                Show Breakdown
              </Typography>
              {selectedApproval.shows && selectedApproval.shows.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Show</TableCell>
                        <TableCell align="center">Spots</TableCell>
                        <TableCell align="right">Rate/Spot</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell>Dates</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedApproval.shows.map((show) => (
                        <TableRow key={show.id}>
                          <TableCell>{show.name}</TableCell>
                          <TableCell align="center">{show.spots}</TableCell>
                          <TableCell align="right">{formatCurrency(show.rate)}</TableCell>
                          <TableCell align="right">{formatCurrency(show.spots * show.rate)}</TableCell>
                          <TableCell>
                            <Chip 
                              label={`${show.dates.length} episodes`}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Allocation not available - No show distribution has been set for this campaign yet.
                  </Typography>
                </Alert>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleReject(selectedApproval)}
            color="error"
            startIcon={<Cancel />}
          >
            Reject
          </Button>
          <Button 
            onClick={() => handleApprove(selectedApproval)}
            color="success"
            variant="contained"
            startIcon={<CheckCircle />}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  if (loading) return <DashboardLayout><LinearProgress /></DashboardLayout>

  return (
    <AdminOnly>
      <DashboardLayout>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Pending Approvals
          </Typography>
          <Typography variant="subtitle1" color="textSecondary" sx={{ mb: 3 }}>
            Review and approve campaigns and reservations
          </Typography>

          {renderSummaryCards()}

          <Paper sx={{ mb: 3, overflow: 'visible' }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, v) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                overflow: 'visible',
                '& .MuiTabs-root': {
                  overflow: 'visible',
                },
                '& .MuiTabs-scroller': {
                  overflow: 'visible',
                },
                '& .MuiTabs-flexContainer': {
                  overflow: 'visible',
                },
                '& .MuiTab-root': {
                  overflow: 'visible',
                  minWidth: { xs: 'auto', sm: 140 },
                  paddingRight: 3,
                  position: 'relative',
                },
                '& .MuiTabs-indicator': {
                  zIndex: 0,
                }
              }}
            >
              <Tab 
                label={
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    position: 'relative',
                    pr: (allPendingData.filter(a => a.type !== 'deletion').length + pendingDeletionCount) > 0 ? 2.5 : 0,
                    minHeight: 32
                  }}>
                    All Pending
                    {(allPendingData.filter(a => a.type !== 'deletion').length + pendingDeletionCount) > 0 && (
                      <Badge 
                        badgeContent={allPendingData.filter(a => a.type !== 'deletion').length + pendingDeletionCount} 
                        color="error"
                        sx={{
                          ml: 1,
                          '& .MuiBadge-badge': {
                            position: 'relative',
                            transform: 'none',
                            fontSize: '0.75rem',
                            height: 18,
                            minWidth: 18,
                            right: 'auto',
                            top: 'auto',
                          }
                        }}
                      >
                        <Box sx={{ width: 0, height: 0 }} />
                      </Badge>
                    )}
                  </Box>
                } 
              />
              <Tab 
                label={
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    position: 'relative',
                    pr: allPendingData.filter(a => a.type === 'campaign').length > 0 ? 2.5 : 0,
                    minHeight: 32
                  }}>
                    Campaigns
                    {allPendingData.filter(a => a.type === 'campaign').length > 0 && (
                      <Badge 
                        badgeContent={allPendingData.filter(a => a.type === 'campaign').length} 
                        color="warning"
                        sx={{
                          ml: 1,
                          '& .MuiBadge-badge': {
                            position: 'relative',
                            transform: 'none',
                            fontSize: '0.75rem',
                            height: 18,
                            minWidth: 18,
                            right: 'auto',
                            top: 'auto',
                          }
                        }}
                      >
                        <Box sx={{ width: 0, height: 0 }} />
                      </Badge>
                    )}
                  </Box>
                } 
              />
              <Tab 
                label={
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    position: 'relative',
                    pr: allPendingData.filter(a => a.type === 'reservation').length > 0 ? 2.5 : 0,
                    minHeight: 32
                  }}>
                    Reservations
                    {allPendingData.filter(a => a.type === 'reservation').length > 0 && (
                      <Badge 
                        badgeContent={allPendingData.filter(a => a.type === 'reservation').length} 
                        color="info"
                        sx={{
                          ml: 1,
                          '& .MuiBadge-badge': {
                            position: 'relative',
                            transform: 'none',
                            fontSize: '0.75rem',
                            height: 18,
                            minWidth: 18,
                            right: 'auto',
                            top: 'auto',
                          }
                        }}
                      >
                        <Box sx={{ width: 0, height: 0 }} />
                      </Badge>
                    )}
                  </Box>
                } 
              />
              {user?.role === 'admin' && (
                <Tab 
                  label={
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      position: 'relative',
                      pr: pendingDeletionCount > 0 ? 2.5 : 0,
                      minHeight: 32
                    }}>
                      <DeleteIcon fontSize="small" />
                      <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                        Deletion Requests
                      </Box>
                      {pendingDeletionCount > 0 && (
                        <Badge 
                          badgeContent={pendingDeletionCount} 
                          color="error"
                          sx={{
                            ml: 0.5,
                            '& .MuiBadge-badge': {
                              position: 'relative',
                              transform: 'none',
                              fontSize: '0.75rem',
                              height: 18,
                              minWidth: 18,
                              right: 'auto',
                              top: 'auto',
                            }
                          }}
                        >
                          <Box sx={{ width: 0, height: 0 }} />
                        </Badge>
                      )}
                    </Box>
                  } 
                />
              )}
            </Tabs>
          </Paper>

          {activeTab === 3 && user?.role === 'admin' ? (
            // Deletion Requests Tab
            <Box>
              <Paper sx={{ mb: 3 }}>
                <Tabs
                  value={deletionTabValue}
                  onChange={(e, newValue) => {
                    setDeletionTabValue(newValue)
                    // Force refetch when changing tabs to ensure fresh data
                    setTimeout(() => refetchDeletions(), 100)
                  }}
                  sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                  <Tab label="Pending" />
                  <Tab label="Approved" />
                  <Tab label="Denied" />
                </Tabs>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Entity</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Requested By</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {deletionRequests
                        .slice(deletionPage * deletionRowsPerPage, deletionPage * deletionRowsPerPage + deletionRowsPerPage)
                        .map((request: DeletionRequest) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {getEntityIcon(request.entityType)}
                                {request.entityName}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={request.entityType}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{request.requester?.name || 'Unknown'}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {request.requester?.email || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {format(new Date(request.requestedAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {request.reason || 'No reason provided'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={request.status}
                                size="small"
                                color={getDeletionStatusColor(request.status)}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {request.status === 'pending' ? (
                                <>
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => handleReview(request, 'approve')}
                                    title="Approve"
                                  >
                                    <Check />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleReview(request, 'deny')}
                                    title="Deny"
                                  >
                                    <Close />
                                  </IconButton>
                                </>
                              ) : (
                                <Box>
                                  {request.reviewer && (
                                    <Typography variant="caption" color="text.secondary">
                                      by {request.reviewer?.name || 'Unknown'}
                                    </Typography>
                                  )}
                                </Box>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={deletionRequests.length}
                    rowsPerPage={deletionRowsPerPage}
                    page={deletionPage}
                    onPageChange={(e, newPage) => setDeletionPage(newPage)}
                    onRowsPerPageChange={(e) => {
                      setDeletionRowsPerPage(parseInt(e.target.value, 10))
                      setDeletionPage(0)
                    }}
                  />
                </TableContainer>
              </Paper>
            </Box>
          ) : (
            // Approvals Tables (existing logic)
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Campaign</TableCell>
                    <TableCell>Advertiser</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Flight Dates</TableCell>
                    <TableCell align="right">Budget</TableCell>
                    <TableCell align="center">Rate Achievement</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
              <TableBody>
                {pendingApprovals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <Stack spacing={2} alignItems="center">
                        <CheckCircle sx={{ fontSize: 64, color: 'success.light', opacity: 0.5 }} />
                        <Typography variant="h6" color="text.secondary">
                          No Pending Approvals
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          All campaigns and reservations are up to date
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : pendingApprovals
                  .filter(a => activeTab === 0 || (activeTab === 1 && a.type === 'campaign') || (activeTab === 2 && a.type === 'reservation'))
                  .map((approval) => {
                    const daysUntilStart = Math.ceil((new Date(approval.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    
                    // Handle deletion requests differently
                    if (approval.type === 'deletion' && approval.deletionRequest) {
                      const request = approval.deletionRequest
                      return (
                        <TableRow key={approval.id}>
                          <TableCell>
                            <Stack>
                              <Typography variant="body2">{request.entityName}</Typography>
                              <Chip 
                                label="Deletion Request"
                                size="small"
                                variant="outlined"
                                color="error"
                              />
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack>
                              <Typography variant="body2">{request.entityType}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                {request.reason || 'No reason provided'}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label="deletion"
                              size="small"
                              color="error"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              Requested: {formatDate(request.requestedAt)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {request.entityValue ? formatCurrency(request.entityValue) : '-'}
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label="N/A"
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Stack>
                              <Typography variant="body2">{request.requester?.name || 'Unknown'}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                {request.requester?.email || 'N/A'}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={1}>
                              <Tooltip title="Approve Deletion">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    setSelectedRequest(request)
                                    setReviewAction('approve')
                                    setReviewDialog(true)
                                  }}
                                >
                                  <CheckCircle />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Deny Deletion">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setSelectedRequest(request)
                                    setReviewAction('deny')
                                    setReviewDialog(true)
                                  }}
                                >
                                  <Cancel />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )
                    }
                    
                    // Regular campaign/reservation handling
                    return (
                      <TableRow key={approval.id}>
                        <TableCell>
                          <Stack>
                            <Typography variant="body2">{approval.campaignName}</Typography>
                            <Chip 
                              label={`${approval.probability}% probability`}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack>
                            <Typography variant="body2">{approval.advertiserName}</Typography>
                            {approval.agencyName && (
                              <Typography variant="caption" color="textSecondary">
                                via {approval.agencyName}
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={approval.type}
                            size="small"
                            color={approval.type === 'reservation' ? 'info' : 'primary'}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack>
                            <Typography variant="body2">
                              {formatDate(approval.startDate)} - {formatDate(approval.endDate)}
                            </Typography>
                            {daysUntilStart <= 7 && (
                              <Chip 
                                label={`Starts in ${daysUntilStart} days`}
                                size="small"
                                color="error"
                              />
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(approval.budget)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={`${approval.rateAchievement}%`}
                            color={
                              approval.rateAchievement >= 95 ? 'success' :
                              approval.rateAchievement >= 80 ? 'warning' : 'error'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Stack>
                            <Typography variant="body2">{approval.createdBy}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {formatDate(approval.createdAt)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1}>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedApproval(approval)
                                  setDetailsDialog(true)
                                }}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Quick Approve">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleApprove(approval)}
                              >
                                <CheckCircle />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleReject(approval)}
                              >
                                <Cancel />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </TableContainer>
          )}

          {renderApprovalDetails()}

          {/* Deletion Request Review Dialog */}
          <Dialog
            open={reviewDialog}
            onClose={() => {
              setReviewDialog(false)
              setReviewNotes('')
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve' : 'Deny'} Deletion Request
            </DialogTitle>
            <DialogContent>
              <Typography sx={{ mb: 2 }}>
                {reviewAction === 'approve'
                  ? `Are you sure you want to approve the deletion of ${selectedRequest?.entityType} "${selectedRequest?.entityName}"? This will permanently delete the entity.`
                  : `Are you sure you want to deny the deletion request for ${selectedRequest?.entityType} "${selectedRequest?.entityName}"?`}
              </Typography>
              {selectedRequest?.entityValue !== undefined && selectedRequest?.entityValue !== null && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {selectedRequest.entityType === 'campaign' ? 'Campaign Budget:' : 'Entity Value:'}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    ${selectedRequest.entityValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
              )}
              {selectedRequest?.reason && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Reason from requester:
                  </Typography>
                  <Typography variant="body2">{selectedRequest.reason}</Typography>
                </Box>
              )}
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Review notes (optional)"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={`Add notes about why you are ${reviewAction === 'approve' ? 'approving' : 'denying'} this request...`}
                sx={{ mt: 2 }}
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setReviewDialog(false)
                  setReviewNotes('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={submitReview}
                variant="contained"
                color={reviewAction === 'approve' ? 'success' : 'error'}
              >
                {reviewAction === 'approve' ? 'Approve' : 'Deny'}
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Box>
      </DashboardLayout>
    </AdminOnly>
  )
}