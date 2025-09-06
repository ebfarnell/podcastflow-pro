'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Chip,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert
} from '@mui/material'
import {
  CalendarMonth as CalendarIcon,
  RadioButtonUnchecked,
  RadioButtonChecked,
  Add as AddIcon,
  Remove as RemoveIcon,
  DragIndicator as DragIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Clear as ClearIcon
} from '@mui/icons-material'
import { format, startOfWeek, addDays, isSameDay, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addWeeks, isSameWeek, eachWeekOfInterval } from 'date-fns'
import { BulkScheduleModal, BulkScheduleConfig } from './BulkScheduleModal'
import { BulkPlacementPanel } from './BulkPlacementPanel'
import { createLocalDate, formatDateKey, getFirstDayOfMonth, normalizeToNoon } from '@/lib/utils/date-utils'

interface Show {
  id: string
  name: string
  audience: number
  cpm: number // Legacy field, kept for backward compatibility
  impressions: number
  color?: string
  // Monetization fields from database
  pricingModel?: 'cpm' | 'spot' | 'both'
  preRollCpm?: number
  midRollCpm?: number
  postRollCpm?: number
  preRollSpotCost?: number
  midRollSpotCost?: number
  postRollSpotCost?: number
  preRollSlots?: number
  midRollSlots?: number
  postRollSlots?: number
  avgEpisodeDownloads?: number
  availability?: {
    [key: string]: { // date string as key
      preRoll: boolean
      midRoll: boolean
      postRoll: boolean
    }
  }
}

interface PlacementType {
  type: 'pre-roll' | 'mid-roll' | 'post-roll'
  label: string
}

interface ScheduledSpot {
  id: string
  showId: string
  date: Date
  placementType: 'pre-roll' | 'mid-roll' | 'post-roll'
  price: number
  episodeId?: string
  episodeTitle?: string
  episodeNumber?: number
}

interface SelectedPlacement {
  showId: string
  placementType: 'pre-roll' | 'mid-roll' | 'post-roll'
}

interface PodcastCampaignScheduleBuilderProps {
  shows?: Show[]
  onSave?: (schedule: any) => void
  campaignBudget?: number
  campaignId?: string
  advertiserId?: string
  agencyId?: string
  campaignStartDate?: Date
  campaignEndDate?: Date
  onChange?: (scheduleData: { spots: ScheduledSpot[], analytics: { spend: number } }) => void
  initialSpots?: ScheduledSpot[]
}

const placementTypes: PlacementType[] = [
  { type: 'pre-roll', label: 'Pre-Roll' },
  { type: 'mid-roll', label: 'Mid-Roll' },
  { type: 'post-roll', label: 'Post-Roll' }
]

