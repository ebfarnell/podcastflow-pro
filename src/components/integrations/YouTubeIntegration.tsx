'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  TextField,
  Alert,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch
} from '@mui/material'
import {
  YouTube as YouTubeIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Analytics as AnalyticsIcon,
  Key as KeyIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface YouTubeConnection {
  id: string
  connectionName: string
  accountEmail?: string
  channelId?: string
  channelTitle?: string
  channelDescription?: string
  channelThumbnail?: string
  isActive: boolean
  lastSync?: string
  syncEnabled: boolean
  showCount?: number
  connectedBy?: string
  createdAt: string
  updatedAt: string
}

interface YouTubeChannel {
  id: string
  channelId: string
  channelTitle: string
  channelDescription?: string
  channelThumbnail?: string
  connectedBy: string
  isActive: boolean
  lastSync?: string
  createdAt: string
}

interface YouTubeConfig {
  isConfigured: boolean
  hasApiKey: boolean
  hasOAuth: boolean
  apiKey?: string
  clientId?: string
  clientSecret?: string
  redirectUri?: string
  quotaLimit: number
  quotaUsed: number
  quotaResetAt?: string
  isActive: boolean
}

export function YouTubeIntegration() {
  const { user } = useAuth()
  const [connections, setConnections] = useState<YouTubeConnection[]>([])
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [config, setConfig] = useState<YouTubeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(null)
  const [editConnectionId, setEditConnectionId] = useState<string | null>(null)
  const [connectionName, setConnectionName] = useState('')
  
  // Config form state
  const [apiKey, setApiKey] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [quotaLimit, setQuotaLimit] = useState(10000)
  const [saving, setSaving] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'master'
  const canConnect = ['admin', 'master', 'sales'].includes(user?.role || '')

  useEffect(() => {
    loadData()
    
    // Check for OAuth callback params (only in browser)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('youtube_connected')) {
        setSuccess('YouTube channel connected successfully!')
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
      } else if (params.get('error')) {
        const error = params.get('error')
        if (error === 'youtube_oauth_not_configured') {
          setError('YouTube OAuth is not configured. Please add OAuth credentials first.')
        } else {
          setError('Failed to connect YouTube channel. Please try again.')
        }
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load YouTube connections
      const connectionsResponse = await api.get('/youtube/connections')
      setConnections(connectionsResponse.data?.connections || [])
      
      // For backward compatibility, still load channels
      const channelsResponse = await api.get('/youtube/channels')
      setChannels(channelsResponse.data?.channels || [])
      
      // Load config if admin
      if (isAdmin) {
        const configResponse = await api.get('/youtube/config')
        setConfig(configResponse.data)
        
        // Set form values
        if (configResponse.data) {
          setClientId(configResponse.data.clientId || '')
          setQuotaLimit(configResponse.data.quotaLimit || 10000)
        }
      }
    } catch (error: any) {
      console.error('Error loading YouTube data:', error)
      setError('Failed to load YouTube integration data')
    } finally {
      setLoading(false)
    }
  }

  const handleConnectChannel = () => {
    if (!connectionName.trim()) {
      setError('Please enter a name for this connection')
      return
    }
    if (typeof window !== 'undefined') {
      // Pass connection name as query param
      window.location.href = `/api/youtube/auth/connect?connectionName=${encodeURIComponent(connectionName)}`
    }
  }


  const handleToggleSync = async (connectionId: string, enabled: boolean) => {
    try {
      await api.put(`/youtube/connections/${connectionId}`, { syncEnabled: enabled })
      await loadData()
      setSuccess(`Sync ${enabled ? 'enabled' : 'disabled'} for connection`)
    } catch (error: any) {
      console.error('Error updating sync status:', error)
      setError('Failed to update sync status')
    }
  }

  const handleDisconnectConnection = async (connectionId: string) => {
    try {
      await api.delete(`/youtube/connections/${connectionId}`)
      setConnections(connections.filter(c => c.id !== connectionId))
      setSuccess('Connection removed successfully')
      setDeleteConnectionId(null)
    } catch (error: any) {
      console.error('Error removing connection:', error)
      setError('Failed to remove connection')
    }
  }

  const handleSaveConfig = async () => {
    try {
      setSaving(true)
      setError(null)
      
      const data: any = {
        quotaLimit
      }
      
      // Only include fields that have been changed
      if (apiKey && apiKey !== '••••••••') {
        data.apiKey = apiKey
      }
      
      if (clientId) {
        data.clientId = clientId
      }
      
      if (clientSecret && clientSecret !== '••••••••') {
        data.clientSecret = clientSecret
      }
      
      console.log('Saving YouTube config with data:', data)
      
      const response = await api.put('/youtube/config', data)
      console.log('Save response:', response.data)
      
      setSuccess('YouTube API configuration saved successfully')
      setConfigDialogOpen(false)
      
      // Clear the form fields
      setApiKey('')
      setClientId('')
      setClientSecret('')
      
      // Reload config
      await loadData()
    } catch (error: any) {
      console.error('Error saving config:', error)
      setError(error.response?.data?.error || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const quotaPercentage = config ? (config.quotaUsed / config.quotaLimit) * 100 : 0

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <YouTubeIcon sx={{ color: '#FF0000' }} />
              <Typography variant="h6">YouTube Integration</Typography>
            </Box>
          }
          action={
            isAdmin && (
              <Button
                startIcon={<KeyIcon />}
                onClick={() => setConfigDialogOpen(true)}
                variant="outlined"
              >
                Configure API
              </Button>
            )
          }
        />
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* API Configuration Section */}
          {config && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                API Configuration (Public Data Access)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                The API key is used to fetch public YouTube data like video views and channel statistics.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip
                  label={config.hasApiKey ? 'API Key Configured' : 'No API Key'}
                  color={config.hasApiKey ? 'success' : 'default'}
                  size="small"
                  icon={<KeyIcon />}
                />
                {config.hasApiKey && (
                  <Chip
                    label={`Quota: ${config.quotaUsed.toLocaleString()}/${config.quotaLimit.toLocaleString()}`}
                    color={quotaPercentage > 90 ? 'error' : quotaPercentage > 70 ? 'warning' : 'default'}
                    size="small"
                  />
                )}
              </Box>
              
              {config.hasApiKey && (
                <Box sx={{ width: '100%', bgcolor: 'grey.200', borderRadius: 1 }}>
                  <Box
                    sx={{
                      width: `${Math.min(quotaPercentage, 100)}%`,
                      height: 6,
                      bgcolor: quotaPercentage > 90 ? 'error.main' : quotaPercentage > 70 ? 'warning.main' : 'success.main',
                      borderRadius: 1,
                      transition: 'width 0.3s'
                    }}
                  />
                </Box>
              )}
            </Box>
          )}

          {/* OAuth Configuration Section */}
          {config && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                OAuth Configuration (Private Data Access)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                OAuth is required to connect YouTube accounts and access private analytics data.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label={config.hasOAuth ? 'OAuth Configured' : 'OAuth Not Configured'}
                  color={config.hasOAuth ? 'success' : 'warning'}
                  size="small"
                  icon={<SecurityIcon />}
                />
                {!config.hasOAuth && isAdmin && (
                  <Button
                    size="small"
                    onClick={() => setConfigDialogOpen(true)}
                    startIcon={<SettingsIcon />}
                  >
                    Configure OAuth
                  </Button>
                )}
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Connected YouTube Accounts */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1">
                Connected YouTube Accounts ({connections.length})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Each show can be linked to a specific YouTube account for syncing private data
              </Typography>
            </Box>
            {canConnect && config?.hasOAuth && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  placeholder="Connection name"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  sx={{ width: 200 }}
                />
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleConnectChannel}
                  variant="contained"
                  size="small"
                  disabled={!connectionName.trim()}
                >
                  Add Connection
                </Button>
              </Box>
            )}
          </Box>

          {connections.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <YouTubeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary" gutterBottom>
                No YouTube accounts connected yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Connect YouTube accounts to sync private analytics and channel data
              </Typography>
              {canConnect && config?.hasOAuth && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    size="small"
                    placeholder="Enter connection name"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    sx={{ width: 250, mr: 1 }}
                  />
                  <Button
                    startIcon={<AddIcon />}
                    onClick={handleConnectChannel}
                    variant="outlined"
                    disabled={!connectionName.trim()}
                  >
                    Connect Your First Account
                  </Button>
                </Box>
              )}
              {!config?.hasOAuth && isAdmin && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Configure OAuth credentials to enable YouTube connections
                </Typography>
              )}
            </Box>
          ) : (
            <List>
              {connections.map((connection) => (
                <ListItem key={connection.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                  <ListItemAvatar>
                    <Avatar src={connection.channelThumbnail} alt={connection.channelTitle || connection.connectionName}>
                      <YouTubeIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">{connection.connectionName}</Typography>
                        {connection.syncEnabled && (
                          <Chip label="Sync Enabled" color="success" size="small" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        {connection.channelTitle && (
                          <Typography variant="body2" color="text.secondary">
                            Channel: {connection.channelTitle}
                          </Typography>
                        )}
                        {connection.accountEmail && (
                          <Typography variant="body2" color="text.secondary">
                            Account: {connection.accountEmail}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {connection.showCount || 0} shows linked • Last sync: {connection.lastSync ? new Date(connection.lastSync).toLocaleString() : 'Never'}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={connection.syncEnabled}
                            onChange={(e) => handleToggleSync(connection.id, e.target.checked)}
                            disabled={!canConnect}
                          />
                        }
                        label="Sync"
                      />
                      <IconButton
                        edge="end"
                        onClick={() => setDeleteConnectionId(connection.id)}
                        disabled={!isAdmin}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon />
            YouTube API Configuration
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Configure your YouTube Data API v3 credentials. You'll need both an API key 
              for public data access and OAuth credentials for private channel data.
            </Alert>

            <TextField
              fullWidth
              label="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.apiKey || 'AIza...'}
              margin="normal"
              helperText="For accessing public YouTube data"
              InputProps={{
                startAdornment: <KeyIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />

            <Divider sx={{ my: 3 }}>OAuth 2.0 Credentials</Divider>

            <TextField
              fullWidth
              label="OAuth Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              margin="normal"
              helperText="From Google Cloud Console"
            />

            <TextField
              fullWidth
              label="OAuth Client Secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={config?.clientId ? '••••••••' : ''}
              margin="normal"
              type="password"
              helperText="Keep this secret!"
            />

            <TextField
              fullWidth
              label="Daily Quota Limit"
              type="number"
              value={quotaLimit}
              onChange={(e) => setQuotaLimit(parseInt(e.target.value) || 10000)}
              margin="normal"
              helperText="YouTube API daily quota limit (default: 10,000)"
              inputProps={{ min: 1000, max: 1000000 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveConfig}
            variant="contained"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConnectionId}
        onClose={() => setDeleteConnectionId(null)}
      >
        <DialogTitle>Remove YouTube Connection?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove this YouTube connection? 
            Any shows linked to this connection will need to be re-linked to another connection.
            You can add a new connection later, but you'll need to go through the OAuth process again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConnectionId(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => deleteConnectionId && handleDisconnectConnection(deleteConnectionId)}
            color="error"
            variant="contained"
          >
            Remove Connection
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}