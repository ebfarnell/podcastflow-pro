'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Card,
  Grid,
  Typography,
  Button,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Switch,
  Badge,
} from '@mui/material'
import {
  Search as SearchIcon,
  Sync as SyncIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  YouTube as YouTubeIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'
import { IntegrationSetupDialog } from '@/components/integrations/IntegrationSetupDialog'
import { YouTubeConnectionManager } from '@/components/integrations/YouTubeConnectionManager'
import { integrationApi } from '@/services/api'
import { Snackbar, Alert } from '@mui/material'
import { QuickBooksIcon, MegaphoneIcon } from '@/components/icons/BrandIcons'

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

const integrations: Integration[] = [
  // Fully Implemented Integrations Only
  {
    id: '1',
    name: 'QuickBooks',
    platform: 'quickbooks',
    description: 'Accounting and financial management with full bidirectional sync',
    status: 'disconnected',
    tier: 'critical',
    category: 'Accounting',
    lastSync: undefined,
    syncFrequency: 'Daily',
    logo: <QuickBooksIcon sx={{ fontSize: 40 }} />,
  },
  {
    id: '2',
    name: 'Megaphone',
    platform: 'megaphone',
    description: 'Podcast hosting and analytics platform integration',
    status: 'disconnected',
    tier: 'critical',
    category: 'Podcast Hosting',
    lastSync: undefined,
    syncFrequency: 'Hourly',
    logo: <MegaphoneIcon sx={{ fontSize: 40 }} />,
  },
  {
    id: '3',
    name: 'YouTube',
    platform: 'youtube',
    description: 'Video analytics and channel management with OAuth authentication',
    status: 'disconnected',
    tier: 'important',
    category: 'Video Platform',
    lastSync: undefined,
    syncFrequency: 'Daily',
    logo: <YouTubeIcon sx={{ fontSize: 40, color: '#FF0000' }} />,
  },
]

export default function IntegrationsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [setupDialogOpen, setSetupDialogOpen] = useState(false)
  const [youtubeConnectionsOpen, setYoutubeConnectionsOpen] = useState(false)
  const [notification, setNotification] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'success' })
  const [loading, setLoading] = useState(false)
  const [integrationsList, setIntegrationsList] = useState<Integration[]>(integrations)

  // Fetch real integration status
  useEffect(() => {
    const fetchIntegrationStatus = async () => {
      try {
        const response = await fetch('/api/integrations/status')
        if (response.ok) {
          const data = await response.json()
          
          // Update integrations list with real status
          setIntegrationsList(prev => prev.map(integration => {
            switch (integration.platform) {
              case 'quickbooks':
                return {
                  ...integration,
                  status: data.integrations.quickbooks?.connected ? 'connected' : 'disconnected',
                  lastSync: data.integrations.quickbooks?.lastSync
                }
              case 'megaphone':
                return {
                  ...integration,
                  status: data.integrations.megaphone?.connected ? 'connected' : 'disconnected',
                  lastSync: data.integrations.megaphone?.lastSync
                }
              case 'youtube':
                return {
                  ...integration,
                  status: data.integrations.youtube?.connected ? 'connected' : 'disconnected',
                  lastSync: data.integrations.youtube?.lastSync,
                  syncFrequency: data.integrations.youtube?.syncFrequency || integration.syncFrequency,
                  description: data.integrations.youtube?.connectedChannels > 0 
                    ? `Video analytics and channel management with OAuth authentication (${data.integrations.youtube.connectedChannels} channels connected)`
                    : 'Video analytics and channel management with OAuth authentication'
                }
              default:
                return integration
            }
          }))
        }
      } catch (error) {
        console.error('Failed to fetch integration status:', error)
        // Continue with hardcoded integrations on error
      }
    }

    fetchIntegrationStatus()
    // Don't refresh automatically to reduce API calls
  }, [])

  // Set up global function for opening YouTube connection manager
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).openYouTubeConnectionManager = () => {
        setYoutubeConnectionsOpen(true)
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).openYouTubeConnectionManager
      }
    }
  }, [])

  const filterIntegrations = () => {
    let filtered = integrationsList

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (int) =>
          int.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          int.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by tab
    switch (activeTab) {
      case 1: // Connected
        return filtered.filter((int) => int.status === 'connected')
      case 2: // Available
        return filtered.filter((int) => int.status === 'disconnected')
      default: // All
        return filtered
    }
  }

  const getStatusCount = (status: string) => {
    return integrationsList.filter((int) => int.status === status).length
  }

  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration)
    setSetupDialogOpen(true)
  }

  const handleSyncAll = async () => {
    setLoading(true)
    try {
      const connectedIntegrations = integrationsList.filter(i => i.status === 'connected')
      const results = await Promise.allSettled(
        connectedIntegrations.map(integration => 
          integrationApi.sync(integration.platform)
        )
      )
      
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      
      if (failed === 0) {
        setNotification({
          open: true,
          message: `Successfully synced ${successful} integrations`,
          severity: 'success'
        })
      } else {
        setNotification({
          open: true,
          message: `Synced ${successful} integrations, ${failed} failed`,
          severity: 'info'
        })
      }
    } catch (error) {
      setNotification({
        open: true,
        message: 'Failed to sync integrations',
        severity: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async (integration: Integration) => {
    try {
      await integrationApi.disconnect(integration.platform)
      setNotification({
        open: true,
        message: `${integration.name} disconnected successfully`,
        severity: 'success'
      })
      // Update integration status locally
      // In a real app, you'd refetch the data
    } catch (error) {
      setNotification({
        open: true,
        message: `Failed to disconnect ${integration.name}`,
        severity: 'error'
      })
    }
  }

  const handleSettings = (integration: Integration) => {
    // Special handling for YouTube - open dedicated management page
    if (integration.platform === 'youtube') {
      router.push('/integrations/youtube')
    } else {
      // For other integrations, show notification
      setNotification({
        open: true,
        message: `Opening settings for ${integration.name}`,
        severity: 'info'
      })
    }
  }

  const handleSync = async (integration: Integration) => {
    try {
      await integrationApi.sync(integration.platform)
      setNotification({
        open: true,
        message: `${integration.name} synced successfully`,
        severity: 'success'
      })
    } catch (error) {
      setNotification({
        open: true,
        message: `Failed to sync ${integration.name}`,
        severity: 'error'
      })
    }
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Integrations
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={handleSyncAll}
              disabled={loading}
            >
              {loading ? 'Syncing...' : 'Sync All'}
            </Button>
          </Box>
        </Box>

        {/* Status Overview */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <CheckCircleIcon color="success" />
              <Box>
                <Typography variant="h6">{getStatusCount('connected')}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Connected
                </Typography>
              </Box>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <WarningIcon color="warning" />
              <Box>
                <Typography variant="h6">{getStatusCount('disconnected')}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Available
                </Typography>
              </Box>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <ErrorIcon color="error" />
              <Box>
                <Typography variant="h6">{getStatusCount('error')}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Need Attention
                </Typography>
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Search and Filters */}
        <Card sx={{ mb: 3 }}>
          <Box sx={{ p: 2 }}>
            <TextField
              placeholder="Search integrations..."
              variant="outlined"
              size="small"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="All Integrations" />
            <Tab
              label={
                <Badge badgeContent={getStatusCount('connected')} color="success">
                  Connected
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={getStatusCount('disconnected')} color="warning">
                  Available
                </Badge>
              }
            />
          </Tabs>
        </Card>

        {/* Integrations Grid */}
        <Grid container spacing={3}>
          {filterIntegrations().map((integration) => (
            <Grid item xs={12} md={6} lg={4} key={integration.id}>
              <IntegrationCard
                integration={integration}
                onConnect={() => handleConnect(integration)}
                onDisconnect={() => handleDisconnect(integration)}
                onSettings={() => handleSettings(integration)}
                onSync={() => handleSync(integration)}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Setup Dialog */}
      <IntegrationSetupDialog
        open={setupDialogOpen}
        onClose={() => setSetupDialogOpen(false)}
        integration={selectedIntegration}
      />

      {/* YouTube Connection Manager */}
      <YouTubeConnectionManager
        open={youtubeConnectionsOpen}
        onClose={() => setYoutubeConnectionsOpen(false)}
        onUpdate={() => {
          // Refresh integration status
          window.location.reload()
        }}
      />

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  )
}