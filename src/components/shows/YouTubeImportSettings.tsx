'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
  TextField,
  Box,
  Button,
  Alert,
  Divider,
  Chip,
  Tooltip,
  IconButton,
  Collapse
} from '@mui/material'
import {
  YouTube as YouTubeIcon,
  FilterList as FilterIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon
} from '@mui/icons-material'
import { api } from '@/lib/api'

interface YouTubeImportSettingsProps {
  showId: string
  showName: string
}

interface ImportSettings {
  youtubeImportPodcasts: boolean
  youtubeImportShorts: boolean
  youtubeImportClips: boolean
  youtubeImportLive: boolean
  youtubeMinDuration: number
  youtubeMaxDuration: number | null
  youtubeTitleFilter: string | null
  youtubeExcludeFilter: string | null
}

export function YouTubeImportSettings({ showId, showName }: YouTubeImportSettingsProps) {
  const [settings, setSettings] = useState<ImportSettings>({
    youtubeImportPodcasts: true,
    youtubeImportShorts: false,
    youtubeImportClips: false,
    youtubeImportLive: false,
    youtubeMinDuration: 600, // 10 minutes default
    youtubeMaxDuration: null,
    youtubeTitleFilter: null,
    youtubeExcludeFilter: null
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [showId])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/shows/${showId}/youtube-settings`)
      if (response.data) {
        setSettings(response.data)
      }
    } catch (error: any) {
      console.error('Error loading YouTube settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      
      await api.put(`/shows/${showId}/youtube-settings`, settings)
      setSuccess('YouTube import settings saved successfully')
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      console.error('Error saving settings:', error)
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'No limit'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes} minutes`
  }

  const estimateContent = () => {
    const types = []
    if (settings.youtubeImportPodcasts) types.push('Podcasts')
    if (settings.youtubeImportShorts) types.push('Shorts')
    if (settings.youtubeImportClips) types.push('Clips')
    if (settings.youtubeImportLive) types.push('Live Streams')
    
    if (types.length === 0) return 'No content will be imported'
    return `Will import: ${types.join(', ')}`
  }

  if (loading) {
    return <Typography>Loading settings...</Typography>
  }

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <YouTubeIcon sx={{ color: '#FF0000' }} />
            <Typography variant="h6">YouTube Import Settings</Typography>
          </Box>
        }
        action={
          <IconButton onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        }
      />
      
      <Collapse in={expanded}>
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Configure what type of content to import from YouTube for {showName}
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Chip 
              label={estimateContent()} 
              color={settings.youtubeImportPodcasts || settings.youtubeImportShorts || settings.youtubeImportClips || settings.youtubeImportLive ? 'primary' : 'default'}
              size="small"
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Content Type Toggles */}
          <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon fontSize="small" />
            Content Types
          </Typography>
          
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.youtubeImportPodcasts}
                  onChange={(e) => setSettings({ ...settings, youtubeImportPodcasts: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography>Podcast Episodes</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Full episodes, typically 20+ minutes with episode numbers
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.youtubeImportShorts}
                  onChange={(e) => setSettings({ ...settings, youtubeImportShorts: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography>YouTube Shorts</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Vertical videos under 60 seconds
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.youtubeImportClips}
                  onChange={(e) => setSettings({ ...settings, youtubeImportClips: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography>Clips & Highlights</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Short clips, highlights, or segments from episodes
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.youtubeImportLive}
                  onChange={(e) => setSettings({ ...settings, youtubeImportLive: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography>Live Streams</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Live broadcasts and Q&A sessions
                  </Typography>
                </Box>
              }
            />
          </FormGroup>

          <Divider sx={{ my: 3 }} />

          {/* Advanced Filters */}
          <Typography variant="subtitle1" gutterBottom>
            Advanced Filters
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Minimum Duration (seconds)"
              type="number"
              value={settings.youtubeMinDuration}
              onChange={(e) => setSettings({ ...settings, youtubeMinDuration: parseInt(e.target.value) || 0 })}
              helperText={`Currently: ${formatDuration(settings.youtubeMinDuration)}`}
              size="small"
              sx={{ flex: 1 }}
            />
            
            <TextField
              label="Maximum Duration (seconds)"
              type="number"
              value={settings.youtubeMaxDuration || ''}
              onChange={(e) => setSettings({ ...settings, youtubeMaxDuration: e.target.value ? parseInt(e.target.value) : null })}
              helperText={`Currently: ${formatDuration(settings.youtubeMaxDuration)}`}
              placeholder="No limit"
              size="small"
              sx={{ flex: 1 }}
            />
          </Box>

          <TextField
            fullWidth
            label="Title Must Contain (Regex)"
            value={settings.youtubeTitleFilter || ''}
            onChange={(e) => setSettings({ ...settings, youtubeTitleFilter: e.target.value || null })}
            placeholder="e.g., #\d+|Episode \d+"
            helperText="Videos must match this pattern to be imported"
            size="small"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Title Must NOT Contain (Regex)"
            value={settings.youtubeExcludeFilter || ''}
            onChange={(e) => setSettings({ ...settings, youtubeExcludeFilter: e.target.value || null })}
            placeholder="e.g., trailer|preview|teaser"
            helperText="Videos matching this pattern will be skipped"
            size="small"
            sx={{ mb: 3 }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              <InfoIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              These settings will apply to all future YouTube syncs
            </Typography>
            
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  )
}