'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Grid,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Skeleton,
} from '@mui/material'
import {
  Email as EmailIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CloudQueue as CloudIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Send as SendIcon,
  Block as BlockIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import EmailAnalyticsDashboard from '@/components/email/EmailAnalyticsDashboard'

interface PlatformEmailSettings {
  id: string | null
  provider: 'ses' | 'smtp' | null
  sesConfig: {
    configured: boolean
    region?: string | null
    accessKeyId?: string
    secretAccessKey?: string
    useIAMRole: boolean
    sandboxMode?: boolean
  }
  smtpConfig: {
    configured: boolean
    host?: string | null
    port?: number | null
    secure?: boolean
    auth?: {
      user?: string
      pass?: string
    }
  }
  quotaLimits: {
    dailyQuota: number
    sendRate: number
    maxRecipients: number
  }
  monitoring: {
    trackOpens: boolean
    trackClicks: boolean
    trackBounces: boolean
    trackComplaints: boolean
  }
  suppressionList: {
    enabled: boolean
    autoAddBounces: boolean
    autoAddComplaints: boolean
  }
  isConfigured: boolean
}

interface EmailMetrics {
  hasData: boolean
  message?: string
  metrics?: {
    sent: number
    delivered: number
    bounced: number
    complained: number
    opened: number
    clicked: number
    failed: number
    pending: number
    queued: number
  }
  recentEmails?: Array<{
    id: string
    recipient: string
    subject?: string
    status: string
    sentAt?: string
    templateKey?: string
    errorMessage?: string
  }>
  errorRate?: number
  deliveryRate?: number
  quota?: {
    dailyQuota: number
    usedToday: number
    remainingToday: number
    percentUsed: number
  }
}

interface SuppressionListEntry {
  id: string
  email: string
  reason: 'bounce' | 'complaint' | 'manual' | 'unsubscribe'
  source?: string
  addedAt: string
  addedBy?: {
    id: string
    name: string
    email: string
  }
}

export function MasterEmailSettings() {
  const queryClient = useQueryClient()
  const [showSecrets, setShowSecrets] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testEmailDialog, setTestEmailDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [addSuppressionDialog, setAddSuppressionDialog] = useState(false)
  const [suppressionEmail, setSuppressionEmail] = useState('')
  const [suppressionReason, setSuppressionReason] = useState<'bounce' | 'complaint' | 'manual' | 'unsubscribe'>('manual')
  
  // Local settings state
  const [settings, setSettings] = useState<PlatformEmailSettings | null>(null)

  // Fetch platform email settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['platform-email-settings'],
    queryFn: async () => {
      const response = await api.get('/api/master/email-settings')
      return response.data
    },
  })

  // Fetch email metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['platform-email-metrics'],
    queryFn: async () => {
      const response = await api.get('/api/master/email-settings/metrics')
      return response.data as EmailMetrics
    },
    refetchInterval: 60000, // Refresh every minute
  })

  // Fetch suppression list
  const { data: suppressionData, isLoading: suppressionLoading } = useQuery({
    queryKey: ['platform-email-suppression'],
    queryFn: async () => {
      const response = await api.get('/api/master/email-settings/suppression')
      return response.data
    },
  })

  // Update settings when data is loaded
  useEffect(() => {
    if (settingsData?.settings) {
      setSettings(settingsData.settings)
    }
  }, [settingsData])

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: PlatformEmailSettings) => {
      const response = await api.put('/api/master/email-settings', data)
      return response.data
    },
    onSuccess: () => {
      setSuccess('Platform email settings saved successfully!')
      queryClient.invalidateQueries({ queryKey: ['platform-email-settings'] })
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to save platform email settings')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post('/api/master/email-settings/test', { testEmail: email })
      return response.data
    },
    onSuccess: () => {
      setSuccess('Test email sent successfully!')
      setTestEmailDialog(false)
      setTestEmail('')
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to send test email')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Add to suppression list mutation
  const addSuppressionMutation = useMutation({
    mutationFn: async (data: { email: string; reason: string; source?: string }) => {
      const response = await api.post('/api/master/email-settings/suppression', data)
      return response.data
    },
    onSuccess: () => {
      setSuccess('Email added to suppression list')
      setAddSuppressionDialog(false)
      setSuppressionEmail('')
      queryClient.invalidateQueries({ queryKey: ['platform-email-suppression'] })
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to add to suppression list')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Remove from suppression list mutation
  const removeSuppressionMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/master/email-settings/suppression/${id}`)
    },
    onSuccess: () => {
      setSuccess('Email removed from suppression list')
      queryClient.invalidateQueries({ queryKey: ['platform-email-suppression'] })
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to remove from suppression list')
      setTimeout(() => setError(null), 5000)
    },
  })

  const handleSaveSettings = () => {
    if (!settings) return
    saveSettingsMutation.mutate(settings)
  }

  const handleTestEmail = () => {
    if (!testEmail || !testEmail.includes('@')) {
      setError('Please enter a valid email address')
      setTimeout(() => setError(null), 3000)
      return
    }
    testEmailMutation.mutate(testEmail)
  }

  const handleAddSuppression = () => {
    if (!suppressionEmail || !suppressionEmail.includes('@')) {
      setError('Please enter a valid email address')
      setTimeout(() => setError(null), 3000)
      return
    }
    addSuppressionMutation.mutate({
      email: suppressionEmail,
      reason: suppressionReason,
      source: 'manual_admin'
    })
  }

  if (settingsLoading || !settings) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={400} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    )
  }

  // Get health status
  const healthStatus = !settingsData?.configured 
    ? 'error' 
    : metricsData?.metrics && metricsData.errorRate && metricsData.errorRate > 5
    ? 'warning'
    : 'healthy'

  return (
    <>
      {/* Platform Email Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Platform Email Service Status
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                onClick={() => setTestEmailDialog(true)}
                disabled={!settingsData?.configured}
              >
                Send Test Email
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['platform-email-settings'] })
                  queryClient.invalidateQueries({ queryKey: ['platform-email-metrics'] })
                }}
              >
                Refresh
              </Button>
            </Box>
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

          {!settingsData?.configured && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Email system not configured. Please configure email provider settings below to enable email functionality.
            </Alert>
          )}

          {metricsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : !metricsData?.hasData ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              {metricsData?.message || 'No email activity yet'}
            </Alert>
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Chip
                    label={healthStatus === 'healthy' ? 'Healthy' : healthStatus === 'warning' ? 'Warning' : 'Error'}
                    color={healthStatus === 'healthy' ? 'success' : healthStatus === 'warning' ? 'warning' : 'error'}
                    icon={healthStatus === 'healthy' ? <CheckCircleIcon /> : healthStatus === 'warning' ? <WarningIcon /> : <ErrorIcon />}
                    sx={{ mb: 2 }}
                  />
                  <Typography variant="h4">
                    {metricsData.metrics?.sent.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Emails sent (30d)
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    Delivery Rate
                  </Typography>
                  <Typography variant="h4" color={metricsData.deliveryRate && metricsData.deliveryRate < 95 ? 'warning.main' : 'success.main'}>
                    {metricsData.deliveryRate?.toFixed(1) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {metricsData.metrics?.delivered.toLocaleString() || '0'} delivered
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    Quota Usage
                  </Typography>
                  <Typography variant="h4" color={metricsData.quota && metricsData.quota.percentUsed > 80 ? 'error.main' : 'primary.main'}>
                    {metricsData.quota?.percentUsed.toFixed(1) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {metricsData.quota?.usedToday.toLocaleString() || '0'} / {metricsData.quota?.dailyQuota.toLocaleString() || '0'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Email Provider Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Email Provider Configuration
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Email Provider</InputLabel>
            <Select
              value={settings.provider || 'ses'}
              label="Email Provider"
              onChange={(e) => setSettings({ ...settings, provider: e.target.value as 'ses' | 'smtp' })}
            >
              <MenuItem value="ses">Amazon SES</MenuItem>
              <MenuItem value="smtp">SMTP Server</MenuItem>
            </Select>
          </FormControl>

          {settings.provider === 'ses' ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>AWS Region</InputLabel>
                  <Select
                    value={settings.sesConfig.region || 'us-east-1'}
                    label="AWS Region"
                    onChange={(e) => setSettings({
                      ...settings,
                      sesConfig: { ...settings.sesConfig, region: e.target.value }
                    })}
                  >
                    <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
                    <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
                    <MenuItem value="eu-west-1">Europe (Ireland)</MenuItem>
                    <MenuItem value="ap-southeast-1">Asia Pacific (Singapore)</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.sesConfig.useIAMRole}
                      onChange={(e) => setSettings({
                        ...settings,
                        sesConfig: { ...settings.sesConfig, useIAMRole: e.target.checked }
                      })}
                    />
                  }
                  label="Use IAM Role (Recommended)"
                  sx={{ mb: 2 }}
                />

                {!settings.sesConfig.useIAMRole && (
                  <>
                    <TextField
                      fullWidth
                      label="Access Key ID"
                      value={settings.sesConfig.accessKeyId || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        sesConfig: { ...settings.sesConfig, accessKeyId: e.target.value }
                      })}
                      type={showSecrets ? 'text' : 'password'}
                      InputProps={{
                        endAdornment: (
                          <IconButton onClick={() => setShowSecrets(!showSecrets)}>
                            {showSecrets ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        )
                      }}
                      sx={{ mb: 2 }}
                    />

                    <TextField
                      fullWidth
                      label="Secret Access Key"
                      value={settings.sesConfig.secretAccessKey || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        sesConfig: { ...settings.sesConfig, secretAccessKey: e.target.value }
                      })}
                      type={showSecrets ? 'text' : 'password'}
                      sx={{ mb: 2 }}
                    />
                  </>
                )}
              </Grid>

              <Grid item xs={12} md={6}>
                <Alert severity={settings.sesConfig.sandboxMode ? 'warning' : 'info'}>
                  {settings.sesConfig.sandboxMode 
                    ? 'SES is in sandbox mode. Emails can only be sent to verified addresses.'
                    : 'SES is in production mode. Emails can be sent to any address.'}
                </Alert>
              </Grid>
            </Grid>
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="SMTP Host"
                  value={settings.smtpConfig.host || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    smtpConfig: { ...settings.smtpConfig, host: e.target.value }
                  })}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="SMTP Port"
                  type="number"
                  value={settings.smtpConfig.port || 587}
                  onChange={(e) => setSettings({
                    ...settings,
                    smtpConfig: { ...settings.smtpConfig, port: parseInt(e.target.value) }
                  })}
                  sx={{ mb: 2 }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.smtpConfig.secure || false}
                      onChange={(e) => setSettings({
                        ...settings,
                        smtpConfig: { ...settings.smtpConfig, secure: e.target.checked }
                      })}
                    />
                  }
                  label="Use TLS/SSL"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="SMTP Username"
                  value={settings.smtpConfig.auth?.user || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    smtpConfig: { 
                      ...settings.smtpConfig, 
                      auth: { ...settings.smtpConfig.auth, user: e.target.value }
                    }
                  })}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="SMTP Password"
                  value={settings.smtpConfig.auth?.pass || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    smtpConfig: { 
                      ...settings.smtpConfig, 
                      auth: { ...settings.smtpConfig.auth, pass: e.target.value }
                    }
                  })}
                  type={showSecrets ? 'text' : 'password'}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={() => setShowSecrets(!showSecrets)}>
                        {showSecrets ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    )
                  }}
                  sx={{ mb: 2 }}
                />
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Quota and Rate Limits */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quota and Rate Limits
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Daily Quota"
                type="number"
                value={settings.quotaLimits.dailyQuota}
                onChange={(e) => setSettings({
                  ...settings,
                  quotaLimits: { ...settings.quotaLimits, dailyQuota: parseInt(e.target.value) }
                })}
                helperText="Maximum emails per day"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Send Rate"
                type="number"
                value={settings.quotaLimits.sendRate}
                onChange={(e) => setSettings({
                  ...settings,
                  quotaLimits: { ...settings.quotaLimits, sendRate: parseInt(e.target.value) }
                })}
                helperText="Emails per second"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Max Recipients"
                type="number"
                value={settings.quotaLimits.maxRecipients}
                onChange={(e) => setSettings({
                  ...settings,
                  quotaLimits: { ...settings.quotaLimits, maxRecipients: parseInt(e.target.value) }
                })}
                helperText="Max recipients per email"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Monitoring and Tracking */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Monitoring and Tracking
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.monitoring.trackOpens}
                    onChange={(e) => setSettings({
                      ...settings,
                      monitoring: { ...settings.monitoring, trackOpens: e.target.checked }
                    })}
                  />
                }
                label="Track Email Opens"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.monitoring.trackClicks}
                    onChange={(e) => setSettings({
                      ...settings,
                      monitoring: { ...settings.monitoring, trackClicks: e.target.checked }
                    })}
                  />
                }
                label="Track Link Clicks"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.monitoring.trackBounces}
                    onChange={(e) => setSettings({
                      ...settings,
                      monitoring: { ...settings.monitoring, trackBounces: e.target.checked }
                    })}
                  />
                }
                label="Track Bounces"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.monitoring.trackComplaints}
                    onChange={(e) => setSettings({
                      ...settings,
                      monitoring: { ...settings.monitoring, trackComplaints: e.target.checked }
                    })}
                  />
                }
                label="Track Complaints"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Suppression List */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Suppression List Management
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAddSuppressionDialog(true)}
            >
              Add Email
            </Button>
          </Box>
          
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.suppressionList.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      suppressionList: { ...settings.suppressionList, enabled: e.target.checked }
                    })}
                  />
                }
                label="Enable Suppression List"
              />
              <Typography variant="body2" color="textSecondary" sx={{ ml: 4 }}>
                Automatically prevent sending to addresses that have bounced or complained
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.suppressionList.autoAddBounces}
                    onChange={(e) => setSettings({
                      ...settings,
                      suppressionList: { ...settings.suppressionList, autoAddBounces: e.target.checked }
                    })}
                    disabled={!settings.suppressionList.enabled}
                  />
                }
                label="Auto-add Bounced Addresses"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.suppressionList.autoAddComplaints}
                    onChange={(e) => setSettings({
                      ...settings,
                      suppressionList: { ...settings.suppressionList, autoAddComplaints: e.target.checked }
                    })}
                    disabled={!settings.suppressionList.enabled}
                  />
                }
                label="Auto-add Complaint Addresses"
              />
            </Grid>
          </Grid>

          {suppressionLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : !suppressionData?.hasData ? (
            <Alert severity="info">
              {suppressionData?.message || 'No emails in suppression list'}
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Added</TableCell>
                    <TableCell>Added By</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {suppressionData.suppressedEmails.slice(0, 10).map((entry: SuppressionListEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={entry.reason}
                          size="small"
                          color={entry.reason === 'bounce' ? 'error' : entry.reason === 'complaint' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{new Date(entry.addedAt).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.addedBy?.name || 'System'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Remove from suppression list">
                          <IconButton
                            size="small"
                            onClick={() => removeSuppressionMutation.mutate(entry.id)}
                            disabled={removeSuppressionMutation.isPending}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<AnalyticsIcon />}
          href="/master/email-analytics"
        >
          View Detailed Analytics
        </Button>
        <Button
          variant="contained"
          startIcon={<SettingsIcon />}
          onClick={handleSaveSettings}
          size="large"
          disabled={saveSettingsMutation.isPending}
        >
          {saveSettingsMutation.isPending ? 'Saving...' : 'Save Platform Settings'}
        </Button>
      </Box>

      {/* Email Analytics Dashboard */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <EmailAnalyticsDashboard />
        </CardContent>
      </Card>

      {/* Test Email Dialog */}
      <Dialog open={testEmailDialog} onClose={() => setTestEmailDialog(false)}>
        <DialogTitle>Send Test Email</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Test Email Address"
            type="email"
            fullWidth
            variant="outlined"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            helperText="Enter the email address to send a test email to"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestEmailDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleTestEmail} 
            variant="contained"
            disabled={testEmailMutation.isPending}
          >
            {testEmailMutation.isPending ? 'Sending...' : 'Send Test'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add to Suppression List Dialog */}
      <Dialog open={addSuppressionDialog} onClose={() => setAddSuppressionDialog(false)}>
        <DialogTitle>Add to Suppression List</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            variant="outlined"
            value={suppressionEmail}
            onChange={(e) => setSuppressionEmail(e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Reason</InputLabel>
            <Select
              value={suppressionReason}
              label="Reason"
              onChange={(e) => setSuppressionReason(e.target.value as any)}
            >
              <MenuItem value="bounce">Bounce</MenuItem>
              <MenuItem value="complaint">Complaint</MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
              <MenuItem value="unsubscribe">Unsubscribe</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddSuppressionDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddSuppression}
            variant="contained"
            disabled={addSuppressionMutation.isPending}
          >
            {addSuppressionMutation.isPending ? 'Adding...' : 'Add to List'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}