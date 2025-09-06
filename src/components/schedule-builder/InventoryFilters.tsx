'use client'

import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Collapse,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Chip,
  TextField,
  InputAdornment,
  Badge,
  Divider,
} from '@mui/material'
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
  AttachMoney as MoneyIcon,
  EventAvailable as AvailableIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  DateRange as DateRangeIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

interface InventoryFiltersProps {
  onFiltersChange: (filters: InventoryFilterState) => void
  showCount?: number
  slotCount?: number
}

export interface InventoryFilterState {
  dateRange: {
    start: Date | null
    end: Date | null
  }
  placementTypes: string[]
  priceRange: number[]
  availabilityStatus: string
  minAvailableSlots: number
  showIds: string[]
  dayOfWeek: string[]
  timeSlots: string[]
  deliverySpeed: string[]
  targetRegions: string[]
}

const PLACEMENT_TYPES = ['pre-roll', 'mid-roll', 'post-roll']
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_SLOTS = ['Morning (6AM-12PM)', 'Afternoon (12PM-6PM)', 'Evening (6PM-12AM)', 'Overnight (12AM-6AM)']
const DELIVERY_SPEEDS = ['Immediate', 'Within 24 hours', 'Within 48 hours', 'Within 1 week']
const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East', 'Africa']

export function InventoryFilters({ onFiltersChange, showCount = 0, slotCount = 0 }: InventoryFiltersProps) {
  const [expanded, setExpanded] = useState(false)
  const [filters, setFilters] = useState<InventoryFilterState>({
    dateRange: {
      start: null,
      end: null,
    },
    placementTypes: [],
    priceRange: [0, 5000],
    availabilityStatus: 'all',
    minAvailableSlots: 0,
    showIds: [],
    dayOfWeek: [],
    timeSlots: [],
    deliverySpeed: [],
    targetRegions: [],
  })

  const handleFilterChange = (newFilters: Partial<InventoryFilterState>) => {
    const updatedFilters = { ...filters, ...newFilters }
    setFilters(updatedFilters)
    onFiltersChange(updatedFilters)
  }

  const handleClearFilters = () => {
    const clearedFilters: InventoryFilterState = {
      dateRange: {
        start: null,
        end: null,
      },
      placementTypes: [],
      priceRange: [0, 5000],
      availabilityStatus: 'all',
      minAvailableSlots: 0,
      showIds: [],
      dayOfWeek: [],
      timeSlots: [],
      deliverySpeed: [],
      targetRegions: [],
    }
    setFilters(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  // Count active filters
  const activeFilterCount = [
    filters.dateRange.start || filters.dateRange.end ? 1 : 0,
    filters.placementTypes.length,
    filters.priceRange[0] !== 0 || filters.priceRange[1] !== 5000 ? 1 : 0,
    filters.availabilityStatus !== 'all' ? 1 : 0,
    filters.minAvailableSlots > 0 ? 1 : 0,
    filters.dayOfWeek.length,
    filters.timeSlots.length,
    filters.deliverySpeed.length,
    filters.targetRegions.length,
  ].reduce((sum, count) => sum + count, 0)

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">
            Inventory Filters
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip 
              label={`${showCount} shows`} 
              size="small" 
              color="primary" 
              variant="outlined" 
            />
            <Chip 
              label={`${slotCount} slots available`} 
              size="small" 
              color="success" 
              variant="outlined" 
            />
          </Box>
        </Box>
        <Button
          variant={expanded ? 'contained' : 'outlined'}
          startIcon={
            <Badge badgeContent={activeFilterCount} color="error">
              <FilterIcon />
            </Badge>
          }
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              Advanced Inventory Filters
            </Typography>
            <Button
              size="small"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              disabled={activeFilterCount === 0}
            >
              Clear All
            </Button>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            {/* Date Range */}
            <Grid item xs={12} md={6} lg={4}>
              <Typography variant="subtitle2" gutterBottom>
                <DateRangeIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Date Range
              </Typography>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <DatePicker
                    label="Start Date"
                    value={filters.dateRange.start}
                    onChange={(date) => handleFilterChange({ 
                      dateRange: { ...filters.dateRange, start: date } 
                    })}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                  <DatePicker
                    label="End Date"
                    value={filters.dateRange.end}
                    onChange={(date) => handleFilterChange({ 
                      dateRange: { ...filters.dateRange, end: date } 
                    })}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Box>
              </LocalizationProvider>
            </Grid>

            {/* Placement Types */}
            <Grid item xs={12} md={6} lg={4}>
              <Typography variant="subtitle2" gutterBottom>
                <ScheduleIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Placement Types
              </Typography>
              <FormGroup>
                {PLACEMENT_TYPES.map(type => (
                  <FormControlLabel
                    key={type}
                    control={
                      <Checkbox
                        size="small"
                        checked={filters.placementTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleFilterChange({ 
                              placementTypes: [...filters.placementTypes, type] 
                            })
                          } else {
                            handleFilterChange({ 
                              placementTypes: filters.placementTypes.filter(t => t !== type) 
                            })
                          }
                        }}
                      />
                    }
                    label={type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                  />
                ))}
              </FormGroup>
            </Grid>

            {/* Price Range */}
            <Grid item xs={12} md={6} lg={4}>
              <Typography variant="subtitle2" gutterBottom>
                <MoneyIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Price Range: ${filters.priceRange[0]} - ${filters.priceRange[1]}
              </Typography>
              <Box sx={{ px: 1 }}>
                <Slider
                  value={filters.priceRange}
                  onChange={(e, newValue) => handleFilterChange({ priceRange: newValue as number[] })}
                  valueLabelDisplay="auto"
                  step={100}
                  min={0}
                  max={5000}
                  marks={[
                    { value: 0, label: '$0' },
                    { value: 2500, label: '$2.5K' },
                    { value: 5000, label: '$5K' },
                  ]}
                />
              </Box>
            </Grid>

            {/* Availability Status */}
            <Grid item xs={12} md={6} lg={4}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  <AvailableIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                  Availability
                </InputLabel>
                <Select
                  value={filters.availabilityStatus}
                  onChange={(e) => handleFilterChange({ availabilityStatus: e.target.value })}
                  label="Availability"
                >
                  <MenuItem value="all">All Slots</MenuItem>
                  <MenuItem value="available">Available Only</MenuItem>
                  <MenuItem value="limited">Limited Availability</MenuItem>
                  <MenuItem value="sold-out">Sold Out</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Minimum Available Slots */}
            <Grid item xs={12} md={6} lg={4}>
              <Typography variant="subtitle2" gutterBottom>
                <TrendingUpIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Minimum Available Slots: {filters.minAvailableSlots}
              </Typography>
              <Box sx={{ px: 1 }}>
                <Slider
                  value={filters.minAvailableSlots}
                  onChange={(e, newValue) => handleFilterChange({ minAvailableSlots: newValue as number })}
                  valueLabelDisplay="auto"
                  step={1}
                  min={0}
                  max={20}
                  marks
                />
              </Box>
            </Grid>

            {/* Day of Week */}
            <Grid item xs={12} md={6} lg={4}>
              <Typography variant="subtitle2" gutterBottom>
                <DateRangeIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Days of Week
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {DAYS_OF_WEEK.map(day => (
                  <Chip
                    key={day}
                    label={day.slice(0, 3)}
                    size="small"
                    onClick={() => {
                      if (filters.dayOfWeek.includes(day)) {
                        handleFilterChange({ 
                          dayOfWeek: filters.dayOfWeek.filter(d => d !== day) 
                        })
                      } else {
                        handleFilterChange({ 
                          dayOfWeek: [...filters.dayOfWeek, day] 
                        })
                      }
                    }}
                    color={filters.dayOfWeek.includes(day) ? 'primary' : 'default'}
                    variant={filters.dayOfWeek.includes(day) ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            </Grid>

            {/* Time Slots */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                <ScheduleIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Time Slots
              </Typography>
              <FormGroup row>
                {TIME_SLOTS.map(slot => (
                  <FormControlLabel
                    key={slot}
                    control={
                      <Checkbox
                        size="small"
                        checked={filters.timeSlots.includes(slot)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleFilterChange({ 
                              timeSlots: [...filters.timeSlots, slot] 
                            })
                          } else {
                            handleFilterChange({ 
                              timeSlots: filters.timeSlots.filter(s => s !== slot) 
                            })
                          }
                        }}
                      />
                    }
                    label={slot}
                  />
                ))}
              </FormGroup>
            </Grid>

            {/* Delivery Speed */}
            <Grid item xs={12} md={6} lg={4}>
              <Typography variant="subtitle2" gutterBottom>
                <SpeedIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Delivery Speed
              </Typography>
              <FormGroup>
                {DELIVERY_SPEEDS.map(speed => (
                  <FormControlLabel
                    key={speed}
                    control={
                      <Checkbox
                        size="small"
                        checked={filters.deliverySpeed.includes(speed)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleFilterChange({ 
                              deliverySpeed: [...filters.deliverySpeed, speed] 
                            })
                          } else {
                            handleFilterChange({ 
                              deliverySpeed: filters.deliverySpeed.filter(s => s !== speed) 
                            })
                          }
                        }}
                      />
                    }
                    label={speed}
                  />
                ))}
              </FormGroup>
            </Grid>

            {/* Target Regions */}
            <Grid item xs={12} md={6} lg={4}>
              <Typography variant="subtitle2" gutterBottom>
                <LocationIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Target Regions
              </Typography>
              <FormGroup>
                {REGIONS.map(region => (
                  <FormControlLabel
                    key={region}
                    control={
                      <Checkbox
                        size="small"
                        checked={filters.targetRegions.includes(region)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleFilterChange({ 
                              targetRegions: [...filters.targetRegions, region] 
                            })
                          } else {
                            handleFilterChange({ 
                              targetRegions: filters.targetRegions.filter(r => r !== region) 
                            })
                          }
                        }}
                      />
                    }
                    label={region}
                  />
                ))}
              </FormGroup>
            </Grid>
          </Grid>

          {/* Active Filters Summary */}
          {activeFilterCount > 0 && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Active Filters ({activeFilterCount})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {filters.dateRange.start && (
                  <Chip
                    label={`From: ${filters.dateRange.start.toLocaleDateString()}`}
                    size="small"
                    onDelete={() => handleFilterChange({ 
                      dateRange: { ...filters.dateRange, start: null } 
                    })}
                  />
                )}
                {filters.dateRange.end && (
                  <Chip
                    label={`To: ${filters.dateRange.end.toLocaleDateString()}`}
                    size="small"
                    onDelete={() => handleFilterChange({ 
                      dateRange: { ...filters.dateRange, end: null } 
                    })}
                  />
                )}
                {filters.placementTypes.map(type => (
                  <Chip
                    key={type}
                    label={type}
                    size="small"
                    onDelete={() => handleFilterChange({ 
                      placementTypes: filters.placementTypes.filter(t => t !== type) 
                    })}
                  />
                ))}
                {(filters.priceRange[0] !== 0 || filters.priceRange[1] !== 5000) && (
                  <Chip
                    label={`$${filters.priceRange[0]}-$${filters.priceRange[1]}`}
                    size="small"
                    onDelete={() => handleFilterChange({ priceRange: [0, 5000] })}
                  />
                )}
                {filters.availabilityStatus !== 'all' && (
                  <Chip
                    label={`Availability: ${filters.availabilityStatus}`}
                    size="small"
                    onDelete={() => handleFilterChange({ availabilityStatus: 'all' })}
                  />
                )}
                {filters.minAvailableSlots > 0 && (
                  <Chip
                    label={`Min slots: ${filters.minAvailableSlots}`}
                    size="small"
                    onDelete={() => handleFilterChange({ minAvailableSlots: 0 })}
                  />
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  )
}