'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ShoppingCart as CartIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

interface AvailableSlot {
  id: string
  showId: string
  showName: string
  episodeId?: string
  episodeTitle?: string
  date: string
  placementType: string
  length: number
  rate: number
  availableSpots: number
}

interface ReservationItem {
  id: string
  showId: string
  showName: string
  episodeId?: string
  episodeTitle?: string
  date: Date
  placementType: string
  length: number
  rate: number
  notes?: string
}

interface Advertiser {
  id: string
  name: string
  email: string
}

interface Campaign {
  id: string
  name: string
  status: string
}

function CreateReservationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form data
  const [reservationItems, setReservationItems] = useState<ReservationItem[]>([])
  const [selectedAdvertiser, setSelectedAdvertiser] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [selectedAgency, setSelectedAgency] = useState('')
  const [holdDuration, setHoldDuration] = useState(48)
  const [priority, setPriority] = useState('normal')
  const [notes, setNotes] = useState('')

  // Available data
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [agencies, setAgencies] = useState<Advertiser[]>([])
  
  // Slot search
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [slotFilters, setSlotFilters] = useState({
    showId: '',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    placementType: '',
    minLength: '',
    maxLength: ''
  })

  const steps = ['Select Slots', 'Choose Advertiser & Campaign', 'Review & Create']

  useEffect(() => {
    loadAdvertisers()
    loadCampaigns()
    loadAgencies()
    
    // If slotId is provided in URL, pre-load that slot
    const slotId = searchParams.get('slotId')
    if (slotId) {
      // TODO: Load specific slot and add to cart
    }
  }, [searchParams])

  const loadAdvertisers = async () => {
    try {
      const response = await fetch('/api/advertisers')
      if (response.ok) {
        const data = await response.json()
        setAdvertisers(data.advertisers || [])
      }
    } catch (err) {
      console.error('Failed to load advertisers:', err)
    }
  }

  const loadCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns')
      if (response.ok) {
        const data = await response.json()
        setCampaigns(data.campaigns || [])
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err)
    }
  }

  const loadAgencies = async () => {
    try {
      const response = await fetch('/api/agencies')
      if (response.ok) {
        const data = await response.json()
        setAgencies(data.agencies || [])
      }
    } catch (err) {
      console.error('Failed to load agencies:', err)
    }
  }

  const searchAvailableSlots = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: slotFilters.startDate.toISOString(),
        endDate: slotFilters.endDate.toISOString()
      })
      
      if (slotFilters.showId) params.set('showId', slotFilters.showId)
      if (slotFilters.placementType) params.set('placementType', slotFilters.placementType)
      if (slotFilters.minLength) params.set('minLength', slotFilters.minLength)
      if (slotFilters.maxLength) params.set('maxLength', slotFilters.maxLength)

      const response = await fetch(`/api/availability?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableSlots(data.slots || [])
      } else {
        setError('Failed to search available slots')
      }
    } catch (err) {
      setError('Failed to search available slots')
    } finally {
      setLoading(false)
    }
  }

  const addSlotToReservation = (slot: AvailableSlot) => {
    const newItem: ReservationItem = {
      id: Math.random().toString(36).substr(2, 9),
      showId: slot.showId,
      showName: slot.showName,
      episodeId: slot.episodeId,
      episodeTitle: slot.episodeTitle,
      date: new Date(slot.date),
      placementType: slot.placementType,
      length: slot.length,
      rate: slot.rate
    }
    
    setReservationItems([...reservationItems, newItem])
    setSearchDialogOpen(false)
  }

  const removeSlotFromReservation = (itemId: string) => {
    setReservationItems(reservationItems.filter(item => item.id !== itemId))
  }

  const getTotalAmount = () => {
    return reservationItems.reduce((sum, item) => sum + item.rate, 0)
  }

  const handleCreateReservation = async () => {
    try {
      setLoading(true)
      setError(null)

      if (reservationItems.length === 0) {
        setError('Please add at least one slot to the reservation')
        return
      }

      if (!selectedAdvertiser) {
        setError('Please select an advertiser')
        return
      }

      const reservationData = {
        advertiserId: selectedAdvertiser,
        campaignId: selectedCampaign || undefined,
        agencyId: selectedAgency || undefined,
        holdDuration,
        priority,
        notes,
        source: 'web',
        items: reservationItems.map(item => ({
          showId: item.showId,
          episodeId: item.episodeId,
          date: item.date.toISOString(),
          placementType: item.placementType,
          length: item.length,
          rate: item.rate,
          notes: item.notes
        }))
      }

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationData)
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess(true)
        setTimeout(() => {
          router.push(`/reservations`)
        }, 2000)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to create reservation')
      }
    } catch (err) {
      setError('Failed to create reservation')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (success) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Alert severity="success" sx={{ mb: 3 }}>
            Reservation created successfully! Redirecting to reservations list...
          </Alert>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Create Reservation
          </Typography>
          <Button
            variant="outlined"
            onClick={() => router.push('/reservations')}
          >
            Cancel
          </Button>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stepper */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>

        {/* Step Content */}
        {activeStep === 0 && (
          <Grid container spacing={3}>
            {/* Selected Slots */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Selected Slots ({reservationItems.length})
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<SearchIcon />}
                      onClick={() => setSearchDialogOpen(true)}
                    >
                      Find Available Slots
                    </Button>
                  </Box>

                  {reservationItems.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CartIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                      <Typography color="text.secondary">
                        No slots selected. Click "Find Available Slots" to get started.
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Show</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Placement</TableCell>
                            <TableCell>Length</TableCell>
                            <TableCell>Rate</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reservationItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {item.showName}
                                </Typography>
                                {item.episodeTitle && (
                                  <Typography variant="caption" color="text.secondary">
                                    {item.episodeTitle}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.date.toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Chip label={item.placementType} size="small" />
                              </TableCell>
                              <TableCell>{item.length}s</TableCell>
                              <TableCell>{formatCurrency(item.rate)}</TableCell>
                              <TableCell>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => removeSlotFromReservation(item.id)}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Summary */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Reservation Summary
                  </Typography>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography>Total Slots:</Typography>
                      <Typography fontWeight="medium">{reservationItems.length}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography>Total Amount:</Typography>
                      <Typography fontWeight="medium">{formatCurrency(getTotalAmount())}</Typography>
                    </Box>
                    <Divider />
                    <Button
                      variant="contained"
                      fullWidth
                      disabled={reservationItems.length === 0}
                      onClick={() => setActiveStep(1)}
                    >
                      Continue to Advertiser Selection
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {activeStep === 1 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Advertiser & Campaign Details
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Advertiser</InputLabel>
                    <Select
                      value={selectedAdvertiser}
                      onChange={(e) => setSelectedAdvertiser(e.target.value)}
                    >
                      {advertisers.map((advertiser) => (
                        <MenuItem key={advertiser.id} value={advertiser.id}>
                          {advertiser.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Campaign (Optional)</InputLabel>
                    <Select
                      value={selectedCampaign}
                      onChange={(e) => setSelectedCampaign(e.target.value)}
                    >
                      <MenuItem value="">No Campaign</MenuItem>
                      {campaigns.map((campaign) => (
                        <MenuItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Agency (Optional)</InputLabel>
                    <Select
                      value={selectedAgency}
                      onChange={(e) => setSelectedAgency(e.target.value)}
                    >
                      <MenuItem value="">No Agency</MenuItem>
                      {agencies.map((agency) => (
                        <MenuItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="normal">Normal</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="urgent">Urgent</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Hold Duration (Hours)"
                    type="number"
                    value={holdDuration}
                    onChange={(e) => setHoldDuration(parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 168 }} // 1 hour to 1 week
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes (Optional)"
                    multiline
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      onClick={() => setActiveStep(0)}
                    >
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      disabled={!selectedAdvertiser}
                      onClick={() => setActiveStep(2)}
                    >
                      Continue to Review
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {activeStep === 2 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Review & Create Reservation
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Typography variant="subtitle1" gutterBottom>
                    Reservation Details
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Advertiser:</Typography>
                      <Typography>{advertisers.find(a => a.id === selectedAdvertiser)?.name}</Typography>
                    </Box>
                    {selectedCampaign && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">Campaign:</Typography>
                        <Typography>{campaigns.find(c => c.id === selectedCampaign)?.name}</Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="body2" color="text.secondary">Hold Duration:</Typography>
                      <Typography>{holdDuration} hours</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Priority:</Typography>
                      <Chip label={priority} size="small" />
                    </Box>
                    {notes && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">Notes:</Typography>
                        <Typography>{notes}</Typography>
                      </Box>
                    )}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Financial Summary
                      </Typography>
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography>Slots:</Typography>
                          <Typography>{reservationItems.length}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography>Total Amount:</Typography>
                          <Typography fontWeight="medium">{formatCurrency(getTotalAmount())}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography>Estimated Revenue:</Typography>
                          <Typography fontWeight="medium">{formatCurrency(getTotalAmount())}</Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      onClick={() => setActiveStep(1)}
                    >
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      disabled={loading}
                      onClick={handleCreateReservation}
                      startIcon={<ScheduleIcon />}
                    >
                      {loading ? 'Creating...' : 'Create Reservation'}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Search Slots Dialog */}
      <Dialog open={searchDialogOpen} onClose={() => setSearchDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Search Available Slots</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Search for available ad slots to add to your reservation.
          </Typography>
          
          {/* Search filters */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={slotFilters.startDate}
                  onChange={(date) => setSlotFilters({...slotFilters, startDate: date || new Date()})}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={slotFilters.endDate}
                  onChange={(date) => setSlotFilters({...slotFilters, endDate: date || new Date()})}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Placement Type</InputLabel>
                <Select
                  value={slotFilters.placementType}
                  onChange={(e) => setSlotFilters({...slotFilters, placementType: e.target.value})}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="preroll">Pre-roll</MenuItem>
                  <MenuItem value="midroll">Mid-roll</MenuItem>
                  <MenuItem value="postroll">Post-roll</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                fullWidth
                onClick={searchAvailableSlots}
                disabled={loading}
              >
                Search
              </Button>
            </Grid>
          </Grid>

          {/* Results */}
          {availableSlots.length > 0 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Show</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Placement</TableCell>
                    <TableCell>Length</TableCell>
                    <TableCell>Rate</TableCell>
                    <TableCell>Available</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {availableSlots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell>{slot.showName}</TableCell>
                      <TableCell>{new Date(slot.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip label={slot.placementType} size="small" />
                      </TableCell>
                      <TableCell>{slot.length}s</TableCell>
                      <TableCell>{formatCurrency(slot.rate)}</TableCell>
                      <TableCell>{slot.availableSpots}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => addSlotToReservation(slot)}
                          startIcon={<AddIcon />}
                        >
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  )
}

export default function CreateReservationPage() {
  return (
    <RouteProtection requiredPermission={PERMISSIONS.ORDERS_CREATE}>
      <Suspense fallback={<div>Loading...</div>}>
        <CreateReservationContent />
      </Suspense>
    </RouteProtection>
  )
}