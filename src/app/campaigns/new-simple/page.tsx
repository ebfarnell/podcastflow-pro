'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Autocomplete,
  Switch,
  FormControlLabel,
  InputAdornment
} from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { campaignApi, advertiserApi, agencyApi } from '@/services/api'
import { ArrowBack, Save, Schedule } from '@mui/icons-material'

interface SimpleCampaignFormData {
  name: string
  advertiserId: string
  agencyId?: string
  budget: number
  startDate: string
  endDate: string
  status: 'draft' | 'active'
  targetAudience?: string
}

export default function NewSimpleCampaignPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<SimpleCampaignFormData>({
    name: '',
    advertiserId: '',
    budget: 0,
    startDate: '',
    endDate: '',
    status: 'draft'
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch advertisers and agencies for selection
  const { data: advertisers = [] } = useQuery({
    queryKey: ['advertisers'],
    queryFn: () => advertiserApi.list()
  })

  const { data: agencies = [] } = useQuery({
    queryKey: ['agencies'],
    queryFn: () => agencyApi.list()
  })

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: campaignApi.create,
    onSuccess: (data) => {
      router.push(`/campaigns/${data.id}`)
    },
    onError: (error: any) => {
      console.error('Failed to create campaign:', error)
    }
  })

  const handleInputChange = (field: keyof SimpleCampaignFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required'
    }
    if (!formData.advertiserId) {
      newErrors.advertiserId = 'Advertiser is required'
    }
    if (!formData.budget || formData.budget <= 0) {
      newErrors.budget = 'Budget must be greater than 0'
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required'
    }
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required'
    }
    if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
      newErrors.endDate = 'End date must be after start date'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return

    createCampaignMutation.mutate({
      ...formData,
      budget: Number(formData.budget),
      // Add default values for required fields
      targetImpressions: 0,
      spent: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0
    })
  }

  const handleSaveAndContinue = () => {
    formData.status = 'draft'
    handleSubmit()
  }

  const handleSaveAndActivate = () => {
    formData.status = 'active'
    handleSubmit()
  }

  return (
    <RoleGuard allowedRoles={['master', 'admin', 'sales']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.back()}
              variant="outlined"
            >
              Back
            </Button>
            <Typography variant="h4" component="h1">
              Create New Campaign (Simple)
            </Typography>
          </Box>

          {/* Form */}
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Campaign Information
              </Typography>

              <Grid container spacing={3}>
                {/* Campaign Name */}
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Campaign Name"
                    fullWidth
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    error={!!errors.name}
                    helperText={errors.name}
                    placeholder="Enter campaign name"
                  />
                </Grid>

                {/* Budget */}
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Budget"
                    fullWidth
                    required
                    type="number"
                    value={formData.budget || ''}
                    onChange={(e) => handleInputChange('budget', e.target.value)}
                    error={!!errors.budget}
                    helperText={errors.budget}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    placeholder="0.00"
                  />
                </Grid>

                {/* Advertiser */}
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required error={!!errors.advertiserId}>
                    <InputLabel>Advertiser</InputLabel>
                    <Select
                      value={formData.advertiserId}
                      onChange={(e) => handleInputChange('advertiserId', e.target.value)}
                      label="Advertiser"
                    >
                      {advertisers.map((advertiser: any) => (
                        <MenuItem key={advertiser.id} value={advertiser.id}>
                          {advertiser.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.advertiserId && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                        {errors.advertiserId}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>

                {/* Agency (Optional) */}
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Agency (Optional)</InputLabel>
                    <Select
                      value={formData.agencyId || ''}
                      onChange={(e) => handleInputChange('agencyId', e.target.value)}
                      label="Agency (Optional)"
                    >
                      <MenuItem value="">None</MenuItem>
                      {agencies.map((agency: any) => (
                        <MenuItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Start Date */}
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Start Date"
                    type="date"
                    fullWidth
                    required
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                    error={!!errors.startDate}
                    helperText={errors.startDate}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* End Date */}
                <Grid item xs={12} md={6}>
                  <TextField
                    label="End Date"
                    type="date"
                    fullWidth
                    required
                    value={formData.endDate}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                    error={!!errors.endDate}
                    helperText={errors.endDate}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* Target Audience */}
                <Grid item xs={12}>
                  <TextField
                    label="Target Audience (Optional)"
                    fullWidth
                    multiline
                    rows={2}
                    value={formData.targetAudience || ''}
                    onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                    placeholder="Describe your target audience demographics and interests"
                  />
                </Grid>
              </Grid>

              {/* Error Display */}
              {createCampaignMutation.isError && (
                <Alert severity="error" sx={{ mt: 3 }}>
                  Failed to create campaign. Please try again.
                </Alert>
              )}

              {/* Action Buttons */}
              <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => router.back()}
                  disabled={createCampaignMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Save />}
                  onClick={handleSaveAndContinue}
                  disabled={createCampaignMutation.isPending}
                >
                  Save as Draft
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Schedule />}
                  onClick={handleSaveAndActivate}
                  disabled={createCampaignMutation.isPending}
                >
                  Create & Activate
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </DashboardLayout>
    </RoleGuard>
  )
}