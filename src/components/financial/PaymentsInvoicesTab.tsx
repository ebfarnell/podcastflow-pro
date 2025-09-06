'use client'

import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Alert,
  Snackbar,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Tab
} from '@mui/material'
import {
  Add,
  Edit,
  Delete,
  Download,
  Send,
  Visibility,
  Payment,
  FileDownload,
  Receipt,
  AttachMoney,
  CallReceived,
  CallMade,
  AccountBalance
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Invoice {
  id: string
  invoiceNumber: string
  type: 'incoming' | 'outgoing'
  advertiser?: {
    id: string
    name: string
  }
  vendor?: {
    id: string
    name: string
  }
  campaign?: {
    id: string
    name: string
  }
  amount: number
  issueDate: string
  dueDate: string
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue'
  items: Array<{
    description: string
    quantity: number
    rate: number
    amount: number
  }>
  payments: Array<{
    id: string
    amount: number
    paymentDate: string
    method: string
  }>
  createdAt: string
  updatedAt: string
}

interface Payment {
  id: string
  type: 'incoming' | 'outgoing'
  amount: number
  paymentDate: string
  method: string
  referenceNumber?: string
  invoice?: Invoice
  description?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
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
      id={`payments-invoices-tabpanel-${index}`}
      aria-labelledby={`payments-invoices-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  )
}

export function PaymentsInvoicesTab() {
  const queryClient = useQueryClient()
  const [selectedTab, setSelectedTab] = useState(0) // 0 = All, 1 = Incoming, 2 = Outgoing
  const [viewMode, setViewMode] = useState<'invoices' | 'payments'>('invoices')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success')
  
  // Payment form state
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentDate: dayjs(),
    method: 'bank_transfer',
    referenceNumber: '',
    description: ''
  })

  // Determine filter type based on selected tab
  const getFilterType = () => {
    if (selectedTab === 1) return 'incoming'
    if (selectedTab === 2) return 'outgoing'
    return null // All
  }

  // Fetch invoices
  const { data: invoiceData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', getFilterType()],
    queryFn: async () => {
      const type = getFilterType()
      const url = type ? `/api/financials/invoices?type=${type}` : '/api/financials/invoices'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch invoices')
      const data = await response.json()
      return data
    }
  })
  
  const invoices = invoiceData?.invoices || []
  const invoiceSummary = invoiceData?.summary || {}

  // Fetch payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', getFilterType()],
    queryFn: async () => {
      const type = getFilterType()
      const url = type ? `/api/financials/payments?type=${type}` : '/api/financials/payments'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch payments')
      return response.json()
    },
    enabled: viewMode === 'payments'
  })

  // Send invoice mutation
  const sendInvoice = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/financials/invoices/${id}/send`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to send invoice')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      showSnackbar('Invoice sent successfully', 'success')
    },
    onError: (error) => {
      showSnackbar(error.message, 'error')
    }
  })

  // Record payment mutation
  const recordPayment = useMutation({
    mutationFn: async ({ invoiceId, data }: { invoiceId: string; data: any }) => {
      const response = await fetch(`/api/financials/invoices/${invoiceId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to record payment')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      setPaymentDialogOpen(false)
      setSelectedInvoice(null)
      resetPaymentForm()
      showSnackbar('Payment recorded successfully', 'success')
    },
    onError: (error) => {
      showSnackbar(error.message, 'error')
    }
  })

  // Download invoice mutation
  const downloadInvoice = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/financials/invoices/${id}/download`, {
        method: 'GET'
      })
      if (!response.ok) throw new Error('Failed to download invoice')
      return response.blob()
    },
    onSuccess: (blob, id) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${id}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
      showSnackbar('Invoice downloaded successfully', 'success')
    },
    onError: (error) => {
      showSnackbar(error.message, 'error')
    }
  })

  const handleSendInvoice = (id: string) => {
    sendInvoice.mutate(id)
  }

  const handleRecordPayment = () => {
    if (!selectedInvoice) return
    
    const data = {
      amount: parseFloat(paymentData.amount),
      paymentDate: paymentData.paymentDate.toISOString(),
      method: paymentData.method,
      referenceNumber: paymentData.referenceNumber,
      description: paymentData.description
    }
    
    recordPayment.mutate({ invoiceId: selectedInvoice.id, data })
  }

  const handleDownloadInvoice = (id: string) => {
    downloadInvoice.mutate(id)
  }

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    const remainingAmount = invoice.amount - invoice.payments.reduce((sum, p) => sum + p.amount, 0)
    setPaymentData({
      amount: remainingAmount.toString(),
      paymentDate: dayjs(),
      method: 'bank_transfer',
      referenceNumber: '',
      description: ''
    })
    setPaymentDialogOpen(true)
  }

  const resetPaymentForm = () => {
    setPaymentData({
      amount: '',
      paymentDate: dayjs(),
      method: 'bank_transfer',
      referenceNumber: '',
      description: ''
    })
  }

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbarMessage(message)
    setSnackbarSeverity(severity)
    setSnackbarOpen(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed': 
        return 'success'
      case 'sent': 
        return 'info'
      case 'partial':
      case 'pending': 
        return 'warning'
      case 'overdue':
      case 'failed': 
        return 'error'
      case 'draft':
      case 'cancelled': 
        return 'default'
      default: 
        return 'default'
    }
  }

  const exportData = () => {
    if (viewMode === 'invoices') {
      const csv = [
        ['Invoice #', 'Type', 'Party', 'Amount', 'Issue Date', 'Due Date', 'Status', 'Paid Amount'],
        ...invoices.map((inv: Invoice) => [
          inv.invoiceNumber,
          inv.type,
          inv.type === 'incoming' ? inv.advertiser?.name || '' : inv.vendor?.name || '',
          inv.amount.toString(),
          new Date(inv.issueDate).toLocaleDateString(),
          new Date(inv.dueDate).toLocaleDateString(),
          inv.status,
          inv.payments.reduce((sum, p) => sum + p.amount, 0).toString()
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoices-${getFilterType() || 'all'}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } else {
      const csv = [
        ['Payment Date', 'Type', 'Amount', 'Method', 'Reference', 'Description', 'Status'],
        ...payments.map((payment: Payment) => [
          new Date(payment.paymentDate).toLocaleDateString(),
          payment.type,
          payment.amount.toString(),
          payment.method,
          payment.referenceNumber || '',
          payment.description || '',
          payment.status
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payments-${getFilterType() || 'all'}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    }
    
    showSnackbar(`${viewMode === 'invoices' ? 'Invoices' : 'Payments'} exported successfully`, 'success')
  }

  // Calculate totals for invoices
  const calculateInvoiceTotals = () => {
    const filtered = selectedTab === 0 ? invoices : 
                    selectedTab === 1 ? invoices.filter((inv: Invoice) => inv.type === 'incoming') :
                    invoices.filter((inv: Invoice) => inv.type === 'outgoing')
    
    const totalInvoiced = filtered.reduce((sum: number, inv: Invoice) => sum + inv.amount, 0)
    const totalPaid = filtered.reduce((sum: number, inv: Invoice) => 
      sum + inv.payments.reduce((pSum, p) => pSum + p.amount, 0), 0)
    const totalOutstanding = totalInvoiced - totalPaid
    const overdueCount = filtered.filter((inv: Invoice) => inv.status === 'overdue').length
    
    return { totalInvoiced, totalPaid, totalOutstanding, overdueCount }
  }

  // Calculate totals for payments
  const calculatePaymentTotals = () => {
    const filtered = selectedTab === 0 ? payments : 
                    selectedTab === 1 ? payments.filter((p: Payment) => p.type === 'incoming') :
                    payments.filter((p: Payment) => p.type === 'outgoing')
    
    const totalIncoming = filtered.filter((p: Payment) => p.type === 'incoming')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0)
    const totalOutgoing = filtered.filter((p: Payment) => p.type === 'outgoing')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0)
    const netCashFlow = totalIncoming - totalOutgoing
    const pendingCount = filtered.filter((p: Payment) => p.status === 'pending').length
    
    return { totalIncoming, totalOutgoing, netCashFlow, pendingCount }
  }

  const totals = viewMode === 'invoices' ? calculateInvoiceTotals() : calculatePaymentTotals()

  return (
    <Box>
      {/* View Mode Toggle */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => newMode && setViewMode(newMode)}
          size="large"
        >
          <ToggleButton value="invoices">
            <Receipt sx={{ mr: 1 }} />
            Invoices
          </ToggleButton>
          <ToggleButton value="payments">
            <Payment sx={{ mr: 1 }} />
            Payments
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Tabs for filtering */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={selectedTab} 
          onChange={(e, newValue) => setSelectedTab(newValue)}
          centered
        >
          <Tab 
            label="All Transactions" 
            icon={<AccountBalance />} 
            iconPosition="start"
          />
          <Tab 
            label="Incoming (Receivables)" 
            icon={<CallReceived />} 
            iconPosition="start"
          />
          <Tab 
            label="Outgoing (Payables)" 
            icon={<CallMade />} 
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {viewMode === 'invoices' ? (
          <>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Invoiced
                  </Typography>
                  <Typography variant="h5">
                    ${totals.totalInvoiced.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Paid
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    ${totals.totalPaid.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Outstanding
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    ${totals.totalOutstanding.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Overdue
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    {totals.overdueCount} invoices
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Incoming
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    ${totals.totalIncoming.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Outgoing
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    ${totals.totalOutgoing.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Net Cash Flow
                  </Typography>
                  <Typography 
                    variant="h5" 
                    color={totals.netCashFlow >= 0 ? "success.main" : "error.main"}
                  >
                    ${Math.abs(totals.netCashFlow).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Pending
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    {totals.pendingCount} payments
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      {/* Actions Bar */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {viewMode === 'invoices' ? (
            <>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  const type = selectedTab === 2 ? 'outgoing' : 'incoming'
                  window.location.href = `/invoices/new?type=${type}`
                }}
              >
                Create {selectedTab === 2 ? 'Bill' : 'Invoice'}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                const type = selectedTab === 2 ? 'outgoing' : 'incoming'
                window.location.href = `/payments/new?type=${type}`
              }}
            >
              Record Payment
            </Button>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<FileDownload />}
          onClick={exportData}
        >
          Export
        </Button>
      </Box>

      {/* Data Table */}
      {viewMode === 'invoices' ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Invoice #</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>{selectedTab === 2 ? 'Vendor' : 'Client'}</TableCell>
                <TableCell>Campaign</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoicesLoading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    Loading invoices...
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice: Invoice) => {
                  const paidAmount = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
                  const progressPercentage = (paidAmount / invoice.amount) * 100
                  
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {invoice.invoiceNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.type}
                          size="small"
                          color={invoice.type === 'incoming' ? 'success' : 'error'}
                          icon={invoice.type === 'incoming' ? <CallReceived /> : <CallMade />}
                        />
                      </TableCell>
                      <TableCell>
                        {invoice.type === 'incoming' ? invoice.advertiser?.name : invoice.vendor?.name || '-'}
                      </TableCell>
                      <TableCell>{invoice.campaign?.name || '-'}</TableCell>
                      <TableCell align="right">
                        ${invoice.amount.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Box>
                          <Typography variant="body2">
                            ${paidAmount.toLocaleString()}
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={progressPercentage}
                            sx={{ mt: 0.5, height: 4 }}
                            color={progressPercentage === 100 ? 'success' : 'primary'}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.status}
                          size="small"
                          color={getStatusColor(invoice.status) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadInvoice(invoice.id)}
                            title="Download PDF"
                          >
                            <Download />
                          </IconButton>
                          {invoice.status === 'draft' && invoice.type === 'incoming' && (
                            <IconButton
                              size="small"
                              onClick={() => handleSendInvoice(invoice.id)}
                              title="Send Invoice"
                              color="primary"
                            >
                              <Send />
                            </IconButton>
                          )}
                          {invoice.status !== 'paid' && (
                            <IconButton
                              size="small"
                              onClick={() => openPaymentDialog(invoice)}
                              title="Record Payment"
                              color="success"
                            >
                              <Payment />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            onClick={() => window.location.href = `/invoices/${invoice.id}`}
                            title="View Details"
                          >
                            <Visibility />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paymentsLoading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    Loading payments...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No payments found
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment: Payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.paymentDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={payment.type}
                        size="small"
                        color={payment.type === 'incoming' ? 'success' : 'error'}
                        icon={payment.type === 'incoming' ? <CallReceived /> : <CallMade />}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        fontWeight="bold"
                        color={payment.type === 'incoming' ? 'success.main' : 'error.main'}
                      >
                        ${payment.amount.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell>{payment.referenceNumber || '-'}</TableCell>
                    <TableCell>
                      {payment.invoice ? payment.invoice.invoiceNumber : '-'}
                    </TableCell>
                    <TableCell>{payment.description || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={payment.status}
                        size="small"
                        color={getStatusColor(payment.status) as any}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => window.location.href = `/payments/${payment.id}`}
                        title="View Details"
                      >
                        <Visibility />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Record Payment for {selectedInvoice?.invoiceNumber}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {selectedInvoice && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Outstanding amount: ${(selectedInvoice.amount - selectedInvoice.payments.reduce((sum, p) => sum + p.amount, 0)).toLocaleString()}
              </Alert>
            )}
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Payment Amount"
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    InputProps={{ startAdornment: '$' }}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <DatePicker
                    label="Payment Date"
                    value={paymentData.paymentDate}
                    onChange={(newValue) => setPaymentData({ ...paymentData, paymentDate: newValue || dayjs() })}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Method</InputLabel>
                    <Select
                      value={paymentData.method}
                      onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                      label="Payment Method"
                    >
                      <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                      <MenuItem value="credit_card">Credit Card</MenuItem>
                      <MenuItem value="check">Check</MenuItem>
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="ach">ACH</MenuItem>
                      <MenuItem value="wire">Wire Transfer</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Reference Number"
                    value={paymentData.referenceNumber}
                    onChange={(e) => setPaymentData({ ...paymentData, referenceNumber: e.target.value })}
                    placeholder="Check #, transaction ID, etc."
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description/Notes"
                    value={paymentData.description}
                    onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </LocalizationProvider>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleRecordPayment} 
            variant="contained"
            disabled={!paymentData.amount || parseFloat(paymentData.amount) <= 0}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}