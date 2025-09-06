'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  Box,
  Typography,
  InputLabel,
  Slider,
  Grid,
  Alert,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Stack,
  Paper,
  RadioGroup,
  Radio
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { 
  addWeeks, 
  differenceInWeeks, 
  startOfWeek, 
  endOfWeek, 
  format, 
  isWithinInterval, 
  eachWeekOfInterval,
  startOfDay,
  endOfDay,
  addDays,
  isSameWeek
} from 'date-fns'
import InfoIcon from '@mui/icons-material/Info'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'

interface BulkScheduleModalProps {
  open: boolean
  onClose: () => void
  onSchedule: (config: BulkScheduleConfig) => void
  shows: Array<{ id: string; name: string }>
  dateRange?: { start: Date; end: Date }
  campaignStartDate?: Date
  campaignEndDate?: Date
}

export interface BulkScheduleConfig {
  spotsPerWeek: number
  dayPreferences: {
    monday: boolean
    tuesday: boolean
    wednesday: boolean
    thursday: boolean
    friday: boolean
    saturday: boolean
    sunday: boolean
  }
  placementTypes: {
    preRoll: boolean
    midRoll: boolean
    postRoll: boolean
  }
  distribution: 'even' | 'weighted'
  showIds: string[]
  dateRange: {
    start: Date
    end: Date
  }
  selectedWeeks?: number[] // Week indices to apply bulk scheduling to
}

