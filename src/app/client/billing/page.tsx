'use client'

import { 
  Box, 
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
  Paper,
  Chip,
  Button,
  Alert,
  Divider
} from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { 
  AttachMoney, 
  Receipt, 
  AccountBalance,
  CreditCard,
  Download,
  Warning
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { campaignApi, api } from '@/services/api'

export default function ClientBillingPage() {
  const { user } = useAuth()

  // Fetch campaigns to calculate billing
  const { data: campaignsData } = useQuery({
    queryKey: ['client', 'campaigns', user?.organizationId],
    queryFn: async () => {
      const response = await campaignApi.list({ organizationId: user?.organizationId })
      return response
    },
    enabled: !!user?.organizationId
  })

  // Calculate billing data from campaigns
  const { data: billingData, isLoading } = useQuery({
    queryKey: ['client-billing', user?.id, campaignsData],
    queryFn: async () => {
      if (!campaignsData?.campaigns) {
        return {
          currentBalance: 0,
          totalSpent: 0,
          nextPayment: null,
          invoices: [],
          paymentMethod: null
        }
      }

      const campaigns = campaignsData.campaigns
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()

      // Calculate total spent from all campaigns
      const totalSpent = campaigns.reduce((sum: number, campaign: any) => {
        return sum + (campaign.budget || 0)
      }, 0)

      // Calculate current balance (pending campaigns)
      const currentBalance = campaigns
        .filter((c: any) => c.status === 'active' || c.status === 'pending')
        .reduce((sum: number, campaign: any) => {
          return sum + (campaign.budget || 0)
        }, 0)

      // Generate invoices from campaigns
      const invoices = campaigns
        .filter((c: any) => c.budget && c.budget > 0)
        .map((campaign: any) => {
          const createdDate = new Date(campaign.createdAt)
          let status = 'pending'
          if (campaign.status === 'completed') status = 'paid'
          else if (campaign.status === 'cancelled') status = 'cancelled'
          else if (createdDate < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) status = 'overdue'
          
          return {
            id: `INV-${campaign.id.slice(-8).toUpperCase()}`,
            date: createdDate.toISOString().split('T')[0],
            amount: campaign.budget,
            status: status,
            description: `${campaign.name} - ${campaign.type || 'Campaign'} Spend`
          }
        })
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Calculate next payment (active campaigns due in next 30 days)
      const activeCampaigns = campaigns.filter((c: any) => c.status === 'active')
      const nextPaymentAmount = activeCampaigns.reduce((sum: number, c: any) => sum + (c.budget || 0), 0)
      const nextPayment = nextPaymentAmount > 0 ? {
        amount: nextPaymentAmount,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      } : null

      // TODO: Implement real payment method API
      const paymentMethod = null

      return {
        currentBalance,
        totalSpent,
        nextPayment,
        invoices,
        paymentMethod
      }
    },
    enabled: !!user && !!campaignsData
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success'
      case 'pending': return 'warning'
      case 'overdue': return 'error'
      default: return 'default'
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <RoleGuard roles={['client', 'admin']}>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography>Loading billing information...</Typography>
          </Box>
        </RoleGuard>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <RoleGuard roles={['client', 'admin']}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Billing & Payments
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Manage your billing information and view payment history
          </Typography>

          {/* Overview Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AccountBalance sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Current Balance
                    </Typography>
                  </Box>
                  <Typography variant="h4">
                    ${billingData?.currentBalance?.toLocaleString() || '0'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AttachMoney sx={{ mr: 2, color: 'success.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Total Spent
                    </Typography>
                  </Box>
                  <Typography variant="h4">
                    ${billingData?.totalSpent?.toLocaleString() || '0'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Receipt sx={{ mr: 2, color: 'info.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Next Payment
                    </Typography>
                  </Box>
                  <Typography variant="h5">
                    ${billingData?.nextPayment?.amount?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Due {billingData?.nextPayment?.dueDate || 'N/A'}
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
                      Payment Method
                    </Typography>
                  </Box>
                  <Typography variant="h6">
                    •••• {billingData?.paymentMethod?.last4 || '****'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Expires {billingData?.paymentMethod?.expiryDate || 'N/A'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Overdue Alert */}
          {billingData?.invoices?.some((inv: any) => inv.status === 'overdue') && (
            <Alert severity="warning" sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Warning sx={{ mr: 1 }} />
                You have overdue invoices. Please contact your account manager to resolve payment issues.
              </Box>
            </Alert>
          )}

          {/* Invoices Table */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Invoice History
                </Typography>
                <Button variant="outlined" size="small">
                  Download All
                </Button>
              </Box>
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice ID</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {billingData?.invoices?.map((invoice: any) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {invoice.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {new Date(invoice.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{invoice.description}</TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="medium">
                            ${invoice.amount.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={invoice.status} 
                            color={getStatusColor(invoice.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button 
                            size="small" 
                            startIcon={<Download />}
                            variant="outlined"
                          >
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Information
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Billing Contact
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user?.name || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user?.email || 'N/A'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Payment Terms
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Net 30 days
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Automatic billing on campaign completion
                  </Typography>
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 3 }}>
                <Button variant="outlined" sx={{ mr: 2 }}>
                  Update Payment Method
                </Button>
                <Button variant="outlined">
                  Update Billing Information
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </RoleGuard>
    </DashboardLayout>
  )
}