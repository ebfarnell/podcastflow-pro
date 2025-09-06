'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
} from '@mui/material'
import {
  Edit,
  MoreVert,
  Download,
  Share,
  Email,
  Campaign,
  TrendingUp,
  AttachMoney,
  Visibility,
  Schedule,
  CalendarMonth,
  CheckCircle,
  Warning,
  Cancel,
  PlayArrow,
  Pause,
  Stop,
  Person,
  Business,
  Phone,
  LocationOn,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

interface InsertionOrder {
  id: string
  number: string
  advertiser: string
  agency?: string
  campaign: string
  startDate: string
  endDate: string
  budget: number
  spent: number
  status: 'active' | 'pending' | 'completed' | 'cancelled'
  impressions: number
  targetImpressions: number
  shows: string[]
  contactName: string
  contactEmail: string
  contactPhone: string
  billingContact: string
  poNumber: string
  createdDate: string
  lastModified: string
}

interface AdPlacement {
  id: string
  show: string
  episodeTitle: string
  episodeDate: string
  position: 'pre-roll' | 'mid-roll' | 'post-roll' | 'host-read'
  duration: string
  rate: number
  actualListeners: number
  status: 'scheduled' | 'aired' | 'cancelled'
  adCopyId?: string
}

interface Campaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed'
  budget: number
  spent: number
  startDate: string
  endDate: string
}

const mockOrder: InsertionOrder = {
  id: '1',
  number: 'IO-2024-001',
  advertiser: 'TechCorp Inc.',
  agency: 'Digital Media Agency',
  campaign: 'Q4 Product Launch',
  startDate: '2024-10-01',
  endDate: '2024-12-31',
  budget: 150000,
  spent: 87500,
  status: 'active',
  impressions: 1250000,
  targetImpressions: 2000000,
  shows: ['Tech Review Show', 'Digital Trends Daily'],
  contactName: 'Sarah Johnson',
  contactEmail: 'sarah@techcorp.com',
  contactPhone: '+1 (555) 123-4567',
  billingContact: 'accounts@techcorp.com',
  poNumber: 'PO-2024-TechCorp-Q4',
  createdDate: '2024-09-15',
  lastModified: '2024-01-08',
}

const mockPlacements: AdPlacement[] = [
  {
    id: '1',
    show: 'Tech Review Show',
    episodeTitle: 'AI Revolution in 2024',
    episodeDate: '2024-01-09',
    position: 'mid-roll',
    duration: '60s',
    rate: 2500,
    actualListeners: 92000,
    status: 'aired',
    adCopyId: 'AC-001',
  },
  {
    id: '2',
    show: 'Digital Trends Daily',
    episodeTitle: 'CES 2024 Highlights',
    episodeDate: '2024-01-16',
    position: 'pre-roll',
    duration: '30s',
    rate: 1800,
    actualListeners: 0,
    status: 'scheduled',
    adCopyId: 'AC-002',
  },
  {
    id: '3',
    show: 'Tech Review Show',
    episodeTitle: 'Future of Electric Vehicles',
    episodeDate: '2024-01-02',
    position: 'host-read',
    duration: '90s',
    rate: 3200,
    actualListeners: 88500,
    status: 'aired',
  },
]

const performanceData = [
  { date: '2024-01-01', impressions: 85000, spent: 2100 },
  { date: '2024-01-02', impressions: 88500, spent: 3200 },
  { date: '2024-01-03', impressions: 76000, spent: 1950 },
  { date: '2024-01-04', impressions: 91000, spent: 2800 },
  { date: '2024-01-05', impressions: 89000, spent: 2600 },
  { date: '2024-01-06', impressions: 92000, spent: 2500 },
  { date: '2024-01-07', impressions: 87000, spent: 2400 },
]

