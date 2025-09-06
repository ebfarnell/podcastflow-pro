'use client'


import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  Add,
  Search,
  MoreVert,
  Business,
  TrendingUp,
  AttachMoney,
  Campaign,
  Edit,
  Delete,
  Visibility,
  LocationOn,
  Groups,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { agencyApi } from '@/services/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/config/queryClient'
import { useAuth } from '@/contexts/AuthContext'
import axios from 'axios'

interface Agency {
  id: string
  name: string
  email: string
  phone: string
  website?: string
  address: {
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
  status: 'active' | 'inactive'
  advertisers: any[]
  advertiserCount: number
  campaignCount: number
  totalSpend: number
  createdAt: string
  updatedAt: string
}


export default function AgenciesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  
  // Fetch agencies from real API
  const { data: agenciesData = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.agencies.list(),
    queryFn: async () => {
      try {
        console.log('Fetching agencies...')
        const data = await agencyApi.list()
        console.log('Agencies API response:', data)
        return Array.isArray(data) ? data : []
      } catch (error) {
        console.error('Error fetching agencies:', error)
        throw error
      }
    },
    // Refresh settings for better UX
    staleTime: 0, // Always refetch when window regains focus
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })
  
  // Use data directly from API - it's already transformed
  const agencies = agenciesData
  
  // Mutations for CRUD operations
  const createAgencyMutation = useMutation({
    mutationFn: (data: any) => agencyApi.create(data),
    onSuccess: (data) => {
      console.log('Agency created successfully:', data)
      queryClient.invalidateQueries({ queryKey: queryKeys.agencies.all })
      setAddDialog(false)
      setAddForm({ 
        name: '', 
        email: '', 
        phone: '', 
        website: '',
        address: {
          street: '',
          city: '',
          state: '',
          zip: '',
          country: 'USA'
        }
      })
    },
    onError: (error: any) => {
      console.error('Error creating agency:', error)
      alert(`Failed to create agency: ${error.response?.data?.message || error.message || 'Unknown error'}`)
    },
  })
  
  const deleteAgencyMutation = useMutation({
    mutationFn: (id: string) => agencyApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agencies.all })
      setDeleteDialog(false)
      setSelectedAgency(null)
      setAnchorEl(null)
    },
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [addDialog, setAddDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA'
    }
  })

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, agency: Agency) => {
    setAnchorEl(event.currentTarget)
    setSelectedAgency(agency)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleAddAgency = () => {
    const newAgencyData = {
      name: addForm.name,
      email: addForm.email,
      phone: addForm.phone,
      website: addForm.website,
      address: addForm.address,
    }
    
    console.log('Creating agency with data:', newAgencyData)
    createAgencyMutation.mutate(newAgencyData)
  }

  const handleDeleteAgency = () => {
    if (selectedAgency) {
      if (user?.role === 'admin' || user?.role === 'master') {
        // Admins can delete directly
        deleteAgencyMutation.mutate(selectedAgency.id)
      } else {
        // Non-admin users cannot delete - contact admin
        alert('Only administrators can delete agencies. Please contact an admin if deletion is needed.')
        setDeleteDialog(false)
        setSelectedAgency(null)
        setAnchorEl(null)
      }
    }
  }

  const filteredAgencies = agencies.filter(agency =>
    agency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (agency.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <RouteProtection requiredPermission={PERMISSIONS.AGENCIES_VIEW}>
      <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              My Agencies
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage agency partnerships and their advertiser accounts
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setAddDialog(true)}
          >
            Add Agency
          </Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Business color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Agencies
                    </Typography>
                    <Typography variant="h5">
                      {agencies.length}
                    </Typography>
                  </Box>
                </Box>
                <Chip 
                  label={`${agencies.filter(a => a.status === 'active').length} active`}
                  size="small"
                  color="success"
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Groups color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Advertisers
                    </Typography>
                    <Typography variant="h5">
                      {agencies.reduce((sum, a) => sum + (a.advertiserCount || 0), 0)}
                    </Typography>
                  </Box>
                </Box>
                <Chip 
                  label={`${agencies.length > 0 ? Math.round(agencies.reduce((sum, a) => sum + (a.advertiserCount || 0), 0) / agencies.length) : 0} avg per agency`}
                  size="small"
                  color="info"
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Campaign color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Active Campaigns
                    </Typography>
                    <Typography variant="h5">
                      {agencies.reduce((sum, a) => sum + (a.campaignCount || 0), 0)}
                    </Typography>
                  </Box>
                </Box>
                <Chip 
                  label={`${agencies.length > 0 ? Math.round(agencies.reduce((sum, a) => sum + (a.campaignCount || 0), 0) / agencies.length) : 0} avg per agency`}
                  size="small"
                  color="secondary"
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AttachMoney color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Revenue
                    </Typography>
                    <Typography variant="h5">
                      ${agencies.reduce((sum, a) => sum + a.totalSpend, 0).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
                <Chip 
                  label={`${agencies.length > 0 ? '$' + Math.round(agencies.reduce((sum, a) => sum + a.totalSpend, 0) / agencies.length).toLocaleString() : '$0'} avg per agency`}
                  size="small"
                  color="warning"
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Search */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <TextField
            size="small"
            placeholder="Search agencies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ width: '100%', maxWidth: 400 }}
          />
        </Paper>

        {/* Loading State */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography>Loading agencies...</Typography>
          </Box>
        )}

        {/* Error State */}
        {error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography color="error">Error loading agencies. Please try again.</Typography>
          </Box>
        )}

        {/* Agencies Table */}
        {!isLoading && !error && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Agency</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Advertisers</TableCell>
                <TableCell>Active Campaigns</TableCell>
                <TableCell>Total Revenue</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAgencies
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((agency) => (
                  <TableRow 
                    key={agency.id} 
                    hover 
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/agencies/${agency.id}`)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {agency.name[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">{agency.name}</Typography>
                          {agency.website && (
                            <Typography variant="caption" color="text.secondary">
                              {agency.website}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        {agency.email && (
                          <Typography variant="body2">{agency.email}</Typography>
                        )}
                        {agency.phone && (
                          <Typography variant="caption" color="text.secondary">
                            {agency.phone}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{agency.advertiserCount || 0}</TableCell>
                    <TableCell>{agency.campaignCount || 0}</TableCell>
                    <TableCell>${agency.totalSpend.toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={agency.status}
                        size="small"
                        color={agency.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMenuOpen(e, agency)
                        }}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredAgencies.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
          />
        </TableContainer>
        )}

        {/* Action Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => {
            router.push(`/agencies/${selectedAgency?.id}`)
            handleMenuClose()
          }}>
            <Visibility fontSize="small" sx={{ mr: 1 }} />
            View Details
          </MenuItem>
          <MenuItem onClick={() => {
            router.push(`/agencies/${selectedAgency?.id}/campaigns`)
            handleMenuClose()
          }}>
            <Campaign fontSize="small" sx={{ mr: 1 }} />
            View Campaigns
          </MenuItem>
          <MenuItem onClick={() => {
            router.push(`/agencies/${selectedAgency?.id}/edit`)
            handleMenuClose()
          }}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit Agency
          </MenuItem>
          <MenuItem 
            onClick={() => {
              setDeleteDialog(true)
              handleMenuClose()
            }}
            sx={{ color: 'error.main' }}
          >
            <Delete fontSize="small" sx={{ mr: 1 }} />
            {user?.role === 'admin' || user?.role === 'master' ? 'Delete Agency' : 'Request Deletion'}
          </MenuItem>
        </Menu>

        {/* Delete Confirmation Dialog */}
        <Dialog 
          open={deleteDialog} 
          onClose={() => {
            setDeleteDialog(false)
            setDeleteReason('')
          }}
          aria-labelledby="delete-agency-dialog-title"
          aria-describedby="delete-agency-dialog-description"
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle id="delete-agency-dialog-title">
            {user?.role === 'admin' || user?.role === 'master' ? 'Delete Agency?' : 'Request Agency Deletion'}
          </DialogTitle>
          <DialogContent>
            <Typography id="delete-agency-dialog-description" sx={{ mb: 2 }}>
              {user?.role === 'admin' || user?.role === 'master' 
                ? `Are you sure you want to delete "${selectedAgency?.name}"? This action cannot be undone and will affect all associated advertisers and campaigns.`
                : `You are requesting to delete "${selectedAgency?.name}". An admin will review your request before the agency is removed.`
              }
            </Typography>
            {(user?.role === 'sales') && (
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason for deletion (optional)"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Please provide a reason for deleting this agency..."
                sx={{ mt: 2 }}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setDeleteDialog(false)
              setDeleteReason('')
            }}>Cancel</Button>
            <Button onClick={handleDeleteAgency} color="error" variant="contained">
              {user?.role === 'admin' || user?.role === 'master' ? 'Delete' : 'Submit Request'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Agency Dialog */}
        <Dialog 
          open={addDialog} 
          onClose={() => setAddDialog(false)} 
          maxWidth="sm" 
          fullWidth
          aria-labelledby="add-agency-dialog-title"
        >
          <DialogTitle id="add-agency-dialog-title">Add New Agency</DialogTitle>
          <DialogContent>
            <Box component="form" sx={{ pt: 2 }} noValidate>
              <TextField 
                fullWidth 
                id="agency-name"
                name="agencyName"
                label="Agency Name" 
                margin="normal" 
                value={addForm.name}
                onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                required
              />
              <TextField 
                fullWidth 
                id="email"
                name="email"
                label="Email" 
                type="email" 
                margin="normal" 
                value={addForm.email}
                onChange={(e) => setAddForm({...addForm, email: e.target.value})}
              />
              <TextField 
                fullWidth 
                id="phone"
                name="phone"
                label="Phone" 
                margin="normal" 
                value={addForm.phone}
                onChange={(e) => setAddForm({...addForm, phone: e.target.value})}
              />
              <TextField 
                fullWidth 
                id="website"
                name="website"
                label="Website" 
                margin="normal" 
                value={addForm.website}
                onChange={(e) => setAddForm({...addForm, website: e.target.value})}
              />
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Address</Typography>
              <TextField 
                fullWidth 
                id="street"
                name="street"
                label="Street Address" 
                margin="normal" 
                value={addForm.address.street}
                onChange={(e) => setAddForm({...addForm, address: {...addForm.address, street: e.target.value}})}
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField 
                    fullWidth 
                    id="city"
                    name="city"
                    label="City" 
                    margin="normal" 
                    value={addForm.address.city}
                    onChange={(e) => setAddForm({...addForm, address: {...addForm.address, city: e.target.value}})}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField 
                    fullWidth 
                    id="state"
                    name="state"
                    label="State" 
                    margin="normal" 
                    value={addForm.address.state}
                    onChange={(e) => setAddForm({...addForm, address: {...addForm.address, state: e.target.value}})}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField 
                    fullWidth 
                    id="zip"
                    name="zip"
                    label="ZIP" 
                    margin="normal" 
                    value={addForm.address.zip}
                    onChange={(e) => setAddForm({...addForm, address: {...addForm.address, zip: e.target.value}})}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddAgency}>Add Agency</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
    </RouteProtection>
  )
}