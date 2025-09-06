'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Slider,
  Switch,
  FormGroup,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
import InfoIcon from '@mui/icons-material/Info'

interface WorkflowSettingsData {
  stages: any[]
  thresholds: {
    approval_trigger?: number
    rejection_fallback?: number
    auto_create_order?: number
  }
  notifications: {
    notify_on_90?: boolean
    notify_on_approval?: boolean
    notify_on_rejection?: boolean
  }
  isActive: boolean
}

export default function WorkflowSettings() {
  const [settings, setSettings] = useState<WorkflowSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch current settings
  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/workflow-settings')
      if (!res.ok) throw new Error('Failed to fetch workflow settings')
      const data = await res.json()
      setSettings(data)
    } catch (err) {
      setError('Failed to load workflow settings')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  // Handle save
  const handleSave = async () => {
    if (!settings) return
    
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      const res = await fetch('/api/admin/workflow-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      
      if (!res.ok) throw new Error('Failed to save workflow settings')
      
      const updatedSettings = await res.json()
      setSettings(updatedSettings)
      setSuccess('Workflow settings saved successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save workflow settings')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Handle threshold changes
  const handleThresholdChange = (key: string, value: number) => {
    if (!settings) return
    setSettings({
      ...settings,
      thresholds: {
        ...settings.thresholds,
        [key]: value
      }
    })
  }

  // Handle notification changes
  const handleNotificationChange = (key: string, value: boolean) => {
    if (!settings) return
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: value
      }
    })
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!settings) {
    return (
      <Alert severity="error">
        Failed to load workflow settings. Please refresh the page.
      </Alert>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">Campaign Workflow Settings</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh settings">
              <IconButton onClick={fetchSettings} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Box>
        </Box>

        {/* Alerts */}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {/* Active Toggle */}
        <FormGroup sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.isActive}
                onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
              />
            }
            label="Workflow Automation Active"
          />
        </FormGroup>

        <Divider sx={{ my: 3 }} />

        {/* Probability Thresholds */}
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          Probability Thresholds
          <Tooltip title="Configure the probability percentages that trigger workflow actions">
            <InfoIcon fontSize="small" color="action" />
          </Tooltip>
        </Typography>

        <Stack spacing={3} sx={{ mb: 4 }}>
          {/* Approval Trigger */}
          <Box>
            <Typography gutterBottom>
              Approval Trigger: <Chip label={`${settings.thresholds.approval_trigger || 90}%`} color="primary" size="small" />
            </Typography>
            <Slider
              value={settings.thresholds.approval_trigger || 90}
              onChange={(_, value) => handleThresholdChange('approval_trigger', value as number)}
              min={50}
              max={100}
              step={5}
              marks={[
                { value: 50, label: '50%' },
                { value: 75, label: '75%' },
                { value: 90, label: '90%' },
                { value: 100, label: '100%' }
              ]}
              valueLabelDisplay="auto"
            />
            <Typography variant="caption" color="text.secondary">
              When campaign probability reaches this threshold, approval workflow is triggered
            </Typography>
          </Box>

          {/* Rejection Fallback */}
          <Box>
            <Typography gutterBottom>
              Rejection Fallback: <Chip label={`${settings.thresholds.rejection_fallback || 65}%`} color="warning" size="small" />
            </Typography>
            <Slider
              value={settings.thresholds.rejection_fallback || 65}
              onChange={(_, value) => handleThresholdChange('rejection_fallback', value as number)}
              min={10}
              max={85}
              step={5}
              marks={[
                { value: 10, label: '10%' },
                { value: 35, label: '35%' },
                { value: 65, label: '65%' },
                { value: 85, label: '85%' }
              ]}
              valueLabelDisplay="auto"
            />
            <Typography variant="caption" color="text.secondary">
              When approval is rejected, campaign probability falls back to this percentage
            </Typography>
          </Box>

          {/* Auto-Create Order Threshold */}
          <Box>
            <Typography gutterBottom>
              Auto-Create Order: <Chip label={`${settings.thresholds.auto_create_order || 100}%`} color="success" size="small" />
            </Typography>
            <Slider
              value={settings.thresholds.auto_create_order || 100}
              onChange={(_, value) => handleThresholdChange('auto_create_order', value as number)}
              min={90}
              max={100}
              step={5}
              marks={[
                { value: 90, label: '90%' },
                { value: 95, label: '95%' },
                { value: 100, label: '100%' }
              ]}
              valueLabelDisplay="auto"
            />
            <Typography variant="caption" color="text.secondary">
              Automatically create order when campaign reaches this probability
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* Notification Settings */}
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          Notification Settings
          <Tooltip title="Configure when notifications are sent during the workflow">
            <InfoIcon fontSize="small" color="action" />
          </Tooltip>
        </Typography>

        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications.notify_on_90 !== false}
                onChange={(e) => handleNotificationChange('notify_on_90', e.target.checked)}
              />
            }
            label="Send notification when campaign reaches approval trigger"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications.notify_on_approval !== false}
                onChange={(e) => handleNotificationChange('notify_on_approval', e.target.checked)}
              />
            }
            label="Send notification when campaign is approved"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications.notify_on_rejection !== false}
                onChange={(e) => handleNotificationChange('notify_on_rejection', e.target.checked)}
              />
            }
            label="Send notification when campaign is rejected"
          />
        </FormGroup>

        <Divider sx={{ my: 3 }} />

        {/* Workflow Stages Preview */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          Workflow Stages
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip label="10% - Initial Interest" variant="outlined" />
          <Chip label="35% - Discovery/Qualification" variant="outlined" />
          <Chip label={`${settings.thresholds.rejection_fallback || 65}% - Proposal/Negotiation`} variant="outlined" color="warning" />
          <Chip label={`${settings.thresholds.approval_trigger || 90}% - Verbal Commitment`} variant="outlined" color="primary" />
          <Chip label="100% - Closed Won" variant="outlined" color="success" />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Note: Drag-and-drop stage customization coming soon
        </Typography>
      </Paper>
    </Box>
  )
}