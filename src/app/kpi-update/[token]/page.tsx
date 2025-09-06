'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  LinearProgress,
  CircularProgress,
  Grid,
  Chip,
  Divider,
  Paper,
} from '@mui/material'
import {
  CheckCircle,
  Error as ErrorIcon,
  TrendingUp,
  Save as SaveIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'

interface KPIUpdateData {
  campaignKPI: {
    id: string
    kpiType: string
    goalCPA?: number
    conversionValue?: number
    targetVisits?: number
    targetConversions?: number
    actualVisits: number
    actualConversions: number
    campaign: {
      id: string
      name: string
      advertiser?: {
        name: string
      }
    }
  }
  token: {
    clientEmail: string
    clientName?: string
    expiresAt: string
  }
}

export default function KPIUpdatePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [data, setData] = useState<KPIUpdateData | null>(null)
  
  const [formData, setFormData] = useState({
    actualVisits: 0,
    actualConversions: 0,
  })

  // Validate token and fetch KPI data
  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/kpi-update/${token}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          setError(errorData.error || 'Invalid or expired token')
          setLoading(false)
          return
        }

        const kpiData = await response.json()
        setData(kpiData)
        setFormData({
          actualVisits: kpiData.campaignKPI.actualVisits || 0,
          actualConversions: kpiData.campaignKPI.actualConversions || 0,
        })
        setLoading(false)
      } catch (err) {
        setError('Failed to load KPI data. Please try again.')
        setLoading(false)
      }
    }

    validateToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/kpi-update/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update KPIs')
      }

      setSuccess(true)
      setLoading(false)

      // Redirect to success page after 3 seconds
      setTimeout(() => {
        router.push('/kpi-update/success')
      }, 3000)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (loading && !data) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error && !data) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 8 }}>
        <Container maxWidth="sm">
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Access Denied
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                {error}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                If you believe this is an error, please contact your account manager.
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>
    )
  }

  if (success) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 8 }}>
        <Container maxWidth="sm">
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                KPIs Updated Successfully!
              </Typography>
              <Typography color="text.secondary">
                Thank you for updating your campaign metrics. Your account manager will be notified.
              </Typography>
              <LinearProgress sx={{ mt: 3 }} />
            </CardContent>
          </Card>
        </Container>
      </Box>
    )
  }

  if (!data) return null

  const { campaignKPI, token: tokenData } = data
  const isExpired = new Date(tokenData.expiresAt) < new Date()

  if (isExpired) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 8 }}>
        <Container maxWidth="sm">
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <ErrorIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Link Expired
              </Typography>
              <Typography color="text.secondary">
                This update link has expired. Please contact your account manager for a new link.
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>
    )
  }

  const showVisits = campaignKPI.kpiType === 'unique_web_visits' || campaignKPI.kpiType === 'both'
  const showConversions = campaignKPI.kpiType === 'conversions' || campaignKPI.kpiType === 'both'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Campaign KPI Update
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Please provide the latest performance metrics for your campaign
          </Typography>
        </Box>

        {/* Campaign Info Card */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingUp sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Campaign Details</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Campaign Name</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {campaignKPI.campaign.name}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Advertiser</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {campaignKPI.campaign.advertiser?.name || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">KPI Type</Typography>
                <Chip 
                  label={
                    campaignKPI.kpiType === 'both' ? 'Visits + Conversions' :
                    campaignKPI.kpiType === 'unique_web_visits' ? 'Unique Web Visits' :
                    'Conversions'
                  }
                  color="primary"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Goal CPA</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  ${campaignKPI.goalCPA?.toFixed(2) || 'Not set'}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* KPI Update Form */}
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>Update Performance Metrics</Typography>
            
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                {showVisits && (
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'medium' }}>
                        Unique Web Visits
                      </Typography>
                      <TextField
                        fullWidth
                        type="number"
                        label="Actual Visits"
                        value={formData.actualVisits}
                        onChange={(e) => setFormData({
                          ...formData,
                          actualVisits: parseInt(e.target.value) || 0
                        })}
                        inputProps={{ min: 0 }}
                        required={showVisits}
                      />
                      {campaignKPI.targetVisits && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Target: {campaignKPI.targetVisits.toLocaleString()} visits
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                )}

                {showConversions && (
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'medium' }}>
                        Conversions
                      </Typography>
                      <TextField
                        fullWidth
                        type="number"
                        label="Actual Conversions"
                        value={formData.actualConversions}
                        onChange={(e) => setFormData({
                          ...formData,
                          actualConversions: parseInt(e.target.value) || 0
                        })}
                        inputProps={{ min: 0 }}
                        required={showConversions}
                      />
                      {campaignKPI.targetConversions && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Target: {campaignKPI.targetConversions.toLocaleString()} conversions
                        </Typography>
                      )}
                      {campaignKPI.conversionValue && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Value per conversion: ${campaignKPI.conversionValue.toFixed(2)}
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                )}
              </Grid>

              {error && (
                <Alert severity="error" sx={{ mt: 3 }}>
                  {error}
                </Alert>
              )}

              <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  startIcon={<SaveIcon />}
                  disabled={loading}
                  sx={{ minWidth: 200 }}
                >
                  {loading ? 'Updating...' : 'Update KPIs'}
                </Button>
              </Box>
            </form>

            <Divider sx={{ my: 4 }} />

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                This update is being submitted by: {tokenData.clientEmail}
                <br />
                Link expires on: {format(new Date(tokenData.expiresAt), 'MMM d, yyyy')}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}