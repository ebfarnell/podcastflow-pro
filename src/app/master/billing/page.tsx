'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
  Alert,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  CardActionArea,
  Tabs,
  Tab,
} from '@mui/material'
import {
  AttachMoney,
  TrendingUp,
  Receipt,
  CreditCard,
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Block as BlockIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Business as BusinessIcon,
  Analytics as AnalyticsIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
} from '@mui/icons-material'
import { SummaryTab } from '@/components/master/billing/SummaryTab'
import { AccountsPayableTab } from '@/components/master/billing/AccountsPayableTab'
import { PlansManagementTab } from '@/components/master/billing/PlansManagementTab'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { MasterOnly } from '@/components/auth/RoleGuard'
import { ComprehensiveDateRangeSelector } from '@/components/common/ComprehensiveDateRangeSelector'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { masterApi, type MasterBilling } from '@/services/masterApi'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils/currency'
import dayjs, { Dayjs } from 'dayjs'

interface BillingRecord {
  id: string
  organizationId: string
  organizationName: string
  plan: string
  amount: number
  status: 'paid' | 'pending' | 'overdue' | 'failed' | 'voided'
  dueDate: string
  lastPayment: string
  description?: string
  invoiceNumber?: string
  createdAt?: string
}

interface InvoiceFormData {
  organizationId: string
  organizationName: string
  amount: number
  description: string
  dueDate: string
  status: 'pending' | 'paid' | 'overdue' | 'failed' | 'voided'
  plan?: string
}

interface OrganizationSummary {
  id: string
  name: string
  plan: string
  status: 'active' | 'inactive' | 'suspended'
  totalRevenue: number
  monthlyRecurring: number
  invoiceCount: number
  paidInvoices: number
  overdueAmount: number
  lastPayment: string | null
  nextDueDate: string | null
  subscriptionStart: string
  churnRisk: 'low' | 'medium' | 'high'
  paymentMethod: string
}

