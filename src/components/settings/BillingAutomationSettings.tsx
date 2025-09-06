'use client'

import { useState, useEffect } from 'react'
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
  FormControlLabel,
  Switch,
  MenuItem,
  Alert,
  Skeleton,
  Divider,
  Paper,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  CreditCard as CreditCardIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface BillingSettings {
  id?: string
  organizationId: string
  defaultInvoiceDay: number
  defaultPaymentTerms: string
  autoGenerateInvoices: boolean
  invoicePrefix: string
  invoiceStartNumber: number
  lateFeePercentage: number
  gracePeriodDays: number
  preBillEnabled: boolean
  preBillThresholdAmount: number
  emailSettings: {
    sendInvoiceEmails: boolean
    sendReminderEmails: boolean
    sendOverdueEmails: boolean
    reminderDays: number[]
    emailFrom?: string
    replyTo?: string
  }
  createdAt?: string
  updatedAt?: string
}

interface PreBillAdvertiser {
  id: string
  advertiserId: string
  advertiserName: string
  reason: string
  notes?: string
  flaggedBy: string
  flaggedByName: string
  flaggedAt: string
  isActive: boolean
}

const paymentTermsOptions = [
  'Net 15',
  'Net 30', 
  'Net 45',
  'Net 60',
  'Due on Receipt',
  'COD',
]

const defaultBillingSettings: Partial<BillingSettings> = {
  defaultInvoiceDay: 1,
  defaultPaymentTerms: 'Net 30',
  autoGenerateInvoices: true,
  invoicePrefix: 'INV',
  invoiceStartNumber: 1000,
  lateFeePercentage: 1.5,
  gracePeriodDays: 5,
  preBillEnabled: true,
  preBillThresholdAmount: 10000,
  emailSettings: {
    sendInvoiceEmails: true,
    sendReminderEmails: true,
    sendOverdueEmails: true,
    reminderDays: [7, 3, 1],
  },
}

