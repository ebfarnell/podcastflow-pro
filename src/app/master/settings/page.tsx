'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  Switch,
  Divider,
  Card,
  CardContent,
  Grid,
  Alert,
  Tab,
  Tabs,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  Save as SaveIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  CloudQueue as CloudIcon,
  Api as ApiIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { MasterOnly } from '@/components/auth/RoleGuard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { masterApi, type PlatformSettings } from '@/services/masterApi'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export default function PlatformSettingsPage() {
  const [tabValue, setTabValue] = useState(0)
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const queryClient = useQueryClient()

  // Fetch platform settings
  const { data: platformSettings, isLoading, error } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => masterApi.settings.getPlatformSettings()
  })

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (updatedSettings: Partial<PlatformSettings>) =>
      masterApi.settings.updatePlatformSettings(updatedSettings),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] })
      setSettings(data)
      alert('Settings updated successfully!')
    },
    onError: (error) => {
      console.error('Error updating settings:', error)
      alert('Failed to update settings')
    }
  })

  // Initialize settings from API data
  React.useEffect(() => {
    if (platformSettings) {
      setSettings(platformSettings)
    }
  }, [platformSettings])

  const handleChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleSave = () => {
    if (settings) {
      updateSettingsMutation.mutate(settings)
    }
  }

  if (isLoading) {
    return (
      <MasterOnly>
        <DashboardLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <Typography>Loading platform settings...</Typography>
          </Box>
        </DashboardLayout>
      </MasterOnly>
    )
  }

  if (!settings) {
    return (
      <MasterOnly>
        <DashboardLayout>
          <Box sx={{ p: 3 }}>
            <Alert severity="error">
              Failed to load platform settings. Please try again.
            </Alert>
          </Box>
        </DashboardLayout>
      </MasterOnly>
    )
  }

  return (
    <MasterOnly>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
                Platform Settings
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Configure global platform settings and preferences
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={updateSettingsMutation.isLoading}
            >
              {updateSettingsMutation.isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            Changes to these settings will affect all organizations and users on the platform.
          </Alert>

          <Paper sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label="General" />
                <Tab label="Security" />
                <Tab label="Notifications" />
                <Tab label="Storage" />
                <Tab label="API" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                        Platform Information
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                          label="Platform Name"
                          value={settings.platformName}
                          onChange={(e) => handleChange('platformName', e.target.value)}
                          fullWidth
                        />
                        <TextField
                          label="Support Email"
                          type="email"
                          value={settings.supportEmail}
                          onChange={(e) => handleChange('supportEmail', e.target.value)}
                          fullWidth
                        />
                        <FormControl fullWidth>
                          <InputLabel>Default User Role</InputLabel>
                          <Select
                            value={settings.defaultUserRole}
                            onChange={(e) => handleChange('defaultUserRole', e.target.value)}
                            label="Default User Role"
                          >
                            <MenuItem value="client">Client</MenuItem>
                            <MenuItem value="producer">Producer</MenuItem>
                            <MenuItem value="talent">Talent</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                        Platform Controls
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.maintenanceMode}
                              onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
                            />
                          }
                          label="Maintenance Mode"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.registrationEnabled}
                              onChange={(e) => handleChange('registrationEnabled', e.target.checked)}
                            />
                          }
                          label="New User Registration"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <SecurityIcon sx={{ mr: 2 }} />
                        <Typography variant="h6" sx={{ color: 'text.primary' }}>
                          Security Settings
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.enforceSSL}
                              onChange={(e) => handleChange('enforceSSL', e.target.checked)}
                            />
                          }
                          label="Enforce SSL/HTTPS"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.requireMFA}
                              onChange={(e) => handleChange('requireMFA', e.target.checked)}
                            />
                          }
                          label="Require Multi-Factor Authentication"
                        />
                        <TextField
                          label="Session Timeout (hours)"
                          type="number"
                          value={settings.sessionTimeout}
                          onChange={(e) => handleChange('sessionTimeout', parseInt(e.target.value))}
                          fullWidth
                        />
                        <TextField
                          label="Minimum Password Length"
                          type="number"
                          value={settings.passwordMinLength}
                          onChange={(e) => handleChange('passwordMinLength', parseInt(e.target.value))}
                          fullWidth
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                        Access Control
                      </Typography>
                      <TextField
                        label="Allowed Email Domains"
                        placeholder="example.com, company.org"
                        value={settings.allowedDomains}
                        onChange={(e) => handleChange('allowedDomains', e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        helperText="Leave empty to allow all domains"
                      />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <NotificationsIcon sx={{ mr: 2 }} />
                    <Typography variant="h6" sx={{ color: 'text.primary' }}>
                      Notification Settings
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.emailNotifications}
                            onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                          />
                        }
                        label="Email Notifications"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.systemAlerts}
                            onChange={(e) => handleChange('systemAlerts', e.target.checked)}
                          />
                        }
                        label="System Alerts"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.maintenanceNotices}
                            onChange={(e) => handleChange('maintenanceNotices', e.target.checked)}
                          />
                        }
                        label="Maintenance Notices"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.weeklyReports}
                            onChange={(e) => handleChange('weeklyReports', e.target.checked)}
                          />
                        }
                        label="Weekly Reports"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <StorageIcon sx={{ mr: 2 }} />
                    <Typography variant="h6" sx={{ color: 'text.primary' }}>
                      Storage Settings
                    </Typography>
                  </Box>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        label="Max Upload Size (MB)"
                        type="number"
                        value={settings.maxUploadSize}
                        onChange={(e) => handleChange('maxUploadSize', parseInt(e.target.value))}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        label="Storage Quota per Org (GB)"
                        type="number"
                        value={settings.storageQuota}
                        onChange={(e) => handleChange('storageQuota', parseInt(e.target.value))}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        label="Backup Retention (days)"
                        type="number"
                        value={settings.backupRetention}
                        onChange={(e) => handleChange('backupRetention', parseInt(e.target.value))}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={tabValue} index={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ApiIcon sx={{ mr: 2 }} />
                    <Typography variant="h6" sx={{ color: 'text.primary' }}>
                      API Settings
                    </Typography>
                  </Box>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.rateLimitEnabled}
                            onChange={(e) => handleChange('rateLimitEnabled', e.target.checked)}
                          />
                        }
                        label="Enable Rate Limiting"
                      />
                      <TextField
                        label="Requests per Minute"
                        type="number"
                        value={settings.requestsPerMinute}
                        onChange={(e) => handleChange('requestsPerMinute', parseInt(e.target.value))}
                        fullWidth
                        disabled={!settings.rateLimitEnabled}
                        sx={{ mt: 2 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.apiVersioning}
                            onChange={(e) => handleChange('apiVersioning', e.target.checked)}
                          />
                        }
                        label="API Versioning"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </TabPanel>
          </Paper>
        </Box>
      </DashboardLayout>
    </MasterOnly>
  )
}