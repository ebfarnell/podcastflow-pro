'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Skeleton,
  Tooltip,
  Stack,
  Grid,
  Paper,
  Tabs,
  Tab
} from '@mui/material'
import {
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Check as ConfirmIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as OrderIcon
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { formatDistanceToNow, format } from 'date-fns'

interface Reservation {
  id: string
  reservationNumber: string
  status: 'held' | 'confirmed' | 'expired' | 'cancelled' | 'failed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  totalAmount: number
  estimatedRevenue: number
  expiresAt: string
  createdAt: string
  confirmedAt?: string
  cancelledAt?: string
  notes?: string
  advertiser: { name: string; email: string }
  agency?: { name: string; email: string }
  campaign?: { name: string; status: string }
  creator: { name: string; email: string; role: string }
  items: Array<{
    id: string
    date: string
    placementType: string
    length: number
    rate: number
    show: { name: string }
    episode?: { title: string; episodeNumber: number }
  }>
  _count: { items: number }
}

interface ReservationStats {
  totalReservations: number
  statusBreakdown: Array<{
    status: string
    count: number
    totalAmount: number
  }>
  priorityBreakdown: Array<{
    priority: string
    count: number
  }>
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reservations-tabpanel-${index}`}
      aria-labelledby={`reservations-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [stats, setStats] = useState<ReservationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [totalReservations, setTotalReservations] = useState(0)
  const [tabValue, setTabValue] = useState(0)

  // Menu and dialog states
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [confirmNotes, setConfirmNotes] = useState('')

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    advertiserId: '',
    campaignId: ''
  })

  const statusColors: Record<string, any> = {
    held: { color: 'warning', label: 'Held' },
    confirmed: { color: 'success', label: 'Confirmed' },
    expired: { color: 'error', label: 'Expired' },
    cancelled: { color: 'default', label: 'Cancelled' },
    failed: { color: 'error', label: 'Failed' }
  }

  const priorityColors: Record<string, any> = {
    low: { color: 'default', label: 'Low' },
    normal: { color: 'primary', label: 'Normal' },
    high: { color: 'warning', label: 'High' },
    urgent: { color: 'error', label: 'Urgent' }
  }

  const loadReservations = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString()
      })

      // Add filters
      if (filters.status) params.set('status', filters.status)
      if (filters.priority) params.set('priority', filters.priority)
      if (filters.advertiserId) params.set('advertiserId', filters.advertiserId)
      if (filters.campaignId) params.set('campaignId', filters.campaignId)

      const response = await fetch(`/api/reservations?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to load reservations')
      }

      const data = await response.json()
      setReservations(data.reservations || [])
      setTotalReservations(data.pagination?.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reservations')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/reservations/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  useEffect(() => {
    loadReservations()
  }, [page, rowsPerPage, filters])

  useEffect(() => {
    loadStats()
  }, [])

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, reservation: Reservation) => {
    setAnchorEl(event.currentTarget)
    setSelectedReservation(reservation)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedReservation(null)
  }

  const handleConfirm = async () => {
    if (!selectedReservation) return

    try {
      const response = await fetch(`/api/reservations/${selectedReservation.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: confirmNotes })
      })

      if (response.ok) {
        const data = await response.json()
        loadReservations()
        loadStats()
        setConfirmDialogOpen(false)
        setConfirmNotes('')
        handleMenuClose()
        // Show success message
      } else {
        const error = await response.json()
        setError(error.error || 'Failed to confirm reservation')
      }
    } catch (err) {
      setError('Failed to confirm reservation')
    }
  }

  const handleCancel = async () => {
    if (!selectedReservation) return

    try {
      const response = await fetch(`/api/reservations/${selectedReservation.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason })
      })

      if (response.ok) {
        loadReservations()
        loadStats()
        setCancelDialogOpen(false)
        setCancelReason('')
        handleMenuClose()
      } else {
        const error = await response.json()
        setError(error.error || 'Failed to cancel reservation')
      }
    } catch (err) {
      setError('Failed to cancel reservation')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()
    
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }
    
    return `${hours}h ${minutes}m`
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.ORDERS_VIEW}>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1">
              Ad Slot Reservations
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => { loadReservations(); loadStats() }}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                href="/availability"
              >
                New Reservation
              </Button>
            </Stack>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Statistics Cards */}
          {stats && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {stats.totalReservations}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Reservations
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {stats.statusBreakdown.find(s => s.status === 'held')?.count || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Holds
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {stats.statusBreakdown.find(s => s.status === 'confirmed')?.count || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Confirmed
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {formatCurrency(stats.statusBreakdown.reduce((sum, s) => sum + s.totalAmount, 0))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Value
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* Main Content */}
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
                <Tab label="All Reservations" icon={<ScheduleIcon />} iconPosition="start" />
                <Tab label="Active Holds" icon={<TrendingUpIcon />} iconPosition="start" />
                <Tab label="Confirmed" icon={<OrderIcon />} iconPosition="start" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Reservation #</TableCell>
                      <TableCell>Advertiser</TableCell>
                      <TableCell>Campaign</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Slots</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Expires</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: rowsPerPage }).map((_, index) => (
                        <TableRow key={index}>
                          {Array.from({ length: 10 }).map((_, cellIndex) => (
                            <TableCell key={cellIndex}>
                              <Skeleton variant="text" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : reservations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            No reservations found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reservations.map((reservation) => (
                        <TableRow key={reservation.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {reservation.reservationNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {reservation.advertiser.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {reservation.campaign ? (
                              <Typography variant="body2">
                                {reservation.campaign.name}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No campaign
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={statusColors[reservation.status]?.label || reservation.status}
                              color={statusColors[reservation.status]?.color || 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={priorityColors[reservation.priority]?.label || reservation.priority}
                              color={priorityColors[reservation.priority]?.color || 'default'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {reservation._count.items} slots
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatCurrency(reservation.totalAmount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {reservation.status === 'held' ? (
                              <Tooltip title={`Expires ${format(new Date(reservation.expiresAt), 'MMM d, yyyy h:mm a')}`}>
                                <Typography 
                                  variant="body2" 
                                  color={new Date(reservation.expiresAt) < new Date() ? 'error' : 'warning.main'}
                                >
                                  {getTimeRemaining(reservation.expiresAt)}
                                </Typography>
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDistanceToNow(new Date(reservation.createdAt), { addSuffix: true })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuOpen(e, reservation)}
                            >
                              <MoreIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={totalReservations}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value))
                  setPage(0)
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Typography>Active holds content (filtered view)</Typography>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Typography>Confirmed reservations content (filtered view)</Typography>
            </TabPanel>
          </Card>
        </Box>

        {/* Context Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => { setViewDialogOpen(true); handleMenuClose() }}>
            <ViewIcon fontSize="small" sx={{ mr: 1 }} />
            View Details
          </MenuItem>
          {selectedReservation?.status === 'held' && (
            <>
              <MenuItem onClick={() => { setConfirmDialogOpen(true); handleMenuClose() }}>
                <ConfirmIcon fontSize="small" sx={{ mr: 1 }} />
                Confirm & Create Order
              </MenuItem>
              <MenuItem onClick={() => { setEditDialogOpen(true); handleMenuClose() }}>
                <EditIcon fontSize="small" sx={{ mr: 1 }} />
                Edit Reservation
              </MenuItem>
              <MenuItem onClick={() => { setCancelDialogOpen(true); handleMenuClose() }}>
                <CancelIcon fontSize="small" sx={{ mr: 1 }} />
                Cancel Reservation
              </MenuItem>
            </>
          )}
        </Menu>

        {/* Confirm Dialog */}
        <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Confirm Reservation</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              This will confirm the reservation and create an order. The inventory will be moved from reserved to booked status.
            </Typography>
            <TextField
              fullWidth
              label="Order Notes (optional)"
              multiline
              rows={3}
              value={confirmNotes}
              onChange={(e) => setConfirmNotes(e.target.value)}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} variant="contained" color="success">
              Confirm & Create Order
            </Button>
          </DialogActions>
        </Dialog>

        {/* Cancel Dialog */}
        <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Cancel Reservation</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              This will cancel the reservation and release the inventory back to available status.
            </Typography>
            <TextField
              fullWidth
              label="Cancellation Reason"
              multiline
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              sx={{ mt: 2 }}
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelDialogOpen(false)}>Keep Reservation</Button>
            <Button onClick={handleCancel} variant="contained" color="error">
              Cancel Reservation
            </Button>
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </RouteProtection>
  )
}