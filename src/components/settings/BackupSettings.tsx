import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  LinearProgress,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  MenuItem,
} from '@mui/material'
import {
  CloudDownload as CloudDownloadIcon,
  Backup as BackupIcon,
  Schedule as ScheduleIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
  FolderZip as FolderZipIcon,
  TableChart as TableChartIcon,
  Code as CodeIcon,
  Restore as RestoreIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { backupApi } from '@/services/api'

interface Backup {
  id: string
  type: 'manual' | 'scheduled'
  date: string
  size: string
  status: 'completed' | 'in_progress' | 'failed'
  includesData: string[]
  downloadUrl?: string
}

interface BackupSchedule {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  time: string
  dayOfWeek?: number
  dayOfMonth?: number
  retention: number
  includesData: string[]
}

interface ExportEntity {
  name: string
  label: string
  description: string
  selected: boolean
}

const exportFormats = [
  { value: 'json', label: 'JSON', icon: <CodeIcon /> },
  { value: 'csv', label: 'CSV', icon: <TableChartIcon /> },
  { value: 'zip', label: 'ZIP Archive', icon: <FolderZipIcon /> },
]

export function BackupSettings() {
  const queryClient = useQueryClient()
  const [backupDialog, setBackupDialog] = useState(false)
  const [scheduleDialog, setScheduleDialog] = useState(false)
  const [exportDialog, setExportDialog] = useState(false)
  const [restoreDialog, setRestoreDialog] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [exportEntities, setExportEntities] = useState<ExportEntity[]>([
    { name: 'advertisers', label: 'Advertisers', description: 'Advertiser accounts', selected: true },
    { name: 'agencies', label: 'Agencies', description: 'Agency accounts', selected: true },
    { name: 'shows', label: 'Shows', description: 'Podcast shows', selected: true },
    { name: 'episodes', label: 'Episodes', description: 'Podcast episodes', selected: true },
    { name: 'campaigns', label: 'Campaigns', description: 'Advertising campaigns', selected: true },
    { name: 'orders', label: 'Orders', description: 'Campaign orders', selected: true },
    { name: 'schedules', label: 'Schedules', description: 'Ad schedules', selected: true },
    { name: 'invoices', label: 'Invoices', description: 'Billing invoices', selected: true },
    { name: 'payments', label: 'Payments', description: 'Payment records', selected: true },
    { name: 'users', label: 'Team Members', description: 'Organization users', selected: true },
  ])

  const [backupScope, setBackupScope] = useState('db')

  // Fetch backups
  const { data: backups = [], isLoading: backupsLoading, refetch: refetchBackups } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const response = await fetch('/api/backups')
      if (!response.ok) throw new Error('Failed to fetch backups')
      return response.json()
    },
  })

  // Fetch exports
  const { data: exports = [], isLoading: exportsLoading, refetch: refetchExports } = useQuery({
    queryKey: ['exports'],
    queryFn: async () => {
      const response = await fetch('/api/exports')
      if (!response.ok) throw new Error('Failed to fetch exports')
      return response.json()
    },
  })

  // Fetch backup schedule
  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['backup-schedule'],
    queryFn: async () => {
      const response = await fetch('/api/backup-schedule')
      if (!response.ok) throw new Error('Failed to fetch schedule')
      return response.json()
    },
  })

  const [scheduleForm, setScheduleForm] = useState<BackupSchedule>({
    enabled: false,
    frequency: 'weekly',
    time: '02:00',
    dayOfWeek: 0,
    dayOfMonth: 1,
    retention: 30,
    includesData: ['database'],
  })

  // Update schedule form when data loads
  React.useEffect(() => {
    if (schedule) {
      setScheduleForm(schedule)
    }
  }, [schedule])

  const isLoading = backupsLoading || exportsLoading || scheduleLoading

  // Combine backups and exports for display
  const allBackupItems = [
    ...(backups || []),
    ...(exports || [])
  ].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Create backup
  const createBackupMutation = useMutation({
    mutationFn: async (options: { scope: string; notes?: string }) => {
      const response = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create backup')
      }
      return response.json()
    },
    onSuccess: () => {
      refetchBackups()
      setSuccess('Backup created successfully!')
      setBackupDialog(false)
      setTimeout(() => setSuccess(null), 5000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to create backup')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Update schedule
  const updateScheduleMutation = useMutation({
    mutationFn: async (schedule: BackupSchedule) => {
      const response = await fetch('/api/backup-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      })
      if (!response.ok) throw new Error('Failed to update schedule')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      setSuccess('Backup schedule updated successfully!')
      setScheduleDialog(false)
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update schedule')
    },
  })

  // Export data
  const exportDataMutation = useMutation({
    mutationFn: async (options: { entities: string[] }) => {
      const response = await fetch('/api/exports/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entities: options.entities }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to export data')
      }
      return response.json()
    },
    onSuccess: (data) => {
      refetchExports()
      setSuccess(`Export completed! ${data.totalRows} rows exported across ${data.entities.length} entities.`)
      setExportDialog(false)
      setTimeout(() => setSuccess(null), 5000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to export data')
      setTimeout(() => setError(null), 5000)
    },
  })

  // Restore backup
  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      // In production, this would trigger a complex restore process
      // For now, we'll just show a warning that this is a dangerous operation
      if (!window.confirm('WARNING: Restoring a backup will replace all current data. This action cannot be undone. Are you sure you want to continue?')) {
        throw new Error('Restore cancelled by user')
      }
      
      const response = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId }),
      })
      
      if (!response.ok) throw new Error('Failed to initiate restore')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      setSuccess('Restore process started! This may take a few minutes.')
      setRestoreDialog(false)
      setTimeout(() => setSuccess(null), 5000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to restore backup')
    },
  })

  // Delete backup
  const deleteBackupMutation = useMutation({
    mutationFn: async (item: { id: string; type: string }) => {
      // Determine the correct endpoint based on item type
      let endpoint = `/api/backups/${item.id}`
      
      if (item.type === 'csv_export') {
        endpoint = `/api/exports/${item.id}`
      }
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete backup')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      queryClient.invalidateQueries({ queryKey: ['exports'] })
      setSuccess('Backup deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to delete backup')
    },
  })

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const getDataTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      campaigns: 'Campaigns',
      analytics: 'Analytics Data',
      team: 'Team Members',
      integrations: 'Integrations',
      settings: 'Settings',
    }
    return labels[type] || type
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
    <>
      {/* Backup Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backup & Export
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Create backups of your data and export information in various formats
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

          {/* Quick Actions */}
          <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
            <Button
              variant="contained"
              startIcon={<BackupIcon />}
              onClick={() => setBackupDialog(true)}
              disabled={createBackupMutation.isPending}
            >
              Create Backup
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudDownloadIcon />}
              onClick={() => setExportDialog(true)}
            >
              Export Data
            </Button>
            <Button
              variant="outlined"
              startIcon={<ScheduleIcon />}
              onClick={() => setScheduleDialog(true)}
            >
              Schedule Settings
            </Button>
          </Box>

          {/* Storage Usage */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Total Backups & Exports</Typography>
              <Typography variant="body2">
                {allBackupItems.length} items
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, (allBackupItems.length / 50) * 100)}
            />
          </Box>

          {/* Schedule Status */}
          {schedule?.enabled && (
            <Alert
              severity="info"
              icon={<ScheduleIcon />}
              action={
                <Button size="small" onClick={() => setScheduleDialog(true)}>
                  Configure
                </Button>
              }
            >
              Automatic backups are scheduled {schedule.frequency} at {schedule.time}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backup History
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Includes</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allBackupItems.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell>{formatDate(backup.createdAt)}</TableCell>
                    <TableCell>
                      <Chip
                        label={
                          backup.type === 'csv_export' ? 'CSV Export' : 
                          backup.type === 'database' ? 'Database' :
                          backup.type === 'full' ? 'Full Backup' :
                          backup.type
                        }
                        size="small"
                        variant="outlined"
                        color={backup.type === 'csv_export' ? 'secondary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{backup.size}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {backup.type === 'csv_export' ? 'All entities' : 
                         backup.type === 'database' ? 'Database' :
                         backup.type === 'full' ? 'Database + Files' :
                         backup.notes || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={backup.status === 'ready' ? 'Ready' : backup.status.charAt(0).toUpperCase() + backup.status.slice(1)}
                        color={
                          backup.status === 'ready' || backup.status === 'completed'
                            ? 'success'
                            : backup.status === 'running' || backup.status === 'pending'
                            ? 'warning'
                            : 'error'
                        }
                        size="small"
                        icon={
                          backup.status === 'ready' || backup.status === 'completed' ? (
                            <CheckCircleIcon />
                          ) : backup.status === 'failed' ? (
                            <ErrorIcon />
                          ) : undefined
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        {(backup.status === 'ready' || backup.status === 'completed') && (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => {
                                const downloadUrl = backup.type === 'csv_export' 
                                  ? `/api/exports/${backup.id}/download`
                                  : `/api/backups/${backup.id}/download`
                                window.open(downloadUrl, '_blank')
                              }}
                              title="Download"
                            >
                              <DownloadIcon />
                            </IconButton>
                            {backup.type !== 'csv_export' && (
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedBackup(backup)
                                  setRestoreDialog(true)
                                }}
                                title="Restore"
                              >
                                <RestoreIcon />
                              </IconButton>
                            )}
                          </>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this backup?')) {
                              deleteBackupMutation.mutate({ id: backup.id, type: backup.type })
                            }
                          }}
                          title="Delete"
                          disabled={deleteBackupMutation.isPending}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create Backup Dialog */}
      <Dialog open={backupDialog} onClose={() => setBackupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Manual Backup</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Select the scope of your backup:
            </Typography>
            <RadioGroup
              value={backupScope}
              onChange={(e) => setBackupScope(e.target.value)}
              sx={{ my: 2 }}
            >
              <FormControlLabel
                value="db"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">Database Only</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Backup all organization data from the database
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="db+files"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">Database + Files</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Include uploaded files and media assets
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
            <TextField
              label="Notes (optional)"
              fullWidth
              multiline
              rows={2}
              placeholder="Add any notes about this backup..."
              sx={{ mb: 2 }}
            />
            <Alert severity="info">
              Backups are compressed and stored securely. The backup will include all data from your organization's schema.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const notes = (document.querySelector('textarea[placeholder*="notes"]') as HTMLTextAreaElement)?.value
              createBackupMutation.mutate({ scope: backupScope, notes })
            }}
            disabled={createBackupMutation.isPending}
            startIcon={<BackupIcon />}
          >
            {createBackupMutation.isPending ? 'Creating...' : 'Start Backup'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Settings Dialog */}
      <Dialog
        open={scheduleDialog}
        onClose={() => setScheduleDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Backup Schedule Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={scheduleForm.enabled}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, enabled: e.target.checked })
                  }
                />
              }
              label="Enable automatic backups"
            />

            {scheduleForm.enabled && (
              <>
                <TextField
                  label="Frequency"
                  select
                  fullWidth
                  value={scheduleForm.frequency}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      frequency: e.target.value as BackupSchedule['frequency'],
                    })
                  }
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </TextField>

                {scheduleForm.frequency === 'weekly' && (
                  <TextField
                    label="Day of Week"
                    select
                    fullWidth
                    value={scheduleForm.dayOfWeek}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, dayOfWeek: Number(e.target.value) })
                    }
                  >
                    <MenuItem value={0}>Sunday</MenuItem>
                    <MenuItem value={1}>Monday</MenuItem>
                    <MenuItem value={2}>Tuesday</MenuItem>
                    <MenuItem value={3}>Wednesday</MenuItem>
                    <MenuItem value={4}>Thursday</MenuItem>
                    <MenuItem value={5}>Friday</MenuItem>
                    <MenuItem value={6}>Saturday</MenuItem>
                  </TextField>
                )}

                {scheduleForm.frequency === 'monthly' && (
                  <TextField
                    label="Day of Month"
                    type="number"
                    fullWidth
                    value={scheduleForm.dayOfMonth}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, dayOfMonth: Number(e.target.value) })
                    }
                    inputProps={{ min: 1, max: 28 }}
                  />
                )}

                <TextField
                  label="Time"
                  type="time"
                  fullWidth
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />

                <TextField
                  label="Retention Period (days)"
                  type="number"
                  fullWidth
                  value={scheduleForm.retention}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, retention: Number(e.target.value) })
                  }
                  helperText="How long to keep automatic backups"
                  inputProps={{ min: 7, max: 365 }}
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => updateScheduleMutation.mutate(scheduleForm)}
            disabled={updateScheduleMutation.isPending}
          >
            Save Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Data Dialog */}
      <Dialog open={exportDialog} onClose={() => setExportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Data as CSV</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="textSecondary">
              Select the entities to include in your CSV export. Each entity will be exported as a separate CSV file within a ZIP archive.
            </Typography>
            
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2">Select entities to export:</Typography>
                <Box>
                  <Button
                    size="small"
                    onClick={() => setExportEntities(prev => prev.map(e => ({ ...e, selected: true })))}
                  >
                    Select All
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setExportEntities(prev => prev.map(e => ({ ...e, selected: false })))}
                  >
                    Clear All
                  </Button>
                </Box>
              </Box>
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {exportEntities.map((entity) => (
                  <ListItem key={entity.name} disablePadding>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={entity.selected}
                          onChange={(e) =>
                            setExportEntities(prev => 
                              prev.map(ent => 
                                ent.name === entity.name 
                                  ? { ...ent, selected: e.target.checked }
                                  : ent
                              )
                            )
                          }
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">{entity.label}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {entity.description}
                          </Typography>
                        </Box>
                      }
                      sx={{ width: '100%', m: 0 }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Alert severity="info" icon={<FolderZipIcon />}>
              Your data will be exported as a ZIP file containing CSV files for each selected entity.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const selectedEntities = exportEntities
                .filter(e => e.selected)
                .map(e => e.name)
              exportDataMutation.mutate({ entities: selectedEntities })
            }}
            disabled={
              exportDataMutation.isPending ||
              !exportEntities.some(e => e.selected)
            }
            startIcon={<CloudDownloadIcon />}
          >
            {exportDataMutation.isPending ? 'Exporting...' : 'Export Data'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Backup Dialog */}
      <Dialog
        open={restoreDialog}
        onClose={() => setRestoreDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Restore Backup</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Warning: Restoring a backup will replace your current data
              </Typography>
              <Typography variant="body2">
                This action cannot be undone. All current data will be overwritten with the backup
                from {selectedBackup && formatDate(selectedBackup.createdAt)}.
              </Typography>
            </Alert>

            {selectedBackup && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  This backup includes:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                  <Chip
                    label={selectedBackup.type === 'database' ? 'Database' : 'Database + Files'}
                    size="small"
                    icon={<CheckCircleIcon />}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => selectedBackup && restoreBackupMutation.mutate(selectedBackup.id)}
            disabled={restoreBackupMutation.isPending}
            startIcon={<RestoreIcon />}
          >
            Restore Backup
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}