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
  FormControlLabel,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material'
import {
  ArrowBack,
  Save,
  Cancel,
  Mic,
  Upload,
  Schedule,
  AttachMoney,
  Delete,
  AccessTime,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { episodesApi } from '@/services/api'

interface Episode {
  id: string
  episodeId: string
  showId: string
  showName: string
  episodeNumber: number
  title: string
  description: string
  duration: number
  releaseDate: string
  airDate?: string
  status: string
  audioUrl?: string
  scriptUrl?: string
  transcriptUrl?: string
  explicit?: boolean
  tags?: string[]
  guests?: string[]
  assignedTalent?: string[]
  sponsorSegments?: any[]
  adSlots?: {
    id: string
    position: string
    duration: number
    price: number
    filled: boolean
    advertiser?: string
    campaign?: string
  }[]
  createdAt: string
  updatedAt: string
}

export default function EditEpisodePage() {
  const router = useRouter()
  const params = useParams()
  const episodeId = params.id as string

  const [episode, setEpisode] = useState<Episode | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newTag, setNewTag] = useState('')
  const [newGuest, setNewGuest] = useState('')

  useEffect(() => {
    fetchEpisode()
  }, [episodeId])

  const fetchEpisode = async () => {
    try {
      setLoading(true)
      const data = await episodesApi.get(episodeId)
      
      // Transform the data to match our component's expectations
      setEpisode({
        ...data,
        id: data.episodeId || data.id,
        episodeId: data.episodeId || data.id,
        episodeNumber: data.episodeNumber || data.number || 1,
        duration: data.duration || 0,
        releaseDate: data.releaseDate || data.airDate || data.createdAt,
        explicit: data.explicit || false,
        tags: data.tags || [],
        guests: data.guests || [],
        adSlots: data.adSlots || [],
      })
    } catch (error) {
      console.error('Error fetching episode:', error)
      // Redirect to episodes list if fetch fails
      router.push('/episodes')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof Episode, value: any) => {
    if (!episode) return
    
    setEpisode(prev => prev ? ({ ...prev, [field]: value }) : null)
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
    if (!episode) return false
    
    const newErrors: Record<string, string> = {}

    if (!episode.title.trim()) {
      newErrors.title = 'Episode title is required'
    }
    if (!episode.description.trim()) {
      newErrors.description = 'Description is required'
    }
    if (!episode.duration || episode.duration === 0) {
      newErrors.duration = 'Duration is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!episode || !validateForm()) {
      return
    }

    setSaving(true)
    try {
      // Convert duration to string format if needed
      const updateData = {
        title: episode.title,
        description: episode.description,
        duration: episode.duration,
        releaseDate: episode.releaseDate,
        status: episode.status,
        scriptUrl: episode.scriptUrl,
        audioUrl: episode.audioUrl,
      }
      
      await episodesApi.update(episodeId, updateData)
      setSaving(false)
      setHasChanges(false)
      setShowSuccessAlert(true)
      
      // Redirect back to episode detail after a short delay
      setTimeout(() => {
        router.push(`/episodes/${episodeId}`)
      }, 1500)
    } catch (error) {
      console.error('Error saving episode:', error)
      setSaving(false)
      alert('Failed to save episode. Please try again.')
    }
  }

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        router.push(`/episodes/${episodeId}`)
      }
    } else {
      router.push(`/episodes/${episodeId}`)
    }
  }

  const handleAddTag = () => {
    if (!episode) return
    if (newTag.trim() && !episode.tags?.includes(newTag.trim())) {
      handleChange('tags', [...(episode.tags || []), newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    if (!episode) return
    handleChange('tags', episode.tags?.filter(tag => tag !== tagToRemove) || [])
  }

  const handleAddGuest = () => {
    if (!episode) return
    if (newGuest.trim() && !episode.guests?.includes(newGuest.trim())) {
      handleChange('guests', [...(episode.guests || []), newGuest.trim()])
      setNewGuest('')
    }
  }

  const handleRemoveGuest = (guestToRemove: string) => {
    if (!episode) return
    handleChange('guests', episode.guests?.filter(guest => guest !== guestToRemove) || [])
  }

  const updateAdSlot = (slotId: string, field: string, value: any) => {
    if (!episode) return
    const updatedSlots = episode.adSlots?.map(slot =>
      slot.id === slotId ? { ...slot, [field]: value } : slot
    ) || []
    handleChange('adSlots', updatedSlots)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Typography>Loading episode details...</Typography>
        </Box>
      </DashboardLayout>
    )
  }

  if (!episode) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Typography>Episode not found</Typography>
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
              Edit Episode
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {episode.showName} - Episode #{episode.episodeNumber}
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
          {/* Episode Information */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Mic sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Episode Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Episode Title"
                      value={episode.title}
                      onChange={(e) => handleChange('title', e.target.value)}
                      error={!!errors.title}
                      helperText={errors.title}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      label="Description"
                      value={episode.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      error={!!errors.description}
                      helperText={errors.description || `${episode.description.length}/4000 characters`}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Duration (seconds)"
                      type="number"
                      value={episode.duration}
                      onChange={(e) => handleChange('duration', parseInt(e.target.value) || 0)}
                      error={!!errors.duration}
                      helperText={errors.duration || `${Math.floor(episode.duration / 60)} minutes ${episode.duration % 60} seconds`}
                      InputProps={{
                        startAdornment: <AccessTime sx={{ mr: 1, color: 'action.active' }} />,
                      }}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={episode.explicit}
                          onChange={(e) => handleChange('explicit', e.target.checked)}
                        />
                      }
                      label="Explicit Content"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Publishing Settings */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Publishing Settings
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DateTimePicker
                        label="Release Date & Time"
                        value={episode.releaseDate ? new Date(episode.releaseDate) : null}
                        onChange={(newValue) => newValue && handleChange('releaseDate', newValue.toISOString())}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </LocalizationProvider>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={episode.status}
                        label="Status"
                        onChange={(e) => handleChange('status', e.target.value)}
                      >
                        <MenuItem value="published">Published</MenuItem>
                        <MenuItem value="scheduled">Scheduled</MenuItem>
                        <MenuItem value="draft">Draft</MenuItem>
                        <MenuItem value="recording">Recording</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Ad Slots */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Ad Slot Configuration
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <List>
                  {episode.adSlots?.map((slot) => (
                    <ListItem
                      key={slot.id}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                        bgcolor: slot.filled ? 'success.50' : 'grey.50'
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Chip label={slot.position} size="small" color="primary" />
                            <Typography variant="subtitle2">
                              {slot.duration}s @ ${slot.price}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          slot.filled ? (
                            <Typography variant="body2" color="success.main">
                              Filled: {slot.advertiser} - {slot.campaign}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Available for booking
                            </Typography>
                          )
                        }
                      />
                      <ListItemSecondaryAction>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={slot.filled}
                              onChange={(e) => updateAdSlot(slot.id, 'filled', e.target.checked)}
                            />
                          }
                          label="Filled"
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            {/* Tags & Guests */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Tags & Guests
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Tags
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {episode.tags?.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        onDelete={() => handleRemoveTag(tag)}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Add tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <Button size="small" onClick={handleAddTag} disabled={!newTag.trim()}>Add</Button>
                  </Box>
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Guests
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {episode.guests?.map((guest) => (
                      <Chip
                        key={guest}
                        label={guest}
                        onDelete={() => handleRemoveGuest(guest)}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Add guest"
                      value={newGuest}
                      onChange={(e) => setNewGuest(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddGuest()}
                    />
                    <Button size="small" onClick={handleAddGuest} disabled={!newGuest.trim()}>Add</Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Files */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Upload sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Files
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Audio File
                  </Typography>
                  {episode.audioUrl ? (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography variant="body2">episode-audio.mp3</Typography>
                        <Button size="small" variant="outlined">
                          Replace
                        </Button>
                      </Box>
                      <AudioPlayer
                        src={episode.audioUrl}
                        title={episode.title || 'Episode Audio'}
                        subtitle={`Episode #${episode.episodeNumber}`}
                        compact
                      />
                    </Box>
                  ) : (
                    <Button variant="outlined" size="small" startIcon={<Upload />}>
                      Upload Audio
                    </Button>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Transcript
                  </Typography>
                  {episode.transcriptUrl ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">episode-transcript.txt</Typography>
                      <Button size="small" variant="outlined">
                        Replace
                      </Button>
                    </Box>
                  ) : (
                    <Button variant="outlined" size="small" startIcon={<Upload />}>
                      Upload Transcript
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Episode Status */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Episode Status
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Current Status
                    </Typography>
                    <Chip
                      label={episode.status}
                      color={episode.status === 'published' ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Created
                    </Typography>
                    <Typography variant="body2">
                      {new Date(episode.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Last Updated
                    </Typography>
                    <Typography variant="body2">
                      {new Date(episode.updatedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
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
            Episode updated successfully!
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  )
}