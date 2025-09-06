'use client'

import { useState, useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  Button,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Tooltip,
  Badge,
  Checkbox,
  FormControlLabel,
  Collapse,
  Slider,
  FormControl,
  InputLabel,
  Select
} from '@mui/material'
import {
  CalendarMonth as CalendarIcon,
  ViewWeek as WeekIcon,
  ViewModule as GridIcon,
  NavigateBefore,
  NavigateNext,
  AttachMoney as MoneyIcon,
  Mic as MicIcon,
  PlayCircle as PlayIcon,
  DragIndicator as DragIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxBlankIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon
} from '@mui/icons-material'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from 'date-fns'
import { Show, InventorySlot, SelectedSlot } from '@/hooks/useScheduleBuilder'
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'

interface DraggableInventoryCalendarProps {
  selectedShows: Show[]
  inventory: InventorySlot[]
  selectedSlots: SelectedSlot[]
  onAddSlot: (slot: InventorySlot) => void
  onRemoveSlot: (slotId: string) => void
  onMoveSlot: (slotId: string, newDate: Date) => void
  loading: boolean
  campaignBudget?: number | null
  remainingBudget?: number | null
}

type ViewMode = 'week' | 'month'
type PlacementFilter = 'all' | 'pre-roll' | 'mid-roll' | 'post-roll'

// Draggable Slot Component
function DraggableSlot({ 
  slot, 
  selected, 
  quantity,
  onToggle,
  isDragging 
}: { 
  slot: InventorySlot
  selected: boolean
  quantity: number
  onToggle: () => void
  isDragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: slot.id,
    data: slot
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1
  } : undefined

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      sx={{ 
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
        display: 'inline-flex'
      }}
    >
      <Badge badgeContent={quantity > 0 ? quantity : undefined} color="primary">
        <Chip
          size="small"
          label={`$${slot.price}`}
          icon={
            <Box display="flex" alignItems="center">
              <DragIcon fontSize="small" sx={{ mr: 0.5 }} {...listeners} />
              {getPlacementIcon(slot.placementType)}
            </Box>
          }
          color={getPlacementColor(slot.placementType)}
          variant={selected ? 'filled' : 'outlined'}
          onClick={onToggle}
          sx={{ 
            fontSize: '0.75rem',
            '& .MuiChip-icon': {
              marginLeft: '4px'
            }
          }}
        />
      </Badge>
    </Box>
  )
}

