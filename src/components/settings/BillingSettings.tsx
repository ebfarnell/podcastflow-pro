import { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  LinearProgress,
  Skeleton,
} from '@mui/material'
import {
  CreditCard as CreditCardIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  Upgrade as UpgradeIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '@/services/api'

interface PaymentMethod {
  id: string
  type: 'card' | 'bank'
  last4: string
  brand?: string
  isDefault: boolean
  expiryMonth?: number
  expiryYear?: number
}

interface Invoice {
  id: string
  date: string
  amount: number
  status: 'paid' | 'pending' | 'failed'
  description: string
}

interface Plan {
  id: string
  name: string
  price: number
  interval: 'monthly' | 'yearly'
  features: string[]
  isCurrent?: boolean
  isPopular?: boolean
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    interval: 'monthly',
    features: [
      'Up to 5 campaigns',
      'Basic analytics',
      '1 team member',
      'Email support',
      'Standard integrations',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 149,
    interval: 'monthly',
    features: [
      'Up to 20 campaigns',
      'Advanced analytics',
      '5 team members',
      'Priority support',
      'All integrations',
      'Custom reports',
    ],
    isPopular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499,
    interval: 'monthly',
    features: [
      'Unlimited campaigns',
      'Advanced analytics & AI insights',
      'Unlimited team members',
      'Dedicated support',
      'All integrations',
      'Custom reports',
      'API access',
      'White-label options',
    ],
    isCurrent: true,
  },
]

export function BillingSettings() {
  const queryClient = useQueryClient()
  const [paymentDialog, setPaymentDialog] = useState(false)
  const [planDialog, setPlanDialog] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    zipCode: '',
  })

  // Fetch billing data
  const { data: billingData, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: async () => {
      try {
        const [overview, usage, invoices] = await Promise.all([
          billingApi.getOverview(),
          billingApi.getUsage(),
          billingApi.getInvoices()
        ])
        
        return {
          currentPlan: {
            id: overview.planId || 'enterprise',
            name: overview.planName || 'Enterprise',
            price: overview.planPrice || 499,
            interval: overview.planInterval || 'monthly',
            features: overview.planFeatures || plans.find(p => p.id === 'enterprise')?.features || []
          },
          usage: {
            campaigns: usage.campaigns || 0,
            campaignsLimit: usage.campaignsLimit || -1,
            storage: usage.storage || 0,
            storageLimit: usage.storageLimit || 10,
          },
          nextBillingDate: overview.nextBillingDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          paymentMethods: (overview.paymentMethods || []).map((method: any) => ({
            id: method.id,
            type: method.type || 'card',
            last4: method.last4,
            brand: method.brand,
            isDefault: method.isDefault || false,
            expiryMonth: method.expiryMonth,
            expiryYear: method.expiryYear,
          })) as PaymentMethod[],
          invoices: (invoices.invoices || invoices || []).map((invoice: any) => ({
            id: invoice.id || invoice.invoiceId,
            date: invoice.issueDate || invoice.date || invoice.createdAt,
            amount: invoice.amount || invoice.total,
            status: invoice.status || 'paid',
            description: invoice.description || `${overview.planName || 'Plan'} - ${new Date(invoice.issueDate || invoice.date || invoice.createdAt).toLocaleDateString()}`,
          })) as Invoice[],
        }
      } catch (error) {
        console.error('Error fetching billing data:', error)
        // Fallback to mock data on error
        return {
          currentPlan: plans.find(p => p.isCurrent),
          usage: {
            campaigns: 0,
            campaignsLimit: -1,
            storage: 0,
            storageLimit: 10,
          },
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          paymentMethods: [] as PaymentMethod[],
          invoices: [] as Invoice[],
        }
      }
    },
  })

  // Add payment method
  const addPaymentMethodMutation = useMutation({
    mutationFn: async (data: typeof paymentForm) => {
      // Validate card number
      if (data.cardNumber.replace(/\s/g, '').length !== 16) {
        throw new Error('Invalid card number')
      }
      
      // Use real API call
      return await billingApi.addPaymentMethod({
        cardNumber: data.cardNumber.replace(/\s/g, ''),
        expiryMonth: parseInt(data.expiryMonth),
        expiryYear: parseInt(data.expiryYear) + 2000, // Convert YY to YYYY
        cvv: data.cvv,
        zipCode: data.zipCode,
        brand: getCardBrand(data.cardNumber)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] })
      setSuccess('Payment method added successfully!')
      setPaymentDialog(false)
      setPaymentForm({
        cardNumber: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        zipCode: '',
      })
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to add payment method')
    },
  })

  // Remove payment method
  const removePaymentMethodMutation = useMutation({
    mutationFn: async (methodId: string) => {
      return await billingApi.removePaymentMethod(methodId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] })
      setSuccess('Payment method removed')
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to remove payment method')
    },
  })

  // Change plan
  const changePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const plan = plans.find(p => p.id === planId)
      if (!plan) {
        throw new Error('Invalid plan selected')
      }
      
      return await billingApi.updateSubscription({
        planId,
        planName: plan.name,
        planPrice: plan.price,
        planInterval: plan.interval
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] })
      setSuccess('Plan updated successfully!')
      setPlanDialog(false)
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update plan')
    },
  })

  const handleAddPaymentMethod = () => {
    addPaymentMethodMutation.mutate(paymentForm)
  }

  const handleChangePlan = () => {
    if (selectedPlan) {
      changePlanMutation.mutate(selectedPlan.id)
    }
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ''
    const parts = []

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }

    if (parts.length) {
      return parts.join(' ')
    } else {
      return value
    }
  }

  const getCardBrand = (number: string) => {
    const firstDigit = number.charAt(0)
    if (firstDigit === '4') return 'Visa'
    if (firstDigit === '5') return 'Mastercard'
    if (firstDigit === '3') return 'Amex'
    return 'Card'
  }

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const response = await billingApi.getInvoices()
      const invoice = response.find((inv: any) => inv.id === invoiceId)
      if (invoice?.downloadUrl) {
        window.open(invoice.downloadUrl, '_blank')
      } else {
        setError('Invoice download is not available')
        setTimeout(() => setError(null), 3000)
      }
    } catch (error) {
      setError('Failed to download invoice')
      setTimeout(() => setError(null), 3000)
    }
  }

  if (isLoading) {
    return (
      <>
        {/* Current Plan Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Skeleton variant="text" width={120} height={32} />
              <Skeleton variant="rectangular" width={120} height={36} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Skeleton variant="rectangular" width={100} height={32} />
              <Skeleton variant="text" width={80} height={40} />
            </Box>
            <Skeleton variant="text" width={200} />
            <Box sx={{ mt: 3 }}>
              <Skeleton variant="text" width={60} />
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="rectangular" width="100%" height={4} sx={{ mt: 1 }} />
            </Box>
          </CardContent>
        </Card>

        {/* Payment Methods Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Skeleton variant="text" width={150} />
              <Skeleton variant="rectangular" width={120} height={32} />
            </Box>
            {[1, 2].map((i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="circular" width={24} height={24} sx={{ mr: 2 }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width={150} />
                  <Skeleton variant="text" width={100} />
                </Box>
                <Skeleton variant="circular" width={24} height={24} />
              </Box>
            ))}
          </CardContent>
        </Card>

        {/* Billing History Skeleton */}
        <Card>
          <CardContent>
            <Skeleton variant="text" width={140} sx={{ mb: 2 }} />
            {[1, 2, 3].map((i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="text" width={100} />
                <Skeleton variant="text" width={200} />
                <Skeleton variant="text" width={60} />
                <Skeleton variant="rectangular" width={60} height={24} />
                <Skeleton variant="circular" width={24} height={24} />
              </Box>
            ))}
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      {/* Current Plan */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Current Plan
            </Typography>
            <Button
              variant="outlined"
              startIcon={<UpgradeIcon />}
              onClick={() => setPlanDialog(true)}
            >
              Change Plan
            </Button>
          </Box>

          {success && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Chip
              label={billingData?.currentPlan?.name}
              color="primary"
              icon={<StarIcon />}
            />
            <Typography variant="h4">
              ${billingData?.currentPlan?.price}
              <Typography component="span" variant="body2" color="textSecondary">
                /{billingData?.currentPlan?.interval}
              </Typography>
            </Typography>
          </Box>

          <Typography variant="body2" color="textSecondary" gutterBottom>
            Next billing date: {new Date(billingData?.nextBillingDate || '').toLocaleDateString()}
          </Typography>

          {/* Usage */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Usage
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Active Campaigns</Typography>
                <Typography variant="body2">
                  {billingData?.usage.campaigns}
                  {billingData?.usage.campaignsLimit && billingData.usage.campaignsLimit > 0 && ` / ${billingData.usage.campaignsLimit}`}
                </Typography>
              </Box>
              {billingData?.usage.campaignsLimit && billingData.usage.campaignsLimit > 0 && (
                <LinearProgress
                  variant="determinate"
                  value={(billingData.usage.campaigns / billingData.usage.campaignsLimit) * 100}
                />
              )}
            </Box>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Storage Used</Typography>
                <Typography variant="body2">
                  {billingData?.usage.storage} GB / {billingData?.usage.storageLimit} GB
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(billingData?.usage.storage || 0) / (billingData?.usage.storageLimit || 1) * 100}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Payment Methods
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setPaymentDialog(true)}
            >
              Add Method
            </Button>
          </Box>

          <List>
            {billingData?.paymentMethods.map((method, index) => (
              <div key={method.id}>
                <ListItem>
                  <CreditCardIcon sx={{ mr: 2, color: 'text.secondary' }} />
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {method.brand} •••• {method.last4}
                        {method.isDefault && (
                          <Chip label="Default" size="small" color="primary" />
                        )}
                      </Box>
                    }
                    secondary={`Expires ${method.expiryMonth}/${method.expiryYear}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => removePaymentMethodMutation.mutate(method.id)}
                      disabled={method.isDefault}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < billingData.paymentMethods.length - 1 && <Divider />}
              </div>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Billing History
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Invoice</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {billingData?.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {new Date(invoice.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{invoice.description}</TableCell>
                    <TableCell>${invoice.amount}</TableCell>
                    <TableCell>
                      <Chip
                        label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        color={invoice.status === 'paid' ? 'success' : invoice.status === 'pending' ? 'warning' : 'error'}
                        size="small"
                        icon={invoice.status === 'paid' ? <CheckCircleIcon /> : <CancelIcon />}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton 
                        size="small"
                        onClick={() => handleDownloadInvoice(invoice.id)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add Payment Method Dialog */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Payment Method</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Card Number"
              fullWidth
              value={paymentForm.cardNumber}
              onChange={(e) => setPaymentForm({ ...paymentForm, cardNumber: formatCardNumber(e.target.value) })}
              inputProps={{ maxLength: 19 }}
              helperText={paymentForm.cardNumber && getCardBrand(paymentForm.cardNumber)}
            />
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  label="Month"
                  fullWidth
                  value={paymentForm.expiryMonth}
                  onChange={(e) => setPaymentForm({ ...paymentForm, expiryMonth: e.target.value })}
                  placeholder="MM"
                  inputProps={{ maxLength: 2 }}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Year"
                  fullWidth
                  value={paymentForm.expiryYear}
                  onChange={(e) => setPaymentForm({ ...paymentForm, expiryYear: e.target.value })}
                  placeholder="YY"
                  inputProps={{ maxLength: 2 }}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="CVV"
                  fullWidth
                  value={paymentForm.cvv}
                  onChange={(e) => setPaymentForm({ ...paymentForm, cvv: e.target.value })}
                  inputProps={{ maxLength: 4 }}
                />
              </Grid>
            </Grid>
            <TextField
              label="ZIP/Postal Code"
              fullWidth
              value={paymentForm.zipCode}
              onChange={(e) => setPaymentForm({ ...paymentForm, zipCode: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddPaymentMethod}
            disabled={
              !paymentForm.cardNumber ||
              !paymentForm.expiryMonth ||
              !paymentForm.expiryYear ||
              !paymentForm.cvv ||
              addPaymentMethodMutation.isPending
            }
          >
            Add Card
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={planDialog} onClose={() => setPlanDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Choose Your Plan</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ pt: 2 }}>
            {plans.map((plan) => (
              <Grid item xs={12} md={4} key={plan.id}>
                <Card
                  variant={plan.isCurrent ? 'elevation' : 'outlined'}
                  sx={{
                    position: 'relative',
                    cursor: plan.isCurrent ? 'default' : 'pointer',
                    borderColor: selectedPlan?.id === plan.id ? 'primary.main' : undefined,
                    borderWidth: selectedPlan?.id === plan.id ? 2 : 1,
                  }}
                  onClick={() => !plan.isCurrent && setSelectedPlan(plan)}
                >
                  {plan.isPopular && (
                    <Chip
                      label="Most Popular"
                      color="primary"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                      }}
                    />
                  )}
                  {plan.isCurrent && (
                    <Chip
                      label="Current Plan"
                      color="success"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                      }}
                    />
                  )}
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {plan.name}
                    </Typography>
                    <Typography variant="h3" gutterBottom>
                      ${plan.price}
                      <Typography component="span" variant="body2" color="textSecondary">
                        /month
                      </Typography>
                    </Typography>
                    <List dense>
                      {plan.features.map((feature, index) => (
                        <ListItem key={index} disableGutters>
                          <CheckCircleIcon sx={{ mr: 1, fontSize: 20, color: 'success.main' }} />
                          <ListItemText primary={feature} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlanDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleChangePlan}
            disabled={!selectedPlan || changePlanMutation.isPending}
          >
            Change to {selectedPlan?.name} Plan
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}