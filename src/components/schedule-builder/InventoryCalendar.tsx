'use client'

import { useState, useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Tooltip,
  Badge
} from '@mui/material'
import {
  CalendarMonth as CalendarIcon,
  ViewWeek as WeekIcon,
  ViewModule as GridIcon,
  Add as AddIcon,
  NavigateBefore,
  NavigateNext,
  AttachMoney as MoneyIcon,
  Mic as MicIcon,
  PlayCircle as PlayIcon
} from '@mui/icons-material'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from 'date-fns'
import { Show, InventorySlot, SelectedSlot } from '@/hooks/useScheduleBuilder'

interface InventoryCalendarProps {
  selectedShows: Show[]
  inventory: InventorySlot[]
  selectedSlots: SelectedSlot[]
  onAddSlot: (slot: InventorySlot) => void
  loading: boolean
  campaignBudget?: number | null
  remainingBudget?: number | null
}

type ViewMode = 'week' | 'month'
type PlacementFilter = 'all' | 'pre-roll' | 'mid-roll' | 'post-roll'

export function InventoryCalendar({
  selectedShows,
  inventory,
  selectedSlots,
  onAddSlot,
  loading,
  campaignBudget,
  remainingBudget
}: InventoryCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [placementFilter, setPlacementFilter] = useState<PlacementFilter>('all')
  const [showFilter, setShowFilter] = useState<string>('all')

  // Get date range for current view
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate),
        end: endOfWeek(currentDate)
      }
    } else {
      // Month view - show 4 weeks
      const start = startOfWeek(currentDate)
      return {
        start,
        end: addWeeks(start, 3)
      }
    }
  }, [currentDate, viewMode])

  const daysInView = eachDayOfInterval(dateRange)

  // Filter inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter(slot => {
      const slotDate = new Date(slot.airDate)
      const inDateRange = slotDate >= dateRange.start && slotDate <= dateRange.end
      const matchesPlacement = placementFilter === 'all' || slot.placementType === placementFilter
      const matchesShow = showFilter === 'all' || slot.showId === showFilter
      return inDateRange && matchesPlacement && matchesShow
    })
  }, [inventory, dateRange, placementFilter, showFilter])

  // Group inventory by date and show
  const inventoryByDateAndShow = useMemo(() => {
    const grouped: Record<string, Record<string, InventorySlot[]>> = {}
    
    daysInView.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd')
      grouped[dateKey] = {}
    })

    filteredInventory.forEach(slot => {
      const dateKey = format(new Date(slot.airDate), 'yyyy-MM-dd')
      if (!grouped[dateKey]) return
      
      if (!grouped[dateKey][slot.showId]) {
        grouped[dateKey][slot.showId] = []
      }
      grouped[dateKey][slot.showId].push(slot)
    })

    return grouped
  }, [filteredInventory, daysInView])

  // Check if slot is already selected
  const isSlotSelected = (slotId: string) => {
    return selectedSlots.some(s => s.id === slotId)
  }

  // Get quantity for selected slot
  const getSlotQuantity = (slotId: string) => {
    const slot = selectedSlots.find(s => s.id === slotId)
    return slot?.quantity || 0
  }

  // Navigation handlers
  const handlePrevious = () => {
    setCurrentDate(prev => subWeeks(prev, viewMode === 'week' ? 1 : 4))
  }

  const handleNext = () => {
    setCurrentDate(prev => addWeeks(prev, viewMode === 'week' ? 1 : 4))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Get placement icon
  const getPlacementIcon = (type: string) => {
    switch (type) {
      case 'pre-roll': return <PlayIcon fontSize="small" />
      case 'mid-roll': return <MicIcon fontSize="small" />
      case 'post-roll': return <PlayIcon fontSize="small" sx={{ transform: 'rotate(180deg)' }} />
      default: return null
    }
  }

  // Get placement color
  const getPlacementColor = (type: string): 'primary' | 'secondary' | 'success' => {
    switch (type) {
      case 'pre-roll': return 'primary'
      case 'mid-roll': return 'secondary'
      case 'post-roll': return 'success'
      default: return 'primary'
    }
  }

  if (loading) {
    return (
      <Box>
        <LinearProgress />
        <Typography variant="body1" color="text.secondary" align="center" mt={2}>
          Loading inventory...
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Date Navigation */}
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center" gap={1}>
              <IconButton onClick={handlePrevious}>
                <NavigateBefore />
              </IconButton>
              <Button onClick={handleToday} variant="outlined" size="small">
                Today
              </Button>
              <IconButton onClick={handleNext}>
                <NavigateNext />
              </IconButton>
              <Typography variant="body1" sx={{ ml: 2 }}>
                {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
              </Typography>
            </Box>
          </Grid>

          {/* View Mode */}
          <Grid item xs={12} md={2}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, value) => value && setViewMode(value)}
              size="small"
              fullWidth
            >
              <ToggleButton value="week">
                <WeekIcon sx={{ mr: 1 }} />
                Week
              </ToggleButton>
              <ToggleButton value="month">
                <GridIcon sx={{ mr: 1 }} />
                Month
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          {/* Filters */}
          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Placement Type"
              value={placementFilter}
              onChange={(e) => setPlacementFilter(e.target.value as PlacementFilter)}
            >
              <MenuItem value="all">All Placements</MenuItem>
              <MenuItem value="pre-roll">Pre-roll</MenuItem>
              <MenuItem value="mid-roll">Mid-roll</MenuItem>
              <MenuItem value="post-roll">Post-roll</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Show"
              value={showFilter}
              onChange={(e) => setShowFilter(e.target.value)}
            >
              <MenuItem value="all">All Shows</MenuItem>
              {selectedShows.map(show => (
                <MenuItem key={show.id} value={show.id}>
                  {show.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Calendar Grid */}
      <Paper sx={{ p: 2, overflowX: 'auto' }}>
        <Grid container spacing={1}>
          {/* Show labels */}
          <Grid item xs={2}>
            <Box sx={{ height: 60, display: 'flex', alignItems: 'center' }}>
              <Typography variant="subtitle2" color="text.secondary">
                Shows / Dates
              </Typography>
            </Box>
            {(showFilter === 'all' ? selectedShows : selectedShows.filter(s => s.id === showFilter)).map(show => (
              <Box key={show.id} sx={{ height: 80, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="body2" noWrap>
                  {show.name}
                </Typography>
              </Box>
            ))}
          </Grid>

          {/* Date columns */}
          {daysInView.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const isToday = isSameDay(day, new Date())
            
            return (
              <Grid item xs={10 / daysInView.length} key={dateKey}>
                {/* Date header */}
                <Box 
                  sx={{ 
                    height: 60, 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isToday ? 'primary.50' : 'transparent',
                    borderRadius: 1
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {format(day, 'EEE')}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={isToday ? 'bold' : 'normal'}>
                    {format(day, 'd')}
                  </Typography>
                </Box>

                {/* Show slots for this date */}
                {(showFilter === 'all' ? selectedShows : selectedShows.filter(s => s.id === showFilter)).map(show => {
                  const slots = inventoryByDateAndShow[dateKey]?.[show.id] || []
                  
                  return (
                    <Box 
                      key={`${show.id}-${dateKey}`} 
                      sx={{ 
                        height: 80, 
                        p: 0.5,
                        borderBottom: 1, 
                        borderRight: 1,
                        borderColor: 'divider',
                        bgcolor: slots.length === 0 ? 'grey.50' : 'background.paper'
                      }}
                    >
                      {slots.length > 0 ? (
                        <Box display="flex" flexDirection="column" gap={0.5}>
                          {slots.map(slot => {
                            const selected = isSlotSelected(slot.id)
                            const quantity = getSlotQuantity(slot.id)
                            const canAfford = !campaignBudget || !remainingBudget || remainingBudget >= slot.price
                            
                            return (
                              <Tooltip 
                                key={slot.id}
                                title={
                                  <Box>
                                    <Typography variant="body2">{slot.episodeTitle}</Typography>
                                    <Typography variant="caption">Episode #{slot.episodeNumber}</Typography>
                                    <Typography variant="caption" display="block">
                                      Price: ${slot.price} | Est. Impressions: {slot.estimatedImpressions?.toLocaleString() || 'N/A'}
                                    </Typography>
                                  </Box>
                                }
                              >
                                <Box>
                                  <Badge 
                                    badgeContent={quantity > 0 ? quantity : undefined} 
                                    color="primary"
                                  >
                                    <Chip
                                      size="small"
                                      label={`$${slot.price}`}
                                      icon={getPlacementIcon(slot.placementType)}
                                      color={getPlacementColor(slot.placementType)}
                                      variant={selected ? 'filled' : 'outlined'}
                                      onClick={() => canAfford && onAddSlot(slot)}
                                      disabled={!canAfford}
                                      sx={{ 
                                        cursor: canAfford ? 'pointer' : 'not-allowed',
                                        opacity: canAfford ? 1 : 0.5,
                                        fontSize: '0.75rem'
                                      }}
                                    />
                                  </Badge>
                                </Box>
                              </Tooltip>
                            )
                          })}
                        </Box>
                      ) : (
                        <Box 
                          display="flex" 
                          alignItems="center" 
                          justifyContent="center" 
                          height="100%"
                        >
                          <Typography variant="caption" color="text.disabled">
                            No inventory
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )
                })}
              </Grid>
            )
          })}
        </Grid>
      </Paper>

      {/* Legend */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Legend
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <Box display="flex" alignItems="center" gap={1}>
            <Chip size="small" icon={<PlayIcon />} label="Pre-roll" color="primary" />
            <Typography variant="caption">Beginning of episode</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip size="small" icon={<MicIcon />} label="Mid-roll" color="secondary" />
            <Typography variant="caption">Middle of episode</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip size="small" icon={<PlayIcon sx={{ transform: 'rotate(180deg)' }} />} label="Post-roll" color="success" />
            <Typography variant="caption">End of episode</Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}