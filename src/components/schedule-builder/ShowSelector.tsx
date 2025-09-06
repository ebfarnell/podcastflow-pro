'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Avatar,
  IconButton,
  CircularProgress,
  Paper,
  Checkbox,
  FormControlLabel,
  Divider,
  Alert
} from '@mui/material'
import {
  Search as SearchIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Podcasts as PodcastIcon,
  Category as CategoryIcon,
  Numbers as NumbersIcon,
  Error as ErrorIcon
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { showsApi } from '@/services/api'
import { Show } from '@/hooks/useScheduleBuilder'

interface ShowSelectorProps {
  selectedShows: Show[]
  onAddShow: (show: Show) => void
  onRemoveShow: (showId: string) => void
}

export function ShowSelector({ selectedShows, onAddShow, onRemoveShow }: ShowSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Fetch shows with proper error handling
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['shows'],
    queryFn: async () => {
      try {
        const result = await showsApi.list()
        return result
      } catch (err) {
        console.error('Error fetching shows:', err)
        throw err
      }
    }
  })

  // Safely extract shows array from response
  const shows = Array.isArray(response) ? response : (response?.shows || [])

  // Get unique categories with defensive checks
  const categories = Array.from(
    new Set(
      shows
        .filter(show => show && typeof show === 'object')
        .map(show => show.category)
        .filter(Boolean)
    )
  )

  // Filter shows based on search and categories with defensive checks
  const filteredShows = shows.filter(show => {
    if (!show || typeof show !== 'object') return false
    
    const showName = show.name || ''
    const showHost = show.host || ''
    const showCategory = show.category || ''
    
    const matchesSearch = 
      showName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      showHost.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = 
      selectedCategories.length === 0 || 
      selectedCategories.includes(showCategory)
    
    return matchesSearch && matchesCategory
  })

  const isShowSelected = (showId: string) => {
    return selectedShows.some(s => s.id === showId)
  }

  // Error state
  if (error) {
    return (
      <Box>
        <Alert severity="error" icon={<ErrorIcon />}>
          <Typography variant="h6">Error loading shows</Typography>
          <Typography variant="body2">
            {error instanceof Error ? error.message : 'Failed to load shows. Please try again.'}
          </Typography>
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      {/* Search and Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search shows by name or host..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                Categories:
              </Typography>
              {categories.length > 0 ? (
                categories.map(category => (
                  <Chip
                    key={category}
                    label={category}
                    onClick={() => {
                      setSelectedCategories(prev =>
                        prev.includes(category)
                          ? prev.filter(c => c !== category)
                          : [...prev, category]
                      )
                    }}
                    color={selectedCategories.includes(category) ? 'primary' : 'default'}
                    variant={selectedCategories.includes(category) ? 'filled' : 'outlined'}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No categories available
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Selected Shows Summary */}
      {selectedShows.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
          <Typography variant="subtitle1" gutterBottom>
            Selected Shows ({selectedShows.length})
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {selectedShows.map(show => (
              <Chip
                key={show.id}
                label={show.name}
                onDelete={() => onRemoveShow(show.id)}
                color="primary"
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Shows Grid */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : filteredShows.length > 0 ? (
        <Grid container spacing={3}>
          {filteredShows.map(show => {
            if (!show || !show.id) return null
            
            const selected = isShowSelected(show.id)
            return (
              <Grid item xs={12} sm={6} md={4} key={show.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    border: selected ? 2 : 0,
                    borderColor: 'primary.main',
                    bgcolor: selected ? 'primary.50' : 'background.paper'
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                        <PodcastIcon />
                      </Avatar>
                      <Box flexGrow={1}>
                        <Typography variant="h6" gutterBottom>
                          {show.name || 'Unnamed Show'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Hosted by {show.host || 'Unknown'}
                        </Typography>
                      </Box>
                    </Box>

                    <Box display="flex" gap={1} mb={2}>
                      <Chip
                        icon={<CategoryIcon />}
                        label={show.category || 'General'}
                        size="small"
                        variant="outlined"
                      />
                      {show.episodeCount !== undefined && show.episodeCount > 0 && (
                        <Chip
                          icon={<NumbersIcon />}
                          label={`${show.episodeCount} episodes`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    {show.description && (
                      <Typography variant="body2" color="text.secondary">
                        {show.description}
                      </Typography>
                    )}
                  </CardContent>
                  
                  <Divider />
                  
                  <CardActions>
                    {selected ? (
                      <Button
                        fullWidth
                        color="error"
                        startIcon={<RemoveIcon />}
                        onClick={() => onRemoveShow(show.id)}
                      >
                        Remove from Schedule
                      </Button>
                    ) : (
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => onAddShow({
                          ...show,  // Pass all show data including monetization fields
                          id: show.id,
                          name: show.name || 'Unnamed Show',
                          host: show.host || 'Unknown',
                          category: show.category || 'General',
                          episodeCount: show.episodeCount
                        })}
                      >
                        Add to Schedule
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      ) : (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="text.secondary">
            {shows.length === 0 
              ? 'No shows available' 
              : 'No shows found matching your criteria'}
          </Typography>
        </Box>
      )}
    </Box>
  )
}