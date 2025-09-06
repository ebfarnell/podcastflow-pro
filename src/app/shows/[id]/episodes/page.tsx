'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  TablePagination,
  Menu,
  Card,
  CardContent,
  Grid,
  Avatar,
  CircularProgress,
} from '@mui/material'
import {
  ArrowBack,
  Add,
  Search,
  FilterList,
  Download,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  Schedule,
  PlayCircle,
  CheckCircle,
  Warning,
  Mic,
  AccessTime,
  CalendarToday,
  AttachMoney,
  Campaign,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import Link from 'next/link'

interface Episode {
  id: string
  episodeNumber: number
  title: string
  talentNotes?: string
  producerNotes?: string
  duration: number
  airDate: string
  status: string
  downloads?: number
  listens?: number
  adSlots?: number
  filledSlots?: number
  revenue?: number
}

export default function ShowEpisodesPage() {
  const router = useRouter()
  const params = useParams()
  const showId = params.id as string

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)

  // Fetch show data
  const { data: showData } = useQuery({
    queryKey: ['show', showId],
    queryFn: async () => {
      const response = await fetch(`/api/shows/${showId}`)
      if (!response.ok) throw new Error('Failed to fetch show')
      return response.json()
    },
    enabled: !!showId
  })

  // Fetch episodes data
  const { data: episodesData, isLoading } = useQuery({
    queryKey: ['episodes', showId],
    queryFn: async () => {
      const response = await fetch(`/api/shows/${showId}/episodes`)
      if (!response.ok) throw new Error('Failed to fetch episodes')
      return response.json()
    },
    enabled: !!showId
  })

  const showName = showData?.name || 'Show'
  const episodes: Episode[] = episodesData || []

  const filteredEpisodes = episodes.filter(episode => {
    const matchesSearch = 
      episode.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (episode.talentNotes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (episode.producerNotes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      episode.episodeNumber.toString().includes(searchQuery)
    
    const matchesStatus = statusFilter === 'all' || episode.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const totalRevenue = filteredEpisodes.reduce((sum, ep) => sum + (ep.revenue || 0), 0)
  const totalDownloads = filteredEpisodes.reduce((sum, ep) => sum + (ep.downloads || 0), 0)
  const totalListens = filteredEpisodes.reduce((sum, ep) => sum + (ep.listens || 0), 0)
  const avgAdFillRate = filteredEpisodes.length > 0
    ? filteredEpisodes.reduce((sum, ep) => {
        const slots = ep.adSlots || 1
        const filled = ep.filledSlots || 0
        return sum + (filled / slots * 100)
      }, 0) / filteredEpisodes.length
    : 0

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, episode: Episode) => {
    setAnchorEl(event.currentTarget)
    setSelectedEpisode(episode)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'published':
      case 'confirmed': return <CheckCircle fontSize="small" />
      case 'scheduled':
      case 'pending': return <Schedule fontSize="small" />
      case 'draft': return <Edit fontSize="small" />
      case 'recording': return <Mic fontSize="small" />
      default: return <Warning fontSize="small" />
    }
  }

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'published':
      case 'confirmed': return 'success'
      case 'scheduled':
      case 'pending': return 'info'
      case 'draft': return 'default'
      case 'recording': return 'warning'
      default: return 'default'
    }
  }

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '00:00'
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push(`/shows/${showId}`)} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {showName} - Episodes
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage episodes, ad placements, and publishing schedule
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => router.push('/episodes/new')}
          >
            New Episode
          </Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Episodes
                    </Typography>
                    <Typography variant="h5">
                      {filteredEpisodes.length}
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      {filteredEpisodes.filter(ep => ep.status === 'published').length} published
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main' }}>
                    <PlayCircle />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Revenue
                    </Typography>
                    <Typography variant="h5">
                      ${totalRevenue.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      From ad placements
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'success.light', color: 'success.main' }}>
                    <AttachMoney />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Downloads
                    </Typography>
                    <Typography variant="h5">
                      {totalDownloads >= 1000 ? `${(totalDownloads / 1000).toFixed(1)}K` : totalDownloads}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {totalListens >= 1000 ? `${(totalListens / 1000).toFixed(1)}K` : totalListens} listens
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'info.light', color: 'info.main' }}>
                    <Download />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Ad Fill Rate
                    </Typography>
                    <Typography variant="h5">
                      {avgAdFillRate.toFixed(0)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Average across episodes
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'warning.light', color: 'warning.main' }}>
                    <Campaign />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search episodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, maxWidth: 400 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="published">Published</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="recording">Recording</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
            >
              More Filters
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download />}
            >
              Export
            </Button>
          </Box>
        </Paper>

        {/* Episodes Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Episode</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Release Date</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Downloads</TableCell>
                <TableCell>Ad Slots</TableCell>
                <TableCell>Revenue</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredEpisodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary">
                      No episodes found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEpisodes
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((episode) => (
                    <TableRow 
                      key={episode.id} 
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/episodes/${episode.id}`)}
                    >
                      <TableCell>
                        <Typography variant="subtitle2">
                          #{episode.episodeNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {episode.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {episode.producerNotes || episode.talentNotes || ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(episode.status)}
                          label={episode.status}
                          size="small"
                          color={getStatusColor(episode.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CalendarToday fontSize="small" color="action" />
                          {episode.airDate ? new Date(episode.airDate + 'T12:00:00').toLocaleDateString() : '-'}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AccessTime fontSize="small" color="action" />
                          {formatDuration(episode.duration)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {(episode.downloads || 0).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(episode.listens || 0).toLocaleString()} listens
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {episode.filledSlots || 0}/{episode.adSlots || 0}
                        </Typography>
                        <Typography variant="caption" color={(episode.filledSlots || 0) === (episode.adSlots || 0) && episode.adSlots ? 'success.main' : 'warning.main'}>
                          {episode.adSlots ? (((episode.filledSlots || 0) / episode.adSlots) * 100).toFixed(0) : 0}% filled
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="success.main">
                          ${(episode.revenue || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMenuOpen(e, episode)
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredEpisodes.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10))
              setPage(0)
            }}
          />
        </TableContainer>

        {/* Action Menu - Removed "View Details" since row click already navigates */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => {
            if (selectedEpisode) {
              router.push(`/episodes/${selectedEpisode.id}/edit`)
            }
            handleMenuClose()
          }}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit Episode
          </MenuItem>
          <MenuItem onClick={() => {
            if (selectedEpisode) {
              router.push(`/campaigns?episodeId=${selectedEpisode.id}`)
            }
            handleMenuClose()
          }}>
            <Campaign fontSize="small" sx={{ mr: 1 }} />
            Manage Ad Slots
          </MenuItem>
          <MenuItem 
            onClick={() => {
              if (selectedEpisode && confirm(`Are you sure you want to delete episode #${selectedEpisode.episodeNumber}?`)) {
                // TODO: Implement delete API call
                console.log('Delete episode:', selectedEpisode.id)
              }
              handleMenuClose()
            }}
            sx={{ color: 'error.main' }}
          >
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete Episode
          </MenuItem>
        </Menu>
      </Box>
    </DashboardLayout>
  )
}