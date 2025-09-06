'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Button,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
  IconButton,
  Badge,
  Divider,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert
} from '@mui/material'
import {
  CalendarMonth as CalendarIcon,
  FilterList as FilterIcon,
  Save as SaveIcon,
  FileDownload as ExportIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Close as CloseIcon,
  AttachMoney as MoneyIcon,
  Description as TemplateIcon
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { ShowSelector } from '@/components/schedule-builder/ShowSelector'
import { ShowSelectorAdvanced } from '@/components/schedule-builder/ShowSelectorAdvanced'
import { DraggableInventoryCalendar } from '@/components/schedule-builder/DraggableInventoryCalendar'
import { ImprovedScheduleCalendar } from '@/components/schedule-builder/ImprovedScheduleCalendar'
import { CalendarCentricScheduleBuilder } from '@/components/schedule-builder/CalendarCentricScheduleBuilder'
import { ProposalSummary } from '@/components/schedule-builder/ProposalSummary'
import { TemplateSelector } from '@/components/schedule-builder/TemplateSelector'
import { PodcastCampaignScheduleBuilder } from '@/components/schedule-builder/PodcastCampaignScheduleBuilder'
import { useScheduleBuilder } from '@/hooks/useScheduleBuilder'
import { useEnhancedScheduleBuilder } from '@/hooks/useEnhancedScheduleBuilder'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'
import { createLocalDate, formatDateKey } from '@/lib/utils/date-utils'

const steps = ['Select Shows', 'Build Schedule', 'Review & Export']

export default function ScheduleBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeStep, setActiveStep] = useState(0)
  const [campaignName, setCampaignName] = useState('')
  const [campaignBudget, setCampaignBudget] = useState<number | null>(null)
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false)
  const [useAdvancedSelector, setUseAdvancedSelector] = useState(false)
  const [useImprovedCalendar, setUseImprovedCalendar] = useState(true)
  const [useCalendarCentric, setUseCalendarCentric] = useState(false)
  const [useNewScheduleBuilder, setUseNewScheduleBuilder] = useState(true) // New toggle for the new UI
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [advertiserId, setAdvertiserId] = useState<string | null>(null)
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [campaignStartDate, setCampaignStartDate] = useState<Date | null>(null)
  const [campaignEndDate, setCampaignEndDate] = useState<Date | null>(null)
  const [newBuilderScheduleData, setNewBuilderScheduleData] = useState<{
    spots: any[]
    analytics: { spend: number }
  }>({ spots: [], analytics: { spend: 0 } })
  
  // Use enhanced hook when scheduleId is provided, otherwise use basic hook
  const basicHook = useScheduleBuilder()
  const enhancedHook = useEnhancedScheduleBuilder(scheduleId || undefined)
  
  // Select which hook to use based on context
  const isEnhancedMode = !!scheduleId
  
  const {
    selectedShows,
    selectedSlots,
    inventory,
    loading,
    addShow,
    removeShow,
    addSlot,
    removeSlot,
    moveSlot,
    loadInventory,
    getTotalPrice,
    getSlotCount
  } = isEnhancedMode ? {
    selectedShows: enhancedHook.selectedShows,
    selectedSlots: enhancedHook.selectedItems,
    inventory: enhancedHook.inventory,
    loading: enhancedHook.loading || loadingSchedule,
    addShow: enhancedHook.addShow,
    removeShow: enhancedHook.removeShow,
    addSlot: (slot: any) => enhancedHook.addItem(slot),
    removeSlot: (slotId: string) => enhancedHook.removeItem(slotId),
    moveSlot: () => {}, // Not implemented in enhanced hook
    loadInventory: enhancedHook.loadInventory,
    getTotalPrice: () => enhancedHook.getTotals().netAmount,
    getSlotCount: () => enhancedHook.getTotals().spots
  } : basicHook

  useEffect(() => {
    if (selectedShows.length > 0) {
      loadInventory()
    }
  }, [selectedShows])
  
  // When using enhanced mode and schedule loads, update campaign details
  useEffect(() => {
    if (isEnhancedMode && enhancedHook.schedule && !loading) {
      const schedule = enhancedHook.schedule
      if (schedule.name && !campaignName) {
        setCampaignName(schedule.name)
      }
      if (schedule.totalBudget && !campaignBudget) {
        setCampaignBudget(Math.round(schedule.totalBudget))
      }
      if (schedule.campaignId && !campaignId) {
        setCampaignId(schedule.campaignId)
      }
      if (schedule.advertiserId && !advertiserId) {
        setAdvertiserId(schedule.advertiserId)
      }
    }
  }, [isEnhancedMode, enhancedHook.schedule, loading])

  // Fetch campaign data to get advertiserId
  const fetchCampaignData = async (campaignId: string) => {
    try {
      console.log('Fetching campaign data for:', campaignId)
      const response = await fetch(`/api/campaigns/${campaignId}`)
      if (response.ok) {
        const result = await response.json()
        console.log('Campaign API response:', result)
        
        // Handle nested response structure
        const data = result.campaign || result
        console.log('Campaign data extracted:', data)
        
        if (data.advertiserId && data.advertiserId !== 'undefined' && data.advertiserId !== 'null') {
          console.log('Setting advertiserId from campaign:', data.advertiserId)
          setAdvertiserId(data.advertiserId)
        } else {
          console.log('No advertiserId found in campaign data, checking nested fields')
          // Check for advertiser object
          if (data.advertiser && data.advertiser.id && data.advertiser.id !== 'undefined' && data.advertiser.id !== 'null') {
            console.log('Found advertiserId in advertiser object:', data.advertiser.id)
            setAdvertiserId(data.advertiser.id)
          }
        }
        
        if (data.name && !campaignName) {
          setCampaignName(data.name)
        }
        if (data.budget && !campaignBudget) {
          setCampaignBudget(Math.round(data.budget))
        }
        if (data.startDate) {
          setCampaignStartDate(new Date(data.startDate))
        }
        if (data.endDate) {
          setCampaignEndDate(new Date(data.endDate))
        }
      } else {
        console.error('Failed to fetch campaign:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to fetch campaign data:', error)
    }
  }

  // Load campaign context from URL params
  useEffect(() => {
    const urlCampaignId = searchParams.get('campaignId')
    const urlCampaignName = searchParams.get('campaignName')
    const urlBudget = searchParams.get('budget')
    const urlAdvertiserId = searchParams.get('advertiserId')
    const urlScheduleId = searchParams.get('scheduleId')

    // Check if we're editing an existing schedule
    if (urlScheduleId) {
      setScheduleId(urlScheduleId)
      // When editing an existing schedule, jump to Build Schedule step and load the schedule
      setActiveStep(1)
      // Load the existing schedule data
      loadExistingSchedule(urlScheduleId)
    } else if (!urlCampaignId) {
      // NEW SCHEDULE: Campaign is REQUIRED
      // Show error and redirect to campaigns page after a delay
      toast.error('A campaign is required to create a schedule. Please select a campaign first.')
      setTimeout(() => {
        router.push('/campaigns')
      }, 2000)
      return
    }
    
    if (urlCampaignId) {
      setCampaignId(urlCampaignId)
      
      // If we have campaignId but no advertiserId, fetch campaign data
      if (!urlAdvertiserId) {
        fetchCampaignData(urlCampaignId)
      }
    }
    if (urlCampaignName) {
      try {
        setCampaignName(decodeURIComponent(urlCampaignName))
      } catch (error) {
        // If decoding fails, use the raw value
        console.warn('Failed to decode campaign name, using raw value:', urlCampaignName)
        setCampaignName(urlCampaignName)
      }
    }
    if (urlBudget) {
      setCampaignBudget(Math.round(parseFloat(urlBudget)))
    }
    if (urlAdvertiserId && urlAdvertiserId !== 'undefined' && urlAdvertiserId !== 'null') {
      setAdvertiserId(urlAdvertiserId)
    }
  }, [searchParams, router])

  // Clean up any "undefined" string values
  useEffect(() => {
    if (advertiserId === 'undefined' || advertiserId === 'null') {
      console.warn('Cleaning up invalid advertiserId:', advertiserId)
      setAdvertiserId(null)
    }
  }, [advertiserId])

  const loadExistingSchedule = async (scheduleId: string) => {
    setLoadingSchedule(true)
    // Jump to Build Schedule step immediately when loading
    setActiveStep(1)
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`)
      if (!response.ok) {
        throw new Error('Failed to load schedule')
      }
      const data = await response.json()
      
      if (data.schedule) {
        // Set campaign info from schedule
        setCampaignName(data.schedule.name)
        if (data.schedule.totalBudget) {
          setCampaignBudget(Math.round(data.schedule.totalBudget))
        }
        setCampaignId(data.schedule.campaignId)
        if (data.schedule.advertiserId && data.schedule.advertiserId !== 'undefined' && data.schedule.advertiserId !== 'null') {
          setAdvertiserId(data.schedule.advertiserId)
        }
        
        // Load schedule items if available
        if (data.schedule.items && data.schedule.items.length > 0) {
          // Extract unique shows from schedule items
          const showIds = [...new Set(data.schedule.items.map((item: any) => item.showId))]
          const showsData = data.schedule.items.reduce((acc: any, item: any) => {
            if (!acc[item.showId] && item.show) {
              acc[item.showId] = item.show
            }
            return acc
          }, {})
          
          // For the new schedule builder, convert items to the spots format
          if (useNewScheduleBuilder) {
            const spots = data.schedule.items.map((item: any) => ({
              id: item.id || `${item.showId}-${item.placementType}-${item.airDate}`,
              showId: item.showId,
              showName: item.show?.name || '',
              date: item.airDate,
              placementType: item.placementType,
              price: item.negotiatedPrice || item.rateCardPrice || 0,
              episodeId: item.episodeId,
              episodeTitle: item.episode?.title || '',
              episodeNumber: item.episode?.episodeNumber || 0
            }))
            
            // Set the schedule data for the new builder
            setNewBuilderScheduleData({
              spots,
              analytics: {
                spend: spots.reduce((total: number, spot: any) => total + (spot.price || 0), 0)
              }
            })
            
            // Also need to set the selected shows for the builder
            const uniqueShows = Array.from(new Map(
              data.schedule.items
                .filter((item: any) => item.show)
                .map((item: any) => [item.showId, item.show])
            ).values())
            setSelectedShows(uniqueShows)
            
            toast.success('Loaded existing schedule: ' + data.schedule.name)
            return
          }
          
          // Set selected shows for the appropriate hook
          const selectedShowsList = Object.values(showsData)
          if (scheduleId) {
            // Using enhanced hook - we need to properly load shows with configurations
            // First, fetch full show data for each unique show
            const showPromises = showIds.map(async (showId: string) => {
              try {
                const showResponse = await fetch(`/api/shows/${showId}`)
                const showData = await showResponse.json()
                return showData.show || null
              } catch (error) {
                console.error(`Failed to load show ${showId}:`, error)
                return null
              }
            })
            
            // Wait for all shows to be loaded
            const loadedShows = await Promise.all(showPromises)
            const validShows = loadedShows.filter(Boolean)
            
            // Add shows to the enhanced hook one by one (the hook will fetch configurations)
            for (const show of validShows) {
              await enhancedHook.addShow(show)
            }
            
            // IMPORTANT: We need to wait for React state updates and then manually trigger inventory load
            // The enhanced hook's selectedShows state needs time to update
            setTimeout(async () => {
              // Now load inventory with all shows properly loaded
              await enhancedHook.loadInventory()
              console.log('Inventory load triggered after shows loaded')
              
              // After inventory is loaded, add the schedule items
              // Map schedule items to the enhanced hook format
              const items = data.schedule.items.map((item: any) => ({
                id: `${item.episodeId}-${item.placementType}-${item.slotNumber || 1}`,
                episodeId: item.episodeId,
                episodeTitle: item.episode?.title || '',
                episodeNumber: item.episode?.episodeNumber || 0,
                showId: item.showId,
                showName: item.show?.name || '',
                showCategory: item.show?.category || '',
                configurationId: item.showConfigurationId,
                configurationName: '',
                episodeLength: 0,
                airDate: item.airDate,
                placementType: item.placementType,
                slotNumber: item.slotNumber || 1,
                basePrice: item.rateCardPrice || 0,
                adjustedPrice: item.negotiatedPrice || item.rateCardPrice || 0,
                available: true,
                estimatedImpressions: item.impressions || 0,
                restrictions: []
              }))
              
              // Add each item to the enhanced hook
              items.forEach((item: any) => {
                enhancedHook.addItem(item, item.adjustedPrice)
              })
              
              console.log('Added schedule items to enhanced hook:', items.length)
            }, 500)
          } else {
            // Using basic hook
            basicHook.setSelectedShows(selectedShowsList)
            // Map schedule items to slots format
            const slots = data.schedule.items.map((item: any) => ({
              id: item.id,
              showId: item.showId,
              showName: item.show?.name || '',
              episodeId: item.episodeId,
              episodeTitle: item.episode?.title || '',
              airDate: item.airDate,
              placementType: item.placementType,
              quantity: 1,
              price: item.negotiatedPrice || item.rateCardPrice || 0,
              rateCardPrice: item.rateCardPrice || 0,
              negotiatedPrice: item.negotiatedPrice || 0
            }))
            basicHook.setSelectedSlots(slots)
          }
          
          toast.success('Loaded existing schedule: ' + data.schedule.name)
        } else {
          // No items in schedule, just load the basic info
          toast.info('Loaded schedule info: ' + data.schedule.name)
        }
      }
    } catch (error) {
      console.error('Failed to load schedule:', error)
      toast.error('Failed to load existing schedule')
    } finally {
      setLoadingSchedule(false)
    }
  }

  const handleNext = () => {
    if (activeStep === 0 && selectedShows.length === 0) {
      alert('Please select at least one show')
      return
    }
    if (activeStep === 1) {
      // Check the appropriate data source based on which schedule builder is active
      if (useNewScheduleBuilder) {
        if (newBuilderScheduleData.spots.length === 0) {
          alert('Please select at least one placement on the schedule')
          return
        }
      } else {
        if (selectedSlots.length === 0) {
          alert('Please select at least one ad slot')
          return
        }
      }
    }
    setActiveStep((prevStep) => prevStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1)
  }

  const handleSaveProposal = async () => {
    // Enhanced save that includes campaign context
    try {
      const scheduleData = {
        name: campaignName || 'Untitled Schedule',
        campaignId: campaignId,
        advertiserId: advertiserId === 'undefined' || advertiserId === 'null' || !advertiserId ? null : advertiserId,
        totalBudget: campaignBudget,
        startDate: selectedSlots.length > 0 
          ? new Date(Math.min(...selectedSlots.map(s => new Date(s.airDate).getTime()))).toISOString()
          : new Date().toISOString(),
        endDate: selectedSlots.length > 0
          ? new Date(Math.max(...selectedSlots.map(s => new Date(s.airDate).getTime()))).toISOString()
          : new Date().toISOString(),
        items: selectedSlots.map(slot => ({
          showId: slot.showId,
          episodeId: slot.episodeId,
          airDate: slot.airDate,
          placementType: slot.placementType,
          quantity: slot.quantity,
          negotiatedPrice: slot.price,
          price: slot.price,
          rateCardPrice: slot.rateCardPrice || slot.price
        }))
      }

      const response = await fetch(
        scheduleId ? `/api/schedules/${scheduleId}` : '/api/schedules',
        {
          method: scheduleId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleData)
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Schedule save error response:', errorText)
        try {
          const errorJson = JSON.parse(errorText)
          
          // Handle 409 Conflict - existing schedule
          if (response.status === 409 && errorJson.existingScheduleId) {
            const confirmUpdate = confirm(
              `A schedule "${errorJson.existingScheduleName}" already exists for this campaign. ` +
              `Would you like to update the existing schedule instead?`
            )
            
            if (confirmUpdate) {
              // Retry the save as an update to the existing schedule
              const updateResponse = await fetch(`/api/schedules/${errorJson.existingScheduleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduleData)
              })
              
              if (!updateResponse.ok) {
                const updateErrorText = await updateResponse.text()
                console.error('Schedule update error response:', updateErrorText)
                throw new Error('Failed to update existing schedule')
              }
              
              const updateResult = await updateResponse.json()
              toast.success('Existing schedule updated successfully!')
              
              if (campaignId) {
                router.push(`/campaigns/${campaignId}?tab=4`)
              }
              return // Exit the function successfully
            } else {
              // User chose not to update, navigate to existing schedule
              if (campaignId) {
                router.push(`/campaigns/${campaignId}?tab=4`)
              }
              return
            }
          }
          
          throw new Error(errorJson.error || 'Failed to save schedule')
        } catch (e) {
          if (e.message !== 'Failed to save schedule') {
            throw e // Re-throw if it's our custom error with user choice handling
          }
          throw new Error('Failed to save schedule')
        }
      }

      const result = await response.json()
      toast.success('Schedule saved successfully!')
      
      // If saved from campaign context, navigate back to campaign
      if (campaignId) {
        router.push(`/campaigns/${campaignId}?tab=4`)
      }
    } catch (error) {
      console.error('Save schedule error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save schedule')
    }
  }

  const handleExportProposal = async () => {
    // Export is handled in ProposalSummary component
    console.log('Proposal exported')
  }

  // Use new builder data when active, otherwise use regular hooks
  const totalPrice = useNewScheduleBuilder && activeStep === 1 
    ? newBuilderScheduleData.analytics.spend 
    : getTotalPrice()
  const totalSlots = useNewScheduleBuilder && activeStep === 1
    ? newBuilderScheduleData.spots.length
    : getSlotCount()
  const remainingBudget = campaignBudget ? campaignBudget - totalPrice : null

  const handleApplyTemplate = (template: any) => {
    // Apply template logic
    toast.info(`Applying template: ${template.name}`)
    
    // Set campaign name if not already set
    if (!campaignName) {
      setCampaignName(`${template.name} - ${new Date().toLocaleDateString()}`)
    }
    
    // Move to show selection step
    setActiveStep(0)
    
    // TODO: Apply template filters to show selection
    // TODO: Pre-configure slot selection based on template items
  }

  // Memoize the onChange handler to prevent infinite re-renders
  const handleScheduleDataChange = useCallback((scheduleData: { spots: any[], analytics: { spend: number } }) => {
    setNewBuilderScheduleData(scheduleData)
  }, [])

  // State for real availability data
  const [showAvailability, setShowAvailability] = useState<Record<string, any>>({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  // Fetch real availability data when shows are selected
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!selectedShows || selectedShows.length === 0) {
        setShowAvailability({})
        return
      }

      setAvailabilityLoading(true)
      try {
        const showIds = selectedShows.map(s => s.id).join(',')
        const startDate = campaignStartDate 
          ? format(campaignStartDate, 'yyyy-MM-dd')
          : format(new Date(), 'yyyy-MM-dd')
        const endDate = campaignEndDate
          ? format(campaignEndDate, 'yyyy-MM-dd')
          : format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

        const response = await fetch(`/api/schedule-availability?showIds=${showIds}&startDate=${startDate}&endDate=${endDate}`)
        
        if (response.ok) {
          const data = await response.json()
          setShowAvailability(data.availability || {})
        } else {
          console.error('Failed to fetch availability:', response.statusText)
          setShowAvailability({})
        }
      } catch (error) {
        console.error('Error fetching availability:', error)
        setShowAvailability({})
      } finally {
        setAvailabilityLoading(false)
      }
    }

    fetchAvailability()
  }, [selectedShows, campaignStartDate, campaignEndDate])

  // Memoize the shows data to prevent re-creating on every render
  const memoizedShows = useMemo(() => {
    // If we're in enhanced mode and still loading, return empty array
    if (isEnhancedMode && (loadingSchedule || loading || availabilityLoading)) {
      return []
    }
    
    // Also ensure we have shows before mapping
    if (!selectedShows || selectedShows.length === 0) {
      return []
    }
    
    return selectedShows.map(show => {
      // Use real availability data if available, otherwise no availability
      const availability = showAvailability[show.id] || {}
      
      return {
        id: show.id,
        name: show.name || 'Unknown Show',
        audience: show.audience || show.monthlyDownloads || 100000,
        cpm: show.cpm || show.baseCPM || 25,
        impressions: show.monthlyDownloads || show.audience || 100000,
        availability,
        // Include monetization fields for rate card display
        pricingModel: show.pricingModel || 'cpm',
        preRollSpotCost: show.preRollSpotCost || 500,
        midRollSpotCost: show.midRollSpotCost || 750,
        postRollSpotCost: show.postRollSpotCost || 400,
        preRollCpm: show.preRollCpm || 25,
        midRollCpm: show.midRollCpm || 30,
        postRollCpm: show.postRollCpm || 20,
        avgEpisodeDownloads: show.avgEpisodeDownloads || 10000,
        preRollSlots: show.preRollSlots || 1,
        midRollSlots: show.midRollSlots || 2,
        postRollSlots: show.postRollSlots || 1
      }
    })
  }, [selectedShows, isEnhancedMode, loadingSchedule, loading, availabilityLoading, showAvailability]) // Re-compute when selectedShows or loading state changes

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_CREATE}>
      <DashboardLayout>
        {loading && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <CircularProgress size={60} />
            <Typography variant="h6">
              {scheduleId ? 'Loading existing schedule...' : 'Loading...'}
            </Typography>
          </Box>
        )}
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4, pb: campaignBudget && activeStep > 0 ? 12 : 4 }}>
          {/* Campaign Context Warning */}
          {!campaignId && !scheduleId && (
            <Alert 
              severity="warning" 
              sx={{ mb: 3 }}
              action={
                <Button 
                  color="inherit" 
                  size="small"
                  onClick={() => router.push('/campaigns')}
                >
                  Go to Campaigns
                </Button>
              }
            >
              <Typography variant="body1" fontWeight="medium">
                Campaign Required
              </Typography>
              <Typography variant="body2">
                A campaign is required to create schedules. Please select a campaign to continue.
              </Typography>
            </Alert>
          )}
          
          {/* Header */}
          <Box mb={4}>
            {campaignId && (
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => router.push(`/campaigns/${campaignId}?tab=4`)}
                sx={{ mb: 2 }}
              >
                Back to Campaign
              </Button>
            )}
            <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
              <CalendarIcon fontSize="large" />
              Schedule Builder
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {campaignId 
                ? 'Building schedule for campaign' 
                : scheduleId
                  ? 'Editing existing schedule'
                  : 'Please select a campaign to build a schedule'}
            </Typography>
            
            {/* Campaign Info */}
            <Grid container spacing={2} mt={2}>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="Campaign Name"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Enter campaign name..."
                />
              </Grid>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="Campaign Budget"
                  type="text"
                  value={campaignBudget ? campaignBudget.toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    // Remove commas and non-numeric characters except decimal point
                    const cleanValue = e.target.value.replace(/[^0-9.]/g, '')
                    const value = cleanValue ? parseFloat(cleanValue) : null
                    setCampaignBudget(value !== null && !isNaN(value) ? Math.round(value) : null)
                  }}
                  placeholder="Enter budget..."
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<TemplateIcon />}
                  onClick={() => setTemplateSelectorOpen(true)}
                  sx={{ height: '56px' }}
                >
                  Use Template
                </Button>
              </Grid>
            </Grid>
          </Box>

          {/* Progress Stepper */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stepper activeStep={activeStep}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>

          {/* Main Content */}
          <Box sx={{ position: 'relative' }}>
            {activeStep === 0 && (
              <>
                {/* Toggle for Basic/Advanced Mode */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                  <Button
                    variant={useAdvancedSelector ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setUseAdvancedSelector(!useAdvancedSelector)}
                    startIcon={<FilterIcon />}
                  >
                    {useAdvancedSelector ? 'Advanced Mode' : 'Basic Mode'} 
                  </Button>
                </Box>
                
                {/* Show Selector Component */}
                {useAdvancedSelector ? (
                  <ShowSelectorAdvanced
                    selectedShows={selectedShows}
                    onAddShow={addShow}
                    onRemoveShow={removeShow}
                  />
                ) : (
                  <ShowSelector
                    selectedShows={selectedShows}
                    onAddShow={addShow}
                    onRemoveShow={removeShow}
                  />
                )}
              </>
            )}

            {activeStep === 1 && (
              <>
                {/* Toggle for Calendar Mode */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
                  <Button
                    variant={useNewScheduleBuilder ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => {
                      setUseNewScheduleBuilder(!useNewScheduleBuilder)
                      if (useNewScheduleBuilder) {
                        setUseCalendarCentric(false)
                        setUseImprovedCalendar(false)
                      }
                    }}
                    startIcon={<CalendarIcon />}
                    color="secondary"
                  >
                    New Schedule Builder
                  </Button>
                  {!useNewScheduleBuilder && (
                    <>
                      <Button
                        variant={useCalendarCentric ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => {
                          setUseCalendarCentric(!useCalendarCentric)
                          if (!useCalendarCentric) {
                            setUseImprovedCalendar(false)
                          }
                        }}
                        startIcon={<CalendarIcon />}
                        color="primary"
                      >
                        Calendar-Centric
                      </Button>
                      {!useCalendarCentric && (
                        <Button
                          variant={useImprovedCalendar ? 'contained' : 'outlined'}
                          size="small"
                          onClick={() => setUseImprovedCalendar(!useImprovedCalendar)}
                          startIcon={<CalendarIcon />}
                        >
                          {useImprovedCalendar ? 'Improved Calendar' : 'Classic Calendar'} 
                        </Button>
                      )}
                    </>
                  )}
                </Box>
                
                {useNewScheduleBuilder ? (
                  <PodcastCampaignScheduleBuilder
                    shows={memoizedShows}
                    campaignBudget={campaignBudget || undefined}
                    campaignId={campaignId || undefined}
                    advertiserId={advertiserId || undefined}
                    campaignStartDate={campaignStartDate || undefined}
                    campaignEndDate={campaignEndDate || undefined}
                    onChange={handleScheduleDataChange}
                    initialSpots={isEnhancedMode && !loadingSchedule && enhancedHook.selectedItems.length > 0 ? enhancedHook.selectedItems.map(item => {
                      // Parse date string using timezone-safe utility
                      const dateStr = item.airDate.split('T')[0]
                      const localDate = createLocalDate(dateStr)
                      
                      return {
                        id: item.scheduleItemId || `${item.showId}-${item.placementType}-${item.airDate}-${Math.random()}`,
                        showId: item.showId,
                        date: localDate,
                        placementType: item.placementType,
                        price: item.negotiatedPrice || item.adjustedPrice,
                        episodeId: item.episodeId,
                        episodeTitle: item.episodeTitle,
                        episodeNumber: item.episodeNumber
                      }
                    }) : []}
                    onSave={async (scheduleData) => {
                      try {
                        // Debug logging for advertiser ID issue
                        console.log('Schedule save debug:', {
                          campaignId,
                          advertiserId,
                          campaignName,
                          scheduleId
                        })
                        
                        const formattedData = {
                          name: campaignName || 'Untitled Schedule',
                          campaignId: campaignId,
                          advertiserId: advertiserId === 'undefined' || advertiserId === 'null' || !advertiserId ? null : advertiserId,
                          totalBudget: campaignBudget,
                          startDate: scheduleData.spots.length > 0 
                            ? new Date(Math.min(...scheduleData.spots.map(s => new Date(s.date).getTime()))).toISOString()
                            : new Date().toISOString(),
                          endDate: scheduleData.spots.length > 0
                            ? new Date(Math.max(...scheduleData.spots.map(s => new Date(s.date).getTime()))).toISOString()
                            : new Date().toISOString(),
                          items: scheduleData.spots.map(spot => {
                            // Format date using timezone-safe utility
                            const date = spot.date instanceof Date ? spot.date : new Date(spot.date)
                            const dateString = formatDateKey(date)
                            
                            return {
                              showId: spot.showId,
                              airDate: dateString,
                              placementType: spot.placementType,
                              negotiatedPrice: spot.price,
                              price: spot.price,
                              rateCardPrice: spot.price
                            }
                          })
                        }

                        console.log('Formatted schedule data being sent:', formattedData)

                        const response = await fetch(
                          scheduleId ? `/api/schedules/${scheduleId}` : '/api/schedules',
                          {
                            method: scheduleId ? 'PUT' : 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(formattedData)
                          }
                        )

                        if (!response.ok) {
                          const errorText = await response.text()
                          console.error('Schedule save error response:', errorText)
                          try {
                            const errorJson = JSON.parse(errorText)
                            
                            // Handle 409 Conflict - existing schedule
                            if (response.status === 409 && errorJson.existingScheduleId) {
                              const confirmUpdate = confirm(
                                `A schedule "${errorJson.existingScheduleName}" already exists for this campaign. ` +
                                `Would you like to update the existing schedule instead?`
                              )
                              
                              if (confirmUpdate) {
                                // Retry the save as an update to the existing schedule
                                const updateResponse = await fetch(`/api/schedules/${errorJson.existingScheduleId}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(formattedData)
                                })
                                
                                if (!updateResponse.ok) {
                                  const updateErrorText = await updateResponse.text()
                                  console.error('Schedule update error response:', updateErrorText)
                                  throw new Error('Failed to update existing schedule')
                                }
                                
                                const updateResult = await updateResponse.json()
                                
                                // Update the schedule data state to reflect saved changes
                                const updatedScheduleData = {
                                  spots: scheduleData.spots,
                                  analytics: { 
                                    spend: scheduleData.spots.reduce((total, spot) => total + (spot.price || 0), 0)
                                  }
                                }
                                setNewBuilderScheduleData(updatedScheduleData)
                                
                                toast.success('Existing schedule updated successfully!')
                                return // Exit the function successfully
                              } else {
                                // User chose not to update existing schedule
                                toast.info('Schedule save cancelled - existing schedule unchanged')
                                return
                              }
                            }
                            
                            throw new Error(errorJson.error || 'Failed to save schedule')
                          } catch (e) {
                            if (e.message !== 'Failed to save schedule') {
                              throw e // Re-throw if it's our custom error with user choice handling
                            }
                            throw new Error('Failed to save schedule')
                          }
                        }

                        const result = await response.json()
                        
                        // Get the schedule ID from the result
                        const savedScheduleId = result.schedule?.id || result.id
                        
                        // Update the schedule data state to reflect saved changes
                        const updatedScheduleData = {
                          spots: scheduleData.spots,
                          analytics: { 
                            spend: scheduleData.spots.reduce((total, spot) => total + (spot.price || 0), 0)
                          }
                        }
                        setNewBuilderScheduleData(updatedScheduleData)
                        
                        // Update the URL to include the scheduleId so it persists when navigating back
                        if (savedScheduleId && !scheduleId) {
                          // Only update URL if we're creating a new schedule
                          setScheduleId(savedScheduleId)
                          
                          // Update URL without causing a full page reload
                          const newUrl = new URL(window.location.href)
                          newUrl.searchParams.set('scheduleId', savedScheduleId)
                          window.history.pushState({}, '', newUrl)
                        }
                        
                        toast.success('Schedule saved successfully!')
                      } catch (error) {
                        console.error('Save schedule error:', error)
                        toast.error(error instanceof Error ? error.message : 'Failed to save schedule')
                      }
                    }}
                  />
                ) : useCalendarCentric ? (
                  <CalendarCentricScheduleBuilder
                    inventory={isEnhancedMode ? enhancedHook.inventory : inventory}
                    selectedItems={isEnhancedMode ? enhancedHook.selectedItems : selectedSlots.map(slot => ({
                      ...slot,
                      negotiatedPrice: slot.price || 0,
                      rateCardPrice: slot.price || 0,
                      showName: selectedShows.find(s => s.id === slot.showId)?.name || '',
                      episodeTitle: slot.episodeTitle || '',
                      episodeNumber: slot.episodeNumber || 0
                    }))}
                    onAddItem={(slot, negotiatedPrice, spotType) => {
                      addSlot({ ...slot, price: negotiatedPrice, spotType })
                    }}
                    onRemoveItem={(itemId) => removeSlot(itemId)}
                    onUpdatePrice={(itemId, price) => {
                      // TODO: Implement price update
                      console.log('Update price:', itemId, price)
                    }}
                    onUpdateSpotType={(itemId, spotType) => {
                      // TODO: Implement spot type update
                      console.log('Update spot type:', itemId, spotType)
                    }}
                    onMoveItem={(itemId, newDate) => {
                      // TODO: Implement move item
                      console.log('Move item:', itemId, newDate)
                    }}
                    loading={loading}
                    campaignBudget={campaignBudget || undefined}
                    shows={selectedShows}
                    onShowsChange={(shows) => {
                      // Update shows if needed
                      console.log('Shows changed:', shows)
                    }}
                  />
                ) : useImprovedCalendar ? (
                  <ImprovedScheduleCalendar
                    inventory={isEnhancedMode ? enhancedHook.inventory : inventory}
                    selectedItems={isEnhancedMode ? enhancedHook.selectedItems : selectedSlots.map(slot => ({
                      ...slot,
                      negotiatedPrice: slot.price || 0,
                      rateCardPrice: slot.price || 0,
                      showName: selectedShows.find(s => s.id === slot.showId)?.name || '',
                      episodeTitle: slot.episodeTitle || '',
                      episodeNumber: slot.episodeNumber || 0
                    }))}
                    onAddItem={(slot) => addSlot(slot)}
                    onRemoveItem={(itemId) => removeSlot(itemId)}
                    onUpdatePrice={(itemId, price) => {
                      // TODO: Implement price update
                      console.log('Update price:', itemId, price)
                    }}
                    onMoveItem={(itemId, newDate) => {
                      // TODO: Implement move item
                      console.log('Move item:', itemId, newDate)
                    }}
                    loading={loading}
                    filters={{
                      campaignId: campaignId || undefined
                    }}
                    onFiltersChange={(filters) => {
                      // TODO: Implement filter handling
                      console.log('Filters changed:', filters)
                    }}
                    campaignBudget={campaignBudget || undefined}
                    shows={selectedShows}
                  />
                ) : (
                  <DraggableInventoryCalendar
                    selectedShows={selectedShows}
                    inventory={inventory}
                    selectedSlots={selectedSlots}
                    onAddSlot={addSlot}
                    onRemoveSlot={removeSlot}
                    onMoveSlot={moveSlot}
                    loading={loading}
                    campaignBudget={campaignBudget}
                    remainingBudget={remainingBudget}
                  />
                )}
              </>
            )}

            {activeStep === 2 && (
              <ProposalSummary
                campaignName={campaignName}
                campaignBudget={campaignBudget}
                campaignId={campaignId}
                advertiserId={advertiserId}
                scheduleId={scheduleId}
                selectedShows={selectedShows}
                selectedSlots={useNewScheduleBuilder && newBuilderScheduleData.spots.length > 0 
                  ? newBuilderScheduleData.spots.map(spot => ({
                      id: spot.id || `${spot.showId}-${spot.placementType}-${spot.date}`,
                      showId: spot.showId,
                      showName: selectedShows.find(s => s.id === spot.showId)?.name || 'Unknown Show',
                      episodeId: spot.episodeId || '',
                      episodeNumber: spot.episodeNumber || 0,
                      episodeTitle: spot.episodeTitle || 'TBD',
                      airDate: spot.date instanceof Date ? spot.date.toISOString() : spot.date,
                      placementType: spot.placementType,
                      price: spot.price || 0,
                      quantity: spot.quantity || 1,
                      estimatedImpressions: spot.estimatedImpressions || 10000
                    }))
                  : isEnhancedMode ? enhancedHook.selectedItems.map(item => ({
                      ...item,
                      price: item.negotiatedPrice || item.rateCardPrice || item.basePrice || 0,
                      quantity: item.quantity || 1,
                      estimatedImpressions: item.estimatedImpressions || 0,
                      episodeNumber: item.episodeNumber || 0,
                      episodeTitle: item.episodeTitle || 'TBD'
                    })) : selectedSlots}
                totalPrice={totalPrice}
                onSave={isEnhancedMode ? async () => {
                  try {
                    await enhancedHook.saveSchedule({
                      name: campaignName || 'Untitled Schedule',
                      campaignId: campaignId || undefined,
                      advertiserId: advertiserId || enhancedHook.schedule?.advertiserId || '',
                      totalBudget: campaignBudget || undefined,
                      startDate: selectedSlots.length > 0 
                        ? new Date(Math.min(...selectedSlots.map(s => new Date(s.airDate).getTime()))).toISOString()
                        : new Date().toISOString(),
                      endDate: selectedSlots.length > 0
                        ? new Date(Math.max(...selectedSlots.map(s => new Date(s.airDate).getTime()))).toISOString()
                        : new Date().toISOString(),
                      status: enhancedHook.schedule?.status || 'draft'
                    })
                    toast.success('Schedule saved successfully!')
                    // Navigate to Review & Export step
                    setActiveStep(2)
                  } catch (error) {
                    console.error('Save error:', error)
                    toast.error('Failed to save schedule')
                  }
                } : handleSaveProposal}
                onExport={handleExportProposal}
              />
            )}

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                disabled={activeStep === 0}
                onClick={handleBack}
                startIcon={<ArrowBackIcon />}
              >
                Back
              </Button>
              
              {activeStep < steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  endIcon={<ArrowForwardIcon />}
                >
                  Next
                </Button>
              ) : null}
            </Box>
          </Box>


          {/* Budget Status Bar */}
          {campaignBudget && activeStep > 0 && (
            <Paper
              sx={{
                position: 'fixed',
                bottom: 0,
                left: { xs: 0, md: 240 }, // Account for sidebar on desktop
                right: 0,
                p: 2,
                zIndex: 1100,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}
              elevation={3}
            >
              <Container maxWidth="xl">
                <Grid container alignItems="center" spacing={2} sx={{ pl: { md: 3 } }}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      Campaign Budget
                    </Typography>
                    <Typography variant="h6">
                      ${campaignBudget.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      Current Total
                    </Typography>
                    <Typography variant="h6" color={totalPrice > campaignBudget ? 'error.main' : 'primary.main'}>
                      ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="text.secondary">
                      Remaining
                    </Typography>
                    <Typography 
                      variant="h6" 
                      color={remainingBudget && remainingBudget < 0 ? 'error.main' : 'success.main'}
                    >
                      ${remainingBudget !== null && remainingBudget !== undefined ? remainingBudget.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}
                    </Typography>
                  </Grid>
                </Grid>
              </Container>
            </Paper>
          )}

          {/* Template Selector Dialog */}
          <TemplateSelector
            open={templateSelectorOpen}
            onClose={() => setTemplateSelectorOpen(false)}
            onSelectTemplate={handleApplyTemplate}
            campaignBudget={campaignBudget}
          />
        </Container>
      </DashboardLayout>
    </RouteProtection>
  )
}