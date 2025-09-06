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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Avatar,
  AvatarGroup,
  Collapse,
  Switch,
  FormControlLabel
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
  DragIndicator,
  Warning as WarningIcon,
  Info as InfoIcon,
  AttachMoney as MoneyIcon,
  Schedule as ScheduleIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  RadioButtonChecked as PreRollIcon,
  Mic as MidRollIcon,
  RadioButtonUnchecked as PostRollIcon,
  Campaign as CampaignIcon,
  Today as TodayIcon,
  FiberManualRecord as DotIcon,
  ViewCompact as CompactIcon,
  ViewHeadline as SummaryIcon,
  ViewList as DetailedIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  TrendingUp as ImpressionsIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material'
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek,
  endOfWeek,
  eachDayOfInterval, 
  eachWeekOfInterval,
  isSameMonth, 
  isSameWeek,
  addMonths, 
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
  isSameDay 
} from 'date-fns'
import { EnhancedInventorySlot, ScheduleItem } from '@/hooks/useEnhancedScheduleBuilder'

type ViewMode = 'day' | 'week' | 'biweek' | 'month'
type CalendarLayout = 'compact' | 'expanded' | 'split'
type DisclosureLevel = 'minimal' | 'summary' | 'detailed'

interface ShowColorMap {
  [showId: string]: string
}

interface Props {
  inventory: EnhancedInventorySlot[]
  selectedItems: ScheduleItem[]
  onAddItem: (slot: EnhancedInventorySlot, negotiatedPrice?: number) => void
  onRemoveItem: (itemId: string) => void
  onUpdatePrice: (itemId: string, price: number) => void
  onMoveItem?: (itemId: string, newDate: Date) => void
  loading?: boolean
  filters?: {
    showId?: string
    placementType?: string
    minImpressions?: number
    maxPrice?: number
    campaignId?: string
    search?: string
    minPrice?: number
    maxImpressions?: number
    categories?: string[]
  }
  onFiltersChange?: (filters: any) => void
  campaignBudget?: number
  shows?: Array<{ id: string; name: string; color?: string }>
}

// Generate consistent colors for shows
const generateShowColors = (shows: Array<{ id: string; name: string }>): ShowColorMap => {
  const colors = [
    '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2', '#f57c00',
    '#0288d1', '#689f38', '#c62828', '#6a1b9a', '#ef6c00',
    '#0277bd', '#558b2f', '#b71c1c', '#4a148c', '#e65100'
  ]
  
  const colorMap: ShowColorMap = {}
  shows.forEach((show, index) => {
    colorMap[show.id] = colors[index % colors.length]
  })
  return colorMap
}

// Placement type configuration
const PLACEMENT_CONFIG = {
  'pre-roll': { icon: PreRollIcon, color: 'info' as const, label: 'Pre' },
  'mid-roll': { icon: MidRollIcon, color: 'success' as const, label: 'Mid' },
  'post-roll': { icon: PostRollIcon, color: 'warning' as const, label: 'Post' }
}

