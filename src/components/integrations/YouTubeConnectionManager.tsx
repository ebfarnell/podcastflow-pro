'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Divider,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip
} from '@mui/material'
import { YouTube as YouTubeIcon, Link as LinkIcon } from '@mui/icons-material'
import { api } from '@/lib/api'

interface YouTubeConnection {
  id: string
  connectionName: string
  accountEmail?: string
  channelId?: string
  channelTitle?: string
  isPrimary: boolean
}

interface Show {
  id: string
  name: string
  youtubeConnections?: {
    connectionId: string
    connectionName: string
  }[]
}

interface YouTubeConnectionManagerProps {
  open: boolean
  onClose: () => void
  onUpdate?: () => void
}

export function YouTubeConnectionManager({ open, onClose, onUpdate }: YouTubeConnectionManagerProps) {
  const [tabValue, setTabValue] = useState(0)
  const [connections, setConnections] = useState<YouTubeConnection[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // For bulk assignment
  const [selectedShows, setSelectedShows] = useState<string[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string>('')

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load connections and shows in parallel
      const [connectionsRes, showsRes] = await Promise.all([
        api.get('/youtube/connections'),
        api.get('/shows')
      ])

      setConnections(connectionsRes.data?.connections || [])
      setShows(showsRes.data?.shows || [])
    } catch (error: any) {
      console.error('Error loading data:', error)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkAssign = async () => {
    if (!selectedConnection || selectedShows.length === 0) {
      setError('Please select shows and a connection')
      return
    }

    try {
      setSaving(true)
      setError(null)

      // Call API to assign shows to connection
      await api.post('/youtube/connections/assign', {
        connectionId: selectedConnection,
        showIds: selectedShows
      })

      setSuccess(`Successfully linked ${selectedShows.length} show(s) to the connection`)
      setSelectedShows([])
      setSelectedConnection('')
      
      // Reload data
      await loadData()
      
      if (onUpdate) {
        onUpdate()
      }
    } catch (error: any) {
      console.error('Error assigning shows:', error)
      setError(error.response?.data?.error || 'Failed to assign shows')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleShow = (showId: string) => {
    setSelectedShows(prev =>
      prev.includes(showId)
        ? prev.filter(id => id !== showId)
        : [...prev, showId]
    )
  }

  const handleSelectAll = () => {
    if (selectedShows.length === shows.length) {
      setSelectedShows([])
    } else {
      setSelectedShows(shows.map(s => s.id))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon />
          Manage YouTube Show Connections
        </Box>
      </DialogTitle>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Bulk Assignment" />
          <Tab label="Show Overview" />
        </Tabs>
      </Box>

      <DialogContent sx={{ minHeight: 400 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
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

            {tabValue === 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Select shows and assign them to a YouTube connection for syncing
                </Typography>

                {connections.length === 0 ? (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No YouTube connections available. Please add a connection first.
                  </Alert>
                ) : (
                  <>
                    <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
                      <InputLabel>YouTube Connection</InputLabel>
                      <Select
                        value={selectedConnection}
                        onChange={(e) => setSelectedConnection(e.target.value)}
                        label="YouTube Connection"
                      >
                        {connections.map(conn => (
                          <MenuItem key={conn.id} value={conn.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <YouTubeIcon sx={{ fontSize: 20 }} />
                              {conn.connectionName}
                              {conn.isPrimary && (
                                <Chip label="Primary" size="small" color="primary" />
                              )}
                              {conn.accountEmail && (
                                <Typography variant="caption" color="text.secondary">
                                  ({conn.accountEmail})
                                </Typography>
                              )}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2">
                        Select Shows ({selectedShows.length} selected)
                      </Typography>
                      <Button size="small" onClick={handleSelectAll}>
                        {selectedShows.length === shows.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    </Box>

                    <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                      {shows.map(show => (
                        <ListItem
                          key={show.id}
                          button
                          onClick={() => handleToggleShow(show.id)}
                          sx={{ 
                            border: 1, 
                            borderColor: 'divider', 
                            borderRadius: 1, 
                            mb: 0.5,
                            bgcolor: selectedShows.includes(show.id) ? 'action.selected' : 'background.paper'
                          }}
                        >
                          <ListItemIcon>
                            <Checkbox
                              checked={selectedShows.includes(show.id)}
                              tabIndex={-1}
                              disableRipple
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={show.name}
                            secondary={
                              show.youtubeConnections && show.youtubeConnections.length > 0
                                ? `Connected to: ${show.youtubeConnections.map(c => c.connectionName).join(', ')}`
                                : 'Not connected'
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </Box>
            )}

            {tabValue === 1 && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Overview of which shows are connected to which YouTube accounts
                </Typography>

                <List sx={{ mt: 2 }}>
                  {shows.map(show => (
                    <ListItem key={show.id} sx={{ px: 0 }}>
                      <ListItemText
                        primary={show.name}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            {show.youtubeConnections && show.youtubeConnections.length > 0 ? (
                              show.youtubeConnections.map(conn => (
                                <Chip
                                  key={conn.connectionId}
                                  label={conn.connectionName}
                                  size="small"
                                  icon={<YouTubeIcon />}
                                  color="primary"
                                  variant="outlined"
                                />
                              ))
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No YouTube connection
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {tabValue === 0 && connections.length > 0 && (
          <Button
            onClick={handleBulkAssign}
            variant="contained"
            disabled={saving || selectedShows.length === 0 || !selectedConnection}
          >
            {saving ? 'Assigning...' : `Assign ${selectedShows.length} Show(s)`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}