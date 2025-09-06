import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  Tooltip,
  CircularProgress,
  InputAdornment,
  Collapse,
  Stack,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Key as KeyIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'

interface ApiKey {
  id: string
  name: string
  scopes: string[]
  lastUsedAt: string | null
  createdAt: string
  createdBy: string
  expiresAt: string | null
  revoked: boolean
  description?: string
  status: 'active' | 'expired' | 'revoked'
  isExpired: boolean
}

interface ApiKeySettings {
  enabled: boolean
  maxKeysPerUser: number
  requireExpiry: boolean
  defaultExpiryDays: number
  allowedScopes: string[]
}

const AVAILABLE_SCOPES = [
  { value: 'read:campaigns', label: 'Read Campaigns', description: 'View campaign data' },
  { value: 'write:campaigns', label: 'Write Campaigns', description: 'Create and update campaigns' },
  { value: 'read:shows', label: 'Read Shows', description: 'View show data' },
  { value: 'write:shows', label: 'Write Shows', description: 'Create and update shows' },
  { value: 'read:analytics', label: 'Read Analytics', description: 'View analytics data' },
  { value: 'read:reports', label: 'Read Reports', description: 'View and download reports' },
  { value: 'write:reports', label: 'Write Reports', description: 'Create custom reports' },
  { value: 'admin:all', label: 'Admin (Full Access)', description: 'Complete API access' },
]

