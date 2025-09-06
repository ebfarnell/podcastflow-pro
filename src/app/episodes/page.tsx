'use client'


import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Typography,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Avatar,
  Select,
  FormControl,
  InputLabel,
  Autocomplete,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Podcasts as PodcastIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { useAuth } from '@/contexts/AuthContext'
import { showsApi, episodesApi, userApi } from '@/services/api'

interface Episode {
  episodeId: string
  showId: string
  showName?: string
  episodeNumber: number
  title: string
  description: string
  duration: number
  releaseDate: string
  status: string
  scriptUrl?: string
  audioUrl?: string
  assignedTalent?: string[]
  talentDetails?: any[]
  sponsorSegments?: any[]
  createdAt: string
  updatedAt: string
}

interface Show {
  showId: string
  name: string
  assignedProducer?: string
}

interface User {
  userId: string
  name: string
  email: string
  role: string
}

export default function EpisodesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [talents, setTalents] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showFilter, setShowFilter] = useState<string>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [assignTalentDialogOpen, setAssignTalentDialogOpen] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)
  const [selectedTalent, setSelectedTalent] = useState<User | null>(null)
  const [newEpisode, setNewEpisode] = useState({
    showId: '',
    episodeNumber: 1,
    title: '',
    description: '',
    duration: 30,
    releaseDate: dayjs().add(7, 'day'),
  })

  useEffect(() => {
    fetchEpisodes()
    fetchShows()
    fetchTalents()
  }, [statusFilter, showFilter])

  const fetchEpisodes = async () => {
    try {
      setLoading(true)
      const params: any = {}
      
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }
      
      if (showFilter !== 'all') {
        params.showId = showFilter
      }
      
      // For producers and talent, only show assigned episodes
      if (user?.role === 'producer' || user?.role === 'talent') {
        params.assignedOnly = 'true'
      }
      
      const response = await episodesApi.list(params)
      
      // Episodes already include showName from the API
      setEpisodes(response.episodes || [])
    } catch (error) {
      console.error('Error fetching episodes:', error)
      setEpisodes([])
    } finally {
      setLoading(false)
    }
  }

  const fetchShows = async () => {
    try {
      const response = await showsApi.list()
      setShows(response.shows || [])
    } catch (error) {
      console.error('Error fetching shows:', error)
    }
  }

  const fetchTalents = async () => {
    try {
      const response = await userApi.list({ role: 'talent' })
      setTalents(response.users || [])
    } catch (error) {
      console.error('Error fetching talents:', error)
    }
  }

  const handleCreateEpisode = async () => {
    try {
      const episodeData = {
        ...newEpisode,
        duration: newEpisode.duration * 60, // Convert minutes to seconds
        releaseDate: newEpisode.releaseDate.toISOString(),
      }
      
      await episodesApi.create(episodeData)
      
      setCreateDialogOpen(false)
      setNewEpisode({
        showId: '',
        episodeNumber: 1,
        title: '',
        description: '',
        duration: 30,
        releaseDate: dayjs().add(7, 'day'),
      })
      fetchEpisodes()
    } catch (error) {
      console.error('Error creating episode:', error)
      alert('Failed to create episode')
    }
  }

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!confirm('Are you sure you want to delete this episode?')) return

    try {
      await episodesApi.delete(episodeId)
      fetchEpisodes()
    } catch (error) {
      console.error('Error deleting episode:', error)
      alert('Failed to delete episode')
    }
  }

  const handleAssignTalent = async () => {
    // Episode talent assignments are now managed through show assignments
    // This functionality has been moved to the show level for better security and consistency
    alert('Talent assignments are now managed at the show level. Please assign talent to the show instead.')
    setAssignTalentDialogOpen(false)
    setSelectedEpisode(null)
    setSelectedTalent(null)
  }

  const handleRemoveTalent = async (episodeId: string, talentId: string) => {
    // Episode talent assignments are now managed through show assignments
    alert('Talent assignments are now managed at the show level. Please manage talent assignments through the show.')
  }

  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: 'Episode Title',
      flex: 1,
      minWidth: 250,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
            <PodcastIcon sx={{ fontSize: 18 }} />
          </Avatar>
          <Box>
            <Typography variant="body2">{params.value}</Typography>
            <Typography variant="caption" color="text.secondary">
              Episode {params.row.episodeNumber}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'showName',
      headerName: 'Show',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value || 'Unknown'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">{Math.round(params.value / 60)} min</Typography>
      ),
    },
    {
      field: 'releaseDate',
      headerName: 'Release Date',
      width: 130,
      valueFormatter: (params) => {
        // Handle date string from API (e.g., '2025-09-07')
        if (!params.value) return '-'
        // Add noon time to avoid timezone shifts
        const dateStr = params.value.includes('T') ? params.value : params.value + 'T12:00:00'
        return dayjs(dateStr).format('MMM D, YYYY')
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const getStatusColor = (status: string) => {
          switch (status) {
            case 'draft':
              return 'default'
            case 'script_ready':
              return 'info'
            case 'recording':
              return 'warning'
            case 'post_production':
              return 'secondary'
            case 'published':
              return 'success'
            default:
              return 'default'
          }
        }
        return (
          <Chip
            label={params.value.replace('_', ' ')}
            color={getStatusColor(params.value)}
            size="small"
          />
        )
      },
    },
    {
      field: 'assignedTalent',
      headerName: 'Assigned Talent',
      width: 200,
      renderCell: (params: GridRenderCellParams) => {
        const talentCount = params.value?.length || 0
        if (talentCount === 0) {
          return <Typography variant="caption" color="text.secondary">No talent assigned</Typography>
        }
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2">{talentCount} talent{talentCount > 1 ? 's' : ''}</Typography>
          </Box>
        )
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/episodes/${params.row.episodeId}`)
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          {(user?.role === 'master' || user?.role === 'admin' || user?.role === 'producer') && (
            <>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedEpisode(params.row)
                  setAssignTalentDialogOpen(true)
                }}
              >
                <AssignmentIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteEpisode(params.row.episodeId)
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </Box>
      ),
    },
  ]

  const filteredEpisodes = episodes.filter((episode) =>
    episode.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    episode.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    episode.showName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleRowClick = (params: any) => {
    router.push(`/episodes/${params.row.episodeId}`)
  }

  const canCreateEpisode = user?.role === 'master' || user?.role === 'admin' || user?.role === 'producer'

  return (
    <RouteProtection requiredPermission={PERMISSIONS.EPISODES_VIEW}>
      <DashboardLayout>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1">
              Episodes
            </Typography>
            {canCreateEpisode && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                New Episode
              </Button>
            )}
          </Box>

          <Card>
            <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                placeholder="Search episodes..."
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Show</InputLabel>
                <Select
                  value={showFilter}
                  label="Show"
                  onChange={(e) => setShowFilter(e.target.value)}
                >
                  <MenuItem value="all">All Shows</MenuItem>
                  {shows.map((show) => (
                    <MenuItem key={show.showId} value={show.showId}>
                      {show.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton onClick={(e) => setFilterAnchorEl(e.currentTarget)}>
                <FilterIcon />
              </IconButton>
            </Box>
            <Divider />
            <DataGrid
              rows={filteredEpisodes}
              columns={columns}
              getRowId={(row) => row.episodeId}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 10 },
                },
              }}
              pageSizeOptions={[10, 25, 50]}
              onRowClick={handleRowClick}
              loading={loading}
              sx={{
                border: 0,
                '& .MuiDataGrid-row': {
                  cursor: 'pointer',
                },
              }}
              autoHeight
            />
          </Card>
        </Box>

        <Menu
          anchorEl={filterAnchorEl}
          open={Boolean(filterAnchorEl)}
          onClose={() => setFilterAnchorEl(null)}
        >
          <MenuItem onClick={() => { setStatusFilter('all'); setFilterAnchorEl(null); }}>
            All Status
          </MenuItem>
          <MenuItem onClick={() => { setStatusFilter('draft'); setFilterAnchorEl(null); }}>
            Draft
          </MenuItem>
          <MenuItem onClick={() => { setStatusFilter('script_ready'); setFilterAnchorEl(null); }}>
            Script Ready
          </MenuItem>
          <MenuItem onClick={() => { setStatusFilter('recording'); setFilterAnchorEl(null); }}>
            Recording
          </MenuItem>
          <MenuItem onClick={() => { setStatusFilter('post_production'); setFilterAnchorEl(null); }}>
            Post Production
          </MenuItem>
          <MenuItem onClick={() => { setStatusFilter('published'); setFilterAnchorEl(null); }}>
            Published
          </MenuItem>
        </Menu>

        {/* Create Episode Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create New Episode</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Show</InputLabel>
                  <Select
                    value={newEpisode.showId}
                    label="Show"
                    onChange={(e) => setNewEpisode({ ...newEpisode, showId: e.target.value })}
                  >
                    {shows.map((show) => (
                      <MenuItem key={show.showId} value={show.showId}>
                        {show.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Episode Number"
                  type="number"
                  fullWidth
                  value={newEpisode.episodeNumber}
                  onChange={(e) => setNewEpisode({ ...newEpisode, episodeNumber: parseInt(e.target.value) || 1 })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Duration (minutes)"
                  type="number"
                  fullWidth
                  value={newEpisode.duration}
                  onChange={(e) => setNewEpisode({ ...newEpisode, duration: parseInt(e.target.value) || 30 })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Episode Title"
                  fullWidth
                  value={newEpisode.title}
                  onChange={(e) => setNewEpisode({ ...newEpisode, title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={newEpisode.description}
                  onChange={(e) => setNewEpisode({ ...newEpisode, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <DatePicker
                  label="Release Date"
                  value={newEpisode.releaseDate}
                  onChange={(date) => setNewEpisode({ ...newEpisode, releaseDate: date || dayjs() })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    }
                  }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateEpisode}
              variant="contained"
              disabled={!newEpisode.showId || !newEpisode.title}
            >
              Create Episode
            </Button>
          </DialogActions>
        </Dialog>

        {/* Assign Talent Dialog */}
        <Dialog
          open={assignTalentDialogOpen}
          onClose={() => setAssignTalentDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Assign Talent to Episode</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Autocomplete
                options={talents.filter(t => 
                  !selectedEpisode?.assignedTalent?.includes(t.userId)
                )}
                getOptionLabel={(option) => `${option.name} (${option.email})`}
                value={selectedTalent}
                onChange={(event, newValue) => setSelectedTalent(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Talent"
                    variant="outlined"
                    fullWidth
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssignTalentDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAssignTalent}
              variant="contained"
              disabled={!selectedTalent}
            >
              Assign Talent
            </Button>
          </DialogActions>
        </Dialog>
        </LocalizationProvider>
      </DashboardLayout>
    </RouteProtection>
  )
}