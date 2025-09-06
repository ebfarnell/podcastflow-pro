'use client'


import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useParams, useRouter } from 'next/navigation'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Stepper,
  Step,
  StepLabel,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/material'
import {
  Edit,
  Delete,
  Save,
  Cancel,
  CheckCircle,
  Schedule,
  AttachMoney,
  Info,
  Warning,
  Error,
  Send,
  Bookmark,
  CalendarMonth,
  Person,
  Business,
  Receipt,
  Download,
  Print,
  Email,
  ArrowBack
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'

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

export default function OrderDetailPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)

  // Order data
  const [order, setOrder] = useState<any>(null)
  const [editMode, setEditMode] = useState(false)
  const [editedOrder, setEditedOrder] = useState<any>(null)

  // Dialog states
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusNotes, setStatusNotes] = useState('')

  const orderId = params.id as string

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user && orderId) {
      fetchOrderDetails()
    }
  }, [user, orderId])

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      if (!response.ok) throw new Error('Failed to fetch order details')
      
      const orderData = await response.json()
      setOrder(orderData)
      setEditedOrder({ ...orderData })
      setLoading(false)
    } catch (err) {
      console.error('Error fetching order:', err)
      setError('Failed to load order details')
      setLoading(false)
    }
  }

  const handleStatusChange = async () => {
    if (!newStatus) return

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          notes: statusNotes ? `${order.notes || ''}\n\nStatus Update: ${statusNotes}` : order.notes
        })
      })

      if (!response.ok) throw new Error('Failed to update order status')

      setSuccess(`Order status updated to ${newStatus}`)
      setStatusDialogOpen(false)
      setNewStatus('')
      setStatusNotes('')
      fetchOrderDetails()
    } catch (err) {
      console.error('Error updating order status:', err)
      setError('Failed to update order status')
    }
  }

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountAmount: editedOrder.discountAmount,
          notes: editedOrder.notes
        })
      })

      if (!response.ok) throw new Error('Failed to update order')

      setSuccess('Order updated successfully')
      setEditMode(false)
      fetchOrderDetails()
    } catch (err) {
      console.error('Error updating order:', err)
      setError('Failed to update order')
    }
  }

  const handleDeleteOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete order')

      router.push('/orders')
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
      case 'draft': return <Edit />
      case 'pending_approval': return <Schedule />
      case 'approved': return <CheckCircle />
      case 'booked': return <Bookmark />
      case 'confirmed': return <CheckCircle />
      case 'cancelled': return <Cancel />
      default: return <Info />
    }
  }

  const getTimelineEvents = () => {
    if (!order) return []

    const events = [
      {
        title: 'Order Created',
        date: order.createdAt,
        user: order.creator.name,
        status: 'completed'
      }
    ]

    if (order.submittedAt) {
      events.push({
        title: 'Submitted for Approval',
        date: order.submittedAt,
        user: order.creator.name,
        status: 'completed'
      })
    }

    if (order.approvedAt) {
      events.push({
        title: 'Approved',
        date: order.approvedAt,
        user: order.approver?.name || 'System',
        status: 'completed'
      })
    }

    if (order.bookedAt) {
      events.push({
        title: 'Booked',
        date: order.bookedAt,
        user: 'System',
        status: 'completed'
      })
    }

    if (order.confirmedAt) {
      events.push({
        title: 'Confirmed',
        date: order.confirmedAt,
        user: 'System',
        status: 'completed'
      })
    }

    if (order.cancelledAt) {
      events.push({
        title: 'Cancelled',
        date: order.cancelledAt,
        user: 'System',
        status: 'cancelled'
      })
    }

    return events
  }

  if (sessionLoading || loading) return (
    <RouteProtection requiredPermission={PERMISSIONS.ORDERS_VIEW}>
      <DashboardLayout><LinearProgress /></DashboardLayout>
    </RouteProtection>
  )
  if (!user || !order) return (
    <RouteProtection requiredPermission={PERMISSIONS.ORDERS_VIEW}>
      <DashboardLayout><Typography>Order not found</Typography></DashboardLayout>
    </RouteProtection>
  )

  return (
    <RouteProtection requiredPermission={PERMISSIONS.ORDERS_VIEW}>
      <DashboardLayout>
      <Box sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => router.push('/orders')}>
              <ArrowBack />
            </IconButton>
            <Box>
              <Typography variant="h4" component="h1">
                Order {order.orderNumber}
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                {order.campaign.name} • {order.advertiser.name}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              icon={getStatusIcon(order.status)}
              label={order.status.replace('_', ' ')}
              color={getStatusColor(order.status)}
            />
            {order.status !== 'cancelled' && order.status !== 'confirmed' && (
              <Button
                variant="outlined"
                startIcon={<Send />}
                onClick={() => setStatusDialogOpen(true)}
              >
                Update Status
              </Button>
            )}
            {order.status === 'draft' && (
              <>
                <Button
                  variant="outlined"
                  startIcon={editMode ? <Cancel /> : <Edit />}
                  onClick={() => {
                    if (editMode) {
                      setEditedOrder({ ...order })
                    }
                    setEditMode(!editMode)
                  }}
                >
                  {editMode ? 'Cancel Edit' : 'Edit Order'}
                </Button>
                {editMode && (
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveEdit}
                  >
                    Save Changes
                  </Button>
                )}
              </>
            )}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Overview Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <AttachMoney color="primary" />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Amount
                    </Typography>
                    <Typography variant="h6">
                      ${order.totalAmount.toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Receipt color="secondary" />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Net Amount
                    </Typography>
                    <Typography variant="h6">
                      ${order.netAmount.toFixed(2)}
                    </Typography>
                    {order.discountAmount > 0 && (
                      <Typography variant="caption" color="textSecondary">
                        ${order.discountAmount.toFixed(2)} discount
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Schedule color="info" />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Order Items
                    </Typography>
                    <Typography variant="h6">
                      {order._count.orderItems}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CalendarMonth color="success" />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Created
                    </Typography>
                    <Typography variant="h6">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      by {order.creator.name}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Order Details" icon={<Info />} iconPosition="start" />
            <Tab label="Timeline" icon={<Schedule />} iconPosition="start" />
            <Tab label="Client Info" icon={<Business />} iconPosition="start" />
            <Tab label="Invoices" icon={<Receipt />} iconPosition="start" />
          </Tabs>
          <Divider />

          <TabPanel value={tabValue} index={0}>
            {/* Order Items */}
            <Typography variant="h6" gutterBottom>
              Order Items
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Show</TableCell>
                    <TableCell>Air Date</TableCell>
                    <TableCell>Placement</TableCell>
                    <TableCell>Length</TableCell>
                    <TableCell>Live Read</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell>Ad Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.orderItems.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.show.name}
                        </Typography>
                        {item.episode && (
                          <Typography variant="caption" color="textSecondary">
                            Episode: {item.episode.title}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(item.airDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Chip label={item.placementType} size="small" />
                        {item.spotNumber && (
                          <Typography variant="caption" display="block">
                            Spot #{item.spotNumber}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{item.length}s</TableCell>
                      <TableCell>
                        {item.isLiveRead ? <CheckCircle color="success" fontSize="small" /> : '-'}
                      </TableCell>
                      <TableCell align="right">
                        ${item.rate.toFixed(2)}
                        {item.actualRate !== item.rate && (
                          <Typography variant="caption" color="textSecondary" display="block">
                            Actual: ${item.actualRate.toFixed(2)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.adTitle && (
                          <Typography variant="body2" gutterBottom>
                            <strong>{item.adTitle}</strong>
                          </Typography>
                        )}
                        {item.adScript && (
                          <Typography variant="caption" color="textSecondary" paragraph>
                            {item.adScript.substring(0, 100)}...
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Order Notes */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Order Notes
              </Typography>
              {editMode ? (
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={editedOrder.notes || ''}
                  onChange={(e) => setEditedOrder({ ...editedOrder, notes: e.target.value })}
                  placeholder="Add notes about this order..."
                />
              ) : (
                <Paper variant="outlined" sx={{ p: 2, minHeight: 100 }}>
                  <Typography>
                    {order.notes || 'No notes added'}
                  </Typography>
                </Paper>
              )}
            </Box>

            {/* Discount */}
            {editMode && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Discount
                </Typography>
                <TextField
                  type="number"
                  label="Discount Amount"
                  value={editedOrder.discountAmount || ''}
                  onChange={(e) => setEditedOrder({ 
                    ...editedOrder, 
                    discountAmount: parseFloat(e.target.value) || 0 
                  })}
                  InputProps={{ startAdornment: '$' }}
                  helperText="Enter discount amount to be subtracted from total"
                />
              </Box>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {/* Timeline */}
            <Typography variant="h6" gutterBottom>
              Order Timeline
            </Typography>
            <Timeline>
              {getTimelineEvents().map((event, index) => (
                <TimelineItem key={index}>
                  <TimelineOppositeContent sx={{ m: 'auto 0' }} variant="body2" color="textSecondary">
                    {new Date(event.date).toLocaleString()}
                  </TimelineOppositeContent>
                  <TimelineSeparator>
                    <TimelineDot color={event.status === 'cancelled' ? 'error' : 'primary'}>
                      {event.status === 'cancelled' ? <Cancel /> : <CheckCircle />}
                    </TimelineDot>
                    {index < getTimelineEvents().length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: '12px', px: 2 }}>
                    <Typography variant="h6" component="span">
                      {event.title}
                    </Typography>
                    <Typography color="textSecondary">
                      by {event.user}
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {/* Client Information */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Advertiser
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {order.advertiser.name}
                    </Typography>
                    {order.advertiser.contactName && (
                      <Typography variant="body2" color="textSecondary">
                        Contact: {order.advertiser.contactName}
                      </Typography>
                    )}
                    {order.advertiser.contactEmail && (
                      <Typography variant="body2" color="textSecondary">
                        Email: {order.advertiser.contactEmail}
                      </Typography>
                    )}
                    {order.advertiser.contactPhone && (
                      <Typography variant="body2" color="textSecondary">
                        Phone: {order.advertiser.contactPhone}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              {order.agency && (
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Agency
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {order.agency.name}
                      </Typography>
                      {order.agency.contactName && (
                        <Typography variant="body2" color="textSecondary">
                          Contact: {order.agency.contactName}
                        </Typography>
                      )}
                      {order.agency.contactEmail && (
                        <Typography variant="body2" color="textSecondary">
                          Email: {order.agency.contactEmail}
                        </Typography>
                      )}
                      {order.agency.contactPhone && (
                        <Typography variant="body2" color="textSecondary">
                          Phone: {order.agency.contactPhone}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Campaign
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {order.campaign.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Budget: ${order.campaign.budget?.toLocaleString() || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Status: {order.campaign.status}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            {/* Invoices */}
            <Typography variant="h6" gutterBottom>
              Invoices
            </Typography>
            {order.invoices && order.invoices.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice #</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.invoices.map((invoice: any) => (
                      <TableRow key={invoice.id}>
                        <TableCell>{invoice.invoiceNumber}</TableCell>
                        <TableCell>{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Chip label={invoice.status} size="small" />
                        </TableCell>
                        <TableCell align="right">
                          ${invoice.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <IconButton size="small">
                            <Download />
                          </IconButton>
                          <IconButton size="small">
                            <Email />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="textSecondary">
                  No invoices created for this order yet
                </Typography>
                <Button variant="outlined" sx={{ mt: 2 }}>
                  Create Invoice
                </Button>
              </Box>
            )}
          </TabPanel>
        </Paper>

        {/* Status Change Dialog */}
        <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
          <DialogTitle>Update Order Status</DialogTitle>
          <DialogContent>
            <FormControl fullWidth margin="normal">
              <InputLabel>New Status</InputLabel>
              <Select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                label="New Status"
              >
                {order.status === 'draft' && (
                  <MenuItem value="pending_approval">Submit for Approval</MenuItem>
                )}
                {order.status === 'pending_approval' && (
                  <>
                    <MenuItem value="approved">Approve</MenuItem>
                    <MenuItem value="draft">Return to Draft</MenuItem>
                  </>
                )}
                {order.status === 'approved' && (
                  <MenuItem value="booked">Book Order</MenuItem>
                )}
                {order.status === 'booked' && (
                  <MenuItem value="confirmed">Confirm Order</MenuItem>
                )}
                {(order.status === 'draft' || order.status === 'pending_approval') && (
                  <MenuItem value="cancelled">Cancel Order</MenuItem>
                )}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes (optional)"
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              margin="normal"
              placeholder="Add notes about this status change..."
            />
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
              Are you sure you want to delete this order? This action cannot be undone.
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
    </RouteProtection>
  )
}