export function PodcastCampaignScheduleBuilder({
  shows = [],
  onSave,
  campaignBudget,
  campaignId,
  advertiserId,
  agencyId,
  campaignStartDate,
  campaignEndDate,
  onChange,
  initialSpots = []
}: PodcastCampaignScheduleBuilderProps) {
  const [selectedPlacements, setSelectedPlacements] = useState<SelectedPlacement[]>([])
  const [currentMonth, setCurrentMonth] = useState(getFirstDayOfMonth(new Date()))
  const [scheduledSpots, setScheduledSpots] = useState<ScheduledSpot[]>(initialSpots)
  const [loading, setLoading] = useState(false)
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false)
  const [bulkPlacementOpen, setBulkPlacementOpen] = useState(false)
  const [draggedSpot, setDraggedSpot] = useState<ScheduledSpot | null>(null)
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null)
  const [analyticsExpanded, setAnalyticsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('schedule-builder-analytics-expanded')
      return saved !== null ? JSON.parse(saved) : false
    }
    return false
  })
  const [campaignSummaryExpanded, setCampaignSummaryExpanded] = useState(true)
  const [showColors, setShowColors] = useState<Record<string, string>>({})
  const [placementSelectionOpen, setPlacementSelectionOpen] = useState(false)
  const [placementSelectionDate, setPlacementSelectionDate] = useState<Date | null>(null)
  const [availablePlacementsForSelection, setAvailablePlacementsForSelection] = useState<SelectedPlacement[]>([])
  const [selectedPlacementsInDialog, setSelectedPlacementsInDialog] = useState<Set<number>>(new Set())
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null)
  const [selectedPlacementType, setSelectedPlacementType] = useState<'pre-roll' | 'mid-roll' | 'post-roll' | null>(null)
  const [showSpecificRates, setShowSpecificRates] = useState<Record<string, { preRoll: number; midRoll: number; postRoll: number }>>({})
  const [rateCard, setRateCard] = useState({
    preRoll: 250,
    midRoll: 500,
    postRoll: 200
  })
  const [analytics, setAnalytics] = useState({
    cpm: 25,
    impressions: 0,
    spend: 0,
    revenue: 0
  })

  // Initialize show-specific rates from monetization settings
  useEffect(() => {
    const rates: Record<string, { preRoll: number; midRoll: number; postRoll: number }> = {}
    
    shows.forEach(show => {
      if (show.pricingModel === 'spot' || show.pricingModel === 'both') {
        // Use spot pricing directly
        rates[show.id] = {
          preRoll: show.preRollSpotCost || 250,
          midRoll: show.midRollSpotCost || 500,
          postRoll: show.postRollSpotCost || 200
        }
      } else {
        // Convert CPM to spot pricing based on average downloads
        const avgDownloads = show.avgEpisodeDownloads || 0
        rates[show.id] = {
          preRoll: ((show.preRollCpm || 25) * avgDownloads) / 1000,
          midRoll: ((show.midRollCpm || 30) * avgDownloads) / 1000,
          postRoll: ((show.postRollCpm || 20) * avgDownloads) / 1000
        }
      }
    })
    
    setShowSpecificRates(rates)
  }, [shows])

  // Generate unique colors for shows
  const getShowColor = useCallback((showId: string) => {
    if (showColors[showId]) {
      return showColors[showId]
    }
    
    // Extended color palette for better distinction
    const colors = [
      '#1976d2', // Blue
      '#388e3c', // Green
      '#d32f2f', // Red
      '#f57c00', // Orange
      '#7b1fa2', // Purple
      '#0288d1', // Light Blue
      '#689f38', // Light Green
      '#e64a19', // Deep Orange
      '#00796b', // Teal
      '#c2185b', // Pink
      '#5d4037', // Brown
      '#455a64', // Blue Grey
      '#fbc02d', // Yellow
      '#303f9f', // Indigo
      '#0097a7'  // Cyan
    ]
    const index = Object.keys(showColors).length % colors.length
    return colors[index]
  }, [showColors])
  
  // Initialize show colors on mount
  useEffect(() => {
    const newColors: Record<string, string> = {}
    const colors = [
      '#1976d2', '#388e3c', '#d32f2f', '#f57c00', '#7b1fa2',
      '#0288d1', '#689f38', '#e64a19', '#00796b', '#c2185b',
      '#5d4037', '#455a64', '#fbc02d', '#303f9f', '#0097a7'
    ]
    
    shows.forEach((show, index) => {
      newColors[show.id] = colors[index % colors.length]
    })
    
    setShowColors(newColors)
  }, [shows])

  // Track previous spend to avoid unnecessary onChange calls
  const prevSpendRef = useRef<number>(0)
  
  // Track if initial spots have been loaded to prevent reloading
  const [initialSpotsLoaded, setInitialSpotsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Auto-dismiss success messages after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])
  
  // Update scheduled spots when initialSpots changes (for async loading)
  useEffect(() => {
    if (initialSpots.length > 0 && !initialSpotsLoaded) {
      // Normalize all dates to noon to avoid timezone issues
      const normalizedSpots = initialSpots.map(spot => ({
        ...spot,
        date: normalizeToNoon(spot.date)
      }))
      
      setScheduledSpots(normalizedSpots)
      setInitialSpotsLoaded(true)
      
      // Also set the currentMonth to show the first spot's month
      if (normalizedSpots[0]) {
        setCurrentMonth(getFirstDayOfMonth(normalizedSpots[0].date))
      }
      
      // Note: Removed auto-selection of placements from initial spots
      // Users will start with no placements selected and must manually select them
      // to add more spots to the schedule
    }
  }, [initialSpots])
  
  // Update rate card when selectedShowId changes
  useEffect(() => {
    if (selectedShowId) {
      const show = shows.find(s => s.id === selectedShowId)
      if (show) {
        // Use actual monetization settings from database
        if (show.pricingModel === 'spot' || show.pricingModel === 'both') {
          setRateCard({
            preRoll: show.preRollSpotCost || 500,
            midRoll: show.midRollSpotCost || 750,
            postRoll: show.postRollSpotCost || 400
          })
        } else {
          // For CPM pricing, calculate spot equivalent based on avg downloads
          const avgDownloads = show.avgEpisodeDownloads || 10000
          setRateCard({
            preRoll: Math.round(((show.preRollCpm || 25) * avgDownloads) / 1000),
            midRoll: Math.round(((show.midRollCpm || 30) * avgDownloads) / 1000),
            postRoll: Math.round(((show.postRollCpm || 20) * avgDownloads) / 1000)
          })
        }
      }
    }
  }, [selectedShowId, shows])
  
  // Calculate analytics based on scheduled spots
  useEffect(() => {
    const totalSpend = scheduledSpots.reduce((sum, spot) => sum + spot.price, 0)
    const totalImpressions = scheduledSpots.length * 10000 // Example calculation
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 25

    const newAnalytics = {
      cpm: avgCPM,
      impressions: totalImpressions,
      spend: totalSpend,
      revenue: totalSpend * 1.2 // Example margin
    }
    
    setAnalytics(newAnalytics)
    
    // Only call onChange if spend actually changed
    if (onChange && prevSpendRef.current !== totalSpend) {
      prevSpendRef.current = totalSpend
      onChange({
        spots: scheduledSpots,
        analytics: { spend: totalSpend }
      })
    }
  }, [scheduledSpots, onChange])

  const handlePlacementSelect = (showId: string, placement: 'pre-roll' | 'mid-roll' | 'post-roll') => {
    const existingIndex = selectedPlacements.findIndex(
      p => p.showId === showId && p.placementType === placement
    )
    
    if (existingIndex >= 0) {
      // Remove if already selected
      setSelectedPlacements(prev => prev.filter((_, index) => index !== existingIndex))
    } else {
      // Add to selection
      setSelectedPlacements(prev => [...prev, { showId, placementType: placement }])
      
      // Update rate card based on selected show's monetization settings
      const show = shows.find(s => s.id === showId)
      if (show) {
        // Use actual monetization settings from database
        if (show.pricingModel === 'spot' || show.pricingModel === 'both') {
          setRateCard({
            preRoll: show.preRollSpotCost || 250,
            midRoll: show.midRollSpotCost || 500,
            postRoll: show.postRollSpotCost || 200
          })
        } else {
          // For CPM pricing, calculate spot equivalent based on avg downloads
          const avgDownloads = show.avgEpisodeDownloads || 0
          setRateCard({
            preRoll: ((show.preRollCpm || 25) * avgDownloads) / 1000,
            midRoll: ((show.midRollCpm || 30) * avgDownloads) / 1000,
            postRoll: ((show.postRollCpm || 20) * avgDownloads) / 1000
          })
        }
      }
    }
  }
  
  const isPlacementSelected = (showId: string, placement: 'pre-roll' | 'mid-roll' | 'post-roll') => {
    return selectedPlacements.some(
      p => p.showId === showId && p.placementType === placement
    )
  }

  const handleDateClick = (date: Date) => {
    if (selectedPlacements.length === 0) {
      setError('Please select at least one show and placement type first')
      return
    }

    // Normalize the date to noon to avoid timezone issues
    const normalizedDate = normalizeToNoon(date)
    const dateKey = format(normalizedDate, 'yyyy-MM-dd')
    
    // Check which selected placements have availability on this date
    const availablePlacements = selectedPlacements.filter(placement => {
      const show = shows.find(s => s.id === placement.showId)
      if (!show?.availability) return false
      
      const availability = show.availability[dateKey]
      if (!availability) {
        // No episode scheduled on this date for this show
        return false
      }
      
      // Convert placement type to match availability data keys (camelCase)
      let placementKey: 'preRoll' | 'midRoll' | 'postRoll'
      switch (placement.placementType) {
        case 'pre-roll':
          placementKey = 'preRoll'
          break
        case 'mid-roll':
          placementKey = 'midRoll'
          break
        case 'post-roll':
          placementKey = 'postRoll'
          break
        default:
          placementKey = 'preRoll'
      }
      
      return availability[placementKey]
    })
    
    if (availablePlacements.length === 0) {
      // Get show names that don't have episodes on this date
      const unavailableShows = selectedPlacements
        .filter(placement => {
          const show = shows.find(s => s.id === placement.showId)
          return !show?.availability || !show.availability[dateKey]
        })
        .map(placement => {
          const show = shows.find(s => s.id === placement.showId)
          return show?.name || 'Unknown Show'
        })
      
      const uniqueShows = [...new Set(unavailableShows)]
      
      setError(`No scheduled episodes on ${format(date, 'MMM d')} for: ${uniqueShows.join(', ')}. Spots can only be placed on days with scheduled episodes.`)
      return
    }
    
    if (availablePlacements.length === 1) {
      // Only one placement available, proceed as before
      const placement = availablePlacements[0]
      const showRates = showSpecificRates[placement.showId] || rateCard
      const price = showRates[placement.placementType === 'pre-roll' ? 'preRoll' : placement.placementType === 'mid-roll' ? 'midRoll' : 'postRoll']
      
      // Check if spot already exists
      const existingIndex = scheduledSpots.findIndex(
        spot => isSameDay(spot.date, normalizedDate) && 
                spot.showId === placement.showId && 
                spot.placementType === placement.placementType
      )

      if (existingIndex >= 0) {
        // Remove existing spot
        setScheduledSpots(prev => prev.filter((_, index) => index !== existingIndex))
      } else {
        // Add new spot
        // Get episode info from availability data
        const show = shows.find(s => s.id === placement.showId)
        const episodeInfo = show?.availability?.[dateKey]
        
        const newSpot: ScheduledSpot = {
          id: `${Date.now()}-${placement.showId}-${placement.placementType}-${Math.random()}`,
          showId: placement.showId,
          date: normalizedDate,
          placementType: placement.placementType,
          price,
          episodeId: episodeInfo?.episodeId,
          episodeTitle: episodeInfo?.episodeTitle,
          episodeNumber: episodeInfo?.episodeNumber
        }
        setScheduledSpots(prev => [...prev, newSpot])
      }
    } else {
      // Multiple placements available, show selection dialog
      setAvailablePlacementsForSelection(availablePlacements)
      setPlacementSelectionDate(normalizedDate)
      
      // Check which placements are already scheduled for this date
      const scheduledForDate = scheduledSpots.filter(spot => isSameDay(spot.date, normalizedDate))
      const selectedIndexes = new Set<number>()
      
      availablePlacements.forEach((placement, index) => {
        const isScheduled = scheduledForDate.some(
          spot => spot.showId === placement.showId && 
                  spot.placementType === placement.placementType
        )
        if (isScheduled) {
          selectedIndexes.add(index)
        }
      })
      
      setSelectedPlacementsInDialog(selectedIndexes)
      setPlacementSelectionOpen(true)
    }
  }

  const handlePlacementSelection = (selectedPlacements: SelectedPlacement[]) => {
    if (!placementSelectionDate) return
    
    // Get all current spots for this date
    const spotsForDate = scheduledSpots.filter(spot => isSameDay(spot.date, placementSelectionDate))
    
    // Create a new array with all spots except those on the selected date
    const spotsFromOtherDates = scheduledSpots.filter(spot => !isSameDay(spot.date, placementSelectionDate))
    
    // Create new spots for all selected placements
    const newSpotsForDate: ScheduledSpot[] = []
    
    selectedPlacements.forEach(placement => {
      const showRates = showSpecificRates[placement.showId] || rateCard
      const price = showRates[placement.placementType === 'pre-roll' ? 'preRoll' : placement.placementType === 'mid-roll' ? 'midRoll' : 'postRoll']
      
      // Check if spot already exists
      const existingSpot = spotsForDate.find(
        spot => spot.showId === placement.showId && 
                spot.placementType === placement.placementType
      )

      if (existingSpot) {
        // Keep existing spot with its current data
        newSpotsForDate.push(existingSpot)
      } else {
        // Create new spot
        // Get episode info from availability data
        const show = shows.find(s => s.id === placement.showId)
        const dateKey = format(placementSelectionDate, 'yyyy-MM-dd')
        const episodeInfo = show?.availability?.[dateKey]
        
        const newSpot: ScheduledSpot = {
          id: `${Date.now()}-${placement.showId}-${placement.placementType}-${Math.random()}`,
          showId: placement.showId,
          date: placementSelectionDate,
          placementType: placement.placementType,
          price,
          episodeId: episodeInfo?.episodeId,
          episodeTitle: episodeInfo?.episodeTitle,
          episodeNumber: episodeInfo?.episodeNumber
        }
        newSpotsForDate.push(newSpot)
      }
    })
    
    // Update all spots at once by combining other dates with new spots for selected date
    setScheduledSpots([...spotsFromOtherDates, ...newSpotsForDate])
    
    setPlacementSelectionOpen(false)
    setPlacementSelectionDate(null)
    setAvailablePlacementsForSelection([])
  }

  const [clearMonthDialogOpen, setClearMonthDialogOpen] = useState(false)
  
  const handleClearMonth = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    
    // Count spots that will be removed
    const spotsToRemove = scheduledSpots.filter(spot => {
      const spotDate = new Date(spot.date)
      return isWithinInterval(spotDate, { start: monthStart, end: monthEnd })
    }).length
    
    // Filter out all spots that are within the current month
    setScheduledSpots(prev => prev.filter(spot => {
      const spotDate = new Date(spot.date)
      return !isWithinInterval(spotDate, { start: monthStart, end: monthEnd })
    }))
    
    setSuccess(`Cleared ${spotsToRemove} spots from ${format(currentMonth, 'MMMM yyyy')}`)
    setClearMonthDialogOpen(false)
  }

  const handleClearWeek = (weekStartDate: Date) => {
    const weekEnd = addDays(weekStartDate, 6)
    const weekDateStr = `${format(weekStartDate, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
    
    // Count spots that will be removed
    const spotsToRemove = scheduledSpots.filter(spot => {
      const spotDate = new Date(spot.date)
      return isWithinInterval(spotDate, { start: weekStartDate, end: weekEnd })
    }).length
    
    if (spotsToRemove === 0) {
      setError(`No spots to clear in the week of ${weekDateStr}`)
      return
    }
    
    if (window.confirm(`Are you sure you want to clear ${spotsToRemove} spot(s) from the week of ${weekDateStr}?`)) {
      setScheduledSpots(prev => prev.filter(spot => {
        const spotDate = new Date(spot.date)
        return !isWithinInterval(spotDate, { start: weekStartDate, end: weekEnd })
      }))
      
      setSuccess(`Cleared ${spotsToRemove} spots from the week of ${weekDateStr}`)
    }
  }

  const handleBulkSchedule = (config: BulkScheduleConfig) => {
    console.log('Bulk schedule config:', config)
    
    // Use the date range from config
    const scheduleStart = config.dateRange.start
    const scheduleEnd = config.dateRange.end
    
    // Get all days in the date range
    const allDaysInRange = eachDayOfInterval({ start: scheduleStart, end: scheduleEnd })
    
    // Filter days based on day preferences
    const dayMap = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    }
    
    // Group days by week
    const weekGroups: Date[][] = []
    let currentWeek: Date[] = []
    let currentWeekStart: Date | null = null
    
    allDaysInRange.forEach(day => {
      const weekStart = startOfWeek(day, { weekStartsOn: 1 })
      
      // Check if this day is in an eligible day of week
      const dayName = dayMap[getDay(day) as keyof typeof dayMap]
      const isDayEligible = config.dayPreferences[dayName as keyof typeof config.dayPreferences]
      
      if (!isDayEligible) return
      
      // Check if we're in a new week
      if (!currentWeekStart || !isSameWeek(currentWeekStart, weekStart, { weekStartsOn: 1 })) {
        if (currentWeek.length > 0) {
          weekGroups.push(currentWeek)
        }
        currentWeek = []
        currentWeekStart = weekStart
      }
      
      currentWeek.push(day)
    })
    
    // Add the last week if it has days
    if (currentWeek.length > 0) {
      weekGroups.push(currentWeek)
    }
    
    // If specific weeks are selected, filter to only those weeks
    let eligibleWeekGroups = weekGroups
    if (config.selectedWeeks && config.selectedWeeks.length > 0) {
      eligibleWeekGroups = weekGroups.filter((_, index) => config.selectedWeeks?.includes(index))
    }
    
    console.log(`Processing ${eligibleWeekGroups.length} weeks with ${config.spotsPerWeek} spots per week`)
    
    // Function to check if a show has availability for a specific placement on a specific date
    const hasAvailability = (showId: string, date: Date, placementType: 'pre-roll' | 'mid-roll' | 'post-roll'): boolean => {
      const show = shows.find(s => s.id === showId)
      if (!show?.availability) return false
      
      const dateKey = format(date, 'yyyy-MM-dd')
      const availability = show.availability[dateKey]
      if (!availability) return false
      
      // Convert placement type to match availability data keys (camelCase)
      let placementKey: 'preRoll' | 'midRoll' | 'postRoll'
      switch (placementType) {
        case 'pre-roll':
          placementKey = 'preRoll'
          break
        case 'mid-roll':
          placementKey = 'midRoll'
          break
        case 'post-roll':
          placementKey = 'postRoll'
          break
      }
      
      return availability[placementKey] === true
    }
    
    // Track spots per show to ensure even distribution
    const spotsPerShow: Record<string, number> = {}
    config.showIds.forEach(id => { spotsPerShow[id] = 0 })
    
    // Calculate total spots to distribute
    const totalSpotsNeeded = config.spotsPerWeek * eligibleWeekGroups.length
    const targetSpotsPerShow = Math.floor(totalSpotsNeeded / config.showIds.length)
    
    // Create spots for each week
    const newSpots: ScheduledSpot[] = []
    
    eligibleWeekGroups.forEach((weekDays, weekIndex) => {
      console.log(`Processing week ${weekIndex + 1} with ${weekDays.length} eligible days`)
      
      // Track spots placed this week
      let spotsPlacedThisWeek = 0
      const targetSpotsThisWeek = config.spotsPerWeek
      
      // Calculate spots per placement type for this week
      const placementTypesEnabled = Object.values(config.placementTypes).filter(Boolean).length
      if (placementTypesEnabled === 0) return
      
      const spotsPerPlacementType = Math.ceil(targetSpotsThisWeek / placementTypesEnabled)
      
      // Try to place spots for each enabled placement type
      Object.entries(config.placementTypes).forEach(([placement, enabled]) => {
        if (!enabled) return
        
        const placementType = placement.replace('Roll', '-roll') as 'pre-roll' | 'mid-roll' | 'post-roll'
        let spotsPlacedForThisType = 0
        const targetForThisType = Math.min(
          spotsPerPlacementType,
          targetSpotsThisWeek - spotsPlacedThisWeek
        )
        
        // Try to distribute spots evenly across shows
        const showRotation = [...config.showIds].sort((a, b) => spotsPerShow[a] - spotsPerShow[b])
        
        // Try each day in the week multiple times if needed
        for (let attempt = 0; attempt < weekDays.length * 2 && spotsPlacedForThisType < targetForThisType; attempt++) {
          const dayIndex = attempt % weekDays.length
          const day = weekDays[dayIndex]
          
          // Try each show in rotation
          for (const showId of showRotation) {
            if (spotsPlacedForThisType >= targetForThisType) break
            
            // Check if we can place a spot here
            if (hasAvailability(showId, day, placementType)) {
              // Check if this exact spot isn't already scheduled
              const alreadyScheduled = scheduledSpots.some(spot => 
                isSameDay(spot.date, day) && 
                spot.showId === showId && 
                spot.placementType === placementType
              ) || newSpots.some(spot => 
                isSameDay(spot.date, day) && 
                spot.showId === showId && 
                spot.placementType === placementType
              )
              
              if (!alreadyScheduled) {
                const showRates = showSpecificRates[showId] || rateCard
                const price = showRates[placement as keyof typeof rateCard]
                
                newSpots.push({
                  id: `bulk-${Date.now()}-${showId}-${placementType}-w${weekIndex}-${Math.random()}`,
                  showId: showId,
                  date: normalizedDate,
                  placementType,
                  price
                })
                
                spotsPerShow[showId]++
                spotsPlacedForThisType++
                spotsPlacedThisWeek++
                
                // Re-sort shows by spot count for next iteration
                showRotation.sort((a, b) => spotsPerShow[a] - spotsPerShow[b])
                break // Move to next day/attempt
              }
            }
          }
        }
        
        if (spotsPlacedForThisType < targetForThisType) {
          console.warn(`Could only place ${spotsPlacedForThisType} of ${targetForThisType} ${placement} spots in week ${weekIndex + 1}`)
        }
      })
      
      console.log(`Placed ${spotsPlacedThisWeek} spots in week ${weekIndex + 1}`)
    })
    
    // Log distribution summary
    console.log('Spots distribution per show:', spotsPerShow)
    console.log(`Total spots created: ${newSpots.length}`)
    
    setScheduledSpots(prev => [...prev, ...newSpots])
    setSuccess(`Added ${newSpots.length} spots to the schedule across ${eligibleWeekGroups.length} weeks`)
  }
  const handleDragStart = (e: React.DragEvent, spot: ScheduledSpot) => {
    e.stopPropagation() // Prevent event bubbling
    setDraggedSpot(spot)
    e.dataTransfer.effectAllowed = 'move'
    // Store the spot ID in data transfer for extra safety
    e.dataTransfer.setData('text/plain', spot.id)
  }

  const handleDragOver = (e: React.DragEvent, date: Date) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(date)
  }

  const handleDragLeave = () => {
    setDragOverDate(null)
  }

  const handleBulkPlacementCommit = (newSpots: any[]) => {
    // Convert spots from API format to ScheduledSpot format
    const convertedSpots: ScheduledSpot[] = newSpots.map(spot => ({
      id: spot.id,
      showId: spot.showId,
      date: normalizeToNoon(new Date(spot.date)),
      placementType: spot.placementType as 'pre-roll' | 'mid-roll' | 'post-roll',
      price: spot.price || 0
    }))
    
    // Add new spots to the schedule
    setScheduledSpots(prev => [...prev, ...convertedSpots])
    setBulkPlacementOpen(false)
    setSuccess(`Successfully placed ${convertedSpots.length} spots via inventory-aware bulk placement`)
  }

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault()
    setDragOverDate(null)
    
    if (!draggedSpot) {
      return
    }
    
    // Normalize the target date to avoid timezone issues
    const normalizedTargetDate = normalizeToNoon(date)
    
    // Check if dropping on same date
    if (isSameDay(draggedSpot.date, normalizedTargetDate)) {
      setDraggedSpot(null)
      return
    }
    
    // Update only the specific dragged spot with new date
    setScheduledSpots(prev => prev.map(spot => 
      spot.id === draggedSpot.id 
        ? { ...spot, date: normalizedTargetDate }
        : spot
    ))
    
    setDraggedSpot(null)
  }

  const renderCalendarGrid = () => {
    const firstDayOfMonth = getFirstDayOfMonth(currentMonth)
    // Use Sunday as start of week (index 0) to ensure consistent alignment
    const startDate = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 })
    const weeks = []

    for (let week = 0; week < 6; week++) {
      const days = []
      for (let day = 0; day < 7; day++) {
        // Calculate the exact date for this calendar cell
        const date = addDays(startDate, week * 7 + day)
        // Ensure we're working with noon to avoid timezone issues
        const normalizedDate = normalizeToNoon(date)
        const isCurrentMonth = normalizedDate.getMonth() === currentMonth.getMonth()
        const spotsOnDay = scheduledSpots.filter(spot => isSameDay(spot.date, normalizedDate))
        
        // Check which shows have availability on this date for selected placements
        // Use the normalized date for consistent key formatting
        const dateKey = formatDateKey(normalizedDate)
        const availableShowsForDate: Array<{show: Show, placements: string[]}> = []
        
        // Check availability for each selected placement
        selectedPlacements.forEach(selected => {
          const show = shows.find(s => s.id === selected.showId)
          if (!show) {
            return
          }
          if (!show.availability) {
            return
          }
          if (!show.availability[dateKey]) {
            // Don't log this - too noisy for dates without data
            return
          }
          
          const availability = show.availability[dateKey]
          // Convert placement type to match availability data keys (camelCase)
          let placementKey: 'preRoll' | 'midRoll' | 'postRoll'
          switch (selected.placementType) {
            case 'pre-roll':
              placementKey = 'preRoll'
              break
            case 'mid-roll':
              placementKey = 'midRoll'
              break
            case 'post-roll':
              placementKey = 'postRoll'
              break
            default:
              placementKey = 'preRoll'
          }
          
          if (availability[placementKey]) {
            const existing = availableShowsForDate.find(a => a.show.id === show.id)
            if (existing) {
              existing.placements.push(selected.placementType)
            } else {
              availableShowsForDate.push({ show, placements: [selected.placementType] })
            }
          }
        })
        
        // Check if any selected shows have episodes on this date
        const hasEpisodesScheduled = selectedPlacements.some(placement => {
          const show = shows.find(s => s.id === placement.showId)
          return show?.availability?.[dateKey] !== undefined
        })
        
        const hasAvailability = availableShowsForDate.length > 0

        days.push(
          <Box
            key={normalizedDate.toISOString()}
            sx={{
              border: '1px solid',
              borderColor: dragOverDate && isSameDay(dragOverDate, normalizedDate) ? 'primary.main' : 
                         !isCurrentMonth ? 'divider' : 
                         !hasEpisodesScheduled && selectedPlacements.length > 0 ? 'error.light' : 'divider',
              borderWidth: dragOverDate && isSameDay(dragOverDate, normalizedDate) ? 2 : 1,
              minHeight: 150,
              p: 1,
              bgcolor: !isCurrentMonth ? 'grey.50' : 
                      !hasEpisodesScheduled && selectedPlacements.length > 0 ? 'error.50' : 
                      'background.paper',
              cursor: hasAvailability ? 'pointer' : 'default',
              '&:hover': hasAvailability ? { bgcolor: 'action.hover' } : {},
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={() => isCurrentMonth && handleDateClick(normalizedDate)}
            onDragOver={(e) => isCurrentMonth && handleDragOver(e, normalizedDate)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => isCurrentMonth && handleDrop(e, normalizedDate)}
          >
            {/* Layered background colors for available inventory */}
            {isCurrentMonth && hasAvailability && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {availableShowsForDate.map((item, index) => (
                  <Box
                    key={item.show.id}
                    sx={{
                      flex: 1,
                      bgcolor: getShowColor(item.show.id),
                      opacity: 0.2
                    }}
                  />
                ))}
              </Box>
            )}
            
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              {!hasEpisodesScheduled && selectedPlacements.length > 0 && isCurrentMonth ? (
                <Tooltip title="No episodes scheduled for selected shows on this date">
                  <Typography variant="caption" color="error.main">
                    {format(normalizedDate, 'd')}
                  </Typography>
                </Tooltip>
              ) : (
                <Typography variant="caption" color={isCurrentMonth ? 'text.primary' : 'text.disabled'}>
                  {format(normalizedDate, 'd')}
                </Typography>
              )}
            </Box>
            {/* Spot chips container */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.25,
                mt: 0.5,
                position: 'relative',
                zIndex: 1
              }}
            >
              {spotsOnDay.map((spot, idx) => {
                const show = shows.find(s => s.id === spot.showId)
                const showColor = getShowColor(spot.showId)
                
                // Calculate chip size based on number of spots
                const spotCount = spotsOnDay.length
                let chipWidth = '100%'
                let showLabel = true
                let fontSize = '0.7rem'
                
                if (spotCount > 4 && spotCount <= 8) {
                  // 2 columns, hide text
                  chipWidth = 'calc(50% - 2px)'
                  showLabel = false
                } else if (spotCount > 8) {
                  // 3 columns, hide text, smaller chips
                  chipWidth = 'calc(33.33% - 2px)'
                  showLabel = false
                  fontSize = '0.6rem'
                }
                
                return (
                  <Tooltip 
                    key={spot.id}
                    title={`${show?.name || 'Show'} - ${spot.placementType} - $${spot.price}`}
                    arrow
                  >
                    <Chip
                      label={showLabel ? spot.placementType : ''}
                      size="small"
                      sx={{ 
                        width: chipWidth,
                        minWidth: showLabel ? 'auto' : '24px',
                        height: showLabel ? 'auto' : '20px',
                        fontSize: fontSize,
                        cursor: 'move',
                        backgroundColor: showColor,
                        color: 'white',
                        '& .MuiChip-label': {
                          padding: showLabel ? '0 8px' : '0',
                          display: showLabel ? 'block' : 'none'
                        },
                        '&:hover': {
                          opacity: 0.8,
                          backgroundColor: showColor
                        },
                        '& .MuiChip-deleteIcon': {
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: spotCount > 4 ? '0.9rem' : '1rem',
                          margin: showLabel ? '0' : '0 2px',
                          '&:hover': {
                            color: 'white'
                          }
                        }
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, spot)}
                      onDelete={(e) => {
                        e.stopPropagation()
                        setScheduledSpots(prev => prev.filter(s => s.id !== spot.id))
                      }}
                    />
                  </Tooltip>
                )
              })}
            </Box>
          </Box>
        )
      }
      
      // Calculate week start date for this week
      const weekStartDate = addDays(startDate, week * 7)
      
      // Check if there are any spots in this week
      const weekEndDate = addDays(weekStartDate, 6)
      const hasSpots = scheduledSpots.some(spot => {
        const spotDate = new Date(spot.date)
        return isWithinInterval(spotDate, { start: weekStartDate, end: weekEndDate })
      })
      
      weeks.push(
        <Box key={week} sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Grid container spacing={0} sx={{ flex: 1 }}>
              {days.map((day, idx) => (
                <Grid item xs key={idx} sx={{ width: '14.28%' }}>
                  {day}
                </Grid>
              ))}
            </Grid>
            <Box sx={{ ml: 2, minWidth: '100px', display: 'flex', justifyContent: 'center' }}>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => handleClearWeek(weekStartDate)}
                disabled={!hasSpots}
                startIcon={<ClearIcon />}
                sx={{ 
                  fontSize: '0.75rem', 
                  py: 0.5, 
                  px: 1.5,
                  minWidth: '90px',
                  borderRadius: '20px',
                  textTransform: 'none',
                  boxShadow: hasSpots ? 2 : 0,
                  '&:hover': {
                    boxShadow: hasSpots ? 4 : 0
                  },
                  '&:disabled': {
                    backgroundColor: 'grey.200',
                    color: 'grey.500'
                  }
                }}
              >
                Clear Week
              </Button>
            </Box>
          </Box>
        </Box>
      )
    }

    return weeks
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          Podcast Campaign Schedule Builder
        </Typography>
      </Box>

      {/* Success/Error Messages */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Show & Placement Selection */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          {shows.map((show) => {
            const showColor = getShowColor(show.id)
            const hasSelectedPlacement = selectedPlacements.some(p => p.showId === show.id)
            return (
              <Grid item xs={12} sm={6} md={2.4} key={show.id}>
                <Card 
                  sx={{ 
                    border: hasSelectedPlacement ? '3px solid' : '1px solid',
                    borderColor: hasSelectedPlacement ? showColor : 'divider',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: 'background.paper'
                  }}
                >
                  <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mb: 2 }}>
                      <Typography 
                        variant="subtitle1" 
                        fontWeight="bold" 
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.2,
                          minHeight: '2.4em'
                        }}
                      >
                        {show.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {show.audience.toLocaleString()} listeners
                      </Typography>
                    </Box>
                    <Stack spacing={1} sx={{ flex: 1 }}>
                      {placementTypes.map((placement) => {
                        const isSelected = isPlacementSelected(show.id, placement.type)
                        return (
                          <Button
                            key={placement.type}
                            variant={isSelected ? 'contained' : 'outlined'}
                            size="large"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePlacementSelect(show.id, placement.type)
                              // Also set this show as selected when clicking placement
                              setSelectedShowId(show.id)
                              // Set the selected placement type for display
                              setSelectedPlacementType(placement.type)
                            }}
                            sx={{ 
                              flex: 1,
                              minHeight: 48,
                              backgroundColor: isSelected ? showColor : 'transparent',
                              borderColor: showColor,
                              color: isSelected ? 'white' : showColor,
                              '&:hover': {
                                backgroundColor: isSelected ? showColor : `${showColor}15`,
                                borderColor: showColor
                              }
                            }}
                          >
                            {placement.label}
                          </Button>
                        )
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      </Paper>

      {/* Analytics Panel */}
      <Paper sx={{ 
        p: 2, 
        mb: 2,
        border: selectedShowId ? '2px solid' : '1px solid',
        borderColor: selectedShowId ? getShowColor(selectedShowId) : 'divider',
        bgcolor: selectedShowId ? `${getShowColor(selectedShowId)}15` : 'background.paper'
      }}>
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center" 
          mb={analyticsExpanded ? 2 : 0}
          sx={{
            bgcolor: selectedShowId ? getShowColor(selectedShowId) : 'transparent',
            color: selectedShowId ? 'white' : 'inherit',
            mx: -2,
            mt: -2,
            px: 2,
            py: 1,
            borderRadius: '4px 4px 0 0'
          }}
        >
          <Typography variant="h6">
            {selectedShowId 
              ? `${shows.find(s => s.id === selectedShowId)?.name || 'Show'} Pricing and Analytics`
              : 'Show Pricing and Analytics'
            }
          </Typography>
          <IconButton 
            onClick={() => {
              const newExpanded = !analyticsExpanded
              setAnalyticsExpanded(newExpanded)
              if (typeof window !== 'undefined') {
                localStorage.setItem('schedule-builder-analytics-expanded', JSON.stringify(newExpanded))
              }
            }} 
            size="small"
            sx={{ color: selectedShowId ? 'white' : 'inherit' }}
          >
            {analyticsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        {analyticsExpanded && (
          <Grid container spacing={3}>
          {/* Rate Cards - Admin and Schedule Price */}
          {selectedShowId && selectedPlacementType ? (
            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                {/* Admin Rate Card (Read-only) */}
                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Admin Rate Card
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Price</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow selected={selectedPlacementType === 'pre-roll'}>
                          <TableCell>Pre-Roll</TableCell>
                          <TableCell align="right">
                            <Typography>${rateCard.preRoll || 0}</Typography>
                          </TableCell>
                        </TableRow>
                        <TableRow selected={selectedPlacementType === 'mid-roll'}>
                          <TableCell>Mid-Roll</TableCell>
                          <TableCell align="right">
                            <Typography>${rateCard.midRoll || 0}</Typography>
                          </TableCell>
                        </TableRow>
                        <TableRow selected={selectedPlacementType === 'post-roll'}>
                          <TableCell>Post-Roll</TableCell>
                          <TableCell align="right">
                            <Typography>${rateCard.postRoll || 0}</Typography>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* Schedule Price (Editable) */}
                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Schedule Price
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Price</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow selected={selectedPlacementType === 'pre-roll'}>
                          <TableCell>Pre-Roll</TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              value={showSpecificRates[selectedShowId]?.preRoll || rateCard.preRoll}
                              onChange={(e) => {
                                const value = Number(e.target.value)
                                setShowSpecificRates(prev => ({
                                  ...prev,
                                  [selectedShowId]: {
                                    ...prev[selectedShowId],
                                    preRoll: value,
                                    midRoll: prev[selectedShowId]?.midRoll || rateCard.midRoll,
                                    postRoll: prev[selectedShowId]?.postRoll || rateCard.postRoll
                                  }
                                }))
                              }}
                              type="number"
                              InputProps={{ startAdornment: '$' }}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow selected={selectedPlacementType === 'mid-roll'}>
                          <TableCell>Mid-Roll</TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              value={showSpecificRates[selectedShowId]?.midRoll || rateCard.midRoll}
                              onChange={(e) => {
                                const value = Number(e.target.value)
                                setShowSpecificRates(prev => ({
                                  ...prev,
                                  [selectedShowId]: {
                                    ...prev[selectedShowId],
                                    preRoll: prev[selectedShowId]?.preRoll || rateCard.preRoll,
                                    midRoll: value,
                                    postRoll: prev[selectedShowId]?.postRoll || rateCard.postRoll
                                  }
                                }))
                              }}
                              type="number"
                              InputProps={{ startAdornment: '$' }}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow selected={selectedPlacementType === 'post-roll'}>
                          <TableCell>Post-Roll</TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              value={showSpecificRates[selectedShowId]?.postRoll || rateCard.postRoll}
                              onChange={(e) => {
                                const value = Number(e.target.value)
                                setShowSpecificRates(prev => ({
                                  ...prev,
                                  [selectedShowId]: {
                                    ...prev[selectedShowId],
                                    preRoll: prev[selectedShowId]?.preRoll || rateCard.preRoll,
                                    midRoll: prev[selectedShowId]?.midRoll || rateCard.midRoll,
                                    postRoll: value
                                  }
                                }))
                              }}
                              type="number"
                              InputProps={{ startAdornment: '$' }}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            </Grid>
          ) : (
            <Grid item xs={12} md={8}>
              <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography color="text.secondary">
                  Select a show placement to view and edit pricing
                </Typography>
              </Box>
            </Grid>
          )}

          {/* Campaign Information */}
          <Grid item xs={12} md={4}>
            {selectedShowId ? (
              // Show-specific metrics
              (() => {
                const selectedShow = shows.find(s => s.id === selectedShowId)
                const showSpots = scheduledSpots.filter(spot => spot.showId === selectedShowId)
                const showSpend = showSpots.reduce((sum, spot) => sum + spot.price, 0)
                const showImpressions = selectedShow?.impressions || 100000
                
                return (
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">Show CPM</Typography>
                      <Typography variant="h5">${selectedShow?.cpm || 25}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">Monthly Downloads</Typography>
                      <Typography variant="h5">{showImpressions.toLocaleString()}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">Show Spend</Typography>
                      <Typography variant="h5">${showSpend.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">Spots Scheduled</Typography>
                      <Typography variant="h5">{showSpots.length}</Typography>
                    </Grid>
                  </Grid>
                )
              })()
            ) : (
              // Campaign-wide metrics
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Avg CPM</Typography>
                  <Typography variant="h5">${analytics.cpm.toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Total Impressions</Typography>
                  <Typography variant="h5">{analytics.impressions.toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Total Spend</Typography>
                  <Typography variant="h5">${analytics.spend.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Total Spots</Typography>
                  <Typography variant="h5">{scheduledSpots.length}</Typography>
                </Grid>
              </Grid>
            )}
          </Grid>
        </Grid>
        )}
      </Paper>

      {/* Campaign Summary */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={campaignSummaryExpanded ? 2 : 0}>
          <Typography variant="h6">
            Campaign Summary
          </Typography>
          <IconButton onClick={() => setCampaignSummaryExpanded(!campaignSummaryExpanded)} size="small">
            {campaignSummaryExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        {campaignSummaryExpanded && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  ${scheduledSpots.reduce((total, spot) => total + (spot.price || 0), 0).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Schedule Cost
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {Math.round((scheduledSpots.length * 10000) / 1000)}K
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Impressions
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  ${(() => {
                    const totalCost = scheduledSpots.reduce((total, spot) => total + (spot.price || 0), 0)
                    const totalImpressions = scheduledSpots.length * 10000 // Use same calculation as Total Impressions
                    const cpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0
                    return cpm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  })()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Schedule CPM
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {new Set(scheduledSpots.map(spot => spot.showId)).size}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Shows in Campaign
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Campaign Period: {scheduledSpots.length > 0 ? 
                      `${format(new Date(Math.min(...scheduledSpots.map(s => new Date(s.date).getTime()))), 'MMM d')} - ${format(new Date(Math.max(...scheduledSpots.map(s => new Date(s.date).getTime()))), 'MMM d, yyyy')}` 
                      : 'No spots scheduled'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Spots: {scheduledSpots.length} across {scheduledSpots.length > 0 ? new Set(scheduledSpots.map(s => format(new Date(s.date), 'yyyy-MM-dd'))).size : 0} days
                  </Typography>
                </Box>
                {campaignBudget && (
                  <Box textAlign="right">
                    <Typography variant="body2" color="text.secondary">
                      Budget Utilization: {((scheduledSpots.reduce((total, spot) => total + (spot.price || 0), 0) / campaignBudget) * 100).toFixed(1)}%
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={scheduledSpots.reduce((total, spot) => total + (spot.price || 0), 0) > campaignBudget ? 'error.main' : 'success.main'}
                    >
                      Remaining: ${(campaignBudget - scheduledSpots.reduce((total, spot) => total + (spot.price || 0), 0)).toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Show Color Legend */}
      {shows.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Show Legend
          </Typography>
          <Grid container spacing={1}>
            {shows.map((show) => {
              const showColor = getShowColor(show.id)
              const hasSelectedPlacement = selectedPlacements.some(p => p.showId === show.id)
              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={show.id}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      p: 1,
                      borderRadius: 1,
                      border: hasSelectedPlacement ? '2px solid' : '1px solid',
                      borderColor: hasSelectedPlacement ? showColor : 'divider',
                      bgcolor: hasSelectedPlacement ? `${showColor}10` : 'transparent'
                    }}
                  >
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        backgroundColor: showColor,
                        borderRadius: 1,
                        flexShrink: 0
                      }}
                    />
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: hasSelectedPlacement ? 'bold' : 'normal',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {show.name}
                    </Typography>
                  </Box>
                </Grid>
              )
            })}
          </Grid>
        </Paper>
      )}

      {/* Calendar */}
      <Paper sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {format(currentMonth, 'MMMM yyyy')}
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              onClick={() => setCurrentMonth(prev => getFirstDayOfMonth(new Date(prev.getFullYear(), prev.getMonth() - 1, 1)))}
            >
              Previous
            </Button>
            <Button
              onClick={() => setCurrentMonth(prev => getFirstDayOfMonth(new Date(prev.getFullYear(), prev.getMonth() + 1, 1)))}
            >
              Next
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ClearIcon />}
              onClick={() => setClearMonthDialogOpen(true)}
              disabled={!scheduledSpots.some(spot => {
                const spotDate = new Date(spot.date)
                return isWithinInterval(spotDate, {
                  start: startOfMonth(currentMonth),
                  end: endOfMonth(currentMonth)
                })
              })}
            >
              Clear Month
            </Button>
            <Button
              variant="contained"
              startIcon={<SettingsIcon />}
              onClick={() => setBulkScheduleOpen(true)}
            >
              Bulk Schedule
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<AddIcon />}
              onClick={() => setBulkPlacementOpen(true)}
            >
              Bulk Placement (New)
            </Button>
          </Box>
        </Box>

        {/* Day headers - aligned with calendar grid including Clear Week button */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Grid container spacing={0} sx={{ flex: 1 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <Grid item xs key={day} sx={{ width: '14.28%' }}>
                <Typography variant="subtitle2" align="center" color="text.secondary">
                  {day}
                </Typography>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ ml: 2, minWidth: '100px' }}>
            {/* Spacer for alignment with Clear Week buttons */}
          </Box>
        </Box>

        {/* Calendar grid */}
        {renderCalendarGrid()}

        {/* Summary */}
        <Box mt={3} display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" color="text.secondary">
              Total Spots: {scheduledSpots.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Spend: ${analytics.spend.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            </Typography>
            {campaignBudget && (
              <Typography variant="body2" color={analytics.spend > campaignBudget ? 'error' : 'success.main'}>
                Budget Remaining: ${(campaignBudget - analytics.spend).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            color="primary"
            onClick={() => onSave && onSave({ spots: scheduledSpots, analytics })}
          >
            Save Schedule
          </Button>
        </Box>
      </Paper>

      {/* Bulk Schedule Modal */}
      <BulkScheduleModal
        open={bulkScheduleOpen}
        onClose={() => setBulkScheduleOpen(false)}
        onSchedule={handleBulkSchedule}
        shows={shows}
        dateRange={{
          start: startOfMonth(currentMonth),
          end: endOfMonth(currentMonth)
        }}
        campaignStartDate={campaignStartDate}
        campaignEndDate={campaignEndDate}
      />

      {/* Bulk Placement Panel (Inventory-Aware) */}
      <BulkPlacementPanel
        open={bulkPlacementOpen}
        onClose={() => setBulkPlacementOpen(false)}
        shows={shows}
        campaignId={campaignId}
        advertiserId={advertiserId || ''}
        agencyId={agencyId}
        campaignStartDate={campaignStartDate}
        campaignEndDate={campaignEndDate}
        onCommit={handleBulkPlacementCommit}
      />

      {/* Placement Selection Dialog */}
      <Dialog
        open={placementSelectionOpen}
        onClose={() => setPlacementSelectionOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Select Placements for {placementSelectionDate && format(placementSelectionDate, 'MMMM d, yyyy')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Multiple placements are available for this date. Select which ones to schedule:
          </Typography>
          <List>
            {availablePlacementsForSelection.map((placement, index) => {
              const show = shows.find(s => s.id === placement.showId)
              const isSelected = selectedPlacementsInDialog.has(index)
              
              return (
                <ListItem key={index} dense>
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={isSelected}
                      onChange={(e) => {
                        const newSelected = new Set(selectedPlacementsInDialog)
                        if (e.target.checked) {
                          newSelected.add(index)
                        } else {
                          newSelected.delete(index)
                        }
                        setSelectedPlacementsInDialog(newSelected)
                      }}
                      tabIndex={-1}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={show?.name || 'Unknown Show'}
                    secondary={placement.placementType}
                  />
                  <Typography variant="body2" color="text.secondary">
                    ${rateCard[placement.placementType === 'pre-roll' ? 'preRoll' : placement.placementType === 'mid-roll' ? 'midRoll' : 'postRoll']}
                  </Typography>
                </ListItem>
              )
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlacementSelectionOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const selectedItems = availablePlacementsForSelection.filter((_, index) => {
                return selectedPlacementsInDialog.has(index)
              })
              handlePlacementSelection(selectedItems)
            }}
            disabled={selectedPlacementsInDialog.size === 0}
          >
            Add Selected ({selectedPlacementsInDialog.size})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clear Month Confirmation Dialog */}
      <Dialog
        open={clearMonthDialogOpen}
        onClose={() => setClearMonthDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Clear All Spots for {format(currentMonth, 'MMMM yyyy')}?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            This will remove {scheduledSpots.filter(spot => {
              const spotDate = new Date(spot.date)
              return isWithinInterval(spotDate, {
                start: startOfMonth(currentMonth),
                end: endOfMonth(currentMonth)
              })
            }).length} scheduled spots from {format(currentMonth, 'MMMM yyyy')}.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearMonthDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleClearMonth}
            color="error"
            variant="contained"
          >
            Clear Month
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}