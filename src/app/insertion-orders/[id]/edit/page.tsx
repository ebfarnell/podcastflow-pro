'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Divider,
  Alert,
  Autocomplete,
} from '@mui/material'
import {
  ArrowBack,
  Save,
  Cancel,
  Add,
  Remove,
  Delete,
  Warning,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'

interface AdPlacement {
  id: string
  show: string
  episodeDate: string
  position: 'pre-roll' | 'mid-roll' | 'post-roll' | 'host-read'
  duration: string
  rate: number
  estimatedListeners: number
  status: 'scheduled' | 'aired' | 'cancelled'
}

interface InsertionOrderData {
  id: string
  number: string
  advertiser: string
  agency?: string
  campaign: string
  startDate: Dayjs | null
  endDate: Dayjs | null
  totalBudget: number
  targetImpressions: number
  status: 'active' | 'pending' | 'completed' | 'cancelled'
  description: string
  contactName: string
  contactEmail: string
  billingContact: string
  poNumber: string
  placements: AdPlacement[]
  specialInstructions: string
}

const mockShows = [
  { name: 'The Tech Review Show', avgListeners: 85000, rate: 25 },
  { name: 'Business Insights Daily', avgListeners: 72000, rate: 22 },
  { name: 'Health & Wellness Hour', avgListeners: 65000, rate: 20 },
  { name: 'True Crime Chronicles', avgListeners: 58000, rate: 18 },
  { name: 'Sports Talk Daily', avgListeners: 52000, rate: 16 },
]

const adPositions = [
  { value: 'pre-roll', label: 'Pre-roll', multiplier: 1.0 },
  { value: 'mid-roll', label: 'Mid-roll', multiplier: 1.5 },
  { value: 'post-roll', label: 'Post-roll', multiplier: 0.8 },
  { value: 'host-read', label: 'Host-read', multiplier: 2.0 },
]

const mockAdvertisers = [
  'TechCorp Inc.',
  'HealthPlus',
  'AutoDrive Corporation',
  'FashionForward',
  'GourmetEats',
]

const mockAgencies = [
  'Digital Media Agency',
  'Creative Minds Marketing',
  'Brand Boost Partners',
]

export default function EditInsertionOrderPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  // Mock data - in real app, this would be fetched based on orderId
  const [orderData, setOrderData] = useState<InsertionOrderData>({
    id: orderId,
    number: 'IO-2024-001',
    advertiser: 'TechCorp Inc.',
    agency: 'Digital Media Agency',
    campaign: 'Q4 Product Launch',
    startDate: dayjs('2024-10-01'),
    endDate: dayjs('2024-12-31'),
    totalBudget: 150000,
    targetImpressions: 2000000,
    status: 'active',
    description: 'Q4 product launch campaign targeting tech professionals',
    contactName: 'Sarah Johnson',
    contactEmail: 'sarah@techcorp.com',
    billingContact: 'accounts@techcorp.com',
    poNumber: 'PO-2024-TechCorp-Q4',
    specialInstructions: 'Please ensure ads run during tech-focused episodes',
    placements: [
      {
        id: '1',
        show: 'The Tech Review Show',
        episodeDate: '2024-01-16',
        position: 'mid-roll',
        duration: '60s',
        rate: 2500,
        estimatedListeners: 85000,
        status: 'scheduled',
      },
      {
        id: '2',
        show: 'Business Insights Daily',
        episodeDate: '2024-01-18',
        position: 'pre-roll',
        duration: '30s',
        rate: 1800,
        estimatedListeners: 72000,
        status: 'scheduled',
      },
    ],
  })

  const [hasChanges, setHasChanges] = useState(false)

  const handleInputChange = (field: keyof InsertionOrderData, value: any) => {
    setOrderData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const addPlacement = () => {
    const newPlacement: AdPlacement = {
      id: Date.now().toString(),
      show: '',
      episodeDate: dayjs().add(1, 'week').format('YYYY-MM-DD'),
      position: 'mid-roll',
      duration: '30s',
      rate: 0,
      estimatedListeners: 0,
      status: 'scheduled',
    }
    setOrderData(prev => ({
      ...prev,
      placements: [...prev.placements, newPlacement]
    }))
    setHasChanges(true)
  }

  const removePlacement = (id: string) => {
    setOrderData(prev => ({
      ...prev,
      placements: prev.placements.filter(p => p.id !== id)
    }))
    setHasChanges(true)
  }

  const updatePlacement = (id: string, field: keyof AdPlacement, value: any) => {
    setOrderData(prev => ({
      ...prev,
      placements: prev.placements.map(p => 
        p.id === id ? { ...p, [field]: value } : p
      )
    }))
    setHasChanges(true)
  }

  const calculatePlacementRate = (show: string, position: string) => {
    const showData = mockShows.find(s => s.name === show)
    const positionData = adPositions.find(p => p.value === position)
    if (showData && positionData) {
      return Math.round(showData.rate * positionData.multiplier)
    }
    return 0
  }

  const getTotalCost = () => {
    return orderData.placements.reduce((total, placement) => total + placement.rate, 0)
  }

  const getTotalImpressions = () => {
    return orderData.placements.reduce((total, placement) => total + placement.estimatedListeners, 0)
  }

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: orderData.status,
          discountAmount: orderData.discount.amount || 0,
          discountReason: orderData.discount.reason,
          notes: orderData.notes,
          internalNotes: orderData.internalNotes,
          orderItems: orderData.placements.map(placement => ({
            showId: placement.showId,
            episodeId: placement.episodeId,
            placementType: placement.position,
            spotNumber: placement.spotNumber,
            airDate: placement.airDate,
            length: placement.duration,
            isLiveRead: placement.isLiveRead,
            rate: placement.rate,
            actualRate: placement.rate, // Apply discounts at order level
            adTitle: placement.adTitle,
            adScript: placement.adScript,
            adTalkingPoints: placement.talkingPoints || [],
            status: placement.status
          }))
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update order')
      }

      const updatedOrder = await response.json()
      
      alert('Insertion Order updated successfully!')
      setHasChanges(false)
      router.push(`/insertion-orders/${orderId}`)
    } catch (error) {
      console.error('Error saving order:', error)
      alert('Failed to save order. Please try again.')
    }
  }

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        router.push(`/insertion-orders/${orderId}`)
      }
    } else {
      router.push(`/insertion-orders/${orderId}`)
    }
  }

  const canEditPlacement = (placement: AdPlacement) => {
    return placement.status === 'scheduled'
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Edit Insertion Order
            </Typography>
            <Typography variant="h6" color="text.secondary">
              {orderData.number} - {orderData.campaign}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => router.push(`/insertion-orders/${orderId}`)}
            >
              Back to Order
            </Button>
          </Box>
        </Box>

        {hasChanges && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            You have unsaved changes. Don't forget to save your modifications.
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Order Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Order Number"
                    value={orderData.number}
                    disabled
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Purchase Order Number"
                    value={orderData.poNumber}
                    onChange={(e) => handleInputChange('poNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Advertiser</InputLabel>
                    <Select
                      value={orderData.advertiser}
                      label="Advertiser"
                      onChange={(e) => handleInputChange('advertiser', e.target.value)}
                    >
                      {mockAdvertisers.map((advertiser) => (
                        <MenuItem key={advertiser} value={advertiser}>
                          {advertiser}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Agency</InputLabel>
                    <Select
                      value={orderData.agency || ''}
                      label="Agency"
                      onChange={(e) => handleInputChange('agency', e.target.value)}
                    >
                      <MenuItem value="">No Agency</MenuItem>
                      {mockAgencies.map((agency) => (
                        <MenuItem key={agency} value={agency}>
                          {agency}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Campaign Name"
                    value={orderData.campaign}
                    onChange={(e) => handleInputChange('campaign', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      label="Start Date"
                      value={orderData.startDate}
                      onChange={(newValue) => handleInputChange('startDate', newValue)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item xs={12} md={6}>
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      label="End Date"
                      value={orderData.endDate}
                      onChange={(newValue) => handleInputChange('endDate', newValue)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Total Budget"
                    type="number"
                    value={orderData.totalBudget}
                    onChange={(e) => handleInputChange('totalBudget', Number(e.target.value))}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Target Impressions"
                    type="number"
                    value={orderData.targetImpressions}
                    onChange={(e) => handleInputChange('targetImpressions', Number(e.target.value))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={orderData.status}
                      label="Status"
                      onChange={(e) => handleInputChange('status', e.target.value)}
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={orderData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    multiline
                    rows={3}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Contact Information */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Contact Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Contact Name"
                    value={orderData.contactName}
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Contact Email"
                    value={orderData.contactEmail}
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Billing Contact"
                    value={orderData.billingContact}
                    onChange={(e) => handleInputChange('billingContact', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Special Instructions"
                    value={orderData.specialInstructions}
                    onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Ad Placements */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Ad Placements
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={addPlacement}
                >
                  Add Placement
                </Button>
              </Box>

              {orderData.placements.length === 0 ? (
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No placements added yet
                    </Typography>
                    <Button variant="outlined" startIcon={<Add />} onClick={addPlacement}>
                      Add First Placement
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Show</TableCell>
                          <TableCell>Episode Date</TableCell>
                          <TableCell>Position</TableCell>
                          <TableCell>Duration</TableCell>
                          <TableCell>Rate</TableCell>
                          <TableCell>Est. Listeners</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {orderData.placements.map((placement) => (
                          <TableRow key={placement.id}>
                            <TableCell>
                              <Autocomplete
                                size="small"
                                options={mockShows}
                                getOptionLabel={(option) => option.name}
                                value={mockShows.find(s => s.name === placement.show) || null}
                                onChange={(e, value) => {
                                  if (value && canEditPlacement(placement)) {
                                    updatePlacement(placement.id, 'show', value.name)
                                    updatePlacement(placement.id, 'estimatedListeners', value.avgListeners)
                                    updatePlacement(placement.id, 'rate', calculatePlacementRate(value.name, placement.position))
                                  }
                                }}
                                disabled={!canEditPlacement(placement)}
                                renderInput={(params) => <TextField {...params} />}
                                sx={{ minWidth: 180 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="date"
                                value={placement.episodeDate}
                                onChange={(e) => updatePlacement(placement.id, 'episodeDate', e.target.value)}
                                disabled={!canEditPlacement(placement)}
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                size="small"
                                value={placement.position}
                                onChange={(e) => {
                                  if (canEditPlacement(placement)) {
                                    updatePlacement(placement.id, 'position', e.target.value)
                                    updatePlacement(placement.id, 'rate', calculatePlacementRate(placement.show, e.target.value as string))
                                  }
                                }}
                                disabled={!canEditPlacement(placement)}
                                sx={{ minWidth: 120 }}
                              >
                                {adPositions.map((pos) => (
                                  <MenuItem key={pos.value} value={pos.value}>
                                    {pos.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                size="small"
                                value={placement.duration}
                                onChange={(e) => updatePlacement(placement.id, 'duration', e.target.value)}
                                disabled={!canEditPlacement(placement)}
                                sx={{ minWidth: 80 }}
                              >
                                <MenuItem value="15s">15s</MenuItem>
                                <MenuItem value="30s">30s</MenuItem>
                                <MenuItem value="60s">60s</MenuItem>
                                <MenuItem value="90s">90s</MenuItem>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                value={placement.rate}
                                onChange={(e) => updatePlacement(placement.id, 'rate', Number(e.target.value))}
                                disabled={!canEditPlacement(placement)}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                }}
                                sx={{ width: 100 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                value={placement.estimatedListeners}
                                onChange={(e) => updatePlacement(placement.id, 'estimatedListeners', Number(e.target.value))}
                                disabled={!canEditPlacement(placement)}
                                sx={{ width: 120 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={placement.status}
                                size="small"
                                color={placement.status === 'aired' ? 'success' : placement.status === 'scheduled' ? 'info' : 'error'}
                              />
                            </TableCell>
                            <TableCell>
                              {canEditPlacement(placement) ? (
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => removePlacement(placement.id)}
                                >
                                  <Delete />
                                </IconButton>
                              ) : (
                                <IconButton size="small" disabled>
                                  <Warning color="disabled" />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6">
                      Total Cost: ${getTotalCost().toLocaleString()}
                    </Typography>
                    <Typography variant="h6">
                      Total Impressions: {getTotalImpressions().toLocaleString()}
                    </Typography>
                  </Box>
                </>
              )}
            </Paper>
          </Grid>

          {/* Actions */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  * Aired placements cannot be modified
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Cancel />}
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSave}
                    disabled={!hasChanges}
                  >
                    Save Changes
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  )
}