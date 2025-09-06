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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
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
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material'
import {
  CheckCircle,
  Warning,
  Error,
  Info,
  ThumbUp,
  ThumbDown,
  Edit,
  AttachMoney,
  Schedule,
  Campaign,
  Assessment,
  Security,
  ArrowBack,
  Send,
  Cancel,
  Approval
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

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

export default function CampaignApprovalPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)

  // Data state
  const [approvalData, setApprovalData] = useState<any>(null)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [campaignApproveDialogOpen, setCampaignApproveDialogOpen] = useState(false)

  // Form state
  const [approvalNotes, setApprovalNotes] = useState('')
  const [rejectionNotes, setRejectionNotes] = useState('')
  const [overrideDiscrepancies, setOverrideDiscrepancies] = useState(false)

  const campaignId = params.id as string

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user && campaignId) {
      fetchApprovalData()
    }
  }, [user, campaignId])

  const fetchApprovalData = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/approval`)
      if (!response.ok) throw new Error('Failed to fetch approval data')
      
      const data = await response.json()
      setApprovalData(data)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching approval data:', err)
      setError('Failed to load approval data')
      setLoading(false)
    }
  }

  const handleApproveOrders = async () => {
    if (selectedOrders.length === 0) {
      setError('Please select orders to approve')
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_orders',
          orderIds: selectedOrders,
          notes: approvalNotes,
          overrideDiscrepancies
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (errorData.requiresOverride) {
          setError(`Rate discrepancies detected. Check "Override Discrepancies" to proceed.`)
          return
        }
        throw new Error(errorData.error || 'Failed to approve orders')
      }

      const result = await response.json()
      setSuccess(result.message)
      setApproveDialogOpen(false)
      setSelectedOrders([])
      setApprovalNotes('')
      setOverrideDiscrepancies(false)
      fetchApprovalData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRejectOrders = async () => {
    if (selectedOrders.length === 0) {
      setError('Please select orders to reject')
      return
    }

    if (!rejectionNotes.trim()) {
      setError('Rejection reason is required')
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject_orders',
          orderIds: selectedOrders,
          notes: rejectionNotes
        })
      })

      if (!response.ok) throw new Error('Failed to reject orders')

      const result = await response.json()
      setSuccess(result.message)
      setRejectDialogOpen(false)
      setSelectedOrders([])
      setRejectionNotes('')
      fetchApprovalData()
    } catch (err) {
      setError('Failed to reject orders')
    }
  }

  const handleApproveCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_campaign',
          notes: approvalNotes,
          overrideDiscrepancies
        })
      })

      if (!response.ok) throw new Error('Failed to approve campaign')

      const result = await response.json()
      setSuccess(result.message)
      setCampaignApproveDialogOpen(false)
      setApprovalNotes('')
      setOverrideDiscrepancies(false)
      fetchApprovalData()
    } catch (err) {
      setError('Failed to approve campaign')
    }
  }

  const getDiscrepancySeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'error'
      case 'medium': return 'warning'
      case 'low': return 'info'
      default: return 'default'
    }
  }

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default'
      case 'pending_approval': return 'warning'
      case 'approved': return 'success'
      case 'booked': return 'primary'
      case 'confirmed': return 'success'
      case 'cancelled': return 'error'
      default: return 'default'
    }
  }

  if (sessionLoading || loading) return <DashboardLayout><LinearProgress /></DashboardLayout>
  if (!user || !approvalData) return <DashboardLayout><Typography>Campaign not found</Typography></DashboardLayout>

  const { campaign, rateDiscrepancies, approvalSummary, financialSummary, approvalRequirements } = approvalData
  const pendingOrders = campaign.orders.filter((o: any) => o.status === 'pending_approval')

  // Check if user has approval permissions
  const canApprove = ['master', 'admin'].includes(user.role)

  if (!canApprove) {
    return (
      <DashboardLayout>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Security sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Insufficient Permissions
          </Typography>
          <Typography variant="body1" color="textSecondary">
            You need admin or master privileges to access campaign approvals.
          </Typography>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => router.push(`/campaigns/${campaignId}`)}>
              <ArrowBack />
            </IconButton>
            <Box>
              <Typography variant="h4" component="h1">
                Campaign Approval
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                {campaign.name} • {campaign.advertiser.name}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              icon={approvalRequirements.requiresApproval ? <Warning /> : <CheckCircle />}
              label={approvalRequirements.requiresApproval ? 'Requires Approval' : 'No Issues'}
              color={approvalRequirements.requiresApproval ? 'warning' : 'success'}
            />
            {approvalRequirements.requiresApproval && (
              <Button
                variant="contained"
                startIcon={<Approval />}
                onClick={() => setCampaignApproveDialogOpen(true)}
                disabled={pendingOrders.length === 0}
              >
                Approve Campaign
              </Button>
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
                  <Schedule color={approvalSummary.pendingOrders > 0 ? 'warning' : 'success'} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Pending Orders
                    </Typography>
                    <Typography variant="h4">
                      {approvalSummary.pendingOrders}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      of {approvalSummary.totalOrders} total
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
                  <Warning color={rateDiscrepancies.length > 0 ? 'error' : 'success'} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Rate Discrepancies
                    </Typography>
                    <Typography variant="h4">
                      {rateDiscrepancies.length}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      ${financialSummary.totalDiscrepancyAmount.toFixed(2)} total
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
                  <AttachMoney color={approvalRequirements.budgetExceeded ? 'error' : 'success'} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Pending Value
                    </Typography>
                    <Typography variant="h4">
                      ${financialSummary.pendingValue.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Budget: ${campaign.budget?.toLocaleString() || 'N/A'}
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
                  <CheckCircle color="success" />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Approved Value
                    </Typography>
                    <Typography variant="h4">
                      ${financialSummary.approvedValue.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Approval Workflow Stepper */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Approval Workflow
          </Typography>
          <Stepper orientation="horizontal" sx={{ mt: 2 }}>
            <Step completed={approvalSummary.draftOrders === 0}>
              <StepLabel>
                Orders Created
                <Typography variant="caption" display="block">
                  {approvalSummary.draftOrders} draft orders
                </Typography>
              </StepLabel>
            </Step>
            <Step completed={approvalSummary.pendingOrders === 0} active={approvalSummary.pendingOrders > 0}>
              <StepLabel>
                Pending Approval
                <Typography variant="caption" display="block">
                  {approvalSummary.pendingOrders} orders pending
                </Typography>
              </StepLabel>
            </Step>
            <Step completed={approvalSummary.approvedOrders > 0}>
              <StepLabel>
                Approved
                <Typography variant="caption" display="block">
                  {approvalSummary.approvedOrders} orders approved
                </Typography>
              </StepLabel>
            </Step>
            <Step completed={approvalSummary.bookedOrders > 0}>
              <StepLabel>
                Booked
                <Typography variant="caption" display="block">
                  {approvalSummary.bookedOrders} orders booked
                </Typography>
              </StepLabel>
            </Step>
          </Stepper>
        </Paper>

        {/* Tabs */}
        <Paper>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Pending Orders" icon={<Schedule />} iconPosition="start" />
            <Tab label="Rate Discrepancies" icon={<Warning />} iconPosition="start" />
            <Tab label="Approval History" icon={<Assessment />} iconPosition="start" />
          </Tabs>
          <Divider />

          <TabPanel value={tabValue} index={0}>
            {/* Pending Orders */}
            {pendingOrders.length > 0 ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Orders Pending Approval ({pendingOrders.length})
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<ThumbDown />}
                      onClick={() => setRejectDialogOpen(true)}
                      disabled={selectedOrders.length === 0}
                    >
                      Reject Selected
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<ThumbUp />}
                      onClick={() => setApproveDialogOpen(true)}
                      disabled={selectedOrders.length === 0}
                    >
                      Approve Selected
                    </Button>
                  </Box>
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            indeterminate={selectedOrders.length > 0 && selectedOrders.length < pendingOrders.length}
                            checked={pendingOrders.length > 0 && selectedOrders.length === pendingOrders.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrders(pendingOrders.map((o: any) => o.id))
                              } else {
                                setSelectedOrders([])
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>Order #</TableCell>
                        <TableCell>Items</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Discrepancies</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingOrders.map((order: any) => {
                        const orderDiscrepancies = rateDiscrepancies.filter(d => d.orderId === order.id)
                        return (
                          <TableRow key={order.id} hover>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedOrders.includes(order.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedOrders([...selectedOrders, order.id])
                                  } else {
                                    setSelectedOrders(selectedOrders.filter(id => id !== order.id))
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {order.orderNumber}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {order.orderItems.length} items
                              </Typography>
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
                              <Typography variant="caption" color="textSecondary">
                                by {order.creator.name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {orderDiscrepancies.length > 0 ? (
                                <Stack direction="row" spacing={0.5}>
                                  {orderDiscrepancies.map((disc, idx) => (
                                    <Tooltip key={idx} title={`${disc.showName}: ${disc.discrepancyPercentage.toFixed(1)}%`}>
                                      <Chip
                                        size="small"
                                        label={disc.severity}
                                        color={getDiscrepancySeverityColor(disc.severity)}
                                      />
                                    </Tooltip>
                                  ))}
                                </Stack>
                              ) : (
                                <Chip size="small" label="No issues" color="success" />
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Orders Pending Approval
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  All orders in this campaign have been reviewed
                </Typography>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {/* Rate Discrepancies */}
            {rateDiscrepancies.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Order</TableCell>
                      <TableCell>Show</TableCell>
                      <TableCell>Placement</TableCell>
                      <TableCell>Air Date</TableCell>
                      <TableCell align="right">Expected Rate</TableCell>
                      <TableCell align="right">Actual Rate</TableCell>
                      <TableCell align="right">Discrepancy</TableCell>
                      <TableCell>Severity</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rateDiscrepancies.map((disc, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {disc.orderNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {disc.showName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {disc.placementType} ({disc.length}s)
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(disc.airDate).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            ${disc.expectedRate.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            ${disc.actualRate.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={disc.discrepancy > 0 ? 'success.main' : 'error.main'}
                            fontWeight="medium"
                          >
                            {disc.discrepancy > 0 ? '+' : ''}${disc.discrepancy.toFixed(2)}
                            <Typography variant="caption" display="block">
                              ({disc.discrepancyPercentage > 0 ? '+' : ''}{disc.discrepancyPercentage.toFixed(1)}%)
                            </Typography>
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={disc.severity}
                            color={getDiscrepancySeverityColor(disc.severity)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Rate Discrepancies
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  All rates match the expected pricing structure
                </Typography>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {/* Approval History */}
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Info sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Approval History
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Feature coming soon - track all approval decisions and changes
              </Typography>
            </Box>
          </TabPanel>
        </Paper>

        {/* Approve Orders Dialog */}
        <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Approve Selected Orders</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              You are about to approve {selectedOrders.length} order(s).
            </Typography>
            
            {rateDiscrepancies.some(d => selectedOrders.some(id => d.orderId === id)) && (
              <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
                Some selected orders have rate discrepancies. Review carefully before approving.
              </Alert>
            )}

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Approval Notes (optional)"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              margin="normal"
              placeholder="Add any notes about this approval..."
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={overrideDiscrepancies}
                  onChange={(e) => setOverrideDiscrepancies(e.target.checked)}
                />
              }
              label="Override rate discrepancies (required if high discrepancies exist)"
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleApproveOrders}
            >
              Approve Orders
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reject Orders Dialog */}
        <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Reject Selected Orders</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              You are about to reject {selectedOrders.length} order(s). They will be returned to draft status.
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Rejection Reason"
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              margin="normal"
              placeholder="Explain why these orders are being rejected..."
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleRejectOrders}
              disabled={!rejectionNotes.trim()}
            >
              Reject Orders
            </Button>
          </DialogActions>
        </Dialog>

        {/* Campaign Approval Dialog */}
        <Dialog open={campaignApproveDialogOpen} onClose={() => setCampaignApproveDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Approve Entire Campaign</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              This will approve the campaign and all pending orders. Are you sure?
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Campaign Approval Notes"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              margin="normal"
              placeholder="Add notes about this campaign approval..."
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={overrideDiscrepancies}
                  onChange={(e) => setOverrideDiscrepancies(e.target.checked)}
                />
              }
              label="Override all rate discrepancies"
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCampaignApproveDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleApproveCampaign}
            >
              Approve Campaign
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}