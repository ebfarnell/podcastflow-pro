'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Autocomplete,
} from '@mui/material'
import {
  ArrowBack,
  Save,
  Send,
  Campaign,
  CalendarMonth,
  AttachMoney,
  Description,
  Add,
  Remove,
  Visibility,
  Edit,
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
}

interface InsertionOrderData {
  number: string
  advertiser: string
  agency?: string
  campaign: string
  startDate: Dayjs | null
  endDate: Dayjs | null
  totalBudget: number
  targetImpressions: number
  description: string
  objectives: string[]
  targetAudience: string
  creativeSpecs: string
  placements: AdPlacement[]
  specialInstructions: string
  contactName: string
  contactEmail: string
  billingContact: string
  poNumber: string
}

const steps = ['Order Information', 'Campaign Details', 'Ad Placements', 'Review & Submit']

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

const mockShows = [
  { name: 'The Tech Review Show', avgListeners: 85000, rate: 25 },
  { name: 'Business Insights Daily', avgListeners: 72000, rate: 22 },
  { name: 'Health & Wellness Hour', avgListeners: 65000, rate: 20 },
  { name: 'True Crime Chronicles', avgListeners: 58000, rate: 18 },
  { name: 'Sports Talk Daily', avgListeners: 52000, rate: 16 },
]

const campaignObjectives = [
  'Brand Awareness',
  'Lead Generation',
  'Sales Conversion',
  'App Downloads',
  'Website Traffic',
  'Product Launch',
  'Event Promotion',
  'Customer Retention',
]

const adPositions = [
  { value: 'pre-roll', label: 'Pre-roll', multiplier: 1.0 },
  { value: 'mid-roll', label: 'Mid-roll', multiplier: 1.5 },
  { value: 'post-roll', label: 'Post-roll', multiplier: 0.8 },
  { value: 'host-read', label: 'Host-read', multiplier: 2.0 },
]

