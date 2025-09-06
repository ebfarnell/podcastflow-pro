'use client'

import React, { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
  Chip,
  IconButton,
  Alert,
  FormControlLabel,
  Checkbox,
  Switch,
  InputAdornment,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { approvalsApi, advertiserApi, campaignApi } from '@/services/api'
import { showsApi } from '@/services/showsApi'

interface AdSubmissionFormData {
  // Basic Information
  title: string
  advertiser: string
  campaign: string
  shows: string[]
  
  // Ad Details
  adType: 'host-read' | 'pre-produced' | 'programmatic'
  durations: number[]  // Changed to array for multiple selections
  script: string
  talkingPoints: string[]
  
  // Targeting
  targetEpisodes: string[]
  airDates: {
    start: Date | null
    end: Date | null
  }
  
  // Creative Assets
  audioFile?: File
  brandGuidelines?: File
  additionalNotes: string
  
  // Compliance
  legalDisclaimer: string
  restrictedTerms: string[]
  requiresApproval: boolean
  
  // Urgency
  priority: 'low' | 'medium' | 'high' | 'urgent'
  deadline: Date | null
}

export default function AdSubmissionForm({ onClose }: { onClose?: () => void }) {
  const router = useRouter()
  const [formData, setFormData] = useState<AdSubmissionFormData>({
    title: '',
    advertiser: '',
    campaign: '',
    shows: [],
    adType: 'host-read',
    durations: [],  // Changed to empty array
    script: '',
    talkingPoints: [''],
    targetEpisodes: [],
    airDates: {
      start: null,
      end: null,
    },
    additionalNotes: '',
    legalDisclaimer: '',
    restrictedTerms: [],
    requiresApproval: true,
    priority: 'medium',
    deadline: null,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newTalkingPoint, setNewTalkingPoint] = useState('')
  const [newRestrictedTerm, setNewRestrictedTerm] = useState('')
  const [showSelectionDialog, setShowSelectionDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCustomDuration, setShowCustomDuration] = useState(false)
  const [customDuration, setCustomDuration] = useState('')

  // Fetch data for dropdowns
  const { data: shows = [] } = useQuery({
    queryKey: ['shows'],
    queryFn: async () => {
      const response = await showsApi.getShows()
      console.log('Loaded shows:', response.shows.map(s => ({ id: s.id, name: s.name })))
      return response.shows
    },
  })

  const { data: advertisers = [] } = useQuery({
    queryKey: ['advertisers'],
    queryFn: async () => {
      const response = await advertiserApi.list()
      return response
    },
  })

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', formData.advertiser],
    queryFn: async () => {
      if (!formData.advertiser) return []
      const response = await campaignApi.list({ advertiserId: formData.advertiser })
      return response.Items || response.campaigns || []
    },
    enabled: !!formData.advertiser,
  })

  const submitMutation = useMutation({
    mutationFn: async (data: AdSubmissionFormData) => {
      // Get names for display
      const selectedAdvertiser = advertisers.find((a: any) => a.id === data.advertiser)
      const selectedCampaign = campaigns.find((c: any) => c.id === data.campaign)
      
      // Create submissions for each show with assignment information
      const showSubmissions = data.shows.map((showId: string) => {
        const selectedShow = shows.find((s: any) => s.id === showId)
        return {
          showId,
          showName: selectedShow?.name || showId,
          assignedProducers: selectedShow?.assignedProducers || [],
          assignedTalent: selectedShow?.assignedTalent || [],
          producerNames: selectedShow?.producerNames || [],
          talentNames: selectedShow?.talentNames || []
        }
      })
      
      // Transform data to match API format
      const submission = {
        title: data.title,
        advertiserId: data.advertiser,
        advertiserName: selectedAdvertiser?.name || data.advertiser,
        campaignId: data.campaign,
        campaignName: selectedCampaign?.name || data.title,
        showIds: data.shows,
        showSubmissions: showSubmissions,  // Include show details
        durations: data.durations,  // Send array of durations
        type: data.adType,
        script: data.script,
        talkingPoints: data.talkingPoints.filter(tp => tp.trim()),
        targetEpisodes: data.targetEpisodes,
        startDate: data.airDates.start?.toISOString(),
        endDate: data.airDates.end?.toISOString(),
        notes: data.additionalNotes,
        legalDisclaimer: data.legalDisclaimer,
        restrictedTerms: data.restrictedTerms,
        priority: data.priority,
        deadline: data.deadline?.toISOString(),
        status: 'pending_review',
        submittedBy: 'current-user', // This should come from auth context
        submittedAt: new Date().toISOString(),
      }
      
      console.log('📤 Submitting ad approval:', submission)
      return approvalsApi.create(submission).then(response => {
        console.log('✅ Ad approval submission response:', response)
        return response
      })
    },
    onSuccess: () => {
      router.push('/post-sale?tab=creative&view=approvals')
      onClose?.()
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to submit ad for approval' })
    },
  })

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.title.trim()) newErrors.title = 'Title is required'
    if (!formData.advertiser.trim()) newErrors.advertiser = 'Advertiser is required'
    if (!formData.campaign.trim()) newErrors.campaign = 'Campaign is required'
    if (!formData.shows || formData.shows.length === 0) newErrors.shows = 'At least one show is required'
    if (!formData.durations || formData.durations.length === 0) newErrors.durations = 'At least one duration is required'
    if (!formData.script.trim() && formData.adType === 'host-read') {
      newErrors.script = 'Script is required for host-read ads'
    }
    if (formData.talkingPoints.filter(tp => tp.trim()).length === 0 && formData.adType === 'host-read') {
      newErrors.talkingPoints = 'At least one talking point is required'
    }
    if (!formData.deadline) newErrors.deadline = 'Deadline is required'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      submitMutation.mutate(formData)
    }
  }

  const addTalkingPoint = () => {
    if (newTalkingPoint.trim()) {
      setFormData({
        ...formData,
        talkingPoints: [...formData.talkingPoints, newTalkingPoint.trim()],
      })
      setNewTalkingPoint('')
    }
  }

  const removeTalkingPoint = (index: number) => {
    setFormData({
      ...formData,
      talkingPoints: formData.talkingPoints.filter((_, i) => i !== index),
    })
  }

  const addRestrictedTerm = () => {
    if (newRestrictedTerm.trim()) {
      setFormData({
        ...formData,
        restrictedTerms: [...formData.restrictedTerms, newRestrictedTerm.trim()],
      })
      setNewRestrictedTerm('')
    }
  }

  const removeRestrictedTerm = (index: number) => {
    setFormData({
      ...formData,
      restrictedTerms: formData.restrictedTerms.filter((_, i) => i !== index),
    })
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Submit Ad for Approval
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Fill out all required fields to submit your ad for producer and talent approval.
          </Typography>

          {errors.submit && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errors.submit}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Ad Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  error={!!errors.title}
                  helperText={errors.title}
                  required
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth error={!!errors.advertiser}>
                  <InputLabel>Advertiser</InputLabel>
                  <Select
                    value={formData.advertiser}
                    onChange={(e) => setFormData({ ...formData, advertiser: e.target.value, campaign: '' })}
                    label="Advertiser"
                    required
                  >
                    {advertisers.map((advertiser: any) => (
                      <MenuItem key={advertiser.id} value={advertiser.id}>
                        {advertiser.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.advertiser && <FormHelperText>{errors.advertiser}</FormHelperText>}
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth error={!!errors.campaign} disabled={!formData.advertiser}>
                  <InputLabel>Campaign</InputLabel>
                  <Select
                    value={formData.campaign}
                    onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                    label="Campaign"
                    required
                  >
                    {campaigns.map((campaign: any) => (
                      <MenuItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.campaign && <FormHelperText>{errors.campaign}</FormHelperText>}
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Shows"
                  value={`${formData.shows.length} show${formData.shows.length !== 1 ? 's' : ''} selected`}
                  onClick={() => setShowSelectionDialog(true)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <IconButton onClick={() => setShowSelectionDialog(true)}>
                        <AddIcon />
                      </IconButton>
                    ),
                  }}
                  error={!!errors.shows}
                  helperText={errors.shows || 'Click to select shows to send ad to'}
                  required
                  sx={{ cursor: 'pointer' }}
                />
                
                {/* Selected Shows Display */}
                {formData.shows.length > 0 && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {formData.shows.slice(0, 3).map((showId) => {
                      const show = shows.find((s: any) => s.id === showId)
                      return show ? (
                        <Chip
                          key={showId}
                          label={show.name}
                          size="small"
                          onDelete={() => {
                            const newShows = formData.shows.filter(id => id !== showId)
                            setFormData({ ...formData, shows: newShows })
                            if (newShows.length === 0 && !errors.shows) {
                              setErrors({ ...errors, shows: 'At least one show is required' })
                            }
                          }}
                        />
                      ) : null
                    })}
                    {formData.shows.length > 3 && (
                      <Chip
                        label={`+${formData.shows.length - 3} more`}
                        size="small"
                        variant="outlined"
                        onClick={() => setShowSelectionDialog(true)}
                      />
                    )}
                  </Box>
                )}
              </Grid>

              {/* Ad Details */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Ad Details
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Ad Type</InputLabel>
                  <Select
                    value={formData.adType}
                    onChange={(e) => setFormData({ ...formData, adType: e.target.value as any })}
                    label="Ad Type"
                  >
                    <MenuItem value="host-read">Host Read</MenuItem>
                    <MenuItem value="pre-produced">Pre-Produced</MenuItem>
                    <MenuItem value="programmatic">Programmatic</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Duration (Select all that apply)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                  {[
                    { value: 15, label: ':15' },
                    { value: 30, label: ':30' },
                    { value: 60, label: ':60' },
                    { value: 90, label: ':90' },
                    { value: 120, label: ':120' },
                  ].map((option) => (
                    <Box
                      key={option.value}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        border: '1px solid',
                        borderColor: formData.durations.includes(option.value) ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        backgroundColor: formData.durations.includes(option.value) ? 'primary.light' : 'transparent',
                      }}
                    >
                      <Typography variant="body2">{option.label}</Typography>
                      <Switch
                        checked={formData.durations.includes(option.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ 
                              ...formData, 
                              durations: [...formData.durations, option.value].sort((a, b) => a - b)
                            })
                            // Remove custom duration if selecting preset
                            const customDurations = formData.durations.filter(d => ![15, 30, 60, 90, 120].includes(d))
                            if (customDurations.length > 0) {
                              setFormData(prev => ({
                                ...prev,
                                durations: prev.durations.filter(d => [15, 30, 60, 90, 120].includes(d) || d === option.value).sort((a, b) => a - b)
                              }))
                              setShowCustomDuration(false)
                              setCustomDuration('')
                            }
                          } else {
                            setFormData({ 
                              ...formData, 
                              durations: formData.durations.filter(d => d !== option.value) 
                            })
                          }
                        }}
                        size="small"
                      />
                    </Box>
                  ))}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      border: '1px solid',
                      borderColor: showCustomDuration ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      backgroundColor: showCustomDuration ? 'primary.light' : 'transparent',
                    }}
                  >
                    <Typography variant="body2">Custom</Typography>
                    <Switch
                      checked={showCustomDuration}
                      onChange={(e) => {
                        setShowCustomDuration(e.target.checked)
                        if (!e.target.checked) {
                          // Remove any custom durations
                          setFormData({ 
                            ...formData, 
                            durations: formData.durations.filter(d => [15, 30, 60, 90, 120].includes(d)) 
                          })
                          setCustomDuration('')
                        }
                      }}
                      size="small"
                    />
                  </Box>
                </Box>
                {showCustomDuration && (
                  <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                    <TextField
                      type="number"
                      label="Custom Duration (seconds)"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      InputProps={{
                        inputProps: { min: 15, max: 300 },
                      }}
                      sx={{ width: 200 }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        const duration = parseInt(customDuration)
                        if (duration && duration >= 15 && duration <= 300 && !formData.durations.includes(duration)) {
                          setFormData({ 
                            ...formData, 
                            durations: [...formData.durations, duration].sort((a, b) => a - b)
                          })
                          setCustomDuration('')
                        }
                      }}
                      disabled={!customDuration || parseInt(customDuration) < 15 || parseInt(customDuration) > 300}
                    >
                      Add
                    </Button>
                  </Box>
                )}
                {formData.durations.length > 0 && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {formData.durations.map((duration) => (
                      <Chip
                        key={duration}
                        label={`${duration}s`}
                        size="small"
                        onDelete={() => {
                          setFormData({ 
                            ...formData, 
                            durations: formData.durations.filter(d => d !== duration) 
                          })
                        }}
                      />
                    ))}
                  </Box>
                )}
                {errors.durations && (
                  <FormHelperText error>{errors.durations}</FormHelperText>
                )}
              </Grid>

              {formData.adType === 'host-read' && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      label="Ad Script"
                      value={formData.script}
                      onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                      error={!!errors.script}
                      helperText={errors.script || 'Provide the full script for the host to read'}
                      required
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Key Talking Points
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      {formData.talkingPoints.map((point, index) => (
                        <Chip
                          key={index}
                          label={point}
                          onDelete={() => removeTalkingPoint(index)}
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Add a talking point"
                        value={newTalkingPoint}
                        onChange={(e) => setNewTalkingPoint(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addTalkingPoint()
                          }
                        }}
                      />
                      <Button
                        variant="outlined"
                        onClick={addTalkingPoint}
                        startIcon={<AddIcon />}
                      >
                        Add
                      </Button>
                    </Box>
                    {errors.talkingPoints && (
                      <FormHelperText error>{errors.talkingPoints}</FormHelperText>
                    )}
                  </Grid>
                </>
              )}

              {/* Scheduling */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Scheduling & Targeting
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Start Date"
                  value={formData.airDates.start}
                  onChange={(date) => setFormData({
                    ...formData,
                    airDates: { ...formData.airDates, start: date }
                  })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DatePicker
                  label="End Date"
                  value={formData.airDates.end}
                  onChange={(date) => setFormData({
                    ...formData,
                    airDates: { ...formData.airDates, end: date }
                  })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              {/* Compliance & Legal */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Compliance & Legal
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Legal Disclaimer"
                  value={formData.legalDisclaimer}
                  onChange={(e) => setFormData({ ...formData, legalDisclaimer: e.target.value })}
                  helperText="Any required legal disclaimers or disclosures"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Restricted Terms
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Words or phrases that should not be used in the ad
                </Typography>
                <Box sx={{ mb: 2 }}>
                  {formData.restrictedTerms.map((term, index) => (
                    <Chip
                      key={index}
                      label={term}
                      onDelete={() => removeRestrictedTerm(index)}
                      color="error"
                      variant="outlined"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add restricted term"
                    value={newRestrictedTerm}
                    onChange={(e) => setNewRestrictedTerm(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addRestrictedTerm()
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={addRestrictedTerm}
                    startIcon={<AddIcon />}
                  >
                    Add
                  </Button>
                </Box>
              </Grid>

              {/* Priority & Deadline */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Priority & Deadline
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    label="Priority"
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Approval Deadline"
                  value={formData.deadline}
                  onChange={(date) => setFormData({ ...formData, deadline: date })}
                  slotProps={{ 
                    textField: { 
                      fullWidth: true,
                      error: !!errors.deadline,
                      helperText: errors.deadline,
                      required: true
                    } 
                  }}
                />
              </Grid>

              {/* Additional Notes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Additional Notes"
                  value={formData.additionalNotes}
                  onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                  helperText="Any additional information for the producer or talent"
                />
              </Grid>

              {/* Submit Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={onClose}
                    disabled={submitMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      {/* Show Selection Dialog */}
      <Dialog 
        open={showSelectionDialog} 
        onClose={() => setShowSelectionDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Select Shows
          <Typography variant="body2" color="text.secondary">
            Choose which shows should receive this ad for approval
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Search shows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  🔍
                </InputAdornment>
              ),
            }}
          />
          
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {shows
              .filter((show: any) => 
                show.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                show.host?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((show: any, index: number) => {
                const isSelected = formData.shows.includes(show.id)
                const handleToggle = () => {
                  console.log('🔄 Toggling show:', show.name, 'ID:', show.id, 'Index:', index)
                  console.log('📝 Current formData.shows:', formData.shows)
                  console.log('✅ Is currently selected:', isSelected)
                  
                  const newShows = isSelected
                    ? formData.shows.filter(id => id !== show.id)
                    : [...formData.shows, show.id]
                  
                  console.log('🎯 New shows array:', newShows)
                  
                  setFormData(prev => ({ 
                    ...prev, 
                    shows: newShows 
                  }))
                  
                  // Clear validation error if shows are selected
                  if (newShows.length > 0 && errors.shows) {
                    setErrors({ ...errors, shows: '' })
                  }
                }
                
                return (
                  <ListItem key={`${show.id}-${index}`} disablePadding>
                    <ListItemButton onClick={handleToggle}>
                      <ListItemText
                        primary={show.name}
                        secondary={`Host: ${show.host} • ${show.category} • ${show.subscribers?.toLocaleString() || 0} subscribers`}
                      />
                      <Switch
                        checked={isSelected}
                        onChange={handleToggle}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })}
          </List>
          
          {shows.filter((show: any) => 
            show.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            show.host?.toLowerCase().includes(searchQuery.toLowerCase())
          ).length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                No shows found matching "{searchQuery}"
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {formData.shows.length} show{formData.shows.length !== 1 ? 's' : ''} selected
            </Typography>
            <Box>
              <Button onClick={() => setShowSelectionDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setShowSelectionDialog(false)
                  setSearchQuery('')
                }} 
                variant="contained"
              >
                Done
              </Button>
            </Box>
          </Box>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}