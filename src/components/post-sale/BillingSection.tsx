import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
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
  Skeleton,
  Tabs,
  Tab,
  LinearProgress,
} from '@mui/material'
import {
  AttachMoney,
  Receipt,
  Schedule,
  TrendingUp,
  Add,
  Edit,
  Send,
  Download,
  FilterList,
  Refresh,
  Payment,
  AccountBalanceWallet,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'

interface Invoice {
  id: string
  invoiceNumber: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  issueDate: string
  dueDate: string
  campaign?: { id: string; name: string }
  advertiser?: { id: string; name: string }
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

export default function BillingSection() {
  const [selectedTab, setSelectedTab] = useState(0)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [dateRange, setDateRange] = useState('thisMonth')
  
  const [newInvoice, setNewInvoice] = useState({
    advertiserId: '',
    campaignId: '',
    agencyId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }]
  })

  const queryClient = useQueryClient()

  // Fetch billing data
  const { data: billingData, isLoading, error, refetch } = useQuery({
    queryKey: ['billing-data', filterStatus, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateRange,
        ...(filterStatus !== 'all' && { status: filterStatus })
      })
      
      const response = await fetch(`/api/financials/invoices?${params}`, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch billing data')
      }
      
      return response.json()
    }
  })

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (invoiceData: any) => {
      const response = await fetch('/api/financials/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(invoiceData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create invoice')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-data'] })
      setCreateDialogOpen(false)
      resetNewInvoice()
    }
  })

  const resetNewInvoice = () => {
    setNewInvoice({
      advertiserId: '',
      campaignId: '',
      agencyId: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: '',
      items: [{ description: '', quantity: 1, rate: 0, amount: 0 }]
    })
  }

  const addInvoiceItem = () => {
    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, rate: 0, amount: 0 }]
    }))
  }

  const updateInvoiceItem = (index: number, field: string, value: any) => {
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updated = { ...item, [field]: value }
          if (field === 'quantity' || field === 'rate') {
            updated.amount = updated.quantity * updated.rate
          }
          return updated
        }
        return item
      })
    }))
  }

  const invoices = billingData?.invoices || []
  const summary = billingData?.summary || {
    totalInvoiced: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    count: 0
  }

  // Calculate stats for summary cards
  const stats = [
    {
      label: 'Pending Invoices',
      value: invoices.filter((inv: Invoice) => inv.status === 'sent' || inv.status === 'overdue').length,
      icon: <Schedule />,
      color: 'warning'
    },
    {
      label: 'This Month Revenue',
      value: `$${summary.totalPaid.toLocaleString()}`,
      icon: <AttachMoney />,
      color: 'success'
    },
    {
      label: 'Outstanding',
      value: `$${summary.totalOutstanding.toLocaleString()}`,
      icon: <Receipt />,
      color: 'error'
    },
    {
      label: 'Total Invoiced',
      value: `$${summary.totalInvoiced.toLocaleString()}`,
      icon: <TrendingUp />,
      color: 'primary'
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success'
      case 'sent': return 'info'
      case 'overdue': return 'error'
      case 'draft': return 'default'
      case 'cancelled': return 'default'
      default: return 'default'
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Billing & Invoicing
        </Typography>
        <Stack direction="row" spacing={2}>
          <Tooltip title="Refresh data">
            <IconButton onClick={() => refetch()}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Invoice
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load billing data. Please try refreshing.
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h5">
                      {isLoading ? <Skeleton width={60} /> : stat.value}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {stat.label}
                    </Typography>
                  </Box>
                  <Box sx={{ color: `${stat.color}.main` }}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterList />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="sent">Sent</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={dateRange}
              label="Period"
              onChange={(e) => setDateRange(e.target.value)}
            >
              <MenuItem value="thisMonth">This Month</MenuItem>
              <MenuItem value="lastMonth">Last Month</MenuItem>
              <MenuItem value="thisQuarter">This Quarter</MenuItem>
              <MenuItem value="thisYear">This Year</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={selectedTab}
          onChange={(_, newValue) => setSelectedTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Invoices" icon={<Receipt />} iconPosition="start" />
          <Tab label="Payments" icon={<Payment />} iconPosition="start" />
          <Tab label="Reports" icon={<TrendingUp />} iconPosition="start" />
        </Tabs>

        <TabPanel value={selectedTab} index={0}>
          {isLoading && <LinearProgress />}
          
          {/* Invoices Table */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Campaign</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice: Invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.advertiser?.name || 'N/A'}</TableCell>
                    <TableCell>{invoice.campaign?.name || 'N/A'}</TableCell>
                    <TableCell>${invoice.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={invoice.status}
                        color={getStatusColor(invoice.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Edit">
                          <IconButton size="small">
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Send">
                          <IconButton size="small">
                            <Send />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download">
                          <IconButton size="small">
                            <Download />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="textSecondary">
                        No invoices found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={selectedTab} index={1}>
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Payment sx={{ fontSize: 64, color: 'text.secondary' }} />
            <Typography variant="h6" gutterBottom>
              Payment Tracking
            </Typography>
            <Typography color="textSecondary">
              Payment tracking and processing features will be available here.
            </Typography>
          </Box>
        </TabPanel>

        <TabPanel value={selectedTab} index={2}>
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <TrendingUp sx={{ fontSize: 64, color: 'text.secondary' }} />
            <Typography variant="h6" gutterBottom>
              Billing Reports
            </Typography>
            <Typography color="textSecondary">
              Revenue reports, aging reports, and billing analytics will be available here.
            </Typography>
          </Box>
        </TabPanel>
      </Paper>

      {/* Create Invoice Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Invoice</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Advertiser ID"
                  value={newInvoice.advertiserId}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, advertiserId: e.target.value }))}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Campaign ID"
                  value={newInvoice.campaignId}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, campaignId: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Issue Date"
                  type="date"
                  value={newInvoice.issueDate}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, issueDate: e.target.value }))}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Due Date"
                  type="date"
                  value={newInvoice.dueDate}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            <Typography variant="h6">Invoice Items</Typography>
            {newInvoice.items.map((item, index) => (
              <Grid container spacing={2} key={index}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Description"
                    value={item.description}
                    onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Quantity"
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateInvoiceItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Rate"
                    type="number"
                    value={item.rate}
                    onChange={(e) => updateInvoiceItem(index, 'rate', parseFloat(e.target.value) || 0)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Amount"
                    type="number"
                    value={item.amount}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                </Grid>
              </Grid>
            ))}
            
            <Button onClick={addInvoiceItem} startIcon={<Add />}>
              Add Item
            </Button>

            <TextField
              label="Notes"
              value={newInvoice.notes}
              onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
              multiline
              rows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => createInvoiceMutation.mutate(newInvoice)}
            variant="contained"
            disabled={createInvoiceMutation.isPending}
          >
            Create Invoice
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Messages */}
      {createInvoiceMutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to create invoice: {createInvoiceMutation.error?.message}
        </Alert>
      )}
    </Box>
  )
}