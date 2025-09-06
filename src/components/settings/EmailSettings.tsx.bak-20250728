import { useState } from 'react'
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import {
  Email as EmailIcon,
  Settings as SettingsIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Science as TestIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface EmailSettings {
  provider: 'ses' | 'smtp'
  sesConfig: {
    region: string
    sandboxMode: boolean
    fromAddress: string
    replyToAddress: string
    dailyQuota: number
    sendRate: number
    sentLast24Hours: number
  }
  smtpConfig: {
    host: string
    port: number
    secure: boolean
    user: string
  }
  notifications: {
    userInvitations: boolean
    taskAssignments: boolean
    campaignUpdates: boolean
    paymentReminders: boolean
    reportReady: boolean
    systemMaintenance: boolean
    deadlineReminders: boolean
  }
  templates: {
    customBranding: boolean
    organizationLogo: string
    brandColors: {
      primary: string
      secondary: string
    }
  }
}

const notificationTypes = [
  { key: 'userInvitations', label: 'User Invitations', description: 'Send welcome emails to new users' },
  { key: 'taskAssignments', label: 'Task Assignments', description: 'Notify users of new task assignments' },
  { key: 'campaignUpdates', label: 'Campaign Updates', description: 'Send campaign status change notifications' },
  { key: 'paymentReminders', label: 'Payment Reminders', description: 'Send invoice and payment due reminders' },
  { key: 'reportReady', label: 'Report Ready', description: 'Notify when generated reports are ready' },
  { key: 'systemMaintenance', label: 'System Maintenance', description: 'Send maintenance and downtime notifications' },
  { key: 'deadlineReminders', label: 'Deadline Reminders', description: 'Send reminders for upcoming deadlines' },
]

export function EmailSettings() {
  const queryClient = useQueryClient()
  const [testDialog, setTestDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Mock data for now - in production this would come from API
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    provider: 'ses',
    sesConfig: {
      region: 'us-east-1',
      sandboxMode: false,
      fromAddress: 'noreply@podcastflow.pro',
      replyToAddress: 'support@podcastflow.pro',
      dailyQuota: 50000,
      sendRate: 14,
      sentLast24Hours: 0,
    },
    smtpConfig: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
    },
    notifications: {
      userInvitations: true,
      taskAssignments: true,
      campaignUpdates: true,
      paymentReminders: true,
      reportReady: true,
      systemMaintenance: true,
      deadlineReminders: true,
    },
    templates: {
      customBranding: false,
      organizationLogo: '',
      brandColors: {
        primary: '#2196F3',
        secondary: '#4CAF50',
      },
    },
  })

  const handleTestEmail = async () => {
    if (!testEmail.trim()) {
      setError('Please enter a test email address')
      return
    }

    try {
      const response = await api.post('/test-email', {
        emailType: 'userInvitation',
        recipient: testEmail,
        testData: {
          userName: 'Test User',
          userRole: 'client',
          organizationName: 'Test Organization',
        },
      })
      
      setTestResult(response.data)
      setSuccess('Test email sent successfully!')
      setTestDialog(false)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send test email')
      setTestResult(err.response?.data)
    }
  }

  const handleSaveSettings = async () => {
    try {
      // In production, this would save to API
      setSuccess('Email settings saved successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError('Failed to save email settings')
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleNotificationToggle = (key: string) => {
    setEmailSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key as keyof typeof prev.notifications]
      }
    }))
  }

  const quotaUsagePercentage = Math.round((emailSettings.sesConfig.sentLast24Hours / emailSettings.sesConfig.dailyQuota) * 100)

  return (
    <>
      {/* Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Email System Status
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<TestIcon />}
                onClick={() => setTestDialog(true)}
              >
                Test Email
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['email-settings'] })}
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

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <EmailIcon color="primary" />
                <Box>
                  <Typography variant="body1">
                    Provider: {emailSettings.provider.toUpperCase()}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Region: {emailSettings.sesConfig.region}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={emailSettings.sesConfig.sandboxMode ? 'Sandbox Mode' : 'Production Mode'}
                  color={emailSettings.sesConfig.sandboxMode ? 'warning' : 'success'}
                  icon={emailSettings.sesConfig.sandboxMode ? <InfoIcon /> : <CheckCircleIcon />}
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Daily Quota Usage
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Typography variant="body2">
                  {emailSettings.sesConfig.sentLast24Hours} / {emailSettings.sesConfig.dailyQuota.toLocaleString()} emails
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  ({quotaUsagePercentage}%)
                </Typography>
              </Box>
              <Box sx={{ width: '100%', mt: 1 }}>
                <div style={{ 
                  width: '100%', 
                  height: 8, 
                  backgroundColor: '#e0e0e0', 
                  borderRadius: 4,
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: `${quotaUsagePercentage}%`, 
                    height: '100%', 
                    backgroundColor: quotaUsagePercentage > 80 ? '#f44336' : quotaUsagePercentage > 60 ? '#ff9800' : '#4caf50',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Send Rate: {emailSettings.sesConfig.sendRate} emails/second
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Provider Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Email Provider Configuration
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="From Address"
                value={emailSettings.sesConfig.fromAddress}
                onChange={(e) => setEmailSettings(prev => ({
                  ...prev,
                  sesConfig: { ...prev.sesConfig, fromAddress: e.target.value }
                }))}
                helperText="The email address that emails will be sent from"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Reply To Address"
                value={emailSettings.sesConfig.replyToAddress}
                onChange={(e) => setEmailSettings(prev => ({
                  ...prev,
                  sesConfig: { ...prev.sesConfig, replyToAddress: e.target.value }
                }))}
                helperText="The email address for replies"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>AWS Region</InputLabel>
                <Select
                  value={emailSettings.sesConfig.region}
                  label="AWS Region"
                  onChange={(e) => setEmailSettings(prev => ({
                    ...prev,
                    sesConfig: { ...prev.sesConfig, region: e.target.value }
                  }))}
                >
                  <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
                  <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
                  <MenuItem value="eu-west-1">Europe (Ireland)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!emailSettings.sesConfig.sandboxMode}
                    onChange={(e) => setEmailSettings(prev => ({
                      ...prev,
                      sesConfig: { ...prev.sesConfig, sandboxMode: !e.target.checked }
                    }))}
                  />
                }
                label="Production Mode"
              />
              <Typography variant="body2" color="textSecondary">
                When enabled, emails can be sent to any verified email address
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Notification Settings
          </Typography>
          
          <Grid container spacing={2}>
            {notificationTypes.map((type) => (
              <Grid item xs={12} md={6} key={type.key}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1">
                      {type.label}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {type.description}
                    </Typography>
                  </Box>
                  <Switch
                    checked={emailSettings.notifications[type.key as keyof typeof emailSettings.notifications]}
                    onChange={() => handleNotificationToggle(type.key)}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Email Templates
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={emailSettings.templates.customBranding}
                    onChange={(e) => setEmailSettings(prev => ({
                      ...prev,
                      templates: { ...prev.templates, customBranding: e.target.checked }
                    }))}
                  />
                }
                label="Custom Branding"
              />
              <Typography variant="body2" color="textSecondary">
                Use custom colors and logo in email templates
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Organization Logo URL"
                value={emailSettings.templates.organizationLogo}
                onChange={(e) => setEmailSettings(prev => ({
                  ...prev,
                  templates: { ...prev.templates, organizationLogo: e.target.value }
                }))}
                disabled={!emailSettings.templates.customBranding}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Primary Brand Color"
                type="color"
                value={emailSettings.templates.brandColors.primary}
                onChange={(e) => setEmailSettings(prev => ({
                  ...prev,
                  templates: { 
                    ...prev.templates, 
                    brandColors: { ...prev.templates.brandColors, primary: e.target.value }
                  }
                }))}
                disabled={!emailSettings.templates.customBranding}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Secondary Brand Color"
                type="color"
                value={emailSettings.templates.brandColors.secondary}
                onChange={(e) => setEmailSettings(prev => ({
                  ...prev,
                  templates: { 
                    ...prev.templates, 
                    brandColors: { ...prev.templates.brandColors, secondary: e.target.value }
                  }
                }))}
                disabled={!emailSettings.templates.customBranding}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Available Templates */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Available Email Templates
          </Typography>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Template</TableCell>
                  <TableCell>Purpose</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notificationTypes.map((type) => (
                  <TableRow key={type.key}>
                    <TableCell>{type.label}</TableCell>
                    <TableCell>{type.description}</TableCell>
                    <TableCell>
                      <Chip
                        label={emailSettings.notifications[type.key as keyof typeof emailSettings.notifications] ? 'Enabled' : 'Disabled'}
                        color={emailSettings.notifications[type.key as keyof typeof emailSettings.notifications] ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined">
                        Preview
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<SettingsIcon />}
          onClick={handleSaveSettings}
          size="large"
        >
          Save Email Settings
        </Button>
      </Box>

      {/* Test Email Dialog */}
      <Dialog open={testDialog} onClose={() => setTestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Test Email</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Test Email Address"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              type="email"
              helperText="Enter an email address to send a test invitation email"
            />
            
            {testResult && (
              <Alert 
                severity={testResult.success ? 'success' : 'error'} 
                sx={{ mt: 2 }}
              >
                {testResult.success ? testResult.message : testResult.error}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleTestEmail}
            disabled={!testEmail.trim()}
            startIcon={<SendIcon />}
          >
            Send Test Email
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}