'use client'


import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Tooltip,
  Avatar,
} from '@mui/material'
import {
  Search,
  Add,
  MoreVert,
  Business,
  Edit,
  Visibility,
  Block,
  Settings,
  CheckCircle,
  Warning,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Organization } from '@/types/auth'
import { masterApi } from '@/services/masterApi'

export default function OrganizationsPage() {
  // Cache bust: Force new chunk generation
  const { user } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [statusDialog, setStatusDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [newStatus, setNewStatus] = useState<Organization['status']>('active')

  // Fetch organizations
  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ['organizations-master'], // Static key to avoid constant re-renders
    queryFn: async () => {
      // Import masterApi service
      const { masterApi: masterApiService } = await import('@/services/masterApi')
      
      // Fetch organizations from master endpoint
      const response = await masterApiService.organizations.getAll()
      return response.organizations || []
    },
    refetchInterval: false, // Disable automatic refresh
    staleTime: 0, // Always refetch when window regains focus
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })

  // Update organization status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orgId, status }: { orgId: string; status: Organization['status'] }) => {
      const response = await fetch(`/api/master/organizations/${orgId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status })
      })
      if (!response.ok) {
        throw new Error('Failed to update organization status')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      setStatusDialog(false)
      setSelectedOrg(null)
    },
  })

  // Delete organization
  const deleteOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const response = await fetch(`/api/master/organizations/${orgId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete organization')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      setDeleteDialog(false)
      setSelectedOrg(null)
    },
  })

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.domain?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, org: Organization) => {
    setAnchorEl(event.currentTarget)
    setSelectedOrg(org)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleStatusChange = (event: SelectChangeEvent) => {
    setNewStatus(event.target.value as Organization['status'])
  }

  const handleUpdateStatus = () => {
    if (selectedOrg) {
      updateStatusMutation.mutate({ orgId: selectedOrg.id, status: newStatus })
    }
  }

  const getStatusIcon = (status: Organization['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
      case 'suspended':
        return <Block sx={{ fontSize: 16, color: 'error.main' }} />
      case 'trial':
        return <Warning sx={{ fontSize: 16, color: 'warning.main' }} />
      default:
        return null
    }
  }

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'starter':
        return 'default'
      case 'professional':
        return 'primary'
      case 'enterprise':
        return 'secondary'
      case 'master':
        return 'error'
      default:
        return 'default'
    }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.MASTER_MANAGE_ORGS}>
      <DashboardLayout>
      <RoleGuard roles={['master']}>
        <Box>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
                Organizations
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage all organizations on the platform
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => router.push('/master/organizations/new')}
            >
              Invite Organization
            </Button>
          </Box>

          {/* Search and Filters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <TextField
                fullWidth
                placeholder="Search organizations by name or domain..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </CardContent>
          </Card>

          {/* Organizations Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Monthly Revenue</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Users</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Loading organizations...
                    </TableCell>
                  </TableRow>
                ) : filteredOrgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrgs.map((org) => (
                    <TableRow key={org.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            <Business />
                          </Avatar>
                          <Box>
                            <Typography variant="body1">{org.name}</Typography>
                            {org.domain && (
                              <Typography variant="caption" color="text.secondary">
                                {org.domain}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={org.plan}
                          size="small"
                          color={getPlanColor(org.plan)}
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          ${org.monthlyRevenue || 0}/mo
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {getStatusIcon(org.status)}
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {org.status}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {org.limits?.users ? `${org.activeUsers}/${org.limits.users}` : 'Unlimited'}
                      </TableCell>
                      <TableCell>
                        {new Date(org.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuClick(e, org)}
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Actions Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => {
              router.push(`/master/organizations/${selectedOrg?.id}`)
              handleMenuClose()
            }}>
              <Edit sx={{ mr: 1, fontSize: 20 }} />
              Edit Details
            </MenuItem>
            <MenuItem onClick={() => {
              router.push(`/master/organizations/${selectedOrg?.id}/features`)
              handleMenuClose()
            }}>
              <Settings sx={{ mr: 1, fontSize: 20 }} />
              Manage Features
            </MenuItem>
            <MenuItem onClick={() => {
              router.push(`/master/impersonate?org=${selectedOrg?.id}`)
              handleMenuClose()
            }}>
              <Visibility sx={{ mr: 1, fontSize: 20 }} />
              View as Organization
            </MenuItem>
            <MenuItem onClick={() => {
              setStatusDialog(true)
              setNewStatus(selectedOrg?.status || 'active')
              handleMenuClose()
            }}>
              <Block sx={{ mr: 1, fontSize: 20 }} />
              Change Status
            </MenuItem>
            <MenuItem onClick={() => {
              setDeleteDialog(true)
              setDeleteConfirmName('')
              handleMenuClose()
            }} sx={{ color: 'error.main' }}>
              <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
              Delete Organization
            </MenuItem>
          </Menu>

          {/* Status Change Dialog */}
          <Dialog open={statusDialog} onClose={() => setStatusDialog(false)}>
            <DialogTitle>Change Organization Status</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Changing the status of {selectedOrg?.name} will affect all users in the organization.
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={newStatus}
                  onChange={handleStatusChange}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="trial">Trial</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setStatusDialog(false)}>Cancel</Button>
              <Button
                onClick={handleUpdateStatus}
                variant="contained"
                disabled={updateStatusMutation.isPending}
              >
                Update Status
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogContent>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Are you sure you want to delete <strong>{selectedOrg?.name}</strong>?
              </Typography>
              <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                This action cannot be undone. This will permanently delete:
              </Typography>
              <ul>
                <li>The organization and all its settings</li>
                <li>All users associated with this organization</li>
                <li>All campaigns, shows, and episodes</li>
                <li>All data and analytics</li>
              </ul>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Type the organization name to confirm: <strong>{selectedOrg?.name}</strong>
              </Typography>
              <TextField
                fullWidth
                margin="normal"
                placeholder="Organization name"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setDeleteDialog(false)
                setDeleteConfirmName('')
              }}>Cancel</Button>
              <Button
                onClick={() => selectedOrg && deleteOrgMutation.mutate(selectedOrg.id)}
                variant="contained"
                color="error"
                disabled={deleteConfirmName !== selectedOrg?.name || deleteOrgMutation.isPending}
              >
                {deleteOrgMutation.isPending ? 'Deleting...' : 'Delete Organization'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </RoleGuard>
    </DashboardLayout>
    </RouteProtection>
  )
}