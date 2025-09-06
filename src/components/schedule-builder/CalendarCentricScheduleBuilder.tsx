'use client'

import React, { useState, useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Button,
  Tooltip,
  Badge,
  useTheme,
  alpha,
  Drawer,
  Avatar,
  AvatarGroup,
  Stack,
  Divider,
  Switch,
  FormControlLabel,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormGroup,
  TextField,
  InputAdornment,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material'
import {
  CalendarMonth as CalendarIcon,
  ViewWeek as WeekIcon,
  ViewDay as DayIcon,
  ViewStream as BiweekIcon,
  NavigateBefore,
  NavigateNext,
  Add as AddIcon,
  Remove as RemoveIcon,
  Info as InfoIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as ImpressionsIcon,
  Today as TodayIcon,
  Close as CloseIcon,
  RadioButtonChecked as PreRollIcon,
  Mic as MidRollIcon,
  RadioButtonUnchecked as PostRollIcon,
  Group as AudienceIcon,
  Schedule as ScheduleIcon,
  AutoFixHigh as AutoPlaceIcon,
  Settings as SettingsIcon,
  Star as PaidIcon,
  CardGiftcard as AddedValueIcon,
  Build as MakegoodIcon
} from '@mui/icons-material'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek,
  endOfWeek,
  eachDayOfInterval, 
  addMonths, 
  subMonths,
  isToday,
  isSameDay 
} from 'date-fns'
import { EnhancedInventorySlot, ScheduleItem, ShowWithConfig } from '@/hooks/useEnhancedScheduleBuilder'

type ViewMode = 'day' | 'week' | 'biweek' | 'month'
type PlacementType = 'pre-roll' | 'mid-roll' | 'post-roll' | null
type SpotType = 'paid' | 'added-value' | 'makegood'

interface ShowInfoPanelData {
  show: ShowWithConfig
  placementType: PlacementType
  rateCard?: {
    preRollRate: number
    midRollRate: number
    postRollRate: number
  }
  audienceData?: {
    averageDownloads: number
    demographics: {
      age: { '18-24': number, '25-34': number, '35-44': number, '45-54': number, '55+': number }
      gender: { male: number, female: number, other: number }
    }
  }
}

interface BulkPlacementSettings {
  spotsPerWeek: number
  daysOfWeek: boolean[]
  preferredDays: number[]
  autoAssign: boolean
}

interface Props {
  inventory: EnhancedInventorySlot[]
  selectedItems: ScheduleItem[]
  onAddItem: (slot: EnhancedInventorySlot, negotiatedPrice?: number, spotType?: SpotType) => void
  onRemoveItem: (itemId: string) => void
  onUpdatePrice: (itemId: string, price: number) => void
  onUpdateSpotType: (itemId: string, spotType: SpotType) => void
  onMoveItem?: (itemId: string, newDate: Date) => void
  loading?: boolean
  campaignBudget?: number
  shows: ShowWithConfig[]
  onShowsChange?: (shows: ShowWithConfig[]) => void
}

// Generate consistent colors for shows
const generateShowColors = (shows: ShowWithConfig[]): Record<string, string> => {
  const colors = [
    '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2', '#f57c00',
    '#0288d1', '#689f38', '#c62828', '#6a1b9a', '#ef6c00'
  ]
  
  const colorMap: Record<string, string> = {}
  shows.forEach((show, index) => {
    colorMap[show.id] = colors[index % colors.length]
  })
  return colorMap
}

// Placement type configuration
const PLACEMENT_CONFIG = {
  'pre-roll': { icon: PreRollIcon, color: 'info' as const, label: 'Pre-roll' },
  'mid-roll': { icon: MidRollIcon, color: 'success' as const, label: 'Mid-roll' },
  'post-roll': { icon: PostRollIcon, color: 'warning' as const, label: 'Post-roll' }
}

// Spot type configuration
const SPOT_TYPE_CONFIG = {
  'paid': { icon: PaidIcon, color: 'primary' as const, label: 'Paid' },
  'added-value': { icon: AddedValueIcon, color: 'secondary' as const, label: 'Added Value' },
  'makegood': { icon: MakegoodIcon, color: 'warning' as const, label: 'Makegood' }
}

