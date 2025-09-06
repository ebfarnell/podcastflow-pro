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
  Switch,
  LinearProgress,
  Tooltip,
  Paper
} from '@mui/material'
import {
  YouTube as YouTubeIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Analytics as AnalyticsIcon,
  Key as KeyIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { quotaManager } from '@/lib/youtube'

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
  dailyQuotaLimit?: number
  quotaAlertThreshold?: number
  autoStopOnQuotaExceeded?: boolean
}

interface QuotaStatus {
  used: number
  limit: number
  percentage: number
  resetAt: Date
  isPaused: boolean
  canSync: boolean
}

export function YouTubeIntegrationWithQuota() {
  const { user } = useAuth()
  const [connections, setConnections] = useState<YouTubeConnection[]>([])
  const [config, setConfig] = useState<YouTubeConfig | null>(null)
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(null)
  const [connectionName, setConnectionName] = useState('')
  
  // Config form state
  const [apiKey, setApiKey] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [quotaLimit, setQuotaLimit] = useState(10000)
  const [quotaAlertThreshold, setQuotaAlertThreshold] = useState(80)
  const [autoStopOnQuotaExceeded, setAutoStopOnQuotaExceeded] = useState(true)
  const [saving, setSaving] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'master'
  const canConnect = ['admin', 'master', 'sales'].includes(user?.role || '')
  
  // Feature flag check
  const quotaEnforcementEnabled = process.env.NEXT_PUBLIC_YOUTUBE_QUOTA_ENFORCEMENT === 'true'

  useEffect(() => {
    loadData()
    
    // Check for OAuth callback params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('youtube_connected')) {
        setSuccess('YouTube channel connected successfully!')
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
    
    // Refresh quota status every 30 seconds if enforcement is enabled
    if (quotaEnforcementEnabled) {
      const interval = setInterval(loadQuotaStatus, 30000)
      return () => clearInterval(interval)
    }
  }, [quotaEnforcementEnabled])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load YouTube connections
      const connectionsResponse = await api.get('/youtube/connections')
      setConnections(connectionsResponse.data?.connections || [])
      
      // Load config if admin
      if (isAdmin) {
        const configResponse = await api.get('/youtube/config')
        setConfig(configResponse.data)
        
        // Set form values
        if (configResponse.data) {
          setClientId(configResponse.data.clientId || '')
          setQuotaLimit(configResponse.data.dailyQuotaLimit || configResponse.data.quotaLimit || 10000)
          setQuotaAlertThreshold(configResponse.data.quotaAlertThreshold || 80)
          setAutoStopOnQuotaExceeded(configResponse.data.autoStopOnQuotaExceeded !== false)
        }
      }
      
      // Load quota status if enforcement is enabled
      if (quotaEnforcementEnabled) {
        await loadQuotaStatus()
      }
    } catch (error: any) {
      console.error('Error loading YouTube data:', error)
      setError('Failed to load YouTube integration data')
    } finally {
      setLoading(false)
    }
  }
  
  const loadQuotaStatus = async () => {
    if (!user?.organizationId) return
    
    try {
      const status = await quotaManager.getQuotaStatus(user.organizationId)
      setQuotaStatus(status)
    } catch (error) {
      console.error('Error loading quota status:', error)
    }
  }

  const handleConnectChannel = () => {
    if (!connectionName.trim()) {
      setError('Please enter a name for this connection')
      return
    }
    
    // Check quota before connecting
    if (quotaStatus && !quotaStatus.canSync) {
      setError('Cannot connect new channel: YouTube API quota exceeded. Please wait for reset.')
      return
    }
    
    if (typeof window !== 'undefined') {
      window.location.href = `/api/youtube/auth/connect?connectionName=${encodeURIComponent(connectionName)}`
    }
  }

  const handleToggleSync = async (connectionId: string, enabled: boolean) => {
    // Check quota before enabling sync
    if (enabled && quotaStatus && !quotaStatus.canSync) {
      setError('Cannot enable sync: YouTube API quota exceeded. Please wait for reset.')
      return
    }
    
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
        quotaLimit,
        dailyQuotaLimit: quotaLimit,
        quotaAlertThreshold,
        autoStopOnQuotaExceeded
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
      
      const response = await api.put('/youtube/config', data)
      
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

  const formatResetTime = (resetAt: Date | string | undefined) => {
    if (!resetAt) return 'Unknown'
    const date = new Date(resetAt)
    const now = new Date()
    const hoursUntilReset = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60))
    const minutesUntilReset = Math.floor((date.getTime() - now.getTime()) / (1000 * 60)) % 60
    
    if (hoursUntilReset > 0) {
      return `${hoursUntilReset}h ${minutesUntilReset}m`
    } else if (minutesUntilReset > 0) {
      return `${minutesUntilReset}m`
    } else {
      return 'Soon'
    }
  }

  const getQuotaColor = (percentage: number) => {
    if (percentage >= 100) return 'error'
    if (percentage >= 80) return 'warning'
    if (percentage >= 50) return 'info'
    return 'success'
  }

  const getQuotaIcon = (percentage: number) => {
    if (percentage >= 100) return <ErrorIcon />
    if (percentage >= 80) return <WarningIcon />
    return <InfoIcon />
  }

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
              {quotaEnforcementEnabled && (
                <Chip 
                  label="Quota Enforcement Active" 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
              )}
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

          {/* Enhanced Quota Status Section */}
          {quotaEnforcementEnabled && quotaStatus && (
            <Paper sx={{ mb: 3, p: 2, bgcolor: 'background.default' }} elevation={0}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Daily API Quota Usage
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ScheduleIcon fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    Resets in {formatResetTime(quotaStatus.resetAt)}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">
                    {quotaStatus.used.toLocaleString()} / {quotaStatus.limit.toLocaleString()} units
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color={getQuotaColor(quotaStatus.percentage) + '.main'}
                    fontWeight="bold"
                  >
                    {quotaStatus.percentage.toFixed(1)}%
                  </Typography>
                </Box>
                
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(quotaStatus.percentage, 100)}
                  color={getQuotaColor(quotaStatus.percentage)}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
              
              {/* Quota Alerts */}
              {quotaStatus.percentage >= 100 && (
                <Alert 
                  severity="error" 
                  icon={<ErrorIcon />}
                  sx={{ mb: 1 }}
                >
                  <strong>Quota Exceeded!</strong> YouTube sync is paused until midnight. 
                  API calls are blocked to prevent overage charges.
                </Alert>
              )}
              
              {quotaStatus.percentage >= 80 && quotaStatus.percentage < 100 && (
                <Alert 
                  severity="warning" 
                  icon={<WarningIcon />}
                  sx={{ mb: 1 }}
                >
                  <strong>Quota Warning!</strong> You've used {quotaStatus.percentage.toFixed(0)}% of your daily quota. 
                  Consider reducing sync frequency.
                </Alert>
              )}
              
              {quotaStatus.isPaused && (
                <Alert 
                  severity="info" 
                  icon={<InfoIcon />}
                >
                  Sync is currently paused due to quota limits. It will resume automatically at midnight.
                </Alert>
              )}
              
              {/* Cost breakdown hint */}
              <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>API Cost Guide:</strong> Search: 100 units • Video details: 3 units • 
                  Channel info: 3 units • Playlist items: 2 units • Analytics: 1 unit
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Original API Configuration Section */}
          {config && !quotaEnforcementEnabled && (
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
                    color={config.quotaUsed / config.quotaLimit > 0.9 ? 'error' : 
                           config.quotaUsed / config.quotaLimit > 0.7 ? 'warning' : 'default'}
                    size="small"
                  />
                )}
              </Box>
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
            {canConnect && config?.hasOAuth && (!quotaStatus || quotaStatus.canSync) && (
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
                  disabled={!connectionName.trim() || (quotaStatus && !quotaStatus.canSync)}
                >
                  Add Connection
                </Button>
              </Box>
            )}
          </Box>

          {/* Connection list - similar to original */}
          {connections.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <YouTubeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary" gutterBottom>
                No YouTube accounts connected yet
              </Typography>
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
                          <Chip 
                            label="Sync Enabled" 
                            color={quotaStatus && !quotaStatus.canSync ? 'default' : 'success'} 
                            size="small" 
                          />
                        )}
                        {quotaStatus && !quotaStatus.canSync && connection.syncEnabled && (
                          <Chip label="Paused - Quota" color="warning" size="small" />
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
                        <Typography variant="body2" color="text.secondary">
                          {connection.showCount || 0} shows linked • 
                          Last sync: {connection.lastSync ? new Date(connection.lastSync).toLocaleString() : 'Never'}
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
                            disabled={!canConnect || (quotaStatus && !quotaStatus.canSync && !connection.syncEnabled)}
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

      {/* Enhanced Configuration Dialog with Quota Settings */}
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
              Configure your YouTube Data API v3 credentials and quota settings.
            </Alert>

            <TextField
              fullWidth
              label="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.apiKey ? '••••••••' : 'AIza...'}
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

            <Divider sx={{ my: 3 }}>Quota Management</Divider>

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
            
            <TextField
              fullWidth
              label="Alert Threshold (%)"
              type="number"
              value={quotaAlertThreshold}
              onChange={(e) => setQuotaAlertThreshold(parseInt(e.target.value) || 80)}
              margin="normal"
              helperText="Send alert when quota usage reaches this percentage"
              inputProps={{ min: 50, max: 95 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={autoStopOnQuotaExceeded}
                  onChange={(e) => setAutoStopOnQuotaExceeded(e.target.checked)}
                />
              }
              label="Automatically pause sync when quota is exceeded"
              sx={{ mt: 2 }}
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