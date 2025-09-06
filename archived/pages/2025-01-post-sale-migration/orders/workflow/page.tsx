'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
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
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Stack,
  Checkbox,
  FormControlLabel
} from '@mui/material'
import {
  PlayArrow,
  Pause,
  CheckCircle,
  Cancel,
  Warning,
  Schedule,
  AttachMoney,
  Timeline,
  Assessment,
  Send,
  Edit,
  Visibility,
  MoreVert,
  FilterList,
  SwapHoriz
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'

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

const STATUS_LABELS: Record<string, string> = {
  'draft': 'Draft',
  'pending_approval': 'Pending Approval',
  'approved': 'Approved',
  'booked': 'Booked',
  'confirmed': 'Confirmed',
  'cancelled': 'Cancelled'
}

const STATUS_COLORS: Record<string, any> = {
  'draft': 'default',
  'pending_approval': 'warning',
  'approved': 'info',
  'booked': 'primary',
  'confirmed': 'success',
  'cancelled': 'error'
}

export default function OrderWorkflowPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)

  // Data state
  const [workflowData, setWorkflowData] = useState<any>(null)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])

  // Dialog states
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  // Form state
  const [newStatus, setNewStatus] = useState('')
  const [statusNotes, setStatusNotes] = useState('')

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user) {
      fetchWorkflowData()
    }
  }, [user])

  const fetchWorkflowData = async () => {
    try {
      const response = await fetch('/api/orders/workflow')
      if (!response.ok) throw new Error('Failed to fetch workflow data')
      
      const data = await response.json()
      setWorkflowData(data)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching workflow data:', err)
      setError('Failed to load workflow data')
      setLoading(false)
    }
  }

  const handleBulkStatusChange = async () => {
    if (selectedOrders.length === 0 || !newStatus) {
      setError('Please select orders and a status')
      return
    }

    try {
      const response = await fetch('/api/orders/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkOrderIds: selectedOrders,
          toStatus: newStatus,
          notes: statusNotes
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update order status')
      }

      const result = await response.json()
      setSuccess(result.message)
      setBulkStatusDialogOpen(false)
      setSelectedOrders([])
      setNewStatus('')
      setStatusNotes('')
      fetchWorkflowData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSingleStatusChange = async () => {
    if (!selectedOrder || !newStatus) return

    try {
      const response = await fetch('/api/orders/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          toStatus: newStatus,
          notes: statusNotes
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update order status')
      }

      const result = await response.json()
      setSuccess(result.message)
      setStatusDialogOpen(false)
      setSelectedOrder(null)
      setNewStatus('')
      setStatusNotes('')
      fetchWorkflowData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getAvailableTransitions = (currentStatus: string) => {
    if (!workflowData?.statusTransitions) return []
    return workflowData.statusTransitions[currentStatus] || []
  }

  const canUserPerformTransition = (toStatus: string) => {
    if (!workflowData?.permissionRequirements || !user) return false
    const requiredRoles = workflowData.permissionRequirements[toStatus] || []
    return requiredRoles.length === 0 || requiredRoles.includes(user.role)
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const { source, destination } = result
    if (source.droppableId === destination.droppableId) return

    // Move order between status columns
    const orderId = result.draggableId
    const newStatus = destination.droppableId

    if (!canUserPerformTransition(newStatus)) {
      setError('You do not have permission to move orders to this status')
      return
    }

    // Find the order and update its status
    const order = Object.values(workflowData.ordersByStatus).flat().find((o: any) => o.id === orderId)
    if (order) {
      setSelectedOrder(order)
      setNewStatus(newStatus)
      setStatusNotes(`Moved via drag and drop from ${order.status}`)
      handleSingleStatusChange()
    }
  }

  if (sessionLoading || loading) return <DashboardLayout><LinearProgress /></DashboardLayout>
  if (!user || !workflowData) return <DashboardLayout><Typography>Workflow data not available</Typography></DashboardLayout>

  const { workflowStats, ordersByStatus, recentChanges } = workflowData

  return (
    <DashboardLayout>
      <Box sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Order Workflow Management
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Track and manage order status progression
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<SwapHoriz />}
              onClick={() => setBulkStatusDialogOpen(true)}
              disabled={selectedOrders.length === 0}
            >
              Bulk Status Change ({selectedOrders.length})
            </Button>
            <Button
              variant="contained"
              startIcon={<Assessment />}
              onClick={() => router.push('/orders')}
            >
              View All Orders
            </Button>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Workflow Stats */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {Object.entries(workflowStats).map(([status, stats]: [string, any]) => (
            <Grid item xs={12} sm={6} md={2} key={status}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip 
                      label={STATUS_LABELS[status] || status} 
                      color={STATUS_COLORS[status]} 
                      size="small" 
                    />
                  </Box>
                  <Typography variant="h4">
                    {stats.count}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    ${stats.totalValue.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Tabs */}
        <Paper>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Kanban Board" icon={<Timeline />} iconPosition="start" />
            <Tab label="Activity Log" icon={<Schedule />} iconPosition="start" />
          </Tabs>
          <Divider />

          <TabPanel value={tabValue} index={0}>
            {/* Kanban Board */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Grid container spacing={2} sx={{ p: 2 }}>
                {['draft', 'pending_approval', 'approved', 'booked', 'confirmed'].map((status) => (
                  <Grid item xs={12} md={2.4} key={status}>
                    <Paper sx={{ p: 2, minHeight: 400, bgcolor: 'grey.50' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                          {STATUS_LABELS[status]}
                        </Typography>
                        <Chip 
                          label={ordersByStatus[status]?.length || 0} 
                          size="small" 
                          color={STATUS_COLORS[status]}
                        />
                      </Box>
                      
                      <Droppable droppableId={status}>
                        {(provided, snapshot) => (
                          <Box
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            sx={{
                              minHeight: 300,
                              bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                              borderRadius: 1,
                              p: 1
                            }}
                          >
                            {(ordersByStatus[status] || []).map((order: any, index: number) => (
                              <Draggable key={order.id} draggableId={order.id} index={index}>
                                {(provided, snapshot) => (
                                  <Card
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    sx={{
                                      mb: 1,
                                      opacity: snapshot.isDragging ? 0.8 : 1,
                                      transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                                      cursor: 'grab'
                                    }}
                                  >
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Checkbox
                                          size="small"
                                          checked={selectedOrders.includes(order.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedOrders([...selectedOrders, order.id])
                                            } else {
                                              setSelectedOrders(selectedOrders.filter(id => id !== order.id))
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>
                                          {order.orderNumber}
                                        </Typography>
                                        <IconButton 
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            router.push(`/orders/${order.id}`)
                                          }}
                                        >
                                          <Visibility fontSize="small" />
                                        </IconButton>
                                      </Box>
                                      <Typography variant="caption" color="textSecondary" display="block">
                                        {order.campaign.name}
                                      </Typography>
                                      <Typography variant="caption" color="textSecondary" display="block">
                                        {order.advertiser.name}
                                      </Typography>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                        <Typography variant="caption" fontWeight="medium">
                                          ${order.netAmount.toFixed(0)}
                                        </Typography>
                                        <Chip 
                                          label={`${order._count.orderItems} items`} 
                                          size="small" 
                                          variant="outlined"
                                        />
                                      </Box>
                                    </CardContent>
                                  </Card>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </Box>
                        )}
                      </Droppable>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </DragDropContext>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {/* Activity Log */}
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recent Status Changes
              </Typography>
              
              {recentChanges.length > 0 ? (
                <List>
                  {recentChanges.map((change: any) => (
                    <ListItem key={change.id} divider>
                      <ListItemIcon>
                        <SwapHoriz color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {change.order.orderNumber}
                            </Typography>
                            <Chip label={STATUS_LABELS[change.fromStatus]} size="small" color={STATUS_COLORS[change.fromStatus]} />
                            <Typography variant="body2">→</Typography>
                            <Chip label={STATUS_LABELS[change.toStatus]} size="small" color={STATUS_COLORS[change.toStatus]} />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="textSecondary">
                              {change.order.campaign.name} • by {change.changedBy.name}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" display="block">
                              {new Date(change.changedAt).toLocaleString()}
                            </Typography>
                            {change.notes && (
                              <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                                "{change.notes}"
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/orders/${change.order.id}`)}
                        >
                          <Visibility />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Schedule sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    No Recent Activity
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Status changes will appear here
                  </Typography>
                </Box>
              )}
            </Box>
          </TabPanel>
        </Paper>

        {/* Bulk Status Change Dialog */}
        <Dialog open={bulkStatusDialogOpen} onClose={() => setBulkStatusDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Bulk Status Change</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              Change status for {selectedOrders.length} selected order(s).
            </Typography>
            
            <FormControl fullWidth margin="normal">
              <InputLabel>New Status</InputLabel>
              <Select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                label="New Status"
              >
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <MenuItem 
                    key={status} 
                    value={status}
                    disabled={!canUserPerformTransition(status)}
                  >
                    {label}
                    {!canUserPerformTransition(status) && ' (No Permission)'}
                  </MenuItem>
                ))}
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
            <Button onClick={() => setBulkStatusDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleBulkStatusChange}
              disabled={!newStatus}
            >
              Update Status
            </Button>
          </DialogActions>
        </Dialog>

        {/* Single Status Change Dialog */}
        <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Change Order Status</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              Change status for order {selectedOrder?.orderNumber}.
            </Typography>
            
            <FormControl fullWidth margin="normal">
              <InputLabel>New Status</InputLabel>
              <Select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                label="New Status"
              >
                {getAvailableTransitions(selectedOrder?.status || '').map((status: string) => (
                  <MenuItem 
                    key={status} 
                    value={status}
                    disabled={!canUserPerformTransition(status)}
                  >
                    {STATUS_LABELS[status]}
                    {!canUserPerformTransition(status) && ' (No Permission)'}
                  </MenuItem>
                ))}
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
              onClick={handleSingleStatusChange}
              disabled={!newStatus}
            >
              Update Status
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}