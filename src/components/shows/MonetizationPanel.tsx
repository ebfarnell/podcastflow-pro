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
  Grid,
  InputAdornment,
  Box,
  Divider,
  Button,
  Alert,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@mui/material'
import { AttachMoney, Save, InfoOutlined, Calculate, Refresh } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'

interface MetricsBreakdown {
  avgYoutubeViews?: number
  avgMegaphoneDownloads?: number
  episodeCount?: number
  dateRange?: string
  calculationNote?: string
}

interface MonetizationData {
  pricingModel?: 'cpm' | 'spot' | 'both'
  preRollCpm?: number
  preRollSpotCost?: number
  midRollCpm?: number
  midRollSpotCost?: number
  postRollCpm?: number
  postRollSpotCost?: number
  preRollSlots?: number
  midRollSlots?: number
  postRollSlots?: number
  avgEpisodeDownloads?: number
  selloutProjection?: number
  estimatedEpisodeValue?: number
  metricsBreakdown?: MetricsBreakdown
}

interface MonetizationPanelProps {
  showId: string
  monetizationData: MonetizationData
  metricsDownloads?: number | null
  youtubeViews?: number | null
  onUpdate?: (data: MonetizationData) => void
  readOnly?: boolean
}

export function MonetizationPanel({ 
  showId, 
  monetizationData, 
  metricsDownloads,
  youtubeViews,
  onUpdate,
  readOnly = false 
}: MonetizationPanelProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'master'
  
  const [formData, setFormData] = useState<MonetizationData>(monetizationData)
  const [localInputs, setLocalInputs] = useState({
    preRollCpm: monetizationData.preRollCpm?.toString() || '',
    preRollSpotCost: monetizationData.preRollSpotCost?.toString() || '',
    preRollSlots: monetizationData.preRollSlots?.toString() || '',
    midRollCpm: monetizationData.midRollCpm?.toString() || '',
    midRollSpotCost: monetizationData.midRollSpotCost?.toString() || '',
    midRollSlots: monetizationData.midRollSlots?.toString() || '',
    postRollCpm: monetizationData.postRollCpm?.toString() || '',
    postRollSpotCost: monetizationData.postRollSpotCost?.toString() || '',
    postRollSlots: monetizationData.postRollSlots?.toString() || '',
    avgEpisodeDownloads: monetizationData.avgEpisodeDownloads ? monetizationData.avgEpisodeDownloads.toLocaleString() : '',
    selloutProjection: monetizationData.selloutProjection?.toString() || '',
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [recalculateSuccess, setRecalculateSuccess] = useState('')

  useEffect(() => {
    setFormData(monetizationData)
    setLocalInputs({
      preRollCpm: monetizationData.preRollCpm?.toString() || '',
      preRollSpotCost: monetizationData.preRollSpotCost?.toString() || '',
      preRollSlots: monetizationData.preRollSlots?.toString() || '',
      midRollCpm: monetizationData.midRollCpm?.toString() || '',
      midRollSpotCost: monetizationData.midRollSpotCost?.toString() || '',
      midRollSlots: monetizationData.midRollSlots?.toString() || '',
      postRollCpm: monetizationData.postRollCpm?.toString() || '',
      postRollSpotCost: monetizationData.postRollSpotCost?.toString() || '',
      postRollSlots: monetizationData.postRollSlots?.toString() || '',
      avgEpisodeDownloads: monetizationData.avgEpisodeDownloads ? monetizationData.avgEpisodeDownloads.toLocaleString() : '',
      selloutProjection: monetizationData.selloutProjection?.toString() || '',
    })
  }, [monetizationData])

  const handleMonetizationInput = (
    localKey: keyof typeof localInputs,
    dataKey: keyof MonetizationData,
    value: string,
    isInteger = false
  ) => {
    setLocalInputs(prev => ({ ...prev, [localKey]: value }))
    
    if (value === '') {
      // For slots, set to 0 instead of undefined so it saves properly
      if (localKey.includes('Slots')) {
        setFormData(prev => ({ ...prev, [dataKey]: 0 }))
      } else {
        setFormData(prev => ({ ...prev, [dataKey]: undefined }))
      }
    } else {
      const parsedValue = isInteger ? parseInt(value) : parseFloat(value)
      if (!isNaN(parsedValue)) {
        setFormData(prev => ({ ...prev, [dataKey]: parsedValue }))
      }
    }
  }

  const handleFormattedNumberInput = (
    localKey: keyof typeof localInputs,
    dataKey: keyof MonetizationData,
    value: string
  ) => {
    // Remove commas for processing
    const cleanValue = value.replace(/,/g, '')
    
    // Update local input with formatted value
    if (cleanValue === '') {
      setLocalInputs(prev => ({ ...prev, [localKey]: '' }))
      setFormData(prev => ({ ...prev, [dataKey]: undefined }))
    } else {
      const parsedValue = parseInt(cleanValue)
      if (!isNaN(parsedValue)) {
        // Store the raw number in formData
        setFormData(prev => ({ ...prev, [dataKey]: parsedValue }))
        // Store formatted version in localInputs for display
        setLocalInputs(prev => ({ ...prev, [localKey]: parsedValue.toLocaleString() }))
      } else {
        // Keep the current input value if it's not a valid number
        setLocalInputs(prev => ({ ...prev, [localKey]: value }))
      }
    }
  }

  const handleRecalculateAverage = async () => {
    setRecalculating(true)
    setError('')
    
    try {
      // Fetch fresh monetization data which includes the calculated average
      const response = await fetch(`/api/shows/${showId}/monetization`)
      if (!response.ok) throw new Error('Failed to fetch calculated average')
      
      const data = await response.json()
      
      // Update both the form data and local inputs with the calculated average
      const calculatedAvg = data.avgEpisodeDownloads || 0
      
      setFormData(prev => ({ ...prev, avgEpisodeDownloads: calculatedAvg }))
      setLocalInputs(prev => ({ ...prev, avgEpisodeDownloads: calculatedAvg.toLocaleString() }))
      
      // Show success message with the new value
      setRecalculateSuccess(`Average updated to ${calculatedAvg.toLocaleString()} from last 3 months!`)
      setTimeout(() => setRecalculateSuccess(''), 5000)
      
    } catch (err) {
      console.error('Failed to recalculate average:', err)
      setError('Failed to recalculate average')
    } finally {
      setRecalculating(false)
    }
  }

  const calculateCpmRevenue = (cpm: number, slots: number, downloads: number) => {
    if (!cpm || !slots || !downloads) return 0
    const impressions = downloads * slots
    const revenue = (impressions / 1000) * cpm
    return revenue
  }

  const calculateTotalEpisodeRevenue = () => {
    // Combine YouTube views and Megaphone downloads for total reach
    const combinedReach = (metricsDownloads || 0) + (youtubeViews || 0)
    const downloads = formData.avgEpisodeDownloads || combinedReach || 0
    let total = 0

    if (formData.pricingModel === 'spot' || formData.pricingModel === 'both') {
      total += ((formData.preRollSpotCost || 0) * (formData.preRollSlots || 0))
      total += ((formData.midRollSpotCost || 0) * (formData.midRollSlots || 0))
      total += ((formData.postRollSpotCost || 0) * (formData.postRollSlots || 0))
    }

    if (formData.pricingModel === 'cpm' || formData.pricingModel === 'both') {
      total += calculateCpmRevenue(formData.preRollCpm || 0, formData.preRollSlots || 0, downloads)
      total += calculateCpmRevenue(formData.midRollCpm || 0, formData.midRollSlots || 0, downloads)
      total += calculateCpmRevenue(formData.postRollCpm || 0, formData.postRollSlots || 0, downloads)
    }

    return total
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Calculate estimated episode value from current settings
      const estimatedValue = calculateTotalEpisodeRevenue()
      const dataToSave = {
        ...formData,
        estimatedEpisodeValue: estimatedValue
      }

      const response = await fetch(`/api/shows/${showId}/monetization`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save monetization settings')
      }

      setSuccess(true)
      if (onUpdate) {
        onUpdate(dataToSave)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save monetization settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
          Monetization Settings
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
            Monetization settings saved successfully!
          </Alert>
        )}
        
        {recalculateSuccess && (
          <Alert severity="info" sx={{ mb: 2 }} onClose={() => setRecalculateSuccess('')}>
            {recalculateSuccess}
          </Alert>
        )}
        
        <Grid container spacing={2}>
          {/* Pricing Model Selection */}
          <Grid item xs={12}>
            <FormControl fullWidth disabled={readOnly}>
              <InputLabel>Pricing Model</InputLabel>
              <Select
                value={formData.pricingModel || 'cpm'}
                label="Pricing Model"
                onChange={(e) => setFormData(prev => ({ ...prev, pricingModel: e.target.value as 'cpm' | 'spot' | 'both' }))}
              >
                <MenuItem value="cpm">CPM (Cost Per Thousand Impressions)</MenuItem>
                <MenuItem value="spot">Cost Per Spot</MenuItem>
                <MenuItem value="both">Both CPM and Cost Per Spot</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Admin-only fields */}
          {isAdmin && (
            <>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Sellout Projection"
                  type="number"
                  value={localInputs.selloutProjection}
                  onChange={(e) => handleMonetizationInput('selloutProjection', 'selloutProjection', e.target.value)}
                  disabled={readOnly}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText="Expected sellout rate for inventory"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Avg Episode Downloads/Views
                      <Tooltip 
                        title={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                              How this is calculated:
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              Average of YouTube views + Megaphone downloads from the last 3 months of published episodes.
                            </Typography>
                            {monetizationData.metricsBreakdown && (
                              <>
                                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
                                <Typography variant="body2">
                                  📹 YouTube: {monetizationData.metricsBreakdown.avgYoutubeViews?.toLocaleString() || 0}
                                </Typography>
                                <Typography variant="body2">
                                  🎙️ Megaphone: {monetizationData.metricsBreakdown.avgMegaphoneDownloads?.toLocaleString() || 0}
                                </Typography>
                                <Typography variant="body2">
                                  📊 Episodes analyzed: {monetizationData.metricsBreakdown.episodeCount || 0}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                                  Date range: {monetizationData.metricsBreakdown.dateRange}
                                </Typography>
                              </>
                            )}
                          </Box>
                        }
                        arrow
                        placement="top"
                      >
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                  type="text"
                  value={localInputs.avgEpisodeDownloads}
                  onChange={(e) => handleFormattedNumberInput('avgEpisodeDownloads', 'avgEpisodeDownloads', e.target.value)}
                  disabled={readOnly || recalculating}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Click to recalculate average from last 3 months of data">
                          <IconButton 
                            onClick={handleRecalculateAverage}
                            disabled={readOnly || recalculating}
                            size="small"
                            sx={{ 
                              color: 'primary.main',
                              '&:hover': {
                                backgroundColor: 'action.hover'
                              }
                            }}
                          >
                            {recalculating ? (
                              <CircularProgress size={20} />
                            ) : (
                              <Calculate />
                            )}
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    )
                  }}
                  helperText={(() => {
                    if (monetizationData.metricsBreakdown) {
                      const youtube = monetizationData.metricsBreakdown.avgYoutubeViews || 0
                      const megaphone = monetizationData.metricsBreakdown.avgMegaphoneDownloads || 0
                      return `Based on last 3 months: YouTube (${youtube.toLocaleString()}) + Megaphone (${megaphone.toLocaleString()})`
                    }
                    const megaphone = metricsDownloads || 0
                    const youtube = youtubeViews || 0
                    const total = megaphone + youtube
                    if (total > 0) {
                      return `Actual: ${total.toLocaleString()} (Megaphone: ${megaphone.toLocaleString()}, YouTube: ${youtube.toLocaleString()})`
                    }
                    return "Click calculator icon to fetch average from last 3 months data"
                  })()}
                />
              </Grid>
            </>
          )}

          {/* Pre-roll Section */}
          <Grid item xs={12}>
            <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                Pre-roll Placement
              </Typography>
              <Grid container spacing={2} alignItems="center">
                {(formData.pricingModel === 'cpm' || formData.pricingModel === 'both' || !formData.pricingModel) && (
                  <Grid item xs={12} md={formData.pricingModel === 'both' ? 3 : 6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="CPM"
                      type="number"
                      value={localInputs.preRollCpm}
                      onChange={(e) => handleMonetizationInput('preRollCpm', 'preRollCpm', e.target.value)}
                      disabled={readOnly}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                  </Grid>
                )}
                {(formData.pricingModel === 'spot' || formData.pricingModel === 'both') && (
                  <Grid item xs={12} md={formData.pricingModel === 'both' ? 3 : 6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Cost Per Spot"
                      type="number"
                      value={localInputs.preRollSpotCost}
                      onChange={(e) => handleMonetizationInput('preRollSpotCost', 'preRollSpotCost', e.target.value)}
                      disabled={readOnly}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                  </Grid>
                )}
                <Grid item xs={12} md={formData.pricingModel === 'both' ? 3 : 6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Available Slots"
                    type="number"
                    value={localInputs.preRollSlots}
                    onChange={(e) => handleMonetizationInput('preRollSlots', 'preRollSlots', e.target.value, true)}
                    disabled={readOnly}
                    inputProps={{ min: 0, max: 5 }}
                  />
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Mid-roll Section */}
          <Grid item xs={12}>
            <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                Mid-roll Placement
              </Typography>
              <Grid container spacing={2} alignItems="center">
                {(formData.pricingModel === 'cpm' || formData.pricingModel === 'both' || !formData.pricingModel) && (
                  <Grid item xs={12} md={formData.pricingModel === 'both' ? 3 : 6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="CPM"
                      type="number"
                      value={localInputs.midRollCpm}
                      onChange={(e) => handleMonetizationInput('midRollCpm', 'midRollCpm', e.target.value)}
                      disabled={readOnly}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                  </Grid>
                )}
                {(formData.pricingModel === 'spot' || formData.pricingModel === 'both') && (
                  <Grid item xs={12} md={formData.pricingModel === 'both' ? 3 : 6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Cost Per Spot"
                      type="number"
                      value={localInputs.midRollSpotCost}
                      onChange={(e) => handleMonetizationInput('midRollSpotCost', 'midRollSpotCost', e.target.value)}
                      disabled={readOnly}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                  </Grid>
                )}
                <Grid item xs={12} md={formData.pricingModel === 'both' ? 3 : 6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Available Slots"
                    type="number"
                    value={localInputs.midRollSlots}
                    onChange={(e) => handleMonetizationInput('midRollSlots', 'midRollSlots', e.target.value, true)}
                    disabled={readOnly}
                    inputProps={{ min: 0, max: 10 }}
                  />
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Post-roll Section */}
          <Grid item xs={12}>
            <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                Post-roll Placement
              </Typography>
              <Grid container spacing={2} alignItems="center">
                {(formData.pricingModel === 'cpm' || formData.pricingModel === 'both' || !formData.pricingModel) && (
                  <Grid item xs={12} md={formData.pricingModel === 'both' ? 3 : 6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="CPM"
                      type="number"
                      value={localInputs.postRollCpm}
                      onChange={(e) => handleMonetizationInput('postRollCpm', 'postRollCpm', e.target.value)}
                      disabled={readOnly}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                  </Grid>
                )}
                {(formData.pricingModel === 'spot' || formData.pricingModel === 'both') && (
                  <Grid item xs={12} md={formData.pricingModel === 'both' ? 3 : 6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Cost Per Spot"
                      type="number"
                      value={localInputs.postRollSpotCost}
                      onChange={(e) => handleMonetizationInput('postRollSpotCost', 'postRollSpotCost', e.target.value)}
                      disabled={readOnly}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                  </Grid>
                )}
                <Grid item xs={12} md={formData.pricingModel === 'both' ? 3 : 6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Available Slots"
                    type="number"
                    value={localInputs.postRollSlots}
                    onChange={(e) => handleMonetizationInput('postRollSlots', 'postRollSlots', e.target.value, true)}
                    disabled={readOnly}
                    inputProps={{ min: 0, max: 5 }}
                  />
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Summary */}
          <Grid item xs={12}>
            <Box sx={{ 
              bgcolor: 'primary.50', 
              p: 1.5, 
              borderRadius: 1, 
              border: '1px solid',
              borderColor: 'primary.main'
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  Estimated Episode Value
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  ${calculateTotalEpisodeRevenue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
              {isAdmin && formData.selloutProjection && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    At {formData.selloutProjection}% sellout
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                    ${(calculateTotalEpisodeRevenue() * (formData.selloutProjection / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>

          {/* Save Button */}
          {!readOnly && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'Save Monetization Settings'}
                </Button>
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  )
}