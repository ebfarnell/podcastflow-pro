'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Alert,
  Divider,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { masterApi } from '@/services/masterApi'
import { Business, ArrowBack, Delete as DeleteIcon } from '@mui/icons-material'

export default function OrganizationDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const organizationId = params.id as string
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    status: 'active' as 'active' | 'trial' | 'suspended',
    plan: 'starter' as 'starter' | 'professional' | 'enterprise',
    billingAmount: 0,
    customFeatures: {
      usersLimit: 0,
      campaignsLimit: 0,
      showsLimit: 0,
      storageLimit: 0,
    },
  })

  // Fetch organization details
  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: async () => {
      const response = await masterApi.organizations.get(organizationId)
      return response
    },
    enabled: !!organizationId,
  })

  // Update form data when organization data is loaded
  useEffect(() => {
    if (organization) {
      console.log('Organization data loaded:', {
        billingAmount: organization.billingAmount,
        monthlyRevenue: organization.monthlyRevenue,
        limits: organization.limits
      })
      setFormData({
        name: organization.name || '',
        slug: organization.slug || '',
        status: organization.status || 'active',
        plan: organization.plan || 'starter',
        billingAmount: organization.billingAmount || organization.monthlyRevenue || 0,
        customFeatures: {
          usersLimit: organization.limits?.users || 0,
          campaignsLimit: organization.limits?.campaigns || 0,
          showsLimit: organization.limits?.shows || 0,
          storageLimit: organization.limits?.storage || 0,
        },
      })
    }
  }, [organization])

  // Update organization
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      console.log('Updating organization with form data:', {
        billingAmount: data.billingAmount,
        limits: data.customFeatures
      })
      
      // Prepare the update data with custom billing
      const updateData = {
        name: data.name,
        slug: data.slug,
        status: data.status,
        plan: data.plan,
        limits: data.customFeatures,
        features: organization?.features || [],
      }
      
      // First update the organization details
      const response = await masterApi.organizations.update(organizationId, updateData)
      
      // Always update the billing amount
      console.log('Updating billing amount to:', data.billingAmount)
      await fetch(`/api/master/organizations/${organizationId}/billing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ billingAmount: data.billingAmount }),
      })
      
      return response
    },
    onSuccess: () => {
      setSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to update organization')
    },
  })

  // Delete organization
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/master/organizations/${organizationId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete organization')
      }
      return response.json()
    },
    onSuccess: () => {
      router.push('/master/organizations')
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to delete organization')
      setDeleteDialog(false)
    },
  })

  const handleChange = (field: keyof typeof formData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({ ...formData, [field]: event.target.value })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    updateMutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <RoleGuard roles={['master']}>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography>Loading organization details...</Typography>
          </Box>
        </RoleGuard>
      </DashboardLayout>
    )
  }

  if (!organization) {
    return (
      <DashboardLayout>
        <RoleGuard roles={['master']}>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="error">Organization not found</Typography>
            <Button onClick={() => router.push('/master/organizations')} sx={{ mt: 2 }}>
              Back to Organizations
            </Button>
          </Box>
        </RoleGuard>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <RoleGuard roles={['master']}>
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/master/organizations')}
              sx={{ mb: 2 }}
            >
              Back to Organizations
            </Button>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                <Business sx={{ fontSize: 32 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
                  {organization.name}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Organization Details
                </Typography>
              </Box>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Organization updated successfully!
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Basic Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        fullWidth
                        label="Organization Name"
                        value={formData.name}
                        onChange={handleChange('name')}
                        required
                      />
                      <TextField
                        fullWidth
                        label="Slug"
                        value={formData.slug}
                        onChange={handleChange('slug')}
                        helperText="Used in URLs and API references"
                        required
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Status and Plan */}
              <Grid item xs={12} sm={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Status
                    </Typography>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        label="Status"
                      >
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="trial">Trial</MenuItem>
                        <MenuItem value="suspended">Suspended</MenuItem>
                      </Select>
                    </FormControl>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Plan
                    </Typography>
                    <FormControl fullWidth>
                      <InputLabel>Plan</InputLabel>
                      <Select
                        value={formData.plan}
                        onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
                        label="Plan"
                      >
                        <MenuItem value="starter">Starter</MenuItem>
                        <MenuItem value="professional">Professional</MenuItem>
                        <MenuItem value="enterprise">Enterprise</MenuItem>
                      </Select>
                    </FormControl>
                  </CardContent>
                </Card>
              </Grid>

              {/* Custom Billing Section */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Custom Billing & Limits
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Set custom pricing and resource limits for this organization
                    </Typography>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Monthly Billing Amount"
                          type="number"
                          value={formData.billingAmount}
                          onChange={(e) => setFormData({ ...formData, billingAmount: parseFloat(e.target.value) || 0 })}
                          InputProps={{
                            startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                          }}
                          helperText="Custom monthly charge for this organization"
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1" gutterBottom sx={{ color: 'text.primary' }}>
                          Resource Limits
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth
                          label="Users Limit"
                          type="number"
                          value={formData.customFeatures.usersLimit}
                          onChange={(e) => setFormData({
                            ...formData,
                            customFeatures: {
                              ...formData.customFeatures,
                              usersLimit: parseInt(e.target.value) || 0
                            }
                          })}
                          helperText="Max users"
                        />
                      </Grid>
                      
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth
                          label="Campaigns Limit"
                          type="number"
                          value={formData.customFeatures.campaignsLimit}
                          onChange={(e) => setFormData({
                            ...formData,
                            customFeatures: {
                              ...formData.customFeatures,
                              campaignsLimit: parseInt(e.target.value) || 0
                            }
                          })}
                          helperText="Max campaigns"
                        />
                      </Grid>
                      
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth
                          label="Shows Limit"
                          type="number"
                          value={formData.customFeatures.showsLimit}
                          onChange={(e) => setFormData({
                            ...formData,
                            customFeatures: {
                              ...formData.customFeatures,
                              showsLimit: parseInt(e.target.value) || 0
                            }
                          })}
                          helperText="Max shows"
                        />
                      </Grid>
                      
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth
                          label="Storage Limit (GB)"
                          type="number"
                          value={formData.customFeatures.storageLimit}
                          onChange={(e) => setFormData({
                            ...formData,
                            customFeatures: {
                              ...formData.customFeatures,
                              storageLimit: parseInt(e.target.value) || 0
                            }
                          })}
                          helperText="Storage in GB"
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Organization Stats */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Statistics
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" sx={{ color: 'primary.main' }}>
                            {organization.activeUsers || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Active Users
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" sx={{ color: 'success.main' }}>
                            {organization.usage?.campaigns || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Campaigns
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" sx={{ color: 'info.main' }}>
                            {organization.usage?.storageGB || 0}GB
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Storage Used
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" sx={{ color: 'warning.main' }}>
                            ${organization.monthlyRevenue || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Monthly Revenue
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Actions */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteDialog(true)}
                  >
                    Delete Organization
                  </Button>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => router.push('/master/organizations')}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? 'Updating...' : 'Update Organization'}
                    </Button>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </form>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogContent>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Are you sure you want to delete <strong>{organization.name}</strong>?
              </Typography>
              <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                This action cannot be undone. This will permanently delete:
              </Typography>
              <ul>
                <li>The organization and all its settings</li>
                <li>All {organization.activeUsers || 0} users associated with this organization</li>
                <li>All {organization.usage?.campaigns || 0} campaigns</li>
                <li>All data and analytics</li>
              </ul>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Type the organization name to confirm: <strong>{organization.name}</strong>
              </Typography>
              <TextField
                fullWidth
                margin="normal"
                placeholder="Organization name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setDeleteDialog(false)
                setConfirmName('')
              }}>
                Cancel
              </Button>
              <Button
                onClick={() => deleteMutation.mutate()}
                variant="contained"
                color="error"
                disabled={confirmName !== organization?.name || deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Organization'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </RoleGuard>
    </DashboardLayout>
  )
}