export function CalendarCentricScheduleBuilder({
  inventory,
  selectedItems,
  onAddItem,
  onRemoveItem,
  onUpdatePrice,
  onUpdateSpotType,
  onMoveItem,
  loading = false,
  campaignBudget,
  shows,
  onShowsChange
}: Props) {
  const theme = useTheme()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedShow, setSelectedShow] = useState<ShowWithConfig | null>(null)
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementType>(null)
  const [showInfoPanelOpen, setShowInfoPanelOpen] = useState(false)
  const [bulkPlacementOpen, setBulkPlacementOpen] = useState(false)
  const [bulkSettings, setBulkSettings] = useState<BulkPlacementSettings>({
    spotsPerWeek: 3,
    daysOfWeek: [true, true, true, true, true, false, false], // Mon-Fri
    preferredDays: [1, 2, 3], // Mon, Tue, Wed
    autoAssign: false
  })

  // Generate show colors
  const showColors = useMemo(() => generateShowColors(shows), [shows])

  // Mock data for show information (in real app, this would come from API)
  const getShowInfo = (show: ShowWithConfig, placementType: PlacementType): ShowInfoPanelData => {
    return {
      show,
      placementType,
      rateCard: {
        preRollRate: 250,
        midRollRate: 300,
        postRollRate: 200
      },
      audienceData: {
        averageDownloads: 15000,
        demographics: {
          age: { '18-24': 15, '25-34': 35, '35-44': 25, '45-54': 15, '55+': 10 },
          gender: { male: 45, female: 50, other: 5 }
        }
      }
    }
  }

  // Get date range based on view mode
  const dateRange = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return { start: currentDate, end: currentDate }
      case 'week':
        return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) }
      case 'biweek':
        const weekStart = startOfWeek(currentDate)
        return { start: weekStart, end: endOfWeek(new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) }
      case 'month':
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) }
    }
  }, [currentDate, viewMode])

  const daysInView = eachDayOfInterval(dateRange)

  // Filter inventory based on selected show and placement
  const filteredInventory = useMemo(() => {
    return inventory.filter(slot => {
      // Date range filter
      const slotDate = new Date(slot.airDate)
      if (slotDate < dateRange.start || slotDate > dateRange.end) return false
      
      // Show filter
      if (selectedShow && slot.showId !== selectedShow.id) return false
      
      // Placement type filter
      if (selectedPlacement && slot.placementType !== selectedPlacement) return false
      
      return true
    })
  }, [inventory, dateRange, selectedShow, selectedPlacement])

  // Handle show selection
  const handleShowClick = (show: ShowWithConfig) => {
    setSelectedShow(show)
    setSelectedPlacement(null) // Reset placement filter
    setShowInfoPanelOpen(true)
  }

  // Handle placement type selection
  const handlePlacementClick = (placementType: PlacementType) => {
    if (selectedPlacement === placementType) {
      setSelectedPlacement(null) // Toggle off
    } else {
      setSelectedPlacement(placementType)
    }
  }

  // Handle bulk placement
  const handleBulkPlacement = () => {
    if (!selectedShow || !selectedPlacement) {
      alert('Please select a show and placement type first')
      return
    }

    // Filter available slots for bulk placement
    const availableSlots = filteredInventory.filter(slot => 
      slot.available && 
      slot.showId === selectedShow.id && 
      slot.placementType === selectedPlacement
    )

    // Apply day-of-week filter
    const filteredSlots = availableSlots.filter(slot => {
      const dayOfWeek = new Date(slot.airDate).getDay()
      return bulkSettings.daysOfWeek[dayOfWeek]
    })

    // Sort by preferred days if specified
    const sortedSlots = filteredSlots.sort((a, b) => {
      const dayA = new Date(a.airDate).getDay()
      const dayB = new Date(b.airDate).getDay()
      
      const preferenceA = bulkSettings.preferredDays.includes(dayA) ? 0 : 1
      const preferenceB = bulkSettings.preferredDays.includes(dayB) ? 0 : 1
      
      if (preferenceA !== preferenceB) return preferenceA - preferenceB
      return new Date(a.airDate).getTime() - new Date(b.airDate).getTime()
    })

    // Calculate spots per week distribution
    const weeksInRange = Math.ceil(sortedSlots.length / bulkSettings.spotsPerWeek)
    const slotsToSelect = sortedSlots.slice(0, bulkSettings.spotsPerWeek * weeksInRange)

    if (bulkSettings.autoAssign) {
      // Auto-assign spots
      slotsToSelect.forEach(slot => {
        onAddItem(slot, undefined, 'paid')
      })
      setBulkPlacementOpen(false)
    } else {
      // Just highlight available slots for manual selection
      console.log('Highlighted slots for manual selection:', slotsToSelect)
    }
  }

  // Navigation handlers
  const handlePrevious = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(prev => new Date(prev.getTime() - 24 * 60 * 60 * 1000))
        break
      case 'week':
      case 'biweek':
        setCurrentDate(prev => new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000))
        break
      case 'month':
        setCurrentDate(prev => subMonths(prev, 1))
        break
    }
  }

  const handleNext = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(prev => new Date(prev.getTime() + 24 * 60 * 60 * 1000))
        break
      case 'week':
      case 'biweek':
        setCurrentDate(prev => new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000))
        break
      case 'month':
        setCurrentDate(prev => addMonths(prev, 1))
        break
    }
  }

  const renderDayCell = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const daySlots = filteredInventory.filter(slot => 
      format(new Date(slot.airDate), 'yyyy-MM-dd') === dateKey
    )
    const selectedSlots = selectedItems.filter(item =>
      format(new Date(item.airDate), 'yyyy-MM-dd') === dateKey
    )

    return (
      <Card
        key={dateKey}
        sx={{
          height: viewMode === 'month' ? 120 : 200,
          border: isToday(day) ? `2px solid ${theme.palette.primary.main}` : '1px solid',
          borderColor: isToday(day) ? 'primary.main' : 'divider',
          '&:hover': {
            boxShadow: 1
          }
        }}
      >
        <CardContent sx={{ p: 1, height: '100%', cursor: 'default' }}>
          {/* Day header */}
          <Typography 
            variant="caption" 
            fontWeight={isToday(day) ? 'bold' : 'medium'}
            color={isToday(day) ? 'primary.main' : 'text.primary'}
          >
            {format(day, 'd')}
          </Typography>

          {/* Available slots indicators */}
          <Box sx={{ mt: 0.5 }}>
            {daySlots.slice(0, viewMode === 'month' ? 2 : 4).map((slot, idx) => {
              const selectedSlot = selectedSlots.find(s => s.id === slot.id)
              const isSelected = !!selectedSlot
              const showColor = showColors[slot.showId] || theme.palette.grey[500]
              const placement = PLACEMENT_CONFIG[slot.placementType as keyof typeof PLACEMENT_CONFIG]
              
              // Enhanced visual feedback for different slot states
              const getSlotStyle = () => {
                if (isSelected) {
                  const spotType = (selectedSlot as any)?.spotType || 'paid'
                  const spotConfig = SPOT_TYPE_CONFIG[spotType]
                  return {
                    bgcolor: showColor,
                    color: 'white',
                    borderColor: theme.palette[spotConfig.color].main,
                    borderWidth: 2,
                    borderStyle: 'solid'
                  }
                } else if (selectedShow && slot.showId === selectedShow.id) {
                  // Highlight slots for selected show
                  return {
                    bgcolor: alpha(showColor, 0.2),
                    borderColor: showColor,
                    color: showColor,
                    animation: selectedPlacement === slot.placementType ? 'pulse 2s infinite' : 'none'
                  }
                } else if (selectedPlacement && slot.placementType === selectedPlacement) {
                  // Highlight slots for selected placement type
                  return {
                    bgcolor: alpha(theme.palette[placement.color].main, 0.15),
                    borderColor: theme.palette[placement.color].main,
                    color: theme.palette[placement.color].main
                  }
                } else {
                  return {
                    bgcolor: 'transparent',
                    borderColor: showColor,
                    color: showColor
                  }
                }
              }
              
              return (
                <Box key={idx} sx={{ position: 'relative', display: 'inline-block', mb: 0.25, mr: 0.25 }}>
                  <Chip
                    size="small"
                    label={`${placement?.label?.charAt(0) || '?'} $${Math.round(slot?.adjustedPrice || 0)}`}
                    variant={isSelected ? 'filled' : 'outlined'}
                    sx={{
                      fontSize: '0.7rem',
                      height: 20,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      ...getSlotStyle(),
                      '&:hover': {
                        boxShadow: 2,
                        transform: 'scale(1.05)'
                      },
                      '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.7 },
                        '100%': { opacity: 1 }
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isSelected) {
                        onRemoveItem(slot.id)
                      } else {
                        onAddItem(slot, undefined, 'paid')
                      }
                    }}
                  />
                  
                  {/* Spot Type Indicator */}
                  {isSelected && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: (() => {
                          const spotType = (selectedSlot as any)?.spotType || 'paid'
                          const spotConfig = SPOT_TYPE_CONFIG[spotType]
                          return theme.palette[spotConfig.color].main
                        })(),
                        border: '1px solid white',
                        boxShadow: 1
                      }}
                    />
                  )}
                </Box>
              )
            })}
            
            {daySlots.length > (viewMode === 'month' ? 2 : 4) && (
              <Chip
                size="small"
                label={`+${daySlots.length - (viewMode === 'month' ? 2 : 4)}`}
                variant="outlined"
                sx={{
                  fontSize: '0.7rem',
                  height: 20,
                  color: 'text.secondary',
                  borderColor: 'text.secondary',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  // Could open a detailed view or expand all slots
                  console.log('Show more slots for', format(day, 'yyyy-MM-dd'))
                }}
              />
            )}
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <DndContext collisionDetection={closestCenter}>
      <Box>
        {/* Show Selection Panel */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Campaign Shows
          </Typography>
          
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            {shows.map(show => (
              <Card
                key={show.id}
                sx={{
                  minWidth: 200,
                  cursor: 'pointer',
                  border: selectedShow?.id === show.id ? 2 : 1,
                  borderColor: selectedShow?.id === show.id ? 'primary.main' : 'divider',
                  '&:hover': { boxShadow: 2 }
                }}
                onClick={() => handleShowClick(show)}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Avatar sx={{ bgcolor: showColors[show.id], width: 32, height: 32 }}>
                      {show.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="medium">
                        {show.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {show.category}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Placement Type Buttons */}
                  <ButtonGroup size="small" variant="outlined" fullWidth>
                    {Object.entries(PLACEMENT_CONFIG).map(([type, config]) => {
                      const IconComponent = config.icon
                      return (
                        <Button
                          key={type}
                          variant={selectedPlacement === type ? 'contained' : 'outlined'}
                          color={config.color}
                          startIcon={<IconComponent />}
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePlacementClick(type as PlacementType)
                          }}
                          sx={{ fontSize: '0.7rem', px: 1 }}
                        >
                          {config.label.split('-')[0]}
                        </Button>
                      )
                    })}
                  </ButtonGroup>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Paper>

        {/* Calendar Controls */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack spacing={2}>
            {/* Top Row - Navigation and Date */}
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <IconButton onClick={handlePrevious} size="small">
                  <NavigateBefore />
                </IconButton>
                <Button 
                  size="small" 
                  startIcon={<TodayIcon />}
                  onClick={() => setCurrentDate(new Date())}
                >
                  Today
                </Button>
                <IconButton onClick={handleNext} size="small">
                  <NavigateNext />
                </IconButton>
                <Typography variant="h6" sx={{ ml: 2 }}>
                  {format(currentDate, 'MMMM yyyy')}
                </Typography>
              </Box>

              {/* View Controls */}
              <ButtonGroup size="small">
                <Button
                  variant={viewMode === 'month' ? 'contained' : 'outlined'}
                  onClick={() => setViewMode('month')}
                  startIcon={<CalendarIcon />}
                >
                  Month
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'contained' : 'outlined'}
                  onClick={() => setViewMode('week')}
                  startIcon={<WeekIcon />}
                >
                  Week
                </Button>
              </ButtonGroup>
            </Box>

            {/* Bottom Row - Action Buttons */}
            <Box display="flex" gap={1} justifyContent="flex-end" flexWrap="wrap">
              <Button
                variant="outlined"
                size="small"
                startIcon={<AutoPlaceIcon />}
                onClick={() => setBulkPlacementOpen(true)}
                disabled={!selectedShow || !selectedPlacement}
              >
                Bulk Place
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<InfoIcon />}
                onClick={() => setShowInfoPanelOpen(true)}
                disabled={!selectedShow}
              >
                Show Info
              </Button>
            </Box>
          </Stack>
        </Paper>

        {/* Calendar Grid */}
        <Paper sx={{ p: 2 }}>
          {viewMode === 'month' ? (
            <Grid container spacing={1}>
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Grid item xs={12 / 7} key={day}>
                  <Typography variant="caption" fontWeight="medium" align="center" display="block">
                    {day}
                  </Typography>
                </Grid>
              ))}
              
              {/* Empty cells for start of month */}
              {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, idx) => (
                <Grid item xs={12 / 7} key={`empty-${idx}`}>
                  <Box height={120} />
                </Grid>
              ))}
              
              {/* Days */}
              {daysInView.map(day => (
                <Grid item xs={12 / 7} key={format(day, 'yyyy-MM-dd')}>
                  {renderDayCell(day)}
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={1}>
              {daysInView.map(day => (
                <Grid item xs={12 / 7} key={format(day, 'yyyy-MM-dd')}>
                  <Typography variant="subtitle2" align="center" gutterBottom>
                    {format(day, 'EEE d')}
                  </Typography>
                  {renderDayCell(day)}
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {/* Show Information Panel */}
        <Drawer
          anchor="right"
          open={showInfoPanelOpen}
          onClose={() => setShowInfoPanelOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: 450,
              maxWidth: '90vw'
            }
          }}
        >
          {selectedShow && (
            <Box p={3}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: showColors[selectedShow.id], width: 48, height: 48 }}>
                    {selectedShow.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {selectedShow.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedShow.category} • Hosted by {selectedShow.host}
                    </Typography>
                  </Box>
                </Box>
                <IconButton onClick={() => setShowInfoPanelOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Current Placement Filter */}
              {selectedPlacement && (
                <Card sx={{ mb: 3, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {PLACEMENT_CONFIG[selectedPlacement] && (() => {
                        const IconComponent = PLACEMENT_CONFIG[selectedPlacement].icon
                        return (
                          <IconComponent 
                            fontSize="small" 
                            color={PLACEMENT_CONFIG[selectedPlacement].color} 
                          />
                        )
                      })()}
                      <Typography variant="subtitle2" fontWeight="medium">
                        Viewing {PLACEMENT_CONFIG[selectedPlacement]?.label} Inventory
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Calendar is filtered to show only {PLACEMENT_CONFIG[selectedPlacement]?.label} slots for this show
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Rate Card Section */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                    <MoneyIcon />
                    Rate Card
                  </Typography>
                  
                  <Stack spacing={2}>
                    {Object.entries(PLACEMENT_CONFIG).map(([type, config]) => {
                      const showInfo = getShowInfo(selectedShow, type as PlacementType)
                      const rate = type === 'pre-roll' ? showInfo.rateCard?.preRollRate :
                                  type === 'mid-roll' ? showInfo.rateCard?.midRollRate :
                                  showInfo.rateCard?.postRollRate
                      
                      const isSelectedType = selectedPlacement === type
                      
                      return (
                        <Box key={type}>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box display="flex" alignItems="center" gap={1}>
                              {(() => {
                                const IconComponent = config.icon
                                return (
                                  <IconComponent 
                                    fontSize="small" 
                                    color={isSelectedType ? config.color : 'disabled'} 
                                  />
                                )
                              })()}
                              <Typography 
                                variant="body2" 
                                fontWeight={isSelectedType ? 'medium' : 'normal'}
                                color={isSelectedType ? 'primary.main' : 'text.primary'}
                              >
                                {config.label}
                              </Typography>
                            </Box>
                            <Typography 
                              variant="h6" 
                              fontWeight="medium"
                              color={isSelectedType ? 'primary.main' : 'text.primary'}
                            >
                              ${rate?.toLocaleString()}
                            </Typography>
                          </Box>
                          
                          {/* Rate Adjustment for Selected Placement */}
                          {isSelectedType && (
                            <Box mt={1}>
                              <TextField
                                size="small"
                                label="Custom Rate"
                                type="number"
                                defaultValue={rate}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                                }}
                                sx={{ width: '100%' }}
                                helperText="Adjust rate for this campaign"
                              />
                            </Box>
                          )}
                        </Box>
                      )
                    })}
                  </Stack>
                </CardContent>
              </Card>

              {/* Audience Data Section */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                    <AudienceIcon />
                    Audience Analytics
                  </Typography>
                  
                  {/* Average Downloads */}
                  <Box mb={3}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <ImpressionsIcon fontSize="small" color="primary" />
                      <Typography variant="subtitle2">Average Downloads per Episode</Typography>
                    </Box>
                    <Typography variant="h5" color="primary.main" fontWeight="bold">
                      {getShowInfo(selectedShow, selectedPlacement).audienceData?.averageDownloads.toLocaleString()}
                    </Typography>
                  </Box>

                  {/* Demographics */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Demographics</Typography>
                    
                    {/* Age Distribution */}
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Age Distribution
                      </Typography>
                      {Object.entries(getShowInfo(selectedShow, selectedPlacement).audienceData?.demographics.age || {}).map(([range, percentage]) => (
                        <Box key={range} display="flex" alignItems="center" gap={1} mb={0.5}>
                          <Typography variant="caption" sx={{ minWidth: 50 }}>
                            {range}:
                          </Typography>
                          <Box 
                            sx={{ 
                              flex: 1, 
                              height: 8, 
                              bgcolor: 'grey.200', 
                              borderRadius: 1,
                              overflow: 'hidden'
                            }}
                          >
                            <Box 
                              sx={{ 
                                width: `${percentage}%`, 
                                height: '100%', 
                                bgcolor: 'primary.main' 
                              }} 
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {percentage}%
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Gender Distribution */}
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Gender Distribution
                      </Typography>
                      {Object.entries(getShowInfo(selectedShow, selectedPlacement).audienceData?.demographics.gender || {}).map(([gender, percentage]) => (
                        <Box key={gender} display="flex" alignItems="center" gap={1} mb={0.5}>
                          <Typography variant="caption" sx={{ minWidth: 50, textTransform: 'capitalize' }}>
                            {gender}:
                          </Typography>
                          <Box 
                            sx={{ 
                              flex: 1, 
                              height: 8, 
                              bgcolor: 'grey.200', 
                              borderRadius: 1,
                              overflow: 'hidden'
                            }}
                          >
                            <Box 
                              sx={{ 
                                width: `${percentage}%`, 
                                height: '100%', 
                                bgcolor: gender === 'male' ? 'info.main' : 
                                        gender === 'female' ? 'secondary.main' : 'warning.main'
                              }} 
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {percentage}%
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Spot Type Selection */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Spot Type Settings
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Choose how new spots will be classified:
                  </Typography>
                  
                  <ButtonGroup variant="outlined" fullWidth sx={{ mt: 2 }}>
                    {Object.entries(SPOT_TYPE_CONFIG).map(([type, config]) => {
                      const IconComponent = config.icon
                      return (
                        <Button
                          key={type}
                          startIcon={<IconComponent />}
                          color={config.color}
                          variant="outlined"
                          sx={{ 
                            textTransform: 'none',
                            '&:hover': {
                              bgcolor: alpha(theme.palette[config.color].main, 0.1)
                            }
                          }}
                        >
                          {config.label}
                        </Button>
                      )
                    })}
                  </ButtonGroup>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    • Paid: Full-rate commercial spots
                    • Added Value: Bonus spots at no charge
                    • Makegood: Replacement for missed/underperforming spots
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}
        </Drawer>

        {/* Bulk Placement Dialog */}
        <Dialog open={bulkPlacementOpen} onClose={() => setBulkPlacementOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Bulk Weekly Placement
            {selectedShow && selectedPlacement && (
              <Typography variant="body2" color="text.secondary">
                {selectedShow.name} • {PLACEMENT_CONFIG[selectedPlacement]?.label}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={3}>
              {/* Spots Per Week */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Spots Per Week
                </Typography>
                <Slider
                  value={bulkSettings.spotsPerWeek}
                  onChange={(_, value) => setBulkSettings(prev => ({ ...prev, spotsPerWeek: value as number }))}
                  min={1}
                  max={7}
                  marks
                  valueLabelDisplay="on"
                  sx={{ mt: 2 }}
                />
              </Box>

              {/* Days of Week Selection */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Available Days
                </Typography>
                <FormGroup row>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <FormControlLabel
                      key={day}
                      control={
                        <Checkbox
                          checked={bulkSettings.daysOfWeek[index]}
                          onChange={(e) => {
                            const newDays = [...bulkSettings.daysOfWeek]
                            newDays[index] = e.target.checked
                            setBulkSettings(prev => ({ ...prev, daysOfWeek: newDays }))
                          }}
                          size="small"
                        />
                      }
                      label={day}
                    />
                  ))}
                </FormGroup>
                <Typography variant="caption" color="text.secondary">
                  Select which days of the week are acceptable for ad placement
                </Typography>
              </Box>

              {/* Preferred Days */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Preferred Days (Optional)
                </Typography>
                <FormControl size="small" fullWidth>
                  <Select
                    multiple
                    value={bulkSettings.preferredDays}
                    onChange={(e) => setBulkSettings(prev => ({ 
                      ...prev, 
                      preferredDays: Array.isArray(e.target.value) ? e.target.value : [e.target.value] 
                    }))}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as number[]).map((dayIndex) => (
                          <Chip 
                            key={dayIndex} 
                            label={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]} 
                            size="small" 
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                      <MenuItem key={index} value={index} disabled={!bulkSettings.daysOfWeek[index]}>
                        {day}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary">
                  These days will be prioritized when placing spots
                </Typography>
              </Box>

              {/* Auto Assignment Option */}
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={bulkSettings.autoAssign}
                      onChange={(e) => setBulkSettings(prev => ({ ...prev, autoAssign: e.target.checked }))}
                    />
                  }
                  label="Auto-assign spots immediately"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  When enabled, spots will be automatically added to your schedule. 
                  When disabled, eligible slots will be highlighted for manual selection.
                </Typography>
              </Box>

              {/* Preview */}
              <Card sx={{ bgcolor: 'action.hover' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Preview
                  </Typography>
                  <Typography variant="body2">
                    Will place <strong>{bulkSettings.spotsPerWeek} spots per week</strong> on{' '}
                    <strong>
                      {bulkSettings.daysOfWeek
                        .map((enabled, index) => enabled ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index] : null)
                        .filter(Boolean)
                        .join(', ')}
                    </strong>
                    {bulkSettings.preferredDays.length > 0 && (
                      <>, prioritizing{' '}
                      <strong>
                        {bulkSettings.preferredDays
                          .map(index => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index])
                          .join(', ')}
                      </strong>
                      </>
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {bulkSettings.autoAssign ? 
                      'Spots will be automatically assigned to your schedule' :
                      'Eligible slots will be highlighted for manual selection'
                    }
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBulkPlacementOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleBulkPlacement} 
              variant="contained"
              disabled={!selectedShow || !selectedPlacement || bulkSettings.daysOfWeek.every(day => !day)}
            >
              {bulkSettings.autoAssign ? 'Auto-Place Spots' : 'Highlight Slots'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DndContext>
  )
}