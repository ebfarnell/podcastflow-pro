'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Chip,
  Grid
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Storage as DatabaseIcon,
  Analytics as AnalyticsIcon,
  AttachMoney as RevenueIcon,
  Sync as SyncIcon,
  Shield as SecurityIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

interface MegaphoneSetupData {
  apiKey: string
  apiSecret: string
  networkId?: string
  webhookUrl?: string
  syncFrequency: 'hourly' | 'daily' | 'weekly'
  enableAnalytics: boolean
  enableRevenue: boolean
}

interface IntegrationHealth {
  status: 'healthy' | 'warning' | 'error'
  tablesCreated: boolean
  lastSync: string | null
  syncErrors: number
  message: string
}

interface IntegrationStatus {
  organization: {
    id: string
    name: string
    slug: string
  }
  integration?: {
    id: string
    status: string
    syncFrequency: string
    enableAnalytics: boolean
    enableRevenue: boolean
    lastSyncAt: string | null
    createdAt: string
    networkId?: string
    webhookUrl?: string
  }
  health: IntegrationHealth
  isConfigured: boolean
  schemaName: string
}

export function MegaphoneIntegrationSetup() {
  const queryClient = useQueryClient()
  const [activeStep, setActiveStep] = useState(0)
  const [setupData, setSetupData] = useState<MegaphoneSetupData>({
    apiKey: '',
    apiSecret: '',
    networkId: '',
    webhookUrl: '',
    syncFrequency: 'daily',
    enableAnalytics: true,
    enableRevenue: true
  })

  // Fetch current integration status
  const { data: status, isLoading: statusLoading, error: statusError } = useQuery<IntegrationStatus>({
    queryKey: ['megaphone-integration-status'],
    queryFn: async () => {
      const response = await fetch('/api/integrations/megaphone/setup')
      if (!response.ok) {
        throw new Error('Failed to fetch integration status')
      }
      return response.json()
    }
  })

  // Setup integration mutation
  const setupMutation = useMutation({
    mutationFn: async (data: MegaphoneSetupData) => {
      const response = await fetch('/api/integrations/megaphone/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Setup failed')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['megaphone-integration-status'] })
      setActiveStep(3) // Move to success step
    }
  })

  // Remove integration mutation
  const removeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/integrations/megaphone/setup', {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Removal failed')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['megaphone-integration-status'] })
      setActiveStep(0) // Reset to first step
      setSetupData({
        apiKey: '',
        apiSecret: '',
        networkId: '',
        webhookUrl: '',
        syncFrequency: 'daily',
        enableAnalytics: true,
        enableRevenue: true
      })
    }
  })

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1)
  }

  const handleSetup = async () => {
    await setupMutation.mutateAsync(setupData)
  }

  const handleRemove = async () => {
    if (window.confirm('Are you sure you want to remove the Megaphone integration? This will delete all synced data.')) {
      await removeMutation.mutateAsync()
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckIcon color="success" />
      case 'warning':
        return <WarningIcon color="warning" />
      case 'error':
        return <ErrorIcon color="error" />
      default:
        return <ErrorIcon color="disabled" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success'
      case 'warning':
        return 'warning'
      case 'error':
        return 'error'
      default:
        return 'default'
    }
  }

  if (statusLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (statusError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load integration status: {statusError.message}
      </Alert>
    )
  }

  // If integration is already configured, show status dashboard
  if (status?.isConfigured) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">
            Megaphone Integration Status
          </Typography>
          <Chip
            label={status.health.status}
            color={getStatusColor(status.health.status) as any}
            icon={getStatusIcon(status.health.status)}
          />
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Integration Details
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon><DatabaseIcon /></ListItemIcon>
                    <ListItemText
                      primary="Organization Schema"
                      secondary={status.schemaName}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><SyncIcon /></ListItemIcon>
                    <ListItemText
                      primary="Sync Frequency"
                      secondary={status.integration?.syncFrequency}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><AnalyticsIcon /></ListItemIcon>
                    <ListItemText
                      primary="Analytics Enabled"
                      secondary={status.integration?.enableAnalytics ? 'Yes' : 'No'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><RevenueIcon /></ListItemIcon>
                    <ListItemText
                      primary="Revenue Tracking"
                      secondary={status.integration?.enableRevenue ? 'Yes' : 'No'}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Health Status
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      {status.health.tablesCreated ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                    </ListItemIcon>
                    <ListItemText
                      primary="Database Tables"
                      secondary={status.health.tablesCreated ? 'All tables created' : 'Missing tables'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><SyncIcon /></ListItemIcon>
                    <ListItemText
                      primary="Last Sync"
                      secondary={status.health.lastSync ? new Date(status.health.lastSync).toLocaleString() : 'Never'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><SecurityIcon /></ListItemIcon>
                    <ListItemText
                      primary="Status"
                      secondary={status.health.message}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['megaphone-integration-status'] })}
          >
            Refresh Status
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleRemove}
            disabled={removeMutation.isPending}
          >
            {removeMutation.isPending ? 'Removing...' : 'Remove Integration'}
          </Button>
        </Box>

        {(setupMutation.error || removeMutation.error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(setupMutation.error as Error)?.message || (removeMutation.error as Error)?.message}
          </Alert>
        )}
      </Paper>
    )
  }

  // Setup wizard for new integration
  const steps = [
    'API Configuration',
    'Sync Settings',
    'Feature Selection',
    'Complete Setup'
  ]

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Set Up Megaphone Integration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Connect your organization to Megaphone for automated podcast analytics and revenue tracking.
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel>API Configuration</StepLabel>
          <StepContent>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="API Key"
                type="password"
                value={setupData.apiKey}
                onChange={(e) => setSetupData({ ...setupData, apiKey: e.target.value })}
                margin="normal"
                required
                helperText="Your Megaphone API key"
              />
              <TextField
                fullWidth
                label="API Secret"
                type="password"
                value={setupData.apiSecret}
                onChange={(e) => setSetupData({ ...setupData, apiSecret: e.target.value })}
                margin="normal"
                required
                helperText="Your Megaphone API secret"
              />
              <TextField
                fullWidth
                label="Network ID (Optional)"
                value={setupData.networkId}
                onChange={(e) => setSetupData({ ...setupData, networkId: e.target.value })}
                margin="normal"
                helperText="Megaphone Network ID if applicable"
              />
            </Box>
            <Box sx={{ mb: 1 }}>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!setupData.apiKey || !setupData.apiSecret}
              >
                Continue
              </Button>
            </Box>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Sync Settings</StepLabel>
          <StepContent>
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Sync Frequency</InputLabel>
                <Select
                  value={setupData.syncFrequency}
                  onChange={(e) => setSetupData({ ...setupData, syncFrequency: e.target.value as any })}
                  label="Sync Frequency"
                >
                  <MenuItem value="hourly">Hourly</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Webhook URL (Optional)"
                value={setupData.webhookUrl}
                onChange={(e) => setSetupData({ ...setupData, webhookUrl: e.target.value })}
                margin="normal"
                helperText="URL to receive real-time updates from Megaphone"
              />
            </Box>
            <Box sx={{ mb: 1 }}>
              <Button variant="contained" onClick={handleNext} sx={{ mt: 1, mr: 1 }}>
                Continue
              </Button>
              <Button onClick={handleBack} sx={{ mt: 1, mr: 1 }}>
                Back
              </Button>
            </Box>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Feature Selection</StepLabel>
          <StepContent>
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={setupData.enableAnalytics}
                    onChange={(e) => setSetupData({ ...setupData, enableAnalytics: e.target.checked })}
                  />
                }
                label="Enable Analytics Tracking"
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                Sync download, listener, and engagement analytics from Megaphone
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={setupData.enableRevenue}
                    onChange={(e) => setSetupData({ ...setupData, enableRevenue: e.target.checked })}
                  />
                }
                label="Enable Revenue Tracking"
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                Track ad revenue, CPM rates, and campaign performance
              </Typography>
            </Box>
            <Box sx={{ mb: 1 }}>
              <Button variant="contained" onClick={handleNext} sx={{ mt: 1, mr: 1 }}>
                Continue
              </Button>
              <Button onClick={handleBack} sx={{ mt: 1, mr: 1 }}>
                Back
              </Button>
            </Box>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Complete Setup</StepLabel>
          <StepContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Ready to set up your Megaphone integration. This will:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><DatabaseIcon /></ListItemIcon>
                <ListItemText primary="Create organization-specific database tables" />
              </ListItem>
              <ListItem>
                <ListItemIcon><SecurityIcon /></ListItemIcon>
                <ListItemText primary="Isolate your data from other organizations" />
              </ListItem>
              <ListItem>
                <ListItemIcon><SyncIcon /></ListItemIcon>
                <ListItemText primary="Configure automated data synchronization" />
              </ListItem>
              <ListItem>
                <ListItemIcon><AnalyticsIcon /></ListItemIcon>
                <ListItemText primary="Enable real-time analytics tracking" />
              </ListItem>
            </List>
            <Box sx={{ mb: 1, mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleSetup}
                disabled={setupMutation.isPending}
                sx={{ mt: 1, mr: 1 }}
              >
                {setupMutation.isPending ? 'Setting up...' : 'Complete Setup'}
              </Button>
              <Button onClick={handleBack} sx={{ mt: 1, mr: 1 }}>
                Back
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>

      {setupMutation.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Setup failed: {(setupMutation.error as Error).message}
        </Alert>
      )}

      {setupMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Megaphone integration set up successfully! Your organization-specific tables have been created and data isolation is enabled.
        </Alert>
      )}
    </Paper>
  )
}