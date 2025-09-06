'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  InputAdornment,
  Box,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  FormHelperText,
  Tooltip,
  Divider,
} from '@mui/material'
import {
  AttachMoney,
  Percent,
  Upload,
  Save,
  Description,
  TrendingUp,
  Calculate,
  Info,
} from '@mui/icons-material'
import { api } from '@/services/api'
import { MonetizationPanel } from './MonetizationPanel'
import { useAuth } from '@/contexts/AuthContext'

interface Show {
  id: string
  name: string
  selloutProjection?: number
  estimatedEpisodeValue?: number
  revenueSharingType?: string
  revenueSharingPercentage?: number
  revenueSharingFixedAmount?: number
  revenueSharingNotes?: string
  talentContractUrl?: string
  // Monetization fields
  pricingModel?: string
  preRollSlots?: number
  midRollSlots?: number
  postRollSlots?: number
  preRollCpm?: number
  midRollCpm?: number
  postRollCpm?: number
  preRollSpotCost?: number
  midRollSpotCost?: number
  postRollSpotCost?: number
  avgEpisodeDownloads?: number
}

interface RevenueProjectionFormProps {
  show: Show
  onUpdate?: () => void
}

export function RevenueProjectionForm({ show, onUpdate }: RevenueProjectionFormProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'master'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showData, setShowData] = useState<Show>(show)
  const [metricsDownloads, setMetricsDownloads] = useState<number | null>(null)
  const [youtubeViews, setYoutubeViews] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    revenueSharingType: show.revenueSharingType || 'percentage',
    revenueSharingPercentage: show.revenueSharingPercentage ?? 0,
    revenueSharingFixedAmount: show.revenueSharingFixedAmount ?? 0,
    revenueSharingNotes: show.revenueSharingNotes || '',
  })

  // Fetch full show data including monetization fields
  useEffect(() => {
    const fetchShowData = async () => {
      try {
        // Fetch show data
        const response = await api.get(`/shows/${show.id}`)
        let fullShowData = response.data || response
        
        // Also fetch metrics to get actual avgEpisodeDownloads and YouTube views
        try {
          const metricsResponse = await api.get(`/shows/${show.id}/metrics`)
          console.log('Metrics response:', metricsResponse.data)
          
          // Set Megaphone downloads
          if (metricsResponse.data?.avgEpisodeDownloads) {
            setMetricsDownloads(metricsResponse.data.avgEpisodeDownloads)
          }
          
          // Set YouTube views
          if (metricsResponse.data?.avgYoutubeViews) {
            setYoutubeViews(metricsResponse.data.avgYoutubeViews)
          }
          
          // Update show data with combined metrics
          const combinedReach = (metricsResponse.data?.avgEpisodeDownloads || 0) + 
                                (metricsResponse.data?.avgYoutubeViews || 0)
          if (combinedReach > 0) {
            fullShowData = {
              ...fullShowData,
              avgEpisodeDownloads: combinedReach
            }
          }
        } catch (metricsError) {
          console.log('Metrics not available, using default downloads')
        }
        
        setShowData(fullShowData)
      } catch (error) {
        console.error('Error fetching show data:', error)
      }
    }
    
    fetchShowData()
  }, [show.id])

  // Handle monetization update
  const handleMonetizationUpdate = (updatedData: any) => {
    setShowData(prev => ({
      ...prev,
      ...updatedData
    }))
    if (onUpdate) {
      onUpdate()
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      await api.put(`/shows/${show.id}/revenue-projection`, formData)
      setSuccess(true)
      if (onUpdate) {
        onUpdate()
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update revenue projection')
    } finally {
      setLoading(false)
    }
  }

  const calculateEstimatedRevenue = () => {
    const selloutRate = (showData.selloutProjection || 100) / 100
    return (showData.estimatedEpisodeValue || 0) * selloutRate
  }

  const calculateTalentShare = () => {
    const revenue = calculateEstimatedRevenue()
    if (formData.revenueSharingType === 'percentage') {
      return revenue * (formData.revenueSharingPercentage / 100)
    } else if (formData.revenueSharingType === 'fixed') {
      return formData.revenueSharingFixedAmount
    }
    return 0
  }

  const calculateOrganizationProfit = () => {
    return calculateEstimatedRevenue() - calculateTalentShare()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Monetization Panel */}
      <MonetizationPanel
        showId={show.id}
        monetizationData={{
          pricingModel: showData.pricingModel,
          preRollCpm: showData.preRollCpm,
          preRollSpotCost: showData.preRollSpotCost,
          midRollCpm: showData.midRollCpm,
          midRollSpotCost: showData.midRollSpotCost,
          postRollCpm: showData.postRollCpm,
          postRollSpotCost: showData.postRollSpotCost,
          preRollSlots: showData.preRollSlots,
          midRollSlots: showData.midRollSlots,
          postRollSlots: showData.postRollSlots,
          avgEpisodeDownloads: showData.avgEpisodeDownloads,
          selloutProjection: showData.selloutProjection,
          estimatedEpisodeValue: showData.estimatedEpisodeValue,
        }}
        metricsDownloads={metricsDownloads}
        youtubeViews={youtubeViews}
        onUpdate={handleMonetizationUpdate}
        readOnly={!isAdmin}
      />

      {/* Revenue Sharing Card */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Revenue Projections & Profit Sharing
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
              Revenue projections updated successfully!
            </Alert>
          )}

          <Grid container spacing={3}>

          {/* Revenue Sharing */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Revenue Sharing Agreement
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Sharing Type</InputLabel>
              <Select
                value={formData.revenueSharingType}
                onChange={(e) => setFormData({ ...formData, revenueSharingType: e.target.value })}
                label="Sharing Type"
              >
                <MenuItem value="percentage">Percentage</MenuItem>
                <MenuItem value="fixed">Fixed Amount</MenuItem>
                <MenuItem value="tiered">Tiered</MenuItem>
                <MenuItem value="none">None</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {formData.revenueSharingType === 'percentage' && (
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Talent Share"
                type="number"
                value={formData.revenueSharingPercentage}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setFormData({ ...formData, revenueSharingPercentage: 0 });
                  } else {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      setFormData({ ...formData, revenueSharingPercentage: numValue });
                    }
                  }
                }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{ min: 0, max: 100, step: 5 }}
              />
            </Grid>
          )}

          {formData.revenueSharingType === 'fixed' && (
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Fixed Amount"
                type="number"
                value={formData.revenueSharingFixedAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setFormData({ ...formData, revenueSharingFixedAmount: 0 });
                  } else {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      setFormData({ ...formData, revenueSharingFixedAmount: numValue });
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
                inputProps={{ min: 0, step: 100 }}
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Revenue Sharing Notes"
              value={formData.revenueSharingNotes}
              onChange={(e) => setFormData({ ...formData, revenueSharingNotes: e.target.value })}
              placeholder="Additional notes about the revenue sharing agreement..."
            />
          </Grid>

          {/* Projections Display */}
          <Grid item xs={12}>
            <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1, mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Projected Earnings (Per Episode)
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">
                    Estimated Revenue
                  </Typography>
                  <Typography variant="h6">
                    ${calculateEstimatedRevenue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">
                    Talent Share
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    ${calculateTalentShare().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">
                    Organization Profit
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    ${calculateOrganizationProfit().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Contract Upload */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Upload />}
                component="label"
              >
                Upload Talent Contract
                <input type="file" hidden accept=".pdf,.doc,.docx" />
              </Button>
              {show.talentContractUrl && (
                <Chip
                  icon={<Description />}
                  label="Contract Uploaded"
                  color="success"
                  size="small"
                />
              )}
            </Box>
            <FormHelperText>
              Upload the talent contract for reference (PDF or Word format)
            </FormHelperText>
          </Grid>

          {/* Save Button */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Save Revenue Projections'}
              </Button>
            </Box>
          </Grid>
        </Grid>
        </CardContent>
      </Card>
    </Box>
  )
}