'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  FormControlLabel,
  Checkbox,
  Snackbar,
  Alert,
} from '@mui/material'
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils/currency'

interface BillingPlan {
  id: string
  name: string
  monthlyPrice: number
  yearlyPrice?: number
  usersLimit: number
  campaignsLimit: number
  showsLimit: number
  storageLimit: number
  features: string[]
  isActive: boolean
}

const AVAILABLE_FEATURES = [
  { key: 'Advanced Analytics', label: 'Advanced Analytics' },
  { key: 'Priority Support', label: 'Priority Support' },
  { key: 'Custom Templates', label: 'Custom Templates' },
  { key: 'API Access', label: 'API Access' },
  { key: 'SSO', label: 'SSO' },
  { key: 'Audit Logs', label: 'Audit Logs' },
  { key: 'Backups', label: 'Backups' },
  { key: 'Webhooks', label: 'Webhooks' },
  { key: 'Integrations', label: 'Integrations' },
  { key: 'Campaigns', label: 'Campaigns' },
  { key: 'Shows', label: 'Shows' },
  { key: 'Episodes', label: 'Episodes' },
  { key: 'Ad Approvals', label: 'Ad Approvals' },
  { key: 'Analytics', label: 'Analytics' },
  { key: 'Billing', label: 'Billing' },
]

