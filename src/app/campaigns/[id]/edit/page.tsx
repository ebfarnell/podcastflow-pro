'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  MenuItem,
  CircularProgress,
  Alert,
  InputAdornment,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { campaignApi } from '@/services/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCacheManager } from '@/utils/cacheUtils'
import { AdvertiserSelector } from '@/components/shared/AdvertiserSelector'
import { AgencySelector } from '@/components/shared/AgencySelector'
import { formatCurrency, formatNumber } from '@/lib/utils/format'

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  client: z.string().min(1, 'Client is required'),
  agency: z.string().optional(),
  description: z.string().optional(),
  budget: z.number().positive('Budget must be positive'),
  targetImpressions: z.number().positive('Target impressions must be positive'),
  probability: z.number().refine((val) => [0, 10, 35, 65, 90, 100].includes(val), {
    message: 'Probability must be 0%, 10%, 35%, 65%, 90%, or 100%',
  }),
  startDate: z.date(),
  endDate: z.date(),
  industry: z.string().min(1, 'Industry is required'),
  targetAudience: z.string().min(1, 'Target audience is required'),
  status: z.enum(['active', 'paused', 'draft', 'completed', 'archived']),
})

type CampaignFormData = z.infer<typeof campaignSchema>

export default function EditCampaignPage() {
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const cacheManager = useCacheManager(queryClient)
  const campaignId = params.id as string
  const [error, setError] = useState<string | null>(null)

  // Fetch campaign data
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => campaignApi.get(campaignId),
  })

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      client: '',
      agency: '',
      description: '',
      budget: 0,
      targetImpressions: 0,
      probability: 10,
      startDate: new Date(),
      endDate: new Date(),
      industry: '',
      targetAudience: '',
      status: 'draft',
    },
  })

  // Reset form when campaign data is loaded
  useEffect(() => {
    if (campaign) {
      console.log('🔄 EDIT PAGE: Resetting form with campaign data:', campaign)
      // Handle both nested and direct campaign response formats
      const campaignData = campaign.campaign || campaign
      
      const formData = {
        name: campaignData.name || '',
        client: campaignData.client || campaignData.advertiser || '',
        agency: campaignData.agency || '',
        description: campaignData.description || '',
        budget: campaignData.budget || 0,
        targetImpressions: campaignData.targetImpressions || campaignData.impressions || 0,
        probability: campaignData.probability !== undefined ? campaignData.probability : 10,
        startDate: new Date(campaignData.startDate),
        endDate: new Date(campaignData.endDate),
        industry: campaignData.industry || '',
        targetAudience: campaignData.targetAudience || '',
        status: campaignData.status || 'draft',
      }
      console.log('🔄 EDIT PAGE: Form data being set:', formData)
      reset(formData)
    }
  }, [campaign, reset])

  const updateCampaignMutation = useMutation({
    mutationFn: (data: CampaignFormData) => campaignApi.update(campaignId, data),
    onSuccess: async (updatedCampaign) => {
      console.log('Campaign update successful:', updatedCampaign)
      
      // Use centralized cache management to update all related views
      await cacheManager.invalidateCampaign(campaignId)
      
      // Also force refetch the campaign data to ensure latest data is loaded
      await queryClient.refetchQueries({ 
        queryKey: ['campaign', campaignId],
        type: 'active'
      })
      
      // Add a small delay to ensure cache is updated before redirect
      setTimeout(() => {
        router.push(`/campaigns/${campaignId}`)
      }, 100)
    },
    onError: (error: any) => {
      console.error('Campaign update failed:', error)
      setError(error.message || 'Failed to update campaign')
    },
  })

  const onSubmit = (data: CampaignFormData) => {
    setError(null)
    
    // Transform data for API - convert dates to strings
    const apiData = {
      ...data,
      startDate: data.startDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD
      endDate: data.endDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD
    }
    
    console.log('Updating campaign with data:', apiData)
    updateCampaignMutation.mutate(apiData)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    )
  }

  if (!campaign) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 4 }}>
          <Alert severity="error">Campaign not found</Alert>
          <Button onClick={() => router.push('/campaigns')} sx={{ mt: 2 }}>
            Back to Campaigns
          </Button>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Edit Campaign
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Update campaign details and settings
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Campaign Details
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Controller
                        name="name"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Campaign Name"
                            error={!!errors.name}
                            helperText={errors.name?.message}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="client"
                        control={control}
                        render={({ field }) => (
                          <AdvertiserSelector
                            value={field.value}
                            onChange={(advertiser) => {
                              console.log('Advertiser selected:', advertiser);
                              field.onChange(advertiser?.name || '');
                            }}
                            error={!!errors.client}
                            helperText={errors.client?.message}
                            label="Client (Advertiser)"
                            required
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="agency"
                        control={control}
                        render={({ field }) => (
                          <AgencySelector
                            value={field.value}
                            onChange={(agency) => {
                              console.log('Agency selected:', agency);
                              field.onChange(agency?.name || '');
                            }}
                            error={!!errors.agency}
                            helperText={errors.agency?.message}
                            label="Agency (Optional)"
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            select
                            fullWidth
                            label="Status"
                            error={!!errors.status}
                            helperText={errors.status?.message}
                          >
                            <MenuItem value="draft">Draft</MenuItem>
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="paused">Paused</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                            <MenuItem value="archived">Archived</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            multiline
                            rows={4}
                            label="Description"
                            error={!!errors.description}
                            helperText={errors.description?.message}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Budget & Schedule
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="budget"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Budget"
                            type="text"
                            value={field.value ? formatNumber(Math.round(field.value)) : ''}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                            onChange={(e) => {
                              // Remove all non-numeric characters except dots
                              const cleanValue = e.target.value.replace(/[^0-9.]/g, '')
                              const numValue = parseFloat(cleanValue) || 0
                              // Round to nearest whole dollar
                              field.onChange(Math.round(numValue))
                            }}
                            onBlur={(e) => {
                              // Format with commas on blur
                              const numValue = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0
                              field.onChange(Math.round(numValue))
                            }}
                            error={!!errors.budget}
                            helperText={errors.budget?.message || 'Rounded to nearest whole dollar'}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="targetImpressions"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Target Impressions"
                            type="text"
                            value={field.value ? formatNumber(field.value) : ''}
                            onChange={(e) => {
                              // Remove all non-numeric characters
                              const cleanValue = e.target.value.replace(/[^0-9]/g, '')
                              const numValue = parseInt(cleanValue) || 0
                              field.onChange(numValue)
                            }}
                            onBlur={(e) => {
                              // Format with commas on blur
                              const cleanValue = e.target.value.replace(/[^0-9]/g, '')
                              const numValue = parseInt(cleanValue) || 0
                              field.onChange(numValue)
                            }}
                            error={!!errors.targetImpressions}
                            helperText={errors.targetImpressions?.message || 'e.g., 1,500,000'}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="probability"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value || 10}
                            label="Probability of Closing"
                            select
                            fullWidth
                            variant="outlined"
                            error={!!errors.probability}
                            helperText={errors.probability?.message || 'Probability this campaign will close successfully'}
                            onChange={(e) => {
                              field.onChange(Number(e.target.value))
                            }}
                          >
                            <MenuItem value={0}>0% - Lost</MenuItem>
                            <MenuItem value={10}>10% - Initial Contact</MenuItem>
                            <MenuItem value={35}>35% - Qualified Lead</MenuItem>
                            <MenuItem value={65}>65% - Proposal Sent</MenuItem>
                            <MenuItem value={90}>90% - Verbal Agreement</MenuItem>
                            <MenuItem value={100}>100% - Signed Contract</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="startDate"
                        control={control}
                        render={({ field }) => (
                          <DatePicker
                            label="Start Date"
                            value={dayjs(field.value)}
                            onChange={(date) => field.onChange(date?.toDate())}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                error: !!errors.startDate,
                                helperText: errors.startDate?.message,
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="endDate"
                        control={control}
                        render={({ field }) => (
                          <DatePicker
                            label="End Date"
                            value={dayjs(field.value)}
                            onChange={(date) => field.onChange(date?.toDate())}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                error: !!errors.endDate,
                                helperText: errors.endDate?.message,
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Targeting
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Controller
                        name="industry"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            select
                            fullWidth
                            label="Industry"
                            error={!!errors.industry}
                            helperText={errors.industry?.message}
                          >
                            <MenuItem value="technology">Technology</MenuItem>
                            <MenuItem value="finance">Finance</MenuItem>
                            <MenuItem value="healthcare">Healthcare</MenuItem>
                            <MenuItem value="retail">Retail</MenuItem>
                            <MenuItem value="education">Education</MenuItem>
                            <MenuItem value="entertainment">Entertainment</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Controller
                        name="targetAudience"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            multiline
                            rows={3}
                            label="Target Audience"
                            placeholder="Describe your target audience..."
                            error={!!errors.targetAudience}
                            helperText={errors.targetAudience?.message}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Box sx={{ mt: 3 }}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={updateCampaignMutation.isPending}
                >
                  {updateCampaignMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  size="large"
                  sx={{ mt: 2 }}
                  onClick={() => router.push(`/campaigns/${campaignId}`)}
                >
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </LocalizationProvider>
    </DashboardLayout>
  )
}