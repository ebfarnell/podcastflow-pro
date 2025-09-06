'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  Avatar,
  IconButton,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Slider,
  Divider,
} from '@mui/material'
import {
  Search,
  CalendarMonth,
  EventAvailable,
  Block,
  CheckCircle,
  Schedule,
  AttachMoney,
  ViewList,
  ViewModule,
  FilterList,
  Podcasts,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

interface AdSlot {
  id: string
  showId: string
  show: string
  showLogo: string
  episode: string
  episodeId?: string
  publishDate: string
  slotPosition: string
  duration: string
  price: number
  status: 'available' | 'reserved' | 'sold'
  targetAudience: string
  estimatedReach: number
  totalSpots: number
  availableSpots: number
  reservedSpots: number
  bookedSpots: number
}

export default function AvailabilityPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilter, setShowFilter] = useState('all')
  const [positionFilter, setPositionFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [filtersDialog, setFiltersDialog] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  })
  const [advancedFilters, setAdvancedFilters] = useState({
    priceRange: [0, 3000],
    reachRange: [0, 100000],
    dateRange: {
      start: '',
      end: ''
    },
    statuses: {
      available: true,
      reserved: true,
      sold: false
    },
    durations: {
      '15s': true,
      '30s': true,
      '60s': true,
      '90s': true
    }
  })

  // Fetch availability data from API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['availability', searchQuery, showFilter, positionFilter, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (showFilter && showFilter !== 'all') params.append('showId', showFilter)
      if (positionFilter && positionFilter !== 'all') params.append('placementType', positionFilter)
      params.append('startDate', dateRange.start)
      params.append('endDate', dateRange.end)
      
      return api.get(`/availability?${params.toString()}`)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const slots = data?.slots || []
  const shows = data?.shows || []
  const stats = data?.stats || {
    totalSlots: 0,
    availableSlots: 0,
    reservedSlots: 0,
    soldSlots: 0,
    totalValue: 0,
    availableValue: 0
  }

  const handleReserveSlot = (slotId: string) => {
    // Navigate to reservation creation with selected slot
    router.push(`/reservations/create?slotId=${slotId}`)
  }

  const handleViewDetails = (slotId: string) => {
    router.push(`/availability/${slotId}`)
  }

  const handleMoreFilters = () => {
    setFiltersDialog(true)
  }

  const applyAdvancedFilters = () => {
    setFiltersDialog(false)
    alert('Advanced filters applied!')
  }

  const resetAdvancedFilters = () => {
    setAdvancedFilters({
      priceRange: [0, 3000],
      reachRange: [0, 100000],
      dateRange: {
        start: '',
        end: ''
      },
      statuses: {
        available: true,
        reserved: true,
        sold: false
      },
      durations: {
        '15s': true,
        '30s': true,
        '60s': true,
        '90s': true
      }
    })
  }

  // No need to filter client-side since API handles filtering
  const filteredSlots = slots

  const availableSlots = stats.availableSlots
  const totalValue = stats.availableValue

  const getStatusColor = (status: AdSlot['status']) => {
    switch (status) {
      case 'available': return 'success'
      case 'reserved': return 'warning'
      case 'sold': return 'error'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: AdSlot['status']) => {
    switch (status) {
      case 'available': return <EventAvailable fontSize="small" />
      case 'reserved': return <Schedule fontSize="small" />
      case 'sold': return <Block fontSize="small" />
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <LinearProgress sx={{ width: '50%' }} />
        </Box>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Typography color="error">Error loading availability data. Please try again.</Typography>
          <Button onClick={() => refetch()} sx={{ mt: 2 }}>Retry</Button>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Ad Slot Availability
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View and manage available advertising slots across all shows
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<CalendarMonth />}
            onClick={() => router.push('/calendar')}
          >
            View Calendar
          </Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <EventAvailable color="success" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Available Slots
                    </Typography>
                    <Typography variant="h5">{availableSlots}</Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Across all shows
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AttachMoney color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Value
                    </Typography>
                    <Typography variant="h5">${totalValue.toLocaleString()}</Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Available inventory
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Schedule color="warning" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Reserved Slots
                    </Typography>
                    <Typography variant="h5">
                      {slots.filter(s => s.status === 'reserved').length}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Pending confirmation
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CheckCircle color="error" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Sold Slots
                    </Typography>
                    <Typography variant="h5">
                      {slots.filter(s => s.status === 'sold').length}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  This month
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search slots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, maxWidth: 400 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={showFilter}
                onChange={(e) => setShowFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">All Shows</MenuItem>
                {shows.map(show => (
                  <MenuItem key={show.id} value={show.id}>{show.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">All Positions</MenuItem>
                <MenuItem value="preroll">Pre-roll</MenuItem>
                <MenuItem value="midroll">Mid-roll</MenuItem>
                <MenuItem value="postroll">Post-roll</MenuItem>
              </Select>
            </FormControl>
            <Button variant="outlined" startIcon={<FilterList />} onClick={handleMoreFilters}>
              More Filters
            </Button>
            <Box sx={{ ml: 'auto' }}>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, value) => value && setViewMode(value)}
                size="small"
              >
                <ToggleButton value="list">
                  <ViewList />
                </ToggleButton>
                <ToggleButton value="grid">
                  <ViewModule />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Paper>

        {/* Slots List/Grid */}
        {viewMode === 'list' ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Show / Episode</TableCell>
                  <TableCell>Publish Date</TableCell>
                  <TableCell>Position</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Est. Reach</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSlots.map((slot) => (
                  <TableRow 
                    key={slot.id} 
                    hover 
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleViewDetails(slot.id)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={slot.showLogo} sx={{ width: 40, height: 40 }}>
                          <Podcasts />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">{slot.show}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {slot.episode}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{new Date(slot.publishDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip label={slot.slotPosition.charAt(0).toUpperCase() + slot.slotPosition.slice(1).replace('roll', '-roll')} size="small" />
                    </TableCell>
                    <TableCell>{slot.duration}</TableCell>
                    <TableCell>{slot.estimatedReach.toLocaleString()}</TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">${slot.price.toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(slot.status)}
                        label={slot.status}
                        size="small"
                        color={getStatusColor(slot.status)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {slot.status === 'available' && (
                        <Button 
                          size="small" 
                          variant="contained"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReserveSlot(slot.id)
                          }}
                        >
                          Reserve
                        </Button>
                      )}
                      {slot.status === 'reserved' && (
                        <Button 
                          size="small" 
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewDetails(slot.id)
                          }}
                        >
                          View Details
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Grid container spacing={3}>
            {filteredSlots.map((slot) => (
              <Grid item xs={12} md={6} lg={4} key={slot.id}>
                <Card 
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => handleViewDetails(slot.id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={slot.showLogo} sx={{ width: 48, height: 48 }}>
                          <Podcasts />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1">{slot.show}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {slot.episode}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        icon={getStatusIcon(slot.status)}
                        label={slot.status}
                        size="small"
                        color={getStatusColor(slot.status)}
                      />
                    </Box>

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Position
                        </Typography>
                        <Typography variant="subtitle2">{slot.slotPosition.charAt(0).toUpperCase() + slot.slotPosition.slice(1).replace('roll', '-roll')}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Duration
                        </Typography>
                        <Typography variant="subtitle2">{slot.duration}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Publish Date
                        </Typography>
                        <Typography variant="subtitle2">
                          {new Date(slot.publishDate).toLocaleDateString()}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Est. Reach
                        </Typography>
                        <Typography variant="subtitle2">
                          {slot.estimatedReach.toLocaleString()}
                        </Typography>
                      </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" color="primary">
                        ${slot.price.toLocaleString()}
                      </Typography>
                      {slot.status === 'available' && (
                        <Button 
                          variant="contained" 
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReserveSlot(slot.id)
                          }}
                        >
                          Reserve Slot
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Advanced Filters Dialog */}
        <Dialog open={filtersDialog} onClose={() => setFiltersDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Advanced Filters</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              {/* Price Range */}
              <Typography variant="h6" gutterBottom>
                Price Range
              </Typography>
              <Box sx={{ px: 2, mb: 3 }}>
                <Slider
                  value={advancedFilters.priceRange}
                  onChange={(e, value) => setAdvancedFilters({
                    ...advancedFilters,
                    priceRange: value as number[]
                  })}
                  valueLabelDisplay="auto"
                  min={0}
                  max={5000}
                  step={100}
                  marks={[
                    { value: 0, label: '$0' },
                    { value: 1000, label: '$1K' },
                    { value: 2000, label: '$2K' },
                    { value: 3000, label: '$3K' },
                    { value: 4000, label: '$4K' },
                    { value: 5000, label: '$5K' }
                  ]}
                  valueLabelFormat={(value) => `$${value}`}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Estimated Reach Range */}
              <Typography variant="h6" gutterBottom>
                Estimated Reach
              </Typography>
              <Box sx={{ px: 2, mb: 3 }}>
                <Slider
                  value={advancedFilters.reachRange}
                  onChange={(e, value) => setAdvancedFilters({
                    ...advancedFilters,
                    reachRange: value as number[]
                  })}
                  valueLabelDisplay="auto"
                  min={0}
                  max={100000}
                  step={5000}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 25000, label: '25K' },
                    { value: 50000, label: '50K' },
                    { value: 75000, label: '75K' },
                    { value: 100000, label: '100K' }
                  ]}
                  valueLabelFormat={(value) => `${(value / 1000).toFixed(0)}K`}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Date Range */}
              <Typography variant="h6" gutterBottom>
                Publish Date Range
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="From Date"
                    type="date"
                    value={advancedFilters.dateRange.start}
                    onChange={(e) => setAdvancedFilters({
                      ...advancedFilters,
                      dateRange: { ...advancedFilters.dateRange, start: e.target.value }
                    })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="To Date"
                    type="date"
                    value={advancedFilters.dateRange.end}
                    onChange={(e) => setAdvancedFilters({
                      ...advancedFilters,
                      dateRange: { ...advancedFilters.dateRange, end: e.target.value }
                    })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Status Filters */}
              <Typography variant="h6" gutterBottom>
                Slot Status
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={advancedFilters.statuses.available}
                        onChange={(e) => setAdvancedFilters({
                          ...advancedFilters,
                          statuses: { ...advancedFilters.statuses, available: e.target.checked }
                        })}
                      />
                    }
                    label="Available"
                  />
                </Grid>
                <Grid item xs={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={advancedFilters.statuses.reserved}
                        onChange={(e) => setAdvancedFilters({
                          ...advancedFilters,
                          statuses: { ...advancedFilters.statuses, reserved: e.target.checked }
                        })}
                      />
                    }
                    label="Reserved"
                  />
                </Grid>
                <Grid item xs={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={advancedFilters.statuses.sold}
                        onChange={(e) => setAdvancedFilters({
                          ...advancedFilters,
                          statuses: { ...advancedFilters.statuses, sold: e.target.checked }
                        })}
                      />
                    }
                    label="Sold"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Duration Filters */}
              <Typography variant="h6" gutterBottom>
                Ad Duration
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(advancedFilters.durations).map(([duration, checked]) => (
                  <Grid item xs={3} key={duration}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={checked}
                          onChange={(e) => setAdvancedFilters({
                            ...advancedFilters,
                            durations: { ...advancedFilters.durations, [duration]: e.target.checked }
                          })}
                        />
                      }
                      label={duration}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFiltersDialog(false)}>
              Cancel
            </Button>
            <Button onClick={resetAdvancedFilters} color="secondary">
              Reset
            </Button>
            <Button variant="contained" onClick={applyAdvancedFilters}>
              Apply Filters
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  )
}