// Organizations View Component
function OrganizationsView({ 
  timeRange, 
  filterPlan, 
  filterStatus, 
  sortBy,
  organizationsData, 
  billingData 
}: {
  timeRange: string
  filterPlan: string
  filterStatus: string
  sortBy: string
  organizationsData: any[]
  billingData: any
}) {
  const router = useRouter()
  // Create organization summaries from the data
  const organizationSummaries: OrganizationSummary[] = (organizationsData || []).map(org => {
    const orgInvoices = (billingData?.records || []).filter((invoice: any) => 
      invoice.organizationId === org.id
    )
    
    const paidInvoices = orgInvoices.filter((inv: any) => inv.status === 'paid')
    const overdueInvoices = orgInvoices.filter((inv: any) => inv.status === 'overdue')
    const totalRevenue = paidInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)
    const overdueAmount = overdueInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)
    
    // Calculate churn risk based on payment patterns
    const hasOverdue = overdueAmount > 0
    const hasRecentPayment = paidInvoices.some((inv: any) => 
      new Date(inv.lastPayment) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )
    let churnRisk: 'low' | 'medium' | 'high' = 'low'
    if (hasOverdue && !hasRecentPayment) churnRisk = 'high'
    else if (hasOverdue || !hasRecentPayment) churnRisk = 'medium'

    return {
      id: org.id,
      name: org.name,
      plan: org.subscription?.planId || 'starter',
      status: org.status || 'active',
      totalRevenue,
      monthlyRecurring: org.subscription?.amount || 0,
      invoiceCount: orgInvoices.length,
      paidInvoices: paidInvoices.length,
      overdueAmount,
      lastPayment: paidInvoices.length > 0 ? 
        paidInvoices.sort((a: any, b: any) => new Date(b.lastPayment).getTime() - new Date(a.lastPayment).getTime())[0].lastPayment : null,
      nextDueDate: orgInvoices.find((inv: any) => inv.status === 'pending')?.dueDate || null,
      subscriptionStart: org.createdAt,
      churnRisk,
      paymentMethod: 'Credit Card' // This would come from payment method data
    }
  })

  // Filter and sort organizations
  const filteredOrganizations = organizationSummaries
    .filter(org => {
      const planMatch = filterPlan === 'all' || org.plan.toLowerCase() === filterPlan
      const statusMatch = filterStatus === 'all' || org.status === filterStatus
      return planMatch && statusMatch
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'revenue':
          return b.totalRevenue - a.totalRevenue
        case 'mrr':
          return b.monthlyRecurring - a.monthlyRecurring
        case 'overdue':
          return b.overdueAmount - a.overdueAmount
        case 'risk':
          const riskOrder = { high: 3, medium: 2, low: 1 }
          return riskOrder[b.churnRisk] - riskOrder[a.churnRisk]
        default:
          return a.name.localeCompare(b.name)
      }
    })

  const getChurnRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'success'
      case 'medium': return 'warning'
      case 'high': return 'error'
      default: return 'default'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'inactive': return 'warning'
      case 'suspended': return 'error'
      default: return 'default'
    }
  }

  return (
    <Grid container spacing={3}>
      {filteredOrganizations.map((org) => (
        <Grid item xs={12} md={6} lg={4} key={org.id}>
          <Card sx={{ height: '100%' }}>
            <CardActionArea 
              onClick={() => router.push(`/master/organizations/${org.id}/billing`)}
              sx={{ height: '100%' }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" component="h3" gutterBottom sx={{ color: 'text.primary' }}>
                      {org.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <Chip 
                        label={org.plan} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                      <Chip 
                        label={org.status} 
                        size="small" 
                        color={getStatusColor(org.status) as any}
                      />
                    </Box>
                  </Box>
                  <BusinessIcon color="action" />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Total Revenue
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {formatCurrency(org.totalRevenue)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Monthly Recurring
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'text.primary' }}>
                        {formatCurrency(org.monthlyRecurring)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Invoices
                      </Typography>
                      <Typography variant="body1">
                        {org.paidInvoices}/{org.invoiceCount} paid
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Overdue
                      </Typography>
                      <Typography variant="body1" color={org.overdueAmount > 0 ? "error.main" : "text.primary"}>
                        {formatCurrency(org.overdueAmount)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Churn Risk
                    </Typography>
                    <Chip 
                      label={org.churnRisk.toUpperCase()} 
                      size="small" 
                      color={getChurnRiskColor(org.churnRisk) as any}
                    />
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color="text.secondary">
                      Last Payment
                    </Typography>
                    <Typography variant="body2">
                      {org.lastPayment ? new Date(org.lastPayment).toLocaleDateString() : 'Never'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}

export default function BillingManagementPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [view, setView] = useState<'invoices' | 'organizations'>('invoices')
  const [filterPlan, setFilterPlan] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [timeRange, setTimeRange] = useState('thisMonth')
  const [customStartDate, setCustomStartDate] = useState<Dayjs | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Dayjs | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedRecord, setSelectedRecord] = useState<BillingRecord | null>(null)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<BillingRecord | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success')
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormData>({
    organizationId: '',
    organizationName: '',
    amount: 0,
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'pending'
  })
  const queryClient = useQueryClient()

  // Fetch billing data with time range
  const { data: billingData, isLoading, error } = useQuery({
    queryKey: ['master-billing', timeRange, customStartDate?.format('YYYY-MM-DD'), customEndDate?.format('YYYY-MM-DD')],
    queryFn: () => {
      // If custom date range, pass the actual dates to the API
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        return masterApi.billing.getOverview('custom', {
          startDate: customStartDate.format('YYYY-MM-DD'),
          endDate: customEndDate.format('YYYY-MM-DD')
        })
      }
      return masterApi.billing.getOverview(timeRange)
    },
    refetchInterval: false, // Disable automatic refresh
  })

  // Fetch expenses data
  const { data: expensesData } = useQuery({
    queryKey: ['master-expenses', timeRange, customStartDate?.format('YYYY-MM-DD'), customEndDate?.format('YYYY-MM-DD')],
    queryFn: async () => {
      let url = `/api/master/expenses?timeRange=${timeRange}`
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate.format('YYYY-MM-DD')}&endDate=${customEndDate.format('YYYY-MM-DD')}`
      }
      const response = await fetch(url, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch expenses')
      return response.json()
    },
    refetchInterval: false,
    staleTime: 5 * 60 * 1000,
  })

  // Fetch organizations for invoice form
  const { data: organizationsData } = useQuery({
    queryKey: ['master-organizations'],
    queryFn: () => masterApi.organizations.list(),
  })

  // Mutations for billing actions
  const sendReminderMutation = useMutation({
    mutationFn: (recordId: string) => masterApi.billing.sendReminder(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-billing'] })
    }
  })

  const suspendAccountMutation = useMutation({
    mutationFn: (recordId: string) => masterApi.billing.suspendAccount(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-billing'] })
    }
  })

  // Helper function to show notifications
  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message)
    setSnackbarSeverity(severity)
    setSnackbarOpen(true)
  }

  // Invoice management mutations
  const createInvoiceMutation = useMutation({
    mutationFn: (invoiceData: InvoiceFormData) => masterApi.billing.createInvoice(invoiceData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-billing'] })
      setInvoiceDialogOpen(false)
      resetForm()
      showNotification('Invoice created successfully', 'success')
    },
    onError: (error) => {
      console.error('Error creating invoice:', error)
      showNotification('Failed to create invoice', 'error')
    }
  })

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<InvoiceFormData> }) => 
      masterApi.billing.updateInvoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-billing'] })
      setInvoiceDialogOpen(false)
      setEditingInvoice(null)
      resetForm()
      showNotification('Invoice updated successfully', 'success')
    },
    onError: (error) => {
      console.error('Error updating invoice:', error)
      showNotification('Failed to update invoice', 'error')
    }
  })

  const deleteInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => masterApi.billing.deleteInvoice(invoiceId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['master-billing'] })
      setDeleteDialogOpen(false)
      setSelectedRecord(null)
      
      // Handle different types of successful deletions
      if (response?.action === 'invoice_deleted') {
        showNotification(`Invoice ${response.message || 'deleted successfully'}`, 'success')
      } else {
        showNotification('Invoice deleted successfully', 'success')
      }
    },
    onError: (error) => {
      console.error('Error deleting invoice:', error)
      showNotification('Failed to delete invoice', 'error')
    }
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => 
      masterApi.billing.updateInvoiceStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['master-billing'] })
      setStatusDialogOpen(false)
      setSelectedRecord(null)
      showNotification(`Invoice status updated to ${variables.status}`, 'success')
    },
    onError: (error) => {
      console.error('Error updating status:', error)
      showNotification('Failed to update invoice status', 'error')
    }
  })

  const generateInvoicesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/master/invoices/generate-monthly', {
        method: 'POST',
        credentials: 'include'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate invoices')
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['master-billing'] })
      showNotification(`Generated ${data.created} monthly invoices successfully`, 'success')
      if (data.errors && data.errors.length > 0) {
        console.warn('Invoice generation errors:', data.errors)
      }
    },
    onError: (error: any) => {
      console.error('Error generating monthly invoices:', error)
      showNotification(error.message || 'Failed to generate monthly invoices', 'error')
    }
  })

  if (isLoading) {
    return (
      <MasterOnly>
        <DashboardLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <Typography>Loading billing data...</Typography>
          </Box>
        </DashboardLayout>
      </MasterOnly>
    )
  }

  if (error || !billingData) {
    return (
      <MasterOnly>
        <DashboardLayout>
          <Box sx={{ p: 3 }}>
            <Alert severity="error">
              Failed to load billing data. Please try again.
            </Alert>
          </Box>
        </DashboardLayout>
      </MasterOnly>
    )
  }

  const { metrics, records: billingRecords } = billingData

  const filteredRecords = billingRecords.filter(record => {
    const planMatch = filterPlan === 'all' || record.plan.toLowerCase() === filterPlan
    const statusMatch = filterStatus === 'all' || record.status === filterStatus
    return planMatch && statusMatch
  })

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, record: BillingRecord) => {
    setAnchorEl(event.currentTarget)
    setSelectedRecord(record)
  }

  const handleCloseMenu = () => {
    setAnchorEl(null)
    // Don't clear selectedRecord here as it's needed for dialogs
  }

  const handleDownloadInvoice = async (record: BillingRecord) => {
    try {
      const blob = await masterApi.billing.downloadInvoice(record.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${record.organizationName}-${record.id}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading invoice:', error)
    }
    handleCloseMenu()
  }

  const handleSendReminder = async (record: BillingRecord) => {
    try {
      await sendReminderMutation.mutateAsync(record.id)
    } catch (error) {
      console.error('Error sending reminder:', error)
    }
    handleCloseMenu()
  }

  const handleSuspendAccount = async (record: BillingRecord) => {
    try {
      await suspendAccountMutation.mutateAsync(record.id)
    } catch (error) {
      console.error('Error suspending account:', error)
    }
    handleCloseMenu()
  }

  // Form handling functions
  const resetForm = () => {
    setInvoiceForm({
      organizationId: '',
      organizationName: '',
      amount: 0,
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    })
  }

  const handleCreateInvoice = () => {
    setEditingInvoice(null)
    resetForm()
    setInvoiceDialogOpen(true)
  }

  const handleEditInvoice = (record: BillingRecord) => {
    setEditingInvoice(record)
    setInvoiceForm({
      organizationId: record.organizationId,
      organizationName: record.organizationName,
      amount: record.amount,
      description: record.description || '',
      dueDate: record.dueDate,
      status: record.status,
      plan: record.plan
    })
    setInvoiceDialogOpen(true)
    handleCloseMenu()
  }

  const handleDeleteInvoice = (record: BillingRecord) => {
    setSelectedRecord(record)
    setDeleteDialogOpen(true)
    handleCloseMenu()
  }

  const handleChangeStatus = (record: BillingRecord) => {
    setSelectedRecord(record)
    setStatusDialogOpen(true)
    handleCloseMenu()
  }

  const handleSubmitInvoice = async () => {
    try {
      if (editingInvoice) {
        await updateInvoiceMutation.mutateAsync({
          id: editingInvoice.id,
          data: invoiceForm
        })
      } else {
        await createInvoiceMutation.mutateAsync(invoiceForm)
      }
    } catch (error) {
      console.error('Error saving invoice:', error)
    }
  }

  const handleConfirmDelete = async () => {
    console.log('🗑️ handleConfirmDelete called with selectedRecord:', selectedRecord)
    if (selectedRecord) {
      try {
        console.log('🗑️ About to call deleteInvoiceMutation.mutateAsync with ID:', selectedRecord.id)
        await deleteInvoiceMutation.mutateAsync(selectedRecord.id)
        console.log('🗑️ deleteInvoiceMutation.mutateAsync completed successfully')
      } catch (error) {
        console.error('❌ Error deleting invoice:', error)
      }
    } else {
      console.log('❌ No selectedRecord found')
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (selectedRecord) {
      try {
        await updateStatusMutation.mutateAsync({
          id: selectedRecord.id,
          status: newStatus
        })
      } catch (error) {
        console.error('Error updating status:', error)
      }
    }
  }

  const handleGenerateMonthlyInvoices = async () => {
    try {
      await generateInvoicesMutation.mutateAsync()
    } catch (error) {
      console.error('Error generating monthly invoices:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success'
      case 'pending': return 'warning'
      case 'overdue': return 'error'
      case 'failed': return 'error'
      case 'voided': return 'default'
      default: return 'default'
    }
  }

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'Enterprise': return 'primary'
      case 'Professional': return 'info'
      case 'Starter': return 'secondary'
      default: return 'default'
    }
  }

  const getTimeRangeLabel = (range: string) => {
    const labels = {
      'today': 'Today',
      'thisWeek': 'This Week',
      'thisMonth': 'This Month',
      'lastMonth': 'Last Month',
      'thisQuarter': 'This Quarter',
      'lastQuarter': 'Last Quarter',
      'thisYear': 'This Year',
      'lastYear': 'Last Year',
      'custom': 'Custom Range'
    }
    return labels[range as keyof typeof labels] || 'This Month'
  }

  const handleDateRangeChange = (newRange: string) => {
    setTimeRange(newRange)
  }

  const handleCustomDateChange = (startDate: Dayjs | null, endDate: Dayjs | null) => {
    setCustomStartDate(startDate)
    setCustomEndDate(endDate)
  }

  return (
    <MasterOnly>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          {/* Header Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
              Billing Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage subscriptions and billing across all organizations
            </Typography>
            <Typography variant="body2" color="primary.main" sx={{ mt: 1, fontWeight: 500 }}>
              Showing data for: {getTimeRangeLabel(timeRange)}
              {timeRange === 'custom' && customStartDate && customEndDate && (
                <span style={{ marginLeft: 8, fontSize: '0.875rem', color: '#666' }}>
                  ({customStartDate.format('MMM DD, YYYY')} - {customEndDate.format('MMM DD, YYYY')})
                </span>
              )}
              {timeRange !== 'custom' && billingData?.timeRange && (
                <span style={{ marginLeft: 8, fontSize: '0.875rem', color: '#666' }}>
                  ({new Date(billingData.timeRange.start).toLocaleDateString()} - {new Date(billingData.timeRange.end).toLocaleDateString()})
                </span>
              )}
            </Typography>
          </Box>
          
          {/* Controls Section */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 2,
            mb: 3,
            alignItems: { xs: 'stretch', md: 'flex-start' }
          }}>
            {/* View Toggle */}
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={(e, newView) => newView && setView(newView)}
                aria-label="view mode"
                size="small"
                sx={{ 
                  backgroundColor: 'white',
                  '& .MuiToggleButton-root': {
                    backgroundColor: 'white',
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      }
                    },
                    '&:hover': {
                      backgroundColor: 'grey.100',
                    }
                  }
                }}
              >
                <ToggleButton value="invoices" aria-label="invoices view">
                  <ViewListIcon sx={{ mr: 1 }} />
                  Invoices
                </ToggleButton>
                <ToggleButton value="organizations" aria-label="organizations view">
                  <ViewModuleIcon sx={{ mr: 1 }} />
                  Organizations
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            
            {/* Action Buttons */}
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              flexWrap: 'wrap',
              alignItems: 'center',
              ml: { md: 'auto' }
            }}>
              {view === 'invoices' && (
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />}
                  onClick={handleCreateInvoice}
                >
                  Create Invoice
                </Button>
              )}
              
              <Button 
                variant="outlined" 
                startIcon={<Receipt />}
                onClick={handleGenerateMonthlyInvoices}
                disabled={generateInvoicesMutation.isPending}
              >
                {generateInvoicesMutation.isPending ? 'Generating...' : 'Generate Monthly Invoices'}
              </Button>
              
              <Button variant="outlined" startIcon={<DownloadIcon />}>
                Export Report
              </Button>
            </Box>
          </Box>

          {/* Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Summary" />
              <Tab label="Accounts Receivable" />
              <Tab label="Accounts Payable" />
              <Tab label="Plans Management" />
            </Tabs>
          </Paper>

          {/* Tab Content */}
          {activeTab === 0 && (
            <SummaryTab 
              billingData={billingData} 
              expensesData={expensesData}
              timeRange={timeRange}
              onTimeRangeChange={handleDateRangeChange}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomDateChange={handleCustomDateChange}
            />
          )}

          {activeTab === 1 && (
            // Accounts Receivable Tab
            <Box>
              {/* Revenue Metrics - Original content */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <AttachMoney sx={{ mr: 2, color: 'success.main' }} />
                        <Typography color="text.secondary" gutterBottom>
                          Total Revenue
                        </Typography>
                      </Box>
                      <Typography variant="h4" sx={{ color: 'text.primary' }}>
                        {formatCurrency(metrics.totalRevenue)}
                      </Typography>
                      <Typography variant="body2" color={billingData.realtimeMetrics?.revenueGrowth && billingData.realtimeMetrics.revenueGrowth >= 0 ? "success.main" : "error.main"}>
                        {billingData.realtimeMetrics?.revenueGrowth !== undefined 
                          ? `${billingData.realtimeMetrics.revenueGrowth > 0 ? '+' : ''}${billingData.realtimeMetrics.revenueGrowth}% from previous period`
                          : 'No growth data'
                        }
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUp sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Monthly Recurring
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {formatCurrency(metrics.monthlyRecurring)}
                  </Typography>
                  <Typography variant="body2" color={billingData.realtimeMetrics?.subscriptionGrowth && billingData.realtimeMetrics.subscriptionGrowth >= 0 ? "success.main" : "error.main"}>
                    {billingData.realtimeMetrics?.subscriptionGrowth !== undefined 
                      ? `${billingData.realtimeMetrics.subscriptionGrowth > 0 ? '+' : ''}${billingData.realtimeMetrics.subscriptionGrowth}% subscription growth`
                      : 'No subscription data'
                    }
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Receipt sx={{ mr: 2, color: 'error.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Overdue Amount
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {formatCurrency(metrics.overdueAmount)}
                  </Typography>
                  <Typography variant="body2" color="error.main">
                    {billingData.realtimeMetrics?.overdueAccounts !== undefined 
                      ? `${billingData.realtimeMetrics.overdueAccounts} account${billingData.realtimeMetrics.overdueAccounts !== 1 ? 's' : ''} overdue`
                      : 'No overdue data'
                    }
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CreditCard sx={{ mr: 2, color: 'warning.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Churn Rate
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {metrics.churnRate}%
                  </Typography>
                  <Typography variant="body2" color={metrics.churnRate <= 5 ? "success.main" : "warning.main"}>
                    {metrics.churnRate <= 5 ? 'Healthy churn rate' : 'High churn rate'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* View Content */}
          {view === 'organizations' ? (
            <>
              {/* Organization Filters */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <ComprehensiveDateRangeSelector
                    value={timeRange}
                    onChange={handleDateRangeChange}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    onCustomDateChange={handleCustomDateChange}
                    variant="compact"
                  />
                  <FormControl variant="filled" sx={{ minWidth: 150, backgroundColor: 'white', borderRadius: 1 }}>
                    <InputLabel>Plan</InputLabel>
                    <Select
                      value={filterPlan}
                      onChange={(e) => setFilterPlan(e.target.value)}
                    >
                      <MenuItem value="all">All Plans</MenuItem>
                      <MenuItem value="enterprise">Enterprise</MenuItem>
                      <MenuItem value="professional">Professional</MenuItem>
                      <MenuItem value="starter">Starter</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl variant="filled" sx={{ minWidth: 150, backgroundColor: 'white', borderRadius: 1 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <MenuItem value="all">All Status</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="suspended">Suspended</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl variant="filled" sx={{ minWidth: 150, backgroundColor: 'white', borderRadius: 1 }}>
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <MenuItem value="name">Name</MenuItem>
                      <MenuItem value="revenue">Total Revenue</MenuItem>
                      <MenuItem value="mrr">Monthly Recurring</MenuItem>
                      <MenuItem value="overdue">Overdue Amount</MenuItem>
                      <MenuItem value="risk">Churn Risk</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Paper>
              
              <OrganizationsView 
                timeRange={timeRange}
                filterPlan={filterPlan}
                filterStatus={filterStatus}
                sortBy={sortBy}
                organizationsData={organizationsData}
                billingData={billingData}
              />
            </>
          ) : (
            <>
              {/* Filters */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <ComprehensiveDateRangeSelector
                    value={timeRange}
                    onChange={handleDateRangeChange}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    onCustomDateChange={handleCustomDateChange}
                    variant="compact"
                  />
              <FormControl variant="filled" sx={{ minWidth: 150, backgroundColor: 'white', borderRadius: 1 }}>
                <InputLabel>Plan</InputLabel>
                <Select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                >
                  <MenuItem value="all">All Plans</MenuItem>
                  <MenuItem value="enterprise">Enterprise</MenuItem>
                  <MenuItem value="professional">Professional</MenuItem>
                  <MenuItem value="starter">Starter</MenuItem>
                </Select>
              </FormControl>
              <FormControl variant="filled" sx={{ minWidth: 150, backgroundColor: 'white', borderRadius: 1 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                  <MenuItem value="voided">Voided</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Paper>

          {/* Billing Records Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Last Payment</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {record.invoiceNumber || `INV-${record.id.slice(-6)}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {record.organizationName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {record.description || 'Subscription billing'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.plan}
                        size="small"
                        color={getPlanColor(record.plan)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(record.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.status.toUpperCase()}
                        size="small"
                        color={getStatusColor(record.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(record.dueDate).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {record.lastPayment ? new Date(record.lastPayment).toLocaleDateString() : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={(e) => handleOpenMenu(e, record)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Action Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleCloseMenu}
          >
            <MenuItem onClick={() => selectedRecord && handleEditInvoice(selectedRecord)}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit Invoice</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => selectedRecord && handleChangeStatus(selectedRecord)}>
              <ListItemIcon>
                <CheckCircleIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Change Status</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => selectedRecord && handleDownloadInvoice(selectedRecord)}>
              <ListItemIcon>
                <DownloadIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Download Invoice</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => selectedRecord && handleSendReminder(selectedRecord)}>
              <ListItemIcon>
                <EmailIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Send Reminder</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => selectedRecord && handleDeleteInvoice(selectedRecord)}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete Invoice</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => selectedRecord && handleSuspendAccount(selectedRecord)}>
              <ListItemIcon>
                <BlockIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Suspend Account</ListItemText>
            </MenuItem>
          </Menu>
            </>
          )}

          {/* Invoice Form Dialog */}
          <Dialog 
            open={invoiceDialogOpen} 
            onClose={() => setInvoiceDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Organization</InputLabel>
                  <Select
                    value={invoiceForm.organizationId}
                    onChange={(e) => {
                      const selectedOrg = organizationsData?.find(org => org.id === e.target.value)
                      setInvoiceForm({
                        ...invoiceForm,
                        organizationId: e.target.value,
                        organizationName: selectedOrg?.name || '',
                        plan: selectedOrg?.plan || ''
                      })
                    }}
                    label="Organization"
                    disabled={!!editingInvoice}
                  >
                    {organizationsData?.map((org) => (
                      <MenuItem key={org.id} value={org.id}>
                        {org.name} ({org.plan})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  label="Description"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  fullWidth
                  multiline
                  rows={2}
                />
                
                <TextField
                  label="Amount"
                  type="number"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: parseFloat(e.target.value) || 0 })}
                  fullWidth
                  InputProps={{
                    startAdornment: '$'
                  }}
                />
                
                <TextField
                  label="Due Date"
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
                
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={invoiceForm.status}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value as any })}
                    label="Status"
                  >
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="paid">Paid</MenuItem>
                    <MenuItem value="overdue">Overdue</MenuItem>
                    <MenuItem value="failed">Failed</MenuItem>
                    <MenuItem value="voided">Voided</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setInvoiceDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleSubmitInvoice}
                variant="contained"
                disabled={!invoiceForm.organizationId || !invoiceForm.amount || !invoiceForm.description}
              >
                {editingInvoice ? 'Update' : 'Create'} Invoice
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog
            open={deleteDialogOpen}
            onClose={() => {
              setDeleteDialogOpen(false)
              setSelectedRecord(null)
            }}
          >
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete invoice {selectedRecord?.invoiceNumber || `INV-${selectedRecord?.id.slice(-6)}`} 
                for {selectedRecord?.organizationName}? This action cannot be undone.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setDeleteDialogOpen(false)
                setSelectedRecord(null)
              }}>Cancel</Button>
              <Button onClick={handleConfirmDelete} color="error" variant="contained">
                Delete
              </Button>
            </DialogActions>
          </Dialog>

          {/* Status Change Dialog */}
          <Dialog
            open={statusDialogOpen}
            onClose={() => setStatusDialogOpen(false)}
          >
            <DialogTitle>Change Invoice Status</DialogTitle>
            <DialogContent>
              <Typography sx={{ mb: 2 }}>
                Change status for invoice {selectedRecord?.invoiceNumber || `INV-${selectedRecord?.id.slice(-6)}`}:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {['pending', 'paid', 'overdue', 'failed', 'voided'].map((status) => (
                  <Button
                    key={status}
                    variant={selectedRecord?.status === status ? 'contained' : 'outlined'}
                    onClick={() => handleStatusUpdate(status)}
                    sx={{ justifyContent: 'flex-start', textTransform: 'capitalize' }}
                  >
                    {status}
                  </Button>
                ))}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            </DialogActions>
          </Dialog>

            </Box>
          )}

          {activeTab === 2 && (
            // Accounts Payable Tab
            <AccountsPayableTab 
              expensesData={expensesData} 
              timeRange={timeRange}
              onTimeRangeChange={handleDateRangeChange}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomDateChange={handleCustomDateChange}
            />
          )}

          {activeTab === 3 && (
            // Plans Management Tab
            <PlansManagementTab />
          )}

          {/* Success/Error Notifications */}
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={() => setSnackbarOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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
      </DashboardLayout>
    </MasterOnly>
  )
}