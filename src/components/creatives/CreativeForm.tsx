'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  IconButton,
  Alert,
  LinearProgress,
  InputAdornment,
  Autocomplete,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface CreativeFormProps {
  open: boolean
  onClose: () => void
  creative?: any
  onSuccess: () => void
}

export function CreativeForm({ open, onClose, creative, onSuccess }: CreativeFormProps) {
  const isEditing = !!creative
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'pre-roll',
    format: 'audio',
    duration: 30,
    script: '',
    talkingPoints: [] as string[],
    audioUrl: '',
    videoUrl: '',
    thumbnailUrl: '',
    advertiserId: '',
    campaignId: '',
    tags: [] as string[],
    category: '',
    restrictedTerms: [] as string[],
    legalDisclaimer: '',
    expiryDate: null as Date | null,
  })

  const [newTalkingPoint, setNewTalkingPoint] = useState('')
  const [newTag, setNewTag] = useState('')
  const [newRestrictedTerm, setNewRestrictedTerm] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Load advertisers
  const { data: advertisers = [] } = useQuery({
    queryKey: ['advertisers-select'],
    queryFn: async () => {
      const response = await api.get('/advertisers')
      return response.data
    },
  })

  // Load campaigns for selected advertiser
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns-select', formData.advertiserId],
    queryFn: async () => {
      if (!formData.advertiserId) return []
      const response = await api.get(`/campaigns?advertiserId=${formData.advertiserId}`)
      return response.data.Items || response.data.campaigns || []
    },
    enabled: !!formData.advertiserId,
  })

  // Initialize form data when editing
  useEffect(() => {
    if (creative) {
      setFormData({
        name: creative.name || '',
        description: creative.description || '',
        type: creative.type || 'pre-roll',
        format: creative.format || 'audio',
        duration: creative.duration || 30,
        script: creative.script || '',
        talkingPoints: creative.talkingPoints || [],
        audioUrl: creative.audioUrl || '',
        videoUrl: creative.videoUrl || '',
        thumbnailUrl: creative.thumbnailUrl || '',
        advertiserId: creative.advertiserId || '',
        campaignId: creative.campaignId || '',
        tags: creative.tags || [],
        category: creative.category || '',
        restrictedTerms: creative.restrictedTerms || [],
        legalDisclaimer: creative.legalDisclaimer || '',
        expiryDate: creative.expiryDate ? new Date(creative.expiryDate) : null,
      })
    }
  }, [creative])

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        return api.put(`/creatives/${creative.id}`, data)
      } else {
        return api.post('/creatives', data)
      }
    },
    onSuccess: () => {
      onSuccess()
    },
  })

  const handleSubmit = () => {
    const submitData = {
      ...formData,
      expiryDate: formData.expiryDate?.toISOString(),
    }
    mutation.mutate(submitData)
  }

  const handleFileUpload = async (file: File, type: 'audio' | 'video' | 'image') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    setUploadProgress(0)
    setUploadError(null)

    try {
      const response = await api.post('/upload/creative', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          )
          setUploadProgress(percentCompleted)
        },
      })

      const { fileUrl, s3Key } = response.data

      // Update the appropriate URL field
      if (type === 'audio') {
        setFormData((prev) => ({ ...prev, audioUrl: fileUrl }))
      } else if (type === 'video') {
        setFormData((prev) => ({ ...prev, videoUrl: fileUrl }))
      } else if (type === 'image') {
        setFormData((prev) => ({ ...prev, thumbnailUrl: fileUrl }))
      }

      setUploadProgress(null)
    } catch (error: any) {
      setUploadError(error.response?.data?.error || 'Upload failed')
      setUploadProgress(null)
    }
  }

  const addTalkingPoint = () => {
    if (newTalkingPoint.trim()) {
      setFormData((prev) => ({
        ...prev,
        talkingPoints: [...prev.talkingPoints, newTalkingPoint.trim()],
      }))
      setNewTalkingPoint('')
    }
  }

  const addTag = () => {
    if (newTag.trim()) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }))
      setNewTag('')
    }
  }

  const addRestrictedTerm = () => {
    if (newRestrictedTerm.trim()) {
      setFormData((prev) => ({
        ...prev,
        restrictedTerms: [...prev.restrictedTerms, newRestrictedTerm.trim()],
      }))
      setNewRestrictedTerm('')
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {isEditing ? 'Edit Creative' : 'Add New Creative'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Creative Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  label="Type"
                >
                  <MenuItem value="pre-roll">Pre-Roll</MenuItem>
                  <MenuItem value="mid-roll">Mid-Roll</MenuItem>
                  <MenuItem value="post-roll">Post-Roll</MenuItem>
                  <MenuItem value="host-read">Host Read</MenuItem>
                  <MenuItem value="produced">Produced</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  label="Format"
                >
                  <MenuItem value="audio">Audio</MenuItem>
                  <MenuItem value="video">Video</MenuItem>
                  <MenuItem value="script">Script</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Duration (seconds)"
                type="number"
                value={formData.duration}
                onChange={(e) =>
                  setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })
                }
                InputProps={{
                  inputProps: { min: 1, max: 300 },
                }}
              />
            </Grid>

            {/* Advertiser and Campaign */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Advertiser</InputLabel>
                <Select
                  value={formData.advertiserId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      advertiserId: e.target.value,
                      campaignId: '', // Reset campaign when advertiser changes
                    })
                  }
                  label="Advertiser"
                >
                  <MenuItem value="">None</MenuItem>
                  {advertisers.map((advertiser: any) => (
                    <MenuItem key={advertiser.id} value={advertiser.id}>
                      {advertiser.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={!formData.advertiserId}>
                <InputLabel>Campaign</InputLabel>
                <Select
                  value={formData.campaignId}
                  onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })}
                  label="Campaign"
                >
                  <MenuItem value="">None</MenuItem>
                  {campaigns.map((campaign: any) => (
                    <MenuItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Content based on format */}
            {(formData.format === 'script' || formData.format === 'audio') && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  label="Script"
                  value={formData.script}
                  onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                  placeholder="Enter the full script or copy for the ad..."
                />
              </Grid>
            )}

            {/* File uploads */}
            {formData.format === 'audio' && (
              <Grid item xs={12}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Audio File
                  </Typography>
                  {formData.audioUrl ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <AudioIcon />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {formData.audioUrl.split('/').pop()}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setFormData({ ...formData, audioUrl: '' })}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<UploadIcon />}
                      fullWidth
                    >
                      Upload Audio
                      <input
                        type="file"
                        hidden
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, 'audio')
                        }}
                      />
                    </Button>
                  )}
                  {uploadProgress !== null && (
                    <LinearProgress
                      variant="determinate"
                      value={uploadProgress}
                      sx={{ mt: 1 }}
                    />
                  )}
                  {uploadError && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {uploadError}
                    </Alert>
                  )}
                </Box>
              </Grid>
            )}

            {formData.format === 'video' && (
              <Grid item xs={12}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Video File
                  </Typography>
                  {formData.videoUrl ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <VideoIcon />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {formData.videoUrl.split('/').pop()}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setFormData({ ...formData, videoUrl: '' })}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<UploadIcon />}
                      fullWidth
                    >
                      Upload Video
                      <input
                        type="file"
                        hidden
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, 'video')
                        }}
                      />
                    </Button>
                  )}
                </Box>
              </Grid>
            )}

            {/* Talking Points */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Key Talking Points
              </Typography>
              <Box sx={{ mb: 1 }}>
                {formData.talkingPoints.map((point, index) => (
                  <Chip
                    key={index}
                    label={point}
                    onDelete={() => {
                      setFormData({
                        ...formData,
                        talkingPoints: formData.talkingPoints.filter((_, i) => i !== index),
                      })
                    }}
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
                <Button variant="outlined" onClick={addTalkingPoint} startIcon={<AddIcon />}>
                  Add
                </Button>
              </Box>
            </Grid>

            {/* Tags */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Tags
              </Typography>
              <Box sx={{ mb: 1 }}>
                {formData.tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={() => {
                      setFormData({
                        ...formData,
                        tags: formData.tags.filter((_, i) => i !== index),
                      })
                    }}
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Add a tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                />
                <Button variant="outlined" onClick={addTag} startIcon={<AddIcon />}>
                  Add
                </Button>
              </Box>
            </Grid>

            {/* Category */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  label="Category"
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="seasonal">Seasonal</MenuItem>
                  <MenuItem value="promo">Promotional</MenuItem>
                  <MenuItem value="brand">Brand</MenuItem>
                  <MenuItem value="product">Product</MenuItem>
                  <MenuItem value="event">Event</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Expiry Date */}
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Expiry Date"
                value={formData.expiryDate}
                onChange={(date) => setFormData({ ...formData, expiryDate: date })}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>

            {/* Legal */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Legal Disclaimer"
                value={formData.legalDisclaimer}
                onChange={(e) => setFormData({ ...formData, legalDisclaimer: e.target.value })}
                placeholder="Any required legal disclaimers or disclosures..."
              />
            </Grid>

            {/* Restricted Terms */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Restricted Terms
              </Typography>
              <Box sx={{ mb: 1 }}>
                {formData.restrictedTerms.map((term, index) => (
                  <Chip
                    key={index}
                    label={term}
                    onDelete={() => {
                      setFormData({
                        ...formData,
                        restrictedTerms: formData.restrictedTerms.filter((_, i) => i !== index),
                      })
                    }}
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
                <Button variant="outlined" onClick={addRestrictedTerm} startIcon={<AddIcon />}>
                  Add
                </Button>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.name || !formData.duration || mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Creative'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}