'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  LinearProgress,
  Divider,
  Alert,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  AttachMoney,
  TrendingUp,
  Receipt,
  CreditCard,
  Business as BusinessIcon,
  Analytics as AnalyticsIcon,
  CalendarToday,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { MasterOnly } from '@/components/auth/RoleGuard'
import { useQuery } from '@tanstack/react-query'
import { masterApi } from '@/services/masterApi'

interface OrganizationBillingDetail {
  organization: {
    id: string
    name: string
    plan: string
    status: string
    createdAt: string
    subscription: any
  }
  summary: {
    totalRevenue: number
    monthlyRecurring: number
    averagePaymentTime: number
    invoiceCount: number
    paidInvoices: number
    overdueAmount: number
    lastPayment: string | null
    nextDueDate: string | null
    churnRisk: 'low' | 'medium' | 'high'
    paymentSuccess: number
  }
  invoices: any[]
  metrics: {
    revenueGrowth: number
    paymentTrend: 'improving' | 'stable' | 'declining'
    riskFactors: string[]
  }
}

export default function OrganizationBillingPage() {
  const params = useParams()
  const router = useRouter()
  const organizationId = params.id as string
  const [timeRange, setTimeRange] = useState('ytd')

  // Fetch organization details
  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ['master-organization', organizationId],
    queryFn: () => masterApi.organizations.get(organizationId),
  })

  // Fetch billing data for this organization
  const { data: billingData, isLoading: billingLoading } = useQuery({
    queryKey: ['master-billing', timeRange],
    queryFn: () => masterApi.billing.getOverview(timeRange),
  })

  const isLoading = orgLoading || billingLoading

  if (isLoading) {
    return (
      <MasterOnly>
        <DashboardLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <Typography>Loading organization billing data...</Typography>
          </Box>
        </DashboardLayout>
      </MasterOnly>
    )
  }

  if (!organization) {
    return (
      <MasterOnly>
        <DashboardLayout>
          <Box sx={{ p: 3 }}>
            <Alert severity="error">
              Organization not found or you don't have permission to view it.
            </Alert>
          </Box>
        </DashboardLayout>
      </MasterOnly>
    )
  }

  // Filter invoices for this organization
  const orgInvoices = (billingData?.records || []).filter((invoice: any) => 
    invoice.organizationId === organizationId
  )

  const paidInvoices = orgInvoices.filter((inv: any) => inv.status === 'paid')
  const overdueInvoices = orgInvoices.filter((inv: any) => inv.status === 'overdue')
  const pendingInvoices = orgInvoices.filter((inv: any) => inv.status === 'pending')

  const totalRevenue = paidInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)
  const overdueAmount = overdueInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)
  const pendingAmount = pendingInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)

  // Calculate metrics
  const paymentSuccessRate = orgInvoices.length > 0 ? 
    Math.round((paidInvoices.length / orgInvoices.length) * 100) : 0

  const averageInvoiceAmount = orgInvoices.length > 0 ? 
    Math.round(orgInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0) / orgInvoices.length) : 0

  // Determine churn risk
  const hasOverdue = overdueAmount > 0
  const hasRecentPayment = paidInvoices.some((inv: any) => 
    new Date(inv.lastPayment || inv.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  )
  let churnRisk: 'low' | 'medium' | 'high' = 'low'
  if (hasOverdue && !hasRecentPayment) churnRisk = 'high'
  else if (hasOverdue || !hasRecentPayment) churnRisk = 'medium'

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
      case 'paid': return 'success'
      case 'pending': return 'warning'
      case 'overdue': return 'error'
      case 'failed': return 'error'
      case 'voided': return 'default'
      default: return 'default'
    }
  }

  return (
    <MasterOnly>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton 
              onClick={() => router.back()} 
              sx={{ mr: 2 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
                {organization.name} - Billing Analysis
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip 
                  label={organization.subscription?.planId || 'Custom'} 
                  size="small" 
                  color="primary" 
                />
                <Chip 
                  label={organization.status || 'Active'} 
                  size="small" 
                  color="success" 
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  Customer since {new Date(organization.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                label="Time Range"
              >
                <MenuItem value="ytd">Year to Date</MenuItem>
                <MenuItem value="lastmonth">Last Month</MenuItem>
                <MenuItem value="last3months">Last 3 Months</MenuItem>
                <MenuItem value="last6months">Last 6 Months</MenuItem>
                <MenuItem value="lastyear">Last Year</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Key Metrics Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AttachMoney sx={{ mr: 2, color: 'success.main' }} />
                    <Typography color="text.secondary">
                      Total Revenue
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    ${totalRevenue.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {paidInvoices.length} paid invoices
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUp sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography color="text.secondary">
                      Monthly Recurring
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    ${organization.subscription?.amount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {organization.subscription?.planId || 'Custom'} plan
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Receipt sx={{ mr: 2, color: overdueAmount > 0 ? 'error.main' : 'success.main' }} />
                    <Typography color="text.secondary">
                      Outstanding
                    </Typography>
                  </Box>
                  <Typography variant="h4" color={overdueAmount > 0 ? 'error.main' : 'text.primary'}>
                    ${(overdueAmount + pendingAmount).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${overdueAmount.toLocaleString()} overdue
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AnalyticsIcon sx={{ mr: 2, color: getChurnRiskColor(churnRisk) + '.main' }} />
                    <Typography color="text.secondary">
                      Payment Success
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {paymentSuccessRate}%
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Chip 
                      label={`${churnRisk} risk`} 
                      size="small" 
                      color={getChurnRiskColor(churnRisk) as any}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Payment Success Rate Progress */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
              Payment Performance
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Payment Success Rate
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={paymentSuccessRate} 
                    sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                    color={paymentSuccessRate > 80 ? 'success' : paymentSuccessRate > 60 ? 'warning' : 'error'}
                  />
                  <Typography variant="body2" fontWeight="bold">
                    {paymentSuccessRate}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Average Invoice Amount
                </Typography>
                <Typography variant="h6" sx={{ color: 'text.primary' }}>
                  ${averageInvoiceAmount.toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Invoices
                </Typography>
                <Typography variant="h6" sx={{ color: 'text.primary' }}>
                  {orgInvoices.length}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Risk Assessment */}
          {churnRisk !== 'low' && (
            <Alert 
              severity={churnRisk === 'high' ? 'error' : 'warning'} 
              icon={<WarningIcon />}
              sx={{ mb: 3 }}
            >
              <Typography variant="subtitle2" gutterBottom>
                {churnRisk === 'high' ? 'High Churn Risk Detected' : 'Medium Churn Risk'}
              </Typography>
              <Typography variant="body2">
                {hasOverdue && 'This organization has overdue invoices. '}
                {!hasRecentPayment && 'No recent payments detected. '}
                Consider reaching out to ensure payment method is up to date.
              </Typography>
            </Alert>
          )}

          {/* Invoices Table */}
          <Paper>
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ color: 'text.primary' }}>
                Invoice History ({orgInvoices.length} invoices)
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Payment Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orgInvoices
                    .sort((a, b) => new Date(b.createdAt || b.dueDate).getTime() - new Date(a.createdAt || a.dueDate).getTime())
                    .map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {invoice.invoiceNumber || `INV-${invoice.id.slice(-6)}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {invoice.description || 'Subscription billing'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          ${invoice.amount.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.status.toUpperCase()}
                          size="small"
                          color={getStatusColor(invoice.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {invoice.lastPayment ? new Date(invoice.lastPayment).toLocaleDateString() : '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {orgInvoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                          No invoices found for this organization
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </DashboardLayout>
    </MasterOnly>
  )
}