export function PlansManagementTab() {
  const queryClient = useQueryClient()
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [editedPlans, setEditedPlans] = useState<Record<string, BillingPlan>>({})
  const [featureDialog, setFeatureDialog] = useState<{ open: boolean; planId: string | null }>({ open: false, planId: null })
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Fetch billing plans
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const response = await fetch('/api/master/billing/plans', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch plans')
      return response.json()
    },
  })

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async (plan: BillingPlan) => {
      const response = await fetch(`/api/master/billing/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(plan),
      })
      if (!response.ok) throw new Error('Failed to update plan')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] })
      setSuccess(true)
      setEditingPlan(null)
      setEditedPlans({})
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to update plan')
    },
  })

  const handleEdit = (planId: string) => {
    const plan = plans.find((p: BillingPlan) => p.id === planId)
    if (plan) {
      setEditingPlan(planId)
      setEditedPlans({ [planId]: plan })
    }
  }

  const handleCancel = (planId: string) => {
    setEditingPlan(null)
    const newEdited = { ...editedPlans }
    delete newEdited[planId]
    setEditedPlans(newEdited)
  }

  const handleSave = (planId: string) => {
    const plan = editedPlans[planId]
    if (plan) {
      updatePlanMutation.mutate(plan)
    }
  }

  const handleFieldChange = (planId: string, field: keyof BillingPlan, value: any) => {
    setEditedPlans(prev => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [field]: value,
      },
    }))
  }

  const handleFeatureToggle = (planId: string, feature: string) => {
    const plan = editedPlans[planId] || plans.find((p: BillingPlan) => p.id === planId)
    if (!plan) return

    const currentFeatures = Array.isArray(plan.features) ? plan.features : []
    const newFeatures = currentFeatures.includes(feature)
      ? currentFeatures.filter(f => f !== feature)
      : [...currentFeatures, feature]

    setEditedPlans(prev => ({
      ...prev,
      [planId]: {
        ...plan,
        features: newFeatures,
      },
    }))
  }

  const getPlanColor = (plan: string) => {
    const planLower = plan.toLowerCase()
    if (planLower === 'starter') return 'primary'
    if (planLower === 'professional') return 'secondary'
    if (planLower === 'enterprise') return 'error'
    return 'default'
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <Typography>Loading plans...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Default Plan Pricing & Features
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Plan Name</TableCell>
              <TableCell align="right">Monthly Price</TableCell>
              <TableCell align="right">Users Limit</TableCell>
              <TableCell align="right">Campaigns Limit</TableCell>
              <TableCell align="right">Shows Limit</TableCell>
              <TableCell align="right">Storage (GB)</TableCell>
              <TableCell>Features</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans
              .filter((plan: BillingPlan) => !plan.name.includes('_custom_'))
              .map((plan: BillingPlan) => {
                const isEditing = editingPlan === plan.id
                const currentPlan = isEditing && editedPlans[plan.id] ? editedPlans[plan.id] : plan
                
                return (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <Chip
                        label={plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                        color={getPlanColor(plan.name) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <TextField
                          type="number"
                          value={currentPlan.monthlyPrice}
                          onChange={(e) => handleFieldChange(plan.id, 'monthlyPrice', parseFloat(e.target.value) || 0)}
                          size="small"
                          sx={{ width: 100 }}
                          InputProps={{
                            startAdornment: '$',
                          }}
                        />
                      ) : (
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(plan.monthlyPrice)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <TextField
                          type="number"
                          value={currentPlan.usersLimit}
                          onChange={(e) => handleFieldChange(plan.id, 'usersLimit', parseInt(e.target.value) || 0)}
                          size="small"
                          sx={{ width: 80 }}
                        />
                      ) : (
                        plan.usersLimit
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <TextField
                          type="number"
                          value={currentPlan.campaignsLimit}
                          onChange={(e) => handleFieldChange(plan.id, 'campaignsLimit', parseInt(e.target.value) || 0)}
                          size="small"
                          sx={{ width: 80 }}
                        />
                      ) : (
                        plan.campaignsLimit
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <TextField
                          type="number"
                          value={currentPlan.showsLimit}
                          onChange={(e) => handleFieldChange(plan.id, 'showsLimit', parseInt(e.target.value) || 0)}
                          size="small"
                          sx={{ width: 80 }}
                        />
                      ) : (
                        plan.showsLimit
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <TextField
                          type="number"
                          value={currentPlan.storageLimit}
                          onChange={(e) => handleFieldChange(plan.id, 'storageLimit', parseInt(e.target.value) || 0)}
                          size="small"
                          sx={{ width: 80 }}
                        />
                      ) : (
                        plan.storageLimit
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                        {currentPlan.features?.slice(0, 3).map((feature: string) => (
                          <Chip
                            key={feature}
                            label={AVAILABLE_FEATURES.find(f => f.key === feature)?.label || feature}
                            size="small"
                            sx={{ fontSize: '0.75rem' }}
                          />
                        ))}
                        {currentPlan.features?.length > 3 && (
                          <Typography variant="caption" color="text.secondary">
                            +{currentPlan.features.length - 3} more
                          </Typography>
                        )}
                        {isEditing && (
                          <Button
                            size="small"
                            onClick={() => setFeatureDialog({ open: true, planId: plan.id })}
                            sx={{ ml: 1 }}
                          >
                            Edit Features
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {isEditing ? (
                        <>
                          <IconButton
                            color="success"
                            onClick={() => handleSave(plan.id)}
                            disabled={updatePlanMutation.isPending}
                          >
                            <SaveIcon />
                          </IconButton>
                          <IconButton
                            color="error"
                            onClick={() => handleCancel(plan.id)}
                            disabled={updatePlanMutation.isPending}
                          >
                            <CancelIcon />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton
                          color="primary"
                          onClick={() => handleEdit(plan.id)}
                        >
                          <EditIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Feature Selection Dialog */}
      <Dialog
        open={featureDialog.open}
        onClose={() => setFeatureDialog({ open: false, planId: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Features</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
            {AVAILABLE_FEATURES.map(feature => {
              const plan = featureDialog.planId 
                ? (editedPlans[featureDialog.planId] || plans.find((p: BillingPlan) => p.id === featureDialog.planId))
                : null
              const isChecked = plan?.features?.includes(feature.key) || false

              return (
                <FormControlLabel
                  key={feature.key}
                  control={
                    <Checkbox
                      checked={isChecked}
                      onChange={() => featureDialog.planId && handleFeatureToggle(featureDialog.planId, feature.key)}
                    />
                  }
                  label={feature.label}
                />
              )
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeatureDialog({ open: false, planId: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={() => setSuccess(false)}
      >
        <Alert onClose={() => setSuccess(false)} severity="success">
          Plan updated successfully!
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  )
}