import { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  MenuItem,
  InputAdornment,
  Tooltip,
  Paper,
} from '@mui/material'
import {
  Key as KeyIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon,
  Webhook as WebhookIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiWebhooksApi } from '@/services/api'

interface ApiKey {
  id: string
  name: string
  key: string
  created: string
  lastUsed?: string
  permissions: string[]
  isActive: boolean
}

interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  isActive: boolean
  secret: string
  lastTriggered?: string
  failureCount: number
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const webhookEvents = [
  { value: 'campaign.created', label: 'Campaign Created' },
  { value: 'campaign.updated', label: 'Campaign Updated' },
  { value: 'campaign.completed', label: 'Campaign Completed' },
  { value: 'campaign.paused', label: 'Campaign Paused' },
  { value: 'analytics.daily', label: 'Daily Analytics Report' },
  { value: 'budget.alert', label: 'Budget Alert' },
  { value: 'integration.connected', label: 'Integration Connected' },
  { value: 'integration.error', label: 'Integration Error' },
]

export function ApiSettings() {
  const queryClient = useQueryClient()
  const [tabValue, setTabValue] = useState(0)
  const [apiKeyDialog, setApiKeyDialog] = useState(false)
  const [webhookDialog, setWebhookDialog] = useState(false)
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [apiKeyForm, setApiKeyForm] = useState({
    name: '',
    permissions: [] as string[],
  })

  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    events: [] as string[],
  })

  // Fetch API data
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['apiSettings'],
    queryFn: async () => {
      // Fetch API keys and webhooks in parallel
      const [apiKeysResponse, webhooksResponse] = await Promise.all([
        fetch('/api/api-keys'),
        fetch('/api/webhooks'),
      ])

      if (!apiKeysResponse.ok || !webhooksResponse.ok) {
        throw new Error('Failed to fetch API settings')
      }

      const apiKeysData = await apiKeysResponse.json()
      const webhooksData = await webhooksResponse.json()

      return {
        apiKeys: apiKeysData.apiKeys || [],
        webhooks: webhooksData.webhooks || [],
      }
    },
  })

  // Create API key
  const createApiKeyMutation = useMutation({
    mutationFn: async (data: typeof apiKeyForm) => {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          permissions: data.permissions,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create API key')
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apiSettings'] })
      
      // Show the newly created API key
      if (data.apiKey?.key) {
        setCopiedKey(data.apiKey.key)
        setSuccess(`API key created! Key: ${data.apiKey.key}\n\n${data.message}`)
      } else {
        setSuccess('API key created successfully!')
      }
      
      setApiKeyDialog(false)
      setApiKeyForm({ name: '', permissions: [] })
      // Keep success message longer for user to copy the key
      setTimeout(() => {
        setSuccess(null)
        setCopiedKey(null)
      }, 30000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to create API key')
    },
  })

  // Delete API key
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/api-keys?id=${keyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete API key')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiSettings'] })
      setSuccess('API key deleted')
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to delete API key')
    },
  })

  // Create webhook
  const createWebhookMutation = useMutation({
    mutationFn: async (data: typeof webhookForm) => {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          url: data.url,
          events: data.events,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create webhook')
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apiSettings'] })
      
      // Show the webhook secret if created
      if (data.webhook?.secret) {
        setSuccess(`Webhook created! Secret: ${data.webhook.secret}\n\n${data.message}`)
        // Keep message longer for user to copy the secret
        setTimeout(() => setSuccess(null), 30000)
      } else {
        setSuccess('Webhook created successfully!')
        setTimeout(() => setSuccess(null), 3000)
      }
      
      setWebhookDialog(false)
      setWebhookForm({ name: '', url: '', events: [] })
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to create webhook')
    },
  })

  // Toggle webhook status
  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch('/api/webhooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update webhook')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiSettings'] })
      setSuccess('Webhook updated')
      setTimeout(() => setSuccess(null), 3000)
    },
  })

  // Test webhook
  const testWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const response = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to test webhook')
      }

      return response.json()
    },
    onSuccess: () => {
      setSuccess('Test webhook sent successfully!')
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to send test webhook')
    },
  })

  // Delete webhook
  const deleteWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const response = await fetch(`/api/webhooks?id=${webhookId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete webhook')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiSettings'] })
      setSuccess('Webhook deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to delete webhook')
    },
  })

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const formatLastUsed = (date?: string) => {
    if (!date) return 'Never'
    const now = new Date()
    const lastUsed = new Date(date)
    const diffInHours = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return lastUsed.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            Loading...
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          API & Webhooks
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Manage API keys and webhook configurations for integrations
        </Typography>

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

        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="API Keys" />
          <Tab label="Webhooks" />
          <Tab label="Documentation" />
        </Tabs>

        {/* API Keys Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="subtitle1">
              Manage your API keys for programmatic access
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setApiKeyDialog(true)}
            >
              Create API Key
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Key</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell>Last Used</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiData?.apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell>{apiKey.name}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {showKeys[apiKey.id] ? apiKey.key : `${apiKey.key.substring(0, 12)}...`}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => setShowKeys({ ...showKeys, [apiKey.id]: !showKeys[apiKey.id] })}
                        >
                          {showKeys[apiKey.id] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                        <Tooltip title={copiedKey === apiKey.key ? 'Copied!' : 'Copy'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyKey(apiKey.key)}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {apiKey.permissions.map(p => (
                        <Chip key={p} label={p} size="small" sx={{ mr: 0.5 }} />
                      ))}
                    </TableCell>
                    <TableCell>{formatLastUsed(apiKey.lastUsed)}</TableCell>
                    <TableCell>
                      <Chip
                        label={apiKey.isActive ? 'Active' : 'Inactive'}
                        color={apiKey.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => deleteApiKeyMutation.mutate(apiKey.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Webhooks Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="subtitle1">
              Configure webhooks to receive real-time notifications
            </Typography>
            <Button
              variant="contained"
              startIcon={<WebhookIcon />}
              onClick={() => setWebhookDialog(true)}
            >
              Add Webhook
            </Button>
          </Box>

          <List>
            {apiData?.webhooks.map((webhook) => (
              <ListItem key={webhook.id} sx={{ px: 0 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {webhook.name}
                      {webhook.failureCount > 0 && (
                        <Chip
                          label={`${webhook.failureCount} failures`}
                          color="error"
                          size="small"
                          icon={<ErrorIcon />}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {webhook.url}
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        {webhook.events.map(event => (
                          <Chip
                            key={event}
                            label={webhookEvents.find(e => e.value === event)?.label || event}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                      {webhook.lastTriggered && (
                        <Typography variant="caption" color="textSecondary">
                          Last triggered: {formatLastUsed(webhook.lastTriggered)}
                        </Typography>
                      )}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      size="small"
                      onClick={() => testWebhookMutation.mutate(webhook.id)}
                    >
                      Test
                    </Button>
                    <Switch
                      checked={webhook.isActive}
                      onChange={(e) => toggleWebhookMutation.mutate({
                        id: webhook.id,
                        isActive: e.target.checked,
                      })}
                    />
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete the webhook "${webhook.name}"?`)) {
                          deleteWebhookMutation.mutate(webhook.id)
                        }
                      }}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </TabPanel>

        {/* Documentation Tab */}
        <TabPanel value={tabValue} index={2}>
          <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
            <Typography variant="h6" gutterBottom>
              API Documentation
            </Typography>
            <Typography variant="body2" paragraph>
              Base URL: <code>https://api.podcastflow.pro/v1</code>
            </Typography>
            
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
              Authentication
            </Typography>
            <Typography variant="body2" paragraph>
              Include your API key in the Authorization header:
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'grey.100' }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                Authorization: Bearer YOUR_API_KEY
              </Typography>
            </Paper>

            <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
              Example Request
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'grey.100' }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre' }}>
{`curl -X GET https://api.podcastflow.pro/v1/campaigns \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
              </Typography>
            </Paper>

            <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
              Rate Limits
            </Typography>
            <Typography variant="body2" paragraph>
              API requests are limited to 1000 requests per hour per API key.
            </Typography>

            <Button
              variant="outlined"
              sx={{ mt: 2 }}
              href="https://docs.podcastflow.pro/api"
              target="_blank"
            >
              View Full Documentation
            </Button>
          </Paper>
        </TabPanel>

        {/* Create API Key Dialog */}
        <Dialog open={apiKeyDialog} onClose={() => setApiKeyDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Key Name"
                fullWidth
                value={apiKeyForm.name}
                onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })}
                helperText="A descriptive name for this API key"
              />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Permissions
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    label="Read"
                    onClick={() => {
                      const perms = apiKeyForm.permissions.includes('read')
                        ? apiKeyForm.permissions.filter(p => p !== 'read')
                        : [...apiKeyForm.permissions, 'read']
                      setApiKeyForm({ ...apiKeyForm, permissions: perms })
                    }}
                    color={apiKeyForm.permissions.includes('read') ? 'primary' : 'default'}
                  />
                  <Chip
                    label="Write"
                    onClick={() => {
                      const perms = apiKeyForm.permissions.includes('write')
                        ? apiKeyForm.permissions.filter(p => p !== 'write')
                        : [...apiKeyForm.permissions, 'write']
                      setApiKeyForm({ ...apiKeyForm, permissions: perms })
                    }}
                    color={apiKeyForm.permissions.includes('write') ? 'primary' : 'default'}
                  />
                  <Chip
                    label="Delete"
                    onClick={() => {
                      const perms = apiKeyForm.permissions.includes('delete')
                        ? apiKeyForm.permissions.filter(p => p !== 'delete')
                        : [...apiKeyForm.permissions, 'delete']
                      setApiKeyForm({ ...apiKeyForm, permissions: perms })
                    }}
                    color={apiKeyForm.permissions.includes('delete') ? 'primary' : 'default'}
                  />
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setApiKeyDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => createApiKeyMutation.mutate(apiKeyForm)}
              disabled={!apiKeyForm.name || apiKeyForm.permissions.length === 0 || createApiKeyMutation.isPending}
            >
              Create Key
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Webhook Dialog */}
        <Dialog open={webhookDialog} onClose={() => setWebhookDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Webhook</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Webhook Name"
                fullWidth
                value={webhookForm.name}
                onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
              />
              <TextField
                label="Webhook URL"
                fullWidth
                value={webhookForm.url}
                onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                placeholder="https://yourdomain.com/webhooks"
                helperText="We'll send a POST request to this URL"
              />
              <TextField
                label="Events"
                select
                fullWidth
                SelectProps={{
                  multiple: true,
                  value: webhookForm.events,
                  onChange: (e) => setWebhookForm({ ...webhookForm, events: e.target.value as string[] }),
                }}
              >
                {webhookEvents.map((event) => (
                  <MenuItem key={event.value} value={event.value}>
                    {event.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWebhookDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => createWebhookMutation.mutate(webhookForm)}
              disabled={
                !webhookForm.name ||
                !webhookForm.url ||
                webhookForm.events.length === 0 ||
                createWebhookMutation.isPending
              }
            >
              Create Webhook
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  )
}