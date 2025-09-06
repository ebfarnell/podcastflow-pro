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
  Switch,
  FormControlLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Checkbox,
  FormGroup,
  FormLabel,
  Tooltip,
  IconButton,
} from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import {
  Email as EmailIcon,
  Settings as SettingsIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Science as TestIcon,
  NotificationsActive as NotificationIcon,
  Security as SecurityIcon,
  History as HistoryIcon,
  Block as BlockIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useOrganization } from '@/contexts/OrganizationContext'

// Event types with descriptions
const NOTIFICATION_EVENTS = {
  campaign: [
    { key: 'campaign_created', label: 'Campaign Created', description: 'When a new campaign is created' },
    { key: 'campaign_status_changed', label: 'Campaign Status Changed', description: 'When campaign status changes' },
    { key: 'campaign_approval_requested', label: 'Approval Required', description: 'When campaign needs approval' },
    { key: 'campaign_approved', label: 'Campaign Approved', description: 'When campaign is approved' },
    { key: 'campaign_rejected', label: 'Campaign Rejected', description: 'When campaign is rejected' },
  ],
  scheduling: [
    { key: 'schedule_saved', label: 'Schedule Saved', description: 'When schedule is saved' },
    { key: 'schedule_committed', label: 'Schedule Committed', description: 'When schedule is committed to inventory' },
    { key: 'inventory_conflict_detected', label: 'Inventory Conflict', description: 'When scheduling conflicts are detected' },
  ],
  approvals: [
    { key: 'talent_approval_requested', label: 'Talent Approval Required', description: 'When talent approval is needed' },
    { key: 'producer_approval_requested', label: 'Producer Approval Required', description: 'When producer approval is needed' },
  ],
  billing: [
    { key: 'invoice_generated', label: 'Invoice Generated', description: 'When an invoice is created' },
    { key: 'payment_overdue', label: 'Payment Overdue', description: 'When payment is past due' },
  ],
  system: [
    { key: 'youtube_quota_threshold_reached', label: 'YouTube Quota Warning', description: 'When API quota is low' },
    { key: 'megaphone_sync_failed', label: 'Megaphone Sync Failed', description: 'When sync fails' },
  ]
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales', label: 'Sales' },
  { value: 'producer', label: 'Producer' },
  { value: 'talent', label: 'Talent' },
  { value: 'client', label: 'Client' },
]

