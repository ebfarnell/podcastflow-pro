'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  FormControlLabel,
  Switch,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  LinearProgress
} from '@mui/material'
import {
  YouTube as YouTubeIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  Schedule as ScheduleIcon,
  PlayCircleOutline as PlayIcon
} from '@mui/icons-material'
import { format } from 'date-fns'

interface YouTubeSyncSettingsProps {
  showId: string
  showName: string
}

interface SyncStatus {
  lastSync?: string
  videosProcessed?: number
  episodesCreated?: number
  episodesUpdated?: number
  status?: 'idle' | 'syncing' | 'completed' | 'failed'
  error?: string
}

interface YouTubeSettings {
  youtubeChannelUrl?: string
  youtubeChannelId?: string
  youtubeChannelName?: string
  youtubeSyncEnabled: boolean
  youtubeAutoCreateEpisodes: boolean
  youtubeLastSyncAt?: string
}

export function YouTubeSyncSettings({ showId, showName }: YouTubeSyncSettingsProps) {
  const [settings, setSettings] = useState<YouTubeSettings>({
    youtubeSyncEnabled: false,
    youtubeAutoCreateEpisodes: false
  })
  const [channelUrl, setChannelUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({})
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncResults, setSyncResults] = useState<any>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadShowSettings()
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [showId])

  const loadShowSettings = async () => {
    try {
      const response = await fetch(`/api/shows/${showId}`)
      if (!response.ok) throw new Error('Failed to load show settings')
      
      const data = await response.json()
      setSettings({
        youtubeChannelUrl: data.youtubeChannelUrl || '',
        youtubeChannelId: data.youtubeChannelId || '',
        youtubeChannelName: data.youtubeChannelName || '',
        youtubeSyncEnabled: data.youtubeSyncEnabled || false,
        youtubeAutoCreateEpisodes: data.youtubeAutoCreateEpisodes || false,
        youtubeLastSyncAt: data.youtubeLastSyncAt
      })
      setChannelUrl(data.youtubeChannelUrl || '')
      
      // Load last sync status
      loadSyncStatus()
    } catch (err) {
      console.error('Error loading show settings:', err)
      setError('Failed to load YouTube settings')
    }
  }

  const loadSyncStatus = async () => {
    try {
      const response = await fetch(`/api/shows/${showId}/sync-youtube/status`)
      if (!response.ok) return
      
      const data = await response.json()
      if (data.lastSync) {
        setSyncStatus({
          lastSync: data.lastSync.completedAt,
          videosProcessed: data.lastSync.totalItems,
          episodesCreated: data.lastSync.results?.created || 0,
          episodesUpdated: data.lastSync.results?.updated || 0,
          status: data.lastSync.status === 'completed' ? 'completed' : 
                  data.lastSync.status === 'failed' ? 'failed' : 'idle',
          error: data.lastSync.errorMessage
        })
      }
    } catch (err) {
      console.error('Error loading sync status:', err)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/shows/${showId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeChannelUrl: channelUrl,
          youtubeSyncEnabled: settings.youtubeSyncEnabled,
          youtubeAutoCreateEpisodes: settings.youtubeAutoCreateEpisodes
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      setSuccess('YouTube settings saved successfully')
      await loadShowSettings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const startSync = async (mode: 'sync' | 'background' = 'background') => {
    setSyncing(true)
    setError(null)
    setSuccess(null)
    setSyncResults(null)

    try {
      const response = await fetch(
        `/api/shows/${showId}/sync-youtube?mode=${mode}`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start sync')
      }

      const data = await response.json()
      
      if (data.mode === 'sync') {
        // Quick sync completed
        setSyncResults(data.results)
        setSyncStatus({
          status: 'completed',
          videosProcessed: data.results.videosProcessed,
          episodesCreated: data.results.episodesCreated,
          episodesUpdated: data.results.episodesUpdated
        })
        setSuccess(`Sync completed! Created ${data.results.episodesCreated} episodes, updated ${data.results.episodesUpdated}`)
      } else {
        // Background job started
        setJobId(data.jobId)
        setSyncStatus({ status: 'syncing' })
        setSuccess('Sync started in background. This may take a few minutes...')
        
        // Start polling for job status
        const interval = setInterval(() => {
          checkJobStatus(data.jobId)
        }, 2000)
        setPollInterval(interval)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync')
      setSyncStatus({ status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      if (mode === 'sync') {
        setSyncing(false)
      }
    }
  }

  const checkJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/shows/${showId}/sync-youtube/status?jobId=${jobId}`)
      if (!response.ok) return

      const data = await response.json()
      
      if (data.status === 'completed') {
        setSyncing(false)
        setSyncResults(data.result)
        setSyncStatus({
          status: 'completed',
          videosProcessed: data.result?.videosProcessed,
          episodesCreated: data.result?.episodesCreated,
          episodesUpdated: data.result?.episodesUpdated
        })
        setSuccess(`Sync completed! Created ${data.result?.episodesCreated || 0} episodes, updated ${data.result?.episodesUpdated || 0}`)
        
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }
        
        // Reload settings to get updated last sync time
        loadShowSettings()
      } else if (data.status === 'failed') {
        setSyncing(false)
        setSyncStatus({ status: 'failed', error: data.error })
        setError(data.error || 'Sync failed')
        
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }
      }
    } catch (err) {
      console.error('Error checking job status:', err)
    }
  }

  const getStatusChip = () => {
    if (syncStatus.status === 'syncing' || syncing) {
      return <Chip label="Syncing..." color="info" size="small" icon={<CircularProgress size={16} />} />
    }
    if (syncStatus.status === 'completed') {
      return <Chip label="Synced" color="success" size="small" icon={<CheckCircleIcon />} />
    }
    if (syncStatus.status === 'failed') {
      return <Chip label="Failed" color="error" size="small" icon={<ErrorIcon />} />
    }
    if (settings.youtubeChannelId) {
      return <Chip label="Connected" color="default" size="small" icon={<YouTubeIcon />} />
    }
    return <Chip label="Not Connected" color="default" size="small" />
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <YouTubeIcon color="error" fontSize="large" />
            <Box>
              <Typography variant="h6">YouTube Integration</Typography>
              <Typography variant="body2" color="text.secondary">
                Sync episodes from YouTube channel
              </Typography>
            </Box>
          </Box>
          {getStatusChip()}
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Stack spacing={3}>
          <TextField
            fullWidth
            label="YouTube Channel URL"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            placeholder="https://youtube.com/@channel or https://youtube.com/channel/UCxxxxxx"
            helperText="Enter your YouTube channel URL or @handle"
            InputProps={{
              startAdornment: <YouTubeIcon color="action" sx={{ mr: 1 }} />
            }}
          />

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.youtubeSyncEnabled}
                  onChange={(e) => setSettings({ ...settings, youtubeSyncEnabled: e.target.checked })}
                />
              }
              label="Enable YouTube Sync"
            />
            <Typography variant="caption" color="text.secondary" display="block" ml={4}>
              Automatically sync episodes from YouTube channel
            </Typography>
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.youtubeAutoCreateEpisodes}
                  onChange={(e) => setSettings({ ...settings, youtubeAutoCreateEpisodes: e.target.checked })}
                  disabled={!settings.youtubeSyncEnabled}
                />
              }
              label="Auto-create Episodes"
            />
            <Typography variant="caption" color="text.secondary" display="block" ml={4}>
              Automatically create new episodes from YouTube videos
            </Typography>
          </Box>

          {settings.youtubeLastSyncAt && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                Last synced: {format(new Date(settings.youtubeLastSyncAt), 'PPp')}
              </Typography>
              {syncStatus.videosProcessed !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  {syncStatus.videosProcessed} videos • {syncStatus.episodesCreated} created • {syncStatus.episodesUpdated} updated
                </Typography>
              )}
            </Box>
          )}

          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              onClick={saveSettings}
              disabled={saving || syncing}
              startIcon={saving ? <CircularProgress size={20} /> : <SettingsIcon />}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>

            <Button
              variant="outlined"
              onClick={() => setSyncDialogOpen(true)}
              disabled={!channelUrl || !settings.youtubeSyncEnabled || syncing}
              startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </Box>
        </Stack>

        {/* Sync Dialog */}
        <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Sync YouTube Episodes</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">
                This will fetch videos from your YouTube channel and create/update episodes in PodcastFlow.
              </Alert>
              
              <Typography variant="body2">
                Channel: <strong>{settings.youtubeChannelName || channelUrl}</strong>
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Choose sync mode:
              </Typography>

              <List>
                <ListItem>
                  <ListItemText
                    primary="Quick Sync (Admin Only)"
                    secondary="Sync up to 50 recent videos immediately (may take 30-60 seconds)"
                  />
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setSyncDialogOpen(false)
                        startSync('sync')
                      }}
                    >
                      Quick Sync
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="Background Sync (Recommended)"
                    secondary="Sync all videos in the background (no timeout, can handle large channels)"
                  />
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        setSyncDialogOpen(false)
                        startSync('background')
                      }}
                    >
                      Background Sync
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* Sync Progress */}
        {syncing && (
          <Box mt={3}>
            <Typography variant="body2" gutterBottom>
              Syncing in progress...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {/* Sync Results */}
        {syncResults && (
          <Box mt={3} p={2} bgcolor="background.default" borderRadius={1}>
            <Typography variant="subtitle2" gutterBottom>
              Sync Results
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                Videos Processed: {syncResults.videosProcessed}
              </Typography>
              <Typography variant="body2" color="success.main">
                Episodes Created: {syncResults.episodesCreated}
              </Typography>
              <Typography variant="body2" color="info.main">
                Episodes Updated: {syncResults.episodesUpdated}
              </Typography>
              {syncResults.episodesSkipped > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Episodes Skipped: {syncResults.episodesSkipped}
                </Typography>
              )}
              {syncResults.quotaUsed && (
                <Typography variant="caption" color="text.secondary">
                  API Quota Used: {syncResults.quotaUsed} units
                </Typography>
              )}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}