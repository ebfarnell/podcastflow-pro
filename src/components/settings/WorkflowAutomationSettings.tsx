'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
} from '@mui/material'
import {
  Save as SaveIcon,
  RestartAlt as ResetIcon,
  Info as InfoIcon,
  PlayArrow as PlayIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'

interface WorkflowSettings {
  enabled: boolean
  autoStages: {
    at10: boolean
    at35: boolean
    at65: boolean
    at90: boolean
    at100: boolean
  }
  inventory: {
    reserveAt90: boolean
    reservationTtlHours: number
  }
  rateCard: {
    deltaApprovalThresholdPct: number
  }
  exclusivity: {
    policy: 'WARN' | 'BLOCK'
    categories: string[]
  }
  talentApprovals: {
    hostRead: boolean
    endorsed: boolean
  }
  contracts: {
    autoGenerate: boolean
    emailTemplateId: string
  }
  billing: {
    invoiceDayOfMonth: number
    timezone: string
    prebillWhenNoTerms: boolean
  }
}

const DEFAULT_SETTINGS: WorkflowSettings = {
  enabled: true,
  autoStages: {
    at10: true,
    at35: true,
    at65: true,
    at90: true,
    at100: true,
  },
  inventory: {
    reserveAt90: true,
    reservationTtlHours: 72,
  },
  rateCard: {
    deltaApprovalThresholdPct: 15,
  },
  exclusivity: {
    policy: 'WARN',
    categories: [],
  },
  talentApprovals: {
    hostRead: true,
    endorsed: true,
  },
  contracts: {
    autoGenerate: true,
    emailTemplateId: 'contract_default',
  },
  billing: {
    invoiceDayOfMonth: 15,
    timezone: 'America/Los_Angeles',
    prebillWhenNoTerms: true,
  },
}

// Available timezones
const TIMEZONES = [
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
]

export default function WorkflowAutomationSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<WorkflowSettings>(DEFAULT_SETTINGS)
  const [hasChanges, setHasChanges] = useState(false)
  const [simulateDialog, setSimulateDialog] = useState(false)
  const [simulateData, setSimulateData] = useState({
    campaignId: '',
    targetStage: '90',
    dryRun: true,
  })
  const [simulationResult, setSimulationResult] = useState<any>(null)

  // Fetch current settings
  const { data: fetchedSettings, isLoading } = useQuery({
    queryKey: ['workflow-automation-settings'],
    queryFn: async () => {
      const response = await fetch('/api/organization/workflow-automation')
      if (!response.ok) throw new Error('Failed to fetch settings')
      return response.json()
    },
  })

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: WorkflowSettings) => {
      const response = await fetch('/api/organization/workflow-automation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to update settings')
      return response.json()
    },
    onSuccess: () => {
      setHasChanges(false)
      queryClient.invalidateQueries({ queryKey: ['workflow-automation-settings'] })
    },
  })

  // Simulate transition mutation
  const simulateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/organization/workflow-automation/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to simulate transition')
      return response.json()
    },
    onSuccess: (data) => {
      setSimulationResult(data.simulation)
    },
  })

  // Update local settings when fetched
  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings)
    }
  }, [fetchedSettings])

  const handleSettingChange = (path: string, value: any) => {
    const keys = path.split('.')
    const newSettings = { ...settings }
    let current: any = newSettings
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]]
    }
    
    current[keys[keys.length - 1]] = value
    setSettings(newSettings)
    setHasChanges(true)
  }

  const handleSave = () => {
    updateSettingsMutation.mutate(settings)
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
    setHasChanges(true)
  }

  const handleSimulate = () => {
    simulateMutation.mutate(simulateData)
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Workflow Automation Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure automated workflow stages and transitions for campaigns
      </Typography>

      {/* Master Enable Toggle */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                onChange={(e) => handleSettingChange('enabled', e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="subtitle1">Enable Workflow Automation</Typography>
                <Typography variant="caption" color="text.secondary">
                  When enabled, campaigns will automatically transition through stages based on configured thresholds
                </Typography>
              </Box>
            }
          />
        </CardContent>
      </Card>

      {/* Stage Automation Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Stage Automation Controls
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enable or disable automatic transitions at each probability milestone
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoStages.at10}
                    onChange={(e) => handleSettingChange('autoStages.at10', e.target.checked)}
                    disabled={!settings.enabled}
                  />
                }
                label="10% - Pre-Sale Active & Schedule Builder"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoStages.at35}
                    onChange={(e) => handleSettingChange('autoStages.at35', e.target.checked)}
                    disabled={!settings.enabled}
                  />
                }
                label="35% - Schedule Saved & Rate Card Delta Tracking"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoStages.at65}
                    onChange={(e) => handleSettingChange('autoStages.at65', e.target.checked)}
                    disabled={!settings.enabled}
                  />
                }
                label="65% - Talent Approval & Exclusivity Check"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoStages.at90}
                    onChange={(e) => handleSettingChange('autoStages.at90', e.target.checked)}
                    disabled={!settings.enabled}
                  />
                }
                label="90% - Inventory Reservation"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoStages.at100}
                    onChange={(e) => handleSettingChange('autoStages.at100', e.target.checked)}
                    disabled={!settings.enabled}
                  />
                }
                label="100% - Order Creation & Contract Generation"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Inventory Management */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Inventory Management
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.inventory.reserveAt90}
                    onChange={(e) => handleSettingChange('inventory.reserveAt90', e.target.checked)}
                    disabled={!settings.enabled}
                  />
                }
                label="Auto-reserve inventory at 90%"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Reservation TTL (hours)"
                value={settings.inventory.reservationTtlHours}
                onChange={(e) => handleSettingChange('inventory.reservationTtlHours', parseInt(e.target.value))}
                disabled={!settings.enabled || !settings.inventory.reserveAt90}
                InputProps={{
                  endAdornment: <InputAdornment position="end">hours</InputAdornment>,
                }}
                helperText="How long to hold reserved inventory before auto-release"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Rate Card & Pricing */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Rate Card & Pricing Controls
          </Typography>
          
          <TextField
            fullWidth
            type="number"
            label="Rate Card Delta Approval Threshold"
            value={settings.rateCard.deltaApprovalThresholdPct}
            onChange={(e) => handleSettingChange('rateCard.deltaApprovalThresholdPct', parseInt(e.target.value))}
            disabled={!settings.enabled}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
            helperText="Rate changes above this percentage require admin approval"
          />
        </CardContent>
      </Card>

      {/* Category Exclusivity */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Category Exclusivity Policy
          </Typography>
          
          <FormControl fullWidth>
            <InputLabel>Conflict Policy</InputLabel>
            <Select
              value={settings.exclusivity.policy}
              onChange={(e) => handleSettingChange('exclusivity.policy', e.target.value)}
              disabled={!settings.enabled}
              label="Conflict Policy"
            >
              <MenuItem value="WARN">Warn Only</MenuItem>
              <MenuItem value="BLOCK">Block Transitions</MenuItem>
            </Select>
          </FormControl>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            {settings.exclusivity.policy === 'WARN'
              ? 'Exclusivity conflicts will show warnings but allow transitions'
              : 'Exclusivity conflicts will prevent stage transitions'}
          </Alert>
        </CardContent>
      </Card>

      {/* Talent/Producer Approvals */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Talent & Producer Approvals
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure which spot types require talent or producer approval at 65%
          </Typography>
          
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.talentApprovals.hostRead}
                  onChange={(e) => handleSettingChange('talentApprovals.hostRead', e.target.checked)}
                  disabled={!settings.enabled}
                />
              }
              label="Host Read spots require talent approval"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.talentApprovals.endorsed}
                  onChange={(e) => handleSettingChange('talentApprovals.endorsed', e.target.checked)}
                  disabled={!settings.enabled}
                />
              }
              label="Endorsement spots require talent approval"
            />
          </FormGroup>
        </CardContent>
      </Card>

      {/* Contract Generation */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Contract Generation
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.contracts.autoGenerate}
                    onChange={(e) => handleSettingChange('contracts.autoGenerate', e.target.checked)}
                    disabled={!settings.enabled}
                  />
                }
                label="Auto-generate contracts at 100%"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email Template ID"
                value={settings.contracts.emailTemplateId}
                onChange={(e) => handleSettingChange('contracts.emailTemplateId', e.target.value)}
                disabled={!settings.enabled || !settings.contracts.autoGenerate}
                helperText="Template to use for contract emails"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Billing Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Billing & Invoicing
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Invoice Day of Month"
                value={settings.billing.invoiceDayOfMonth}
                onChange={(e) => handleSettingChange('billing.invoiceDayOfMonth', parseInt(e.target.value))}
                disabled={!settings.enabled}
                InputProps={{
                  inputProps: { min: 1, max: 28 }
                }}
                helperText="Day of month to generate invoices (1-28)"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Billing Timezone</InputLabel>
                <Select
                  value={settings.billing.timezone}
                  onChange={(e) => handleSettingChange('billing.timezone', e.target.value)}
                  disabled={!settings.enabled}
                  label="Billing Timezone"
                >
                  {TIMEZONES.map(tz => (
                    <MenuItem key={tz} value={tz}>{tz}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.billing.prebillWhenNoTerms}
                    onChange={(e) => handleSettingChange('billing.prebillWhenNoTerms', e.target.checked)}
                    disabled={!settings.enabled}
                  />
                }
                label="Pre-bill when no credit terms"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Admin Tools - Only show in development */}
      {process.env.NODE_ENV === 'development' && ['admin', 'master'].includes(user?.role || '') && (
        <Card sx={{ mb: 3, border: '2px dashed', borderColor: 'warning.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              Admin Tools (Dev Mode Only)
            </Typography>
            
            <Button
              variant="outlined"
              startIcon={<PlayIcon />}
              onClick={() => setSimulateDialog(true)}
              color="warning"
            >
              Simulate Transition
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<ResetIcon />}
          onClick={handleReset}
          disabled={!hasChanges}
        >
          Reset to Defaults
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!hasChanges || updateSettingsMutation.isPending}
        >
          {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      {/* Success/Error Messages */}
      {updateSettingsMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Workflow automation settings updated successfully
        </Alert>
      )}
      {updateSettingsMutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to update settings. Please try again.
        </Alert>
      )}

      {/* Simulate Transition Dialog */}
      <Dialog open={simulateDialog} onClose={() => setSimulateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Simulate Workflow Transition</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Test workflow transitions with a specific campaign ID
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Campaign ID"
                value={simulateData.campaignId}
                onChange={(e) => setSimulateData({ ...simulateData, campaignId: e.target.value })}
                helperText="Enter a valid campaign ID from your organization"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Target Stage</InputLabel>
                <Select
                  value={simulateData.targetStage}
                  onChange={(e) => setSimulateData({ ...simulateData, targetStage: e.target.value })}
                  label="Target Stage"
                >
                  <MenuItem value="10">10% - Pre-Sale Active</MenuItem>
                  <MenuItem value="35">35% - Schedule Validated</MenuItem>
                  <MenuItem value="65">65% - Talent Approval</MenuItem>
                  <MenuItem value="90">90% - Reservations</MenuItem>
                  <MenuItem value="100">100% - Approved</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={simulateData.dryRun}
                    onChange={(e) => setSimulateData({ ...simulateData, dryRun: e.target.checked })}
                  />
                }
                label="Dry Run (no actual changes)"
              />
            </Grid>
          </Grid>

          {simulationResult && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Simulation Results
              </Typography>
              <Alert severity={simulationResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                Transition from {simulationResult.currentStage}% to {simulationResult.targetStage}%
              </Alert>
              
              <Typography variant="subtitle2" gutterBottom>
                Side Effects:
              </Typography>
              {simulationResult.sideEffects.map((effect: any, index: number) => (
                <Chip
                  key={index}
                  label={effect.description}
                  icon={<CheckIcon />}
                  color="primary"
                  variant="outlined"
                  sx={{ m: 0.5 }}
                />
              ))}
              
              {simulationResult.notifications && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Notifications to Send:
                  </Typography>
                  {simulationResult.notifications.map((notif: any, index: number) => (
                    <Typography key={index} variant="body2" color="text.secondary">
                      • {notif.event} → {notif.recipients.join(', ')}
                    </Typography>
                  ))}
                </>
              )}
            </Box>
          )}

          {simulateMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Simulation failed. Please check the campaign ID and try again.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSimulateDialog(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={handleSimulate}
            disabled={!simulateData.campaignId || simulateMutation.isPending}
            startIcon={simulateMutation.isPending ? <CircularProgress size={20} /> : <PlayIcon />}
          >
            {simulateMutation.isPending ? 'Simulating...' : 'Run Simulation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}