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
  InputAdornment,
  Autocomplete,
  Avatar,
} from '@mui/material'
import {
  ArrowBack,
  Save,
  Cancel,
  Mic,
  Category,
  Schedule,
  AttachMoney,
  Image,
  Upload,
  Person,
  YouTube,
  Sync,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'

interface Show {
  id: string
  name: string
  description: string
  host: string
  coHosts: string[]
  category: string
  subcategory: string
  status: 'active' | 'paused' | 'ended'
  publishSchedule: string
  episodeLength: number
  language: string
  explicit: boolean
  website: string
  email: string
  targetAudience: string
  pricePerSlot: number
  availableSlots: number
  tags: string[]
  coverImage: string
  assignedProducers: string[]
  assignedTalent: string[]
  producerNames: string[]
  talentNames: string[]
  createdAt: string
  updatedAt: string
  // Monetization fields
  pricingModel?: 'cpm' | 'spot' | 'both'
  preRollCpm?: number
  preRollSpotCost?: number
  midRollCpm?: number
  midRollSpotCost?: number
  postRollCpm?: number
  postRollSpotCost?: number
  preRollSlots?: number
  midRollSlots?: number
  postRollSlots?: number
  // YouTube Integration fields
  youtubeChannelUrl?: string
  youtubeChannelId?: string
  youtubeChannelName?: string
  youtubePlaylistId?: string
  youtubeSyncEnabled?: boolean
  youtubeAutoCreateEpisodes?: boolean
  youtubeLastSyncAt?: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
}

const categories = [
  { value: 'technology', label: 'Technology' },
  { value: 'business', label: 'Business' },
  { value: 'health', label: 'Health & Wellness' },
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'sports', label: 'Sports' },
  { value: 'news', label: 'News & Politics' },
  { value: 'truecrime', label: 'True Crime' },
]

const publishSchedules = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'irregular', label: 'Irregular' },
]

