import { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  TextField,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Skeleton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material'
import {
  Sync as SyncIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MegaphoneService, SyncOptions } from '@/services/megaphoneService'

interface MegaphoneIntegration {
  id: string
  organizationId: string
  isActive: boolean
  syncStatus: 'idle' | 'syncing' | 'error' | 'success'
  lastSyncAt?: string
  lastError?: string
  syncFrequency: 'manual' | 'hourly' | 'daily' | 'weekly'
  settings: {
    autoSync?: boolean
    includeDrafts?: boolean
    syncHistoricalData?: boolean
  }
  networks?: Array<{
    id: string
    name: string
    podcastCount: number
  }>
  podcasts?: Array<{
    id: string
    title: string
    episodesCount: number
    lastSyncAt: string
  }>
  syncLogs?: Array<{
    id: string
    syncType: string
    status: string
    itemsProcessed: number
    itemsFailed: number
    startedAt: string
    completedAt?: string
    errors?: string[]
  }>
}

export function MegaphoneIntegrationSettings() {
  const queryClient = useQueryClient()
  const [setupDialog, setSetupDialog] = useState(false)
  const [syncDialog, setSyncDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [setupForm, setSetupForm] = useState({
    apiToken: '',
    syncFrequency: 'daily' as const,
    autoSync: true,
    includeDrafts: false,
    syncHistoricalData: true,
  })

  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    syncType: 'full',
    forceRefresh: false,
  })

  // Fetch Megaphone integration data
  const { data: integration, isLoading, refetch } = useQuery<MegaphoneIntegration | null>({
    queryKey: ['megaphone-integration'],
    queryFn: async () => {
      try {
        return await MegaphoneService.getIntegration()
      } catch (error) {
        return null
      }
    },
  })

  // Setup integration
  const setupMutation = useMutation({
    mutationFn: async (data: typeof setupForm) => {
      const result = await MegaphoneService.setupIntegration(
        data.apiToken,
        {
          syncFrequency: data.syncFrequency,
          autoSync: data.autoSync,
          includeDrafts: data.includeDrafts,
          syncHistoricalData: data.syncHistoricalData,
        }
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to setup integration')
      }
      
      return result.integration
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['megaphone-integration'] })
      setSuccess('Megaphone integration setup successfully!')
      setSetupDialog(false)
      setSetupForm({
        apiToken: '',
        syncFrequency: 'daily',
        autoSync: true,
        includeDrafts: false,
        syncHistoricalData: true,
      })
      setTimeout(() => setSuccess(null), 5000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to setup integration')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Sync data
  const syncMutation = useMutation({
    mutationFn: async (options: SyncOptions) => {
      const result = await MegaphoneService.syncData(options)
      
      if (!result.success) {
        throw new Error(result.errors.join('; ') || 'Sync failed')
      }
      
      return result
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['megaphone-integration'] })
      setSuccess(
        `Sync completed! Processed ${result.itemsProcessed} items in ${Math.round(result.duration / 1000)}s`
      )
      setSyncDialog(false)
      setTimeout(() => setSuccess(null), 5000)
    },
    onError: (err: any) => {
      setError(err.message || 'Sync failed')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Delete integration
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await MegaphoneService.deleteIntegration()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['megaphone-integration'] })
      setSuccess('Megaphone integration removed successfully!')
      setDeleteDialog(false)
      setTimeout(() => setSuccess(null), 5000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to remove integration')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Test connection
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const result = await MegaphoneService.testConnection(setupForm.apiToken)
      
      if (!result.success) {
        throw new Error('Invalid API token or connection failed')
      }
      
      return result
    },
    onSuccess: (result) => {
      setSuccess(`Connection successful! Found ${result.networkCount} networks.`)
      setTimeout(() => setSuccess(null), 5000)
    },
    onError: (err: any) => {
      setError(err.message || 'Connection test failed')
      setTimeout(() => setError(null), 5000)
    },
  })

  const handleSetup = () => {
    setupMutation.mutate(setupForm)
  }

  const handleSync = () => {
    syncMutation.mutate(syncOptions)
  }

  const handleTestConnection = () => {
    if (!setupForm.apiToken.trim()) {
      setError('Please enter an API token')
      setTimeout(() => setError(null), 3000)
      return
    }
    testConnectionMutation.mutate()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success'
      case 'syncing':
        return 'info'
      case 'error':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon />
      case 'syncing':
        return <SyncIcon />
      case 'error':
        return <ErrorIcon />
      default:
        return <InfoIcon />
    }
  }

  if (isLoading) {
    return (
      <>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Skeleton variant="text" width={200} height={32} />
              <Skeleton variant="rectangular" width={120} height={36} />
            </Box>
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="80%" />
            <Box sx={{ mt: 3 }}>
              <Skeleton variant="rectangular" width="100%" height={60} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Skeleton variant="text" width={150} height={28} />
            {[1, 2, 3].map((i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 2 }}>
                <Skeleton variant="text" width={200} />
                <Skeleton variant="text" width={100} />
                <Skeleton variant="circular" width={24} height={24} />
              </Box>
            ))}
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      {/* Integration Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Megaphone Integration
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {integration ? (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<SyncIcon />}
                    onClick={() => setSyncDialog(true)}
                    disabled={integration.syncStatus === 'syncing'}
                  >
                    Sync Now
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<SettingsIcon />}
                    onClick={() => {
                      setSetupForm({
                        apiToken: '••••••••••••••••',
                        syncFrequency: integration.syncFrequency,
                        autoSync: integration.settings.autoSync || false,
                        includeDrafts: integration.settings.includeDrafts || false,
                        syncHistoricalData: integration.settings.syncHistoricalData || false,
                      })
                      setSetupDialog(true)
                    }}
                  >
                    Configure
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteDialog(true)}
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => setSetupDialog(true)}
                >
                  Setup Integration
                </Button>
              )}
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

          {integration ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Chip
                  label={integration.syncStatus.charAt(0).toUpperCase() + integration.syncStatus.slice(1)}
                  color={getStatusColor(integration.syncStatus) as any}
                  icon={getStatusIcon(integration.syncStatus)}
                />
                <Typography variant="body2" color="textSecondary">
                  {integration.lastSyncAt ? (
                    `Last sync: ${new Date(integration.lastSyncAt).toLocaleString()}`
                  ) : (
                    'Never synced'
                  )}
                </Typography>
              </Box>

              {integration.syncStatus === 'syncing' && (
                <LinearProgress sx={{ mb: 2 }} />
              )}

              {integration.lastError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  <Typography variant="body2">{integration.lastError}</Typography>
                </Alert>
              )}

              {/* Statistics */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {integration.networks?.length || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Networks
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {integration.podcasts?.length || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Podcasts
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {integration.podcasts?.reduce((sum, p) => sum + p.episodesCount, 0) || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Episodes
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" gutterBottom>
                Connect to Megaphone
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Integrate with Megaphone to sync your podcast data, analytics, and episode information.
              </Typography>
              <Typography variant="body2" color="textSecondary">
                You'll need your Megaphone API token to get started.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Recent Sync Logs */}
      {integration?.syncLogs && integration.syncLogs.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Sync Activity
            </Typography>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Processed</TableCell>
                    <TableCell align="right">Failed</TableCell>
                    <TableCell align="right">Duration</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {integration.syncLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.syncType}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.status}
                          color={getStatusColor(log.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">{log.itemsProcessed}</TableCell>
                      <TableCell align="right">
                        {log.itemsFailed > 0 ? (
                          <Chip
                            label={log.itemsFailed}
                            color="error"
                            size="small"
                          />
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {log.completedAt ? (
                          `${Math.round(
                            (new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000
                          )}s`
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Setup/Configure Dialog */}
      <Dialog open={setupDialog} onClose={() => setSetupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {integration ? 'Configure Integration' : 'Setup Megaphone Integration'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="API Token"
              fullWidth
              type={integration ? 'password' : 'text'}
              value={setupForm.apiToken}
              onChange={(e) => setSetupForm({ ...setupForm, apiToken: e.target.value })}
              helperText={
                integration
                  ? 'Leave unchanged to keep existing token'
                  : 'Get your API token from Megaphone dashboard'
              }
              InputProps={{
                endAdornment: !integration && (
                  <Button
                    size="small"
                    onClick={handleTestConnection}
                    disabled={!setupForm.apiToken.trim() || testConnectionMutation.isPending}
                  >
                    Test
                  </Button>
                ),
              }}
            />

            <FormControl fullWidth>
              <InputLabel>Sync Frequency</InputLabel>
              <Select
                value={setupForm.syncFrequency}
                label="Sync Frequency"
                onChange={(e) => setSetupForm({ ...setupForm, syncFrequency: e.target.value as any })}
              >
                <MenuItem value="manual">Manual only</MenuItem>
                <MenuItem value="hourly">Every hour</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={setupForm.autoSync}
                    onChange={(e) => setSetupForm({ ...setupForm, autoSync: e.target.checked })}
                  />
                }
                label="Enable automatic sync"
              />
              <Typography variant="body2" color="textSecondary" sx={{ ml: 4 }}>
                Automatically sync data based on frequency setting
              </Typography>
            </Box>

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={setupForm.includeDrafts}
                    onChange={(e) => setSetupForm({ ...setupForm, includeDrafts: e.target.checked })}
                  />
                }
                label="Include draft episodes"
              />
              <Typography variant="body2" color="textSecondary" sx={{ ml: 4 }}>
                Sync episodes that are still in draft status
              </Typography>
            </Box>

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={setupForm.syncHistoricalData}
                    onChange={(e) => setSetupForm({ ...setupForm, syncHistoricalData: e.target.checked })}
                  />
                }
                label="Sync historical data"
              />
              <Typography variant="body2" color="textSecondary" sx={{ ml: 4 }}>
                Include older episodes and historical analytics data
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetupDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSetup}
            disabled={
              !setupForm.apiToken.trim() ||
              setupMutation.isPending ||
              (integration && setupForm.apiToken === '••••••••••••••••')
            }
          >
            {integration ? 'Update' : 'Setup'} Integration
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync Dialog */}
      <Dialog open={syncDialog} onClose={() => setSyncDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Sync Megaphone Data</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Sync Type</InputLabel>
              <Select
                value={syncOptions.syncType}
                label="Sync Type"
                onChange={(e) => setSyncOptions({ ...syncOptions, syncType: e.target.value as any })}
              >
                <MenuItem value="full">Full sync (all data)</MenuItem>
                <MenuItem value="incremental">Incremental (changes only)</MenuItem>
                <MenuItem value="podcast">Podcasts only</MenuItem>
                <MenuItem value="episode">Episodes only</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={syncOptions.forceRefresh || false}
                    onChange={(e) => setSyncOptions({ ...syncOptions, forceRefresh: e.target.checked })}
                  />
                }
                label="Force refresh all data"
              />
              <Typography variant="body2" color="textSecondary" sx={{ ml: 4 }}>
                Re-download and update all existing records
              </Typography>
            </Box>

            <Alert severity="info">
              <Typography variant="body2">
                Syncing may take several minutes depending on the amount of data. 
                You can continue using the app while sync runs in the background.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSync}
            disabled={syncMutation.isPending}
            startIcon={<SyncIcon />}
          >
            Start Sync
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove Integration</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              This will permanently remove the Megaphone integration and all synced data. 
              This action cannot be undone.
            </Typography>
          </Alert>
          <Typography variant="body2">
            Are you sure you want to remove the Megaphone integration?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            Remove Integration
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}