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
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormGroup,
  Badge,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Tooltip,
} from '@mui/material'
import {
  Search as SearchIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Podcasts as PodcastIcon,
  Category as CategoryIcon,
  Numbers as NumbersIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  TrendingUp as TrendingUpIcon,
  Groups as GroupsIcon,
  AttachMoney as MoneyIcon,
  Schedule as ScheduleIcon,
  ViewList as ListIcon,
  ViewModule as GridIcon,
  Star as StarIcon,
  Language as LanguageIcon,
  LocationOn as LocationIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { showsApi } from '@/services/api'
import { toast } from '@/lib/toast'

interface Show {
  id: string
  name: string
  description?: string
  host?: string
  category?: string
  episodeCount?: number
  imageUrl?: string
  subscriberCount?: number
  monthlyDownloads?: number
  averageListeners?: number
  releaseFrequency?: string
  releaseDay?: string
  status?: string
  subscriberGrowth?: number
  targetLanguage?: string
  targetRegions?: string[]
  customCategory1?: string
  customCategory2?: string
  customCategory3?: string
  averageRating?: number
  priceRange?: {
    min: number
    max: number
  }
}

interface ShowSelectorAdvancedProps {
  selectedShows: Show[]
  onAddShow: (show: Show) => void
  onRemoveShow: (showId: string) => void
}

const AUDIENCE_SIZE_RANGES = [
  { label: '< 10K', min: 0, max: 10000 },
  { label: '10K - 50K', min: 10000, max: 50000 },
  { label: '50K - 100K', min: 50000, max: 100000 },
  { label: '100K - 500K', min: 100000, max: 500000 },
  { label: '500K+', min: 500000, max: Infinity },
]

const RELEASE_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'irregular']
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Chinese', 'Japanese', 'Korean']