export default function EditShowPage() {
  const router = useRouter()
  const params = useParams()
  const showId = params.id as string
  const { user } = useAuth()

  const [show, setShow] = useState<Show>({
    id: showId,
    name: '',
    description: '',
    host: '',
    coHosts: [],
    category: '',
    subcategory: '',
    status: 'active',
    publishSchedule: 'weekly',
    episodeLength: 30,
    language: 'English',
    explicit: false,
    website: '',
    email: '',
    targetAudience: '',
    pricePerSlot: 500,
    availableSlots: 4,
    tags: [],
    coverImage: '',
    assignedProducers: [],
    assignedTalent: [],
    producerNames: [],
    talentNames: [],
    createdAt: '2024-01-01',
    updatedAt: new Date().toISOString(),
    // Monetization defaults
    pricingModel: 'cpm',
    preRollCpm: 25,
    preRollSpotCost: 500,
    midRollCpm: 35,
    midRollSpotCost: 750,
    postRollCpm: 20,
    postRollSpotCost: 400,
    preRollSlots: 1,
    midRollSlots: 2,
    postRollSlots: 1,
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newTag, setNewTag] = useState('')
  const [newCoHost, setNewCoHost] = useState('')
  const [producers, setProducers] = useState<User[]>([])
  const [talent, setTalent] = useState<User[]>([])
  const [selectedProducers, setSelectedProducers] = useState<User[]>([])
  const [selectedTalent, setSelectedTalent] = useState<User[]>([])
  const [producersLoading, setProducersLoading] = useState(false)
  const [talentLoading, setTalentLoading] = useState(false)
  const [megaphoneLoading, setMegaphoneLoading] = useState(false)
  const [metricsDownloads, setMetricsDownloads] = useState<number | null>(null)

  // Local state for monetization input values to handle editing properly
  const [localInputs, setLocalInputs] = useState({
    preRollCpm: '',
    preRollSpotCost: '',
    preRollSlots: '',
    midRollCpm: '',
    midRollSpotCost: '',
    midRollSlots: '',
    postRollCpm: '',
    postRollSpotCost: '',
    postRollSlots: '',
  })

  // Fetch producers
  const fetchProducers = async (search?: string) => {
    setProducersLoading(true)
    try {
      const response = await fetch(`/api/users/by-role?role=producer${search ? `&search=${search}` : ''}`)
      const data = await response.json()
      setProducers(data.users || [])
    } catch (error) {
      console.error('Error fetching producers:', error)
    } finally {
      setProducersLoading(false)
    }
  }

  // Fetch talent
  const fetchTalent = async (search?: string) => {
    setTalentLoading(true)
    try {
      const response = await fetch(`/api/users/by-role?role=talent${search ? `&search=${search}` : ''}`)
      const data = await response.json()
      setTalent(data.users || [])
    } catch (error) {
      console.error('Error fetching talent:', error)
    } finally {
      setTalentLoading(false)
    }
  }

  // Fetch Megaphone analytics data for average episode downloads
  const fetchMegaphoneAnalytics = async () => {
    setMegaphoneLoading(true)
    try {
      const response = await fetch(`/api/shows/${showId}/metrics`)
      const data = await response.json()
      if (data.avgEpisodeDownloads) {
        setMetricsDownloads(data.avgEpisodeDownloads)
        // If show doesn't have avgEpisodeDownloads set, use metrics value
        if (!show.avgEpisodeDownloads) {
          handleChange('avgEpisodeDownloads', data.avgEpisodeDownloads)
          setLocalInputs(prev => ({ ...prev, avgEpisodeDownloads: data.avgEpisodeDownloads.toString() }))
        }
      }
    } catch (error) {
      console.error('Error fetching Megaphone analytics:', error)
      // Metrics not available, admin can override
    } finally {
      setMegaphoneLoading(false)
    }
  }

  useEffect(() => {
    // Load initial producers and talent
    fetchProducers()
    fetchTalent()
    
    // Load Megaphone analytics
    fetchMegaphoneAnalytics()
    
    // Load show data
    const loadShowData = async () => {
      try {
        const response = await fetch(`/api/shows/${showId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch show')
        }
        
        const data = await response.json()
        
        // Map API response to component state
        setShow({
          id: data.id,
          name: data.name || '',
          description: data.description || '',
          host: data.host || '',
          coHosts: data.coHosts || [],
          category: data.category || '',
          subcategory: data.subcategory || '',
          status: data.isActive ? 'active' : 'paused',
          publishSchedule: data.releaseFrequency || 'weekly',
          episodeLength: data.episodeLength || 30,
          language: data.language || 'English',
          explicit: data.explicit || false,
          website: data.website || '',
          email: data.email || '',
          targetAudience: data.targetAudience || '',
          pricePerSlot: data.pricePerSlot || 500,
          availableSlots: data.availableSlots || 4,
          tags: data.tags || [],
          coverImage: data.coverImage || '',
          assignedProducers: data.producers?.map((p: any) => p.id) || [],
          assignedTalent: data.talent?.map((t: any) => t.id) || [],
          producerNames: data.producers?.map((p: any) => p.name) || [],
          talentNames: data.talent?.map((t: any) => t.name) || [],
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          // Load monetization fields
          pricingModel: data.pricingModel || 'cpm',
          preRollCpm: data.preRollCpm || 25,
          preRollSpotCost: data.preRollSpotCost || 500,
          midRollCpm: data.midRollCpm || 35,
          midRollSpotCost: data.midRollSpotCost || 750,
          postRollCpm: data.postRollCpm || 20,
          postRollSpotCost: data.postRollSpotCost || 400,
          preRollSlots: data.preRollSlots || 1,
          midRollSlots: data.midRollSlots || 2,
          postRollSlots: data.postRollSlots || 1,
        })
        
        // Set selected users for autocomplete
        if (data.producers) {
          setSelectedProducers(data.producers)
        }
        if (data.talent) {
          setSelectedTalent(data.talent)
        }
        
        setLoading(false)
      } catch (error) {
        console.error('Error loading show:', error)
        setLoading(false)
        setErrors({ load: 'Failed to load show data' })
      }
    }
    
    loadShowData()
  }, [showId])

  // Sync local inputs with show state when show data loads
  useEffect(() => {
    setLocalInputs({
      preRollCpm: show.preRollCpm?.toString() || '',
      preRollSpotCost: show.preRollSpotCost?.toString() || '',
      preRollSlots: show.preRollSlots?.toString() || '',
      midRollCpm: show.midRollCpm?.toString() || '',
      midRollSpotCost: show.midRollSpotCost?.toString() || '',
      midRollSlots: show.midRollSlots?.toString() || '',
      postRollCpm: show.postRollCpm?.toString() || '',
      postRollSpotCost: show.postRollSpotCost?.toString() || '',
      postRollSlots: show.postRollSlots?.toString() || '',
    })
  }, [show.preRollCpm, show.preRollSpotCost, show.preRollSlots, show.midRollCpm, show.midRollSpotCost, show.midRollSlots, show.postRollCpm, show.postRollSpotCost, show.postRollSlots])

  const handleChange = (field: keyof Show, value: any) => {
    setShow(prev => ({ ...prev, [field]: value }))
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

  // Helper function for monetization field updates
  const handleMonetizationInput = (
    localKey: keyof typeof localInputs, 
    showKey: keyof Show, 
    value: string, 
    isInteger = false
  ) => {
    // Update local input state immediately
    setLocalInputs(prev => ({ ...prev, [localKey]: value }))
    
    // Update show state with parsed number
    if (value === '') {
      // Set to undefined when empty so the || fallback works in calculations
      handleChange(showKey, undefined)
    } else {
      const parsedValue = isInteger ? parseInt(value) : parseFloat(value)
      if (!isNaN(parsedValue)) {
        handleChange(showKey, parsedValue)
      }
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!show.name.trim()) {
      newErrors.name = 'Show name is required'
    }
    if (!show.description.trim()) {
      newErrors.description = 'Description is required'
    }
    if (!show.host.trim()) {
      newErrors.host = 'Host name is required'
    }
    if (!show.category) {
      newErrors.category = 'Category is required'
    }
    if (show.episodeLength < 1 || show.episodeLength > 300) {
      newErrors.episodeLength = 'Episode length must be between 1 and 300 minutes'
    }
    if (show.pricePerSlot < 0) {
      newErrors.pricePerSlot = 'Price per slot must be positive'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setSaving(true)
    try {
      const requestData = {
        name: show.name,
        description: show.description,
        host: show.host,
        genre: show.category,
        publishSchedule: show.publishSchedule,
        status: show.status,
        assignedProducers: show.assignedProducers,
        assignedTalent: show.assignedTalent,
        // Include monetization fields
        pricingModel: show.pricingModel,
        preRollCpm: show.preRollCpm,
        preRollSpotCost: show.preRollSpotCost,
        midRollCpm: show.midRollCpm,
        midRollSpotCost: show.midRollSpotCost,
        postRollCpm: show.postRollCpm,
        postRollSpotCost: show.postRollSpotCost,
        preRollSlots: show.preRollSlots,
        midRollSlots: show.midRollSlots,
        postRollSlots: show.postRollSlots,
        // Include YouTube integration fields
        youtubeChannelUrl: show.youtubeChannelUrl,
        youtubeChannelId: show.youtubeChannelId,
        youtubeChannelName: show.youtubeChannelName,
        youtubePlaylistId: show.youtubePlaylistId,
        youtubeSyncEnabled: show.youtubeSyncEnabled,
        youtubeAutoCreateEpisodes: show.youtubeAutoCreateEpisodes,
      }
      console.log('Saving show data:', requestData)
      
      const response = await fetch(`/api/shows/${showId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Save error response:', errorData)
        throw new Error(errorData.error || 'Failed to save show')
      }

      setSaving(false)
      setHasChanges(false)
      setShowSuccessAlert(true)
      
      // Navigate back to show details after a short delay to show success message
      setTimeout(() => {
        router.push(`/shows/${showId}`)
      }, 1500)
    } catch (error) {
      console.error('Error saving show:', error)
      setSaving(false)
      setErrors({ save: 'Failed to save changes. Please try again.' })
    }
  }

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        router.push(`/shows/${showId}`)
      }
    } else {
      router.push(`/shows/${showId}`)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !show.tags.includes(newTag.trim())) {
      handleChange('tags', [...show.tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    handleChange('tags', show.tags.filter(tag => tag !== tagToRemove))
  }

  const handleAddCoHost = () => {
    if (newCoHost.trim() && !show.coHosts.includes(newCoHost.trim())) {
      handleChange('coHosts', [...show.coHosts, newCoHost.trim()])
      setNewCoHost('')
    }
  }

  const handleRemoveCoHost = (coHostToRemove: string) => {
    handleChange('coHosts', show.coHosts.filter(coHost => coHost !== coHostToRemove))
  }

  const handleProducersChange = (_: any, newValue: User[]) => {
    setSelectedProducers(newValue)
    handleChange('assignedProducers', newValue.map(u => u.id))
    handleChange('producerNames', newValue.map(u => u.name))
  }

  const handleTalentChange = (_: any, newValue: User[]) => {
    setSelectedTalent(newValue)
    handleChange('assignedTalent', newValue.map(u => u.id))
    handleChange('talentNames', newValue.map(u => u.name))
  }

  // Calculate CPM-based revenue
  const calculateCpmRevenue = (cpm: number, slots: number, downloads: number) => {
    if (!cpm || !slots || !downloads) return 0
    // CPM = Cost per 1000 impressions
    const impressions = downloads * slots
    const revenue = (impressions / 1000) * cpm
    return revenue
  }

  // Calculate total episode revenue based on pricing model
  const calculateTotalEpisodeRevenue = () => {
    // Use show's avgEpisodeDownloads if set, otherwise use metrics data, otherwise default
    const downloads = show.avgEpisodeDownloads || metricsDownloads || 5000
    let total = 0

    if (show.pricingModel === 'spot' || show.pricingModel === 'both') {
      // Cost per spot revenue
      total += ((show.preRollSpotCost || 0) * (show.preRollSlots || 0))
      total += ((show.midRollSpotCost || 0) * (show.midRollSlots || 0))
      total += ((show.postRollSpotCost || 0) * (show.postRollSlots || 0))
    }

    if (show.pricingModel === 'cpm' || show.pricingModel === 'both') {
      // CPM-based revenue
      total += calculateCpmRevenue(show.preRollCpm || 0, show.preRollSlots || 0, downloads)
      total += calculateCpmRevenue(show.midRollCpm || 0, show.midRollSlots || 0, downloads)
      total += calculateCpmRevenue(show.postRollCpm || 0, show.postRollSlots || 0, downloads)
    }

    return total
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Typography>Loading show details...</Typography>
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
              Edit Show
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Update show information and settings
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
          {/* Basic Information */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Mic sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Show Name"
                      value={show.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      error={!!errors.name}
                      helperText={errors.name}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Description"
                      value={show.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      error={!!errors.description}
                      helperText={errors.description || `${show.description.length}/1000 characters`}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Primary Host"
                      value={show.host}
                      onChange={(e) => handleChange('host', e.target.value)}
                      error={!!errors.host}
                      helperText={errors.host}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={show.status}
                        label="Status"
                        onChange={(e) => handleChange('status', e.target.value)}
                      >
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="paused">Paused</MenuItem>
                        <MenuItem value="ended">Ended</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Co-Hosts
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        {show.coHosts.map((coHost) => (
                          <Chip
                            key={coHost}
                            label={coHost}
                            onDelete={() => handleRemoveCoHost(coHost)}
                          />
                        ))}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          size="small"
                          placeholder="Add co-host"
                          value={newCoHost}
                          onChange={(e) => setNewCoHost(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddCoHost()}
                        />
                        <Button type="button" onClick={handleAddCoHost} disabled={!newCoHost.trim()}>Add</Button>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Publishing Details */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Publishing Details
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Publishing Schedule</InputLabel>
                      <Select
                        value={show.publishSchedule}
                        label="Publishing Schedule"
                        onChange={(e) => handleChange('publishSchedule', e.target.value)}
                      >
                        {publishSchedules.map(schedule => (
                          <MenuItem key={schedule.value} value={schedule.value}>
                            {schedule.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Episode Length (minutes)"
                      type="number"
                      value={show.episodeLength}
                      onChange={(e) => handleChange('episodeLength', parseInt(e.target.value))}
                      error={!!errors.episodeLength}
                      helperText={errors.episodeLength}
                      inputProps={{ min: 1, max: 300 }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Language"
                      value={show.language}
                      onChange={(e) => handleChange('language', e.target.value)}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={show.explicit}
                          onChange={(e) => handleChange('explicit', e.target.checked)}
                        />
                      }
                      label="Explicit Content"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Team Management */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Team Management
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  {/* Producers Section */}
                  <Grid item xs={12}>
                    <Autocomplete
                      multiple
                      options={producers}
                      getOptionLabel={(option) => option.name}
                      value={selectedProducers}
                      onChange={handleProducersChange}
                      loading={producersLoading}
                      onOpen={() => {
                        // Fetch all producers when dropdown opens
                        if (producers.length === 0) {
                          fetchProducers()
                        }
                      }}
                      onInputChange={(_, value) => {
                        // Always fetch to support search
                        fetchProducers(value)
                      }}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            avatar={option.avatar ? <Avatar src={option.avatar} /> : undefined}
                            label={option.name}
                            color="primary"
                            variant="outlined"
                            {...getTagProps({ index })}
                          />
                        ))
                      }
                      renderOption={(props, option) => (
                        <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1 }} {...props}>
                          {option.avatar ? (
                            <Avatar src={option.avatar} sx={{ width: 24, height: 24 }} />
                          ) : (
                            <Avatar sx={{ width: 24, height: 24 }}>{option.name[0]}</Avatar>
                          )}
                          <Box>
                            <Typography variant="body2">{option.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.email}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Assigned Producers"
                          placeholder="Search and select producers..."
                          helperText="Start typing to search for producers"
                        />
                      )}
                    />
                  </Grid>

                  {/* Talent Section */}
                  <Grid item xs={12}>
                    <Autocomplete
                      multiple
                      options={talent}
                      getOptionLabel={(option) => option.name}
                      value={selectedTalent}
                      onChange={handleTalentChange}
                      loading={talentLoading}
                      onOpen={() => {
                        // Fetch all talent when dropdown opens
                        if (talent.length === 0) {
                          fetchTalent()
                        }
                      }}
                      onInputChange={(_, value) => {
                        // Always fetch to support search
                        fetchTalent(value)
                      }}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            avatar={option.avatar ? <Avatar src={option.avatar} /> : undefined}
                            label={option.name}
                            color="secondary"
                            variant="outlined"
                            {...getTagProps({ index })}
                          />
                        ))
                      }
                      renderOption={(props, option) => (
                        <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1 }} {...props}>
                          {option.avatar ? (
                            <Avatar src={option.avatar} sx={{ width: 24, height: 24 }} />
                          ) : (
                            <Avatar sx={{ width: 24, height: 24 }}>{option.name[0]}</Avatar>
                          )}
                          <Box>
                            <Typography variant="body2">{option.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.email}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Assigned Talent"
                          placeholder="Search and select talent..."
                          helperText="Start typing to search for talent"
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Contact Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Website"
                      value={show.website}
                      onChange={(e) => handleChange('website', e.target.value)}
                      placeholder="https://example.com"
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Contact Email"
                      type="email"
                      value={show.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* YouTube Integration */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <YouTube sx={{ mr: 1, verticalAlign: 'middle', color: '#FF0000' }} />
                  YouTube Integration
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="YouTube Channel/Podcast URL"
                      value={show.youtubeChannelUrl || ''}
                      onChange={(e) => handleChange('youtubeChannelUrl', e.target.value)}
                      placeholder="https://www.youtube.com/@yourchannel or channel URL"
                      helperText="Enter your YouTube channel or podcast page URL to enable automatic episode syncing"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <YouTube sx={{ color: '#FF0000' }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="YouTube Channel ID"
                      value={show.youtubeChannelId || ''}
                      onChange={(e) => handleChange('youtubeChannelId', e.target.value)}
                      placeholder="UC..."
                      helperText="Optional: Channel ID (auto-detected from URL)"
                      disabled={!show.youtubeChannelUrl}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Playlist ID (Optional)"
                      value={show.youtubePlaylistId || ''}
                      onChange={(e) => handleChange('youtubePlaylistId', e.target.value)}
                      placeholder="PL..."
                      helperText="Specific playlist for podcast episodes"
                      disabled={!show.youtubeChannelUrl}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={show.youtubeSyncEnabled || false}
                          onChange={(e) => handleChange('youtubeSyncEnabled', e.target.checked)}
                          disabled={!show.youtubeChannelUrl}
                        />
                      }
                      label="Enable YouTube Sync"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                      Automatically sync analytics and video metadata from YouTube
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={show.youtubeAutoCreateEpisodes || false}
                          onChange={(e) => handleChange('youtubeAutoCreateEpisodes', e.target.checked)}
                          disabled={!show.youtubeSyncEnabled}
                        />
                      }
                      label="Auto-Create Episodes"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                      Automatically create new episodes when videos are uploaded to YouTube
                    </Typography>
                  </Grid>

                  {show.youtubeLastSyncAt && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Sync sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          Last synced: {new Date(show.youtubeLastSyncAt).toLocaleString()}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            {/* Category & Tags */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Category sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Category & Tags
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <FormControl fullWidth required error={!!errors.category}>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={show.category}
                        label="Category"
                        onChange={(e) => handleChange('category', e.target.value)}
                      >
                        {categories.map(cat => (
                          <MenuItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Subcategory"
                      value={show.subcategory}
                      onChange={(e) => handleChange('subcategory', e.target.value)}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Tags
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                      {show.tags.map((tag) => (
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
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Monetization - Link to Revenue Projections */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Monetization
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body1" gutterBottom>
                    Monetization settings have been moved to the Revenue Projections tab for better integration.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AttachMoney />}
                    onClick={() => router.push(`/shows/${showId}?tab=revenue`)}
                    sx={{ mt: 2 }}
                  >
                    Go to Revenue Projections
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* Old monetization content removed - keeping the closing tags */}
            <Box sx={{ display: 'none' }}>
                <Grid container spacing={2}>
                  {/* Pricing Model Selection */}
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Pricing Model</InputLabel>
                      <Select
                        value={show.pricingModel || 'cpm'}
                        label="Pricing Model"
                        onChange={(e) => handleChange('pricingModel', e.target.value)}
                      >
                        <MenuItem value="cpm">CPM (Cost Per Thousand Impressions)</MenuItem>
                        <MenuItem value="spot">Cost Per Spot</MenuItem>
                        <MenuItem value="both">Both CPM and Cost Per Spot</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Average Episode Downloads - Admin Override */}
                  {user?.role === 'admin' || user?.role === 'master' ? (
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Average Episode Downloads"
                        type="number"
                        value={localInputs.avgEpisodeDownloads}
                        onChange={(e) => handleMonetizationInput('avgEpisodeDownloads', 'avgEpisodeDownloads', e.target.value, true)}
                        helperText={metricsDownloads ? `Actual avg from analytics: ${metricsDownloads.toLocaleString()}` : "Override for revenue calculations"}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">📊</InputAdornment>,
                        }}
                      />
                    </Grid>
                  ) : null}

                  {/* Pre-roll Section */}
                  <Grid item xs={12}>
                    <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                        Pre-roll Placement
                      </Typography>
                      <Grid container spacing={2} alignItems="center">
                        {(show.pricingModel === 'cpm' || show.pricingModel === 'both' || !show.pricingModel) && (
                          <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="CPM"
                              type="number"
                              value={localInputs.preRollCpm}
                              onChange={(e) => handleMonetizationInput('preRollCpm', 'preRollCpm', e.target.value)}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                              }}
                            />
                          </Grid>
                        )}
                        {(show.pricingModel === 'spot' || show.pricingModel === 'both') && (
                          <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Cost Per Spot"
                              type="number"
                              value={localInputs.preRollSpotCost}
                              onChange={(e) => handleMonetizationInput('preRollSpotCost', 'preRollSpotCost', e.target.value)}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                              }}
                            />
                          </Grid>
                        )}
                        <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Available Slots"
                            type="number"
                            value={localInputs.preRollSlots}
                            onChange={(e) => handleMonetizationInput('preRollSlots', 'preRollSlots', e.target.value, true)}
                            inputProps={{ min: 0, max: 5 }}
                          />
                        </Grid>
                        {(show.pricingModel === 'spot' || show.pricingModel === 'both') && (
                          <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 12}>
                            <Typography variant="caption" color="text.secondary">
                              Total: ${((show.preRollSpotCost || 0) * (show.preRollSlots || 0)).toFixed(2)}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </Box>
                  </Grid>

                  {/* Mid-roll Section */}
                  <Grid item xs={12}>
                    <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                        Mid-roll Placement
                      </Typography>
                      <Grid container spacing={2} alignItems="center">
                        {(show.pricingModel === 'cpm' || show.pricingModel === 'both' || !show.pricingModel) && (
                          <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="CPM"
                              type="number"
                              value={localInputs.midRollCpm}
                              onChange={(e) => handleMonetizationInput('midRollCpm', 'midRollCpm', e.target.value)}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                              }}
                            />
                          </Grid>
                        )}
                        {(show.pricingModel === 'spot' || show.pricingModel === 'both') && (
                          <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Cost Per Spot"
                              type="number"
                              value={localInputs.midRollSpotCost}
                              onChange={(e) => handleMonetizationInput('midRollSpotCost', 'midRollSpotCost', e.target.value)}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                              }}
                            />
                          </Grid>
                        )}
                        <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Available Slots"
                            type="number"
                            value={localInputs.midRollSlots}
                            onChange={(e) => handleMonetizationInput('midRollSlots', 'midRollSlots', e.target.value, true)}
                            inputProps={{ min: 0, max: 10 }}
                          />
                        </Grid>
                        {(show.pricingModel === 'spot' || show.pricingModel === 'both') && (
                          <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 12}>
                            <Typography variant="caption" color="text.secondary">
                              Total: ${((show.midRollSpotCost || 0) * (show.midRollSlots || 0)).toFixed(2)}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </Box>
                  </Grid>

                  {/* Post-roll Section */}
                  <Grid item xs={12}>
                    <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                        Post-roll Placement
                      </Typography>
                      <Grid container spacing={2} alignItems="center">
                        {(show.pricingModel === 'cpm' || show.pricingModel === 'both' || !show.pricingModel) && (
                          <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="CPM"
                              type="number"
                              value={localInputs.postRollCpm}
                              onChange={(e) => handleMonetizationInput('postRollCpm', 'postRollCpm', e.target.value)}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                              }}
                            />
                          </Grid>
                        )}
                        {(show.pricingModel === 'spot' || show.pricingModel === 'both') && (
                          <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Cost Per Spot"
                              type="number"
                              value={localInputs.postRollSpotCost}
                              onChange={(e) => handleMonetizationInput('postRollSpotCost', 'postRollSpotCost', e.target.value)}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                              }}
                            />
                          </Grid>
                        )}
                        <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Available Slots"
                            type="number"
                            value={localInputs.postRollSlots}
                            onChange={(e) => handleMonetizationInput('postRollSlots', 'postRollSlots', e.target.value, true)}
                            inputProps={{ min: 0, max: 5 }}
                          />
                        </Grid>
                        {(show.pricingModel === 'spot' || show.pricingModel === 'both') && (
                          <Grid item xs={12} md={show.pricingModel === 'both' ? 3 : 12}>
                            <Typography variant="caption" color="text.secondary">
                              Total: ${((show.postRollSpotCost || 0) * (show.postRollSlots || 0)).toFixed(2)}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </Box>
                  </Grid>

                  {/* Summary */}
                  <Grid item xs={12}>
                    <Box sx={{ 
                      bgcolor: 'primary.50', 
                      p: 1.5, 
                      borderRadius: 1, 
                      border: '1px solid',
                      borderColor: 'primary.main'
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          Episode Revenue Summary
                        </Typography>
                        {megaphoneLoading ? (
                          <Typography variant="caption" color="text.secondary">Loading data...</Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Avg Downloads: {(show.avgEpisodeDownloads || metricsDownloads || 5000).toLocaleString()}
                          </Typography>
                        )}
                      </Box>

                      {show.pricingModel === 'cpm' && (
                        <>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2">Pre-roll ({show.preRollSlots || 0} slots × {(show.avgEpisodeDownloads || metricsDownloads || 5000).toLocaleString()} downloads)</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${calculateCpmRevenue(show.preRollCpm || 0, show.preRollSlots || 0, show.avgEpisodeDownloads || metricsDownloads || 5000).toFixed(2)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2">Mid-roll ({show.midRollSlots || 0} slots × {(show.avgEpisodeDownloads || metricsDownloads || 5000).toLocaleString()} downloads)</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${calculateCpmRevenue(show.midRollCpm || 0, show.midRollSlots || 0, show.avgEpisodeDownloads || metricsDownloads || 5000).toFixed(2)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Post-roll ({show.postRollSlots || 0} slots × {(show.avgEpisodeDownloads || metricsDownloads || 5000).toLocaleString()} downloads)</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${calculateCpmRevenue(show.postRollCpm || 0, show.postRollSlots || 0, show.avgEpisodeDownloads || metricsDownloads || 5000).toFixed(2)}
                            </Typography>
                          </Box>
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              Total per Episode (CPM)
                            </Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                              ${calculateTotalEpisodeRevenue().toFixed(2)}
                            </Typography>
                          </Box>
                        </>
                      )}

                      {show.pricingModel === 'spot' && (
                        <>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2">Pre-roll ({show.preRollSlots || 0} slots)</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${((show.preRollSpotCost || 0) * (show.preRollSlots || 0)).toFixed(2)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2">Mid-roll ({show.midRollSlots || 0} slots)</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${((show.midRollSpotCost || 0) * (show.midRollSlots || 0)).toFixed(2)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Post-roll ({show.postRollSlots || 0} slots)</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${((show.postRollSpotCost || 0) * (show.postRollSlots || 0)).toFixed(2)}
                            </Typography>
                          </Box>
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              Total per Sold-Out Episode
                            </Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                              ${calculateTotalEpisodeRevenue().toFixed(2)}
                            </Typography>
                          </Box>
                        </>
                      )}

                      {show.pricingModel === 'both' && (
                        <>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>Cost Per Spot Revenue:</Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, ml: 1 }}>
                            <Typography variant="body2">Pre-roll ({show.preRollSlots || 0} slots)</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${((show.preRollSpotCost || 0) * (show.preRollSlots || 0)).toFixed(2)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, ml: 1 }}>
                            <Typography variant="body2">Mid-roll ({show.midRollSlots || 0} slots)</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${((show.midRollSpotCost || 0) * (show.midRollSlots || 0)).toFixed(2)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, ml: 1 }}>
                            <Typography variant="body2">Post-roll ({show.postRollSlots || 0} slots)</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${((show.postRollSpotCost || 0) * (show.postRollSlots || 0)).toFixed(2)}
                            </Typography>
                          </Box>

                          <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>CPM Revenue:</Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, ml: 1 }}>
                            <Typography variant="body2">Pre-roll ({show.preRollSlots || 0} × {(show.avgEpisodeDownloads || metricsDownloads || 5000).toLocaleString()})</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${calculateCpmRevenue(show.preRollCpm || 0, show.preRollSlots || 0, show.avgEpisodeDownloads || metricsDownloads || 5000).toFixed(2)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, ml: 1 }}>
                            <Typography variant="body2">Mid-roll ({show.midRollSlots || 0} × {(show.avgEpisodeDownloads || metricsDownloads || 5000).toLocaleString()})</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${calculateCpmRevenue(show.midRollCpm || 0, show.midRollSlots || 0, show.avgEpisodeDownloads || metricsDownloads || 5000).toFixed(2)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, ml: 1 }}>
                            <Typography variant="body2">Post-roll ({show.postRollSlots || 0} × {(show.avgEpisodeDownloads || metricsDownloads || 5000).toLocaleString()})</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              ${calculateCpmRevenue(show.postRollCpm || 0, show.postRollSlots || 0, show.avgEpisodeDownloads || metricsDownloads || 5000).toFixed(2)}
                            </Typography>
                          </Box>

                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              Combined Total per Episode
                            </Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                              ${calculateTotalEpisodeRevenue().toFixed(2)}
                            </Typography>
                          </Box>
                        </>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
          </Grid>

          {/* Target Audience */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Target Audience
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Target Audience Description"
                  value={show.targetAudience}
                  onChange={(e) => handleChange('targetAudience', e.target.value)}
                  placeholder="Describe your ideal listener demographics, interests, and behaviors..."
                />
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
            Show details updated successfully!
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  )
}