// Droppable Date Cell
function DroppableCell({ 
  date, 
  showId, 
  children 
}: { 
  date: Date
  showId: string
  children: React.ReactNode 
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${format(date, 'yyyy-MM-dd')}-${showId}`,
    data: { date, showId }
  })

  return (
    <Box
      ref={setNodeRef}
      sx={{
        height: 80,
        p: 0.5,
        borderBottom: 1,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: isOver ? 'primary.50' : children ? 'background.paper' : 'grey.50',
        transition: 'background-color 0.2s'
      }}
    >
      {children}
    </Box>
  )
}

// Helper functions
const getPlacementIcon = (type: string) => {
  switch (type) {
    case 'pre-roll': return <PlayIcon fontSize="small" />
    case 'mid-roll': return <MicIcon fontSize="small" />
    case 'post-roll': return <PlayIcon fontSize="small" sx={{ transform: 'rotate(180deg)' }} />
    default: return null
  }
}

const getPlacementColor = (type: string): 'primary' | 'secondary' | 'success' => {
  switch (type) {
    case 'pre-roll': return 'primary'
    case 'mid-roll': return 'secondary'
    case 'post-roll': return 'success'
    default: return 'primary'
  }
}

export function DraggableInventoryCalendar({
  selectedShows,
  inventory,
  selectedSlots,
  onAddSlot,
  onRemoveSlot,
  onMoveSlot,
  loading,
  campaignBudget,
  remainingBudget
}: DraggableInventoryCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [placementFilter, setPlacementFilter] = useState<PlacementFilter>('all')
  const [showFilter, setShowFilter] = useState<string>('all')
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [selectedBulkSlots, setSelectedBulkSlots] = useState<Set<string>>(new Set())
  const [draggingSlot, setDraggingSlot] = useState<InventorySlot | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Get date range for current view
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate),
        end: endOfWeek(currentDate)
      }
    } else {
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

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || !active.data.current) return
    
    const slot = active.data.current as InventorySlot
    const dropData = over.data.current as { date: Date, showId: string }
    
    if (dropData && dropData.date && slot.showId === dropData.showId) {
      onMoveSlot(slot.id, dropData.date)
    }
    
    setDraggingSlot(null)
  }

  // Handle bulk operations
  const handleBulkToggle = (slotId: string) => {
    const newSelected = new Set(selectedBulkSlots)
    if (newSelected.has(slotId)) {
      newSelected.delete(slotId)
    } else {
      newSelected.add(slotId)
    }
    setSelectedBulkSlots(newSelected)
  }

  const handleBulkAdd = () => {
    selectedBulkSlots.forEach(slotId => {
      const slot = filteredInventory.find(s => s.id === slotId)
      if (slot && !isSlotSelected(slotId)) {
        onAddSlot(slot)
      }
    })
    setSelectedBulkSlots(new Set())
    setBulkSelectMode(false)
  }

  const handleSelectAllInView = () => {
    const allSlotIds = filteredInventory.map(s => s.id)
    setSelectedBulkSlots(new Set(allSlotIds))
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
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setDraggingSlot(event.active.data.current as InventorySlot)}
      onDragEnd={handleDragEnd}
    >
      <Box>
        {/* Controls */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Date Navigation */}
            <Grid item xs={12} md={3}>
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
              </Box>
            </Grid>

            {/* Date Range Display */}
            <Grid item xs={12} md={3}>
              <Typography variant="body1">
                {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
              </Typography>
            </Grid>

            {/* View Mode & Bulk Select */}
            <Grid item xs={12} md={3}>
              <Box display="flex" gap={1} alignItems="center">
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(e, value) => value && setViewMode(value)}
                  size="small"
                >
                  <ToggleButton value="week">
                    <WeekIcon />
                  </ToggleButton>
                  <ToggleButton value="month">
                    <GridIcon />
                  </ToggleButton>
                </ToggleButtonGroup>
                
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={bulkSelectMode}
                      onChange={(e) => {
                        setBulkSelectMode(e.target.checked)
                        if (!e.target.checked) {
                          setSelectedBulkSlots(new Set())
                        }
                      }}
                    />
                  }
                  label="Bulk Select"
                />
              </Box>
            </Grid>

            {/* Filters */}
            <Grid item xs={12} md={3}>
              <Box display="flex" gap={1}>
                <TextField
                  select
                  size="small"
                  label="Placement"
                  value={placementFilter}
                  onChange={(e) => setPlacementFilter(e.target.value as PlacementFilter)}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="pre-roll">Pre-roll</MenuItem>
                  <MenuItem value="mid-roll">Mid-roll</MenuItem>
                  <MenuItem value="post-roll">Post-roll</MenuItem>
                </TextField>

                <TextField
                  select
                  size="small"
                  label="Show"
                  value={showFilter}
                  onChange={(e) => setShowFilter(e.target.value)}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="all">All Shows</MenuItem>
                  {selectedShows.map(show => (
                    <MenuItem key={show.id} value={show.id}>
                      {show.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Grid>
          </Grid>

          {/* Bulk Actions */}
          {bulkSelectMode && (
            <Box display="flex" gap={2} mt={2} alignItems="center">
              <Typography variant="body2">
                {selectedBulkSlots.size} slots selected
              </Typography>
              <Button size="small" onClick={handleSelectAllInView}>
                Select All in View
              </Button>
              <Button 
                size="small" 
                variant="contained" 
                onClick={handleBulkAdd}
                disabled={selectedBulkSlots.size === 0}
              >
                Add Selected to Schedule
              </Button>
            </Box>
          )}
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
                      <DroppableCell
                        key={`${show.id}-${dateKey}`}
                        date={day}
                        showId={show.id}
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
                                  <Box display="flex" alignItems="center" gap={0.5}>
                                    {bulkSelectMode && (
                                      <Checkbox
                                        size="small"
                                        checked={selectedBulkSlots.has(slot.id)}
                                        onChange={() => handleBulkToggle(slot.id)}
                                        icon={<CheckBoxBlankIcon fontSize="small" />}
                                        checkedIcon={<CheckBoxIcon fontSize="small" />}
                                      />
                                    )}
                                    <DraggableSlot
                                      slot={slot}
                                      selected={selected}
                                      quantity={quantity}
                                      onToggle={() => canAfford && onAddSlot(slot)}
                                      isDragging={draggingSlot?.id === slot.id}
                                    />
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
                      </DroppableCell>
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
            Legend & Tips
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
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
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary">
                • Drag and drop slots to move them between dates (same show only)<br />
                • Use bulk select mode to add multiple slots at once<br />
                • Click on slot prices to add/remove from schedule
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggingSlot && (
          <Chip
            size="small"
            label={`$${draggingSlot.price}`}
            icon={getPlacementIcon(draggingSlot.placementType)}
            color={getPlacementColor(draggingSlot.placementType)}
            sx={{ cursor: 'grabbing' }}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}