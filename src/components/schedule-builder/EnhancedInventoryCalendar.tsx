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
  Divider
} from '@mui/material'
import {
  CalendarMonth as CalendarIcon,
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
  Close as CloseIcon
} from '@mui/icons-material'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isToday } from 'date-fns'
import { EnhancedInventorySlot, ScheduleItem } from '@/hooks/useEnhancedScheduleBuilder'

interface Props {
  inventory: EnhancedInventorySlot[]
  selectedItems: ScheduleItem[]
  onAddItem: (slot: EnhancedInventorySlot, negotiatedPrice?: number) => void
  onRemoveItem: (itemId: string) => void
  onUpdatePrice: (itemId: string, price: number) => void
  loading?: boolean
  filters?: {
    showId?: string
    placementType?: string
    minImpressions?: number
    maxPrice?: number
  }
  onFiltersChange?: (filters: any) => void
}

export function EnhancedInventoryCalendar({
  inventory,
  selectedItems,
  onAddItem,
  onRemoveItem,
  onUpdatePrice,
  loading = false,
  filters = {},
  onFiltersChange
}: Props) {
  const theme = useTheme()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false)
  const [priceEditMode, setPriceEditMode] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')

  // Get days in current month
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Group inventory by date
  const inventoryByDate = useMemo(() => {
    const grouped = new Map<string, EnhancedInventorySlot[]>()
    
    inventory.forEach(slot => {
      const dateKey = format(new Date(slot.airDate), 'yyyy-MM-dd')
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, [])
      }
      grouped.get(dateKey)!.push(slot)
    })

    return grouped
  }, [inventory])

  // Group selected items by date
  const selectedByDate = useMemo(() => {
    const grouped = new Map<string, ScheduleItem[]>()
    
    selectedItems.forEach(item => {
      const dateKey = format(new Date(item.airDate), 'yyyy-MM-dd')
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, [])
      }
      grouped.get(dateKey)!.push(item)
    })

    return grouped
  }, [selectedItems])

  // Get inventory for selected date with filters
  const getFilteredInventory = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    let slots = inventoryByDate.get(dateKey) || []

    if (filters.showId) {
      slots = slots.filter(s => s.showId === filters.showId)
    }
    if (filters.placementType) {
      slots = slots.filter(s => s.placementType === filters.placementType)
    }
    if (filters.minImpressions) {
      slots = slots.filter(s => (s.estimatedImpressions || 0) >= filters.minImpressions!)
    }
    if (filters.maxPrice) {
      slots = slots.filter(s => s.adjustedPrice <= filters.maxPrice!)
    }

    return slots
  }

  // Handle drag end
  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const sourceDate = result.source.droppableId
    const destDate = result.destination.droppableId

    if (sourceDate === destDate) return

    // Find the item being moved
    const item = selectedByDate.get(sourceDate)?.[result.source.index]
    if (!item) return

    // Update the item's date
    const newItem = {
      ...item,
      airDate: destDate
    }

    // This would need to be implemented in the parent
    console.log('Move item to new date:', newItem)
  }

  const handlePriceEdit = (itemId: string, currentPrice: number) => {
    setPriceEditMode(itemId)
    setEditPrice(currentPrice.toString())
  }

  const handlePriceSave = (itemId: string) => {
    const newPrice = parseFloat(editPrice)
    if (!isNaN(newPrice) && newPrice > 0) {
      onUpdatePrice(itemId, newPrice)
    }
    setPriceEditMode(null)
    setEditPrice('')
  }

  const getDayStats = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const available = getFilteredInventory(date).length
    const selected = selectedByDate.get(dateKey)?.length || 0
    const revenue = selectedByDate.get(dateKey)?.reduce((sum, item) => sum + item.negotiatedPrice, 0) || 0

    return { available, selected, revenue }
  }

  const renderDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const stats = getDayStats(day)
    const hasInventory = stats.available > 0
    const hasSelections = stats.selected > 0
    const isCurrentMonth = isSameMonth(day, currentMonth)

    return (
      <Droppable droppableId={dateKey} key={dateKey}>
        {(provided, snapshot) => (
          <Card
            ref={provided.innerRef}
            {...provided.droppableProps}
            sx={{
              height: 120,
              opacity: isCurrentMonth ? 1 : 0.5,
              bgcolor: snapshot.isDraggingOver 
                ? alpha(theme.palette.primary.main, 0.1)
                : hasSelections
                ? alpha(theme.palette.success.main, 0.05)
                : 'background.paper',
              border: 1,
              borderColor: isToday(day) 
                ? 'primary.main' 
                : snapshot.isDraggingOver
                ? 'primary.main'
                : 'divider',
              cursor: hasInventory ? 'pointer' : 'default',
              transition: 'all 0.2s',
              '&:hover': hasInventory ? {
                borderColor: 'primary.main',
                boxShadow: 1
              } : {}
            }}
            onClick={() => {
              if (hasInventory || hasSelections) {
                setSelectedDate(day)
                setDetailsDrawerOpen(true)
              }
            }}
          >
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Typography 
                  variant="body2" 
                  fontWeight={isToday(day) ? 'bold' : 'normal'}
                  color={isToday(day) ? 'primary.main' : 'text.primary'}
                >
                  {format(day, 'd')}
                </Typography>
                {hasSelections && (
                  <Badge badgeContent={stats.selected} color="primary" max={99}>
                    <ScheduleIcon fontSize="small" />
                  </Badge>
                )}
              </Box>

              {/* Stats */}
              <Box mt={1}>
                {hasInventory && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    {stats.available} available
                  </Typography>
                )}
                {hasSelections && (
                  <>
                    <Typography variant="caption" display="block" color="success.main">
                      ${stats.revenue.toLocaleString()}
                    </Typography>
                  </>
                )}
              </Box>

              {/* Mini slot indicators - Defensive rendering */}
              {hasSelections && (
                <Box display="flex" gap={0.25} mt={0.5} flexWrap="wrap">
                  {(() => {
                    const daySelections = selectedByDate.get(dateKey);
                    console.log('Day selections for', dateKey, ':', daySelections);
                    // Defensive check to ensure we have valid array data
                    const safeSelections = Array.isArray(daySelections) ? daySelections : [];
                    return [
                      ...safeSelections.slice(0, 3).map((item, idx) => {
                        if (!item || typeof item !== 'object') {
                          console.warn('Invalid selection item at index', idx, item);
                          return null;
                        }
                        return (
                          <Box
                            key={idx}
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: 
                                item.placementType === 'pre-roll' ? 'info.main' :
                                item.placementType === 'mid-roll' ? 'success.main' :
                                'warning.main'
                            }}
                          />
                        );
                      }),
                      stats.selected > 3 && (
                        <Typography key="more" variant="caption" color="text.secondary">
                          +{stats.selected - 3}
                        </Typography>
                      )
                    ];
                  })()}
                </Box>
              )}
            </CardContent>
            {provided.placeholder}
          </Card>
        )}
      </Droppable>
    )
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Box>
        {/* Calendar Header */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={2}>
              <IconButton onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <NavigateBefore />
              </IconButton>
              <Typography variant="h6">
                {format(currentMonth, 'MMMM yyyy')}
              </Typography>
              <IconButton onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <NavigateNext />
              </IconButton>
            </Box>

            <Box display="flex" gap={2} alignItems="center">
              {/* Quick filters */}
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Show</InputLabel>
                <Select
                  value={filters.showId || ''}
                  onChange={(e) => onFiltersChange?.({ ...filters, showId: e.target.value || undefined })}
                  label="Show"
                >
                  <MenuItem value="">All Shows</MenuItem>
                  {/* Add show options dynamically */}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Placement</InputLabel>
                <Select
                  value={filters.placementType || ''}
                  onChange={(e) => onFiltersChange?.({ ...filters, placementType: e.target.value || undefined })}
                  label="Placement"
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="pre-roll">Pre-roll</MenuItem>
                  <MenuItem value="mid-roll">Mid-roll</MenuItem>
                  <MenuItem value="post-roll">Post-roll</MenuItem>
                </Select>
              </FormControl>

              <Button
                startIcon={<FilterIcon />}
                variant="outlined"
                size="small"
              >
                More Filters
              </Button>
            </Box>
          </Box>

          {/* Legend */}
          <Box display="flex" gap={2} mt={2} alignItems="center">
            <Typography variant="caption" color="text.secondary">Legend:</Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'info.main' }} />
              <Typography variant="caption">Pre-roll</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'success.main' }} />
              <Typography variant="caption">Mid-roll</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'warning.main' }} />
              <Typography variant="caption">Post-roll</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Calendar Grid */}
        <Grid container spacing={1}>
          {/* Day headers - Defensive rendering */}
          {(() => {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            console.log('Rendering day headers:', dayNames);
            return dayNames.map(day => {
              if (!day || typeof day !== 'string') {
                console.warn('Invalid day name:', day);
                return null;
              }
              return (
                <Grid item xs={12 / 7} key={day}>
                  <Typography variant="caption" fontWeight="medium" align="center" display="block">
                    {day}
                  </Typography>
                </Grid>
              );
            });
          })()}

          {/* Empty cells for start of month - Defensive rendering */}
          {(() => {
            const emptyCount = monthStart.getDay();
            console.log('Empty cells needed:', emptyCount);
            if (emptyCount < 0 || emptyCount > 6) {
              console.warn('Invalid empty count:', emptyCount);
              return null;
            }
            return Array.from({ length: emptyCount }).map((_, idx) => (
              <Grid item xs={12 / 7} key={`empty-start-${idx}`}>
                <Box height={120} />
              </Grid>
            ));
          })()}

          {/* Days - Defensive rendering */}
          {(() => {
            console.log('Rendering calendar days:', days?.length || 0, 'days');
            const safeDays = Array.isArray(days) ? days : [];
            return safeDays.map(day => {
              if (!day || !(day instanceof Date)) {
                console.warn('Invalid day object:', day);
                return null;
              }
              return (
                <Grid item xs={12 / 7} key={format(day, 'yyyy-MM-dd')}>
                  {renderDay(day)}
                </Grid>
              );
            });
          })()}
        </Grid>

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

              {/* Available Inventory */}
              <Typography variant="subtitle1" fontWeight="medium" mb={2}>
                Available Inventory
              </Typography>
              <List>
                {getFilteredInventory(selectedDate).map(slot => {
                  const isSelected = selectedItems.some(item => item.id === slot.id)
                  
                  return (
                    <ListItem
                      key={slot.id}
                      sx={{
                        bgcolor: 'background.default',
                        mb: 1,
                        borderRadius: 1,
                        opacity: isSelected ? 0.5 : 1
                      }}
                      disabled={!slot.available || isSelected}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight="medium">
                              {slot.showName}
                            </Typography>
                            <Chip
                              label={slot.placementType}
                              size="small"
                              color={
                                slot.placementType === 'pre-roll' ? 'info' :
                                slot.placementType === 'mid-roll' ? 'success' :
                                'warning'
                              }
                            />
                            {slot.slotNumber > 1 && (
                              <Chip label={`Slot ${slot.slotNumber}`} size="small" variant="outlined" />
                            )}
                          </Box>
                        }
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  Episode {slot.episodeNumber || 'N/A'}: {slot.episodeTitle || 'Unknown Episode'}
                                </Typography>
                                <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                                  <Typography variant="caption" color="text.secondary">
                                    ${(slot.adjustedPrice || 0).toLocaleString()}
                                  </Typography>
                                  {slot.estimatedImpressions && (
                                    <Typography variant="caption" color="text.secondary">
                                      {slot.estimatedImpressions.toLocaleString()} impr
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Tooltip title={isSelected ? 'Already added' : !slot.available ? 'Not available' : 'Add to schedule'}>
                              <span>
                                <IconButton
                                  edge="end"
                                  onClick={() => onAddItem(slot)}
                                  disabled={!slot.available || isSelected}
                                  color="primary"
                                >
                                  <AddIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </ListItemSecondaryAction>
                        </ListItem>
                      );
                    })}
              </List>

              <Divider sx={{ my: 3 }} />

              {/* Selected Items */}
              <Typography variant="subtitle1" fontWeight="medium" mb={2}>
                Scheduled Items
              </Typography>
              <List>
                {selectedByDate.get(format(selectedDate, 'yyyy-MM-dd'))?.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) => (
                      <ListItem
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        sx={{
                          bgcolor: snapshot.isDragging 
                            ? alpha(theme.palette.primary.main, 0.1)
                            : 'background.default',
                          mb: 1,
                          borderRadius: 1,
                          border: 1,
                          borderColor: 'divider'
                        }}
                      >
                        <Box {...provided.dragHandleProps} mr={1}>
                          <DragIndicator color="action" />
                        </Box>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body2" fontWeight="medium">
                                {item.showName}
                              </Typography>
                              <Chip
                                label={item.placementType}
                                size="small"
                                color={
                                  item.placementType === 'pre-roll' ? 'info' :
                                  item.placementType === 'mid-roll' ? 'success' :
                                  'warning'
                                }
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                Episode {item.episodeNumber}
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                                {priceEditMode === item.id ? (
                                  <TextField
                                    size="small"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(e.target.value)}
                                    onBlur={() => handlePriceSave(item.id)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        handlePriceSave(item.id)
                                      }
                                    }}
                                    sx={{ width: 100 }}
                                    inputProps={{ style: { fontSize: '0.75rem' } }}
                                  />
                                ) : (
                                  <Chip
                                    label={`$${item.negotiatedPrice.toLocaleString()}`}
                                    size="small"
                                    icon={<MoneyIcon />}
                                    onClick={() => handlePriceEdit(item.id, item.negotiatedPrice)}
                                    sx={{ cursor: 'pointer' }}
                                  />
                                )}
                                {item.negotiatedPrice < item.rateCardPrice && (
                                  <Chip
                                    label={`${Math.round((1 - item.negotiatedPrice / item.rateCardPrice) * 100)}% off`}
                                    size="small"
                                    color="success"
                                  />
                                )}
                              </Box>
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
                    )}
                  </Draggable>
                ))}
              </List>
            </Box>
          )}
        </Drawer>
      </Box>
    </DragDropContext>
  )
}