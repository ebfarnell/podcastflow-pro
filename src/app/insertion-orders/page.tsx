'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
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
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  SelectChangeEvent,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  Add,
  Search,
  FilterList,
  MoreVert,
  Edit,
  Visibility,
  Delete,
  Download,
  ContentCopy,
  CheckCircle,
  Warning,
  Schedule,
  Cancel,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ReportExportModal } from '@/components/reports/ReportExportModal'
import { PDFExporter } from '@/utils/export/pdf-exporter'
import { createChartCanvas } from '@/utils/export/chart-utils'
import { exportToCSV, exportToJSON } from '@/utils/export'

interface InsertionOrder {
  id: string
  number: string
  advertiser: string
  agency: string
  campaign: string
  startDate: string
  endDate: string
  budget: number
  spent: number
  status: 'active' | 'pending' | 'completed' | 'cancelled'
  impressions: number
  targetImpressions: number
  shows: string[]
}

// Removed mock data - now fetching from database

const statusConfig = {
  active: { color: 'success' as const, icon: <CheckCircle fontSize="small" /> },
  pending: { color: 'warning' as const, icon: <Schedule fontSize="small" /> },
  completed: { color: 'default' as const, icon: <CheckCircle fontSize="small" /> },
  cancelled: { color: 'error' as const, icon: <Cancel fontSize="small" /> },
}

