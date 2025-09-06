'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  FormControlLabel,
  Switch,
  Paper,
  Divider
} from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { 
  ArrowBack, 
  Save, 
  Preview, 
  ContentCopy,
  Campaign,
  Schedule,
  CheckCircle
} from '@mui/icons-material'

interface AdCopy {
  id: string
  campaignId: string
  title: string
  content: string
  type: 'host_read' | 'pre_produced' | 'programmatic'
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'active'
  duration?: number
  instructions?: string
  callToAction?: string
  targetUrl?: string
  keywords?: string[]
  version: number
  createdAt: string
  updatedAt: string
  approvedAt?: string
  rejectedReason?: string
}

export default function EditAdCopyPage() {
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const adCopyId = params.id as string

  const [formData, setFormData] = useState<Partial<AdCopy>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wordCount, setWordCount] = useState(0)

  // Fetch ad copy data
  const { data: adCopy, isLoading } = useQuery({
    queryKey: ['adCopy', adCopyId],
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/ad-copy/${adCopyId}`)
      if (!response.ok) throw new Error('Failed to fetch ad copy')
      return response.json()
    },
    onSuccess: (data) => {
      setFormData(data)
      setWordCount(data.content ? data.content.split(' ').length : 0)
    }
  })

  // Fetch campaigns for dropdown
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns')
      if (!response.ok) throw new Error('Failed to fetch campaigns')
      const data = await response.json()
      return data.campaigns || []
    }
  })

  // Update ad copy mutation
  const updateAdCopyMutation = useMutation({
    mutationFn: async (data: Partial<AdCopy>) => {
      const response = await fetch(`/api/ad-copy/${adCopyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to update ad copy')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adCopy'] })
      router.push('/ad-copy')
    },
    onError: (error: any) => {
      console.error('Failed to update ad copy:', error)
    }
  })

  const handleInputChange = (field: keyof AdCopy, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Update word count for content changes
    if (field === 'content') {
      setWordCount(value ? value.split(' ').filter(Boolean).length : 0)
    }
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleKeywordsChange = (value: string) => {
    const keywords = value.split(',').map(k => k.trim()).filter(Boolean)
    handleInputChange('keywords', keywords)
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required'
    }
    if (!formData.content?.trim()) {
      newErrors.content = 'Content is required'
    }
    if (!formData.campaignId) {
      newErrors.campaignId = 'Campaign is required'
    }
    if (!formData.type) {
      newErrors.type = 'Ad type is required'
    }
    if (formData.type === 'host_read' && wordCount > 150) {
      newErrors.content = 'Host-read ads should be 150 words or less'
    }
    if (formData.type === 'pre_produced' && (!formData.duration || formData.duration <= 0)) {
      newErrors.duration = 'Duration is required for pre-produced ads'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validateForm()) return
    updateAdCopyMutation.mutate(formData)
  }

  const handleSaveAndSubmitForReview = () => {
    if (!validateForm()) return
    updateAdCopyMutation.mutate({
      ...formData,
      status: 'pending_review'
    })
  }

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'default',
      pending_review: 'warning',
      approved: 'success',
      rejected: 'error',
      active: 'primary'
    }
    return colors[status as keyof typeof colors] || 'default'
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Typography>Loading ad copy...</Typography>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <RoleGuard allowedRoles={['master', 'admin', 'sales', 'producer']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.back()}
              variant="outlined"
            >
              Back
            </Button>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" component="h1">
                Edit Ad Copy
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                <Chip 
                  label={formData.status?.replace('_', ' ').toUpperCase()}
                  color={getStatusColor(formData.status || 'draft') as any}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  Version {formData.version} • Last updated {formData.updatedAt ? new Date(formData.updatedAt).toLocaleDateString() : 'Never'}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Grid container spacing={3}>
            {/* Main Form */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Ad Copy Details
                  </Typography>

                  <Grid container spacing={3}>
                    {/* Title */}
                    <Grid item xs={12}>
                      <TextField
                        label="Title"
                        fullWidth
                        required
                        value={formData.title || ''}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        error={!!errors.title}
                        helperText={errors.title}
                        placeholder="Enter ad copy title"
                      />
                    </Grid>

                    {/* Campaign */}
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth required error={!!errors.campaignId}>
                        <InputLabel>Campaign</InputLabel>
                        <Select
                          value={formData.campaignId || ''}
                          onChange={(e) => handleInputChange('campaignId', e.target.value)}
                          label="Campaign"
                        >
                          {campaigns.map((campaign: any) => (
                            <MenuItem key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.campaignId && (
                          <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                            {errors.campaignId}
                          </Typography>
                        )}
                      </FormControl>
                    </Grid>

                    {/* Type */}
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth required error={!!errors.type}>
                        <InputLabel>Ad Type</InputLabel>
                        <Select
                          value={formData.type || ''}
                          onChange={(e) => handleInputChange('type', e.target.value)}
                          label="Ad Type"
                        >
                          <MenuItem value="host_read">Host Read</MenuItem>
                          <MenuItem value="pre_produced">Pre-Produced</MenuItem>
                          <MenuItem value="programmatic">Programmatic</MenuItem>
                        </Select>
                        {errors.type && (
                          <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                            {errors.type}
                          </Typography>
                        )}
                      </FormControl>
                    </Grid>

                    {/* Duration (for pre-produced) */}
                    {formData.type === 'pre_produced' && (
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Duration (seconds)"
                          type="number"
                          fullWidth
                          required
                          value={formData.duration || ''}
                          onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                          error={!!errors.duration}
                          helperText={errors.duration}
                          placeholder="30"
                        />
                      </Grid>
                    )}

                    {/* Content */}
                    <Grid item xs={12}>
                      <TextField
                        label="Ad Copy Content"
                        fullWidth
                        required
                        multiline
                        rows={8}
                        value={formData.content || ''}
                        onChange={(e) => handleInputChange('content', e.target.value)}
                        error={!!errors.content}
                        helperText={errors.content || `${wordCount} words`}
                        placeholder="Enter the ad copy content here..."
                      />
                    </Grid>

                    {/* Call to Action */}
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Call to Action"
                        fullWidth
                        value={formData.callToAction || ''}
                        onChange={(e) => handleInputChange('callToAction', e.target.value)}
                        placeholder="Visit our website today!"
                      />
                    </Grid>

                    {/* Target URL */}
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Target URL"
                        fullWidth
                        value={formData.targetUrl || ''}
                        onChange={(e) => handleInputChange('targetUrl', e.target.value)}
                        placeholder="https://example.com"
                      />
                    </Grid>

                    {/* Keywords */}
                    <Grid item xs={12}>
                      <TextField
                        label="Keywords"
                        fullWidth
                        value={formData.keywords?.join(', ') || ''}
                        onChange={(e) => handleKeywordsChange(e.target.value)}
                        placeholder="keyword1, keyword2, keyword3"
                        helperText="Separate keywords with commas"
                      />
                    </Grid>

                    {/* Instructions */}
                    <Grid item xs={12}>
                      <TextField
                        label="Special Instructions"
                        fullWidth
                        multiline
                        rows={3}
                        value={formData.instructions || ''}
                        onChange={(e) => handleInputChange('instructions', e.target.value)}
                        placeholder="Any special instructions for the host or production team"
                      />
                    </Grid>
                  </Grid>

                  {/* Error Display */}
                  {updateAdCopyMutation.isError && (
                    <Alert severity="error" sx={{ mt: 3 }}>
                      Failed to update ad copy. Please try again.
                    </Alert>
                  )}

                  {/* Action Buttons */}
                  <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      onClick={() => router.back()}
                      disabled={updateAdCopyMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Save />}
                      onClick={handleSave}
                      disabled={updateAdCopyMutation.isPending}
                    >
                      Save Draft
                    </Button>
                    {formData.status === 'draft' && (
                      <Button
                        variant="contained"
                        startIcon={<CheckCircle />}
                        onClick={handleSaveAndSubmitForReview}
                        disabled={updateAdCopyMutation.isPending}
                      >
                        Submit for Review
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Sidebar */}
            <Grid item xs={12} md={4}>
              {/* Preview */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Preview />
                    Preview
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {formData.title || 'Untitled Ad Copy'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {formData.content || 'No content yet...'}
                    </Typography>
                    {formData.callToAction && (
                      <Box sx={{ mt: 2, p: 1, bgcolor: 'primary.light', borderRadius: 1 }}>
                        <Typography variant="body2" color="white" fontWeight="bold">
                          {formData.callToAction}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </CardContent>
              </Card>

              {/* Guidelines */}
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Guidelines
                  </Typography>
                  <Box sx={{ space: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Host Read:</strong> Keep under 150 words for natural delivery
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Pre-Produced:</strong> Include exact duration and technical specs
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Programmatic:</strong> Focus on clear, concise messaging
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Always include a clear call-to-action and ensure content aligns with campaign objectives.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </DashboardLayout>
    </RoleGuard>
  )
}