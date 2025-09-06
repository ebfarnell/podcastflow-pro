'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { MigrationNotice } from '@/components/common/MigrationNotice'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  Tooltip,
  Badge,
  Menu,
  MenuList,
  ListItem,
  ListItemIcon,
  ListItemText,
  Autocomplete,
  Stack
} from '@mui/material'
import {
  Add,
  Edit,
  Delete,
  MoreVert,
  Search,
  FilterList,
  CalendarMonth,
  AttachMoney,
  Schedule,
  CheckCircle,
  Warning,
  Info,
  Visibility,
  GetApp,
  Send,
  Cancel,
  BookmarkBorder,
  Bookmark,
  Timeline
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

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
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function OrdersPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  // Data state
  const [orders, setOrders] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [advertisers, setAdvertisers] = useState<any[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    campaignId: '',
    advertiserId: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
    search: ''
  })

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState('')

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    pending: 0,
    approved: 0,
    booked: 0,
    confirmed: 0,
    cancelled: 0,
    totalRevenue: 0
  })

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user) {
      fetchOrdersData()
      fetchCampaigns()
      fetchAdvertisers()
    }
  }, [user, filters, pagination.page])

  const fetchOrdersData = async () => {
    try {
      const params = new URLSearchParams()
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())
      
      if (filters.status) params.append('status', filters.status)
      if (filters.campaignId) params.append('campaignId', filters.campaignId)
      if (filters.advertiserId) params.append('advertiserId', filters.advertiserId)
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString())
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString())

      const response = await fetch(`/api/orders?${params}`)
      if (!response.ok) throw new Error('Failed to fetch orders')
      
      const data = await response.json()
      setOrders(data.orders || [])
      setPagination({
        page: data.page || 1,
        limit: data.limit || 20,
        total: data.total || 0,
        pages: data.totalPages || 0
      })

      // Calculate stats
      const statsData = {
        total: data.orders.length,
        draft: data.orders.filter((o: any) => o.status === 'draft').length,
        pending: data.orders.filter((o: any) => o.status === 'pending_approval').length,
        approved: data.orders.filter((o: any) => o.status === 'approved').length,
        booked: data.orders.filter((o: any) => o.status === 'booked').length,
        confirmed: data.orders.filter((o: any) => o.status === 'confirmed').length,
        cancelled: data.orders.filter((o: any) => o.status === 'cancelled').length,
        totalRevenue: data.orders.reduce((sum: number, o: any) => sum + o.netAmount, 0)
      }
      setStats(statsData)
      
      setLoading(false)
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Failed to load orders')
      setLoading(false)
    }
  }

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns')
      if (!response.ok) throw new Error('Failed to fetch campaigns')
      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (err) {
      console.error('Error fetching campaigns:', err)
    }
  }

  const fetchAdvertisers = async () => {
    try {
      const response = await fetch('/api/advertisers')
      if (!response.ok) throw new Error('Failed to fetch advertisers')
      const data = await response.json()
      setAdvertisers(data.advertisers || [])
    } catch (err) {
      console.error('Error fetching advertisers:', err)
    }
  }

  const handleStatusChange = async () => {
    if (!selectedOrder || !newStatus) return

    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) throw new Error('Failed to update order status')

      setSuccess(`Order status updated to ${newStatus}`)
      setStatusDialogOpen(false)
      setSelectedOrder(null)
      setNewStatus('')
      fetchOrdersData()
    } catch (err) {
      console.error('Error updating order status:', err)
      setError('Failed to update order status')
    }
  }

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return

    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete order')

      setSuccess('Order deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedOrder(null)
      fetchOrdersData()
    } catch (err) {
      console.error('Error deleting order:', err)
      setError('Failed to delete order')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default'
      case 'pending_approval': return 'warning'
      case 'approved': return 'info'
      case 'booked': return 'primary'
      case 'confirmed': return 'success'
      case 'cancelled': return 'error'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Edit fontSize="small" />
      case 'pending_approval': return <Schedule fontSize="small" />
      case 'approved': return <CheckCircle fontSize="small" />
      case 'booked': return <Bookmark fontSize="small" />
      case 'confirmed': return <CheckCircle fontSize="small" />
      case 'cancelled': return <Cancel fontSize="small" />
      default: return <Info fontSize="small" />
    }
  }

  if (sessionLoading || loading) return <DashboardLayout><LinearProgress /></DashboardLayout>
  if (!user) return null

  return (
    <DashboardLayout>
      <MigrationNotice targetTab="orders" pageName="Orders" />
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Orders Management
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Manage advertising orders and track status workflow
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => router.push('/orders/new')}
          >
            Create Order
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Orders
                    </Typography>
                    <Typography variant="h4">
                      {stats.total}
                    </Typography>
                  </Box>
                  <Timeline color="primary" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Revenue
                    </Typography>
                    <Typography variant="h4">
                      ${stats.totalRevenue.toLocaleString()}
                    </Typography>
                  </Box>
                  <AttachMoney color="success" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Confirmed
                    </Typography>
                    <Typography variant="h4">
                      {stats.confirmed}
                    </Typography>
                  </Box>
                  <CheckCircle color="success" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Pending
                    </Typography>
                    <Typography variant="h4">
                      {stats.pending}
                    </Typography>
                  </Box>
                  <Schedule color="warning" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="pending_approval">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="booked">Booked</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                size="small"
                value={campaigns.find(c => c.id === filters.campaignId) || null}
                onChange={(e, value) => setFilters({ ...filters, campaignId: value?.id || '' })}
                options={campaigns}
                getOptionLabel={(option) => option.name}
                renderInput={(params) => (
                  <TextField {...params} label="Campaign" />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                size="small"
                value={advertisers.find(a => a.id === filters.advertiserId) || null}
                onChange={(e, value) => setFilters({ ...filters, advertiserId: value?.id || '' })}
                options={advertisers}
                getOptionLabel={(option) => option.name}
                renderInput={(params) => (
                  <TextField {...params} label="Advertiser" />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={filters.startDate}
                  onChange={(date) => setFilters({ ...filters, startDate: date })}
                  slotProps={{
                    textField: { size: 'small', fullWidth: true }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={filters.endDate}
                  onChange={(date) => setFilters({ ...filters, endDate: date })}
                  slotProps={{
                    textField: { size: 'small', fullWidth: true }
                  }}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
        </Paper>

        {/* Orders Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order #</TableCell>
                  <TableCell>Campaign</TableCell>
                  <TableCell>Advertiser</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Net Amount</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {order.orderNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {order.campaign?.name || 'No Campaign'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {order.advertiser?.name || 'No Advertiser'}
                      </Typography>
                      {order.agency && (
                        <Typography variant="caption" color="textSecondary" display="block">
                          via {order.agency.name}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(order.status)}
                        label={order.status.replace('_', ' ')}
                        color={getStatusColor(order.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge badgeContent={order._count.orderItems} color="primary">
                        <Schedule />
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      ${order.totalAmount.toFixed(2)}
                      {order.discountAmount > 0 && (
                        <Typography variant="caption" color="textSecondary" display="block">
                          -{order.discountAmount.toFixed(2)} discount
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        ${order.netAmount.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </Typography>
                      {order.creator && (
                        <Typography variant="caption" color="textSecondary">
                          by {order.creator.name}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setMenuAnchorEl(e.currentTarget)
                          setSelectedOrder(order)
                        }}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="textSecondary">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} orders
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                disabled={pagination.page === 1}
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              >
                Previous
              </Button>
              <Button
                size="small"
                disabled={pagination.page === pagination.pages}
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              >
                Next
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Action Menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={() => setMenuAnchorEl(null)}
        >
          <MenuItem onClick={() => {
            setMenuAnchorEl(null)
            router.push(`/orders/${selectedOrder?.id}`)
          }}>
            <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => {
            setMenuAnchorEl(null)
            router.push(`/orders/${selectedOrder?.id}/edit`)
          }}>
            <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Order</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => {
            setMenuAnchorEl(null)
            setStatusDialogOpen(true)
          }}>
            <ListItemIcon><Send fontSize="small" /></ListItemIcon>
            <ListItemText>Change Status</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setMenuAnchorEl(null)
              setDeleteDialogOpen(true)
            }}
            disabled={selectedOrder?.status !== 'draft'}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
            <ListItemText>Delete Order</ListItemText>
          </MenuItem>
        </Menu>

        {/* Status Change Dialog */}
        <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
          <DialogTitle>Change Order Status</DialogTitle>
          <DialogContent>
            <FormControl fullWidth margin="normal">
              <InputLabel>New Status</InputLabel>
              <Select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                label="New Status"
              >
                {selectedOrder?.status === 'draft' && (
                  <MenuItem value="pending_approval">Submit for Approval</MenuItem>
                )}
                {selectedOrder?.status === 'pending_approval' && (
                  <>
                    <MenuItem value="approved">Approve</MenuItem>
                    <MenuItem value="draft">Return to Draft</MenuItem>
                  </>
                )}
                {selectedOrder?.status === 'approved' && (
                  <MenuItem value="booked">Book Order</MenuItem>
                )}
                {selectedOrder?.status === 'booked' && (
                  <MenuItem value="confirmed">Confirm Order</MenuItem>
                )}
                {(selectedOrder?.status === 'draft' || selectedOrder?.status === 'pending_approval') && (
                  <MenuItem value="cancelled">Cancel Order</MenuItem>
                )}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleStatusChange}
              disabled={!newStatus}
            >
              Update Status
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Order</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete order {selectedOrder?.orderNumber}? 
              This action cannot be undone and will release any reserved inventory.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteOrder}
            >
              Delete Order
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}