export function EnhancedEmailSettings() {
  const queryClient = useQueryClient()
  const { organization } = useOrganization()
  const [testEmailDialog, setTestEmailDialog] = useState(false)
  const [testRecipients, setTestRecipients] = useState<string[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localSettings, setLocalSettings] = useState<any>(null)
  const [recipientMatrix, setRecipientMatrix] = useState<Record<string, string[]>>({})

  // Fetch email status including SES info
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['email-status'],
    queryFn: async () => {
      const response = await api.get('/email/status')
      return response.data
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  // Fetch organization email settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['organization-email-settings'],
    queryFn: async () => {
      const response = await api.get('/organization/email-settings')
      return response.data
    },
  })

  // Initialize local state
  useEffect(() => {
    if (settingsData?.settings) {
      setLocalSettings(settingsData.settings)
      setRecipientMatrix(settingsData.settings.recipientMatrix || {})
    }
  }, [settingsData])

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put('/organization/email-settings', {
        settings: {
          ...localSettings,
          recipientMatrix
        }
      })
      return response.data
    },
    onSuccess: () => {
      setSuccess('Email settings saved successfully!')
      queryClient.invalidateQueries({ queryKey: ['organization-email-settings'] })
      queryClient.invalidateQueries({ queryKey: ['email-status'] })
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to save email settings')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async (recipients: string[]) => {
      const response = await api.post('/email/test', {
        to: recipients,
        template: 'test',
        subject: `Test Email - ${organization?.name || 'PodcastFlow Pro'}`
      })
      return response.data
    },
    onSuccess: (data) => {
      setSuccess(`Test email sent successfully! Message ID: ${data.messageId}`)
      setTestEmailDialog(false)
      refetchStatus()
      setTimeout(() => setSuccess(null), 5000)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to send test email')
      setTimeout(() => setError(null), 5000)
    },
  })

  const handleRecipientToggle = (eventKey: string, role: string) => {
    const current = recipientMatrix[eventKey] || []
    if (current.includes(role)) {
      setRecipientMatrix({
        ...recipientMatrix,
        [eventKey]: current.filter(r => r !== role)
      })
    } else {
      setRecipientMatrix({
        ...recipientMatrix,
        [eventKey]: [...current, role]
      })
    }
  }

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({})
  }

  const handleSendTestEmail = () => {
    if (testRecipients.length > 0) {
      sendTestEmailMutation.mutate(testRecipients)
    }
  }

  if (statusLoading || settingsLoading || !localSettings) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={400} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    )
  }

  const sesStatus = statusData?.sesStatus || {}
  const recentActivity = statusData?.recentActivity || []
  const statistics = statusData?.statistics || {}

  return (
    <>
      {/* SES Status Panel */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SecurityIcon sx={{ mr: 2 }} />
              <Typography variant="h6">
                Email Service Status
              </Typography>
            </Box>
            <Box>
              <Tooltip title="Refresh Status">
                <IconButton onClick={() => refetchStatus()} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<TestIcon />}
                onClick={() => setTestEmailDialog(true)}
                sx={{ ml: 1 }}
              >
                Send Test Email
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

          <Grid container spacing={3}>
            {/* Connection Status */}
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Connection Status
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {sesStatus.connected ? (
                    <>
                      <CheckCircleIcon color="success" />
                      <Typography color="success.main">Connected</Typography>
                    </>
                  ) : (
                    <>
                      <ErrorIcon color="error" />
                      <Typography color="error.main">Not Connected</Typography>
                    </>
                  )}
                  <Chip 
                    label={sesStatus.region || 'Unknown'} 
                    size="small" 
                    color="primary"
                    sx={{ ml: 1 }}
                  />
                  <Chip 
                    label={sesStatus.mode === 'production' ? 'Production' : 'Sandbox'} 
                    size="small" 
                    color={sesStatus.mode === 'production' ? 'success' : 'warning'}
                  />
                </Box>
              </Box>
            </Grid>

            {/* Sending Quota */}
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  24-Hour Sending Quota
                </Typography>
                {sesStatus.quota && (
                  <>
                    <LinearProgress 
                      variant="determinate" 
                      value={(sesStatus.quota.sentLast24Hours / sesStatus.quota.max24HourSend) * 100}
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="body2" color="textSecondary">
                      {sesStatus.quota.sentLast24Hours} / {sesStatus.quota.max24HourSend} emails
                      ({((sesStatus.quota.sentLast24Hours / sesStatus.quota.max24HourSend) * 100).toFixed(1)}%)
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Max send rate: {sesStatus.quota.maxSendRate} emails/second
                    </Typography>
                  </>
                )}
              </Box>
            </Grid>

            {/* Reputation Score */}
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Reputation Score
                </Typography>
                {sesStatus.stats && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress
                      variant="determinate"
                      value={sesStatus.stats.reputation}
                      size={40}
                      color={
                        sesStatus.stats.reputation > 80 ? 'success' :
                        sesStatus.stats.reputation > 60 ? 'warning' : 'error'
                      }
                    />
                    <Typography variant="h6">
                      {sesStatus.stats.reputation.toFixed(1)}%
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Verified Domains */}
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Verified Domains
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {sesStatus.verifiedDomains?.length > 0 ? (
                    sesStatus.verifiedDomains.map((domain: string) => (
                      <Chip
                        key={domain}
                        label={domain}
                        size="small"
                        icon={<CheckCircleIcon />}
                        color="success"
                        variant="outlined"
                      />
                    ))
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No verified domains
                    </Typography>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* Configuration Set */}
            <Grid item xs={12} md={4}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Configuration Set
                </Typography>
                {sesStatus.configurationSet ? (
                  <Chip
                    label={sesStatus.configurationSet}
                    size="small"
                    color="primary"
                  />
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    Not configured
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>

          {/* 30-Day Statistics */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Last 30 Days
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(statistics.last30Days || {}).map(([key, value]) => (
                <Grid item xs={6} sm={4} md={2} key={key}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="h6">{value as number}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Email Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <EmailIcon sx={{ mr: 2 }} />
            <Typography variant="h6">
              Email Configuration
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="From Name"
                value={localSettings.fromName || ''}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  fromName: e.target.value
                })}
                helperText="Display name for sent emails"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="From Email"
                type="email"
                value={localSettings.fromEmail || ''}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  fromEmail: e.target.value
                })}
                helperText="Must be verified in SES"
                error={localSettings.fromEmail && !sesStatus.verifiedEmails?.includes(localSettings.fromEmail)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Reply-To Email"
                type="email"
                value={localSettings.replyToAddress || ''}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  replyToAddress: e.target.value
                })}
                helperText="Where replies should be sent"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Email Footer"
                value={localSettings.emailFooter || ''}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  emailFooter: e.target.value
                })}
                helperText="Text to include at the bottom of all emails"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Recipient Matrix */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <NotificationIcon sx={{ mr: 2 }} />
            <Typography variant="h6">
              Notification Recipients
            </Typography>
          </Box>

          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Configure which roles receive notifications for each event type
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Event</TableCell>
                  {ROLES.map(role => (
                    <TableCell key={role.value} align="center">
                      {role.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(NOTIFICATION_EVENTS).map(([category, events]) => (
                  <>
                    <TableRow key={category}>
                      <TableCell colSpan={ROLES.length + 1} sx={{ bgcolor: 'grey.100' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {events.map(event => (
                      <TableRow key={event.key}>
                        <TableCell>
                          <Typography variant="body2">{event.label}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {event.description}
                          </Typography>
                        </TableCell>
                        {ROLES.map(role => (
                          <TableCell key={role.value} align="center">
                            <Checkbox
                              checked={(recipientMatrix[event.key] || []).includes(role.value)}
                              onChange={() => handleRecipientToggle(event.key, role.value)}
                              size="small"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <HistoryIcon sx={{ mr: 2 }} />
            <Typography variant="h6">
              Recent Email Activity
            </Typography>
          </Box>

          {recentActivity.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Recipient</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Sent</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentActivity.map((email: any) => (
                    <TableRow key={email.id}>
                      <TableCell>{email.toEmail}</TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {email.subject}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={email.status}
                          size="small"
                          color={
                            email.status === 'delivered' ? 'success' :
                            email.status === 'bounced' ? 'error' :
                            email.status === 'complained' ? 'warning' :
                            'default'
                          }
                          icon={
                            email.bouncedAt ? <ErrorIcon /> :
                            email.complainedAt ? <WarningIcon /> :
                            email.deliveredAt ? <CheckCircleIcon /> :
                            undefined
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {email.sentAt ? new Date(email.sentAt).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="textSecondary">
              No recent email activity
            </Typography>
          )}

          {statistics.suppressionListSize > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                {statistics.suppressionListSize} email{statistics.suppressionListSize !== 1 ? 's' : ''} in suppression list
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<SettingsIcon />}
          onClick={handleSaveSettings}
          size="large"
          disabled={saveSettingsMutation.isPending}
        >
          {saveSettingsMutation.isPending ? 'Saving...' : 'Save Email Settings'}
        </Button>
      </Box>

      {/* Test Email Dialog */}
      <Dialog open={testEmailDialog} onClose={() => setTestEmailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Test Email</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Send a test email to verify your configuration is working correctly.
          </Typography>
          
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={testRecipients}
            onChange={(e, value) => setTestRecipients(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Recipients"
                placeholder="Enter email addresses"
                helperText="Press Enter after each email address"
              />
            )}
          />

          {sendTestEmailMutation.isPending && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestEmailDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSendTestEmail}
            variant="contained"
            startIcon={<SendIcon />}
            disabled={testRecipients.length === 0 || sendTestEmailMutation.isPending}
          >
            Send Test Email
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}