export function ImprovedScheduleCalendar({
  inventory,
  selectedItems,
  onAddItem,
  onRemoveItem,
  onUpdatePrice,
  onMoveItem,
  loading = false,
  filters = {},
  onFiltersChange,
  campaignBudget,
  shows = []
}: Props) {
  const theme = useTheme()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [calendarLayout, setCalendarLayout] = useState<CalendarLayout>('expanded')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false)
  const [priceEditMode, setPriceEditMode] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [hiddenShows, setHiddenShows] = useState<Set<string>>(new Set())
  const [groupByShow, setGroupByShow] = useState(true)
  const [disclosureLevel, setDisclosureLevel] = useState<DisclosureLevel>('summary')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Generate show colors
  const showColors = useMemo(() => generateShowColors(shows), [shows])

  // Get unique categories from inventory
  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    inventory.forEach(slot => {
      if (slot.showCategory) {
        categories.add(slot.showCategory)
      }
    })
    return Array.from(categories).sort()
  }, [inventory])

  // Handle search input with debouncing
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (onFiltersChange) {
      onFiltersChange({ ...filters, search: value })
    }
  }

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('')
    if (onFiltersChange) {
      onFiltersChange({})
    }
  }

  // Get date range based on view mode
  const dateRange = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return {
          start: currentDate,
          end: currentDate
        }
      case 'week':
        return {
          start: startOfWeek(currentDate),
          end: endOfWeek(currentDate)
        }
      case 'biweek':
        const weekStart = startOfWeek(currentDate)
        return {
          start: weekStart,
          end: endOfWeek(addWeeks(weekStart, 1))
        }
      case 'month':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        }
    }
  }, [currentDate, viewMode])

  const daysInView = eachDayOfInterval(dateRange)

  // Filter inventory based on filters and hidden shows
  const filteredInventory = useMemo(() => {
    return inventory.filter(slot => {
      // Defensive check - ensure slot exists and has required properties
      if (!slot || !slot.airDate || !slot.showId) return false
      
      // Date range filter
      const slotDate = new Date(slot.airDate)
      if (isNaN(slotDate.getTime()) || slotDate < dateRange.start || slotDate > dateRange.end) return false
      
      // Hidden shows filter
      if (hiddenShows.has(slot.showId)) return false
      
      // Basic filters
      if (filters.showId && slot.showId !== filters.showId) return false
      if (filters.placementType && slot.placementType !== filters.placementType) return false
      if (filters.minImpressions && (slot.estimatedImpressions || 0) < filters.minImpressions) return false
      if (filters.maxPrice && (slot.adjustedPrice || 0) > filters.maxPrice) return false
      
      // Advanced filters
      if (filters.minPrice && (slot.adjustedPrice || 0) < filters.minPrice) return false
      if (filters.maxImpressions && (slot.estimatedImpressions || 0) > filters.maxImpressions) return false
      if (filters.categories && filters.categories.length > 0 && !filters.categories.includes(slot.showCategory)) return false
      
      // Search filter - search in episode title, show name, and episode number
      if (searchQuery || filters.search) {
        const query = (searchQuery || filters.search || '').toLowerCase()
        const matchesTitle = (slot.episodeTitle || '').toLowerCase().includes(query)
        const matchesShow = (slot.showName || '').toLowerCase().includes(query)
        const matchesEpisode = slot.episodeNumber?.toString().includes(query)
        const matchesPlacement = slot.placementType.toLowerCase().includes(query)
        
        if (!matchesTitle && !matchesShow && !matchesEpisode && !matchesPlacement) return false
      }
      
      return true
    })
  }, [inventory, dateRange, hiddenShows, filters, searchQuery])

  // Group inventory by date and optionally by show
  const inventoryByDate = useMemo(() => {
    const grouped = new Map<string, Map<string, EnhancedInventorySlot[]>>()
    
    filteredInventory.forEach(slot => {
      // Additional defensive check
      if (!slot || !slot.airDate) return
      
      try {
        const dateKey = format(new Date(slot.airDate), 'yyyy-MM-dd')
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, new Map())
        }
        
        const dateGroup = grouped.get(dateKey)!
        const groupKey = groupByShow ? (slot.showId || 'unknown') : 'all'
        
        if (!dateGroup.has(groupKey)) {
          dateGroup.set(groupKey, [])
        }
        dateGroup.get(groupKey)!.push(slot)
      } catch (error) {
        console.warn('Error processing slot for grouping:', slot, error)
      }
    })
    
    return grouped
  }, [filteredInventory, groupByShow])

  // Group selected items by date
  const selectedByDate = useMemo(() => {
    const grouped = new Map<string, ScheduleItem[]>()
    
    selectedItems.forEach(item => {
      // Defensive checks
      if (!item || !item.airDate || !item.showId) return
      if (hiddenShows.has(item.showId)) return
      
      try {
        const dateKey = format(new Date(item.airDate), 'yyyy-MM-dd')
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, [])
        }
        grouped.get(dateKey)!.push(item)
      } catch (error) {
        console.warn('Error processing selected item for grouping:', item, error)
      }
    })
    
    return grouped
  }, [selectedItems, hiddenShows])

  // Toggle date expansion
  const toggleDateExpansion = (dateKey: string) => {
    const newExpanded = new Set(expandedDates)
    if (newExpanded.has(dateKey)) {
      newExpanded.delete(dateKey)
    } else {
      newExpanded.add(dateKey)
    }
    setExpandedDates(newExpanded)
  }

  // Toggle show visibility
  const toggleShowVisibility = (showId: string) => {
    const newHidden = new Set(hiddenShows)
    if (newHidden.has(showId)) {
      newHidden.delete(showId)
    } else {
      newHidden.add(showId)
    }
    setHiddenShows(newHidden)
  }

  // Handle drag end with defensive programming
  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over || !onMoveItem || !event.active) return
    
    try {
      const itemId = event.active.id as string
      const destDateKey = event.over.id as string
      
      if (!itemId || !destDateKey) return
      
      const selectedItem = selectedItems.find(item => item?.id === itemId)
      if (!selectedItem || !selectedItem.airDate) return
      
      const currentDateKey = format(new Date(selectedItem.airDate), 'yyyy-MM-dd')
      if (destDateKey !== currentDateKey) {
        const newDate = new Date(destDateKey)
        if (!isNaN(newDate.getTime())) {
          onMoveItem(itemId, newDate)
        }
      }
    } catch (error) {
      console.warn('Error handling drag end:', error)
    }
  }

  // Navigation
  const handlePrevious = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(prev => new Date(prev.getTime() - 24 * 60 * 60 * 1000))
        break
      case 'week':
        setCurrentDate(prev => subWeeks(prev, 1))
        break
      case 'biweek':
        setCurrentDate(prev => subWeeks(prev, 2))
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
        setCurrentDate(prev => addWeeks(prev, 1))
        break
      case 'biweek':
        setCurrentDate(prev => addWeeks(prev, 2))
        break
      case 'month':
        setCurrentDate(prev => addMonths(prev, 1))
        break
    }
  }

  // Get stats for a date
  const getDateStats = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const dateInventory = inventoryByDate.get(dateKey)
    const dateSelected = selectedByDate.get(dateKey) || []
    
    let available = 0
    if (dateInventory) {
      dateInventory.forEach(slots => {
        available += slots.length
      })
    }
    
    const revenue = dateSelected.reduce((sum, item) => sum + item.negotiatedPrice, 0)
    
    return {
      available,
      selected: dateSelected.length,
      revenue,
      shows: dateInventory ? Array.from(dateInventory.keys()) : []
    }
  }

  // Render slot chip with defensive programming
  const renderSlotChip = (slot: EnhancedInventorySlot, isSelected: boolean) => {
    // Defensive checks
    if (!slot) return null
    
    const placement = PLACEMENT_CONFIG[slot.placementType as keyof typeof PLACEMENT_CONFIG]
    const PlacementIcon = placement?.icon
    const showColor = showColors[slot.showId || ''] || theme.palette.grey[500]
    
    return (
      <Chip
        size="small"
        avatar={
          <Avatar sx={{ bgcolor: showColor, width: 24, height: 24 }}>
            {(slot.showName || 'Unknown').charAt(0)}
          </Avatar>
        }
        icon={PlacementIcon ? <PlacementIcon fontSize="small" /> : undefined}
        label={
          <Box display="flex" alignItems="center" gap={0.5}>
            <Typography variant="caption" fontWeight="medium">
              {placement?.label || 'Unknown'}
            </Typography>
            <Typography variant="caption">
              ${(slot.adjustedPrice || 0).toLocaleString()}
            </Typography>
          </Box>
        }
        color={isSelected ? 'primary' : 'default'}
        variant={isSelected ? 'filled' : 'outlined'}
        onClick={() => !isSelected && slot && onAddItem(slot)}
        onDelete={isSelected ? () => {
          const item = selectedItems.find(i => i.id === slot?.id)
          if (item) onRemoveItem(item.id)
        } : undefined}
        sx={{
          maxWidth: '100%',
          '& .MuiChip-label': {
            px: 1
          },
          borderColor: showColor,
          '&:hover': {
            borderColor: showColor,
            bgcolor: alpha(showColor, 0.1)
          }
        }}
      />
    )
  }

  // Droppable day cell component
  function DroppableDayCell({ dateKey, children }: { dateKey: string; children: React.ReactNode }) {
    return (
      <div data-droppable-id={dateKey}>
        {children}
      </div>
    )
  }

  // Draggable selected item component
  function DraggableSelectedItem({ item, index }: { item: ScheduleItem; index: number }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <Box
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
      >
        {renderSlotChip(
          {
            ...item,
            adjustedPrice: item.negotiatedPrice,
            available: true
          } as EnhancedInventorySlot,
          true
        )}
      </Box>
    )
  }

  // Progressive disclosure helpers
  const getCellHeight = (viewMode: ViewMode, disclosureLevel: DisclosureLevel) => {
    if (viewMode === 'month') {
      switch (disclosureLevel) {
        case 'minimal': return 60
        case 'summary': return 100
        case 'detailed': return 'auto'
        default: return 100
      }
    } else if (viewMode === 'biweek') {
      switch (disclosureLevel) {
        case 'minimal': return 90
        case 'summary': return 130
        case 'detailed': return 'auto'
        default: return 130
      }
    } else {
      switch (disclosureLevel) {
        case 'minimal': return 80
        case 'summary': return 150
        case 'detailed': return 'auto'
        default: return 150
      }
    }
  }

  // Render progressive disclosure content
  const renderDisclosureContent = (day: Date, stats: any, dateInventory: any, dateSelected: any) => {
    const dateKey = format(day, 'yyyy-MM-dd')

    if (disclosureLevel === 'minimal') {
      return (
        <Box sx={{ p: 0.5, height: '100%' }}>
          <Typography 
            variant="caption" 
            fontWeight={isToday(day) ? 'bold' : 'medium'}
            color={isToday(day) ? 'primary.main' : 'text.primary'}
          >
            {format(day, 'd')}
          </Typography>
          {stats.available > 0 && (
            <Box display="flex" flexWrap="wrap" gap={0.25} mt={0.5}>
              {Array.from(dateInventory?.values() || []).flat().slice(0, 12).map((slot: any, idx: number) => {
                const isSelected = selectedItems.some(item => item.id === slot.id)
                const showColor = showColors[slot.showId] || theme.palette.grey[500]
                return (
                  <Box
                    key={idx}
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: showColor,
                      opacity: isSelected ? 1 : 0.6,
                      cursor: 'pointer',
                      '&:hover': { transform: 'scale(1.5)' }
                    }}
                    onClick={() => !isSelected && onAddItem(slot)}
                  />
                )
              })}
              {stats.available > 12 && (
                <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.7 }}>
                  +{stats.available - 12}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )
    }

    if (disclosureLevel === 'summary') {
      return (
        <Box sx={{ p: 1, height: '100%' }}>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography 
              variant="body2" 
              fontWeight={isToday(day) ? 'bold' : 'medium'}
              color={isToday(day) ? 'primary.main' : 'text.primary'}
            >
              {format(day, viewMode === 'month' ? 'd' : 'EEE d')}
            </Typography>
            {stats.available > 0 && (
              <Chip 
                label={`${stats.selected}/${stats.available}`}
                size="small" 
                variant="outlined"
                color={stats.selected > 0 ? 'primary' : 'default'}
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
            )}
          </Box>
          
          {/* Content */}
          <Box sx={{ height: 'calc(100% - 30px)', overflowY: 'hidden' }}>
            {stats.revenue > 0 && (
              <Typography variant="caption" color="success.main" fontWeight="medium" display="block">
                ${(stats.revenue || 0).toLocaleString()}
              </Typography>
            )}
            {stats.available > 0 && (
              <Stack spacing={0.5}>
                {/* Group by show for better visual differentiation */}
                {Array.from(dateInventory?.entries() || [])
                  .slice(0, viewMode === 'month' ? 2 : viewMode === 'biweek' ? 3 : 4)
                  .map(([showId, slots]: [string, any[]]) => {
                    const show = shows.find(s => s.id === showId)
                    const showColor = showColors[showId] || theme.palette.grey[500]
                    const displaySlots = slots.slice(0, viewMode === 'month' ? 2 : 3)
                    
                    return (
                      <Box key={showId}>
                        {/* Show identifier with color coding */}
                        {viewMode !== 'month' && (
                          <Box display="flex" alignItems="center" gap={0.5} mb={0.25}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: showColor
                              }}
                            />
                            <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.8 }}>
                              {(show?.name || 'Unknown').slice(0, 8)}...
                            </Typography>
                          </Box>
                        )}
                        
                        {/* Slots for this show */}
                        <Box display="flex" gap={0.25} flexWrap="wrap">
                          {displaySlots.map((slot: any, idx: number) => {
                            const isSelected = selectedItems.some(item => item.id === slot.id)
                            const placement = PLACEMENT_CONFIG[slot.placementType as keyof typeof PLACEMENT_CONFIG]
                            
                            return (
                              <Chip
                                key={idx}
                                size="small"
                                label={`${placement?.label?.charAt(0) || '?'} $${Math.round(slot?.adjustedPrice || 0)}`}
                                variant={isSelected ? 'filled' : 'outlined'}
                                color={isSelected ? 'primary' : 'default'}
                                onClick={() => !isSelected && slot && onAddItem(slot)}
                                sx={{
                                  height: 18,
                                  fontSize: '0.6rem',
                                  borderColor: showColor,
                                  bgcolor: isSelected ? showColor : 'transparent',
                                  '&:hover': { 
                                    bgcolor: alpha(showColor, isSelected ? 0.8 : 0.1),
                                    transform: 'scale(1.05)'
                                  }
                                }}
                              />
                            )
                          })}
                          {slots.length > displaySlots.length && (
                            <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.6rem' }}>
                              +{slots.length - displaySlots.length}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    )
                  })}
                
                {/* Show count if more shows available */}
                {dateInventory && dateInventory.size > (viewMode === 'month' ? 2 : viewMode === 'biweek' ? 3 : 4) && (
                  <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.6rem' }}>
                    +{dateInventory.size - (viewMode === 'month' ? 2 : viewMode === 'biweek' ? 3 : 4)} more shows
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
        </Box>
      )
    }

    // Detailed view (existing implementation with minor adjustments)
    const isExpanded = expandedDates.has(dateKey) || disclosureLevel === 'detailed'
    
    return (
      <Box sx={{ p: 1.5, height: '100%' }}>
        {/* Date Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography 
              variant="body2" 
              fontWeight={isToday(day) ? 'bold' : 'medium'}
              color={isToday(day) ? 'primary.main' : 'text.primary'}
            >
              {format(day, viewMode === 'month' ? 'd' : 'EEE d')}
            </Typography>
            {stats.available > 0 && (
              <Chip 
                label={stats.available} 
                size="small" 
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>
          
          {viewMode !== 'day' && stats.available > 0 && (
            <IconButton 
              size="small" 
              onClick={() => toggleDateExpansion(dateKey)}
              sx={{ p: 0.5 }}
            >
              {isExpanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
            </IconButton>
          )}
        </Box>

        {/* Content Area */}
        <Box sx={{ overflowY: isExpanded ? 'auto' : 'hidden', height: 'calc(100% - 32px)' }}>
          <Stack spacing={1}>
            {/* Selected Items */}
            {dateSelected.length > 0 && (
              <>
                <Typography variant="caption" color="primary" fontWeight="medium">
                  Scheduled ({dateSelected.length})
                </Typography>
                <SortableContext items={dateSelected.map((item: any) => item.id)} strategy={verticalListSortingStrategy}>
                  <Stack spacing={0.5}>
                    {dateSelected.map((item: any, index: number) => (
                      <DraggableSelectedItem key={item.id} item={item} index={index} />
                    ))}
                  </Stack>
                </SortableContext>
              </>
            )}
            
            {/* Available Inventory */}
            {dateInventory && dateInventory.size > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" fontWeight="medium">
                  Available
                </Typography>
                {Array.from(dateInventory.entries()).map(([groupKey, slots]: [string, any]) => (
                  <Stack key={groupKey} spacing={0.5}>
                    {groupByShow && (
                      <Typography variant="caption" color="text.secondary">
                        {shows.find(s => s.id === groupKey)?.name || 'Unknown'}
                      </Typography>
                    )}
                    {slots.filter((slot: any) => !selectedItems.some(item => item.id === slot.id))
                      .map((slot: any) => renderSlotChip(slot, false))}
                  </Stack>
                ))}
              </>
            )}
          </Stack>
        </Box>
      </Box>
    )
  }

  // Render day cell
  const renderDayCell = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const stats = getDateStats(day)
    const dateInventory = inventoryByDate.get(dateKey)  
    const dateSelected = selectedByDate.get(dateKey) || []
    
    const cellHeight = getCellHeight(viewMode, disclosureLevel)
    
    return (
      <DroppableDayCell dateKey={dateKey}>
        <Card
          sx={{
            height: cellHeight,
            minHeight: cellHeight === 'auto' ? (viewMode === 'month' ? (disclosureLevel === 'minimal' ? 60 : 100) : 150) : cellHeight,
            bgcolor: stats.selected > 0
              ? alpha(theme.palette.success.main, 0.05)
              : 'background.paper',
            border: 1,
            borderColor: isToday(day) 
              ? 'primary.main' 
              : 'divider',
            borderWidth: isToday(day) ? 2 : 1,
            overflow: 'hidden',
            transition: 'all 0.2s ease-in-out',
            '&:hover': disclosureLevel === 'minimal' ? {
              transform: 'scale(1.02)',
              boxShadow: theme.shadows[2]
            } : {}
          }}
        >
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 }, height: '100%', overflow: 'hidden' }}>
            {renderDisclosureContent(day, stats, dateInventory, dateSelected)}
            
            {/* Click to open details - only for minimal and summary views */}
            {disclosureLevel !== 'detailed' && (stats.available > 0 || stats.selected > 0) && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.action.hover, 0.04)
                  }
                }}
                onClick={() => {
                  setSelectedDate(day)
                  setDetailsDrawerOpen(true)
                }}
              />
            )}
          </CardContent>
        </Card>
      </DroppableDayCell>
    )
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <Box>
        {/* Calendar Controls */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Navigation */}
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1}>
                <IconButton onClick={handlePrevious}>
                  <NavigateBefore />
                </IconButton>
                <Button 
                  size="small" 
                  startIcon={<TodayIcon />}
                  onClick={() => setCurrentDate(new Date())}
                >
                  Today
                </Button>
                <IconButton onClick={handleNext}>
                  <NavigateNext />
                </IconButton>
                <Typography variant="h6" sx={{ ml: 2 }}>
                  {viewMode === 'day' && format(currentDate, 'EEEE, MMMM d, yyyy')}
                  {viewMode === 'week' && `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`}
                  {viewMode === 'biweek' && `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')} (2 weeks)`}
                  {viewMode === 'month' && format(currentDate, 'MMMM yyyy')}
                </Typography>
              </Box>
            </Grid>

            {/* View Controls */}
            <Grid item xs={12} md={4}>
              <Box display="flex" gap={2} alignItems="center" justifyContent="center">
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(e, value) => value && setViewMode(value)}
                  size="small"
                >
                  <ToggleButton value="day">
                    <Tooltip title="Day View">
                      <DayIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="week">
                    <Tooltip title="Week View">
                      <WeekIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="biweek">
                    <Tooltip title="Biweekly View">
                      <BiweekIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="month">
                    <Tooltip title="Month View">
                      <CalendarIcon />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>

                <Divider orientation="vertical" flexItem />

                <ToggleButtonGroup
                  value={disclosureLevel}
                  exclusive
                  onChange={(e, value) => value && setDisclosureLevel(value)}
                  size="small"
                >
                  <ToggleButton value="minimal">
                    <Tooltip title="Minimal View - Show only dots">
                      <CompactIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="summary">
                    <Tooltip title="Summary View - Show key information">
                      <SummaryIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="detailed">
                    <Tooltip title="Detailed View - Show all information">
                      <DetailedIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Grid>

            {/* Search and Basic Filters */}
            <Grid item xs={12} md={4}>
              <Box display="flex" gap={1} justifyContent="flex-end">
                {/* Search Field */}
                <TextField
                  size="small"
                  placeholder="Search episodes, shows..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    endAdornment: searchQuery && (
                      <IconButton size="small" onClick={() => handleSearchChange('')}>
                        <ClearIcon />
                      </IconButton>
                    )
                  }}
                  sx={{ minWidth: 180 }}
                />

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Show</InputLabel>
                  <Select
                    value={filters.showId || ''}
                    onChange={(e) => onFiltersChange?.({ ...filters, showId: e.target.value || undefined })}
                    label="Show"
                  >
                    <MenuItem value="">All Shows</MenuItem>
                    {shows.map(show => (
                      <MenuItem key={show.id} value={show.id}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box 
                            sx={{ 
                              width: 12, 
                              height: 12, 
                              borderRadius: '50%', 
                              bgcolor: showColors[show.id] 
                            }} 
                          />
                          {show.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={filters.placementType || ''}
                    onChange={(e) => onFiltersChange?.({ ...filters, placementType: e.target.value || undefined })}
                    label="Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    {Object.entries(PLACEMENT_CONFIG).map(([type, config]) => (
                      <MenuItem key={type} value={type}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <config.icon fontSize="small" />
                          {config.label}-roll
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  startIcon={<FilterIcon />}
                  variant={showAdvancedFilters ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  {showAdvancedFilters ? 'Less' : 'More'}
                </Button>

                {(Object.keys(filters).length > 0 || searchQuery) && (
                  <Button
                    startIcon={<ClearIcon />}
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={clearAllFilters}
                  >
                    Clear
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>

          {/* Advanced Filters Panel */}
          <Collapse in={showAdvancedFilters}>
            <Box mt={2} p={2} bgcolor="background.default" borderRadius={1}>
              <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                Advanced Filters
              </Typography>
              
              <Grid container spacing={2} alignItems="center">
                {/* Price Range */}
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Price Range
                  </Typography>
                  <Box display="flex" gap={1}>
                    <TextField
                      size="small"
                      placeholder="Min"
                      type="number"
                      value={filters.minPrice || ''}
                      onChange={(e) => onFiltersChange?.({ 
                        ...filters, 
                        minPrice: e.target.value ? Number(e.target.value) : undefined 
                      })}
                      InputProps={{
                        startAdornment: <MoneyIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      placeholder="Max"
                      type="number"
                      value={filters.maxPrice || ''}
                      onChange={(e) => onFiltersChange?.({ 
                        ...filters, 
                        maxPrice: e.target.value ? Number(e.target.value) : undefined 
                      })}
                      InputProps={{
                        startAdornment: <MoneyIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      }}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                </Grid>

                {/* Impressions Range */}
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Impressions Range
                  </Typography>
                  <Box display="flex" gap={1}>
                    <TextField
                      size="small"
                      placeholder="Min"
                      type="number"
                      value={filters.minImpressions || ''}
                      onChange={(e) => onFiltersChange?.({ 
                        ...filters, 
                        minImpressions: e.target.value ? Number(e.target.value) : undefined 
                      })}
                      InputProps={{
                        startAdornment: <ImpressionsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      placeholder="Max"
                      type="number"
                      value={filters.maxImpressions || ''}
                      onChange={(e) => onFiltersChange?.({ 
                        ...filters, 
                        maxImpressions: e.target.value ? Number(e.target.value) : undefined 
                      })}
                      InputProps={{
                        startAdornment: <ImpressionsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      }}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                </Grid>

                {/* Categories Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      multiple
                      value={filters.categories || []}
                      onChange={(e) => onFiltersChange?.({ 
                        ...filters, 
                        categories: Array.isArray(e.target.value) ? e.target.value : [e.target.value] 
                      })}
                      label="Category"
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {availableCategories.map(category => (
                        <MenuItem key={category} value={category}>
                          {category}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Filter Summary */}
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Active Filters
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                      {Object.entries(filters).map(([key, value]) => {
                        if (!value || (Array.isArray(value) && value.length === 0)) return null
                        
                        let label = ''
                        if (key === 'minPrice') label = `Min: $${value}`
                        else if (key === 'maxPrice') label = `Max: $${value}`
                        else if (key === 'minImpressions') label = `Min: ${value?.toLocaleString()}`
                        else if (key === 'maxImpressions') label = `Max: ${value?.toLocaleString()}`
                        else if (key === 'categories') label = `${(value as string[]).length} categories`
                        else if (key === 'search') label = `"${value}"`
                        else return null

                        return (
                          <Chip
                            key={key}
                            label={label}
                            size="small"
                            variant="outlined"
                            onDelete={() => {
                              const newFilters = { ...filters }
                              delete newFilters[key as keyof typeof filters]
                              onFiltersChange?.(newFilters)
                            }}
                          />
                        )
                      })}
                      
                      {searchQuery && (
                        <Chip
                          label={`"${searchQuery}"`}
                          size="small"
                          variant="outlined"
                          onDelete={() => handleSearchChange('')}
                        />
                      )}
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Collapse>

          {/* Filter Results Summary */}
          {(Object.keys(filters).length > 0 || searchQuery) && (
            <Box mt={2} p={1.5} bgcolor="action.hover" borderRadius={1}>
              <Typography variant="body2" color="text.secondary">
                <SearchIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                Showing {filteredInventory.length} of {inventory.length} available slots
                {searchQuery && ` matching "${searchQuery}"`}
              </Typography>
            </Box>
          )}

          {/* Additional Controls */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
            <Box display="flex" gap={2} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={groupByShow}
                    onChange={(e) => setGroupByShow(e.target.checked)}
                  />
                }
                label="Group by Show"
              />
              
              {/* Show visibility toggles */}
              <Box display="flex" gap={1}>
                {shows.map(show => (
                  <Chip
                    key={show.id}
                    label={show.name}
                    size="small"
                    avatar={
                      <Avatar sx={{ bgcolor: showColors[show.id], width: 20, height: 20 }}>
                        {show.name.charAt(0)}
                      </Avatar>
                    }
                    deleteIcon={hiddenShows.has(show.id) ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    onDelete={() => toggleShowVisibility(show.id)}
                    variant={hiddenShows.has(show.id) ? 'outlined' : 'filled'}
                    sx={{
                      opacity: hiddenShows.has(show.id) ? 0.5 : 1
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Budget indicator */}
            {campaignBudget && (
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="body2" color="text.secondary">
                  Budget:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  ${(campaignBudget || 0).toLocaleString()}
                </Typography>
                <Divider orientation="vertical" flexItem />
                <Typography variant="body2" color="text.secondary">
                  Remaining:
                </Typography>
                <Typography 
                  variant="body2" 
                  fontWeight="medium"
                  color={
                    selectedItems.reduce((sum, item) => sum + item.negotiatedPrice, 0) > campaignBudget 
                      ? 'error.main' 
                      : 'success.main'
                  }
                >
                  ${((campaignBudget || 0) - selectedItems.reduce((sum, item) => sum + (item?.negotiatedPrice || 0), 0)).toLocaleString()}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Calendar Grid */}
        <Paper sx={{ p: 2, overflow: 'auto' }}>
          {viewMode === 'month' ? (
            // Month View Grid
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
                  <Box height={getCellHeight(viewMode, disclosureLevel)} />
                </Grid>
              ))}
              
              {/* Days */}
              {daysInView.map(day => (
                <Grid item xs={12 / 7} key={format(day, 'yyyy-MM-dd')}>
                  {renderDayCell(day)}
                </Grid>
              ))}
            </Grid>
          ) : viewMode === 'week' ? (
            // Week View
            <Grid container spacing={1}>
              {daysInView.map(day => (
                <Grid item xs={12 / 7} key={format(day, 'yyyy-MM-dd')}>
                  <Typography variant="subtitle2" align="center" gutterBottom>
                    {format(day, 'EEE')}
                  </Typography>
                  {renderDayCell(day)}
                </Grid>
              ))}
            </Grid>
          ) : viewMode === 'biweek' ? (
            // Biweekly View - Two weeks in a row
            <Box>
              {/* Week headers */}
              <Grid container spacing={1} mb={1}>
                <Grid item xs={6}>
                  <Typography variant="subtitle1" align="center" fontWeight="medium">
                    Week of {format(dateRange.start, 'MMM d')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle1" align="center" fontWeight="medium">
                    Week of {format(addWeeks(dateRange.start, 1), 'MMM d')}
                  </Typography>
                </Grid>
              </Grid>
              
              {/* Two week grid */}
              <Grid container spacing={1}>
                {/* First week */}
                <Grid item xs={6}>
                  <Grid container spacing={0.5}>
                    {eachDayOfInterval({
                      start: dateRange.start,
                      end: endOfWeek(dateRange.start)
                    }).map(day => (
                      <Grid item xs={12 / 7} key={format(day, 'yyyy-MM-dd')}>
                        <Typography variant="caption" align="center" display="block" gutterBottom>
                          {format(day, 'EEE d')}
                        </Typography>
                        {renderDayCell(day)}
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
                
                {/* Second week */}
                <Grid item xs={6}>
                  <Grid container spacing={0.5}>
                    {eachDayOfInterval({
                      start: addWeeks(dateRange.start, 1),
                      end: dateRange.end
                    }).map(day => (
                      <Grid item xs={12 / 7} key={format(day, 'yyyy-MM-dd')}>
                        <Typography variant="caption" align="center" display="block" gutterBottom>
                          {format(day, 'EEE d')}
                        </Typography>
                        {renderDayCell(day)}
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </Grid>
            </Box>
          ) : (
            // Day View
            <Box>
              {renderDayCell(currentDate)}
            </Box>
          )}
        </Paper>

        {/* Details Drawer */}
        <Drawer
          anchor="right"
          open={detailsDrawerOpen}
          onClose={() => setDetailsDrawerOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: 480,
              maxWidth: '90vw'
            }
          }}
        >
          {selectedDate && (
            <Box p={3}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </Typography>
                <IconButton onClick={() => setDetailsDrawerOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Date details content */}
              <Stack spacing={3}>
                {/* Selected Items */}
                {selectedByDate.get(format(selectedDate, 'yyyy-MM-dd'))?.length > 0 && (
                  <Box>
                    <Typography variant="subtitle1" fontWeight="medium" mb={2}>
                      Scheduled Items
                    </Typography>
                    <List>
                      {selectedByDate.get(format(selectedDate, 'yyyy-MM-dd'))?.map(item => (
                        <ListItem
                          key={item.id}
                          sx={{
                            bgcolor: 'background.default',
                            mb: 1,
                            borderRadius: 1
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Avatar sx={{ bgcolor: showColors[item.showId], width: 24, height: 24 }}>
                                  {item.showName.charAt(0)}
                                </Avatar>
                                <Typography variant="body2" fontWeight="medium">
                                  {item.showName}
                                </Typography>
                                <Chip
                                  label={PLACEMENT_CONFIG[item.placementType as keyof typeof PLACEMENT_CONFIG]?.label + '-roll'}
                                  size="small"
                                  color={PLACEMENT_CONFIG[item.placementType as keyof typeof PLACEMENT_CONFIG]?.color}
                                />
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  Episode {item.episodeNumber}: {item.episodeTitle}
                                </Typography>
                                <Typography variant="caption" color="primary">
                                  ${(item?.negotiatedPrice || 0).toLocaleString()}
                                </Typography>
                              </Box>
                            }
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              onClick={() => onRemoveItem(item.id)}
                              color="error"
                              size="small"
                            >
                              <RemoveIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {/* Available Inventory */}
                {inventoryByDate.get(format(selectedDate, 'yyyy-MM-dd')) && (
                  <Box>
                    <Typography variant="subtitle1" fontWeight="medium" mb={2}>
                      Available Inventory
                    </Typography>
                    <List>
                      {Array.from(inventoryByDate.get(format(selectedDate, 'yyyy-MM-dd'))!.entries()).map(([groupKey, slots]) => (
                        <Box key={groupKey}>
                          {groupByShow && (
                            <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                              {shows.find(s => s.id === groupKey)?.name || 'Unknown'}
                            </Typography>
                          )}
                          {slots.filter(slot => !selectedItems.some(item => item.id === slot.id)).map(slot => (
                            <ListItem
                              key={slot.id}
                              sx={{
                                bgcolor: 'background.default',
                                mb: 1,
                                borderRadius: 1
                              }}
                            >
                              <ListItemText
                                primary={
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Typography variant="body2" fontWeight="medium">
                                      {slot?.episodeTitle || 'Unknown Episode'}
                                    </Typography>
                                    <Chip
                                      label={PLACEMENT_CONFIG[slot.placementType as keyof typeof PLACEMENT_CONFIG]?.label + '-roll'}
                                      size="small"
                                      color={PLACEMENT_CONFIG[slot.placementType as keyof typeof PLACEMENT_CONFIG]?.color}
                                    />
                                  </Box>
                                }
                                secondary={
                                  <Box>
                                    <Typography variant="caption" display="block">
                                      Episode #{slot?.episodeNumber || 'N/A'}
                                    </Typography>
                                    <Box display="flex" alignItems="center" gap={2}>
                                      <Typography variant="caption" color="text.secondary">
                                        ${(slot?.adjustedPrice || 0).toLocaleString()}
                                      </Typography>
                                      {slot?.estimatedImpressions && (
                                        <Typography variant="caption" color="text.secondary">
                                          {slot.estimatedImpressions.toLocaleString()} impr
                                        </Typography>
                                      )}
                                    </Box>
                                  </Box>
                                }
                              />
                              <ListItemSecondaryAction>
                                <Tooltip title={slot?.available ? 'Add to schedule' : 'Not available'}>
                                  <span>
                                    <IconButton
                                      edge="end"
                                      onClick={() => slot && onAddItem(slot)}
                                      disabled={!slot?.available}
                                      color="primary"
                                    >
                                      <AddIcon />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </Box>
                      ))}
                    </List>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Drawer>
      </Box>
    </DndContext>
  )
}