export function BulkScheduleModal({
  open,
  onClose,
  onSchedule,
  shows,
  dateRange,
  campaignStartDate,
  campaignEndDate
}: BulkScheduleModalProps) {
  // Determine the effective campaign dates
  const effectiveStartDate = campaignStartDate || dateRange?.start || new Date()
  const effectiveEndDate = campaignEndDate || dateRange?.end || addWeeks(new Date(), 4)

  const [spotsPerWeek, setSpotsPerWeek] = useState(3)
  const [dayPreferences, setDayPreferences] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  })
  const [placementTypes, setPlacementTypes] = useState({
    preRoll: true,
    midRoll: false,
    postRoll: false
  })
  const [distribution, setDistribution] = useState<'even' | 'weighted'>('even')
  const [selectedShows, setSelectedShows] = useState<string[]>(shows.map(s => s.id))
  
  // Date range selection
  const [dateRangeMode, setDateRangeMode] = useState<'all' | 'custom' | 'weeks'>('all')
  const [customStartDate, setCustomStartDate] = useState<Date | null>(effectiveStartDate)
  const [customEndDate, setCustomEndDate] = useState<Date | null>(effectiveEndDate)
  const [selectedWeekIndices, setSelectedWeekIndices] = useState<number[]>([])

  // Calculate available weeks
  const availableWeeks = useMemo(() => {
    const weeks = eachWeekOfInterval({
      start: effectiveStartDate,
      end: effectiveEndDate
    }, { weekStartsOn: 1 }) // Start week on Monday

    return weeks.map((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
      return {
        index,
        start: weekStart,
        end: weekEnd,
        label: `Week ${index + 1}: ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
      }
    })
  }, [effectiveStartDate, effectiveEndDate])

  // Initialize selected weeks to all weeks
  useEffect(() => {
    if (dateRangeMode === 'weeks' && selectedWeekIndices.length === 0) {
      setSelectedWeekIndices(availableWeeks.map(w => w.index))
    }
  }, [dateRangeMode, availableWeeks])

  const handleDayChange = (day: string) => {
    setDayPreferences(prev => ({
      ...prev,
      [day]: !prev[day as keyof typeof prev]
    }))
  }

  const handlePlacementChange = (type: string) => {
    setPlacementTypes(prev => ({
      ...prev,
      [type]: !prev[type as keyof typeof prev]
    }))
  }

  const handleWeekToggle = (weekIndex: number) => {
    setSelectedWeekIndices(prev => {
      if (prev.includes(weekIndex)) {
        return prev.filter(i => i !== weekIndex)
      } else {
        return [...prev, weekIndex].sort((a, b) => a - b)
      }
    })
  }

  const selectAllWeeks = () => {
    setSelectedWeekIndices(availableWeeks.map(w => w.index))
  }

  const deselectAllWeeks = () => {
    setSelectedWeekIndices([])
  }

  const handleSubmit = () => {
    let finalDateRange = { start: effectiveStartDate, end: effectiveEndDate }
    let finalSelectedWeeks: number[] | undefined = undefined

    if (dateRangeMode === 'custom' && customStartDate && customEndDate) {
      finalDateRange = { start: customStartDate, end: customEndDate }
    } else if (dateRangeMode === 'weeks') {
      finalSelectedWeeks = selectedWeekIndices
      // Calculate date range from selected weeks
      if (selectedWeekIndices.length > 0) {
        const minWeek = Math.min(...selectedWeekIndices)
        const maxWeek = Math.max(...selectedWeekIndices)
        if (availableWeeks[minWeek] && availableWeeks[maxWeek]) {
          finalDateRange = {
            start: availableWeeks[minWeek].start,
            end: availableWeeks[maxWeek].end
          }
        }
      }
    }

    const config: BulkScheduleConfig = {
      spotsPerWeek,
      dayPreferences,
      placementTypes,
      distribution,
      showIds: selectedShows,
      dateRange: finalDateRange,
      selectedWeeks: finalSelectedWeeks
    }
    
    onSchedule(config)
    onClose()
  }

  // Calculate estimates
  const activeDaysCount = Object.values(dayPreferences).filter(Boolean).length
  const totalWeeks = useMemo(() => {
    if (dateRangeMode === 'weeks') {
      return selectedWeekIndices.length
    } else if (dateRangeMode === 'custom' && customStartDate && customEndDate) {
      return Math.ceil(differenceInWeeks(customEndDate, customStartDate) + 1)
    }
    return Math.ceil(differenceInWeeks(effectiveEndDate, effectiveStartDate) + 1)
  }, [dateRangeMode, selectedWeekIndices, customStartDate, customEndDate, effectiveStartDate, effectiveEndDate])
  
  const estimatedTotalSpots = spotsPerWeek * totalWeeks
  const spotsPerShow = selectedShows.length > 0 
    ? Math.floor(estimatedTotalSpots / selectedShows.length)
    : 0

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CalendarMonthIcon color="primary" />
          <Typography variant="h6">Bulk Schedule Configuration</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={3}>
            {/* Date Range Selection */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <FormControl component="fieldset" fullWidth>
                  <FormLabel component="legend" sx={{ mb: 2 }}>
                    Schedule Date Range
                  </FormLabel>
                  <RadioGroup
                    value={dateRangeMode}
                    onChange={(e) => setDateRangeMode(e.target.value as 'all' | 'custom' | 'weeks')}
                  >
                    <FormControlLabel 
                      value="all" 
                      control={<Radio />} 
                      label={`Entire Campaign (${format(effectiveStartDate, 'MMM d')} - ${format(effectiveEndDate, 'MMM d, yyyy')})`}
                    />
                    <FormControlLabel 
                      value="custom" 
                      control={<Radio />} 
                      label="Custom Date Range" 
                    />
                    <FormControlLabel 
                      value="weeks" 
                      control={<Radio />} 
                      label="Select Specific Weeks" 
                    />
                  </RadioGroup>

                  {dateRangeMode === 'custom' && (
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                        <DatePicker
                          label="Start Date"
                          value={customStartDate}
                          onChange={(newValue) => setCustomStartDate(newValue)}
                          minDate={effectiveStartDate}
                          maxDate={effectiveEndDate}
                          slotProps={{ textField: { fullWidth: true } }}
                        />
                        <DatePicker
                          label="End Date"
                          value={customEndDate}
                          onChange={(newValue) => setCustomEndDate(newValue)}
                          minDate={customStartDate || effectiveStartDate}
                          maxDate={effectiveEndDate}
                          slotProps={{ textField: { fullWidth: true } }}
                        />
                      </Box>
                    </LocalizationProvider>
                  )}

                  {dateRangeMode === 'weeks' && (
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Select weeks to include in bulk scheduling
                        </Typography>
                        <Box>
                          <Button size="small" onClick={selectAllWeeks}>Select All</Button>
                          <Button size="small" onClick={deselectAllWeeks}>Clear</Button>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {availableWeeks.map((week) => (
                          <Chip
                            key={week.index}
                            label={week.label}
                            onClick={() => handleWeekToggle(week.index)}
                            color={selectedWeekIndices.includes(week.index) ? 'primary' : 'default'}
                            variant={selectedWeekIndices.includes(week.index) ? 'filled' : 'outlined'}
                            size="small"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </FormControl>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Spots per week */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <Typography gutterBottom>
                  Spots per Week: <strong>{spotsPerWeek}</strong>
                </Typography>
                <Slider
                  value={spotsPerWeek}
                  onChange={(_, value) => setSpotsPerWeek(value as number)}
                  min={1}
                  max={21}
                  marks
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="text.secondary">
                  This will be applied to each selected week
                </Typography>
              </FormControl>
            </Grid>

            {/* Day preferences */}
            <Grid item xs={12} md={6}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Preferred Days</FormLabel>
                <FormGroup>
                  {Object.entries(dayPreferences).map(([day, checked]) => (
                    <FormControlLabel
                      key={day}
                      control={
                        <Checkbox
                          checked={checked}
                          onChange={() => handleDayChange(day)}
                        />
                      }
                      label={day.charAt(0).toUpperCase() + day.slice(1)}
                    />
                  ))}
                </FormGroup>
              </FormControl>
            </Grid>

            {/* Placement types */}
            <Grid item xs={12} md={6}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Placement Types</FormLabel>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={placementTypes.preRoll}
                        onChange={() => handlePlacementChange('preRoll')}
                      />
                    }
                    label="Pre-Roll"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={placementTypes.midRoll}
                        onChange={() => handlePlacementChange('midRoll')}
                      />
                    }
                    label="Mid-Roll"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={placementTypes.postRoll}
                        onChange={() => handlePlacementChange('postRoll')}
                      />
                    }
                    label="Post-Roll"
                  />
                </FormGroup>
              </FormControl>
            </Grid>

            {/* Distribution method */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Distribution Method</InputLabel>
                <Select
                  value={distribution}
                  onChange={(e) => setDistribution(e.target.value as 'even' | 'weighted')}
                  label="Distribution Method"
                >
                  <MenuItem value="even">Even Distribution Across Shows</MenuItem>
                  <MenuItem value="weighted">Weighted by Audience Size</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Show selection */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Shows to Include</InputLabel>
                <Select
                  multiple
                  value={selectedShows}
                  onChange={(e) => setSelectedShows(e.target.value as string[])}
                  label="Shows to Include"
                  renderValue={(selected) => `${selected.length} shows selected`}
                >
                  {shows.map((show) => (
                    <MenuItem key={show.id} value={show.id}>
                      <Checkbox checked={selectedShows.includes(show.id)} />
                      {show.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Summary */}
            <Grid item xs={12}>
              <Alert severity="info" icon={<InfoIcon />}>
                <Typography variant="body2" gutterBottom>
                  <strong>Distribution Summary:</strong>
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    • Total spots to schedule: <strong>{estimatedTotalSpots} spots</strong>
                  </Typography>
                  <Typography variant="body2">
                    • Across <strong>{totalWeeks} weeks</strong> ({spotsPerWeek} per week)
                  </Typography>
                  <Typography variant="body2">
                    • Distributed among <strong>{selectedShows.length} shows</strong>
                    {selectedShows.length > 0 && ` (~${spotsPerShow} spots per show)`}
                  </Typography>
                  <Typography variant="body2">
                    • Scheduled on <strong>{activeDaysCount} days</strong> per week
                  </Typography>
                </Stack>
              </Alert>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={
            activeDaysCount === 0 ||
            !Object.values(placementTypes).some(Boolean) ||
            selectedShows.length === 0 ||
            (dateRangeMode === 'weeks' && selectedWeekIndices.length === 0) ||
            (dateRangeMode === 'custom' && (!customStartDate || !customEndDate))
          }
        >
          Apply Bulk Schedule
        </Button>
      </DialogActions>
    </Dialog>
  )
}