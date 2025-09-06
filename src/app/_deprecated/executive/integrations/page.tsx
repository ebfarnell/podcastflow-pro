'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  LinearProgress,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction
} from '@mui/material'
import {
  AccountBalance,
  Sync,
  Settings,
  CheckCircle,
  Error,
  Warning,
  Info,
  CloudSync,
  Schedule,
  History,
  Refresh,
  Link,
  LinkOff,
  Podcasts,
  IntegrationInstructions,
  YouTube
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default function IntegrationsPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Data state
  const [quickbooksStatus, setQuickbooksStatus] = useState<any>(null)
  const [megaphoneStatus, setMegaphoneStatus] = useState<any>(null)
  const [youtubeStatus, setYoutubeStatus] = useState<any>(null)
  const [syncHistory, setSyncHistory] = useState<any[]>([])
  const [syncing, setSyncing] = useState(false)
  const [megaphoneSyncing, setMegaphoneSyncing] = useState(false)
  const [youtubeSyncing, setYoutubeSyncing] = useState(false)

  // Dialog states
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [megaphoneDialogOpen, setMegaphoneDialogOpen] = useState(false)
  const [megaphoneToken, setMegaphoneToken] = useState('')
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false)

  // Settings state
  const [syncSettings, setSyncSettings] = useState({
    autoSync: true,
    syncFrequency: 'daily',
    accountMappings: {
      revenue: ['4000', '4010', '4020'],
      expenses: ['6000', '6100', '6200'],
      cogs: ['5000', '5100']
    }
  })

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user) {
      fetchIntegrationStatus()
      
      // Handle callback status
      const callbackSuccess = searchParams.get('success')
      const callbackError = searchParams.get('error')
      
      if (callbackSuccess === 'connected') {
        setSuccess('QuickBooks connected successfully!')
      } else if (callbackError) {
        setError(`QuickBooks connection failed: ${callbackError}`)
      }
    }
  }, [user, searchParams])

  const fetchIntegrationStatus = async () => {
    try {
      // Fetch QuickBooks status
      const qbResponse = await fetch('/api/quickbooks/auth?action=status')
      if (qbResponse.ok) {
        const qbData = await qbResponse.json()
        setQuickbooksStatus(qbData)
        
        if (qbData.integration?.syncSettings) {
          setSyncSettings(qbData.integration.syncSettings)
        }
      }

      // Fetch Megaphone status
      const mgResponse = await fetch('/api/megaphone/integration')
      if (mgResponse.ok) {
        const mgData = await mgResponse.json()
        setMegaphoneStatus(mgData)
      } else if (mgResponse.status !== 404) {
        console.error('Failed to fetch Megaphone status')
      }
      
      // Fetch YouTube status
      const ytResponse = await fetch('/api/youtube/config')
      if (ytResponse.ok) {
        const ytData = await ytResponse.json()
        setYoutubeStatus(ytData)
      } else if (ytResponse.status !== 404) {
        console.error('Failed to fetch YouTube status')
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Error fetching integration status:', err)
      setError('Failed to load integration status')
      setLoading(false)
    }
  }

  const handleConnectQuickBooks = async () => {
    try {
      const response = await fetch('/api/quickbooks/auth?action=connect')
      if (!response.ok) throw new Error('Failed to initiate QuickBooks connection')
      
      const data = await response.json()
      window.location.href = data.authUrl
    } catch (err) {
      setError('Failed to connect to QuickBooks')
    }
  }

  const handleDisconnectQuickBooks = async () => {
    try {
      const response = await fetch('/api/quickbooks/auth?action=disconnect')
      if (!response.ok) throw new Error('Failed to disconnect QuickBooks')
      
      setSuccess('QuickBooks disconnected successfully')
      setDisconnectDialogOpen(false)
      fetchIntegrationStatus()
    } catch (err) {
      setError('Failed to disconnect QuickBooks')
    }
  }

  const handleManualSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/quickbooks/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manual_sync' })
      })

      if (!response.ok) throw new Error('Failed to start sync')

      const data = await response.json()
      setSuccess('Sync completed successfully')
      fetchIntegrationStatus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleUpdateSettings = async () => {
    try {
      const response = await fetch('/api/quickbooks/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          settings: syncSettings
        })
      })

      if (!response.ok) throw new Error('Failed to update settings')

      setSuccess('Settings updated successfully')
      setSettingsDialogOpen(false)
      fetchIntegrationStatus()
    } catch (err) {
      setError('Failed to update settings')
    }
  }

  // Megaphone handlers
  const handleConnectMegaphone = async () => {
    if (!megaphoneToken.trim()) {
      setError('Please enter a valid Megaphone API token')
      return
    }

    try {
      const response = await fetch('/api/megaphone/integration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiToken: megaphoneToken,
          settings: {
            syncFrequency: 'daily',
            autoSync: true,
            includeDrafts: false,
            syncHistoricalData: true
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to connect')
      }

      setSuccess('Megaphone connected successfully!')
      setMegaphoneDialogOpen(false)
      setMegaphoneToken('')
      fetchIntegrationStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Megaphone')
    }
  }

  const handleDisconnectMegaphone = async () => {
    try {
      const response = await fetch('/api/megaphone/integration', {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to disconnect')

      setSuccess('Megaphone disconnected successfully')
      setMegaphoneStatus(null)
      fetchIntegrationStatus()
    } catch (err) {
      setError('Failed to disconnect Megaphone')
    }
  }

  const handleMegaphoneSync = async () => {
    setMegaphoneSyncing(true)
    try {
      const response = await fetch('/api/megaphone/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          syncType: 'full',
          forceRefresh: true
        })
      })

      if (!response.ok) throw new Error('Failed to start sync')

      const data = await response.json()
      setSuccess(`Sync completed! Processed ${data.itemsProcessed} items`)
      fetchIntegrationStatus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setMegaphoneSyncing(false)
    }
  }

  // YouTube handlers
  const handleConnectYouTube = async () => {
    try {
      const response = await fetch('/api/youtube/auth/connect')
      
      const data = await response.json()
      
      if (!response.ok) {
        if (data.error && data.error.includes('OAuth credentials not configured')) {
          setError('YouTube OAuth is not configured. Please go to Settings > Integrations > YouTube to configure OAuth credentials first.')
          return
        }
        throw new Error(data.error || 'Failed to initiate YouTube connection')
      }
      
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        throw new Error('No authorization URL received')
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to connect to YouTube. Please try again.')
      }
    }
  }

  const handleDisconnectYouTube = async () => {
    try {
      const response = await fetch('/api/youtube/auth/disconnect', {
        method: 'POST'
      })
      
      if (!response.ok) throw new Error('Failed to disconnect')
      
      setSuccess('YouTube disconnected successfully')
      setYoutubeStatus(null)
      fetchIntegrationStatus()
    } catch (err) {
      setError('Failed to disconnect YouTube')
    }
  }

  const handleYouTubeSync = async () => {
    setYoutubeSyncing(true)
    try {
      const response = await fetch('/api/youtube/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'sync',
          forceRefresh: true
        })
      })

      if (!response.ok) throw new Error('Failed to sync')

      const data = await response.json()
      setSuccess('YouTube data synced successfully!')
      fetchIntegrationStatus()
    } catch (err: any) {
      setError(err.message || 'Failed to sync YouTube data')
    } finally {
      setYoutubeSyncing(false)
    }
  }

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'failed': return 'error'
      case 'running': return 'primary'
      case 'pending': return 'warning'
      default: return 'default'
    }
  }

  // Check if user has admin permissions
  const canManageIntegrations = ['master', 'admin'].includes(user?.role || '')

  if (sessionLoading || loading) return <DashboardLayout><LinearProgress /></DashboardLayout>
  if (!user) return null

  if (!canManageIntegrations) {
    return (
      <DashboardLayout>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Error sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" color="textSecondary">
            You need admin privileges to manage integrations.
          </Typography>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Integrations
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Connect external services for data synchronization
            </Typography>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Integrations Grid */}
        <Grid container spacing={3}>
          {/* QuickBooks Integration */}
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 3, height: 320, overflow: 'hidden', position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <AccountBalance sx={{ fontSize: 40, color: 'primary.main' }} />
                <Box>
                  <Typography variant="h5" gutterBottom>
                    QuickBooks Integration
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Sync financial data for accurate P&L reporting
                  </Typography>
                </Box>
              </Box>

              {quickbooksStatus?.connected ? (
                <Box>
                  {/* Connected Status */}
                  <Alert severity="success" sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          Connected to {quickbooksStatus.companyName}
                        </Typography>
                        {quickbooksStatus.lastSync && (
                          <Typography variant="caption" color="textSecondary">
                            Last sync: {new Date(quickbooksStatus.lastSync).toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<Refresh />}
                          onClick={handleManualSync}
                          disabled={syncing}
                        >
                          {syncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                        <Button
                          size="small"
                          startIcon={<Settings />}
                          onClick={() => setSettingsDialogOpen(true)}
                        >
                          Settings
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<LinkOff />}
                          onClick={() => setDisconnectDialogOpen(true)}
                        >
                          Disconnect
                        </Button>
                      </Box>
                    </Box>
                  </Alert>

                  {/* Sync Settings Display */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            Auto Sync
                          </Typography>
                          <Chip
                            label={syncSettings.autoSync ? 'Enabled' : 'Disabled'}
                            color={syncSettings.autoSync ? 'success' : 'default'}
                            size="small"
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            Frequency
                          </Typography>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {syncSettings.syncFrequency}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            Account Mappings
                          </Typography>
                          <Typography variant="body2">
                            {Object.keys(syncSettings.accountMappings).length} categories mapped
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Account Mappings */}
                  <Typography variant="h6" gutterBottom>
                    Account Mappings
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Category</TableCell>
                          <TableCell>QuickBooks Accounts</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(syncSettings.accountMappings).map(([category, accounts]) => (
                          <TableRow key={category}>
                            <TableCell>
                              <Chip 
                                label={category.toUpperCase()} 
                                size="small" 
                                color="primary" 
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              {Array.isArray(accounts) ? (
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  {accounts.map((account: string) => (
                                    <Chip key={account} label={account} size="small" variant="outlined" />
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="body2">No accounts mapped</Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  height: 'calc(320px - 48px - 88px)', // Total height - padding - header
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <CloudSync sx={{ fontSize: 60, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" gutterBottom sx={{ mb: 0.5 }}>
                    Connect QuickBooks
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2, px: 2 }}>
                    Connect your QuickBooks account to automatically sync financial data
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<Link />}
                    onClick={handleConnectQuickBooks}
                  >
                    Connect QuickBooks
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Megaphone Integration */}
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 3, height: 320, overflow: 'hidden', position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Podcasts sx={{ fontSize: 40, color: 'secondary.main' }} />
                <Box>
                  <Typography variant="h5" gutterBottom>
                    Megaphone Integration
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Sync podcast shows and episodes data
                  </Typography>
                </Box>
              </Box>

              {megaphoneStatus?.isActive ? (
                <Box>
                  {/* Connected Status */}
                  <Alert severity="success" sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          Connected to Megaphone
                        </Typography>
                        {megaphoneStatus.lastSyncAt && (
                          <Typography variant="caption" color="textSecondary">
                            Last sync: {new Date(megaphoneStatus.lastSyncAt).toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<Refresh />}
                          onClick={handleMegaphoneSync}
                          disabled={megaphoneSyncing}
                        >
                          {megaphoneSyncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<LinkOff />}
                          onClick={handleDisconnectMegaphone}
                        >
                          Disconnect
                        </Button>
                      </Box>
                    </Box>
                  </Alert>

                  {/* Status Information */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            Sync Status
                          </Typography>
                          <Chip
                            label={megaphoneStatus.syncStatus || 'Idle'}
                            color={megaphoneStatus.syncStatus === 'success' ? 'success' : 'default'}
                            size="small"
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            Frequency
                          </Typography>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {megaphoneStatus.syncFrequency || 'Daily'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Networks & Podcasts Summary */}
                  {megaphoneStatus.networks && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Networks
                      </Typography>
                      <List dense>
                        {megaphoneStatus.networks.map((network: any) => (
                          <ListItem key={network.id}>
                            <ListItemText
                              primary={network.name}
                              secondary={`${network.podcastCount} podcasts`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  height: 'calc(320px - 48px - 88px)', // Total height - padding - header
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <CloudSync sx={{ fontSize: 60, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" gutterBottom sx={{ mb: 0.5 }}>
                    Connect Megaphone
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2, px: 2 }}>
                    Connect your Megaphone account to sync show and episode data automatically
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    color="secondary"
                    startIcon={<Link />}
                    onClick={() => setMegaphoneDialogOpen(true)}
                  >
                    Connect Megaphone
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* YouTube Integration */}
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 3, height: 320, overflow: 'hidden', position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <YouTube sx={{ fontSize: 40, color: '#ff0000' }} />
                <Box>
                  <Typography variant="h5" gutterBottom>
                    YouTube Integration
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Sync video analytics and channel data
                  </Typography>
                </Box>
              </Box>

              {youtubeStatus?.isConnected ? (
                <Box>
                  {/* Connected Status */}
                  <Alert severity="success" sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          Connected to YouTube
                        </Typography>
                        {youtubeStatus.channels && youtubeStatus.channels.length > 0 && (
                          <Typography variant="caption" color="textSecondary">
                            {youtubeStatus.channels.length} channel{youtubeStatus.channels.length > 1 ? 's' : ''} connected
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<Refresh />}
                          onClick={handleYouTubeSync}
                          disabled={youtubeSyncing}
                        >
                          {youtubeSyncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                        <Button
                          size="small"
                          startIcon={<Settings />}
                          onClick={() => window.location.href = '/integrations/youtube'}
                        >
                          Manage
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<LinkOff />}
                          onClick={handleDisconnectYouTube}
                        >
                          Disconnect
                        </Button>
                      </Box>
                    </Box>
                  </Alert>

                  {/* Connected Channels */}
                  {youtubeStatus.channels && youtubeStatus.channels.length > 0 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Connected Channels
                      </Typography>
                      <Grid container spacing={2}>
                        {youtubeStatus.channels.map((channel: any) => (
                          <Grid item xs={12} key={channel.id}>
                            <Card variant="outlined">
                              <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  {channel.thumbnailUrl && (
                                    <img 
                                      src={channel.thumbnailUrl} 
                                      alt={channel.title}
                                      style={{ width: 48, height: 48, borderRadius: '50%' }}
                                    />
                                  )}
                                  <Box>
                                    <Typography variant="subtitle1">
                                      {channel.title}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                      {channel.subscriberCount ? `${channel.subscriberCount.toLocaleString()} subscribers` : 'Channel ID: ' + channel.id}
                                    </Typography>
                                  </Box>
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  height: 'calc(320px - 48px - 88px)', // Total height - padding - header
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <CloudSync sx={{ fontSize: 60, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" gutterBottom sx={{ mb: 0.5 }}>
                    Connect YouTube
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2, px: 2 }}>
                    Connect your YouTube account to track video performance and analytics
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<Settings />}
                      onClick={() => window.location.href = '/integrations/youtube'}
                    >
                      Configure OAuth
                    </Button>
                    <Button
                      variant="contained"
                      size="large"
                      sx={{ 
                        backgroundColor: '#ff0000',
                        '&:hover': { backgroundColor: '#cc0000' }
                      }}
                      startIcon={<Link />}
                      onClick={handleConnectYouTube}
                    >
                      Connect YouTube
                    </Button>
                  </Box>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Sync History Section */}
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Sync History
              </Typography>
              
              {syncHistory.length > 0 ? (
                <List>
                  {syncHistory.map((sync) => (
                    <ListItem key={sync.id} divider>
                      <ListItemIcon>
                        {sync.status === 'completed' && <CheckCircle color="success" />}
                        {sync.status === 'failed' && <Error color="error" />}
                        {sync.status === 'running' && <Sync color="primary" />}
                        {sync.status === 'pending' && <Schedule color="warning" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2">
                              {sync.syncType} sync
                            </Typography>
                            <Chip 
                              label={sync.status} 
                              size="small" 
                              color={getSyncStatusColor(sync.status)}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption">
                              {new Date(sync.startedAt).toLocaleString()}
                            </Typography>
                            {sync.recordsProcessed && (
                              <Typography variant="caption" display="block">
                                {sync.recordsProcessed} records processed
                              </Typography>
                            )}
                            {sync.errorMessage && (
                              <Typography variant="caption" color="error" display="block">
                                {sync.errorMessage}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <History sx={{ fontSize: 60, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="textSecondary">
                    No sync history yet
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Settings Dialog */}
        <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>QuickBooks Sync Settings</DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={syncSettings.autoSync}
                      onChange={(e) => setSyncSettings({ ...syncSettings, autoSync: e.target.checked })}
                    />
                  }
                  label="Enable automatic sync"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Sync Frequency</InputLabel>
                  <Select
                    value={syncSettings.syncFrequency}
                    onChange={(e) => setSyncSettings({ ...syncSettings, syncFrequency: e.target.value })}
                    label="Sync Frequency"
                  >
                    <MenuItem value="hourly">Hourly</MenuItem>
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Account Mappings
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Map QuickBooks account codes to financial categories
                </Typography>
              </Grid>

              {Object.entries(syncSettings.accountMappings).map(([category, accounts]) => (
                <Grid item xs={12} key={category}>
                  <TextField
                    fullWidth
                    label={`${category.toUpperCase()} Account Codes`}
                    value={Array.isArray(accounts) ? accounts.join(', ') : ''}
                    onChange={(e) => {
                      const newAccounts = e.target.value.split(',').map(s => s.trim()).filter(s => s)
                      setSyncSettings({
                        ...syncSettings,
                        accountMappings: {
                          ...syncSettings.accountMappings,
                          [category]: newAccounts
                        }
                      })
                    }}
                    placeholder="Enter account codes separated by commas (e.g., 4000, 4010, 4020)"
                    helperText={`QuickBooks account codes for ${category} accounts`}
                  />
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleUpdateSettings}>
              Save Settings
            </Button>
          </DialogActions>
        </Dialog>

        {/* Disconnect Dialog */}
        <Dialog open={disconnectDialogOpen} onClose={() => setDisconnectDialogOpen(false)}>
          <DialogTitle>Disconnect QuickBooks</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to disconnect QuickBooks? This will stop automatic syncing and 
              remove access to your QuickBooks data.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDisconnectDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDisconnectQuickBooks}>
              Disconnect
            </Button>
          </DialogActions>
        </Dialog>

        {/* Megaphone Connection Dialog */}
        <Dialog open={megaphoneDialogOpen} onClose={() => setMegaphoneDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Connect to Megaphone</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Enter your Megaphone API token to connect your account. You can generate a token by logging into Megaphone, 
              hovering over your initials in the lower-left corner, selecting "Settings", and clicking "Generate New Token".
            </Typography>
            <TextField
              fullWidth
              label="Megaphone API Token"
              type="password"
              value={megaphoneToken}
              onChange={(e) => setMegaphoneToken(e.target.value)}
              placeholder="Enter your API token..."
              helperText="Your API token will be encrypted and stored securely"
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMegaphoneDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={handleConnectMegaphone}
              disabled={!megaphoneToken.trim()}
            >
              Connect
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}