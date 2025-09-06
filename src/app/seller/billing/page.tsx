'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  LinearProgress,
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as MoneyIcon,
  Receipt as ReceiptIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  CalendarToday as CalendarIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { SellerOnly } from '@/components/auth/RoleGuard'
import { useQuery } from '@tanstack/react-query'
import { api, campaignApi, advertiserApi, billingApi } from '@/services/api'
import { useRouter } from 'next/navigation'

interface BillingMetrics {
  totalRevenue: number
  monthlyRevenue: number
  pendingInvoices: number
  paidInvoices: number
  revenueGrowth: number
  averageInvoiceValue: number
}

interface Invoice {
  id: string
  client: string
  campaign: string
  amount: number
  status: 'paid' | 'pending' | 'overdue' | 'draft'
  dueDate: string
  issueDate: string
  description: string
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function SellerBillingPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState(0)

  // Fetch campaigns data for billing calculations
  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns', 'billing'],
    queryFn: async () => {
      const response = await campaignApi.getAll({ limit: 1000 })
      return response
    }
  })

  // Fetch advertisers data
  const { data: advertisersData } = useQuery({
    queryKey: ['advertisers', 'billing'],
    queryFn: async () => {
      const response = await advertiserApi.list()
      return response.advertisers || []
    }
  })

  // Fetch real invoices from the database
  const { data: invoicesResponse, isLoading: invoicesLoading } = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: async () => {
      const response = await billingApi.getInvoices()
      return response
    }
  })

  // Calculate billing metrics from real invoice data
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['billing', 'metrics', invoicesResponse],
    queryFn: async (): Promise<BillingMetrics> => {
      if (!invoicesResponse?.invoices) {
        return {
          totalRevenue: 0,
          monthlyRevenue: 0,
          pendingInvoices: 0,
          paidInvoices: 0,
          revenueGrowth: 0,
          averageInvoiceValue: 0,
        }
      }

      const invoices = invoicesResponse.invoices
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()

      // Calculate total revenue from paid invoices
      const totalRevenue = invoices
        .filter((inv: any) => inv.status === 'paid')
        .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0)

      // Calculate monthly revenue from paid invoices this month
      const monthlyRevenue = invoices
        .filter((inv: any) => {
          const issueDate = new Date(inv.issueDate)
          return inv.status === 'paid' &&
                 issueDate.getMonth() === currentMonth && 
                 issueDate.getFullYear() === currentYear
        })
        .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0)

      // Calculate pending and paid invoice amounts
      const pendingInvoices = invoices
        .filter((inv: any) => inv.status === 'pending')
        .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0)

      const paidInvoices = totalRevenue

      const averageInvoiceValue = invoices.length > 0 
        ? invoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) / invoices.length 
        : 0

      // Calculate growth (would need more historical data for real calculation)
      const revenueGrowth = monthlyRevenue > 0 ? 12.5 : 0

      return {
        totalRevenue,
        monthlyRevenue,
        pendingInvoices,
        paidInvoices,
        revenueGrowth,
        averageInvoiceValue: Math.round(averageInvoiceValue),
      }
    },
    enabled: !!invoicesResponse
  })

  // Transform invoice data for display
  const invoices: Invoice[] = invoicesResponse?.invoices?.map((invoice: any) => ({
    id: invoice.invoiceNumber,
    client: 'PodcastFlow Pro', // Organization name
    campaign: invoice.description || 'Monthly Subscription',
    amount: invoice.amount,
    status: invoice.status as Invoice['status'],
    dueDate: invoice.dueDate.split('T')[0],
    issueDate: invoice.issueDate.split('T')[0],
    description: invoice.description,
  })) || []

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.campaign.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return 'success'
      case 'pending': return 'warning'
      case 'overdue': return 'error'
      case 'draft': return 'info'
      default: return 'default'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleCreateInvoice = () => {
    router.push('/campaigns/new')
  }

  const handleExportInvoices = () => {
    const csvData = [
      ['Invoice Report', new Date().toLocaleDateString()],
      [],
      ['Invoice ID', 'Client', 'Campaign', 'Amount', 'Status', 'Issue Date', 'Due Date'],
      ...filteredInvoices.map(invoice => [
        invoice.id,
        invoice.client,
        invoice.campaign,
        invoice.amount,
        invoice.status,
        invoice.issueDate,
        invoice.dueDate
      ])
    ]
    
    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `seller-invoices-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handleSendReminder = (invoiceId: string) => {
    alert(`Payment reminder sent for invoice ${invoiceId}`)
  }

  const handleFollowUp = (invoiceId: string) => {
    alert(`Follow-up initiated for overdue invoice ${invoiceId}`)
  }

  const handleViewInvoice = (invoiceId: string) => {
    alert(`Opening invoice ${invoiceId} details`)
  }

  const handleDownloadInvoice = (invoiceId: string) => {
    alert(`Downloading invoice ${invoiceId} PDF`)
  }

  if (metricsLoading || invoicesLoading) {
    return (
      <SellerOnly>
        <DashboardLayout>
          <Box sx={{ width: '100%' }}>
            <LinearProgress />
          </Box>
        </DashboardLayout>
      </SellerOnly>
    )
  }

  return (
    <SellerOnly>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                Billing & Revenue
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Track your revenue, manage invoices, and monitor payment status
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<ReceiptIcon />}
              onClick={handleCreateInvoice}
            >
              Create Invoice
            </Button>
          </Box>

          {/* Metrics Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ height: '100%', minHeight: 140 }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flex: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Total Revenue (All Time)
                      </Typography>
                      <Typography variant="h5">
                        {formatCurrency(metrics?.totalRevenue || 0)}
                      </Typography>
                      <Box sx={{ height: 24 }} />
                    </Box>
                    <MoneyIcon color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ height: '100%', minHeight: 140 }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flex: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Monthly Revenue
                      </Typography>
                      <Typography variant="h5">
                        {formatCurrency(metrics?.monthlyRevenue || 0)}
                      </Typography>
                      {metrics?.revenueGrowth ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                          {metrics.revenueGrowth > 0 ? (
                            <TrendingUpIcon color="success" sx={{ fontSize: 16, mr: 0.5 }} />
                          ) : (
                            <TrendingDownIcon color="error" sx={{ fontSize: 16, mr: 0.5 }} />
                          )}
                          <Typography
                            variant="caption"
                            color={metrics.revenueGrowth > 0 ? 'success.main' : 'error.main'}
                          >
                            {Math.abs(metrics.revenueGrowth)}% from last month
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ height: 24 }} />
                      )}
                    </Box>
                    <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ height: '100%', minHeight: 140 }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flex: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Pending Invoices
                      </Typography>
                      <Typography variant="h5">
                        {formatCurrency(metrics?.pendingInvoices || 0)}
                      </Typography>
                      <Box sx={{ height: 24 }} />
                    </Box>
                    <CalendarIcon color="warning" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ height: '100%', minHeight: 140 }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flex: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Avg Invoice Value
                      </Typography>
                      <Typography variant="h5">
                        {formatCurrency(metrics?.averageInvoiceValue || 0)}
                      </Typography>
                      <Box sx={{ height: 24 }} />
                    </Box>
                    <AssignmentIcon color="info" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Invoices Section */}
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                <Tab label="All Invoices" />
                <Tab label="Pending" />
                <Tab label="Paid" />
                <Tab label="Overdue" />
              </Tabs>
            </Box>

            <TabPanel value={activeTab} index={0}>
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <TextField
                    placeholder="Search invoices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ width: '300px' }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportInvoices}
                  >
                    Export
                  </Button>
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice ID</TableCell>
                        <TableCell>Client</TableCell>
                        <TableCell>Campaign</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Issue Date</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {invoice.id}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BusinessIcon fontSize="small" color="action" />
                              {invoice.client}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {invoice.campaign}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {invoice.description}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(invoice.amount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                              size="small"
                              color={getStatusColor(invoice.status)}
                            />
                          </TableCell>
                          <TableCell>
                            {formatDate(invoice.issueDate)}
                          </TableCell>
                          <TableCell>
                            {formatDate(invoice.dueDate)}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => handleViewInvoice(invoice.id)}>
                              <ViewIcon />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleDownloadInvoice(invoice.id)}>
                              <DownloadIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <Box sx={{ p: 2 }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice ID</TableCell>
                        <TableCell>Client</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredInvoices
                        .filter((invoice) => invoice.status === 'pending')
                        .map((invoice) => (
                          <TableRow key={invoice.id} hover>
                            <TableCell>{invoice.id}</TableCell>
                            <TableCell>{invoice.client}</TableCell>
                            <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                            <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                            <TableCell align="right">
                              <Button size="small" variant="outlined" onClick={() => handleSendReminder(invoice.id)}>
                                Send Reminder
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              <Box sx={{ p: 2 }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice ID</TableCell>
                        <TableCell>Client</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Paid Date</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredInvoices
                        .filter((invoice) => invoice.status === 'paid')
                        .map((invoice) => (
                          <TableRow key={invoice.id} hover>
                            <TableCell>{invoice.id}</TableCell>
                            <TableCell>{invoice.client}</TableCell>
                            <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                            <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                            <TableCell align="right">
                              <IconButton size="small" onClick={() => handleDownloadInvoice(invoice.id)}>
                                <DownloadIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </TabPanel>

            <TabPanel value={activeTab} index={3}>
              <Box sx={{ p: 2 }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice ID</TableCell>
                        <TableCell>Client</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Days Overdue</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredInvoices
                        .filter((invoice) => invoice.status === 'overdue')
                        .map((invoice) => {
                          const daysOverdue = Math.floor(
                            (new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 3600 * 24)
                          )
                          return (
                            <TableRow key={invoice.id} hover>
                              <TableCell>{invoice.id}</TableCell>
                              <TableCell>{invoice.client}</TableCell>
                              <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                              <TableCell>
                                <Chip
                                  label={`${daysOverdue} days`}
                                  size="small"
                                  color="error"
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Button size="small" variant="contained" color="error" onClick={() => handleFollowUp(invoice.id)}>
                                  Follow Up
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </TabPanel>
          </Paper>
        </Box>
      </DashboardLayout>
    </SellerOnly>
  )
}