export default function InsertionOrdersPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedOrder, setSelectedOrder] = useState<InsertionOrder | null>(null)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Fetch insertion orders from database
  const { data: ordersData, isLoading, error, refetch } = useQuery({
    queryKey: ['insertion-orders', statusFilter, searchQuery, page, rowsPerPage],
    queryFn: async () => {
      const params: any = {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      }
      
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }
      
      if (searchQuery) {
        params.search = searchQuery
      }
      
      const response = await api.get('/orders', { params })
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const orders = ordersData?.orders || []
  const totalCount = ordersData?.total || 0

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, order: InsertionOrder) => {
    setAnchorEl(event.currentTarget)
    setSelectedOrder(order)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleDelete = async () => {
    if (selectedOrder) {
      try {
        await api.delete(`/orders/${selectedOrder.id}`)
        await refetch()
        setDeleteDialog(false)
        setSelectedOrder(null)
        handleMenuClose()
      } catch (error) {
        console.error('Error deleting order:', error)
        alert('Failed to delete order. Please try again.')
      }
    }
  }

  const handleExport = async (format: string, settings: any) => {
    try {
      if (format === 'pdf') {
        const exporter = new PDFExporter({
          title: 'Insertion Orders Report',
          subtitle: `Generated on ${new Date().toLocaleDateString()}`,
          orientation: settings.orientation || 'landscape'
        })

        // Calculate summary metrics
        const activeOrders = filteredOrders.filter(o => o.status === 'active')
        const totalBudget = filteredOrders.reduce((sum, o) => sum + o.budget, 0)
        const totalSpent = filteredOrders.reduce((sum, o) => sum + o.spent, 0)
        const totalImpressions = filteredOrders.reduce((sum, o) => sum + o.impressions, 0)
        const totalTargetImpressions = filteredOrders.reduce((sum, o) => sum + o.targetImpressions, 0)

        if (settings.includeSummary) {
          exporter.addSummarySection([
            { label: 'Total Orders', value: filteredOrders.length },
            { label: 'Active Orders', value: activeOrders.length },
            { label: 'Total Budget', value: `$${totalBudget.toLocaleString()}` },
            { label: 'Revenue Realized', value: `$${totalSpent.toLocaleString()}` },
            { label: 'Budget Utilization', value: `${((totalSpent / totalBudget) * 100).toFixed(1)}%` },
            { label: 'Impressions Delivered', value: totalImpressions.toLocaleString() },
            { label: 'Target Impressions', value: totalTargetImpressions.toLocaleString() },
            { label: 'Delivery Rate', value: `${((totalImpressions / totalTargetImpressions) * 100).toFixed(1)}%` }
          ])
        }

        if (settings.includeCharts) {
          // Status distribution chart
          const statusCounts = filteredOrders.reduce((acc: any, o) => {
            acc[o.status] = (acc[o.status] || 0) + 1
            return acc
          }, {})

          const statusChart = await createChartCanvas('doughnut', {
            labels: Object.keys(statusCounts).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
            datasets: [{
              data: Object.values(statusCounts),
              backgroundColor: ['#4caf50', '#ff9800', '#9e9e9e', '#f44336']
            }]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Order Status Distribution'
              }
            }
          })
          await exporter.addChart(statusChart)

          // Budget allocation by advertiser
          const advertiserBudgets = filteredOrders.reduce((acc: any, o) => {
            acc[o.advertiser] = (acc[o.advertiser] || 0) + o.budget
            return acc
          }, {})
          const topAdvertisers = Object.entries(advertiserBudgets)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 6)

          const advertiserChart = await createChartCanvas('bar', {
            labels: topAdvertisers.map(([name]) => name),
            datasets: [{
              label: 'Budget Allocation',
              data: topAdvertisers.map(([, budget]) => budget),
              backgroundColor: '#1976d2'
            }]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Top Advertisers by Budget'
              }
            }
          })
          await exporter.addChart(advertiserChart)

          // Monthly order distribution
          const monthlyData = filteredOrders.reduce((acc: any, o) => {
            const month = new Date(o.startDate).toLocaleString('default', { month: 'short' })
            acc[month] = (acc[month] || 0) + 1
            return acc
          }, {})

          const monthlyChart = await createChartCanvas('line', {
            labels: Object.keys(monthlyData),
            datasets: [{
              label: 'Orders by Month',
              data: Object.values(monthlyData),
              borderColor: '#dc004e',
              backgroundColor: 'rgba(220, 0, 78, 0.1)',
              tension: 0.4
            }]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Order Volume Trend'
              }
            }
          })
          await exporter.addChart(monthlyChart)
        }

        if (settings.includeRawData) {
          // Detailed order table
          const tableData = filteredOrders.map(order => [
            order.number,
            order.advertiser,
            order.agency,
            order.campaign,
            new Date(order.startDate).toLocaleDateString(),
            new Date(order.endDate).toLocaleDateString(),
            `$${order.budget.toLocaleString()}`,
            `$${order.spent.toLocaleString()}`,
            `${getProgressPercentage(order)}%`,
            order.status.charAt(0).toUpperCase() + order.status.slice(1)
          ])

          exporter.addTable(
            ['Order #', 'Advertiser', 'Agency', 'Campaign', 'Start', 'End', 'Budget', 'Spent', 'Progress', 'Status'],
            tableData,
            'Insertion Order Details'
          )

          // Show allocation table
          const showAllocation = filteredOrders.map(order => [
            order.number,
            order.campaign,
            order.shows.join(', '),
            order.targetImpressions.toLocaleString(),
            order.impressions.toLocaleString(),
            `${getProgressPercentage(order)}%`
          ])

          exporter.addTable(
            ['Order #', 'Campaign', 'Shows', 'Target Impressions', 'Delivered', 'Progress'],
            showAllocation,
            'Show Allocation & Performance'
          )
        }

        exporter.addFooter('PodcastFlow Pro - Insertion Order Management')
        await exporter.save(`insertion-orders-${new Date().toISOString().split('T')[0]}.pdf`)
      }
      else if (format === 'csv') {
        const csvData = [
          ['Insertion Orders Report', new Date().toLocaleDateString()],
          [],
          ['Order Number', 'Advertiser', 'Agency', 'Campaign', 'Start Date', 'End Date', 'Budget', 'Spent', 'Status', 'Shows', 'Target Impressions', 'Delivered Impressions', 'Progress'],
          ...filteredOrders.map(order => [
            order.number,
            order.advertiser,
            order.agency,
            order.campaign,
            order.startDate,
            order.endDate,
            order.budget,
            order.spent,
            order.status,
            order.shows.join('; '),
            order.targetImpressions,
            order.impressions,
            `${getProgressPercentage(order)}%`
          ])
        ]
        
        exportToCSV(csvData, `insertion-orders-${new Date().toISOString().split('T')[0]}.csv`)
      }
      else if (format === 'json') {
        const jsonData = {
          generatedAt: new Date().toISOString(),
          summary: {
            totalOrders: filteredOrders.length,
            activeOrders: filteredOrders.filter(o => o.status === 'active').length,
            totalBudget: filteredOrders.reduce((sum, o) => sum + o.budget, 0),
            totalSpent: filteredOrders.reduce((sum, o) => sum + o.spent, 0),
            totalImpressions: filteredOrders.reduce((sum, o) => sum + o.impressions, 0)
          },
          orders: filteredOrders.map(order => ({
            ...order,
            progress: getProgressPercentage(order)
          }))
        }
        
        exportToJSON(jsonData, `insertion-orders-${new Date().toISOString().split('T')[0]}.json`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      throw error
    }
  }

  const handleDuplicate = (order: InsertionOrder) => {
    const newOrder = {
      ...order,
      id: (orders.length + 1).toString(),
      number: `IO-2024-${String(orders.length + 1).padStart(3, '0')}`,
      status: 'pending' as const,
      spent: 0,
      impressions: 0
    }
    setOrders([...orders, newOrder])
  }

  const handleDownloadPDF = async (order: InsertionOrder) => {
    try {
      const exporter = new PDFExporter({
        title: `Insertion Order: ${order.number}`,
        subtitle: `${order.advertiser} - ${order.campaign}`,
        orientation: 'portrait'
      })

      // Order details summary
      exporter.addSummarySection([
        { label: 'Order Number', value: order.number },
        { label: 'Status', value: order.status.charAt(0).toUpperCase() + order.status.slice(1) },
        { label: 'Total Budget', value: `$${order.budget.toLocaleString()}` },
        { label: 'Amount Spent', value: `$${order.spent.toLocaleString()}` }
      ])

      // Order information table
      exporter.addTable(
        ['Field', 'Value'],
        [
          ['Advertiser', order.advertiser],
          ['Agency', order.agency],
          ['Campaign Name', order.campaign],
          ['Start Date', new Date(order.startDate).toLocaleDateString()],
          ['End Date', new Date(order.endDate).toLocaleDateString()],
          ['Duration', `${Math.ceil((new Date(order.endDate).getTime() - new Date(order.startDate).getTime()) / (1000 * 60 * 60 * 24))} days`],
          ['Shows', order.shows.join(', ')],
          ['Target Impressions', order.targetImpressions.toLocaleString()],
          ['Delivered Impressions', order.impressions.toLocaleString()],
          ['Delivery Progress', `${getProgressPercentage(order)}%`]
        ],
        'Order Details'
      )

      // Performance metrics
      if (order.impressions > 0) {
        const performanceChart = await createChartCanvas('bar', {
          labels: ['Target', 'Delivered'],
          datasets: [{
            label: 'Impressions',
            data: [order.targetImpressions, order.impressions],
            backgroundColor: ['#9c27b0', '#4caf50']
          }]
        }, {
          plugins: {
            title: {
              display: true,
              text: 'Impression Delivery Performance'
            }
          }
        })
        await exporter.addChart(performanceChart)
      }

      // Budget utilization chart
      const budgetChart = await createChartCanvas('doughnut', {
        labels: ['Spent', 'Remaining'],
        datasets: [{
          data: [order.spent, order.budget - order.spent],
          backgroundColor: ['#1976d2', '#e0e0e0']
        }]
      }, {
        plugins: {
          title: {
            display: true,
            text: 'Budget Utilization'
          }
        }
      })
      await exporter.addChart(budgetChart)

      // Terms and conditions section
      exporter.addPageBreak()
      exporter.addTable(
        ['Terms & Conditions'],
        [
          ['Payment Terms: Net 30 days from invoice date'],
          ['Cancellation Policy: 14 days written notice required'],
          ['Performance Guarantee: Best effort delivery of target impressions'],
          ['Reporting: Weekly performance reports provided'],
          ['Ad Approval: All creative must be approved before campaign start']
        ],
        'Standard Terms'
      )

      exporter.addFooter('This is a legally binding insertion order. PodcastFlow Pro © 2024')
      await exporter.save(`${order.number}.pdf`)
    } catch (error) {
      console.error('PDF generation failed:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.advertiser.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.campaign.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getProgressPercentage = (order: InsertionOrder) => {
    return Math.round((order.impressions / order.targetImpressions) * 100)
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Insertion Orders
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and track all insertion orders and campaign commitments
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => router.push('/insertion-orders/new')}
          >
            Create New Order
          </Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Active Orders
                </Typography>
                <Typography variant="h4">
                  {orders.filter(o => o.status === 'active').length}
                </Typography>
                <Typography variant="body2" color="success.main">
                  ${orders.filter(o => o.status === 'active').reduce((sum, o) => sum + o.budget, 0).toLocaleString()} total value
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Pending Approval
                </Typography>
                <Typography variant="h4">
                  {orders.filter(o => o.status === 'pending').length}
                </Typography>
                <Typography variant="body2" color="warning.main">
                  Awaiting confirmation
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Budget
                </Typography>
                <Typography variant="h4">
                  ${orders.reduce((sum, o) => sum + o.budget, 0).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Across all orders
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Revenue Realized
                </Typography>
                <Typography variant="h4">
                  ${orders.reduce((sum, o) => sum + o.spent, 0).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="primary.main">
                  {Math.round((orders.reduce((sum, o) => sum + o.spent, 0) / orders.reduce((sum, o) => sum + o.budget, 0)) * 100)}% of total
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, maxWidth: 400 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={statusFilter}
                onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
            >
              More Filters
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => setExportModalOpen(true)}
            >
              Export
            </Button>
          </Box>
        </Paper>

        {/* Orders Table */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load insertion orders. Please try again later.
          </Alert>
        ) : orders.length === 0 ? (
          <Alert severity="info">
            No insertion orders found. Click "New Order" to create your first order.
          </Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order Number</TableCell>
                  <TableCell>Advertiser / Agency</TableCell>
                  <TableCell>Campaign</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Budget</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((order) => {
                  const progress = getProgressPercentage(order)
                  const statusCfg = statusConfig[order.status]
                  
                  return (
                    <TableRow 
                      key={order.id} 
                      hover 
                      sx={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/insertion-orders/${order.id}`)}
                    >
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {order.number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{order.advertiser}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.agency}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{order.campaign}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.shows.join(', ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(order.startDate).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          to {new Date(order.endDate).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          ${order.budget.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ${order.spent.toLocaleString()} spent
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="caption">{progress}%</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {order.impressions.toLocaleString()} / {order.targetImpressions.toLocaleString()}
                              </Typography>
                            </Box>
                            <Box sx={{ 
                              width: '100%', 
                              height: 6, 
                              bgcolor: 'grey.200', 
                              borderRadius: 1,
                              overflow: 'hidden'
                            }}>
                              <Box sx={{ 
                                width: `${progress}%`, 
                                height: '100%', 
                                bgcolor: progress >= 80 ? 'success.main' : 'primary.main',
                                transition: 'width 0.3s ease'
                              }} />
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={statusCfg.icon}
                          label={order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          color={statusCfg.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMenuOpen(e, order)
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10))
              setPage(0)
            }}
          />
          </TableContainer>
        )}

        {/* Action Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => {
            router.push(`/insertion-orders/${selectedOrder?.id}`)
            handleMenuClose()
          }}>
            <Visibility fontSize="small" sx={{ mr: 1 }} />
            View Details
          </MenuItem>
          <MenuItem onClick={() => {
            router.push(`/insertion-orders/${selectedOrder?.id}/edit`)
            handleMenuClose()
          }}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit Order
          </MenuItem>
          <MenuItem onClick={() => {
            if (selectedOrder) handleDuplicate(selectedOrder)
            handleMenuClose()
          }}>
            <ContentCopy fontSize="small" sx={{ mr: 1 }} />
            Duplicate Order
          </MenuItem>
          <MenuItem onClick={() => {
            if (selectedOrder) handleDownloadPDF(selectedOrder)
            handleMenuClose()
          }}>
            <Download fontSize="small" sx={{ mr: 1 }} />
            Download PDF
          </MenuItem>
          <MenuItem 
            onClick={() => {
              setDeleteDialog(true)
              handleMenuClose()
            }}
            sx={{ color: 'error.main' }}
          >
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete Order
          </MenuItem>
        </Menu>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
          <DialogTitle>Delete Insertion Order?</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete order {selectedOrder?.number}? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        <ReportExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          title="Export Insertion Orders"
          onExport={handleExport}
          availableFormats={['pdf', 'csv', 'json']}
          defaultFormat="pdf"
        />
      </Box>
    </DashboardLayout>
  )
}