export function ShowSelectorAdvanced({ selectedShows, onAddShow, onRemoveShow }: ShowSelectorAdvancedProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<string>('name')
  
  // Advanced filters
  const [audienceSizeFilter, setAudienceSizeFilter] = useState<string[]>([])
  const [releaseFrequencyFilter, setReleaseFrequencyFilter] = useState<string[]>([])
  const [releaseDayFilter, setReleaseDayFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [growthRateFilter, setGrowthRateFilter] = useState<number[]>([0, 100])
  const [languageFilter, setLanguageFilter] = useState<string[]>([])
  const [ratingFilter, setRatingFilter] = useState<number>(0)
  const [priceRangeFilter, setPriceRangeFilter] = useState<number[]>([0, 5000])

  // Fetch shows with enhanced data and proper error handling
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['shows-enhanced'],
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

  // Safely extract and transform shows array from response
  const rawShows = Array.isArray(response) ? response : (response?.shows || [])
  
  // Transform data to include enhanced fields with defensive checks
  const shows = rawShows
    .filter(show => show && typeof show === 'object')
    .map((show: any) => ({
      id: show.id || '',
      name: show.name || 'Unnamed Show',
      description: show.description || '',
      host: show.host || 'Unknown',
      category: show.category || 'General',
      episodeCount: show.episodeCount || 0,
      imageUrl: show.imageUrl || '',
      subscriberCount: show.subscriberCount || show.subscribers || 0,
      monthlyDownloads: show.monthlyDownloads || 0,
      averageListeners: show.averageListeners || 0,
      releaseFrequency: show.releaseFrequency || show.frequency || 'weekly',
      releaseDay: show.releaseDay || '',
      status: show.status || 'active',
      subscriberGrowth: show.subscriberGrowth || 0,
      targetLanguage: show.targetLanguage || 'English',
      targetRegions: show.targetRegions || [],
      customCategory1: show.customCategory1 || '',
      customCategory2: show.customCategory2 || '',
      customCategory3: show.customCategory3 || '',
      averageRating: show.averageRating || 4.0,
      priceRange: show.priceRange || { min: 500, max: 2000 }
    }))

  // Get unique categories with defensive checks
  const allCategories = Array.from(new Set([
    ...shows.map(show => show.category),
    ...shows.map(show => show.customCategory1),
    ...shows.map(show => show.customCategory2),
    ...shows.map(show => show.customCategory3),
  ].filter(Boolean)))

  // Filter shows based on all criteria with defensive checks
  const filteredShows = shows.filter(show => {
    // Search filter
    const matchesSearch = 
      show.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      show.host?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      show.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Category filter
    const matchesCategory = selectedCategories.length === 0 || 
      selectedCategories.some(cat => 
        show.category === cat ||
        show.customCategory1 === cat ||
        show.customCategory2 === cat ||
        show.customCategory3 === cat
      )
    
    // Audience size filter
    const matchesAudienceSize = audienceSizeFilter.length === 0 ||
      audienceSizeFilter.some(range => {
        const rangeObj = AUDIENCE_SIZE_RANGES.find(r => r.label === range)
        if (!rangeObj) return false
        const subscribers = show.subscriberCount || 0
        return subscribers >= rangeObj.min && subscribers < rangeObj.max
      })
    
    // Release frequency filter
    const matchesFrequency = releaseFrequencyFilter.length === 0 ||
      releaseFrequencyFilter.includes(show.releaseFrequency || '')
    
    // Release day filter
    const matchesDay = releaseDayFilter.length === 0 ||
      releaseDayFilter.includes(show.releaseDay || '')
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || show.status === statusFilter
    
    // Growth rate filter
    const growth = show.subscriberGrowth || 0
    const matchesGrowth = growth >= growthRateFilter[0] && growth <= growthRateFilter[1]
    
    // Language filter
    const matchesLanguage = languageFilter.length === 0 || 
      languageFilter.includes(show.targetLanguage || 'English')
    
    // Rating filter
    const matchesRating = (show.averageRating || 0) >= ratingFilter
    
    // Price range filter
    const showMinPrice = show.priceRange?.min || 0
    const showMaxPrice = show.priceRange?.max || 5000
    const matchesPrice = 
      showMinPrice <= priceRangeFilter[1] && showMaxPrice >= priceRangeFilter[0]
    
    return matchesSearch && matchesCategory && matchesAudienceSize && 
           matchesFrequency && matchesDay && matchesStatus && 
           matchesGrowth && matchesLanguage && matchesRating && matchesPrice
  })

  // Sort shows
  const sortedShows = [...filteredShows].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '')
      case 'subscribers':
        return (b.subscriberCount || 0) - (a.subscriberCount || 0)
      case 'downloads':
        return (b.monthlyDownloads || 0) - (a.monthlyDownloads || 0)
      case 'growth':
        return (b.subscriberGrowth || 0) - (a.subscriberGrowth || 0)
      case 'rating':
        return (b.averageRating || 0) - (a.averageRating || 0)
      case 'price':
        return (b.priceRange?.max || 0) - (a.priceRange?.max || 0)
      default:
        return 0
    }
  })

  const isShowSelected = (showId: string) => {
    return selectedShows.some(s => s.id === showId)
  }

  const handleSelectAll = () => {
    const unselectedShows = sortedShows.filter(show => !isShowSelected(show.id))
    unselectedShows.forEach(show => onAddShow(show))
  }

  const handleClearSelection = () => {
    selectedShows.forEach(show => onRemoveShow(show.id))
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedCategories([])
    setAudienceSizeFilter([])
    setReleaseFrequencyFilter([])
    setReleaseDayFilter([])
    setStatusFilter('active')
    setGrowthRateFilter([0, 100])
    setLanguageFilter([])
    setRatingFilter(0)
    setPriceRangeFilter([0, 5000])
  }

  // Count active filters
  const activeFilterCount = [
    selectedCategories.length,
    audienceSizeFilter.length,
    releaseFrequencyFilter.length,
    releaseDayFilter.length,
    statusFilter !== 'active' ? 1 : 0,
    growthRateFilter[0] !== 0 || growthRateFilter[1] !== 100 ? 1 : 0,
    languageFilter.length,
    ratingFilter > 0 ? 1 : 0,
    priceRangeFilter[0] !== 0 || priceRangeFilter[1] !== 5000 ? 1 : 0,
  ].reduce((sum, count) => sum + count, 0)

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
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
      {/* Search and Filter Bar */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              placeholder="Search shows by name, host, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={7}>
            <Box display="flex" gap={1} alignItems="center" justifyContent="flex-end">
              <Badge badgeContent={activeFilterCount} color="primary">
                <Button
                  variant="outlined"
                  startIcon={<FilterIcon />}
                  endIcon={filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                >
                  Advanced Filters
                </Button>
              </Badge>
              
              {activeFilterCount > 0 && (
                <Button
                  size="small"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </Button>
              )}
              
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, newMode) => newMode && setViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="grid">
                  <GridIcon />
                </ToggleButton>
                <ToggleButton value="list">
                  <ListIcon />
                </ToggleButton>
              </ToggleButtonGroup>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort by</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  label="Sort by"
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="subscribers">Subscribers</MenuItem>
                  <MenuItem value="downloads">Downloads</MenuItem>
                  <MenuItem value="growth">Growth Rate</MenuItem>
                  <MenuItem value="rating">Rating</MenuItem>
                  <MenuItem value="price">Price</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Grid>
        </Grid>

        {/* Advanced Filters Panel */}
        <Collapse in={filtersExpanded}>
          <Divider sx={{ my: 3 }} />
          <Grid container spacing={3}>
            {/* Categories */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Categories
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {allCategories.length > 0 ? (
                  allCategories.map(category => (
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

            {/* Audience Size */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Audience Size
              </Typography>
              <FormGroup row>
                {AUDIENCE_SIZE_RANGES.map(range => (
                  <FormControlLabel
                    key={range.label}
                    control={
                      <Checkbox
                        checked={audienceSizeFilter.includes(range.label)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAudienceSizeFilter([...audienceSizeFilter, range.label])
                          } else {
                            setAudienceSizeFilter(audienceSizeFilter.filter(r => r !== range.label))
                          }
                        }}
                      />
                    }
                    label={range.label}
                  />
                ))}
              </FormGroup>
            </Grid>

            {/* Release Frequency */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Release Frequency
              </Typography>
              <FormGroup row>
                {RELEASE_FREQUENCIES.map(freq => (
                  <FormControlLabel
                    key={freq}
                    control={
                      <Checkbox
                        checked={releaseFrequencyFilter.includes(freq)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setReleaseFrequencyFilter([...releaseFrequencyFilter, freq])
                          } else {
                            setReleaseFrequencyFilter(releaseFrequencyFilter.filter(f => f !== freq))
                          }
                        }}
                      />
                    }
                    label={freq.charAt(0).toUpperCase() + freq.slice(1)}
                  />
                ))}
              </FormGroup>
            </Grid>

            {/* Growth Rate */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Subscriber Growth Rate: {growthRateFilter[0]}% - {growthRateFilter[1]}%
              </Typography>
              <Slider
                value={growthRateFilter}
                onChange={(e, newValue) => setGrowthRateFilter(newValue as number[])}
                valueLabelDisplay="auto"
                min={-50}
                max={200}
                marks={[
                  { value: -50, label: '-50%' },
                  { value: 0, label: '0%' },
                  { value: 50, label: '50%' },
                  { value: 100, label: '100%' },
                  { value: 200, label: '200%' },
                ]}
              />
            </Grid>

            {/* Price Range */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Price Range: ${priceRangeFilter[0]} - ${priceRangeFilter[1]}
              </Typography>
              <Slider
                value={priceRangeFilter}
                onChange={(e, newValue) => setPriceRangeFilter(newValue as number[])}
                valueLabelDisplay="auto"
                min={0}
                max={10000}
                step={100}
                marks={[
                  { value: 0, label: '$0' },
                  { value: 2500, label: '$2.5K' },
                  { value: 5000, label: '$5K' },
                  { value: 7500, label: '$7.5K' },
                  { value: 10000, label: '$10K' },
                ]}
              />
            </Grid>
          </Grid>
        </Collapse>
      </Paper>

      {/* Selected Shows Summary */}
      {selectedShows.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Selected Shows ({selectedShows.length})
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {selectedShows.slice(0, 5).map(show => (
                  <Chip
                    key={show.id}
                    label={show.name}
                    onDelete={() => onRemoveShow(show.id)}
                    color="primary"
                  />
                ))}
                {selectedShows.length > 5 && (
                  <Chip
                    label={`+${selectedShows.length - 5} more`}
                    color="primary"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>
            <Box display="flex" gap={1}>
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={handleClearSelection}
              >
                Clear All
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Quick Actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="body2" color="text.secondary">
          {sortedShows.length} shows found
          {sortedShows.length !== shows.length && ` (${shows.length} total)`}
        </Typography>
        {sortedShows.length > 0 && (
          <Button
            size="small"
            onClick={handleSelectAll}
            disabled={sortedShows.every(show => isShowSelected(show.id))}
          >
            Select All Visible
          </Button>
        )}
      </Box>

      {/* Shows Display */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : sortedShows.length > 0 ? (
        viewMode === 'grid' ? (
          <Grid container spacing={3}>
            {sortedShows.map(show => {
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
                      bgcolor: selected ? 'primary.50' : 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 3,
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Avatar 
                          sx={{ bgcolor: 'primary.main', mr: 2 }}
                          src={show.imageUrl}
                        >
                          <PodcastIcon />
                        </Avatar>
                        <Box flexGrow={1}>
                          <Typography variant="h6" gutterBottom noWrap>
                            {show.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            Hosted by {show.host}
                          </Typography>
                        </Box>
                        {show.averageRating && show.averageRating > 0 && (
                          <Chip
                            icon={<StarIcon />}
                            label={show.averageRating.toFixed(1)}
                            size="small"
                            color="warning"
                          />
                        )}
                      </Box>

                      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                        <Chip
                          icon={<CategoryIcon />}
                          label={show.category}
                          size="small"
                          variant="outlined"
                        />
                        {show.episodeCount > 0 && (
                          <Chip
                            icon={<NumbersIcon />}
                            label={`${show.episodeCount} episodes`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {show.releaseFrequency && (
                          <Chip
                            icon={<ScheduleIcon />}
                            label={show.releaseFrequency}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>

                      {/* Metrics */}
                      <Grid container spacing={2} mb={2}>
                        <Grid item xs={6}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Subscribers
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              <GroupsIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                              {formatNumber(show.subscriberCount)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Growth
                            </Typography>
                            <Typography 
                              variant="body2" 
                              fontWeight="medium"
                              color={show.subscriberGrowth > 0 ? 'success.main' : 'text.primary'}
                            >
                              <TrendingUpIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                              {show.subscriberGrowth > 0 ? '+' : ''}{show.subscriberGrowth}%
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Price Range */}
                      {show.priceRange && (
                        <Box display="flex" alignItems="center" gap={1}>
                          <MoneyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            ${show.priceRange.min} - ${show.priceRange.max}
                          </Typography>
                        </Box>
                      )}

                      {show.description && (
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ 
                            mt: 2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
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
                          Remove
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={() => onAddShow(show)}
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
          <Paper>
            {/* List View */}
            {sortedShows.map((show, index) => {
              const selected = isShowSelected(show.id)
              return (
                <Box key={show.id}>
                  {index > 0 && <Divider />}
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: selected ? 'primary.50' : 'transparent',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      }
                    }}
                  >
                    <Grid container alignItems="center" spacing={2}>
                      <Grid item xs={12} md={5}>
                        <Box display="flex" alignItems="center">
                          <Avatar 
                            sx={{ bgcolor: 'primary.main', mr: 2 }}
                            src={show.imageUrl}
                          >
                            <PodcastIcon />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {show.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {show.host} • {show.category}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <Typography variant="body2" color="text.secondary">
                          {formatNumber(show.subscriberCount)} subscribers
                        </Typography>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <Typography 
                          variant="body2" 
                          color={show.subscriberGrowth > 0 ? 'success.main' : 'text.secondary'}
                        >
                          {show.subscriberGrowth > 0 ? '+' : ''}{show.subscriberGrowth}% growth
                        </Typography>
                      </Grid>
                      <Grid item xs={6} md={1}>
                        <Typography variant="body2" color="text.secondary">
                          ${show.priceRange?.min} - ${show.priceRange?.max}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} md={2} sx={{ textAlign: 'right' }}>
                        {selected ? (
                          <Button
                            color="error"
                            startIcon={<RemoveIcon />}
                            onClick={() => onRemoveShow(show.id)}
                          >
                            Remove
                          </Button>
                        ) : (
                          <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => onAddShow(show)}
                          >
                            Add
                          </Button>
                        )}
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              )
            })}
          </Paper>
        )
      ) : (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="text.secondary">
            {shows.length === 0 
              ? 'No shows available' 
              : 'No shows found matching your filters'}
          </Typography>
          {activeFilterCount > 0 && (
            <Button
              sx={{ mt: 2 }}
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          )}
        </Box>
      )}
    </Box>
  )
}