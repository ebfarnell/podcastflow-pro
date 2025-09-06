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
  LinearProgress
} from '@mui/material'
import {
  Add,
  Edit,
  Delete,
  Download,
  Send,
  Visibility,
  Payment,
  FileDownload
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Invoice {
  id: string
  invoiceNumber: string
  advertiser: {
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

export function InvoicesTab() {
  const queryClient = useQueryClient()
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
    method: 'bank_transfer'
  })

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const response = await fetch('/api/invoices')
      if (!response.ok) throw new Error('Failed to fetch invoices')
      return response.json()
    }
  })

  // Send invoice mutation
  const sendInvoice = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/invoices/${id}/send`, {
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
      const response = await fetch(`/api/invoices/${invoiceId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to record payment')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
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
      const response = await fetch(`/api/invoices/${id}/download`, {
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
      method: paymentData.method
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
      method: 'bank_transfer'
    })
    setPaymentDialogOpen(true)
  }

  const resetPaymentForm = () => {
    setPaymentData({
      amount: '',
      paymentDate: dayjs(),
      method: 'bank_transfer'
    })
  }

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbarMessage(message)
    setSnackbarSeverity(severity)
    setSnackbarOpen(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success'
      case 'sent': return 'info'
      case 'partial': return 'warning'
      case 'overdue': return 'error'
      case 'draft': return 'default'
      default: return 'default'
    }
  }

  const exportInvoices = () => {
    const csv = [
      ['Invoice #', 'Advertiser', 'Amount', 'Issue Date', 'Due Date', 'Status', 'Paid Amount'],
      ...invoices.map((inv: Invoice) => [
        inv.invoiceNumber,
        inv.advertiser.name,
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
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    
    showSnackbar('Invoices exported successfully', 'success')
  }

  // Calculate totals
  const totalInvoiced = invoices.reduce((sum: number, inv: Invoice) => sum + inv.amount, 0)
  const totalPaid = invoices.reduce((sum: number, inv: Invoice) => 
    sum + inv.payments.reduce((pSum, p) => pSum + p.amount, 0), 0)
  const totalOutstanding = totalInvoiced - totalPaid
  const overdueCount = invoices.filter((inv: Invoice) => inv.status === 'overdue').length

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Invoiced
              </Typography>
              <Typography variant="h5">
                ${totalInvoiced.toLocaleString()}
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
                ${totalPaid.toLocaleString()}
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
                ${totalOutstanding.toLocaleString()}
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
                {overdueCount} invoices
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Actions Bar */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            window.location.href = '/invoices/new'
          }}
        >
          Create Invoice
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownload />}
          onClick={exportInvoices}
        >
          Export
        </Button>
      </Box>

      {/* Invoices Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Invoice #</TableCell>
              <TableCell>Advertiser</TableCell>
              <TableCell>Campaign</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
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
                    <TableCell>{invoice.advertiser.name}</TableCell>
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
                        {invoice.status === 'draft' && (
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
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
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