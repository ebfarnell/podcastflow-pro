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
} from '@mui/material'
import {
  ArrowBack,
  Save,
  Send,
  Business,
  CalendarMonth,
  AttachMoney,
  Description,
  Person,
  Email,
  Phone,
  LocationOn,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'

interface ContractData {
  title: string
  advertiser: string
  agency?: string
  type: 'master' | 'insertion-order' | 'amendment'
  value: number
  startDate: Dayjs | null
  endDate: Dayjs | null
  paymentTerms: string
  cancellationPolicy: string
  exclusivity: boolean
  description: string
  contactName: string
  contactEmail: string
  contactPhone: string
  billingAddress: string
  shows: string[]
  adFormats: string[]
  targetAudience: string
  specialTerms: string
}

const steps = ['Basic Information', 'Financial Terms', 'Campaign Details', 'Review & Submit']

const mockAdvertisers = [
  'TechCorp Inc.',
  'HealthPlus',
  'AutoDrive Corporation',
  'FashionForward',
  'GourmetEats',
  'EcoHome Solutions',
  'TravelEase',
  'FinanceFirst',
]

const mockAgencies = [
  'Digital Media Agency',
  'Creative Minds Marketing',
  'Brand Boost Partners',
  'Media Solutions Inc.',
  'Advertising Experts',
]

const mockShows = [
  'The Tech Review Show',
  'Business Insights Daily',
  'Health & Wellness Hour',
  'True Crime Chronicles',
  'Sports Talk Daily',
  'Finance Focus',
  'Travel Tales',
  'Foodie Adventures',
]

const adFormats = [
  'Pre-roll Audio (15s)',
  'Pre-roll Audio (30s)',
  'Mid-roll Audio (60s)',
  'Post-roll Audio (30s)',
  'Host-read Advertisement',
  'Sponsored Segment',
  'Banner Display',
  'Newsletter Mention',
]

export default function NewContractPage() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  const [contractData, setContractData] = useState<ContractData>({
    title: '',
    advertiser: '',
    agency: '',
    type: 'insertion-order',
    value: 0,
    startDate: dayjs(),
    endDate: dayjs().add(3, 'month'),
    paymentTerms: 'Net 30',
    cancellationPolicy: '30 days notice',
    exclusivity: false,
    description: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    billingAddress: '',
    shows: [],
    adFormats: [],
    targetAudience: '',
    specialTerms: '',
  })

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1)
  }

  const handleInputChange = (field: keyof ContractData, value: any) => {
    setContractData(prev => ({ ...prev, [field]: value }))
  }

  const handleArrayToggle = (field: 'shows' | 'adFormats', value: string) => {
    setContractData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }))
  }

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: contractData.campaign || null,
          orderId: contractData.relatedOrder || null,
          advertiserId: contractData.advertiser,
          agencyId: contractData.agency || null,
          contractType: contractData.type,
          title: contractData.title,
          description: contractData.description,
          totalAmount: contractData.financial.totalValue,
          discountAmount: contractData.financial.discount || 0,
          commissionRate: contractData.financial.commission || 0,
          startDate: contractData.startDate,
          endDate: contractData.endDate,
          paymentTerms: contractData.paymentTerms,
          cancellationTerms: contractData.termsConditions.cancellation,
          deliveryTerms: contractData.termsConditions.delivery,
          specialTerms: contractData.termsConditions.special,
          lineItems: contractData.lineItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.total,
            discountRate: 0,
            netPrice: item.total,
            showId: item.showId || null
          }))
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create contract')
      }

      const result = await response.json()
      alert('Contract created successfully!')
      router.push(`/contracts/${result.contract.id}`)
    } catch (error) {
      console.error('Error creating contract:', error)
      alert('Failed to create contract. Please try again.')
    }
  }

  const handleSaveDraft = async () => {
    try {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: contractData.campaign || null,
          orderId: contractData.relatedOrder || null,
          advertiserId: contractData.advertiser,
          agencyId: contractData.agency || null,
          contractType: contractData.type,
          title: contractData.title,
          description: contractData.description,
          totalAmount: contractData.financial.totalValue,
          discountAmount: contractData.financial.discount || 0,
          commissionRate: contractData.financial.commission || 0,
          startDate: contractData.startDate,
          endDate: contractData.endDate,
          paymentTerms: contractData.paymentTerms,
          cancellationTerms: contractData.termsConditions.cancellation,
          deliveryTerms: contractData.termsConditions.delivery,
          specialTerms: contractData.termsConditions.special,
          lineItems: contractData.lineItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.total,
            discountRate: 0,
            netPrice: item.total,
            showId: item.showId || null
          })),
          status: 'draft' // Set status to draft
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save draft')
      }

      const result = await response.json()
      alert('Contract saved as draft!')
      router.push(`/contracts/${result.contract.id}`)
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
                Basic Contract Information
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Contract Title"
                value={contractData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., TechCorp Q1 Advertising Agreement"
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Contract Type</InputLabel>
                <Select
                  value={contractData.type}
                  label="Contract Type"
                  onChange={(e) => handleInputChange('type', e.target.value)}
                >
                  <MenuItem value="master">Master Service Agreement</MenuItem>
                  <MenuItem value="insertion-order">Insertion Order</MenuItem>
                  <MenuItem value="amendment">Amendment</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Advertiser</InputLabel>
                <Select
                  value={contractData.advertiser}
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
                  value={contractData.agency}
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
                label="Description"
                value={contractData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
                placeholder="Brief description of the advertising campaign or agreement"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Contact Information
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Contact Name"
                value={contractData.contactName}
                onChange={(e) => handleInputChange('contactName', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Contact Email"
                value={contractData.contactEmail}
                onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Contact Phone"
                value={contractData.contactPhone}
                onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Billing Address"
                value={contractData.billingAddress}
                onChange={(e) => handleInputChange('billingAddress', e.target.value)}
                multiline
                rows={2}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationOn />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        )

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Financial Terms
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Contract Value"
                type="number"
                value={contractData.value}
                onChange={(e) => handleInputChange('value', Number(e.target.value))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Terms</InputLabel>
                <Select
                  value={contractData.paymentTerms}
                  label="Payment Terms"
                  onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                >
                  <MenuItem value="Net 15">Net 15</MenuItem>
                  <MenuItem value="Net 30">Net 30</MenuItem>
                  <MenuItem value="Net 45">Net 45</MenuItem>
                  <MenuItem value="Net 60">Net 60</MenuItem>
                  <MenuItem value="Payment on delivery">Payment on delivery</MenuItem>
                  <MenuItem value="50% upfront, 50% on completion">50% upfront, 50% on completion</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Start Date"
                  value={contractData.startDate}
                  onChange={(newValue) => handleInputChange('startDate', newValue)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="End Date"
                  value={contractData.endDate}
                  onChange={(newValue) => handleInputChange('endDate', newValue)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Cancellation Policy</InputLabel>
                <Select
                  value={contractData.cancellationPolicy}
                  label="Cancellation Policy"
                  onChange={(e) => handleInputChange('cancellationPolicy', e.target.value)}
                >
                  <MenuItem value="No cancellation allowed">No cancellation allowed</MenuItem>
                  <MenuItem value="7 days notice">7 days notice</MenuItem>
                  <MenuItem value="14 days notice">14 days notice</MenuItem>
                  <MenuItem value="30 days notice">30 days notice</MenuItem>
                  <MenuItem value="60 days notice">60 days notice</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={contractData.exclusivity}
                    onChange={(e) => handleInputChange('exclusivity', e.target.checked)}
                  />
                }
                label="Exclusive advertising rights"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Special Terms & Conditions"
                value={contractData.specialTerms}
                onChange={(e) => handleInputChange('specialTerms', e.target.value)}
                multiline
                rows={4}
                placeholder="Any special terms, conditions, or notes for this contract"
              />
            </Grid>
          </Grid>
        )

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Campaign Details
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Select Shows
              </Typography>
              <Card variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                <List dense>
                  {mockShows.map((show) => (
                    <ListItem key={show}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={contractData.shows.includes(show)}
                            onChange={() => handleArrayToggle('shows', show)}
                          />
                        }
                        label={show}
                      />
                    </ListItem>
                  ))}
                </List>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Ad Formats
              </Typography>
              <Card variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                <List dense>
                  {adFormats.map((format) => (
                    <ListItem key={format}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={contractData.adFormats.includes(format)}
                            onChange={() => handleArrayToggle('adFormats', format)}
                          />
                        }
                        label={format}
                      />
                    </ListItem>
                  ))}
                </List>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Target Audience"
                value={contractData.targetAudience}
                onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                placeholder="e.g., Tech professionals, Business leaders, Health-conscious individuals"
              />
            </Grid>
          </Grid>
        )

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Contract Summary
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Basic Information
                  </Typography>
                  <Typography><strong>Title:</strong> {contractData.title}</Typography>
                  <Typography><strong>Type:</strong> {contractData.type}</Typography>
                  <Typography><strong>Advertiser:</strong> {contractData.advertiser}</Typography>
                  {contractData.agency && (
                    <Typography><strong>Agency:</strong> {contractData.agency}</Typography>
                  )}
                  <Typography><strong>Contact:</strong> {contractData.contactName}</Typography>
                  <Typography><strong>Email:</strong> {contractData.contactEmail}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Financial Terms
                  </Typography>
                  <Typography><strong>Value:</strong> ${contractData.value.toLocaleString()}</Typography>
                  <Typography><strong>Payment Terms:</strong> {contractData.paymentTerms}</Typography>
                  <Typography><strong>Start Date:</strong> {contractData.startDate?.format('MM/DD/YYYY')}</Typography>
                  <Typography><strong>End Date:</strong> {contractData.endDate?.format('MM/DD/YYYY')}</Typography>
                  <Typography><strong>Cancellation:</strong> {contractData.cancellationPolicy}</Typography>
                  <Typography><strong>Exclusivity:</strong> {contractData.exclusivity ? 'Yes' : 'No'}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Selected Shows ({contractData.shows.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {contractData.shows.map((show) => (
                      <Chip key={show} label={show} size="small" />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Ad Formats ({contractData.adFormats.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {contractData.adFormats.map((format) => (
                      <Chip key={format} label={format} size="small" color="primary" />
                    ))}
                  </Box>
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
              Create New Contract
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Set up a new advertising contract with detailed terms and conditions
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/contracts')}
          >
            Back to Contracts
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
                    (activeStep === 0 && (!contractData.title || !contractData.advertiser)) ||
                    (activeStep === 1 && contractData.value <= 0)
                  }
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<Send />}
                  onClick={handleSubmit}
                  disabled={contractData.shows.length === 0 || contractData.adFormats.length === 0}
                >
                  Create Contract
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      </Box>
    </DashboardLayout>
  )
}