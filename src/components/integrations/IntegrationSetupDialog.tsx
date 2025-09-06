import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Link,
  CircularProgress,
} from '@mui/material'
import { integrationApi } from '@/services/api'

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
  logo: string
}

interface IntegrationSetupDialogProps {
  open: boolean
  onClose: () => void
  integration: Integration | null
  onSuccess?: (integration: Integration) => void
}

const setupSteps = ['Authenticate', 'Configure', 'Test Connection']

export function IntegrationSetupDialog({
  open,
  onClose,
  integration,
  onSuccess,
}: IntegrationSetupDialogProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [syncFrequency, setSyncFrequency] = useState('daily')
  const [quotaLimit, setQuotaLimit] = useState(10000)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  if (!integration) return null

  const handleNext = async () => {
    if (activeStep === setupSteps.length - 1) {
      // Final step - save and close
      try {
        // Connect the integration with real API
        const response = await integrationApi.connect(integration!.platform, {
          apiKey,
          apiSecret,
          webhookUrl,
          syncFrequency,
          quotaLimit,
          useOAuth: false
        })
        
        // Check if we need to redirect for OAuth
        if (response.redirectUrl && typeof window !== 'undefined') {
          window.location.href = response.redirectUrl
          return
        }
        
        if (onSuccess) {
          onSuccess({ ...integration!, status: 'connected', syncFrequency })
        }
        // Refresh the page to show updated connection status
        window.location.reload()
        onClose()
      } catch (error) {
        console.error('Connection error:', error)
        setTestResult('error')
      }
    } else {
      setActiveStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    
    try {
      // Test connection with real API
      const testData = {
        apiKey,
        apiSecret,
        webhookUrl
      }
      
      // Use a test endpoint if available, otherwise use connect
      await integrationApi.connect(integration!.platform, testData)
      setTestResult('success')
    } catch (error) {
      console.error('Connection test failed:', error)
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Authenticate
        return (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              To connect {integration.name}, you'll need API credentials from your {integration.name} account.
              <Link href="#" sx={{ ml: 1 }}>
                Learn how to get your API credentials
              </Link>
            </Alert>

            {integration.platform === 'hubspot' && (
              <>
                <TextField
                  label="API Key"
                  fullWidth
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  margin="normal"
                  type="password"
                  helperText="Found in Settings > Integrations > API Key"
                />
              </>
            )}

            {integration.platform === 'stripe' && (
              <>
                <TextField
                  label="Publishable Key"
                  fullWidth
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  margin="normal"
                  helperText="Starts with pk_"
                />
                <TextField
                  label="Secret Key"
                  fullWidth
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  margin="normal"
                  type="password"
                  helperText="Starts with sk_"
                />
              </>
            )}

            {(integration.platform === 'slack' || integration.platform === 'google') && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  {integration.name} uses OAuth for authentication.
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => {
                    // Open OAuth flow
                    window.open(`/api/oauth/${integration.platform}`, '_blank')
                  }}
                >
                  Connect with {integration.name}
                </Button>
              </Box>
            )}

            {integration.platform === 'youtube' && (
              <>
                <Alert severity="info" sx={{ mb: 3 }}>
                  YouTube integration supports both public data (API key) and private data (OAuth) access.
                </Alert>
                <TextField
                  label="YouTube Data API Key"
                  fullWidth
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  margin="normal"
                  type="password"
                  helperText="For public data access. Get from Google Cloud Console"
                />
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    For private data (analytics, channel management), OAuth is required.
                  </Typography>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{ mt: 1 }}
                    onClick={() => {
                      window.open('/api/youtube/auth/connect', '_blank')
                    }}
                  >
                    Connect YouTube Channel (OAuth)
                  </Button>
                </Box>
              </>
            )}
          </Box>
        )

      case 1: // Configure
        return (
          <Box>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Configure how PodcastFlow Pro syncs with {integration.name}
            </Typography>

            <TextField
              label="Sync Frequency"
              select
              fullWidth
              margin="normal"
              value={syncFrequency}
              onChange={(e) => setSyncFrequency(e.target.value)}
              SelectProps={{ native: true }}
            >
              {integration.platform === 'youtube' ? (
                <>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </>
              ) : (
                <>
                  <option value="realtime">Real-time</option>
                  <option value="5min">Every 5 minutes</option>
                  <option value="15min">Every 15 minutes</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </>
              )}
            </TextField>

            {(integration.platform === 'hubspot' || integration.platform === 'salesforce') && (
              <>
                <TextField
                  label="Default Pipeline"
                  select
                  fullWidth
                  margin="normal"
                  SelectProps={{ native: true }}
                >
                  <option value="">Select a pipeline</option>
                  <option value="sales">Sales Pipeline</option>
                  <option value="marketing">Marketing Pipeline</option>
                  <option value="podcast">Podcast Advertising</option>
                </TextField>

                <TextField
                  label="Field Mapping"
                  select
                  fullWidth
                  margin="normal"
                  SelectProps={{ native: true }}
                >
                  <option value="auto">Automatic</option>
                  <option value="custom">Custom Mapping</option>
                </TextField>
              </>
            )}

            {integration.platform === 'stripe' && (
              <TextField
                label="Webhook Endpoint (Optional)"
                fullWidth
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                margin="normal"
                helperText="For real-time payment updates"
              />
            )}

            {integration.platform === 'youtube' && (
              <>
                <TextField
                  label="Default Quota Limit"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={quotaLimit}
                  onChange={(e) => setQuotaLimit(Number(e.target.value))}
                  helperText="Daily API quota limit"
                />
                <TextField
                  label="Data Sync Options"
                  select
                  fullWidth
                  margin="normal"
                  defaultValue="videos"
                  SelectProps={{ native: true }}
                >
                  <option value="videos">Videos Only</option>
                  <option value="videos_analytics">Videos + Analytics</option>
                  <option value="all">All Data (Videos, Analytics, Comments)</option>
                </TextField>
              </>
            )}

            <Alert severity="warning" sx={{ mt: 2 }}>
              Changes to sync settings will take effect on the next sync cycle.
            </Alert>
          </Box>
        )

      case 2: // Test Connection
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            {!testResult && !testing && (
              <>
                <Typography variant="body1" gutterBottom>
                  Ready to test your {integration.name} connection?
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleTestConnection}
                  sx={{ mt: 2 }}
                >
                  Test Connection
                </Button>
              </>
            )}

            {testing && (
              <>
                <Typography variant="body1" gutterBottom>
                  Testing connection to {integration.name}...
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <CircularProgress size={40} />
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                    This may take a few seconds
                  </Typography>
                </Box>
              </>
            )}

            {testResult === 'success' && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Connection successful! {integration.name} is ready to use.
              </Alert>
            )}

            {testResult === 'error' && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Connection failed. Please check your credentials and try again.
              </Alert>
            )}
          </Box>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h2" sx={{ fontSize: 32 }}>
            {integration.logo}
          </Typography>
          <Typography variant="h6">
            Connect {integration.name}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {setupSteps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleBack} disabled={activeStep === 0}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={
            (activeStep === 0 && !apiKey) ||
            (activeStep === setupSteps.length - 1 && testResult !== 'success')
          }
        >
          {activeStep === setupSteps.length - 1 ? 'Finish' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}