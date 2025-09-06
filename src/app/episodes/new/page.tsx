'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Stepper,
  Step,
  StepLabel,
  FormControlLabel,
  Switch,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material'
import {
  ArrowBack,
  ArrowForward,
  Save,
  Mic,
  Upload,
  Schedule,
  AttachMoney,
  Add,
  Delete,
  AccessTime,
  CalendarToday,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'

interface AdSlot {
  id: string
  position: 'pre-roll' | 'mid-roll' | 'post-roll'
  duration: number
  price: number
  filled: boolean
  advertiser?: string
  campaign?: string
}

const steps = ['Episode Details', 'Audio Upload', 'Ad Configuration', 'Review & Schedule']

function NewEpisodeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showId = searchParams.get('show') || '1'

  const [activeStep, setActiveStep] = useState(0)
  const [episodeData, setEpisodeData] = useState({
    showId: showId,
    showName: 'The Tech Review Show',
    episodeNumber: 48,
    title: '',
    description: '',
    duration: '',
    audioFile: null as File | null,
    transcriptFile: null as File | null,
    releaseDate: new Date(),
    status: 'draft' as 'draft' | 'scheduled' | 'published',
    explicit: false,
    tags: [] as string[],
    guests: [] as string[],
    adSlots: [
      { id: '1', position: 'pre-roll', duration: 30, price: 500, filled: false },
      { id: '2', position: 'mid-roll', duration: 60, price: 800, filled: false },
      { id: '3', position: 'mid-roll', duration: 60, price: 800, filled: false },
      { id: '4', position: 'post-roll', duration: 30, price: 400, filled: false },
    ] as AdSlot[],
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newTag, setNewTag] = useState('')
  const [newGuest, setNewGuest] = useState('')

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevStep) => prevStep + 1)
    }
  }

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1)
  }

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {}

    if (step === 0) {
      if (!episodeData.title.trim()) {
        newErrors.title = 'Episode title is required'
      }
      if (!episodeData.description.trim()) {
        newErrors.description = 'Description is required'
      }
    } else if (step === 1) {
      if (!episodeData.audioFile) {
        newErrors.audioFile = 'Audio file is required'
      }
      if (!episodeData.duration) {
        newErrors.duration = 'Duration is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validateStep(activeStep)) {
      // Simulate API call
      setTimeout(() => {
        router.push(`/shows/${showId}/episodes`)
      }, 1000)
    }
  }

  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setEpisodeData(prev => ({ ...prev, audioFile: file }))
      // Simulate duration detection
      setEpisodeData(prev => ({ ...prev, duration: '45:30' }))
    }
  }

  const handleTranscriptUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setEpisodeData(prev => ({ ...prev, transcriptFile: file }))
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !episodeData.tags.includes(newTag.trim())) {
      setEpisodeData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setEpisodeData(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== tagToRemove) }))
  }

  const handleAddGuest = () => {
    if (newGuest.trim() && !episodeData.guests.includes(newGuest.trim())) {
      setEpisodeData(prev => ({ ...prev, guests: [...prev.guests, newGuest.trim()] }))
      setNewGuest('')
    }
  }

  const handleRemoveGuest = (guestToRemove: string) => {
    setEpisodeData(prev => ({ ...prev, guests: prev.guests.filter(guest => guest !== guestToRemove) }))
  }

  const updateAdSlot = (slotId: string, field: keyof AdSlot, value: any) => {
    setEpisodeData(prev => ({
      ...prev,
      adSlots: prev.adSlots.map(slot =>
        slot.id === slotId ? { ...slot, [field]: value } : slot
      )
    }))
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push(`/shows/${showId}/episodes`)} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Create New Episode
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {episodeData.showName} - Episode #{episodeData.episodeNumber}
            </Typography>
          </Box>
        </Box>

        {/* Stepper */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stepper activeStep={activeStep}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {/* Step Content */}
        {activeStep === 0 && (
          <Grid container spacing={3}>
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
                        value={episodeData.title}
                        onChange={(e) => setEpisodeData(prev => ({ ...prev, title: e.target.value }))}
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
                        label="Episode Description"
                        value={episodeData.description}
                        onChange={(e) => setEpisodeData(prev => ({ ...prev, description: e.target.value }))}
                        error={!!errors.description}
                        helperText={errors.description || `${episodeData.description.length}/4000 characters`}
                        required
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={episodeData.explicit}
                            onChange={(e) => setEpisodeData(prev => ({ ...prev, explicit: e.target.checked }))}
                          />
                        }
                        label="Explicit Content"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
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
                      {episodeData.tags.map((tag) => (
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
                      {episodeData.guests.map((guest) => (
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
            </Grid>
          </Grid>
        )}

        {activeStep === 1 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <Upload sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Upload Audio Files
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 3, textAlign: 'center' }}>
                        <input
                          accept="audio/*"
                          style={{ display: 'none' }}
                          id="audio-file-upload"
                          type="file"
                          onChange={handleAudioUpload}
                        />
                        <label htmlFor="audio-file-upload">
                          <Button variant="contained" component="span" startIcon={<Upload />}>
                            Upload Audio File
                          </Button>
                        </label>
                        {episodeData.audioFile && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2">{episodeData.audioFile.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Duration: {episodeData.duration}
                            </Typography>
                          </Box>
                        )}
                        {errors.audioFile && (
                          <Typography variant="caption" color="error">
                            {errors.audioFile}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 3, textAlign: 'center' }}>
                        <input
                          accept=".txt,.srt,.vtt"
                          style={{ display: 'none' }}
                          id="transcript-file-upload"
                          type="file"
                          onChange={handleTranscriptUpload}
                        />
                        <label htmlFor="transcript-file-upload">
                          <Button variant="outlined" component="span" startIcon={<Upload />}>
                            Upload Transcript (Optional)
                          </Button>
                        </label>
                        {episodeData.transcriptFile && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2">{episodeData.transcriptFile.name}</Typography>
                          </Box>
                        )}
                      </Box>
                    </Grid>

                    <Grid item xs={12}>
                      <Alert severity="info">
                        Supported audio formats: MP3, WAV, M4A (max 500MB). Transcript formats: TXT, SRT, VTT
                      </Alert>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {activeStep === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Ad Slot Configuration
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  
                  <List>
                    {episodeData.adSlots.map((slot, index) => (
                      <ListItem key={slot.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}>
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
                            <Box sx={{ mt: 1 }}>
                              {slot.filled ? (
                                <Typography variant="body2" color="success.main">
                                  Filled: {slot.advertiser} - {slot.campaign}
                                </Typography>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  Available for booking
                                </Typography>
                              )}
                            </Box>
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

                  <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Revenue Summary
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Total Potential Revenue:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        ${episodeData.adSlots.reduce((sum, slot) => sum + slot.price, 0).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Confirmed Revenue:</Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        ${episodeData.adSlots.filter(s => s.filled).reduce((sum, slot) => sum + slot.price, 0).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {activeStep === 3 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Review & Schedule
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Episode Details</Typography>
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary">Title</Typography>
                        <Typography variant="body1">{episodeData.title || 'Not set'}</Typography>
                      </Box>
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary">Duration</Typography>
                        <Typography variant="body1">{episodeData.duration || 'Not set'}</Typography>
                      </Box>
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary">Tags</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                          {episodeData.tags.map(tag => (
                            <Chip key={tag} label={tag} size="small" />
                          ))}
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Publishing Settings</Typography>
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DateTimePicker
                          label="Release Date & Time"
                          value={episodeData.releaseDate}
                          onChange={(newValue) => newValue && setEpisodeData(prev => ({ ...prev, releaseDate: newValue }))}
                          slotProps={{ textField: { fullWidth: true, sx: { mb: 3 } } }}
                        />
                      </LocalizationProvider>
                      
                      <FormControl fullWidth>
                        <InputLabel>Publishing Status</InputLabel>
                        <Select
                          value={episodeData.status}
                          label="Publishing Status"
                          onChange={(e) => setEpisodeData(prev => ({ ...prev, status: e.target.value as any }))}
                        >
                          <MenuItem value="draft">Save as Draft</MenuItem>
                          <MenuItem value="scheduled">Schedule for Release</MenuItem>
                          <MenuItem value="published">Publish Immediately</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            sx={{ mr: 1 }}
          >
            Back
          </Button>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" onClick={() => router.push(`/shows/${showId}/episodes`)}>
              Save Draft
            </Button>
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleSubmit}
                startIcon={<Save />}
              >
                Create Episode
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<ArrowForward />}
              >
                Next
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </DashboardLayout>
  )
}

export default function NewEpisodePage() {
  return (
    <Suspense fallback={<DashboardLayout><Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><Typography>Loading...</Typography></Box></DashboardLayout>}>
      <NewEpisodeContent />
    </Suspense>
  )
}