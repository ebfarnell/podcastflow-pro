import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
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
  Typography,
  LinearProgress,
  Alert,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem as SelectMenuItem,
  TextField,
  Grid,
} from '@mui/material'
import {
  Add as AddIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  MoreVert as MoreVertIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material'
import { formatCurrency } from '@/lib/utils'

interface Invoice {
  id: string
  invoiceNumber: string
  issueDate: string
  dueDate: string
  paidDate?: string
  status: 'pending' | 'sent' | 'paid' | 'void' | 'overdue'
  amount: number
  taxAmount?: number
  discountAmount?: number
  totalAmount: number
  displayAmount: number
  balance: number
  currency: string
  description: string
  billingPeriod?: string
  notes?: string
  pdfUrl?: string
  lineItems?: {
    id: string
    description: string
    quantity: number
    unitPrice: number
    amount: number
    campaignId?: string
  }[]
  payments?: {
    id: string
    amount: number
    paymentDate: string
    paymentMethod: string
    referenceNumber?: string
  }[]
}

interface InvoicesResponse {
  invoices: Invoice[]
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  totals: {
    issued: number
    paid: number
    outstanding: number
  }
}

interface CampaignInvoicesProps {
  campaignId: string
}

export function CampaignInvoices({ campaignId }: CampaignInvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [totals, setTotals] = useState({ issued: 0, paid: 0, outstanding: 0 })
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')

  const fetchInvoices = async (page: number = 1) => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pagination.pageSize.toString(),
      })
      
      if (statusFilter) params.append('status', statusFilter)
      if (dateFromFilter) params.append('from', dateFromFilter)
      if (dateToFilter) params.append('to', dateToFilter)
      
      const response = await fetch(`/api/campaigns/${campaignId}/invoices?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices')
      }
      
      const data: InvoicesResponse = await response.json()
      
      setInvoices(data.invoices || [])
      setTotals(data.totals || { issued: 0, paid: 0, outstanding: 0 })
      setPagination(data.pagination || { total: 0, page: 1, pageSize: 10, totalPages: 0 })
    } catch (err) {
      console.error('Error fetching invoices:', err)
      setError(err instanceof Error ? err.message : 'Failed to load invoices')
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [campaignId, statusFilter, dateFromFilter, dateToFilter])

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    fetchInvoices(page)
  }

  const handleFilterReset = () => {
    setStatusFilter('')
    setDateFromFilter('')
    setDateToFilter('')
  }

  const getStatusColor = (status: string): 'success' | 'info' | 'error' | 'warning' | 'default' => {
    switch (status) {
      case 'paid':
        return 'success'
      case 'sent':
        return 'info'
      case 'overdue':
        return 'error'
      case 'pending':
        return 'warning'
      case 'void':
        return 'default'
      default:
        return 'default'
    }
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, invoiceId: string) => {
    setMenuAnchorEl(event.currentTarget)
    setSelectedInvoice(invoiceId)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
    setSelectedInvoice(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getStatusDisplay = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  if (loading) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>Invoices</Typography>
        <LinearProgress />
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Loading invoices...
        </Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>Invoices</Typography>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => fetchInvoices()} variant="outlined">
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header with totals */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h6" gutterBottom>Invoices</Typography>
          <Grid container spacing={3}>
            <Grid item>
              <Typography variant="body2" color="textSecondary">
                Total Issued: {formatCurrency(totals.issued)}
              </Typography>
            </Grid>
            <Grid item>
              <Typography variant="body2" color="success.main">
                Total Paid: {formatCurrency(totals.paid)}
              </Typography>
            </Grid>
            <Grid item>
              <Typography variant="body2" color="warning.main">
                Outstanding: {formatCurrency(totals.outstanding)}
              </Typography>
            </Grid>
          </Grid>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled
          title="Invoice creation is handled through order management"
        >
          Create Invoice
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <SelectMenuItem value="">All Statuses</SelectMenuItem>
                <SelectMenuItem value="pending">Pending</SelectMenuItem>
                <SelectMenuItem value="sent">Sent</SelectMenuItem>
                <SelectMenuItem value="paid">Paid</SelectMenuItem>
                <SelectMenuItem value="overdue">Overdue</SelectMenuItem>
                <SelectMenuItem value="void">Void</SelectMenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="From Date"
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="To Date"
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button
              onClick={handleFilterReset}
              variant="outlined"
              size="small"
              fullWidth
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* Invoices table */}
      <TableContainer component={Card}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Invoice #</TableCell>
              <TableCell>Issue Date</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Balance</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Period</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="textSecondary">
                    No invoices found for this campaign
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {invoice.invoiceNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell>{formatCurrency(invoice.displayAmount)}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color={invoice.balance > 0 ? 'warning.main' : 'success.main'}
                    >
                      {formatCurrency(invoice.balance)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusDisplay(invoice.status)}
                      size="small"
                      color={getStatusColor(invoice.status)}
                    />
                  </TableCell>
                  <TableCell>
                    {invoice.billingPeriod ? (
                      <Typography variant="body2" color="textSecondary">
                        {invoice.billingPeriod}
                      </Typography>
                    ) : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, invoice.id)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={pagination.totalPages}
            page={pagination.page}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}

      {/* Action menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        {selectedInvoice && (
          <>
            <MenuItem onClick={handleMenuClose}>
              <DownloadIcon sx={{ mr: 1 }} fontSize="small" />
              Download PDF
            </MenuItem>
            <MenuItem onClick={handleMenuClose}>
              <SendIcon sx={{ mr: 1 }} fontSize="small" />
              Send to Client
            </MenuItem>
            <MenuItem onClick={handleMenuClose}>
              Edit Invoice
            </MenuItem>
            <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
              Delete Invoice
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  )
}