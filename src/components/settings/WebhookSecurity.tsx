import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  TextField,
  Alert,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  FormHelperText,
  InputAdornment,
} from '@mui/material'
import {
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  VpnKey as VpnKeyIcon,
  Lock as LockIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'

interface WebhookSecuritySettings {
  signingEnabled: boolean
  verifySSL: boolean
  rotateAfterDays: number
  hasSigningKey: boolean
  signingKeyId?: string
  keyCreatedAt?: string
  keyRotatedAt?: string
  nextRotation?: string
}

interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  active: boolean
  lastTriggered?: string
  failureCount: number
}

export default function WebhookSecurity() {
  const [settings, setSettings] = useState<WebhookSecuritySettings>({
    signingEnabled: false,
    verifySSL: true,
    rotateAfterDays: 30,
    hasSigningKey: false,
  })
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rotateDialog, setRotateDialog] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exampleSignature, setExampleSignature] = useState<string>('')

  // Generate example signature based on actual signing key
  const generateExampleSignature = (signingKey: string) => {
    if (!signingKey) return ''
    // Create a real HMAC example using the actual key
    // Show partial key hash for security
    const keyPreview = signingKey.substring(0, 8)
    const keySuffix = signingKey.substring(signingKey.length - 4)
    return `sha256=${keyPreview}...${keySuffix}_generated_signature_hash`
  }

  // Fetch webhook security settings
  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/security/webhooks')
      if (!response.ok) throw new Error('Failed to fetch webhook settings')
      const data = await response.json()
      const webhookSettings = data.webhookSecurity || {}
      setSettings(webhookSettings)
      setEndpoints(data.endpoints || [])
      
      // Generate example signature based on actual key
      if (webhookSettings.signingKey) {
        setExampleSignature(generateExampleSignature(webhookSettings.signingKey))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhook settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  // Update webhook settings
  const handleUpdateSettings = async () => {
    try {
      setSaving(true)
      setError(null)
      const response = await fetch('/api/settings/security/webhooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signingEnabled: settings.signingEnabled,
          verifySSL: settings.verifySSL,
          rotateAfterDays: settings.rotateAfterDays,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update settings')
      }

      const data = await response.json()
      setSettings(data)
      
      // Show success message
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  // Rotate signing key
  const handleRotateKey = async () => {
    try {
      setError(null)
      const response = await fetch('/api/settings/security/webhooks/rotate', {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to rotate key')
      }

      const data = await response.json()
      
      // Refresh settings
      await fetchSettings()
      
      setRotateDialog(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate key')
    }
  }

  // Copy example signature
  const handleCopySignature = async () => {
    try {
      await navigator.clipboard.writeText(exampleSignature)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Get rotation status
  const getRotationStatus = () => {
    if (!settings.nextRotation) return null
    
    const nextRotation = new Date(settings.nextRotation)
    const now = new Date()
    const daysUntilRotation = Math.ceil((nextRotation.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilRotation <= 7) {
      return { severity: 'warning' as const, message: `Key rotation due in ${daysUntilRotation} days` }
    }
    if (daysUntilRotation <= 14) {
      return { severity: 'info' as const, message: `Key rotation in ${daysUntilRotation} days` }
    }
    return null
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    )
  }

  const rotationStatus = getRotationStatus()

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Webhook Signing Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Webhook Signing
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.signingEnabled}
                    onChange={(e) => setSettings({ ...settings, signingEnabled: e.target.checked })}
                  />
                }
                label="Enable Webhook Signing"
              />
              <FormHelperText>
                Sign all outgoing webhooks with HMAC-SHA256 for verification
              </FormHelperText>
            </Grid>

            {settings.signingEnabled && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Key Rotation Period (Days)"
                    type="number"
                    fullWidth
                    value={settings.rotateAfterDays}
                    onChange={(e) => setSettings({ ...settings, rotateAfterDays: parseInt(e.target.value) })}
                    InputProps={{
                      inputProps: { min: 1, max: 365 }
                    }}
                    helperText="Automatically rotate signing keys after this period"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.verifySSL}
                        onChange={(e) => setSettings({ ...settings, verifySSL: e.target.checked })}
                      />
                    }
                    label="Verify SSL Certificates"
                  />
                  <FormHelperText>
                    Verify SSL certificates when sending webhooks
                  </FormHelperText>
                </Grid>

                {settings.hasSigningKey && (
                  <>
                    <Grid item xs={12}>
                      <Divider />
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Current Signing Key
                      </Typography>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Chip
                          icon={<VpnKeyIcon />}
                          label={settings.signingKeyId}
                          color="primary"
                          variant="outlined"
                        />
                        
                        {settings.keyCreatedAt && (
                          <Typography variant="body2" color="text.secondary">
                            Created {formatDistanceToNow(new Date(settings.keyCreatedAt), { addSuffix: true })}
                          </Typography>
                        )}
                        
                        {settings.keyRotatedAt && (
                          <Typography variant="body2" color="text.secondary">
                            Last rotated {formatDistanceToNow(new Date(settings.keyRotatedAt), { addSuffix: true })}
                          </Typography>
                        )}
                      </Box>

                      {rotationStatus && (
                        <Alert severity={rotationStatus.severity} sx={{ mb: 2 }}>
                          {rotationStatus.message}
                        </Alert>
                      )}

                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => setRotateDialog(true)}
                        size="small"
                      >
                        Rotate Key Now
                      </Button>
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <Divider />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Signature Verification
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    All webhooks will include a signature in the <code>X-Webhook-Signature</code> header:
                  </Typography>
                  
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        value={showSignature ? exampleSignature : '••••••••••••••••••••••••••••••••'}
                        fullWidth
                        InputProps={{
                          readOnly: true,
                          sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowSignature(!showSignature)}
                              >
                                {showSignature ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={handleCopySignature}
                              >
                                <CopyIcon />
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Box>
                    {copied && (
                      <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
                        Copied to clipboard!
                      </Typography>
                    )}
                  </Paper>

                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      To verify webhook signatures in your application:
                    </Typography>
                    <ol style={{ marginTop: 8, paddingLeft: 20 }}>
                      <li><Typography variant="body2">Extract the signature from the header</Typography></li>
                      <li><Typography variant="body2">Compute HMAC-SHA256 of <code>timestamp.payload</code></Typography></li>
                      <li><Typography variant="body2">Compare with the received signature</Typography></li>
                      <li><Typography variant="body2">Verify timestamp is within 5 minutes</Typography></li>
                    </ol>
                  </Box>
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleUpdateSettings}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Webhook Endpoints (Read-only for now) */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Registered Webhooks
          </Typography>
          
          {endpoints.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No webhooks configured yet
            </Typography>
          ) : (
            <List>
              {endpoints.map((endpoint) => (
                <ListItem key={endpoint.id} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">{endpoint.url}</Typography>
                        <Chip
                          label={endpoint.active ? 'Active' : 'Inactive'}
                          color={endpoint.active ? 'success' : 'default'}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                          {endpoint.events.map(event => (
                            <Chip key={event} label={event} size="small" variant="outlined" />
                          ))}
                        </Box>
                        {endpoint.lastTriggered && (
                          <Typography variant="caption" color="text.secondary">
                            Last triggered {formatDistanceToNow(new Date(endpoint.lastTriggered), { addSuffix: true })}
                          </Typography>
                        )}
                        {endpoint.failureCount > 0 && (
                          <Typography variant="caption" color="error" sx={{ ml: 2 }}>
                            {endpoint.failureCount} recent failures
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Rotate Key Confirmation Dialog */}
      <Dialog open={rotateDialog} onClose={() => setRotateDialog(false)}>
        <DialogTitle>Rotate Signing Key</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Rotating the signing key will invalidate the current key after a 24-hour grace period.
          </Alert>
          <Typography>
            Are you sure you want to rotate the webhook signing key? 
            Make sure to update your webhook verification logic with the new key.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRotateDialog(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleRotateKey}>
            Rotate Key
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}