export default function NewInsertionOrderPage() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  const [orderData, setOrderData] = useState<InsertionOrderData>({
    number: `IO-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
    advertiser: '',
    agency: '',
    campaign: '',
    startDate: dayjs(),
    endDate: dayjs().add(1, 'month'),
    totalBudget: 0,
    targetImpressions: 0,
    description: '',
    objectives: [],
    targetAudience: '',
    creativeSpecs: '',
    placements: [],
    specialInstructions: '',
    contactName: '',
    contactEmail: '',
    billingContact: '',
    poNumber: '',
  })

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1)
  }

  const handleInputChange = (field: keyof InsertionOrderData, value: any) => {
    setOrderData(prev => ({ ...prev, [field]: value }))
  }

  const handleObjectiveToggle = (objective: string) => {
    setOrderData(prev => ({
      ...prev,
      objectives: prev.objectives.includes(objective)
        ? prev.objectives.filter(obj => obj !== objective)
        : [...prev.objectives, objective]
    }))
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
    }
    setOrderData(prev => ({
      ...prev,
      placements: [...prev.placements, newPlacement]
    }))
  }

  const removePlacement = (id: string) => {
    setOrderData(prev => ({
      ...prev,
      placements: prev.placements.filter(p => p.id !== id)
    }))
  }

  const updatePlacement = (id: string, field: keyof AdPlacement, value: any) => {
    setOrderData(prev => ({
      ...prev,
      placements: prev.placements.map(p => 
        p.id === id ? { ...p, [field]: value } : p
      )
    }))
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

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderNumber: orderData.number,
          campaignId: orderData.campaign,
          advertiserId: orderData.advertiser,
          agencyId: orderData.agency || null,
          status: 'pending_approval',
          totalAmount: getTotalCost(),
          discountAmount: orderData.discount.amount || 0,
          discountReason: orderData.discount.reason,
          netAmount: getTotalCost() - (orderData.discount.amount || 0),
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
            actualRate: placement.rate,
            adTitle: placement.adTitle,
            adScript: placement.adScript,
            adTalkingPoints: placement.talkingPoints || [],
            status: 'pending'
          }))
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create order')
      }

      const newOrder = await response.json()
      alert('Insertion Order created successfully!')
      router.push(`/insertion-orders/${newOrder.id}`)
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Failed to create order. Please try again.')
    }
  }

  const handleSaveDraft = async () => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderNumber: orderData.number,
          campaignId: orderData.campaign,
          advertiserId: orderData.advertiser,
          agencyId: orderData.agency || null,
          status: 'draft',
          totalAmount: getTotalCost(),
          discountAmount: orderData.discount.amount || 0,
          discountReason: orderData.discount.reason,
          netAmount: getTotalCost() - (orderData.discount.amount || 0),
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
            actualRate: placement.rate,
            adTitle: placement.adTitle,
            adScript: placement.adScript,
            adTalkingPoints: placement.talkingPoints || [],
            status: 'pending'
          }))
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save draft')
      }

      const newOrder = await response.json()
      alert('Insertion Order saved as draft!')
      router.push(`/insertion-orders/${newOrder.id}`)
    } catch (error) {
      console.error('Error saving draft:', error)
      alert('Failed to save draft. Please try again.')
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Order Information
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Order Number"
                value={orderData.number}
                onChange={(e) => handleInputChange('number', e.target.value)}
                disabled
                helperText="Auto-generated order number"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Purchase Order Number"
                value={orderData.poNumber}
                onChange={(e) => handleInputChange('poNumber', e.target.value)}
                placeholder="Client's PO number"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
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
                <InputLabel>Agency (Optional)</InputLabel>
                <Select
                  value={orderData.agency}
                  label="Agency (Optional)"
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
                required
                placeholder="e.g., TechCorp Q1 Product Launch"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Campaign Start Date"
                  value={orderData.startDate}
                  onChange={(newValue) => handleInputChange('startDate', newValue)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Campaign End Date"
                  value={orderData.endDate}
                  onChange={(newValue) => handleInputChange('endDate', newValue)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
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
                type="email"
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
          </Grid>
        )

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Campaign Details
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Campaign Description"
                value={orderData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
                placeholder="Describe the campaign goals, messaging, and key points"
              />
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
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Target Impressions"
                type="number"
                value={orderData.targetImpressions}
                onChange={(e) => handleInputChange('targetImpressions', Number(e.target.value))}
                placeholder="Expected total impressions"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Target Audience"
                value={orderData.targetAudience}
                onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                placeholder="e.g., Tech professionals aged 25-45, Business decision makers"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Campaign Objectives
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {campaignObjectives.map((objective) => (
                  <Chip
                    key={objective}
                    label={objective}
                    clickable
                    color={orderData.objectives.includes(objective) ? 'primary' : 'default'}
                    onClick={() => handleObjectiveToggle(objective)}
                    variant={orderData.objectives.includes(objective) ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Creative Specifications"
                value={orderData.creativeSpecs}
                onChange={(e) => handleInputChange('creativeSpecs', e.target.value)}
                multiline
                rows={3}
                placeholder="Audio format requirements, duration, file types, etc."
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
                placeholder="Any special requirements or notes for the campaign"
              />
            </Grid>
          </Grid>
        )

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
            </Grid>
            {orderData.placements.length === 0 ? (
              <Grid item xs={12}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No placements added yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Click "Add Placement" to start building your insertion order
                    </Typography>
                    <Button variant="outlined" startIcon={<Add />} onClick={addPlacement}>
                      Add First Placement
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ) : (
              <Grid item xs={12}>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Show</TableCell>
                        <TableCell>Episode Date</TableCell>
                        <TableCell>Position</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Rate</TableCell>
                        <TableCell>Est. Listeners</TableCell>
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
                                if (value) {
                                  updatePlacement(placement.id, 'show', value.name)
                                  updatePlacement(placement.id, 'estimatedListeners', value.avgListeners)
                                  updatePlacement(placement.id, 'rate', calculatePlacementRate(value.name, placement.position))
                                }
                              }}
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
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              value={placement.position}
                              onChange={(e) => {
                                updatePlacement(placement.id, 'position', e.target.value)
                                updatePlacement(placement.id, 'rate', calculatePlacementRate(placement.show, e.target.value as string))
                              }}
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
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removePlacement(placement.id)}
                            >
                              <Remove />
                            </IconButton>
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
              </Grid>
            )}
          </Grid>
        )

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Insertion Order Summary
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <Campaign sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Order Information
                  </Typography>
                  <Typography><strong>Order #:</strong> {orderData.number}</Typography>
                  <Typography><strong>Campaign:</strong> {orderData.campaign}</Typography>
                  <Typography><strong>Advertiser:</strong> {orderData.advertiser}</Typography>
                  {orderData.agency && (
                    <Typography><strong>Agency:</strong> {orderData.agency}</Typography>
                  )}
                  <Typography><strong>Contact:</strong> {orderData.contactName}</Typography>
                  <Typography><strong>Start Date:</strong> {orderData.startDate?.format('MM/DD/YYYY')}</Typography>
                  <Typography><strong>End Date:</strong> {orderData.endDate?.format('MM/DD/YYYY')}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Financial Summary
                  </Typography>
                  <Typography><strong>Total Budget:</strong> ${orderData.totalBudget.toLocaleString()}</Typography>
                  <Typography><strong>Placement Cost:</strong> ${getTotalCost().toLocaleString()}</Typography>
                  <Typography><strong>Remaining:</strong> ${(orderData.totalBudget - getTotalCost()).toLocaleString()}</Typography>
                  <Typography><strong>Target Impressions:</strong> {orderData.targetImpressions.toLocaleString()}</Typography>
                  <Typography><strong>Est. Impressions:</strong> {getTotalImpressions().toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Campaign Objectives
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {orderData.objectives.map((objective) => (
                      <Chip key={objective} label={objective} color="primary" />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Ad Placements ({orderData.placements.length})
                  </Typography>
                  {orderData.placements.map((placement, index) => (
                    <Box key={placement.id} sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        {index + 1}. {placement.show} - {placement.position} ({placement.duration}) - ${placement.rate}
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )

      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Create New Insertion Order
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Set up a new insertion order with detailed ad placements and campaign specifications
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/insertion-orders')}
          >
            Back to Orders
          </Button>
        </Box>

        <Paper sx={{ p: 4 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent()}

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              {activeStep > 0 && (
                <Button onClick={handleBack} sx={{ mr: 1 }}>
                  Back
                </Button>
              )}
              <Button variant="outlined" startIcon={<Save />} onClick={handleSaveDraft}>
                Save Draft
              </Button>
            </Box>
            <Box>
              {activeStep < steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={
                    (activeStep === 0 && (!orderData.advertiser || !orderData.campaign)) ||
                    (activeStep === 1 && orderData.totalBudget <= 0) ||
                    (activeStep === 2 && orderData.placements.length === 0)
                  }
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<Send />}
                  onClick={handleSubmit}
                  disabled={orderData.placements.length === 0}
                >
                  Create Order
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      </Box>
    </DashboardLayout>
  )
}