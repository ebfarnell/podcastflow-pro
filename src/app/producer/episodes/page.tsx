'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
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
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent
} from '@mui/material'
import {
  Search,
  PlayCircle,
  Schedule,
  MoreVert,
  Edit,
  Mic,
  CheckCircle,
  Warning,
  Add,
  FilterList
} from '@mui/icons-material'
import { format } from 'date-fns'

interface Episode {
  id: string
  title: string
  showId: string
  showName: string
  episodeNumber: string
  airDate: string
  recordingDate: string | null
  status: 'draft' | 'scheduled' | 'recorded' | 'edited' | 'published'
  duration: number | null
  talent: string[]
  hasScript: boolean
  hasRecording: boolean
  productionStatus: 'not_started' | 'in_progress' | 'completed'
}

export default function ProducerEpisodesPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const showId = searchParams.get('showId')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [shows, setShows] = useState<any[]>([])
  const [selectedShow, setSelectedShow] = useState<string>(showId || '')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchProducerShows()
      fetchEpisodes()
    }
  }, [user, sessionLoading, page, rowsPerPage, searchQuery, selectedShow, statusFilter])

  const fetchProducerShows = async () => {
    try {
      const response = await fetch(`/api/shows?producerId=${user?.id}`)
      if (!response.ok) throw new Error('Failed to fetch shows')
      const data = await response.json()
      setShows(data.shows)
    } catch (err) {
      console.error('Error fetching shows:', err)
    }
  }

  const fetchEpisodes = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        search: searchQuery,
        producerId: user?.id || ''
      })

      if (selectedShow && selectedShow !== 'all') {
        params.append('showId', selectedShow)
      }

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/episodes?${params}`)
      if (!response.ok) throw new Error('Failed to fetch episodes')
      
      const data = await response.json()
      
      // Transform the data to include production-specific information
      const transformedEpisodes = data.episodes.map((episode: any) => ({
        id: episode.id,
        title: episode.title,
        showId: episode.showId,
        showName: episode.show?.name || '',
        episodeNumber: episode.episodeNumber,
        airDate: episode.airDate,
        recordingDate: episode.recordingDate,
        status: episode.status || 'draft',
        duration: episode.duration,
        talent: episode.talent || [],
        hasScript: !!episode.scriptUrl,
        hasRecording: !!episode.audioUrl,
        productionStatus: episode.audioUrl ? 'completed' : episode.scriptUrl ? 'in_progress' : 'not_started'
      }))

      setEpisodes(transformedEpisodes)
      setTotalCount(data.total)
    } catch (err) {
      console.error('Error fetching episodes:', err)
      setError('Failed to load episodes')
    } finally {
      setLoading(false)
    }
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, episode: Episode) => {
    setAnchorEl(event.currentTarget)
    setSelectedEpisode(episode)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedEpisode(null)
  }

  const handleEditEpisode = () => {
    if (selectedEpisode) {
      router.push(`/episodes/${selectedEpisode.id}/edit`)
    }
    handleMenuClose()
  }

  const handleViewTasks = () => {
    if (selectedEpisode) {
      router.push(`/producer/tasks?episodeId=${selectedEpisode.id}`)
    }
    handleMenuClose()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'success'
      case 'edited':
      case 'recorded':
        return 'info'
      case 'scheduled':
        return 'warning'
      case 'draft':
      default:
        return 'default'
    }
  }

  const getProductionStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" fontSize="small" />
      case 'in_progress':
        return <Schedule color="warning" fontSize="small" />
      case 'not_started':
      default:
        return <Warning color="error" fontSize="small" />
    }
  }

  const stats = {
    total: totalCount,
    inProduction: episodes.filter(e => e.productionStatus === 'in_progress').length,
    completed: episodes.filter(e => e.productionStatus === 'completed').length,
    upcoming: episodes.filter(e => e.airDate && e.airDate !== 'null' && new Date(e.airDate) > new Date()).length
  }

  if (sessionLoading || loading) {
    return (
      <RouteProtection requiredPermission={PERMISSIONS.EPISODES_VIEW}>
        <DashboardLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
          </Box>
        </DashboardLayout>
      </RouteProtection>
    )
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.EPISODES_VIEW}>
      <DashboardLayout>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                My Episodes
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage episodes for your shows
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => router.push('/episodes/new')}
            >
              Create Episode
            </Button>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Episodes
                  </Typography>
                  <Typography variant="h4">{stats.total}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    In Production
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {stats.inProduction}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Completed
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.completed}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Upcoming
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {stats.upcoming}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper sx={{ mb: 3, p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Search episodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Show</InputLabel>
                  <Select
                    value={selectedShow}
                    onChange={(e) => setSelectedShow(e.target.value)}
                    label="Show"
                  >
                    <MenuItem value="all">All Shows</MenuItem>
                    {shows.map((show) => (
                      <MenuItem key={show.id} value={show.id}>
                        {show.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="scheduled">Scheduled</MenuItem>
                    <MenuItem value="recorded">Recorded</MenuItem>
                    <MenuItem value="edited">Edited</MenuItem>
                    <MenuItem value="published">Published</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Episode</TableCell>
                  <TableCell>Show</TableCell>
                  <TableCell>Air Date</TableCell>
                  <TableCell>Recording Date</TableCell>
                  <TableCell>Production</TableCell>
                  <TableCell>Talent</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {episodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body1" color="text.secondary" sx={{ py: 3 }}>
                        No episodes found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  episodes.map((episode) => (
                    <TableRow key={episode.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {episode.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Episode {episode.episodeNumber}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{episode.showName}</TableCell>
                      <TableCell>
                        {episode.airDate && episode.airDate !== 'null' ? 
                          format(new Date(episode.airDate), 'MMM d, yyyy') : 
                          'Not scheduled'
                        }
                      </TableCell>
                      <TableCell>
                        {episode.recordingDate && episode.recordingDate !== 'null' ? (
                          format(new Date(episode.recordingDate), 'MMM d, yyyy')
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Not scheduled
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getProductionStatusIcon(episode.productionStatus)}
                          <Typography variant="body2" textTransform="capitalize">
                            {episode.productionStatus.replace('_', ' ')}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {episode.talent.length > 0 ? (
                          <Typography variant="body2">
                            {episode.talent.join(', ')}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Not assigned
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={episode.status}
                          color={getStatusColor(episode.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuClick(e, episode)}
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {episodes.length > 0 && (
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={totalCount}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(event, newPage) => setPage(newPage)}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(parseInt(event.target.value, 10))
                  setPage(0)
                }}
              />
            )}
          </TableContainer>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleEditEpisode}>
              <Edit fontSize="small" sx={{ mr: 1 }} />
              Edit Episode
            </MenuItem>
            <MenuItem onClick={handleViewTasks}>
              <Mic fontSize="small" sx={{ mr: 1 }} />
              Production Tasks
            </MenuItem>
          </Menu>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}