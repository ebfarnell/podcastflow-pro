'use client'

import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Chip,
  FormControlLabel,
  Checkbox,
  Grid,
  Alert,
  Divider,
} from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { masterApi } from '@/services/masterApi'
import { ORGANIZATION_FEATURES, PLAN_FEATURES } from '@/types/auth'

interface NewOrganization {
  name: string
  domain: string
  adminEmail: string
  adminName: string
  adminPhone?: string
  plan: 'starter' | 'professional' | 'enterprise'
  billingAmount: number
  customFeatures: string[]
  limits: {
    users: number
    campaigns: number
    shows: number
    storage: number
  }
}

export default function NewOrganizationPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<NewOrganization>({
    name: '',
    domain: '',
    adminEmail: '',
    adminName: '',
    adminPhone: '',
    plan: 'professional',
    billingAmount: 299,
    customFeatures: [],
    limits: {
      users: 50,
      campaigns: 100,
      shows: 20,
      storage: 1000,
    },
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const createOrgMutation = useMutation({
    mutationFn: async (data: NewOrganization) => {
      // Create organization using the correct endpoint
      const response = await fetch('/api/master/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data)
      })
      if (!response.ok) {
        throw new Error('Failed to create organization')
      }
      return response.json()
    },
    onSuccess: (data) => {
      setSuccess(true)
      // Invalidate organizations query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      setTimeout(() => {
        router.push('/master/organizations')
      }, 2000)
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Failed to create organization')
    },
  })

  const handleChange = (field: keyof NewOrganization) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({ ...formData, [field]: event.target.value })
  }

  const handlePlanChange = (event: SelectChangeEvent) => {
    const newPlan = event.target.value as NewOrganization['plan']
    const defaultPrices = {
      starter: 99,
      professional: 299,
      enterprise: 999
    }
    setFormData({
      ...formData,
      plan: newPlan,
      billingAmount: defaultPrices[newPlan],
      customFeatures: [], // Reset custom features when plan changes
    })
  }

  const handleLimitChange = (limit: keyof NewOrganization['limits']) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({
      ...formData,
      limits: {
        ...formData.limits,
        [limit]: parseInt(event.target.value) || 0,
      },
    })
  }

  const handleFeatureToggle = (feature: string) => {
    const currentFeatures = formData.customFeatures
    const newFeatures = currentFeatures.includes(feature)
      ? currentFeatures.filter(f => f !== feature)
      : [...currentFeatures, feature]
    
    setFormData({ ...formData, customFeatures: newFeatures })
  }

  const getPlanFeatures = () => {
    const baseFeatures = PLAN_FEATURES[formData.plan] || []
    return [...new Set([...baseFeatures, ...formData.customFeatures])]
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    createOrgMutation.mutate(formData)
  }

  return (
    <DashboardLayout>
      <RoleGuard roles={['master']}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
              Invite New Organization
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Set up a new organization and invite their administrator
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Organization created successfully! Invitation sent to admin.
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Organization Details */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Organization Details
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
                        label="Domain (optional)"
                        value={formData.domain}
                        onChange={handleChange('domain')}
                        placeholder="company.com"
                        helperText="Used for SSO and email verification"
                      />
                      <FormControl fullWidth required>
                        <InputLabel>Plan</InputLabel>
                        <Select
                          value={formData.plan}
                          onChange={handlePlanChange}
                          label="Plan"
                        >
                          <MenuItem value="starter">Starter</MenuItem>
                          <MenuItem value="professional">Professional</MenuItem>
                          <MenuItem value="enterprise">Enterprise</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        fullWidth
                        label="Monthly Billing Amount"
                        type="number"
                        value={formData.billingAmount}
                        onChange={(e) => setFormData({ ...formData, billingAmount: parseInt(e.target.value) || 0 })}
                        required
                        InputProps={{
                          startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                        }}
                        helperText="The monthly subscription fee this organization will pay"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Admin Details */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Administrator Details
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        fullWidth
                        label="Admin Name"
                        value={formData.adminName}
                        onChange={handleChange('adminName')}
                        required
                      />
                      <TextField
                        fullWidth
                        label="Admin Email"
                        type="email"
                        value={formData.adminEmail}
                        onChange={handleChange('adminEmail')}
                        required
                        helperText="Invitation will be sent to this email"
                      />
                      <TextField
                        fullWidth
                        label="Admin Phone (optional)"
                        value={formData.adminPhone}
                        onChange={handleChange('adminPhone')}
                        placeholder="+1 (555) 123-4567"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Resource Limits */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Resource Limits
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        fullWidth
                        label="Maximum Users"
                        type="number"
                        value={formData.limits.users}
                        onChange={handleLimitChange('users')}
                        required
                      />
                      <TextField
                        fullWidth
                        label="Maximum Campaigns"
                        type="number"
                        value={formData.limits.campaigns}
                        onChange={handleLimitChange('campaigns')}
                        required
                      />
                      <TextField
                        fullWidth
                        label="Maximum Shows"
                        type="number"
                        value={formData.limits.shows}
                        onChange={handleLimitChange('shows')}
                        required
                      />
                      <TextField
                        fullWidth
                        label="Storage (GB)"
                        type="number"
                        value={formData.limits.storage}
                        onChange={handleLimitChange('storage')}
                        required
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Features */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Features
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Base features for {formData.plan} plan are automatically included
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {Object.entries(ORGANIZATION_FEATURES).map(([key, feature]) => {
                        const isIncludedInPlan = PLAN_FEATURES[formData.plan]?.includes(feature)
                        const isSelected = formData.customFeatures.includes(feature)
                        const isActive = isIncludedInPlan || isSelected
                        
                        return (
                          <FormControlLabel
                            key={key}
                            control={
                              <Checkbox
                                checked={isActive}
                                onChange={() => handleFeatureToggle(feature)}
                                disabled={isIncludedInPlan}
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2">
                                  {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Typography>
                                {isIncludedInPlan && (
                                  <Chip label="Included" size="small" color="primary" />
                                )}
                              </Box>
                            }
                          />
                        )
                      })}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Actions */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={() => router.push('/master/organizations')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={createOrgMutation.isPending}
                  >
                    {createOrgMutation.isPending ? 'Creating...' : 'Create & Send Invitation'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Box>
      </RoleGuard>
    </DashboardLayout>
  )
}