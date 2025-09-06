'use client'

import { useState, useMemo } from 'react'
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
  Grid,
  Alert,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Stack,
  Paper,
  RadioGroup,
  Radio,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Tabs,
  Tab,
  Tooltip
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { 
  format,
  eachDayOfInterval,
  getDay,
  startOfWeek,
  endOfWeek,
  differenceInWeeks
} from 'date-fns'
import InfoIcon from '@mui/icons-material/Info'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import RefreshIcon from '@mui/icons-material/Refresh'
import SaveIcon from '@mui/icons-material/Save'

interface BulkPlacementPanelProps {
  open: boolean
  onClose: () => void
  shows: Array<{ id: string; name: string }>
  campaignId?: string
  advertiserId: string
  agencyId?: string
  campaignStartDate?: Date
  campaignEndDate?: Date
  onCommit: (spots: any[]) => void
}

interface PreviewResult {
  wouldPlace: Array<{
    showId: string
    showName?: string
    date: Date
    placementType: string
    rate: number
    episodeId?: string
  }>
  conflicts: Array<{
    showId: string
    showName?: string
    date: Date
    placementType: string
    reason: string
    conflictType?: string
  }>
  summary: {
    requested: number
    placeable: number
    unplaceable: number
    byPlacementType: Record<string, { requested: number; placed: number }>
    byShow: Record<string, { requested: number; placed: number }>
    byWeek: Record<string, { requested: number; placed: number }>
  }
}

