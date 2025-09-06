import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material'
import {
  MoreVert as MoreVertIcon,
  Sync as SyncIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { useState } from 'react'
import { ViewLogsDialog } from './ViewLogsDialog'

interface Integration {
  id: string
  name: string
  platform: string
  description: string
  status: 'connected' | 'disconnected' | 'error'
  tier: 'critical' | 'important' | 'optional'
  category: string
  lastSync?: string
  syncFrequency?: string
  logo: string | React.ReactNode
}

interface IntegrationCardProps {
  integration: Integration
  onConnect: () => void
  onDisconnect: () => void
  onSettings: () => void
  onSync?: () => Promise<void>
}

export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onSettings,
  onSync,
}: IntegrationCardProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [syncing, setSyncing] = useState(false)
  const [logsDialogOpen, setLogsDialogOpen] = useState(false)

  const getStatusIcon = () => {
    switch (integration.status) {
      case 'connected':
        return <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
      case 'error':
        return <ErrorIcon color="error" sx={{ fontSize: 20 }} />
      default:
        return <WarningIcon color="warning" sx={{ fontSize: 20 }} />
    }
  }

  const getTierColor = () => {
    switch (integration.tier) {
      case 'critical':
        return 'error'
      case 'important':
        return 'warning'
      default:
        return 'info'
    }
  }

  const handleSync = async () => {
    if (!onSync) return
    
    setSyncing(true)
    try {
      await onSync()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {typeof integration.logo === 'string' ? (
              <Typography variant="h2" sx={{ fontSize: 40 }}>
                {integration.logo}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {integration.logo}
              </Box>
            )}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">{integration.name}</Typography>
                {getStatusIcon()}
              </Box>
              <Typography variant="caption" color="textSecondary">
                {integration.category}
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchorEl(e.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>

        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {integration.description}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Chip
            label={integration.tier}
            size="small"
            color={getTierColor()}
            variant="outlined"
          />
          {integration.syncFrequency && (
            <Chip
              label={integration.syncFrequency}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {integration.lastSync && (
          <Typography variant="caption" color="textSecondary">
            Last synced: {new Date(integration.lastSync).toLocaleString()}
          </Typography>
        )}
      </CardContent>

      <Box sx={{ p: 2, pt: 0 }}>
        {integration.status === 'connected' ? (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={handleSync}
              disabled={syncing}
              fullWidth
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            <IconButton size="small" onClick={onSettings}>
              <SettingsIcon />
            </IconButton>
          </Box>
        ) : (
          <Button
            variant="contained"
            size="small"
            fullWidth
            onClick={onConnect}
          >
            Connect
          </Button>
        )}
      </Box>

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setMenuAnchorEl(null)
          onSettings()
        }}>
          Settings
        </MenuItem>
        <MenuItem onClick={() => {
          setMenuAnchorEl(null)
          setLogsDialogOpen(true)
        }}>
          View Logs
        </MenuItem>
        {integration.platform === 'youtube' && (
          <MenuItem onClick={() => {
            setMenuAnchorEl(null)
            if (typeof window !== 'undefined' && window.openYouTubeConnectionManager) {
              window.openYouTubeConnectionManager()
            }
          }}>
            Manage Connections
          </MenuItem>
        )}
        {integration.status === 'connected' && (
          <MenuItem onClick={() => {
            setMenuAnchorEl(null)
            onDisconnect()
          }} sx={{ color: 'error.main' }}>
            Disconnect
          </MenuItem>
        )}
      </Menu>

      {/* View Logs Dialog */}
      <ViewLogsDialog
        open={logsDialogOpen}
        onClose={() => setLogsDialogOpen(false)}
        platform={integration.platform}
        title={`${integration.name} Sync Logs`}
      />
    </Card>
  )
}