export default function InsertionOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [selectedTab, setSelectedTab] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [statusDialog, setStatusDialog] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const orderId = params.id as string

  // Deletion request mutation
  const requestDeletionMutation = useMutation({
    mutationFn: async () => {
      console.log('🚀 Requesting deletion for order:', { 
        id: orderId, 
        number: mockOrder?.number,
        entityType: 'order'
      })
      
      const payload = {
        entityType: 'order',
        entityId: orderId,
        entityName: mockOrder.number,
        reason: 'User requested deletion from order details page'
      }
      
      console.log('📤 Sending deletion request payload:', payload)
      
      const response = await fetch('/api/deletion-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      
      const responseData = await response.json()
      
      if (!response.ok) {
        console.error('❌ Deletion request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: responseData
        })
        throw new Error(responseData.error || 'Failed to request deletion')
      }
      
      console.log('✅ Deletion request created successfully:', responseData)
      return responseData
    },
    onSuccess: (data) => {
      console.log('✅ Deletion request mutation success:', data)
      // Invalidate both the individual order and the orders list
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['post-sale-orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['post-sale-dashboard'] })
      setDeleteDialogOpen(false)
      // Redirect to Post-Sale Management orders tab
      router.push('/post-sale?tab=orders')
    },
    onError: (error: any) => {
      console.error('❌ Failed to request deletion:', error)
      alert(`Failed to request deletion: ${error.message}`)
    }
  })

  const handleEdit = () => {
    router.push(`/insertion-orders/${orderId}/edit`)
    setAnchorEl(null)
  }

  const handleRequestDeletion = () => {
    setDeleteDialogOpen(true)
  }

  const confirmRequestDeletion = () => {
    requestDeletionMutation.mutate()
  }

  const handleDownload = () => {
    // Simulate PDF generation
    const content = `Insertion Order: ${mockOrder.number}\nAdvertiser: ${mockOrder.advertiser}\nCampaign: ${mockOrder.campaign}\nBudget: $${mockOrder.budget.toLocaleString()}\nStatus: ${mockOrder.status}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mockOrder.number}-summary.txt`
    a.click()
    window.URL.revokeObjectURL(url)
    setAnchorEl(null)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Order link copied to clipboard!')
    setAnchorEl(null)
  }

  const handleStatusChange = () => {
    alert(`Status updated to: ${newStatus}`)
    setStatusDialog(false)
    setAnchorEl(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'pending': return 'warning'
      case 'completed': return 'default'
      case 'cancelled': return 'error'
      default: return 'default'
    }
  }

  const getPlacementStatusColor = (status: string) => {
    switch (status) {
      case 'aired': return 'success'
      case 'scheduled': return 'info'
      case 'cancelled': return 'error'
      default: return 'default'
    }
  }

  const getPlacementStatusIcon = (status: string) => {
    switch (status) {
      case 'aired': return <CheckCircle fontSize="small" />
      case 'scheduled': return <Schedule fontSize="small" />
      case 'cancelled': return <Cancel fontSize="small" />
      default: return <Schedule fontSize="small" />
    }
  }

  const calculateProgress = () => {
    return Math.round((mockOrder.spent / mockOrder.budget) * 100)
  }

  const calculateImpressionProgress = () => {
    return Math.round((mockOrder.impressions / mockOrder.targetImpressions) * 100)
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {mockOrder.number}
            </Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {mockOrder.campaign}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip 
                label={mockOrder.status} 
                color={getStatusColor(mockOrder.status)} 
                size="small" 
              />
              <Chip 
                label={mockOrder.advertiser} 
                variant="outlined" 
                size="small" 
              />
              {mockOrder.agency && (
                <Chip 
                  label={`via ${mockOrder.agency}`} 
                  variant="outlined" 
                  size="small" 
                />
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<Email />}>
              Send Update
            </Button>
            <Button variant="outlined" startIcon={<Edit />} onClick={handleEdit}>
              Edit Order
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleRequestDeletion}
            >
              Request Deletion
            </Button>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <MoreVert />
            </IconButton>
          </Box>
        </Box>

        {/* Key Metrics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <AttachMoney color="primary" />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography color="text.secondary" variant="body2">
                      Budget Progress
                    </Typography>
                    <Typography variant="h6">
                      ${mockOrder.spent.toLocaleString()} / ${mockOrder.budget.toLocaleString()}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={calculateProgress()}
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {calculateProgress()}% spent
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
                  <Visibility color="info" />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography color="text.secondary" variant="body2">
                      Impressions
                    </Typography>
                    <Typography variant="h6">
                      {mockOrder.impressions.toLocaleString()}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={calculateImpressionProgress()}
                      color="info"
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {calculateImpressionProgress()}% of target
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
                  <Schedule color="warning" />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Campaign Duration
                    </Typography>
                    <Typography variant="h6">
                      {Math.ceil((new Date(mockOrder.endDate).getTime() - new Date(mockOrder.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(mockOrder.startDate).toLocaleDateString()} - {new Date(mockOrder.endDate).toLocaleDateString()}
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
                  <Campaign color="success" />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Placements
                    </Typography>
                    <Typography variant="h6">
                      {mockPlacements.filter(p => p.status === 'aired').length} / {mockPlacements.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Aired / Total
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={selectedTab} onChange={(e, value) => setSelectedTab(value)}>
            <Tab label="Overview" />
            <Tab label="Placements" />
            <Tab label="Performance" />
            <Tab label="Details" />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        {selectedTab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Campaign Performance
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#8884d8" name="Impressions" />
                    <Line yAxisId="right" type="monotone" dataKey="spent" stroke="#82ca9d" name="Spent ($)" />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Contact Information
                </Typography>
                <List dense>
                  <ListItem disableGutters>
                    <ListItemIcon>
                      <Person />
                    </ListItemIcon>
                    <ListItemText
                      primary={mockOrder.contactName}
                      secondary="Primary Contact"
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemIcon>
                      <Email />
                    </ListItemIcon>
                    <ListItemText
                      primary={mockOrder.contactEmail}
                      secondary="Email"
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemIcon>
                      <Phone />
                    </ListItemIcon>
                    <ListItemText
                      primary={mockOrder.contactPhone}
                      secondary="Phone"
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemIcon>
                      <Business />
                    </ListItemIcon>
                    <ListItemText
                      primary={mockOrder.billingContact}
                      secondary="Billing Contact"
                    />
                  </ListItem>
                </List>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Next Actions:</strong> 2 upcoming placements scheduled for this week. Review ad copy approval status.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        )}

        {selectedTab === 1 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6">Ad Placements</Typography>
                  <Button variant="contained" onClick={() => router.push('/ad-copy')}>
                    Manage Ad Copy
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Show / Episode</TableCell>
                        <TableCell>Air Date</TableCell>
                        <TableCell>Position</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Rate</TableCell>
                        <TableCell>Listeners</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {mockPlacements.map((placement) => (
                        <TableRow key={placement.id} hover>
                          <TableCell>
                            <Typography variant="subtitle2">{placement.show}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {placement.episodeTitle}
                            </Typography>
                          </TableCell>
                          <TableCell>{new Date(placement.episodeDate).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Chip label={placement.position} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>{placement.duration}</TableCell>
                          <TableCell>${placement.rate.toLocaleString()}</TableCell>
                          <TableCell>
                            {placement.actualListeners > 0 
                              ? placement.actualListeners.toLocaleString() 
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={getPlacementStatusIcon(placement.status)}
                              label={placement.status}
                              size="small"
                              color={getPlacementStatusColor(placement.status)}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => router.push(`/episodes/${placement.id}`)}>
                              <Visibility />
                            </IconButton>
                            {placement.adCopyId && (
                              <IconButton size="small" onClick={() => router.push(`/ad-copy/${placement.adCopyId}`)}>
                                <PlayArrow />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        )}

        {selectedTab === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Daily Impressions
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="impressions" fill="#8884d8" name="Impressions" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Daily Spend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="spent" fill="#82ca9d" name="Spent ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        )}

        {selectedTab === 3 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Order Details
                </Typography>
                <Typography><strong>Order Number:</strong> {mockOrder.number}</Typography>
                <Typography><strong>PO Number:</strong> {mockOrder.poNumber}</Typography>
                <Typography><strong>Created:</strong> {new Date(mockOrder.createdDate).toLocaleDateString()}</Typography>
                <Typography><strong>Last Modified:</strong> {new Date(mockOrder.lastModified).toLocaleDateString()}</Typography>
                <Typography><strong>Target Shows:</strong> {mockOrder.shows.join(', ')}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Financial Summary
                </Typography>
                <Typography><strong>Total Budget:</strong> ${mockOrder.budget.toLocaleString()}</Typography>
                <Typography><strong>Amount Spent:</strong> ${mockOrder.spent.toLocaleString()}</Typography>
                <Typography><strong>Remaining:</strong> ${(mockOrder.budget - mockOrder.spent).toLocaleString()}</Typography>
                <Typography><strong>Average CPM:</strong> ${((mockOrder.spent / mockOrder.impressions) * 1000).toFixed(2)}</Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Action Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={handleEdit}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit Order
          </MenuItem>
          <MenuItem onClick={() => { setStatusDialog(true); setAnchorEl(null); }}>
            <Pause fontSize="small" sx={{ mr: 1 }} />
            Change Status
          </MenuItem>
          <MenuItem onClick={handleDownload}>
            <Download fontSize="small" sx={{ mr: 1 }} />
            Download Report
          </MenuItem>
          <MenuItem onClick={handleShare}>
            <Share fontSize="small" sx={{ mr: 1 }} />
            Share Order
          </MenuItem>
        </Menu>

        {/* Status Change Dialog */}
        <Dialog open={statusDialog} onClose={() => setStatusDialog(false)}>
          <DialogTitle>Change Order Status</DialogTitle>
          <DialogContent>
            <TextField
              select
              fullWidth
              label="New Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              margin="normal"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleStatusChange}>
              Update Status
            </Button>
          </DialogActions>
        </Dialog>

        {/* Deletion Request Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Request Order Deletion</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to request deletion of order "{mockOrder?.number}"? 
              This will submit a deletion request that requires admin approval before the order is permanently removed.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmRequestDeletion} 
              color="error" 
              variant="contained"
              disabled={requestDeletionMutation.isPending}
            >
              {requestDeletionMutation.isPending ? 'Submitting...' : 'Request Deletion'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}