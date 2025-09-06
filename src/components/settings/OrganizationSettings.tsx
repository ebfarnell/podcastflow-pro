import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  TextField,
  Button,
  Box,
  Typography,
  Grid,
  Alert,
  Avatar,
  CircularProgress,
} from '@mui/material'
import { Business } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '@/services/api'
import { useOrganization } from '@/contexts/OrganizationContext'

export function OrganizationSettings() {
  const queryClient = useQueryClient()
  const { organization, refreshOrganization } = useOrganization()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    organizationName: '',
    website: '',
    industry: 'Media & Entertainment',
    size: '50-100',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    phone: '',
    taxId: '',
  })

  // Fetch organization data
  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: userApi.getOrganization,
  })

  // Update form data when org data loads
  useEffect(() => {
    if (orgData) {
      setFormData({
        organizationName: orgData.name || '',
        website: orgData.website || '',
        industry: orgData.industry || 'Media & Entertainment',
        size: orgData.size || '50-100',
        address: orgData.addressLine1 || orgData.contact?.address?.street || '',
        city: orgData.city || orgData.contact?.address?.city || '',
        state: orgData.state || orgData.contact?.address?.state || '',
        zip: orgData.postalCode || orgData.contact?.address?.zip || '',
        country: orgData.country || orgData.contact?.address?.country || 'United States',
        phone: orgData.phone || orgData.contact?.phone || '',
        taxId: orgData.taxId || '',
      })
    }
  }, [orgData])

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: (data: any) => userApi.updateOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] })
      setSuccess(true)
      setError(null)
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update organization')
      setSuccess(false)
    },
  })

  const handleSave = async () => {
    setError(null)
    // Send data directly matching database fields
    const apiData = {
      name: formData.organizationName,
      website: formData.website,
      industry: formData.industry,
      size: formData.size,
      taxId: formData.taxId,
      phone: formData.phone,
      addressLine1: formData.address,
      city: formData.city,
      state: formData.state,
      postalCode: formData.zip,
      country: formData.country
    }
    updateOrgMutation.mutate(apiData)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Organization Settings
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Manage your organization's information
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Organization settings updated successfully!
          </Alert>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <Avatar
            sx={{ width: 80, height: 80, mr: 3, bgcolor: 'primary.main' }}
          >
            <Business sx={{ fontSize: 40 }} />
          </Avatar>
          <Box>
            <Typography variant="h6">{formData.organizationName}</Typography>
            <Typography variant="body2" color="textSecondary">
              Organization ID: {orgData?.orgId || 'ORG-DEFAULT'}
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Organization Name"
              fullWidth
              value={formData.organizationName}
              onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Website"
              fullWidth
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Phone"
              fullWidth
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Tax ID / EIN"
              fullWidth
              value={formData.taxId}
              onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Industry"
              select
              fullWidth
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="Media & Entertainment">Media & Entertainment</option>
              <option value="Technology">Technology</option>
              <option value="Marketing & Advertising">Marketing & Advertising</option>
              <option value="Education">Education</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Finance">Finance</option>
              <option value="Retail">Retail</option>
              <option value="Other">Other</option>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Company Size"
              select
              fullWidth
              value={formData.size}
              onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="50-100">50-100 employees</option>
              <option value="100-500">100-500 employees</option>
              <option value="500+">500+ employees</option>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Billing Address
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Street Address"
              fullWidth
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="City"
              fullWidth
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="State/Province"
              fullWidth
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="ZIP/Postal Code"
              fullWidth
              value={formData.zip}
              onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Country"
              select
              fullWidth
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="United States">United States</option>
              <option value="Canada">Canada</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Australia">Australia</option>
              <option value="Germany">Germany</option>
              <option value="France">France</option>
              <option value="Other">Other</option>
            </TextField>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={updateOrgMutation.isPending}
          >
            {updateOrgMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button 
            variant="outlined"
            onClick={() => {
              if (orgData) {
                setFormData({
                  organizationName: orgData.organizationName || 'Unfy Media Group',
                  website: orgData.website || 'https://unfy.com',
                  industry: orgData.industry || 'Media & Entertainment',
                  size: orgData.size || '50-100',
                  address: orgData.address || '',
                  city: orgData.city || '',
                  state: orgData.state || '',
                  zip: orgData.zip || '',
                  country: orgData.country || 'United States',
                  phone: orgData.phone || '',
                  taxId: orgData.taxId || '',
                })
              }
            }}
          >
            Cancel
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}