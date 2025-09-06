'use client'

// Force dynamic rendering - this page uses authentication and dynamic data
export const dynamic = 'force-dynamic'

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
  Business as BusinessIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { clientsApi, userApi } from '@/services/api'

interface Client {
  clientId: string
  companyName: string
  contactName: string
  email: string
  phone: string
  industry: string
  status: string
  assignedSeller?: string
  salesDetails?: any
  totalSpend: number
  activeCampaigns: number
  createdAt: string
  updatedAt: string
}

interface User {
  userId: string
  name: string
  email: string
  role: string
}

export default function ClientsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [salesReps, setSalesReps] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [industryFilter, setIndustryFilter] = useState<string>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [assignSellerDialogOpen, setAssignSellerDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedSeller, setSelectedSeller] = useState<User | null>(null)
  const [newClient, setNewClient] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    industry: '',
  })

  useEffect(() => {
    if (token) {
      fetchClients()
      fetchSalesReps()
    }
  }, [token, statusFilter, industryFilter])

  const fetchClients = async () => {
    try {
      setLoading(true)
      const params: any = {}
      
      // For sales reps, only show their assigned clients
      if (user?.role === 'sales') {
        params.ownOnly = 'true'
      }
      
      const response = await clientsApi.list(params)
      
      // Filter by status and industry on client side
      let filteredClients = response.clients || []
      
      if (statusFilter !== 'all') {
        filteredClients = filteredClients.filter((client: Client) => client.status === statusFilter)
      }
      
      if (industryFilter !== 'all') {
        filteredClients = filteredClients.filter((client: Client) => client.industry === industryFilter)
      }
      
      setClients(filteredClients)
    } catch (error) {
      console.error('Error fetching clients:', error)
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSalesReps = async () => {
    try {
      const response = await userApi.list({ role: 'sales' })
      setSalesReps(response.users || [])
    } catch (error) {
      console.error('Error fetching sales reps:', error)
    }
  }

  const handleCreateClient = async () => {
    try {
      await clientsApi.create(newClient)
      
      setCreateDialogOpen(false)
      setNewClient({
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        industry: '',
      })
      fetchClients()
    } catch (error) {
      console.error('Error creating client:', error)
      alert('Failed to create client')
    }
  }

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return

    try {
      await clientsApi.delete(clientId)
      fetchClients()
    } catch (error) {
      console.error('Error deleting client:', error)
      alert('Failed to delete client')
    }
  }

  const handleAssignSeller = async () => {
    if (!selectedClient || !selectedSeller) return

    try {
      await clientsApi.update(selectedClient.clientId, {
        assignedSeller: selectedSeller.userId
      })
      setAssignSellerDialogOpen(false)
      setSelectedClient(null)
      setSelectedSeller(null)
      fetchClients()
    } catch (error) {
      console.error('Error assigning sales rep:', error)
      alert('Failed to assign sales rep')
    }
  }

  const columns: GridColDef[] = [
    {
      field: 'companyName',
      headerName: 'Company',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
            <BusinessIcon sx={{ fontSize: 18 }} />
          </Avatar>
          <Box>
            <Typography variant="body2">{params.value}</Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.industry}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'contactName',
      headerName: 'Contact',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const getStatusColor = (status: string) => {
          switch (status) {
            case 'active':
              return 'success'
            case 'prospect':
              return 'info'
            case 'inactive':
              return 'default'
            case 'churned':
              return 'error'
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
      field: 'activeCampaigns',
      headerName: 'Campaigns',
      width: 100,
      type: 'number',
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CampaignIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2">{params.value || 0}</Typography>
        </Box>
      ),
    },
    {
      field: 'totalSpend',
      headerName: 'Total Spend',
      width: 130,
      type: 'number',
      valueFormatter: (params) => {
        const value = params.value || 0
        return `$${value.toLocaleString()}`
      },
    },
    {
      field: 'assignedSeller',
      headerName: 'Assigned Seller',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        params.value ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
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
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/clients/${params.row.clientId}`)
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          {(user?.role === 'admin' || user?.role === 'sales') && (
            <>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedClient(params.row)
                  setAssignSellerDialogOpen(true)
                }}
              >
                <PersonIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteClient(params.row.clientId)
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

  const filteredClients = clients.filter((client) =>
    client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleRowClick = (params: any) => {
    router.push(`/clients/${params.row.clientId}`)
  }

  const canCreateClient = user?.role === 'admin' || user?.role === 'sales'

  const industries = ['technology', 'retail', 'finance', 'healthcare', 'entertainment', 'other']

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Clients
          </Typography>
          {canCreateClient && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              New Client
            </Button>
          )}
        </Box>

        <Card>
          <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search clients..."
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
              <InputLabel>Industry</InputLabel>
              <Select
                value={industryFilter}
                label="Industry"
                onChange={(e) => setIndustryFilter(e.target.value)}
              >
                <MenuItem value="all">All Industries</MenuItem>
                {industries.map((industry) => (
                  <MenuItem key={industry} value={industry}>
                    {industry.charAt(0).toUpperCase() + industry.slice(1)}
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
            rows={filteredClients}
            columns={columns}
            getRowId={(row) => row.clientId}
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
        <MenuItem onClick={() => { setStatusFilter('active'); setFilterAnchorEl(null); }}>
          Active
        </MenuItem>
        <MenuItem onClick={() => { setStatusFilter('prospect'); setFilterAnchorEl(null); }}>
          Prospect
        </MenuItem>
        <MenuItem onClick={() => { setStatusFilter('inactive'); setFilterAnchorEl(null); }}>
          Inactive
        </MenuItem>
        <MenuItem onClick={() => { setStatusFilter('churned'); setFilterAnchorEl(null); }}>
          Churned
        </MenuItem>
      </Menu>

      {/* Create Client Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Client</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Company Name"
                fullWidth
                value={newClient.companyName}
                onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Contact Name"
                fullWidth
                value={newClient.contactName}
                onChange={(e) => setNewClient({ ...newClient, contactName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                fullWidth
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Industry</InputLabel>
                <Select
                  value={newClient.industry}
                  label="Industry"
                  onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
                >
                  {industries.map((industry) => (
                    <MenuItem key={industry} value={industry}>
                      {industry.charAt(0).toUpperCase() + industry.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateClient}
            variant="contained"
            disabled={!newClient.companyName || !newClient.contactName || !newClient.email}
          >
            Create Client
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Seller Dialog */}
      <Dialog
        open={assignSellerDialogOpen}
        onClose={() => setAssignSellerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Assign Seller to Client</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Autocomplete
              options={salesReps}
              getOptionLabel={(option) => `${option.name} (${option.email})`}
              value={selectedSeller}
              onChange={(event, newValue) => setSelectedSeller(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Seller"
                  variant="outlined"
                  fullWidth
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignSellerDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAssignSeller}
            variant="contained"
            disabled={!selectedSeller}
          >
            Assign Seller
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  )
}