export default function ApiKeyManagement() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [settings, setSettings] = useState<ApiKeySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null)
  const [newKeyDialog, setNewKeyDialog] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  // New key form state
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    description: '',
    scopes: [] as string[],
    expiresIn: 90,
  })

  // Fetch API keys
  const fetchApiKeys = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/security/api-keys')
      if (!response.ok) throw new Error('Failed to fetch API keys')
      const data = await response.json()
      setKeys(data.keys || [])
      setSettings(data.settings || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApiKeys()
  }, [])

  // Create new API key
  const handleCreateKey = async () => {
    try {
      setError(null)
      const response = await fetch('/api/settings/security/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyForm.name,
          description: newKeyForm.description,
          scopes: newKeyForm.scopes,
          expiresIn: settings?.requireExpiry ? newKeyForm.expiresIn : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create API key')
      }

      const data = await response.json()
      setNewKey(data.key)
      setNewKeyDialog(true)
      setCreateDialogOpen(false)
      
      // Reset form
      setNewKeyForm({
        name: '',
        description: '',
        scopes: [],
        expiresIn: settings?.defaultExpiryDays || 90,
      })
      
      // Refresh keys list
      await fetchApiKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key')
    }
  }

  // Delete/Revoke API key
  const handleDeleteKey = async () => {
    if (!keyToDelete) return

    try {
      setError(null)
      const response = await fetch(`/api/settings/security/api-keys/${keyToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to revoke API key')
      }

      setDeleteDialogOpen(false)
      setKeyToDelete(null)
      
      // Refresh keys list
      await fetchApiKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key')
    }
  }

  // Copy key to clipboard
  const handleCopyKey = async () => {
    if (!newKey) return
    
    try {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Toggle row expansion
  const toggleRowExpansion = (keyId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(keyId)) {
      newExpanded.delete(keyId)
    } else {
      newExpanded.add(keyId)
    }
    setExpandedRows(newExpanded)
  }

  // Get status chip
  const getStatusChip = (key: ApiKey) => {
    if (key.status === 'revoked') {
      return <Chip label="Revoked" color="error" size="small" icon={<CancelIcon />} />
    }
    if (key.status === 'expired') {
      return <Chip label="Expired" color="warning" size="small" icon={<ScheduleIcon />} />
    }
    return <Chip label="Active" color="success" size="small" icon={<CheckCircleIcon />} />
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    )
  }

  if (!settings?.enabled) {
    return (
      <Alert severity="info">
        API keys are not enabled for this organization. Enable them in the security settings to start using API keys.
      </Alert>
    )
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">API Keys</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create API Key
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={40}></TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Scopes</TableCell>
              <TableCell>Last Used</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" py={4}>
                    No API keys created yet
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => (
                <React.Fragment key={key.id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => toggleRowExpansion(key.id)}
                      >
                        {expandedRows.has(key.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <KeyIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight={500}>
                          {key.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{getStatusChip(key)}</TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {key.scopes.slice(0, 2).map(scope => (
                          <Chip key={scope} label={scope} size="small" variant="outlined" />
                        ))}
                        {key.scopes.length > 2 && (
                          <Chip label={`+${key.scopes.length - 2}`} size="small" variant="outlined" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {key.lastUsedAt ? (
                        <Tooltip title={new Date(key.lastUsedAt).toLocaleString()}>
                          <Typography variant="body2">
                            {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Never</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={`Created by ${key.createdBy}`}>
                        <Typography variant="body2">
                          {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={key.status !== 'active' ? 'Already revoked/expired' : 'Revoke key'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={key.status !== 'active'}
                            onClick={() => {
                              setKeyToDelete(key)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0 }}>
                      <Collapse in={expandedRows.has(key.id)} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                          <Stack spacing={2}>
                            {key.description && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Description</Typography>
                                <Typography variant="body2">{key.description}</Typography>
                              </Box>
                            )}
                            <Box>
                              <Typography variant="caption" color="text.secondary">All Scopes</Typography>
                              <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
                                {key.scopes.map(scope => (
                                  <Chip key={scope} label={scope} size="small" />
                                ))}
                              </Box>
                            </Box>
                            {key.expiresAt && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Expires</Typography>
                                <Typography variant="body2">
                                  {new Date(key.expiresAt).toLocaleString()}
                                </Typography>
                              </Box>
                            )}
                            <Box>
                              <Typography variant="caption" color="text.secondary">Key ID</Typography>
                              <Typography variant="body2" fontFamily="monospace">{key.id}</Typography>
                            </Box>
                          </Stack>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create API Key Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Key Name"
              fullWidth
              required
              value={newKeyForm.name}
              onChange={(e) => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
              helperText="A descriptive name for this API key"
            />
            
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={newKeyForm.description}
              onChange={(e) => setNewKeyForm({ ...newKeyForm, description: e.target.value })}
              helperText="Optional description of what this key will be used for"
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Scopes (Permissions)
              </Typography>
              <FormGroup>
                {AVAILABLE_SCOPES.map(scope => (
                  <FormControlLabel
                    key={scope.value}
                    control={
                      <Checkbox
                        checked={newKeyForm.scopes.includes(scope.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyForm({
                              ...newKeyForm,
                              scopes: [...newKeyForm.scopes, scope.value]
                            })
                          } else {
                            setNewKeyForm({
                              ...newKeyForm,
                              scopes: newKeyForm.scopes.filter(s => s !== scope.value)
                            })
                          }
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">{scope.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {scope.description}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
            </Box>

            {settings?.requireExpiry && (
              <TextField
                label="Expires In (Days)"
                type="number"
                fullWidth
                value={newKeyForm.expiresIn}
                onChange={(e) => setNewKeyForm({ ...newKeyForm, expiresIn: parseInt(e.target.value) })}
                InputProps={{
                  inputProps: { min: 1, max: 365 }
                }}
                helperText="Key will expire after this many days"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateKey}
            disabled={!newKeyForm.name || newKeyForm.scopes.length === 0}
          >
            Create Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Key Display Dialog */}
      <Dialog open={newKeyDialog} maxWidth="sm" fullWidth>
        <DialogTitle>API Key Created Successfully</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This is the only time you'll see this key. Please copy and save it securely.
          </Alert>
          <TextField
            fullWidth
            value={newKey || ''}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopyKey}>
                    <CopyIcon />
                  </IconButton>
                </InputAdornment>
              ),
              sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
            }}
          />
          {copied && (
            <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
              Copied to clipboard!
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            variant="contained" 
            onClick={() => {
              setNewKeyDialog(false)
              setNewKey(null)
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Revoke API Key</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to revoke the API key "{keyToDelete?.name}"? 
            This action cannot be undone and any applications using this key will stop working.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteKey}>
            Revoke Key
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}