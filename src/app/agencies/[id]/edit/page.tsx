'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  Snackbar,
} from '@mui/material'
import {
  ArrowBack,
  Save,
  Business,
  Phone,
  Email,
  LocationOn,
  Person,
  Cancel,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

interface Agency {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  website: string
  status: 'active' | 'inactive' | 'pending'
  commissionRate: number
  paymentTerms: string
  notes: string
  createdAt: string
  updatedAt: string
}

export default function EditAgencyPage() {
  const router = useRouter()
  const params = useParams()
  const agencyId = params.id as string

  const [agency, setAgency] = useState<Agency>({
    id: agencyId,
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    website: '',
    status: 'active',
    commissionRate: 15,
    paymentTerms: 'Net 30',
    notes: '',
    createdAt: '2024-01-01',
    updatedAt: new Date().toISOString(),
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    // Fetch real agency data from API
    const fetchAgency = async () => {
      try {
        const response = await fetch(`/api/agencies/${agencyId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch agency')
        }
        const data = await response.json()
        
        // Map API response to component state
        setAgency({
          id: data.id,
          name: data.name || '',
          contactName: data.contactName || '', // This might not exist in API, we'll handle it
          email: data.email || data.contactEmail || '',
          phone: data.phone || data.contactPhone || '',
          address: data.address?.street || '',
          city: data.address?.city || '',
          state: data.address?.state || '',
          zipCode: data.address?.zip || '',
          website: data.website || '',
          status: data.status === 'active' ? 'active' : data.status === 'inactive' ? 'inactive' : 'pending',
          commissionRate: data.commissionRate || 15,
          paymentTerms: data.paymentTerms || 'Net 30',
          notes: data.notes || '',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        setLoading(false)
      } catch (error) {
        console.error('Error fetching agency:', error)
        setErrors({ general: 'Failed to load agency details' })
        setLoading(false)
      }
    }
    
    fetchAgency()
  }, [agencyId])

  const handleChange = (field: keyof Agency, value: any) => {
    setAgency(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!agency.name.trim()) {
      newErrors.name = 'Agency name is required'
    }
    // Contact name is optional since it's not in the database
    // if (!agency.contactName.trim()) {
    //   newErrors.contactName = 'Contact name is required'
    // }
    if (agency.email && !/\S+@\S+\.\S+/.test(agency.email)) {
      newErrors.email = 'Invalid email format'
    }
    // Make phone optional as well
    // if (!agency.phone.trim()) {
    //   newErrors.phone = 'Phone number is required'
    // }
    if (agency.commissionRate < 0 || agency.commissionRate > 100) {
      newErrors.commissionRate = 'Commission rate must be between 0 and 100'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setSaving(true)
    try {
      // Prepare data for API
      const updateData = {
        name: agency.name,
        email: agency.email,
        phone: agency.phone,
        website: agency.website,
        address: {
          street: agency.address,
          city: agency.city,
          state: agency.state,
          zip: agency.zipCode,
          country: 'USA'
        }
      }

      // Send update to real API
      const response = await fetch(`/api/agencies/${agencyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        throw new Error('Failed to update agency')
      }

      const updatedAgency = await response.json()
      
      // Update local state with response
      setAgency(prev => ({
        ...prev,
        updatedAt: updatedAgency.updatedAt || new Date().toISOString()
      }))
      
      setSaving(false)
      setHasChanges(false)
      setShowSuccessAlert(true)
    } catch (error) {
      console.error('Error saving agency:', error)
      setErrors({ general: 'Failed to save agency' })
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        router.push('/agencies')
      }
    } else {
      router.push('/agencies')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Typography>Loading agency details...</Typography>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleCancel} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Edit Agency
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Update agency information and settings
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Cancel />}
            onClick={handleCancel}
            sx={{ mr: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>

        {/* Form Content */}
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Agency Name"
                      value={agency.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      error={!!errors.name}
                      helperText={errors.name}
                      required
                    />
                  </Grid>
                  
                  {/* Contact Name field removed - not in database schema */}
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={agency.status}
                        label="Status"
                        onChange={(e) => handleChange('status', e.target.value)}
                      >
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={agency.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      error={!!errors.email}
                      helperText={errors.email}
                      InputProps={{
                        startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} />,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      value={agency.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      error={!!errors.phone}
                      helperText={errors.phone}
                      InputProps={{
                        startAdornment: <Phone sx={{ mr: 1, color: 'action.active' }} />,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Website"
                      value={agency.website}
                      onChange={(e) => handleChange('website', e.target.value)}
                      placeholder="https://example.com"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Commission & Payment */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Commission & Payment
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Commission Rate (%)"
                      type="number"
                      value={agency.commissionRate}
                      onChange={(e) => handleChange('commissionRate', parseInt(e.target.value))}
                      error={!!errors.commissionRate}
                      helperText={errors.commissionRate}
                      inputProps={{ min: 0, max: 100 }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Payment Terms</InputLabel>
                      <Select
                        value={agency.paymentTerms}
                        label="Payment Terms"
                        onChange={(e) => handleChange('paymentTerms', e.target.value)}
                      >
                        <MenuItem value="Net 15">Net 15</MenuItem>
                        <MenuItem value="Net 30">Net 30</MenuItem>
                        <MenuItem value="Net 45">Net 45</MenuItem>
                        <MenuItem value="Net 60">Net 60</MenuItem>
                        <MenuItem value="Due on Receipt">Due on Receipt</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Agency Status
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Current Status
                    </Typography>
                    <Chip
                      label={agency.status}
                      color={agency.status === 'active' ? 'success' : agency.status === 'pending' ? 'warning' : 'default'}
                      size="small"
                    />
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Created
                    </Typography>
                    <Typography variant="body2">
                      {new Date(agency.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Last Updated
                    </Typography>
                    <Typography variant="body2">
                      {new Date(agency.updatedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Address Information */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <LocationOn sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Address Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Street Address"
                      value={agency.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="City"
                      value={agency.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="State"
                      value={agency.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="ZIP Code"
                      value={agency.zipCode}
                      onChange={(e) => handleChange('zipCode', e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Notes */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Additional Notes
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Notes"
                  value={agency.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Add any additional notes about this agency..."
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Success Alert */}
        <Snackbar
          open={showSuccessAlert}
          autoHideDuration={6000}
          onClose={() => setShowSuccessAlert(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setShowSuccessAlert(false)}
            severity="success"
            variant="filled"
          >
            Agency details updated successfully!
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  )
}