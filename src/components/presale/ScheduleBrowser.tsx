'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  TablePagination,
  Autocomplete,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  CalendarMonth as CalendarIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'

interface Schedule {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
  totalSpots: number
  totalValue: number
  itemCount: number
  showCount: number
  campaignId: string | null
  campaignName: string | null
  advertiserId: string
  advertiserName: string
  agencyId: string | null
  agencyName: string | null
  createdAt: string
  updatedAt: string
  createdByName: string
}

interface ScheduleBrowserProps {
  onClose?: () => void
}

export function ScheduleBrowser({ onClose }: ScheduleBrowserProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [filteredSchedules, setFilteredSchedules] = useState<Schedule[]>([])
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [advertiserFilter, setAdvertiserFilter] = useState<string>('')
  const [agencyFilter, setAgencyFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  
  // Pagination
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  
  // Unique lists for filters
  const [advertisers, setAdvertisers] = useState<{id: string, name: string}[]>([])
  const [agencies, setAgencies] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    fetchSchedules()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [schedules, searchTerm, advertiserFilter, agencyFilter, statusFilter])

  const fetchSchedules = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/schedules')
      const data = await response.json()
      
      if (response.ok) {
        const scheduleList = data.schedules || []
        setSchedules(scheduleList)
        
        // Extract unique advertisers and agencies for filters
        const uniqueAdvertisers = new Map()
        const uniqueAgencies = new Map()
        
        scheduleList.forEach((schedule: Schedule) => {
          if (schedule.advertiserId && schedule.advertiserName) {
            uniqueAdvertisers.set(schedule.advertiserId, {
              id: schedule.advertiserId,
              name: schedule.advertiserName
            })
          }
          if (schedule.agencyId && schedule.agencyName) {
            uniqueAgencies.set(schedule.agencyId, {
              id: schedule.agencyId,
              name: schedule.agencyName
            })
          }
        })
        
        setAdvertisers(Array.from(uniqueAdvertisers.values()).sort((a, b) => a.name.localeCompare(b.name)))
        setAgencies(Array.from(uniqueAgencies.values()).sort((a, b) => a.name.localeCompare(b.name)))
      } else {
        setError(data.error || 'Failed to load schedules')
      }
    } catch (err) {
      console.error('Error fetching schedules:', err)
      setError('Unable to connect to the server')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...schedules]
    
    // Search filter (campaign name or advertiser name)
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(schedule => 
        schedule.name.toLowerCase().includes(search) ||
        (schedule.campaignName?.toLowerCase().includes(search)) ||
        (schedule.advertiserName?.toLowerCase().includes(search))
      )
    }
    
    // Advertiser filter
    if (advertiserFilter) {
      filtered = filtered.filter(schedule => schedule.advertiserId === advertiserFilter)
    }
    
    // Agency filter
    if (agencyFilter) {
      filtered = filtered.filter(schedule => schedule.agencyId === agencyFilter)
    }
    
    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(schedule => schedule.status === statusFilter)
    }
    
    setFilteredSchedules(filtered)
    setPage(0) // Reset to first page when filters change
  }

  const handleCreateSchedule = () => {
    router.push('/schedule-builder')
  }

  const handleViewSchedule = (schedule: Schedule) => {
    if (schedule.campaignId) {
      // If schedule has a campaign, include campaign context
      router.push(`/schedule-builder?scheduleId=${schedule.id}&campaignId=${schedule.campaignId}`)
    } else {
      // Otherwise just load the schedule
      router.push(`/schedule-builder?scheduleId=${schedule.id}`)
    }
  }

  const handleExportSchedule = async (scheduleId: string, format: 'pdf' | 'xlsx') => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/export?format=${format}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `schedule-export.${format === 'pdf' ? 'html' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success(`Schedule exported as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export schedule')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'active':
        return 'success'
      case 'pending_approval':
        return 'warning'
      case 'completed':
        return 'default'
      case 'cancelled':
        return 'error'
      default:
        return 'info'
    }
  }

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    )
  }

  const paginatedSchedules = filteredSchedules.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  )

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Schedule Browser
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and manage all advertising schedules across campaigns
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateSchedule}
          size="large"
        >
          Create New Schedule
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              placeholder="Search campaigns or advertisers..."
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
          
          <Grid item xs={12} md={3}>
            <Autocomplete
              options={advertisers}
              getOptionLabel={(option) => option.name}
              value={advertisers.find(a => a.id === advertiserFilter) || null}
              onChange={(event, newValue) => {
                setAdvertiserFilter(newValue?.id || '')
              }}
              renderInput={(params) => (
                <TextField {...params} label="Advertiser" fullWidth />
              )}
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Autocomplete
              options={agencies}
              getOptionLabel={(option) => option.name}
              value={agencies.find(a => a.id === agencyFilter) || null}
              onChange={(event, newValue) => {
                setAgencyFilter(newValue?.id || '')
              }}
              renderInput={(params) => (
                <TextField {...params} label="Agency" fullWidth />
              )}
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="pending_approval">Pending Approval</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Results Summary */}
      <Box mb={2}>
        <Typography variant="body2" color="text.secondary">
          Showing {filteredSchedules.length} schedule{filteredSchedules.length !== 1 ? 's' : ''}
          {searchTerm || advertiserFilter || agencyFilter || statusFilter ? ' (filtered)' : ''}
        </Typography>
      </Box>

      {/* Schedule Table */}
      {filteredSchedules.length > 0 ? (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Schedule Name</TableCell>
                  <TableCell>Campaign</TableCell>
                  <TableCell>Advertiser</TableCell>
                  <TableCell>Agency</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell align="center">Spots</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell>Modified</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedSchedules.map((schedule) => (
                  <TableRow key={schedule.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {schedule.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Created by {schedule.createdByName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {schedule.campaignName || (
                        <Typography variant="body2" color="text.secondary">
                          No campaign
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{schedule.advertiserName}</TableCell>
                    <TableCell>
                      {schedule.agencyName || (
                        <Typography variant="body2" color="text.secondary">
                          Direct
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={schedule.status.replace('_', ' ')}
                        size="small"
                        color={getStatusColor(schedule.status)}
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(schedule.startDate), 'MMM d')} - 
                      {format(new Date(schedule.endDate), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell align="center">
                      {schedule.itemCount}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {schedule.showCount} shows
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      ${schedule.totalValue?.toLocaleString() || '0'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(schedule.updatedAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <Tooltip title="View/Edit Schedule">
                          <IconButton
                            size="small"
                            onClick={() => handleViewSchedule(schedule)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Export PDF">
                          <IconButton
                            size="small"
                            onClick={() => handleExportSchedule(schedule.id, 'pdf')}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredSchedules.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CalendarIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {searchTerm || advertiserFilter || agencyFilter || statusFilter
                ? 'No schedules match your filters'
                : 'No schedules created yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              {searchTerm || advertiserFilter || agencyFilter || statusFilter
                ? 'Try adjusting your filters or search terms'
                : 'Start by creating your first advertising schedule'}
            </Typography>
            {!(searchTerm || advertiserFilter || agencyFilter || statusFilter) && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateSchedule}
                size="large"
              >
                Create First Schedule
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  )
}