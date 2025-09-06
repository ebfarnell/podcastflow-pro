'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControlLabel,
  Checkbox,
  Grid,
  Alert,
  Chip,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  TextField,
} from '@mui/material'
import {
  Save,
  Cancel,
  CheckCircle,
  Info,
  Add,
  Remove,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { masterApi } from '@/services/masterApi'
import { ORGANIZATION_FEATURES, PLAN_FEATURES } from '@/types/auth'

interface OrganizationFeatures {
  id: string
  name: string
  plan: string
  features: string[]
  limits: {
    users?: number
    campaigns?: number
    shows?: number
    storage?: number
  }
}

export default function OrganizationFeaturesPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [features, setFeatures] = useState<string[]>([])
  const [limits, setLimits] = useState<OrganizationFeatures['limits']>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Fetch organization details
  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization', params.id],
    queryFn: async () => {
      const data = await masterApi.organizations.get(params.id)
      return data as OrganizationFeatures
    },
  })

  // Update state when organization data changes
  useEffect(() => {
    if (organization) {
      setFeatures(organization.features || [])
      setLimits(organization.limits || {})
    }
  }, [organization])

  // Update features mutation
  const updateFeaturesMutation = useMutation({
    mutationFn: async (data: { features: string[]; limits: OrganizationFeatures['limits'] }) => {
      await masterApi.organizations.update(params.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', params.id] })
      setSaveSuccess(true)
      setHasChanges(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
  })

  const handleFeatureToggle = (feature: string) => {
    const newFeatures = features.includes(feature)
      ? features.filter(f => f !== feature)
      : [...features, feature]
    
    setFeatures(newFeatures)
    setHasChanges(true)
  }

  const handleLimitChange = (key: keyof OrganizationFeatures['limits'], value: string) => {
    const numValue = parseInt(value) || 0
    setLimits({ ...limits, [key]: numValue })
    setHasChanges(true)
  }

  const handleSave = () => {
    updateFeaturesMutation.mutate({ features, limits })
  }

  const handleCancel = () => {
    if (organization) {
      setFeatures(organization.features || [])
      setLimits(organization.limits || {})
      setHasChanges(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>Loading...</Box>
      </DashboardLayout>
    )
  }

  if (!organization) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>Organization not found</Box>
      </DashboardLayout>
    )
  }

  const planFeatures = PLAN_FEATURES[organization.plan] || []
  const customFeatures = features.filter(f => !planFeatures.includes(f))

  return (
    <DashboardLayout>
      <RoleGuard roles={['master']}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
                Manage Features
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {organization.name} • {organization.plan} Plan
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Cancel />}
                onClick={handleCancel}
                disabled={!hasChanges}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={!hasChanges || updateFeaturesMutation.isPending}
              >
                Save Changes
              </Button>
            </Box>
          </Box>

          {saveSuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Features and limits updated successfully!
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Features */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                    Platform Features
                  </Typography>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      Base features included in the {organization.plan} plan are shown with a chip.
                      You can add additional features beyond the plan.
                    </Typography>
                  </Alert>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <Grid container spacing={2}>
                    {Object.entries(ORGANIZATION_FEATURES).map(([key, feature]) => {
                      const isIncludedInPlan = planFeatures.includes(feature)
                      const isEnabled = features.includes(feature)
                      
                      return (
                        <Grid item xs={12} sm={6} key={key}>
                          <Paper variant="outlined" sx={{ p: 2 }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={isEnabled}
                                  onChange={() => handleFeatureToggle(feature)}
                                  color="primary"
                                />
                              }
                              label={
                                <Box>
                                  <Typography variant="body1">
                                    {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </Typography>
                                  {isIncludedInPlan && (
                                    <Chip 
                                      label="Plan Feature" 
                                      size="small" 
                                      color="primary" 
                                      sx={{ mt: 0.5 }}
                                    />
                                  )}
                                  {!isIncludedInPlan && isEnabled && (
                                    <Chip 
                                      label="Custom" 
                                      size="small" 
                                      color="secondary" 
                                      sx={{ mt: 0.5 }}
                                    />
                                  )}
                                </Box>
                              }
                            />
                          </Paper>
                        </Grid>
                      )
                    })}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Resource Limits */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                    Resource Limits
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Set maximum limits for this organization
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Maximum Users"
                      type="number"
                      value={limits.users || ''}
                      onChange={(e) => handleLimitChange('users', e.target.value)}
                      inputProps={{ min: 0 }}
                    />
                    <TextField
                      fullWidth
                      label="Maximum Campaigns"
                      type="number"
                      value={limits.campaigns || ''}
                      onChange={(e) => handleLimitChange('campaigns', e.target.value)}
                      inputProps={{ min: 0 }}
                    />
                    <TextField
                      fullWidth
                      label="Maximum Shows"
                      type="number"
                      value={limits.shows || ''}
                      onChange={(e) => handleLimitChange('shows', e.target.value)}
                      inputProps={{ min: 0 }}
                    />
                    <TextField
                      fullWidth
                      label="Storage Limit (GB)"
                      type="number"
                      value={limits.storage || ''}
                      onChange={(e) => handleLimitChange('storage', e.target.value)}
                      inputProps={{ min: 0 }}
                    />
                  </Box>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                    Current Configuration
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircle color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Subscription Plan"
                        secondary={`${organization?.plan || 'Loading...'} plan`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Info color="action" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Active Features"
                        secondary={`${features.length} of ${Object.keys(ORGANIZATION_FEATURES).length} features enabled`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Add color="secondary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="User Limit"
                        secondary={`${limits.users || 0} maximum users`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Add color="secondary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Shows Limit"
                        secondary={`${limits.shows || 0} maximum shows`}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </RoleGuard>
    </DashboardLayout>
  )
}