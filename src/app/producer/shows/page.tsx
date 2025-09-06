'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  Tooltip
} from '@mui/material'
import {
  Search,
  Podcasts,
  PlayCircle,
  Schedule,
  MoreVert,
  Assignment,
  TrendingUp
} from '@mui/icons-material'
import { format } from 'date-fns'

interface Show {
  id: string
  name: string
  host: string
  genre: string
  episodeCount: number
  nextRecording: string | null
  status: 'active' | 'paused' | 'completed'
  lastEpisodeDate: string | null
  averageListeners: number
}

export default function ProducerShowsPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shows, setShows] = useState<Show[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchShows()
    }
  }, [user, sessionLoading, page, rowsPerPage, searchQuery])

  const fetchShows = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        search: searchQuery,
        producerId: user?.id || ''
      })

      const response = await fetch(`/api/shows?${params}`)
      if (!response.ok) throw new Error('Failed to fetch shows')
      
      const data = await response.json()
      
      // Transform the data to include producer-specific information
      const transformedShows = data.shows.map((show: any) => ({
        id: show.id,
        name: show.name,
        host: show.host,
        genre: show.genre,
        episodeCount: show._count?.episodes || 0,
        nextRecording: show.episodes?.find((e: any) => new Date(e.airDate) > new Date())?.airDate || null,
        status: show.isActive ? 'active' : 'paused',
        lastEpisodeDate: show.episodes?.[0]?.airDate || null,
        averageListeners: show.averageListeners || 0 // Real data from ShowMetrics
      }))

      setShows(transformedShows)
      setTotalCount(data.total)
    } catch (err) {
      console.error('Error fetching shows:', err)
      setError('Failed to load shows')
    } finally {
      setLoading(false)
    }
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, show: Show) => {
    setAnchorEl(event.currentTarget)
    setSelectedShow(show)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedShow(null)
  }

  const handleViewEpisodes = () => {
    if (selectedShow) {
      router.push(`/producer/episodes?showId=${selectedShow.id}`)
    }
    handleMenuClose()
  }

  const handleCreateEpisode = () => {
    if (selectedShow) {
      router.push(`/episodes/new?showId=${selectedShow.id}`)
    }
    handleMenuClose()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'paused':
        return 'warning'
      case 'completed':
        return 'default'
      default:
        return 'default'
    }
  }

  if (sessionLoading || loading) {
    return (
      <RouteProtection requiredPermission={PERMISSIONS.SHOWS_VIEW}>
        <DashboardLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
          </Box>
        </DashboardLayout>
      </RouteProtection>
    )
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.SHOWS_VIEW}>
      <DashboardLayout>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                My Shows
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage shows you're producing
              </Typography>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search shows..."
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
            </Box>
          </Paper>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Show Name</TableCell>
                  <TableCell>Host</TableCell>
                  <TableCell>Genre</TableCell>
                  <TableCell align="center">Episodes</TableCell>
                  <TableCell>Next Recording</TableCell>
                  <TableCell align="right">Avg. Listeners</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body1" color="text.secondary" sx={{ py: 3 }}>
                        No shows assigned to you
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  shows.map((show) => (
                    <TableRow key={show.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Podcasts color="primary" />
                          <Typography variant="body1" fontWeight="medium">
                            {show.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{show.host}</TableCell>
                      <TableCell>{show.genre}</TableCell>
                      <TableCell align="center">{show.episodeCount}</TableCell>
                      <TableCell>
                        {show.nextRecording ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Schedule fontSize="small" color="action" />
                            {format(new Date(show.nextRecording), 'MMM d, yyyy')}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Not scheduled
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          <TrendingUp fontSize="small" color="success" />
                          {show.averageListeners.toLocaleString()}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={show.status}
                          color={getStatusColor(show.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuClick(e, show)}
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {shows.length > 0 && (
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
            <MenuItem onClick={handleViewEpisodes}>
              <PlayCircle fontSize="small" sx={{ mr: 1 }} />
              View Episodes
            </MenuItem>
            <MenuItem onClick={handleCreateEpisode}>
              <Assignment fontSize="small" sx={{ mr: 1 }} />
              Create Episode
            </MenuItem>
          </Menu>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}