export function BulkPlacementPanel({
  open,
  onClose,
  shows,
  campaignId,
  advertiserId,
  agencyId,
  campaignStartDate,
  campaignEndDate,
  onCommit
}: BulkPlacementPanelProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(false)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [expandedConflicts, setExpandedConflicts] = useState(false)
  
  // Form state
  const [selectedShows, setSelectedShows] = useState<string[]>(shows.map(s => s.id))
  const [dateRange, setDateRange] = useState({
    start: campaignStartDate || new Date(),
    end: campaignEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  })
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]) // Mon-Fri
  const [placementTypes, setPlacementTypes] = useState<string[]>(['pre-roll'])
  const [spotsRequested, setSpotsRequested] = useState(50)  // Default to 50 total spots
  const [spotsPerWeek, setSpotsPerWeek] = useState<number | undefined>(10)  // Default to 10 per week
  const [useWeeklyDistribution, setUseWeeklyDistribution] = useState(false)
  const [allowMultiplePerShowPerDay, setAllowMultiplePerShowPerDay] = useState(false)
  const [maxSpotsPerShowPerDay, setMaxSpotsPerShowPerDay] = useState(1)
  const [fallbackStrategy, setFallbackStrategy] = useState<'strict' | 'relaxed' | 'fill_anywhere'>('strict')
  
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  const handleWeekdayToggle = (day: number) => {
    setWeekdays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }
  
  const handlePlacementToggle = (type: string) => {
    setPlacementTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }
  
  const handlePreview = async () => {
    setLoading(true)
    try {
      // Calculate total spots based on distribution method
      const totalSpots = useWeeklyDistribution && spotsPerWeek 
        ? spotsPerWeek * weekCount 
        : spotsRequested
      
      const response = await fetch('/api/schedules/bulk/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          advertiserId,
          agencyId,
          showIds: selectedShows,
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString()
          },
          weekdays,
          placementTypes,
          spotsRequested: totalSpots,  // Send calculated total
          spotsPerWeek: useWeeklyDistribution ? spotsPerWeek : undefined,
          allowMultiplePerShowPerDay,
          fallbackStrategy,
          maxSpotsPerShowPerDay: allowMultiplePerShowPerDay ? maxSpotsPerShowPerDay : 1
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate preview')
      }
      
      const data = await response.json()
      setPreviewResult(data.preview)
      setActiveTab(1) // Switch to preview tab
    } catch (error) {
      console.error('Preview error:', error)
      alert('Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }
  
  const handleCommit = async () => {
    if (!previewResult || previewResult.wouldPlace.length === 0) {
      alert('No spots to commit')
      return
    }
    
    setLoading(true)
    try {
      // Calculate total spots based on distribution method
      const totalSpots = useWeeklyDistribution && spotsPerWeek 
        ? spotsPerWeek * weekCount 
        : spotsRequested
      
      const response = await fetch('/api/schedules/bulk/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          advertiserId,
          agencyId,
          showIds: selectedShows,
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString()
          },
          weekdays,
          placementTypes,
          spotsRequested: totalSpots,  // Send calculated total
          spotsPerWeek: useWeeklyDistribution ? spotsPerWeek : undefined,
          allowMultiplePerShowPerDay,
          fallbackStrategy,
          maxSpotsPerShowPerDay: allowMultiplePerShowPerDay ? maxSpotsPerShowPerDay : 1,
          idempotencyKey: `bulk-${Date.now()}-${Math.random()}`
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to commit schedule')
      }
      
      const data = await response.json()
      
      if (data.success) {
        onCommit(data.result.spots)
        onClose()
      } else {
        alert(`Failed to place spots: ${data.message}`)
      }
    } catch (error) {
      console.error('Commit error:', error)
      alert('Failed to commit schedule')
    } finally {
      setLoading(false)
    }
  }
  
  const handleRelaxConstraints = async () => {
    // Switch to relaxed strategy and re-run preview
    setFallbackStrategy('relaxed')
    setTimeout(() => handlePreview(), 100)
  }
  
  const handleFillAnywhere = async () => {
    // Switch to fill_anywhere strategy and re-run preview
    setFallbackStrategy('fill_anywhere')
    setTimeout(() => handlePreview(), 100)
  }
  
  // Calculate summary statistics
  const weekCount = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return 0
    return Math.ceil(differenceInWeeks(dateRange.end, dateRange.start) + 1)
  }, [dateRange])
  
  const estimatedSpotsPerShow = useMemo(() => {
    if (selectedShows.length === 0) return 0
    return Math.floor(spotsRequested / selectedShows.length)
  }, [spotsRequested, selectedShows])
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CalendarMonthIcon color="primary" />
          <Typography variant="h6">Bulk Placement (Inventory-Aware)</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="Configuration" />
          <Tab label="Preview" disabled={!previewResult} />
        </Tabs>
        
        {activeTab === 0 && (
          <Box>
            <Grid container spacing={3}>
              {/* Date Range Selection */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <FormLabel component="legend" sx={{ mb: 2 }}>Date Range</FormLabel>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <DatePicker
                        label="Start Date"
                        value={dateRange.start}
                        onChange={(newValue) => setDateRange(prev => ({ ...prev, start: newValue || new Date() }))}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                      <DatePicker
                        label="End Date"
                        value={dateRange.end}
                        onChange={(newValue) => setDateRange(prev => ({ ...prev, end: newValue || new Date() }))}
                        minDate={dateRange.start}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </Box>
                  </LocalizationProvider>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Campaign spans {weekCount} weeks
                  </Typography>
                </Paper>
              </Grid>
              
              {/* Weekday Selection */}
              <Grid item xs={12} md={6}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Active Days</FormLabel>
                  <ToggleButtonGroup
                    value={weekdays}
                    onChange={(_, newDays) => setWeekdays(newDays)}
                    aria-label="weekdays"
                    size="small"
                  >
                    {weekdayNames.map((name, index) => (
                      <ToggleButton key={index} value={index} aria-label={name}>
                        {name}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </FormControl>
              </Grid>
              
              {/* Placement Types */}
              <Grid item xs={12} md={6}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Placement Types</FormLabel>
                  <FormGroup row>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={placementTypes.includes('pre-roll')}
                          onChange={() => handlePlacementToggle('pre-roll')}
                        />
                      }
                      label="Pre-Roll"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={placementTypes.includes('mid-roll')}
                          onChange={() => handlePlacementToggle('mid-roll')}
                        />
                      }
                      label="Mid-Roll"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={placementTypes.includes('post-roll')}
                          onChange={() => handlePlacementToggle('post-roll')}
                        />
                      }
                      label="Post-Roll"
                    />
                  </FormGroup>
                </FormControl>
              </Grid>
              
              {/* Spots Configuration */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <FormLabel component="legend" sx={{ mb: 2 }}>Spots Configuration</FormLabel>
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={useWeeklyDistribution}
                        onChange={(e) => setUseWeeklyDistribution(e.target.checked)}
                      />
                    }
                    label="Distribute evenly per week"
                  />
                  
                  {useWeeklyDistribution ? (
                    <TextField
                      label="Spots per Week"
                      type="number"
                      value={spotsPerWeek || ''}
                      onChange={(e) => setSpotsPerWeek(parseInt(e.target.value) || undefined)}
                      fullWidth
                      margin="normal"
                      helperText={`Total: ${(spotsPerWeek || 0) * weekCount} spots across ${weekCount} weeks`}
                    />
                  ) : (
                    <TextField
                      label="Total Spots Requested"
                      type="number"
                      value={spotsRequested}
                      onChange={(e) => setSpotsRequested(parseInt(e.target.value) || 1)}
                      fullWidth
                      margin="normal"
                      helperText={`~${weekCount > 0 ? Math.floor(spotsRequested / weekCount) : 0} per week across ${weekCount} weeks`}
                    />
                  )}
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allowMultiplePerShowPerDay}
                        onChange={(e) => setAllowMultiplePerShowPerDay(e.target.checked)}
                      />
                    }
                    label="Allow multiple spots per show per day"
                  />
                  
                  {allowMultiplePerShowPerDay && (
                    <TextField
                      label="Max Spots per Show per Day"
                      type="number"
                      value={maxSpotsPerShowPerDay}
                      onChange={(e) => setMaxSpotsPerShowPerDay(parseInt(e.target.value) || 1)}
                      fullWidth
                      margin="normal"
                      inputProps={{ min: 1, max: 10 }}
                    />
                  )}
                </Paper>
              </Grid>
              
              {/* Show Selection */}
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
                  {selectedShows.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      ~{estimatedSpotsPerShow} spots per show
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              
              {/* Fallback Strategy */}
              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">
                    <Box display="flex" alignItems="center" gap={1}>
                      Fallback Strategy
                      <Tooltip title="How to handle when requested spots cannot be fully placed">
                        <InfoIcon fontSize="small" color="action" />
                      </Tooltip>
                    </Box>
                  </FormLabel>
                  <RadioGroup
                    value={fallbackStrategy}
                    onChange={(e) => setFallbackStrategy(e.target.value as any)}
                  >
                    <FormControlLabel 
                      value="strict" 
                      control={<Radio />} 
                      label="Strict - Only place where exactly available"
                    />
                    <FormControlLabel 
                      value="relaxed" 
                      control={<Radio />} 
                      label="Relaxed - Try alternative dates within same shows"
                    />
                    <FormControlLabel 
                      value="fill_anywhere" 
                      control={<Radio />} 
                      label="Fill Anywhere - Place in any available inventory"
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        )}
        
        {activeTab === 1 && previewResult && (
          <Box>
            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary">Requested</Typography>
                  <Typography variant="h4">{previewResult.summary.requested}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'success.50' }}>
                  <Typography variant="caption" color="text.secondary">Can Place</Typography>
                  <Typography variant="h4" color="success.main">
                    {previewResult.summary.placeable}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: previewResult.summary.unplaceable > 0 ? 'error.50' : 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary">Cannot Place</Typography>
                  <Typography variant="h4" color={previewResult.summary.unplaceable > 0 ? 'error.main' : 'text.primary'}>
                    {previewResult.summary.unplaceable}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'info.50' }}>
                  <Typography variant="caption" color="text.secondary">Success Rate</Typography>
                  <Typography variant="h4" color="info.main">
                    {Math.round((previewResult.summary.placeable / previewResult.summary.requested) * 100)}%
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
            
            {/* Placement Distribution */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Distribution by Placement Type</Typography>
              <Stack spacing={1}>
                {Object.entries(previewResult.summary.byPlacementType).map(([type, stats]) => (
                  <Box key={type} display="flex" alignItems="center" gap={2}>
                    <Typography variant="body2" sx={{ minWidth: 100 }}>{type}:</Typography>
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            height: 8,
                            width: `${(stats.placed / stats.requested) * 100}%`,
                            bgcolor: 'primary.main',
                            borderRadius: 1
                          }}
                        />
                        <Typography variant="caption">
                          {stats.placed}/{stats.requested}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Paper>
            
            {/* Conflicts Section */}
            {previewResult.conflicts.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'warning.main' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={1}>
                    <WarningIcon color="warning" />
                    <Typography variant="subtitle2">
                      {previewResult.conflicts.length} Conflicts Found
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setExpandedConflicts(!expandedConflicts)}>
                    {expandedConflicts ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                
                <Collapse in={expandedConflicts}>
                  <TableContainer sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Show</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Placement</TableCell>
                          <TableCell>Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previewResult.conflicts.slice(0, 10).map((conflict, index) => (
                          <TableRow key={index}>
                            <TableCell>{conflict.showName || conflict.showId}</TableCell>
                            <TableCell>{format(new Date(conflict.date), 'MMM d')}</TableCell>
                            <TableCell>{conflict.placementType}</TableCell>
                            <TableCell>
                              <Chip
                                label={conflict.reason}
                                size="small"
                                color={conflict.conflictType === 'sold' ? 'error' : 'warning'}
                                variant="outlined"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  {previewResult.conflicts.length > 10 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      And {previewResult.conflicts.length - 10} more conflicts...
                    </Typography>
                  )}
                </Collapse>
                
                {/* Resolution Actions */}
                {previewResult.summary.unplaceable > 0 && (
                  <Box display="flex" gap={1} mt={2}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleRelaxConstraints}
                      disabled={fallbackStrategy === 'relaxed' || fallbackStrategy === 'fill_anywhere'}
                    >
                      Try Relaxed Placement
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleFillAnywhere}
                      disabled={fallbackStrategy === 'fill_anywhere'}
                    >
                      Fill Any Available
                    </Button>
                  </Box>
                )}
              </Paper>
            )}
            
            {/* Success Message */}
            {previewResult.summary.placeable === previewResult.summary.requested && (
              <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                All {previewResult.summary.requested} requested spots can be placed successfully!
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        
        {activeTab === 0 && (
          <Button
            onClick={handlePreview}
            variant="contained"
            disabled={
              loading ||
              selectedShows.length === 0 ||
              weekdays.length === 0 ||
              placementTypes.length === 0 ||
              (useWeeklyDistribution ? !spotsPerWeek || spotsPerWeek < 1 : spotsRequested < 1)
            }
            startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          >
            {loading ? 'Generating...' : 'Preview Placement'}
          </Button>
        )}
        
        {activeTab === 1 && previewResult && previewResult.summary.placeable > 0 && (
          <Button
            onClick={handleCommit}
            variant="contained"
            color="success"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {loading ? 'Committing...' : `Place ${previewResult.summary.placeable} Spots`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}