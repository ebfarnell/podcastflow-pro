'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  TextField,
  Switch,
  FormControlLabel,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  InputAdornment,
  FormHelperText,
} from '@mui/material'
import {
  Lock as LockIcon,
  Key as KeyIcon,
  Shield as ShieldIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
  NetworkCheck as NetworkIcon,
  Policy as PolicyIcon,
  VpnKey as VpnKeyIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { OrgSecuritySettings, DEFAULT_SECURITY_SETTINGS } from '@/types/security'
import { useSnackbar } from '@/hooks/useSnackbar'
import ApiKeyManagement from './ApiKeyManagement'
import WebhookSecurity from './WebhookSecurity'

export function EnhancedSecuritySettings() {
  const { showSnackbar } = useSnackbar()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<OrgSecuritySettings>(DEFAULT_SECURITY_SETTINGS as OrgSecuritySettings)
  const [originalSettings, setOriginalSettings] = useState<OrgSecuritySettings>(DEFAULT_SECURITY_SETTINGS as OrgSecuritySettings)
  const [version, setVersion] = useState(1)
  const [etag, setEtag] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Dialog states
  const [ipDialog, setIpDialog] = useState(false)
  const [apiKeyDialog, setApiKeyDialog] = useState(false)
  const [ssoDialog, setSsoDialog] = useState(false)
  
  // Form states for dialogs
  const [newIpRange, setNewIpRange] = useState('')
  const [ipListType, setIpListType] = useState<'allowlist' | 'blocklist'>('allowlist')

  // Fetch current settings
  useEffect(() => {
    fetchSecuritySettings()
  }, [])

  // Track changes
  useEffect(() => {
    setHasChanges(JSON.stringify(settings) !== JSON.stringify(originalSettings))
  }, [settings, originalSettings])

  const fetchSecuritySettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/security', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch security settings')
      }

      const data = await response.json()
      const responseEtag = response.headers.get('ETag')
      
      setSettings(data)
      setOriginalSettings(data)
      setVersion(data.version || 1)
      setEtag(responseEtag)
    } catch (error) {
      console.error('Error fetching security settings:', error)
      showSnackbar('Failed to load security settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      
      const response = await fetch('/api/settings/security', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(etag ? { 'If-Match': etag } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          ...settings,
          version,
        }),
      })

      if (response.status === 409) {
        // Version conflict
        showSnackbar('Settings were updated by another admin. Please refresh and try again.', 'warning')
        await fetchSecuritySettings()
        return
      }

      if (!response.ok) {
        throw new Error('Failed to save security settings')
      }

      const data = await response.json()
      const newEtag = response.headers.get('ETag')
      
      setSettings(data)
      setOriginalSettings(data)
      setVersion(data.version)
      setEtag(newEtag)
      setHasChanges(false)
      
      showSnackbar('Security settings saved successfully', 'success')
    } catch (error) {
      console.error('Error saving security settings:', error)
      showSnackbar('Failed to save security settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setSettings(originalSettings)
    setHasChanges(false)
  }

  const updateSetting = (path: string[], value: any) => {
    setSettings(prev => {
      const updated = { ...prev }
      let current: any = updated
      
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) {
          current[path[i]] = {}
        }
        current = current[path[i]]
      }
      
      current[path[path.length - 1]] = value
      return updated
    })
  }

  const addIpRange = () => {
    if (!newIpRange) return
    
    const list = ipListType === 'allowlist' 
      ? settings.ipRestrictions?.allowlist || []
      : settings.ipRestrictions?.blocklist || []
    
    if (!list.includes(newIpRange)) {
      updateSetting(['ipRestrictions', ipListType], [...list, newIpRange])
      setNewIpRange('')
      showSnackbar(`Added ${newIpRange} to ${ipListType}`, 'success')
    }
  }

  const removeIpRange = (ip: string, listType: 'allowlist' | 'blocklist') => {
    const list = listType === 'allowlist'
      ? settings.ipRestrictions?.allowlist || []
      : settings.ipRestrictions?.blocklist || []
    
    updateSetting(['ipRestrictions', listType], list.filter(item => item !== ip))
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            Loading security settings...
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h5" gutterBottom>
                Organization Security Settings
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Configure security policies and access controls for your organization
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {hasChanges && (
                <>
                  <Button
                    variant="outlined"
                    onClick={handleCancel}
                    startIcon={<CancelIcon />}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={saveSettings}
                    disabled={saving}
                    startIcon={<SaveIcon />}
                  >
                    Save Changes
                  </Button>
                </>
              )}
            </Box>
          </Box>

          {hasChanges && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You have unsaved changes. Click "Save Changes" to apply them.
            </Alert>
          )}

          {/* Authentication & MFA */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShieldIcon />
                <Typography variant="h6">Authentication & MFA</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.mfaRequired || false}
                        onChange={(e) => updateSetting(['mfaRequired'], e.target.checked)}
                      />
                    }
                    label="Require MFA for all users"
                  />
                  <FormHelperText>
                    When enabled, all users must set up multi-factor authentication
                  </FormHelperText>
                </Grid>
                
                {settings.mfaRequired && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="MFA Grace Period (days)"
                      type="number"
                      value={settings.mfaGracePeriodDays || 7}
                      onChange={(e) => updateSetting(['mfaGracePeriodDays'], parseInt(e.target.value))}
                      fullWidth
                      InputProps={{ inputProps: { min: 0, max: 30 } }}
                      helperText="Days to allow login before forcing MFA enrollment"
                    />
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Box>
                      <Typography variant="subtitle1">Single Sign-On (SSO)</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Configure SSO provider for seamless authentication
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      onClick={() => setSsoDialog(true)}
                      startIcon={<EditIcon />}
                    >
                      Configure SSO
                    </Button>
                  </Box>
                  {settings.sso?.enabled && (
                    <Chip
                      label={`SSO Provider: ${settings.sso.provider}`}
                      color="primary"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Password Policy */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon />
                <Typography variant="h6">Password Policy</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Minimum Password Length"
                    type="number"
                    value={settings.passwordPolicy?.minLength || 8}
                    onChange={(e) => updateSetting(['passwordPolicy', 'minLength'], parseInt(e.target.value))}
                    fullWidth
                    InputProps={{ inputProps: { min: 6, max: 128 } }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Password Expiry (days)"
                    type="number"
                    value={settings.passwordPolicy?.expiryDays || ''}
                    onChange={(e) => updateSetting(['passwordPolicy', 'expiryDays'], e.target.value ? parseInt(e.target.value) : undefined)}
                    fullWidth
                    InputProps={{ inputProps: { min: 0, max: 365 } }}
                    helperText="Leave empty for no expiry"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Password Requirements
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.passwordPolicy?.requireUppercase || false}
                          onChange={(e) => updateSetting(['passwordPolicy', 'requireUppercase'], e.target.checked)}
                        />
                      }
                      label="Require uppercase letters"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.passwordPolicy?.requireLowercase || false}
                          onChange={(e) => updateSetting(['passwordPolicy', 'requireLowercase'], e.target.checked)}
                        />
                      }
                      label="Require lowercase letters"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.passwordPolicy?.requireNumbers || false}
                          onChange={(e) => updateSetting(['passwordPolicy', 'requireNumbers'], e.target.checked)}
                        />
                      }
                      label="Require numbers"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.passwordPolicy?.requireSymbols || false}
                          onChange={(e) => updateSetting(['passwordPolicy', 'requireSymbols'], e.target.checked)}
                        />
                      }
                      label="Require special characters"
                    />
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Max Login Attempts"
                    type="number"
                    value={settings.passwordPolicy?.maxAttempts || 5}
                    onChange={(e) => updateSetting(['passwordPolicy', 'maxAttempts'], parseInt(e.target.value))}
                    fullWidth
                    InputProps={{ inputProps: { min: 3, max: 10 } }}
                    helperText="Lock account after this many failed attempts"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Lockout Duration (minutes)"
                    type="number"
                    value={settings.passwordPolicy?.lockoutDurationMinutes || 30}
                    onChange={(e) => updateSetting(['passwordPolicy', 'lockoutDurationMinutes'], parseInt(e.target.value))}
                    fullWidth
                    InputProps={{ inputProps: { min: 5, max: 1440 } }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Session Security */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PolicyIcon />
                <Typography variant="h6">Session Security</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Idle Timeout (minutes)"
                    type="number"
                    value={settings.session?.idleTimeoutMinutes || 480}
                    onChange={(e) => updateSetting(['session', 'idleTimeoutMinutes'], parseInt(e.target.value))}
                    fullWidth
                    InputProps={{ inputProps: { min: 5, max: 10080 } }}
                    helperText="Logout after this period of inactivity"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Absolute Timeout (hours)"
                    type="number"
                    value={settings.session?.absoluteTimeoutHours || 24}
                    onChange={(e) => updateSetting(['session', 'absoluteTimeoutHours'], parseInt(e.target.value))}
                    fullWidth
                    InputProps={{ inputProps: { min: 1, max: 720 } }}
                    helperText="Force re-login after this period"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Token Rotation Policy</InputLabel>
                    <Select
                      value={settings.session?.refreshRotation || 'static'}
                      onChange={(e) => updateSetting(['session', 'refreshRotation'], e.target.value)}
                    >
                      <MenuItem value="static">Static (no rotation)</MenuItem>
                      <MenuItem value="rotate">Rotate on refresh</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Max Concurrent Sessions"
                    type="number"
                    value={settings.session?.maxConcurrentSessions || ''}
                    onChange={(e) => updateSetting(['session', 'maxConcurrentSessions'], e.target.value ? parseInt(e.target.value) : undefined)}
                    fullWidth
                    InputProps={{ inputProps: { min: 1, max: 10 } }}
                    helperText="Leave empty for unlimited"
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.session?.requireReauthForSensitive || false}
                        onChange={(e) => updateSetting(['session', 'requireReauthForSensitive'], e.target.checked)}
                      />
                    }
                    label="Require re-authentication for sensitive actions"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Network Security */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NetworkIcon />
                <Typography variant="h6">Network Security</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.ipRestrictions?.enabled || false}
                        onChange={(e) => updateSetting(['ipRestrictions', 'enabled'], e.target.checked)}
                      />
                    }
                    label="Enable IP restrictions"
                  />
                </Grid>

                {settings.ipRestrictions?.enabled && (
                  <>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1">IP Allowlist</Typography>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => {
                            setIpListType('allowlist')
                            setIpDialog(true)
                          }}
                        >
                          Add IP Range
                        </Button>
                      </Box>
                      {settings.ipRestrictions?.allowlist?.map((ip) => (
                        <Chip
                          key={ip}
                          label={ip}
                          onDelete={() => removeIpRange(ip, 'allowlist')}
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                      {(!settings.ipRestrictions?.allowlist || settings.ipRestrictions.allowlist.length === 0) && (
                        <Typography variant="body2" color="textSecondary">
                          No IP ranges in allowlist (all IPs allowed)
                        </Typography>
                      )}
                    </Grid>

                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1">IP Blocklist</Typography>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => {
                            setIpListType('blocklist')
                            setIpDialog(true)
                          }}
                        >
                          Add IP Range
                        </Button>
                      </Box>
                      {settings.ipRestrictions?.blocklist?.map((ip) => (
                        <Chip
                          key={ip}
                          label={ip}
                          onDelete={() => removeIpRange(ip, 'blocklist')}
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                      {(!settings.ipRestrictions?.blocklist || settings.ipRestrictions.blocklist.length === 0) && (
                        <Typography variant="body2" color="textSecondary">
                          No IP ranges in blocklist
                        </Typography>
                      )}
                    </Grid>

                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.ipRestrictions?.enforceForAdmins || false}
                            onChange={(e) => updateSetting(['ipRestrictions', 'enforceForAdmins'], e.target.checked)}
                          />
                        }
                        label="Apply IP restrictions to admin users"
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Export & Data Controls */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StorageIcon />
                <Typography variant="h6">Export & Data Controls</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.exportPolicy?.requireApproval || false}
                        onChange={(e) => updateSetting(['exportPolicy', 'requireApproval'], e.target.checked)}
                      />
                    }
                    label="Require approval for data exports"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Roles allowed to export data
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {['master', 'admin', 'sales', 'producer'].map((role) => (
                      <FormControlLabel
                        key={role}
                        control={
                          <Switch
                            checked={settings.exportPolicy?.allowedRoles?.includes(role) || false}
                            onChange={(e) => {
                              const current = settings.exportPolicy?.allowedRoles || []
                              if (e.target.checked) {
                                updateSetting(['exportPolicy', 'allowedRoles'], [...current, role])
                              } else {
                                updateSetting(['exportPolicy', 'allowedRoles'], current.filter(r => r !== role))
                              }
                            }}
                          />
                        }
                        label={role.charAt(0).toUpperCase() + role.slice(1)}
                      />
                    ))}
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Max Records Per Export"
                    type="number"
                    value={settings.exportPolicy?.maxRecordsPerExport || ''}
                    onChange={(e) => updateSetting(['exportPolicy', 'maxRecordsPerExport'], e.target.value ? parseInt(e.target.value) : undefined)}
                    fullWidth
                    InputProps={{ inputProps: { min: 100, max: 1000000 } }}
                    helperText="Leave empty for unlimited"
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.exportPolicy?.auditAllExports !== false}
                        onChange={(e) => updateSetting(['exportPolicy', 'auditAllExports'], e.target.checked)}
                      />
                    }
                    label="Audit all data exports"
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.exportPolicy?.watermarkExports || false}
                        onChange={(e) => updateSetting(['exportPolicy', 'watermarkExports'], e.target.checked)}
                      />
                    }
                    label="Add watermark to exported files"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Audit & Compliance */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SecurityIcon />
                <Typography variant="h6">Audit & Compliance</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Audit Log Retention (days)"
                    type="number"
                    value={settings.auditSettings?.retentionDays || 90}
                    onChange={(e) => updateSetting(['auditSettings', 'retentionDays'], parseInt(e.target.value))}
                    fullWidth
                    InputProps={{ inputProps: { min: 7, max: 2555 } }}
                    helperText="How long to keep audit logs"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Audit Log Level</InputLabel>
                    <Select
                      value={settings.auditSettings?.logLevel || 'standard'}
                      onChange={(e) => updateSetting(['auditSettings', 'logLevel'], e.target.value)}
                    >
                      <MenuItem value="minimal">Minimal</MenuItem>
                      <MenuItem value="standard">Standard</MenuItem>
                      <MenuItem value="detailed">Detailed</MenuItem>
                      <MenuItem value="verbose">Verbose</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.auditSettings?.logSensitiveActions !== false}
                        onChange={(e) => updateSetting(['auditSettings', 'logSensitiveActions'], e.target.checked)}
                      />
                    }
                    label="Log sensitive actions (password changes, data deletion, etc.)"
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.auditSettings?.requireReasonForDeletion || false}
                        onChange={(e) => updateSetting(['auditSettings', 'requireReasonForDeletion'], e.target.checked)}
                      />
                    }
                    label="Require reason for data deletion"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* API Keys Management */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VpnKeyIcon />
                <Typography variant="h6">API Keys</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.apiKeys?.enabled || false}
                        onChange={(e) => setSettings({
                          ...settings,
                          apiKeys: {
                            ...settings.apiKeys,
                            enabled: e.target.checked
                          }
                        })}
                      />
                    }
                    label="Enable API Keys"
                  />
                  <FormHelperText>
                    Allow programmatic access to your organization's data via API keys
                  </FormHelperText>
                </Grid>

                {settings.apiKeys?.enabled && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Max Keys Per User"
                        type="number"
                        fullWidth
                        value={settings.apiKeys?.maxKeysPerUser || 5}
                        onChange={(e) => setSettings({
                          ...settings,
                          apiKeys: {
                            ...settings.apiKeys,
                            maxKeysPerUser: parseInt(e.target.value)
                          }
                        })}
                        InputProps={{
                          inputProps: { min: 1, max: 20 }
                        }}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Default Expiry (Days)"
                        type="number"
                        fullWidth
                        value={settings.apiKeys?.defaultExpiryDays || 90}
                        onChange={(e) => setSettings({
                          ...settings,
                          apiKeys: {
                            ...settings.apiKeys,
                            defaultExpiryDays: parseInt(e.target.value)
                          }
                        })}
                        InputProps={{
                          inputProps: { min: 1, max: 365 }
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.apiKeys?.requireExpiry || false}
                            onChange={(e) => setSettings({
                              ...settings,
                              apiKeys: {
                                ...settings.apiKeys,
                                requireExpiry: e.target.checked
                              }
                            })}
                          />
                        }
                        label="Require Expiry Date"
                      />
                      <FormHelperText>
                        Force all API keys to have an expiration date
                      </FormHelperText>
                    </Grid>

                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <ApiKeyManagement />
                    </Grid>
                  </>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Webhook Security */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShieldIcon />
                <Typography variant="h6">Webhook Security</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <WebhookSecurity />
            </AccordionDetails>
          </Accordion>

          {/* Last Updated Info */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Last updated: {new Date(settings.lastUpdatedAt).toLocaleString()} by {settings.lastUpdatedBy}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ ml: 2 }}>
              Version: {settings.version}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* IP Range Dialog */}
      <Dialog open={ipDialog} onClose={() => setIpDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add IP Range</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              label="IP Range (CIDR notation)"
              fullWidth
              value={newIpRange}
              onChange={(e) => setNewIpRange(e.target.value)}
              placeholder="e.g., 192.168.1.0/24"
              helperText="Enter IP address or range in CIDR notation"
            />
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Examples:
                <br />• Single IP: 192.168.1.100/32
                <br />• Subnet: 192.168.1.0/24
                <br />• All IPs: 0.0.0.0/0
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIpDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              addIpRange()
              setIpDialog(false)
            }}
            disabled={!newIpRange}
          >
            Add to {ipListType}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SSO Configuration Dialog */}
      <Dialog open={ssoDialog} onClose={() => setSsoDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Configure Single Sign-On</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ pt: 2 }}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.sso?.enabled || false}
                    onChange={(e) => updateSetting(['sso', 'enabled'], e.target.checked)}
                  />
                }
                label="Enable SSO"
              />
            </Grid>

            {settings.sso?.enabled && (
              <>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>SSO Provider</InputLabel>
                    <Select
                      value={settings.sso?.provider || ''}
                      onChange={(e) => updateSetting(['sso', 'provider'], e.target.value)}
                    >
                      <MenuItem value="oidc">OpenID Connect</MenuItem>
                      <MenuItem value="saml">SAML 2.0</MenuItem>
                      <MenuItem value="google">Google Workspace</MenuItem>
                      <MenuItem value="microsoft">Microsoft Azure AD</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Issuer URL"
                    fullWidth
                    value={settings.sso?.config?.issuerUrl || ''}
                    onChange={(e) => updateSetting(['sso', 'config', 'issuerUrl'], e.target.value)}
                    helperText="The URL of your identity provider"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Client ID"
                    fullWidth
                    value={settings.sso?.config?.clientId || ''}
                    onChange={(e) => updateSetting(['sso', 'config', 'clientId'], e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Client Secret"
                    type="password"
                    fullWidth
                    value={settings.sso?.config?.clientSecret || ''}
                    onChange={(e) => updateSetting(['sso', 'config', 'clientSecret'], e.target.value)}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Allowed Email Domains"
                    fullWidth
                    value={settings.sso?.config?.allowedDomains?.join(', ') || ''}
                    onChange={(e) => updateSetting(['sso', 'config', 'allowedDomains'], e.target.value.split(',').map(d => d.trim()).filter(Boolean))}
                    helperText="Comma-separated list of email domains that can use SSO"
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.sso?.enforceForNonAdmins || false}
                        onChange={(e) => updateSetting(['sso', 'enforceForNonAdmins'], e.target.checked)}
                      />
                    }
                    label="Enforce SSO for non-admin users"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSsoDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}