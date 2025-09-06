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
  Alert,
  Snackbar,
} from '@mui/material'
import {
  Add,
  Search,
  MoreVert,
  Store,
  TrendingUp,
  AttachMoney,
  Campaign,
  Schedule,
  Edit,
  Delete,
  Visibility,
  Email,
  Phone,
  LocationOn,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { advertiserApi, agencyApi } from '@/services/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/config/queryClient'
import { useAuth } from '@/contexts/AuthContext'
import axios from 'axios'

interface Advertiser {
  id: string
  name: string
  industry: string
  contactPerson?: string
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
  agency?: {
    id: string
    name: string
  }
  agencyId?: string
  status: 'active' | 'inactive'
  campaigns: any[]
  campaignCount: number
  totalSpend: number
  averageCPM: number
  createdAt: string
  updatedAt: string
}


export default function AdvertisersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  
  // Calculate current month for YTD calculation
  const currentMonth = new Date().getMonth() + 1 // 1-12
  
  // Fetch advertisers from real API
  const { data: advertisersData = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.advertisers.list(),
    queryFn: async () => {
      try {
        console.log('Fetching advertisers...')
        const data = await advertiserApi.list()
        console.log('Advertisers API response:', data)
        return Array.isArray(data) ? data : []
      } catch (error) {
        console.error('Error fetching advertisers:', error)
        throw error
      }
    },
    // Refresh settings for better UX
    staleTime: 0, // Always refetch when window regains focus
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })
  
  // Fetch agencies for the dropdown
  const { data: agencies = [] } = useQuery({
    queryKey: queryKeys.agencies.list(),
    queryFn: async () => {
      try {
        const data = await agencyApi.list()
        return Array.isArray(data) ? data : []
      } catch (error) {
        console.error('Error fetching agencies:', error)
        return []
      }
    },
    // Longer cache time since agencies don't change often
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
  
  // Use data directly from API - it's already transformed
  const advertisers = advertisersData
  
  // Mutations for CRUD operations
  const createAdvertiserMutation = useMutation({
    mutationFn: (data: any) => advertiserApi.create(data),
    onSuccess: (data) => {
      console.log('Advertiser created successfully:', data)
      queryClient.invalidateQueries({ queryKey: queryKeys.advertisers.all })
      setAddDialog(false)
      setAddForm({ 
        name: '', 
        industry: '', 
        email: '', 
        phone: '', 
        website: '',
        address: {
          street: '',
          city: '',
          state: '',
          zip: '',
          country: 'USA'
        },
        agencyId: '' 
      })
    },
    onError: (error: any) => {
      console.error('Error creating advertiser:', error)
      const message = error.response?.data?.message || error.message || 'Failed to create advertiser'
      setErrorMessage(message)
      setShowError(true)
    },
  })
  
  const deleteAdvertiserMutation = useMutation({
    mutationFn: (id: string) => advertiserApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.advertisers.all })
      setDeleteDialog(false)
      setSelectedAdvertiser(null)
      setAnchorEl(null)
    },
    onError: (error: any) => {
      console.error('Error deleting advertiser:', error)
      const message = error.response?.data?.error || error.message || 'Failed to delete advertiser'
      setErrorMessage(message)
      setShowError(true)
      // Keep the dialog open so user can see what happened
    },
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [addDialog, setAddDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<Advertiser | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '',
    industry: '',
    email: '',
    phone: '',
    website: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA'
    },
    agencyId: ''
  })

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, advertiser: Advertiser) => {
    setAnchorEl(event.currentTarget)
    setSelectedAdvertiser(advertiser)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleAddAdvertiser = () => {
    const newAdvertiserData = {
      name: addForm.name,
      industry: addForm.industry,
      email: addForm.email,
      phone: addForm.phone,
      website: addForm.website,
      address: addForm.address,
      agencyId: addForm.agencyId || null,
    }
    
    console.log('Creating advertiser with data:', newAdvertiserData)
    createAdvertiserMutation.mutate(newAdvertiserData)
  }

  const handleDeleteAdvertiser = () => {
    if (selectedAdvertiser) {
      if (user?.role === 'admin' || user?.role === 'master') {
        // Admins can delete directly
        deleteAdvertiserMutation.mutate(selectedAdvertiser.id)
      } else {
        // Non-admin users cannot delete - contact admin
        alert('Only administrators can delete advertisers. Please contact an admin if deletion is needed.')
        setDeleteDialog(false)
        setSelectedAdvertiser(null)
        setAnchorEl(null)
      }
    }
  }

  const handleStatusChange = (advertiserId: string, newStatus: Advertiser['status']) => {
    // TODO: Create updateAdvertiserMutation when needed
    // For now, just close the menu and show alert
    setAnchorEl(null)
    alert(`Status update to ${newStatus} will be implemented with updateAdvertiserMutation`)
  }

  const filteredAdvertisers = advertisers.filter(advertiser =>
    advertiser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (advertiser.industry || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (advertiser.agency?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <RouteProtection requiredPermission={PERMISSIONS.ADVERTISERS_VIEW}>
      <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              My Advertisers
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage advertiser accounts and track their campaigns
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setAddDialog(true)}
          >
            Add Advertiser
          </Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Store color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Advertisers
                    </Typography>
                    <Typography variant="h5">
                      {advertisers.length}
                    </Typography>
                  </Box>
                </Box>
                <Chip 
                  label={`${advertisers.filter(a => a.status === 'active').length} active`}
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
                  <Campaign color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Active Campaigns
                    </Typography>
                    <Typography variant="h5">
                      {advertisers.reduce((sum, a) => sum + (a.campaignCount || 0), 0)}
                    </Typography>
                  </Box>
                </Box>
                <Chip 
                  label={`${advertisers.length > 0 ? Math.round(advertisers.reduce((sum, a) => sum + (a.campaignCount || 0), 0) / advertisers.length) : 0} avg per advertiser`}
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
                  <AttachMoney color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Avg Monthly Revenue
                    </Typography>
                    <Typography variant="h5">
                      ${Math.round(advertisers.reduce((sum, a) => sum + a.totalSpend, 0) / currentMonth).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
                <Chip 
                  label={`$${Math.round(advertisers.reduce((sum, a) => sum + a.totalSpend, 0) / 12).toLocaleString()}/Month Last Year`}
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
                  <TrendingUp color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Revenue
                    </Typography>
                    <Typography variant="h5">
                      ${advertisers.reduce((sum, a) => sum + a.totalSpend, 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </Typography>
                  </Box>
                </Box>
                <Chip 
                  label={`${advertisers.length > 0 ? '$' + Math.round(advertisers.reduce((sum, a) => sum + a.totalSpend, 0) / advertisers.length).toLocaleString() : '$0'} avg per advertiser`}
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
            placeholder="Search advertisers..."
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
            <Typography>Loading advertisers...</Typography>
          </Box>
        )}

        {/* Error State */}
        {error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography color="error">Error loading advertisers. Please try again.</Typography>
          </Box>
        )}

        {/* Advertisers Table */}
        {!isLoading && !error && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Advertiser</TableCell>
                <TableCell>Industry</TableCell>
                <TableCell>Agency</TableCell>
                <TableCell>Active Campaigns</TableCell>
                <TableCell>Monthly Spend</TableCell>
                <TableCell>Total Spend</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAdvertisers
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((advertiser) => (
                  <TableRow 
                    key={advertiser.id} 
                    hover 
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/advertisers/${advertiser.id}`)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {advertiser.name[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">{advertiser.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {advertiser.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{advertiser.industry || 'N/A'}</TableCell>
                    <TableCell>
                      {advertiser.agency?.name ? (
                        advertiser.agency.name
                      ) : (
                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                          No agency assigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{advertiser.campaignCount || 0}</TableCell>
                    <TableCell>${Math.round((advertiser.totalSpend || 0) / currentMonth).toLocaleString()}</TableCell>
                    <TableCell>${advertiser.totalSpend.toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={advertiser.status}
                        size="small"
                        color={advertiser.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMenuOpen(e, advertiser)
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
            count={filteredAdvertisers.length}
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
            router.push(`/advertisers/${selectedAdvertiser?.id}`)
            handleMenuClose()
          }}>
            <Visibility fontSize="small" sx={{ mr: 1 }} />
            View Details
          </MenuItem>
          <MenuItem onClick={() => {
            router.push(`/advertisers/${selectedAdvertiser?.id}/campaigns`)
            handleMenuClose()
          }}>
            <Campaign fontSize="small" sx={{ mr: 1 }} />
            View Campaigns
          </MenuItem>
          <MenuItem onClick={() => {
            router.push(`/advertisers/${selectedAdvertiser?.id}/edit`)
            handleMenuClose()
          }}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit Advertiser
          </MenuItem>
          <MenuItem onClick={() => {
            if (selectedAdvertiser?.email && typeof window !== 'undefined') {
              window.location.href = `mailto:${selectedAdvertiser.email}`
            }
            handleMenuClose()
          }}>
            <Email fontSize="small" sx={{ mr: 1 }} />
            Send Email
          </MenuItem>
          <MenuItem onClick={() => {
            if (selectedAdvertiser?.phone && typeof window !== 'undefined') {
              window.location.href = `tel:${selectedAdvertiser.phone}`
            }
            handleMenuClose()
          }}>
            <Phone fontSize="small" sx={{ mr: 1 }} />
            Call
          </MenuItem>
          {selectedAdvertiser?.status === 'prospect' && (
            <MenuItem onClick={() => {
              if (selectedAdvertiser) handleStatusChange(selectedAdvertiser.id, 'active')
            }}>
              <Store fontSize="small" sx={{ mr: 1 }} />
              Activate Advertiser
            </MenuItem>
          )}
          {selectedAdvertiser?.status === 'active' && (
            <MenuItem onClick={() => {
              if (selectedAdvertiser) handleStatusChange(selectedAdvertiser.id, 'inactive')
            }}>
              <Store fontSize="small" sx={{ mr: 1 }} />
              Deactivate Advertiser
            </MenuItem>
          )}
          <MenuItem 
            onClick={() => {
              setDeleteDialog(true)
              handleMenuClose()
            }}
            sx={{ color: 'error.main' }}
          >
            <Delete fontSize="small" sx={{ mr: 1 }} />
            {user?.role === 'admin' || user?.role === 'master' ? 'Delete Advertiser' : 'Request Deletion'}
          </MenuItem>
        </Menu>

        {/* Add Advertiser Dialog */}
        <Dialog 
          open={addDialog} 
          onClose={() => setAddDialog(false)} 
          maxWidth="sm" 
          fullWidth
          aria-labelledby="add-advertiser-dialog-title"
        >
          <DialogTitle id="add-advertiser-dialog-title">Add New Advertiser</DialogTitle>
          <DialogContent>
            <Box component="form" sx={{ pt: 2 }} noValidate>
              <TextField 
                fullWidth 
                id="company-name"
                name="companyName"
                label="Company Name" 
                margin="normal" 
                value={addForm.name}
                onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                required
              />
              <TextField 
                fullWidth 
                id="industry"
                name="industry"
                label="Industry" 
                margin="normal" 
                value={addForm.industry}
                onChange={(e) => setAddForm({...addForm, industry: e.target.value})}
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
                required
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
              <TextField 
                fullWidth 
                id="agency"
                name="agency"
                label="Agency (Optional)" 
                margin="normal" 
                select
                value={addForm.agencyId}
                onChange={(e) => setAddForm({...addForm, agencyId: e.target.value})}
              >
                <MenuItem value="">No Agency (Independent)</MenuItem>
                {agencies.map((agency: any) => (
                  <MenuItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddAdvertiser}>Add Advertiser</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog 
          open={deleteDialog} 
          onClose={() => {
            setDeleteDialog(false)
            setDeleteReason('')
          }}
          aria-labelledby="delete-advertiser-dialog-title"
          aria-describedby="delete-advertiser-dialog-description"
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle id="delete-advertiser-dialog-title">
            {user?.role === 'admin' || user?.role === 'master' ? 'Delete Advertiser?' : 'Request Advertiser Deletion'}
          </DialogTitle>
          <DialogContent>
            <Typography id="delete-advertiser-dialog-description" sx={{ mb: 2 }}>
              {user?.role === 'admin' || user?.role === 'master' 
                ? `Are you sure you want to delete "${selectedAdvertiser?.name}"? This action cannot be undone and will remove all associated campaign data.`
                : `You are requesting to delete "${selectedAdvertiser?.name}". An admin will review your request before the advertiser is removed.`
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
                placeholder="Please provide a reason for deleting this advertiser..."
                sx={{ mt: 2 }}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setDeleteDialog(false)
              setDeleteReason('')
            }}>Cancel</Button>
            <Button onClick={handleDeleteAdvertiser} color="error" variant="contained">
              {user?.role === 'admin' || user?.role === 'master' ? 'Delete' : 'Submit Request'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Error Snackbar */}
        <Snackbar
          open={showError}
          autoHideDuration={6000}
          onClose={() => setShowError(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setShowError(false)}
            severity="error"
            sx={{ width: '100%' }}
          >
            {errorMessage}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
    </RouteProtection>
  )
}
