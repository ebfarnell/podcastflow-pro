'use client'

import React, { useState } from 'react'
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
  IconButton,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  InputAdornment,
  Menu,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Block as BlockIcon,
  Email as EmailIcon,
  LockReset as LockResetIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useQuery } from '@tanstack/react-query'
import { MasterOnly } from '@/components/auth/RoleGuard'
import { masterApi, type GlobalUser } from '@/services/masterApi'

export default function GlobalUsersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedUser, setSelectedUser] = useState<GlobalUser | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false)
  const [showEditUserDialog, setShowEditUserDialog] = useState(false)
  const [userDetails, setUserDetails] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    email: '',
    role: '',
    status: '',
    phone: '',
    title: '',
    department: ''
  })
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'client',
    organizationId: ''
  })

  // Fetch organizations for the filter dropdown
  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations-list'],
    queryFn: async () => {
      const response = await masterApi.organizations.getAll()
      return response.organizations || []
    },
    refetchInterval: false,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  })

  // Fetch all users across all organizations
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['global-users', roleFilter, statusFilter, organizationFilter, searchTerm, sortBy, sortOrder],
    queryFn: async () => {
      const params: any = {}
      if (roleFilter !== 'all') params.role = roleFilter
      if (statusFilter !== 'all') params.status = statusFilter
      if (organizationFilter !== 'all') params.organizationId = organizationFilter
      if (searchTerm) params.search = searchTerm
      params.sortBy = sortBy
      params.sortOrder = sortOrder
      
      const response = await masterApi.users.getGlobalUsers(params)
      return response
    },
    refetchInterval: false, // Disable automatic refresh
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  })

  // Client-side filtering is now minimal since server handles most filtering
  const filteredUsers = users

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Render sortable column header
  const renderSortableHeader = (column: string, label: string) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': { opacity: 0.7 }
      }}
      onClick={() => handleSort(column)}
    >
      <Typography variant="body2" fontWeight="bold">
        {label}
      </Typography>
      {sortBy === column && (
        sortOrder === 'asc' ? 
          <ArrowUpwardIcon sx={{ ml: 0.5, fontSize: 16 }} /> : 
          <ArrowDownwardIcon sx={{ ml: 0.5, fontSize: 16 }} />
      )}
    </Box>
  )

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, user: GlobalUser) => {
    setAnchorEl(event.currentTarget)
    setSelectedUser(user)
  }

  const handleCloseMenu = () => {
    setAnchorEl(null)
    setSelectedUser(null)
  }

  const handleViewDetails = async (user: GlobalUser) => {
    try {
      const details = await masterApi.users.getUserDetails(user.id)
      setUserDetails(details)
      setShowUserDetailsDialog(true)
    } catch (error) {
      console.error('Error fetching user details:', error)
      alert('Failed to load user details')
    }
    handleCloseMenu()
  }

  const handleEditUser = async (user: GlobalUser) => {
    try {
      const details = await masterApi.users.getUserDetails(user.id)
      setEditForm({
        id: user.id,
        name: details.name || '',
        email: details.email || '',
        role: details.role || '',
        status: details.status || '',
        phone: details.phone || '',
        title: details.title || '',
        department: details.department || ''
      })
      setShowEditUserDialog(true)
    } catch (error) {
      console.error('Error fetching user details:', error)
      alert('Failed to load user details')
    }
    handleCloseMenu()
  }

  const handleSaveUserEdit = async () => {
    if (!editForm.name || !editForm.email) {
      alert('Name and email are required')
      return
    }

    try {
      const response = await fetch(`/api/master/users/${editForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          status: editForm.status,
          phone: editForm.phone,
          title: editForm.title,
          department: editForm.department
        }),
      })

      const result = await response.json()

      if (response.ok) {
        alert('User updated successfully!')
        setShowEditUserDialog(false)
        setEditForm({
          id: '',
          name: '',
          email: '',
          role: '',
          status: '',
          phone: '',
          title: '',
          department: ''
        })
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      } else {
        alert(`Failed to update user: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user')
    }
  }

  const handleImpersonateUser = async (user: GlobalUser) => {
    try {
      const response = await masterApi.users.impersonateUser(user.id)
      
      // Set the new auth token
      document.cookie = `auth-token=${response.token}; path=/; max-age=${8 * 60 * 60}; SameSite=Strict`
      
      // Redirect to the user's default dashboard
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard'
      }
    } catch (error) {
      console.error('Error impersonating user:', error)
      alert('Failed to impersonate user')
    }
    handleCloseMenu()
  }

  const handleSuspendUser = async (user: GlobalUser) => {
    try {
      await masterApi.users.updateUserStatus(user.id, 'suspended')
      // Refetch the query to update the list
      // Use React Query's refetch functionality instead of page reload
      window.location.reload() // Simple but effective for now
    } catch (error) {
      console.error('Error suspending user:', error)
      alert('Failed to suspend user')
    }
    handleCloseMenu()
  }

  const handleDeactivateUser = async (user: GlobalUser) => {
    if (!confirm(`Are you sure you want to deactivate ${user.name || user.email}? This will disable their account but preserve their data.`)) {
      handleCloseMenu()
      return
    }
    
    try {
      await masterApi.users.deleteUser(user.id, false) // Soft delete
      window.location.reload()
    } catch (error) {
      console.error('Error deactivating user:', error)
      alert('Failed to deactivate user')
    }
    handleCloseMenu()
  }

  const handleDeleteUser = async (user: GlobalUser) => {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE ${user.name || user.email}? This action cannot be undone and will remove all their data.`)) {
      handleCloseMenu()
      return
    }
    
    if (!confirm('FINAL WARNING: This will permanently delete the user and all their data. Type YES to confirm.') || !window.prompt('Type "DELETE" to confirm:')?.toUpperCase().includes('DELETE')) {
      handleCloseMenu()
      return
    }
    
    try {
      await masterApi.users.deleteUser(user.id, true) // Hard delete
      window.location.reload()
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
    handleCloseMenu()
  }

  const handleInviteUser = async () => {
    if (!inviteForm.email || !inviteForm.name || !inviteForm.organizationId) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const response = await fetch('/api/master/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteForm.email,
          name: inviteForm.name,
          role: inviteForm.role,
          organizationId: inviteForm.organizationId
        }),
      })

      const result = await response.json()

      if (response.ok) {
        const message = result.emailSent 
          ? 'User invitation sent successfully!'
          : 'User created but email could not be sent. Please resend invitation manually.'
        alert(message)
        setShowInviteDialog(false)
        setInviteForm({ email: '', name: '', role: 'client', organizationId: '' })
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      } else {
        alert(`Failed to send invitation: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error inviting user:', error)
      alert('Failed to send invitation')
    }
  }

  const handleResendInvitation = async (user: GlobalUser) => {
    if (!confirm(`Resend invitation to ${user.email}?`)) {
      handleCloseMenu()
      return
    }

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resend',
          userId: user.id
        }),
      })

      const result = await response.json()

      if (response.ok) {
        alert('Invitation resent successfully!')
      } else {
        alert(`Failed to resend invitation: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error resending invitation:', error)
      alert('Failed to resend invitation')
    }
    handleCloseMenu()
  }

  const handleSendPasswordReset = async (user: GlobalUser) => {
    if (!confirm(`Send password reset link to ${user.email}?`)) {
      handleCloseMenu()
      return
    }

    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          userId: user.id
        }),
      })

      const result = await response.json()

      if (response.ok) {
        alert('Password reset link sent successfully!')
      } else {
        alert(`Failed to send password reset: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error sending password reset:', error)
      alert('Failed to send password reset')
    }
    handleCloseMenu()
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'master': return 'error'      // Red
      case 'admin': return 'primary'     // Blue
      case 'sales': return 'success'    // Green
      case 'producer': return 'warning'  // Orange/Yellow
      case 'talent': return 'secondary'  // Purple
      case 'client': return 'info'       // Light Blue
      default: return 'default'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'invited': return 'info'
      case 'inactive': return 'warning'
      case 'suspended': return 'error'
      default: return 'default'
    }
  }

  // Calculate statistics
  const totalUsers = users.length
  const activeUsers = users.filter((u: GlobalUser) => u.status === 'active').length
  const uniqueOrganizations = new Set(users.map((u: GlobalUser) => u.organizationId)).size
  const recentSignups = users.filter((u: GlobalUser) => {
    const createdDate = new Date(u.createdAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return createdDate > weekAgo
  }).length

  return (
    <MasterOnly>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
                Global Users
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage all users across all organizations
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowInviteDialog(true)}
              sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
            >
              Invite User
            </Button>
          </Box>

          {/* Statistics Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PeopleIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Total Users
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {totalUsers}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Across all organizations
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SecurityIcon sx={{ mr: 2, color: 'success.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Active Users
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {activeUsers}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Currently online
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BusinessIcon sx={{ mr: 2, color: 'info.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Organizations
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {uniqueOrganizations}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    With active users
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUpIcon sx={{ mr: 2, color: 'warning.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Recent Signups
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {recentSignups}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last 7 days
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                placeholder="Search users or organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ flex: 1, minWidth: 300 }}
              />
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel>Organization</InputLabel>
                <Select
                  value={organizationFilter}
                  onChange={(e) => setOrganizationFilter(e.target.value)}
                  label="Organization"
                >
                  <MenuItem value="all">All Organizations</MenuItem>
                  {organizations.map((org: any) => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  label="Role"
                >
                  <MenuItem value="all">All Roles</MenuItem>
                  <MenuItem value="master">Master</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="sales">Sales</MenuItem>
                  <MenuItem value="producer">Producer</MenuItem>
                  <MenuItem value="talent">Talent</MenuItem>
                  <MenuItem value="client">Client</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="invited">Invited</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Paper>

          {/* Users Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{renderSortableHeader('name', 'User')}</TableCell>
                  <TableCell>{renderSortableHeader('organization', 'Organization')}</TableCell>
                  <TableCell>{renderSortableHeader('role', 'Role')}</TableCell>
                  <TableCell>{renderSortableHeader('status', 'Status')}</TableCell>
                  <TableCell>{renderSortableHeader('lastLoginAt', 'Last Login')}</TableCell>
                  <TableCell>{renderSortableHeader('createdAt', 'Created')}</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user: GlobalUser) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar>
                            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {user.name || user.email || 'Unknown User'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {user.email || 'No email'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.organizationName || user.organizationId || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.role || 'unknown'}
                          size="small"
                          color={getRoleColor(user.role)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.status || 'unknown'}
                          size="small"
                          color={getStatusColor(user.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleDateString()
                            : 'Never'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={(e) => handleOpenMenu(e, user)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Action Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleCloseMenu}
          >
            <MenuItem onClick={() => selectedUser && handleEditUser(selectedUser)}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit User</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => selectedUser && handleViewDetails(selectedUser)}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>View Details</ListItemText>
            </MenuItem>
            {selectedUser?.status === 'invited' && (
              <MenuItem onClick={() => selectedUser && handleResendInvitation(selectedUser)}>
                <ListItemIcon>
                  <EmailIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText>Resend Invitation</ListItemText>
              </MenuItem>
            )}
            <MenuItem onClick={() => selectedUser && handleSendPasswordReset(selectedUser)}>
              <ListItemIcon>
                <LockResetIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>Send Password Reset</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => selectedUser && handleImpersonateUser(selectedUser)}>
              <ListItemIcon>
                <SecurityIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Impersonate User</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => selectedUser && handleSuspendUser(selectedUser)}>
              <ListItemIcon>
                <BlockIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText>Suspend User</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => selectedUser && handleDeactivateUser(selectedUser)}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText>Deactivate User</ListItemText>
            </MenuItem>
            <MenuItem 
              onClick={() => selectedUser && handleDeleteUser(selectedUser)}
              disabled={selectedUser?.role === 'master'}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete Permanently</ListItemText>
            </MenuItem>
          </Menu>

          {/* Invite User Dialog */}
          <Dialog 
            open={showInviteDialog} 
            onClose={() => setShowInviteDialog(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Invite New User</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                Invite a new user to any organization. They will receive an email with instructions to set up their account.
              </DialogContentText>
              
              <TextField
                autoFocus
                margin="dense"
                label="Email Address"
                type="email"
                fullWidth
                variant="outlined"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                sx={{ mb: 2 }}
                required
              />
              
              <TextField
                margin="dense"
                label="Full Name"
                type="text"
                fullWidth
                variant="outlined"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                sx={{ mb: 2 }}
                required
              />
              
              <FormControl fullWidth sx={{ mb: 2 }} required>
                <InputLabel>Organization</InputLabel>
                <Select
                  value={inviteForm.organizationId}
                  onChange={(e) => setInviteForm({ ...inviteForm, organizationId: e.target.value })}
                  label="Organization"
                >
                  {organizations.map((org: any) => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth required>
                <InputLabel>Role</InputLabel>
                <Select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  label="Role"
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="sales">Sales</MenuItem>
                  <MenuItem value="producer">Producer</MenuItem>
                  <MenuItem value="talent">Talent</MenuItem>
                  <MenuItem value="client">Client</MenuItem>
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowInviteDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleInviteUser}
                variant="contained"
                disabled={!inviteForm.email || !inviteForm.name || !inviteForm.organizationId}
              >
                Send Invitation
              </Button>
            </DialogActions>
          </Dialog>

          {/* User Details Dialog */}
          <Dialog 
            open={showUserDetailsDialog} 
            onClose={() => setShowUserDetailsDialog(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar>
                  {(userDetails?.name || userDetails?.email || 'U').charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {userDetails?.name || 'Unknown User'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {userDetails?.email}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              {userDetails && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Basic Information</Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Full Name</Typography>
                      <Typography variant="body1">{userDetails.name || 'Not provided'}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Email</Typography>
                      <Typography variant="body1">{userDetails.email}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Role</Typography>
                      <Chip 
                        label={userDetails.role} 
                        size="small" 
                        color={getRoleColor(userDetails.role)} 
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Status</Typography>
                      <Chip 
                        label={userDetails.status} 
                        size="small" 
                        color={getStatusColor(userDetails.status)} 
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Organization Details</Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Organization</Typography>
                      <Typography variant="body1">{userDetails.organizationName || 'Unknown'}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Phone</Typography>
                      <Typography variant="body1">{userDetails.phone || 'Not provided'}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Title</Typography>
                      <Typography variant="body1">{userDetails.title || 'Not provided'}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Department</Typography>
                      <Typography variant="body1">{userDetails.department || 'Not provided'}</Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>Account Activity</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">Created</Typography>
                          <Typography variant="body1">
                            {userDetails.createdAt ? new Date(userDetails.createdAt).toLocaleDateString() : 'Unknown'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">Last Login</Typography>
                          <Typography variant="body1">
                            {userDetails.lastLoginAt ? new Date(userDetails.lastLoginAt).toLocaleDateString() : 'Never'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">Sessions</Typography>
                          <Typography variant="body1">{userDetails.sessionCount || 0} active</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Grid>
                  
                  {userDetails.campaigns && userDetails.campaigns.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>Recent Campaigns</Typography>
                      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {userDetails.campaigns.slice(0, 5).map((campaign: any) => (
                          <Box key={campaign.id} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="body2" fontWeight="medium">{campaign.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {campaign.status} • Created {new Date(campaign.createdAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Grid>
                  )}
                </Grid>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowUserDetailsDialog(false)}>Close</Button>
              {selectedUser && (
                <Button 
                  variant="contained" 
                  onClick={() => {
                    setShowUserDetailsDialog(false)
                    handleImpersonateUser(selectedUser)
                  }}
                >
                  Impersonate User
                </Button>
              )}
            </DialogActions>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog 
            open={showEditUserDialog} 
            onClose={() => setShowEditUserDialog(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>Edit User</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                Update user information and permissions.
              </DialogContentText>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    autoFocus
                    margin="dense"
                    label="Full Name"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    margin="dense"
                    label="Email Address"
                    type="email"
                    fullWidth
                    variant="outlined"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth margin="dense">
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      label="Role"
                    >
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="sales">Sales</MenuItem>
                      <MenuItem value="producer">Producer</MenuItem>
                      <MenuItem value="talent">Talent</MenuItem>
                      <MenuItem value="client">Client</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth margin="dense">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      label="Status"
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="invited">Invited</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="suspended">Suspended</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    margin="dense"
                    label="Phone"
                    type="tel"
                    fullWidth
                    variant="outlined"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    margin="dense"
                    label="Title"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    margin="dense"
                    label="Department"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowEditUserDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleSaveUserEdit}
                variant="contained"
                disabled={!editForm.name || !editForm.email}
              >
                Save Changes
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </DashboardLayout>
    </MasterOnly>
  )
}