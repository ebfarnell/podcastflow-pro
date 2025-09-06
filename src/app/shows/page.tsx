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
  Autocomplete,
  FormHelperText,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Mic as MicIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { useAuth } from '@/contexts/AuthContext'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { showsApi } from '@/services/api'

interface Show {
  showId: string
  name: string
  description: string
  host: string
  genre: string
  frequency: string
  status: string
  assignedProducer?: string
  assignedTalent?: string[]
  episodeCount: number
  subscriberCount: number
  downloads?: number
  views?: number
  createdAt: string
  updatedAt: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
}

export default function ShowsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newShow, setNewShow] = useState({
    name: '',
    description: '',
    host: '',
    genre: '',
    frequency: 'weekly',
  })
  const [producers, setProducers] = useState<User[]>([])
  const [talent, setTalent] = useState<User[]>([])
  const [selectedProducers, setSelectedProducers] = useState<User[]>([])
  const [selectedTalent, setSelectedTalent] = useState<User[]>([])
  const [producersLoading, setProducersLoading] = useState(false)
  const [talentLoading, setTalentLoading] = useState(false)

  useEffect(() => {
    fetchShows()
  }, [statusFilter])

  const fetchShows = async () => {
    try {
      setLoading(true)
      // Always include inactive shows in the management page so they can be managed
      const params = { 
        includeInactive: true,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {})
      }
      const data = await showsApi.list(params)
      setShows(data.shows || [])
    } catch (error) {
      console.error('Error fetching shows:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleCreateShow = async () => {
    try {
      await showsApi.create({
        ...newShow,
        assignedProducers: selectedProducers.map(p => p.id),
        assignedTalent: selectedTalent.map(t => t.id),
      })
      setCreateDialogOpen(false)
      setNewShow({
        name: '',
        description: '',
        host: '',
        genre: '',
        frequency: 'weekly',
      })
      setSelectedProducers([])
      setSelectedTalent([])
      fetchShows()
    } catch (error) {
      console.error('Error creating show:', error)
      alert('Failed to create show')
    }
  }

  const handleReactivateShow = async (showId: string, showName: string) => {
    if (!confirm(`Are you sure you want to reactivate "${showName}"?`)) return

    try {
      // Update the show to set isActive = true
      await showsApi.update(showId, { isActive: true })
      alert(`Show "${showName}" has been reactivated successfully`)
      fetchShows()
    } catch (error: any) {
      console.error('Error reactivating show:', error)
      alert('Failed to reactivate show')
    }
  }

  const handleDeleteShow = async (showId: string) => {
    if (!confirm('Are you sure you want to delete this show?')) return

    try {
      // First attempt without any mode to check what's blocking
      await showsApi.delete(showId)
      fetchShows()
    } catch (error: any) {
      // Only log unexpected errors, not the expected 400 responses
      const details = error?.response?.data?.details
      if (!details) {
        console.error('Error deleting show:', error)
      }
      
      if (details) {
        // Show has related data - offer appropriate action
        if (details.orders > 0) {
          // Has orders - can only set inactive
          const confirmInactive = confirm(
            `This show has ${details.orders} order(s) associated with it and cannot be deleted.\n\n` +
            `Would you like to set it as INACTIVE instead?\n\n` +
            `This will:\n` +
            `- Hide it from schedule builder and other active lists\n` +
            `- Keep all historical data intact\n` +
            `- Allow future reactivation if needed`
          )
          
          if (confirmInactive) {
            try {
              // Call delete with inactive mode
              await showsApi.delete(showId, { params: { mode: 'inactive' } })
              alert('Show has been set as inactive successfully')
              fetchShows()
            } catch (inactiveError: any) {
              console.error('Error setting show inactive:', inactiveError)
              alert('Failed to set show as inactive')
            }
          }
        } else if (details.episodes > 0 && details.canDelete) {
          // Has episodes but no orders - can cascade delete
          const confirmDelete = confirm(
            `This show has ${details.episodes} episode(s) that will be deleted.\n\n` +
            `Are you sure you want to DELETE this show and ALL its episodes?\n\n` +
            `This action CANNOT be undone.`
          )
          
          if (confirmDelete) {
            try {
              // Show deleting message (since it might take a moment with many episodes)
              console.log(`Deleting show and ${details.episodes} episodes...`)
              
              // Call delete with force mode to cascade delete episodes
              await showsApi.delete(showId, { params: { mode: 'force' } })
              alert(`✅ Show and ${details.episodes} episode(s) deleted successfully`)
              fetchShows()
            } catch (deleteError: any) {
              console.error('Error deleting show with episodes:', deleteError)
              alert('Failed to delete show and episodes')
            }
          }
        } else {
          // Some other error
          const errorMessage = error?.response?.data?.error || 'Failed to delete show'
          alert(errorMessage)
        }
      } else {
        // Generic error
        const errorMessage = error?.response?.data?.error || 'Failed to delete show'
        alert(errorMessage)
      }
    }
  }

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Show Name',
      flex: 2,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Avatar sx={{ bgcolor: params.row.isActive === false ? 'grey.400' : 'primary.main', width: 24, height: 24 }}>
            <MicIcon sx={{ fontSize: 14 }} />
          </Avatar>
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{params.value}</Typography>
          {params.row.isActive === false && (
            <Chip 
              label="INACTIVE" 
              size="small" 
              sx={{ 
                ml: 1, 
                height: 20, 
                fontSize: '0.65rem',
                bgcolor: 'grey.300',
                color: 'grey.700'
              }} 
            />
          )}
        </Box>
      ),
    },
    {
      field: 'host',
      headerName: 'Host',
      flex: 1,
      minWidth: 80,
    },
    {
      field: 'genre',
      headerName: 'Genre',
      flex: 0.8,
      minWidth: 80,
    },
    {
      field: 'frequency',
      headerName: 'Frequency',
      flex: 0.8,
      minWidth: 90,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          size="small"
          icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.7,
      minWidth: 80,
      renderCell: (params: GridRenderCellParams) => {
        const getStatusColor = (status: string) => {
          switch (status) {
            case 'active':
              return 'success'
            case 'hiatus':
              return 'warning'
            case 'ended':
              return 'error'
            case 'upcoming':
              return 'info'
            default:
              return 'default'
          }
        }
        return (
          <Chip
            label={params.value}
            color={getStatusColor(params.value)}
            size="small"
          />
        )
      },
    },
    {
      field: 'episodeCount',
      headerName: 'Episodes',
      flex: 0.6,
      minWidth: 70,
      type: 'number',
    },
    {
      field: 'impressions',
      headerName: 'Impressions',
      flex: 0.8,
      minWidth: 100,
      type: 'number',
      valueGetter: (params) => {
        const downloads = params.row.downloads || 0
        const views = params.row.views || 0
        return downloads + views
      },
      renderCell: (params: GridRenderCellParams) => {
        const downloads = params.row.downloads || 0
        const views = params.row.views || 0
        const total = downloads + views
        
        // Format the number
        let formattedValue = total.toString()
        if (total >= 1000000) {
          formattedValue = `${(total / 1000000).toFixed(1)}M`
        } else if (total >= 1000) {
          formattedValue = `${(total / 1000).toFixed(1)}K`
        }
        
        return (
          <Tooltip title="Downloads + Views" placement="top">
            <Typography variant="body2" sx={{ cursor: 'help' }}>
              {formattedValue}
            </Typography>
          </Tooltip>
        )
      },
    },
    {
      field: 'assignedProducer',
      headerName: 'Producer',
      flex: 1,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams) => (
        params.value ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption">{params.value}</Typography>
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">Unassigned</Typography>
        )
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 0.8,
      minWidth: 90,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/shows/${params.row.showId}`)
            }}
            title="Edit Show"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          {(user?.role === 'admin' || user?.role === 'master') && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/shows/${params.row.showId}/metrics`)
              }}
              title="View Metrics"
            >
              <BarChartIcon fontSize="small" />
            </IconButton>
          )}
          {(user?.role === 'admin' || user?.role === 'sales' || user?.role === 'master') && (
            params.row.isActive === false ? (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  handleReactivateShow(params.row.showId, params.row.name)
                }}
                title="Reactivate Show"
                sx={{ color: 'success.main' }}
              >
                <MicIcon fontSize="small" />
              </IconButton>
            ) : (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteShow(params.row.showId)
                }}
                title="Delete Show"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )
          )}
        </Box>
      ),
    },
  ]

  const filteredShows = shows.filter((show) =>
    show.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    show.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
    show.genre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleRowClick = (params: any) => {
    router.push(`/shows/${params.row.showId}`)
  }

  const canCreateShow = user?.role === 'admin' || user?.role === 'sales' || user?.role === 'producer'

  return (
    <RouteProtection requiredPermission={PERMISSIONS.SHOWS_VIEW}>
      <DashboardLayout>
      <RoleGuard 
        roles={['master', 'admin', 'sales', 'producer']} 
        permissions={[PERMISSIONS.SHOWS_VIEW]}
      >
        <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Shows
          </Typography>
          {canCreateShow && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              New Show
            </Button>
          )}
        </Box>

        <Card>
          <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search shows..."
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
            <IconButton onClick={(e) => setFilterAnchorEl(e.currentTarget)}>
              <FilterIcon />
            </IconButton>
          </Box>
          <Divider />
          <DataGrid
            rows={filteredShows}
            columns={columns}
            getRowId={(row) => row.showId}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
            onRowClick={handleRowClick}
            loading={loading}
            density="compact"
            columnHeaderHeight={56}
            disableColumnResize={true}
            sx={{
              border: 0,
              '& .MuiDataGrid-row': {
                cursor: 'pointer',
              },
              '& .MuiDataGrid-cell': {
                py: 0.5,
              },
              '& .MuiDataGrid-columnSeparator': {
                display: 'none',
              },
            }}
            autoHeight
            disableColumnMenu={false}
          />
        </Card>
      </Box>

      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={() => setFilterAnchorEl(null)}
      >
        <MenuItem onClick={() => { setStatusFilter('all'); setFilterAnchorEl(null); }}>
          All Shows
        </MenuItem>
        <MenuItem onClick={() => { setStatusFilter('active'); setFilterAnchorEl(null); }}>
          Active
        </MenuItem>
        <MenuItem onClick={() => { setStatusFilter('hiatus'); setFilterAnchorEl(null); }}>
          On Hiatus
        </MenuItem>
        <MenuItem onClick={() => { setStatusFilter('upcoming'); setFilterAnchorEl(null); }}>
          Upcoming
        </MenuItem>
        <MenuItem onClick={() => { setStatusFilter('ended'); setFilterAnchorEl(null); }}>
          Ended
        </MenuItem>
      </Menu>

      {/* Create Show Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Show</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Show Name"
                fullWidth
                value={newShow.name}
                onChange={(e) => setNewShow({ ...newShow, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={newShow.description}
                onChange={(e) => setNewShow({ ...newShow, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Host"
                fullWidth
                value={newShow.host}
                onChange={(e) => setNewShow({ ...newShow, host: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Genre"
                fullWidth
                value={newShow.genre}
                onChange={(e) => setNewShow({ ...newShow, genre: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Frequency"
                fullWidth
                value={newShow.frequency}
                onChange={(e) => setNewShow({ ...newShow, frequency: e.target.value })}
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="biweekly">Bi-weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </TextField>
            </Grid>
            
            {/* Producer Assignment */}
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={producers}
                getOptionLabel={(option) => option.name}
                value={selectedProducers}
                onChange={(_, newValue) => setSelectedProducers(newValue)}
                loading={producersLoading}
                onOpen={() => {
                  if (producers.length === 0) {
                    fetchProducers()
                  }
                }}
                onInputChange={(_, value) => {
                  fetchProducers(value)
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      avatar={option.avatar ? <Avatar src={option.avatar} /> : undefined}
                      label={option.name}
                      color="primary"
                      variant="outlined"
                      size="small"
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
                  />
                )}
              />
              <FormHelperText>Leave empty if not yet determined</FormHelperText>
            </Grid>

            {/* Talent Assignment */}
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={talent}
                getOptionLabel={(option) => option.name}
                value={selectedTalent}
                onChange={(_, newValue) => setSelectedTalent(newValue)}
                loading={talentLoading}
                onOpen={() => {
                  if (talent.length === 0) {
                    fetchTalent()
                  }
                }}
                onInputChange={(_, value) => {
                  fetchTalent(value)
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      avatar={option.avatar ? <Avatar src={option.avatar} /> : undefined}
                      label={option.name}
                      color="secondary"
                      variant="outlined"
                      size="small"
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
                  />
                )}
              />
              <FormHelperText>Leave empty if not yet determined</FormHelperText>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false)
            setSelectedProducers([])
            setSelectedTalent([])
          }}>Cancel</Button>
          <Button
            onClick={handleCreateShow}
            variant="contained"
            disabled={!newShow.name || !newShow.host}
          >
            Create Show
          </Button>
        </DialogActions>
      </Dialog>
      </RoleGuard>
      </DashboardLayout>
    </RouteProtection>
  )
}