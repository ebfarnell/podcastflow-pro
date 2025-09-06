'use client'

import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Grid,
  Chip,
  Divider,
} from '@mui/material'
import {
  Send as SendIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { api } from '@/lib/api'

const emailTypes = [
  { value: 'userInvitation', label: 'User Invitation', description: 'Welcome email for new users' },
  { value: 'taskAssignment', label: 'Task Assignment', description: 'Notification for new task assignments' },
  { value: 'campaignStatusUpdate', label: 'Campaign Status Update', description: 'Campaign status change notification' },
  { value: 'reportReady', label: 'Report Ready', description: 'Generated report download notification' },
  { value: 'paymentReminder', label: 'Payment Reminder', description: 'Invoice payment due reminder' },
  { value: 'systemMaintenance', label: 'System Maintenance', description: 'Scheduled maintenance notification' },
]

export default function TestEmailPage() {
  const [selectedEmailType, setSelectedEmailType] = useState('userInvitation')
  const [recipient, setRecipient] = useState('')
  const [testData, setTestData] = useState({
    userName: 'Test User',
    userRole: 'client',
    organizationName: 'Test Organization',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSendTestEmail = async () => {
    if (!recipient.trim()) {
      setError('Please enter a recipient email address')
      return
    }

    if (!recipient.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await api.post('/test-email', {
        emailType: selectedEmailType,
        recipient: recipient.trim(),
        testData,
      })

      setResult(response.data)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to send test email')
      setResult(err.response?.data)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedEmail = emailTypes.find(e => e.value === selectedEmailType)

  return (
    <RouteProtection requiredPermission={PERMISSIONS.ADMIN_ACCESS}>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
            Email System Test
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Test the production email system with various notification types
          </Typography>
        </Box>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <EmailIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6">
                Send Test Email
              </Typography>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Email Type</InputLabel>
                  <Select
                    value={selectedEmailType}
                    label="Email Type"
                    onChange={(e) => setSelectedEmailType(e.target.value)}
                  >
                    {emailTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Recipient Email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  type="email"
                  helperText="Email address to send the test email to"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Selected Email Type: {selectedEmail?.label}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {selectedEmail?.description}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleSendTestEmail}
                  disabled={isLoading || !recipient.trim()}
                  startIcon={isLoading ? null : <SendIcon />}
                  sx={{ minWidth: 120 }}
                >
                  {isLoading ? 'Sending...' : 'Send Test Email'}
                </Button>
              </Grid>
            </Grid>

            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                <Typography variant="body2">{error}</Typography>
              </Alert>
            )}

            {result && (
              <Alert 
                severity={result.success ? 'success' : 'error'} 
                sx={{ mt: 3 }}
                icon={result.success ? <CheckCircleIcon /> : <ErrorIcon />}
              >
                <Typography variant="body2">
                  {result.success ? result.message : result.error}
                </Typography>
                
                {result.details && (
                  <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                    Details: {result.details}
                  </Typography>
                )}

                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`Provider: ${result.provider || 'Unknown'}`}
                    size="small"
                    color={result.provider === 'ses' ? 'success' : 'default'}
                  />
                  <Chip 
                    label={`Sandbox: ${result.sandboxMode ? 'Yes' : 'No'}`}
                    size="small"
                    color={result.sandboxMode ? 'warning' : 'success'}
                  />
                </Box>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Email System Configuration
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="textSecondary">
                  Email Provider
                </Typography>
                <Typography variant="body1">
                  {process.env.NEXT_PUBLIC_EMAIL_PROVIDER || 'AWS SES'}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="textSecondary">
                  From Address
                </Typography>
                <Typography variant="body1">
                  noreply@podcastflow.pro
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="textSecondary">
                  Reply To
                </Typography>
                <Typography variant="body1">
                  support@podcastflow.pro
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="textSecondary">
                  SES Region
                </Typography>
                <Typography variant="body1">
                  us-east-1
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Available Email Templates
            </Typography>
            
            <Grid container spacing={2}>
              {emailTypes.map((type) => (
                <Grid item xs={12} md={6} key={type.value}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        {type.label}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {type.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </DashboardLayout>
    </RouteProtection>
  )
}