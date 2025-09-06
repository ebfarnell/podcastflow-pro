import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Switch,
  FormGroup,
  FormControlLabel,
  Box,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
  TextField,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import TestIcon from '@mui/icons-material/Science'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`notification-tabpanel-${index}`}
      aria-labelledby={`notification-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export function NotificationSettings() {
  const queryClient = useQueryClient()
  const [tabValue, setTabValue] = useState(0)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testChannel, setTestChannel] = useState<'email' | 'inApp' | 'slack' | 'webhook'>('inApp')
  const [showSecrets, setShowSecrets] = useState(false)
  
  // Fetch notification settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/notifications')
      if (!res.ok) throw new Error('Failed to fetch settings')
      return res.json()
    },
  })

  const [settings, setSettings] = useState<any>({
    enabled: true,
    channels: {
      email: { enabled: true },
      inApp: { enabled: true },
      slack: { enabled: false, webhookUrl: null },
      webhook: { enabled: false, url: null, secret: null }
    },
    quietHours: null,
    events: {}
  })

  // Update local state when data loads
  useEffect(() => {
    if (settingsData?.settings) {
      setSettings(settingsData.settings)
    }
  }, [settingsData])

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update settings')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] })
      setSuccess(true)
      setError(null)
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update settings')
      setSuccess(false)
    },
  })

  // Test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: async (channel: string) => {
      const res = await fetch('/api/settings/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })
      if (!res.ok) throw new Error('Failed to send test notification')
      return res.json()
    },
    onSuccess: (data) => {
      setTestDialogOpen(false)
      setSuccess(true)
      setError(null)
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to send test notification')
    },
  })

  const handleChannelToggle = (channel: string) => {
    setSettings((prev: any) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: {
          ...prev.channels[channel],
          enabled: !prev.channels[channel].enabled
        }
      }
    }))
  }

  const handleEventToggle = (eventType: string, field: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      events: {
        ...prev.events,
        [eventType]: {
          ...(prev.events[eventType] || {}),
          [field]: value
        }
      }
    }))
  }

  const handleSave = () => {
    updateSettingsMutation.mutate(settings)
  }

  const handleTestNotification = () => {
    testNotificationMutation.mutate(testChannel)
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  const eventCategories = {
    'Pre-Sale': ['campaign_created', 'schedule_built', 'talent_approval_requested', 'admin_approval_requested', 'campaign_approved', 'campaign_rejected'],
    'Inventory': ['inventory_conflict', 'inventory_released', 'bulk_placement_failed', 'rate_card_updated'],
    'Post-Sale': ['order_created', 'contract_generated', 'contract_signed', 'invoice_generated', 'payment_received', 'invoice_overdue'],
    'Content': ['ad_request_created', 'category_conflict'],
    'System': ['youtube_quota_reached', 'integration_sync_failed', 'backup_completed', 'backup_failed', 'security_policy_changed', 'api_key_rotated']
  }

  const eventNames: Record<string, string> = {
    campaign_created: 'Campaign Created',
    schedule_built: 'Schedule Built',
    talent_approval_requested: 'Talent Approval Requested',
    admin_approval_requested: 'Admin Approval Requested',
    campaign_approved: 'Campaign Approved',
    campaign_rejected: 'Campaign Rejected',
    inventory_conflict: 'Inventory Conflict',
    inventory_released: 'Inventory Released',
    bulk_placement_failed: 'Bulk Placement Failed',
    rate_card_updated: 'Rate Card Updated',
    order_created: 'Order Created',
    contract_generated: 'Contract Generated',
    contract_signed: 'Contract Signed',
    invoice_generated: 'Invoice Generated',
    payment_received: 'Payment Received',
    invoice_overdue: 'Invoice Overdue',
    ad_request_created: 'Ad Request Created',
    category_conflict: 'Category Conflict',
    youtube_quota_reached: 'YouTube Quota Reached',
    integration_sync_failed: 'Integration Sync Failed',
    backup_completed: 'Backup Completed',
    backup_failed: 'Backup Failed',
    security_policy_changed: 'Security Policy Changed',
    api_key_rotated: 'API Key Rotated'
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Notification Settings
          </Typography>
          <Button
            variant="outlined"
            startIcon={<TestIcon />}
            onClick={() => setTestDialogOpen(true)}
            size="small"
          >
            Test Notification
          </Button>
        </Box>
        
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Configure organization-wide notification preferences and delivery channels
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Settings updated successfully!
          </Alert>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Delivery Statistics */}
        {settingsData?.deliveryStats && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Delivery Statistics (Last 7 Days)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={3}>
                <Typography variant="body2" color="textSecondary">Total</Typography>
                <Typography variant="h6">{settingsData.deliveryStats.total}</Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="textSecondary">Sent</Typography>
                <Typography variant="h6" color="success.main">
                  {settingsData.deliveryStats.byStatus?.sent || 0}
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="textSecondary">Failed</Typography>
                <Typography variant="h6" color="error.main">
                  {settingsData.deliveryStats.byStatus?.failed || 0}
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="textSecondary">Pending</Typography>
                <Typography variant="h6" color="warning.main">
                  {settingsData.deliveryStats.byStatus?.pending || 0}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        )}

        <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Channels" />
          <Tab label="Event Types" />
          <Tab label="Quiet Hours" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Channel Configuration */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Delivery Channels
            </Typography>
            
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.channels.email.enabled}
                    onChange={() => handleChannelToggle('email')}
                  />
                }
                label="Email Notifications"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.channels.inApp.enabled}
                    onChange={() => handleChannelToggle('inApp')}
                  />
                }
                label="In-App Notifications"
              />
              
              <Box sx={{ pl: 2, mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.channels.slack.enabled}
                      onChange={() => handleChannelToggle('slack')}
                    />
                  }
                  label="Slack Notifications"
                />
                {settings.channels.slack.enabled && (
                  <TextField
                    fullWidth
                    label="Slack Webhook URL"
                    value={settings.channels.slack.webhookUrl || ''}
                    onChange={(e) => setSettings((prev: any) => ({
                      ...prev,
                      channels: {
                        ...prev.channels,
                        slack: { ...prev.channels.slack, webhookUrl: e.target.value }
                      }
                    }))}
                    margin="normal"
                    size="small"
                    type={showSecrets ? 'text' : 'password'}
                    InputProps={{
                      endAdornment: (
                        <IconButton
                          onClick={() => setShowSecrets(!showSecrets)}
                          edge="end"
                          size="small"
                        >
                          {showSecrets ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      )
                    }}
                  />
                )}
              </Box>
              
              <Box sx={{ pl: 2, mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.channels.webhook.enabled}
                      onChange={() => handleChannelToggle('webhook')}
                    />
                  }
                  label="Custom Webhook"
                />
                {settings.channels.webhook.enabled && (
                  <>
                    <TextField
                      fullWidth
                      label="Webhook URL"
                      value={settings.channels.webhook.url || ''}
                      onChange={(e) => setSettings((prev: any) => ({
                        ...prev,
                        channels: {
                          ...prev.channels,
                          webhook: { ...prev.channels.webhook, url: e.target.value }
                        }
                      }))}
                      margin="normal"
                      size="small"
                    />
                    <TextField
                      fullWidth
                      label="Webhook Secret"
                      value={settings.channels.webhook.secret || ''}
                      onChange={(e) => setSettings((prev: any) => ({
                        ...prev,
                        channels: {
                          ...prev.channels,
                          webhook: { ...prev.channels.webhook, secret: e.target.value }
                        }
                      }))}
                      margin="normal"
                      size="small"
                      type={showSecrets ? 'text' : 'password'}
                      InputProps={{
                        endAdornment: (
                          <IconButton
                            onClick={() => setShowSecrets(!showSecrets)}
                            edge="end"
                            size="small"
                          >
                            {showSecrets ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        )
                      }}
                    />
                  </>
                )}
              </Box>
            </FormGroup>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Event Type Configuration */}
          {Object.entries(eventCategories).map(([category, events]) => (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                {category}
              </Typography>
              <List dense>
                {events.map((eventType) => {
                  const eventConfig = settings.events[eventType] || {
                    enabled: true,
                    channels: ['email', 'inApp'],
                    mandatory: false,
                    severity: 'normal'
                  }
                  
                  return (
                    <ListItem key={eventType}>
                      <ListItemText
                        primary={eventNames[eventType]}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            {eventConfig.mandatory && (
                              <Chip label="Mandatory" size="small" color="error" />
                            )}
                            <Chip 
                              label={eventConfig.severity} 
                              size="small"
                              color={
                                eventConfig.severity === 'urgent' ? 'error' :
                                eventConfig.severity === 'high' ? 'warning' :
                                'default'
                              }
                            />
                            {eventConfig.channels?.map((ch: string) => (
                              <Chip key={ch} label={ch} size="small" variant="outlined" />
                            ))}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={eventConfig.enabled}
                          onChange={(e) => handleEventToggle(eventType, 'enabled', e.target.checked)}
                          disabled={eventConfig.mandatory}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  )
                })}
              </List>
            </Box>
          ))}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {/* Quiet Hours Configuration */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Quiet Hours
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Prevent non-urgent notifications during specified hours
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.quietHours !== null}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSettings((prev: any) => ({
                        ...prev,
                        quietHours: {
                          start: '22:00',
                          end: '08:00',
                          timezone: 'America/New_York'
                        }
                      }))
                    } else {
                      setSettings((prev: any) => ({
                        ...prev,
                        quietHours: null
                      }))
                    }
                  }}
                />
              }
              label="Enable Quiet Hours"
            />
            
            {settings.quietHours && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <TextField
                  label="Start Time"
                  type="time"
                  value={settings.quietHours.start}
                  onChange={(e) => setSettings((prev: any) => ({
                    ...prev,
                    quietHours: {
                      ...prev.quietHours,
                      start: e.target.value
                    }
                  }))}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="End Time"
                  type="time"
                  value={settings.quietHours.end}
                  onChange={(e) => setSettings((prev: any) => ({
                    ...prev,
                    quietHours: {
                      ...prev.quietHours,
                      end: e.target.value
                    }
                  }))}
                  InputLabelProps={{ shrink: true }}
                />
                <FormControl>
                  <InputLabel>Timezone</InputLabel>
                  <Select
                    value={settings.quietHours.timezone}
                    onChange={(e) => setSettings((prev: any) => ({
                      ...prev,
                      quietHours: {
                        ...prev.quietHours,
                        timezone: e.target.value
                      }
                    }))}
                    label="Timezone"
                  >
                    <MenuItem value="America/New_York">Eastern</MenuItem>
                    <MenuItem value="America/Chicago">Central</MenuItem>
                    <MenuItem value="America/Denver">Mountain</MenuItem>
                    <MenuItem value="America/Los_Angeles">Pacific</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>
        </TabPanel>

        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button 
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              if (settingsData?.settings) {
                setSettings(settingsData.settings)
              }
            }}
          >
            Reset
          </Button>
        </Box>

        {/* Test Notification Dialog */}
        <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)}>
          <DialogTitle>Send Test Notification</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Channel</InputLabel>
              <Select
                value={testChannel}
                onChange={(e) => setTestChannel(e.target.value as any)}
                label="Channel"
              >
                <MenuItem value="inApp">In-App</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                {settings.channels.slack.enabled && (
                  <MenuItem value="slack">Slack</MenuItem>
                )}
                {settings.channels.webhook.enabled && (
                  <MenuItem value="webhook">Webhook</MenuItem>
                )}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTestDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleTestNotification}
              variant="contained"
              disabled={testNotificationMutation.isPending}
            >
              {testNotificationMutation.isPending ? 'Sending...' : 'Send Test'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  )
}