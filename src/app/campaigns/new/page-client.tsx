'use client'

/**
 * Full Campaign Creation Page Implementation
 * 
 * This file contains the complete implementation of the campaign creation page.
 * It was separated from page.tsx to resolve SSR compatibility issues.
 * 
 * SSR Issues Resolved:
 * 1. MUI DatePicker components access window/document during initialization
 * 2. The popper modifiers configuration can't be wrapped with window checks
 * 3. Complex form state and validation logic requires client-side execution
 * 4. Multiple third-party libraries (dayjs, react-hook-form) have browser dependencies
 * 
 * This component is dynamically imported by page.tsx only on the client side,
 * ensuring all browser-dependent code runs after hydration.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  Stepper,
  Step,
  StepLabel,
  InputAdornment,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { campaignApi } from '@/services/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCacheManager } from '@/utils/cacheUtils'
import { AdvertiserSelector } from '@/components/shared/AdvertiserSelector'
import { AgencySelector } from '@/components/shared/AgencySelector'
import { useAuth } from '@/contexts/AuthContext'

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  advertiserId: z.string().min(1, 'Advertiser is required'),
  advertiserName: z.string().optional(),
  agencyId: z.string().optional(),
  agencyName: z.string().optional(),
  description: z.string().optional(),
  budget: z.number().positive('Budget must be positive'),
  targetImpressions: z.number().positive('Target impressions must be positive'),
  probability: z.number().refine((val) => [10, 35, 65, 90, 100].includes(val), {
    message: 'Probability must be 10%, 35%, 65%, 90%, or 100%',
  }),
  startDate: z.date(),
  endDate: z.date(),
  industry: z.string().min(1, 'Industry is required'),
  targetAudience: z.string().min(1, 'Target audience is required'),
  adFormats: z.array(z.string()).min(1, 'Select at least one ad format'),
}).refine((data) => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
})

type CampaignFormData = z.infer<typeof campaignSchema>

const steps = ['Campaign Details', 'Budget & Schedule', 'Targeting', 'Review']

export default function NewCampaignPageClient() {
  const router = useRouter()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const cacheManager = useCacheManager(queryClient)
  const [activeStep, setActiveStep] = useState(0)
  const [reviewData, setReviewData] = useState<CampaignFormData | null>(null)

  // Check if user has permission to create campaigns
  if (!user || !['master', 'admin', 'sales'].includes(user.role)) {
    router.push('/campaigns')
    return null
  }

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      advertiserId: '',
      advertiserName: '',
      agencyId: '',
      agencyName: '',
      description: '',
      budget: 0,
      targetImpressions: 0,
      probability: 10,
      startDate: new Date(),
      endDate: dayjs().add(30, 'day').toDate(),
      industry: '',
      targetAudience: '',
      adFormats: [],
    },
  })

  const createCampaignMutation = useMutation({
    mutationFn: (data: CampaignFormData) => campaignApi.create(data),
    onSuccess: async (result) => {
      console.log('Campaign creation successful, result:', result)
      // Use centralized cache management to update all related data
      await cacheManager.invalidateCampaignData()
      if (result && result.id) {
        console.log('Navigating to campaign:', result.id)
        router.push(`/campaigns/${result.id}`)
      } else {
        console.error('No ID returned from campaign creation')
        alert('Campaign created but no ID returned. Check the campaigns list.')
        router.push('/campaigns')
      }
    },
    onError: (error: any) => {
      console.error('Campaign creation error:', error)
      alert('Failed to create campaign: ' + (error.message || 'Unknown error'))
    },
  })

  const onSubmit = (data: CampaignFormData) => {
    console.log('Submitting campaign data:', data)
    
    // Transform the data to match API expectations
    const apiData = {
      ...data,
      startDate: data.startDate.toISOString(),
      endDate: data.endDate.toISOString(),
    }
    
    console.log('Transformed data for API:', apiData)
    createCampaignMutation.mutate(apiData as any)
  }

  const handleNext = () => {
    // When moving to review step, capture the form data
    if (activeStep === 2) {
      const values = watch()
      setReviewData(values)
    }
    setActiveStep((prevStep) => prevStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1)
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Campaign Name"
                    fullWidth
                    variant="outlined"
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="advertiserId"
                control={control}
                render={({ field }) => (
                  <AdvertiserSelector
                    value={watch('advertiserName')}
                    onChange={(advertiser) => {
                      console.log('Advertiser selected:', advertiser);
                      field.onChange(advertiser?.id || '');
                      setValue('advertiserName', advertiser?.name || '');
                    }}
                    error={!!errors.advertiserId}
                    helperText={errors.advertiserId?.message || 'Click the search icon to browse advertisers'}
                    label="Client (Advertiser)"
                    required
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="agencyId"
                control={control}
                render={({ field }) => (
                  <AgencySelector
                    value={watch('agencyName')}
                    onChange={(agency) => {
                      console.log('Agency selected:', agency);
                      field.onChange(agency?.id || '');
                      setValue('agencyName', agency?.name || '');
                    }}
                    error={!!errors.agencyId}
                    helperText={errors.agencyId?.message || 'Click the search icon to browse agencies (optional)'}
                    label="Agency (Optional)"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="industry"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Industry"
                    select
                    fullWidth
                    variant="outlined"
                    error={!!errors.industry}
                    helperText={errors.industry?.message}
                  >
                    <MenuItem value="">
                      <em>Select an industry</em>
                    </MenuItem>
                    <MenuItem value="technology">Technology</MenuItem>
                    <MenuItem value="retail">Retail</MenuItem>
                    <MenuItem value="finance">Finance</MenuItem>
                    <MenuItem value="healthcare">Healthcare</MenuItem>
                    <MenuItem value="entertainment">Entertainment</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
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
                    label="Campaign Description"
                    multiline
                    rows={4}
                    fullWidth
                    variant="outlined"
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />
                )}
              />
            </Grid>
          </Grid>
        )

      case 1:
        return (
          <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="budget"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value === 0 ? '' : field.value}
                      label="Campaign Budget"
                      fullWidth
                      variant="outlined"
                      placeholder="Enter budget amount"
                      type="number"
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      error={!!errors.budget}
                      helperText={errors.budget?.message}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          field.onChange(0);
                        } else {
                          const numVal = parseFloat(val);
                          field.onChange(isNaN(numVal) ? 0 : numVal);
                        }
                      }}
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
                      value={field.value === 0 ? '' : field.value}
                      label="Target Impressions"
                      fullWidth
                      variant="outlined"
                      placeholder="Enter target impressions"
                      type="number"
                      error={!!errors.targetImpressions}
                      helperText={errors.targetImpressions?.message}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          field.onChange(0);
                        } else {
                          const numVal = parseInt(val, 10);
                          field.onChange(isNaN(numVal) ? 0 : numVal);
                        }
                      }}
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
                      label="Probability of Closing"
                      select
                      fullWidth
                      variant="outlined"
                      error={!!errors.probability}
                      helperText={errors.probability?.message || 'Probability this campaign will close successfully'}
                    >
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
                        },
                        popper: {
                          modifiers: [
                            {
                              name: 'preventOverflow',
                              options: {
                                altAxis: true,
                                altBoundary: true,
                                tether: false,
                                rootBoundary: 'viewport',
                              },
                            },
                          ],
                        },
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
                        },
                        popper: {
                          modifiers: [
                            {
                              name: 'preventOverflow',
                              options: {
                                altAxis: true,
                                altBoundary: true,
                                tether: false,
                                rootBoundary: 'viewport',
                              },
                            },
                          ],
                        },
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>
        )

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Controller
                name="targetAudience"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Target Audience"
                    multiline
                    rows={3}
                    fullWidth
                    variant="outlined"
                    placeholder="Describe your target audience demographics, interests, and behaviors"
                    error={!!errors.targetAudience}
                    helperText={errors.targetAudience?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Ad Formats
              </Typography>
              <Controller
                name="adFormats"
                control={control}
                render={({ field }) => (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {['Pre-roll', 'Mid-roll', 'Post-roll', 'Host-read', 'Programmatic'].map((format) => (
                      <label key={format} style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          value={format}
                          checked={field.value.includes(format)}
                          onChange={(e) => {
                            const newValue = e.target.checked
                              ? [...field.value, format]
                              : field.value.filter((f) => f !== format)
                            field.onChange(newValue)
                          }}
                          style={{ marginRight: 8 }}
                        />
                        {format}
                      </label>
                    ))}
                  </Box>
                )}
              />
              {errors.adFormats && (
                <Typography color="error" variant="caption">
                  {errors.adFormats.message}
                </Typography>
              )}
            </Grid>
          </Grid>
        )

      case 3:
        const displayData = reviewData || watch()
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Review Campaign Details
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Campaign Name
              </Typography>
              <Typography variant="body1" gutterBottom>
                {displayData.name || ''}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Client
              </Typography>
              <Typography variant="body1" gutterBottom>
                {displayData.advertiserName || ''}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Budget
              </Typography>
              <Typography variant="body1" gutterBottom>
                ${(displayData.budget || 0).toLocaleString()}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Probability of Closing
              </Typography>
              <Typography variant="body1" gutterBottom>
                {displayData.probability}% - {
                  displayData.probability === 10 ? 'Initial Contact' :
                  displayData.probability === 35 ? 'Qualified Lead' :
                  displayData.probability === 65 ? 'Proposal Sent' :
                  displayData.probability === 90 ? 'Verbal Agreement' :
                  displayData.probability === 100 ? 'Signed Contract' : 'Unknown'
                }
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Duration
              </Typography>
              <Typography variant="body1" gutterBottom>
                {displayData.startDate && displayData.endDate ? 
                  `${dayjs(displayData.startDate).format('MMM D, YYYY')} - ${dayjs(displayData.endDate).format('MMM D, YYYY')}` : 
                  'Not set'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="textSecondary">
                Target Audience
              </Typography>
              <Typography variant="body1" gutterBottom>
                {displayData.targetAudience || ''}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="textSecondary">
                Ad Formats
              </Typography>
              <Typography variant="body1">
                {(displayData.adFormats || []).join(', ') || 'None selected'}
              </Typography>
            </Grid>
          </Grid>
        )

      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Campaign
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Card>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault()
              console.log('Form submit event triggered, activeStep:', activeStep)
              if (activeStep === steps.length - 1) {
                console.log('On final step, calling handleSubmit')
                handleSubmit(onSubmit)(e)
              } else {
                console.log('Not on final step, preventing submit')
              }
            }}>
              <Box key={`step-${activeStep}`}>
                {renderStepContent()}
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                  type="button"
                  disabled={activeStep === 0}
                  onClick={handleBack}
                >
                  Back
                </Button>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => router.push('/campaigns')}
                  >
                    Cancel
                  </Button>
                  {activeStep === steps.length - 1 ? (
                    <Button
                      type="button"
                      variant="contained"
                      disabled={createCampaignMutation.isPending}
                      onClick={(e) => {
                        e.preventDefault()
                        console.log('Create Campaign button clicked')
                        handleSubmit(onSubmit)()
                      }}
                    >
                      Create Campaign
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="contained"
                      onClick={handleNext}
                    >
                      Next
                    </Button>
                  )}
                </Box>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Box>
      </LocalizationProvider>
    </DashboardLayout>
  )
}