export function BillingAutomationSettings() {
  const queryClient = useQueryClient()
  const [tabValue, setTabValue] = useState(0)
  const [settingsDialog, setSettingsDialog] = useState(false)
  const [preBillDialog, setPreBillDialog] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [settingsForm, setSettingsForm] = useState<BillingSettings>(defaultBillingSettings as BillingSettings)
  const [preBillForm, setPreBillForm] = useState({
    advertiserId: '',
    reason: '',
    notes: '',
  })

  // Fetch billing settings
  const { data: billingSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['billing-settings'],
    queryFn: async () => {
      const response = await fetch('/api/billing/settings')
      if (!response.ok) {
        throw new Error('Failed to fetch billing settings')
      }
      const data = await response.json()
      return data.settings
    },
  })

  // Fetch pre-bill advertisers
  const { data: preBillAdvertisers, isLoading: preBillLoading } = useQuery({
    queryKey: ['pre-bill-advertisers'],
    queryFn: async () => {
      const response = await fetch('/api/billing/pre-bill')
      if (!response.ok) {
        throw new Error('Failed to fetch pre-bill advertisers')
      }
      const data = await response.json()
      return data.advertisers || []
    },
  })

  // Fetch advertisers for dropdown
  const { data: advertisers } = useQuery({
    queryKey: ['advertisers-simple'],
    queryFn: async () => {
      const response = await fetch('/api/advertisers?simple=true')
      if (!response.ok) {
        throw new Error('Failed to fetch advertisers')
      }
      const data = await response.json()
      return data.advertisers || []
    },
  })

  // Update billing settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: BillingSettings) => {
      const response = await fetch('/api/billing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update settings')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-settings'] })
      setSuccess('Billing settings updated successfully')
      setSettingsDialog(false)
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update settings')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Add pre-bill advertiser
  const addPreBillMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/billing/pre-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to flag advertiser')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-bill-advertisers'] })
      setSuccess('Advertiser flagged for pre-billing')
      setPreBillDialog(false)
      setPreBillForm({ advertiserId: '', reason: '', notes: '' })
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to flag advertiser')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Remove pre-bill advertiser
  const removePreBillMutation = useMutation({
    mutationFn: async (advertiserId: string) => {
      const response = await fetch(`/api/billing/pre-bill/${advertiserId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove flag')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-bill-advertisers'] })
      setSuccess('Advertiser unflagged')
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to remove flag')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Load settings into form when data is available
  useEffect(() => {
    if (billingSettings) {
      setSettingsForm({
        ...defaultBillingSettings,
        ...billingSettings,
      } as BillingSettings)
    }
  }, [billingSettings])

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(settingsForm)
  }

  const handleAddPreBill = () => {
    if (!preBillForm.advertiserId || !preBillForm.reason) {
      setError('Please select an advertiser and provide a reason')
      return
    }
    addPreBillMutation.mutate(preBillForm)
  }

  const handleRemovePreBill = (advertiserId: string) => {
    if (window.confirm('Are you sure you want to remove this pre-bill requirement?')) {
      removePreBillMutation.mutate(advertiserId)
    }
  }

  const isLoading = settingsLoading || preBillLoading

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="rectangular" width={120} height={36} />
          </Box>
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ mb: 2 }}>
              <Skeleton variant="rectangular" width="100%" height={80} />
            </Box>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Box>
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

      <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} sx={{ mb: 3 }}>
        <Tab label="Billing Settings" icon={<SettingsIcon />} />
        <Tab label="Pre-Bill Advertisers" icon={<WarningIcon />} />
      </Tabs>

      {tabValue === 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">
                Billing Automation Settings
              </Typography>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setSettingsDialog(true)}
              >
                Edit Settings
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
              Configure automatic invoice generation, payment terms, and billing notifications.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon />
                    Invoice Settings
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Default Invoice Day:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {billingSettings?.defaultInvoiceDay || 1}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Payment Terms:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {billingSettings?.defaultPaymentTerms || 'Net 30'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Invoice Prefix:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {billingSettings?.invoicePrefix || 'INV'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Auto Generate:</Typography>
                      <Chip
                        label={billingSettings?.autoGenerateInvoices ? 'Enabled' : 'Disabled'}
                        color={billingSettings?.autoGenerateInvoices ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CreditCardIcon />
                    Pre-Bill Settings
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Pre-Bill Enabled:</Typography>
                      <Chip
                        label={billingSettings?.preBillEnabled ? 'Enabled' : 'Disabled'}
                        color={billingSettings?.preBillEnabled ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Threshold Amount:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        ${billingSettings?.preBillThresholdAmount?.toLocaleString() || '10,000'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Flagged Advertisers:</Typography>
                      <Chip
                        label={preBillAdvertisers?.length || 0}
                        color={preBillAdvertisers?.length > 0 ? 'warning' : 'default'}
                        size="small"
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon />
                    Email Notifications
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Invoice Emails:</Typography>
                      <Chip
                        label={billingSettings?.emailSettings?.sendInvoiceEmails ? 'Enabled' : 'Disabled'}
                        color={billingSettings?.emailSettings?.sendInvoiceEmails ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Reminder Emails:</Typography>
                      <Chip
                        label={billingSettings?.emailSettings?.sendReminderEmails ? 'Enabled' : 'Disabled'}
                        color={billingSettings?.emailSettings?.sendReminderEmails ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Reminder Days:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {billingSettings?.emailSettings?.reminderDays?.join(', ') || '7, 3, 1'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon />
                    Late Fees
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Late Fee Percentage:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {billingSettings?.lateFeePercentage || 0}% per month
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Grace Period:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {billingSettings?.gracePeriodDays || 5} days
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">
                Pre-Bill Advertisers
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setPreBillDialog(true)}
              >
                Flag Advertiser
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
              Advertisers flagged for pre-billing will require payment before campaigns can be activated.
            </Typography>

            <List>
              {preBillAdvertisers?.map((advertiser: PreBillAdvertiser) => (
                <ListItem
                  key={advertiser.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'warning.light',
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: 'warning.light',
                    opacity: 0.1,
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningIcon color="warning" />
                        <Typography variant="subtitle1">{advertiser.advertiserName}</Typography>
                        {!advertiser.isActive && (
                          <Chip label="Inactive" size="small" color="default" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Reason:</strong> {advertiser.reason}
                        </Typography>
                        {advertiser.notes && (
                          <Typography variant="body2" color="text.secondary">
                            <strong>Notes:</strong> {advertiser.notes}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          Flagged by {advertiser.flaggedByName} on {new Date(advertiser.flaggedAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={() => handleRemovePreBill(advertiser.advertiserId)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              )) || []}
            </List>

            {!preBillAdvertisers?.length && (
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
                <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  No advertisers flagged for pre-billing
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  All advertisers can proceed with normal payment terms
                </Typography>
              </Paper>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsDialog} onClose={() => setSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Billing Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <Typography variant="h6">Invoice Settings</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Default Invoice Day"
                  type="number"
                  fullWidth
                  value={settingsForm.defaultInvoiceDay}
                  onChange={(e) => setSettingsForm({ ...settingsForm, defaultInvoiceDay: parseInt(e.target.value) })}
                  inputProps={{ min: 1, max: 28 }}
                  helperText="Day of month to generate invoices"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Default Payment Terms"
                  fullWidth
                  value={settingsForm.defaultPaymentTerms}
                  onChange={(e) => setSettingsForm({ ...settingsForm, defaultPaymentTerms: e.target.value })}
                >
                  {paymentTermsOptions.map((term) => (
                    <MenuItem key={term} value={term}>
                      {term}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Invoice Prefix"
                  fullWidth
                  value={settingsForm.invoicePrefix}
                  onChange={(e) => setSettingsForm({ ...settingsForm, invoicePrefix: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Invoice Start Number"
                  type="number"
                  fullWidth
                  value={settingsForm.invoiceStartNumber}
                  onChange={(e) => setSettingsForm({ ...settingsForm, invoiceStartNumber: parseInt(e.target.value) })}
                />
              </Grid>
            </Grid>

            <FormControlLabel
              control={
                <Switch
                  checked={settingsForm.autoGenerateInvoices}
                  onChange={(e) => setSettingsForm({ ...settingsForm, autoGenerateInvoices: e.target.checked })}
                />
              }
              label="Automatically generate invoices"
            />

            <Divider />

            <Typography variant="h6">Pre-Bill Settings</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settingsForm.preBillEnabled}
                  onChange={(e) => setSettingsForm({ ...settingsForm, preBillEnabled: e.target.checked })}
                />
              }
              label="Enable pre-billing requirements"
            />

            <TextField
              label="Pre-Bill Threshold Amount"
              type="number"
              fullWidth
              value={settingsForm.preBillThresholdAmount}
              onChange={(e) => setSettingsForm({ ...settingsForm, preBillThresholdAmount: parseFloat(e.target.value) })}
              helperText="Orders above this amount may require pre-payment"
            />

            <Divider />

            <Typography variant="h6">Late Fees</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Late Fee Percentage"
                  type="number"
                  fullWidth
                  value={settingsForm.lateFeePercentage}
                  onChange={(e) => setSettingsForm({ ...settingsForm, lateFeePercentage: parseFloat(e.target.value) })}
                  inputProps={{ min: 0, max: 10, step: 0.1 }}
                  helperText="Percentage per month"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Grace Period (days)"
                  type="number"
                  fullWidth
                  value={settingsForm.gracePeriodDays}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gracePeriodDays: parseInt(e.target.value) })}
                  inputProps={{ min: 0, max: 30 }}
                />
              </Grid>
            </Grid>

            <Divider />

            <Typography variant="h6">Email Notifications</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settingsForm.emailSettings?.sendInvoiceEmails}
                    onChange={(e) => setSettingsForm({
                      ...settingsForm,
                      emailSettings: { ...settingsForm.emailSettings, sendInvoiceEmails: e.target.checked }
                    })}
                  />
                }
                label="Send invoice emails"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settingsForm.emailSettings?.sendReminderEmails}
                    onChange={(e) => setSettingsForm({
                      ...settingsForm,
                      emailSettings: { ...settingsForm.emailSettings, sendReminderEmails: e.target.checked }
                    })}
                  />
                }
                label="Send payment reminder emails"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settingsForm.emailSettings?.sendOverdueEmails}
                    onChange={(e) => setSettingsForm({
                      ...settingsForm,
                      emailSettings: { ...settingsForm.emailSettings, sendOverdueEmails: e.target.checked }
                    })}
                  />
                }
                label="Send overdue emails"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
          >
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pre-Bill Dialog */}
      <Dialog open={preBillDialog} onClose={() => setPreBillDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Flag Advertiser for Pre-Billing</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              select
              label="Advertiser"
              fullWidth
              value={preBillForm.advertiserId}
              onChange={(e) => setPreBillForm({ ...preBillForm, advertiserId: e.target.value })}
              required
            >
              {advertisers?.map((advertiser: any) => (
                <MenuItem key={advertiser.id} value={advertiser.id}>
                  {advertiser.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Reason"
              fullWidth
              value={preBillForm.reason}
              onChange={(e) => setPreBillForm({ ...preBillForm, reason: e.target.value })}
              required
              helperText="Why does this advertiser require pre-billing?"
            />
            <TextField
              label="Additional Notes"
              fullWidth
              multiline
              rows={3}
              value={preBillForm.notes}
              onChange={(e) => setPreBillForm({ ...preBillForm, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreBillDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddPreBill}
            disabled={!preBillForm.advertiserId || !preBillForm.reason || addPreBillMutation.isPending}
          >
            Flag Advertiser
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}