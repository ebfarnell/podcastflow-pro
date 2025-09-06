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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Tooltip,
  InputAdornment,
  Menu,
  ListItemIcon,
  ListItemText,
  Alert,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Shield as ShieldIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Send as SendIcon,
  Upload as UploadIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminOnly } from '@/components/auth/RoleGuard'
import { UserRole } from '@/types/auth'
import { api, userApi } from '@/services/api'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  name: string
  role: UserRole
  organizationId: string
  phone?: string
  title?: string
  department?: string
  avatar?: string
  createdAt: string
  lastLoginAt?: string
  isActive: boolean
  emailVerified: boolean
  organization?: {
    id: string
    name: string
    slug: string
  }
}

export default function UsersManagementPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [menuUser, setMenuUser] = useState<User | null>(null)
  const [emailStatus, setEmailStatus] = useState<{
    show: boolean
    success: boolean
    message: string
    details?: any
  }>({ show: false, success: true, message: '', details: null })

  // Form state for new/edit user
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'client' as UserRole,
    phone: '',
    title: '',
    department: '',
  })

  // Fetch organization users - optimized for cost efficiency
  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['organization-users', roleFilter, statusFilter],
    queryFn: async () => {
      const params: any = {}
      if (roleFilter !== 'all') params.role = roleFilter
      if (statusFilter !== 'all') params.status = statusFilter
      
      // Use userApi to get organization-specific users
      const response = await userApi.list(params)
      return response.users || response.data || response || []
    },
    // Removed automatic polling - user list doesn't change frequently
    // refetchInterval: 30000, // Removed for cost efficiency
  })

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return userApi.create(data)
    },
    onSuccess: async (response) => {
      console.log('✅ User invitation response:', response)
      setInviteDialogOpen(false)
      resetForm()
      
      // Show email status message
      if (response.emailSent) {
        setEmailStatus({
          show: true,
          success: true,
          message: `User created and invitation sent successfully! Email ID: ${response.emailDetails?.messageId || 'N/A'}`,
          details: response.emailDetails
        })
      } else if (response.warning) {
        setEmailStatus({
          show: true,
          success: false,
          message: response.warning,
          details: response.emailDetails
        })
      } else {
        setEmailStatus({
          show: true,
          success: false,
          message: 'User created but invitation email could not be sent.',
          details: response.emailDetails
        })
      }
      
      // Refresh the user list after a delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['organization-users'] })
        refetch()
      }, 1000)
    },
    onError: (error: any) => {
      console.error('❌ Failed to send invitation:', error)
      setEmailStatus({
        show: true,
        success: false,
        message: `Failed to create user: ${error.message || 'Unknown error'}`,
        details: null
      })
    }
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return userApi.update(id, data)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'organization-users'
      })
      await refetch()
      setDialogOpen(false)
      setSelectedUser(null)
      resetForm()
    },
  })

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      return userApi.updateRole(id, role)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'organization-users'
      })
      await refetch()
      handleCloseMenu()
    },
  })

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return userApi.updateStatus(id, status)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'organization-users'
      })
      await refetch()
      handleCloseMenu()
    },
  })

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return userApi.delete(id)
    },
    onSuccess: async () => {
      console.log('User deleted, refreshing list...')
      setDeleteDialogOpen(false)
      setSelectedUser(null)
      
      // Force page reload to ensure fresh data
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      }, 500)
    },
    onError: (error) => {
      console.error('Delete failed:', error)
    }
  })

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: async (data: { email: string, token?: string }) => {
      return api.post('/invitations', data)
    },
    onSuccess: async (response) => {
      console.log('✅ Invitation resent successfully:', response)
      
      // Show email status message
      setEmailStatus({
        show: true,
        success: true,
        message: `Invitation resent successfully to ${response.email || 'user'}!`,
        details: response.emailDetails
      })
      
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'organization-users'
      })
      await refetch()
      handleCloseMenu()
    },
    onError: (error: any) => {
      console.error('❌ Failed to resend invitation:', error)
      setEmailStatus({
        show: true,
        success: false,
        message: `Failed to resend invitation: ${error.message || 'Unknown error'}`,
        details: null
      })
    }
  })

  const filteredUsers = users.filter((user: User) => {
    const matchesSearch = searchTerm === '' || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setAnchorEl(event.currentTarget)
    setMenuUser(user)
  }

  const handleCloseMenu = () => {
    setAnchorEl(null)
    setMenuUser(null)
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      title: user.title || '',
      department: user.department || '',
    })
    setDialogOpen(true)
    handleCloseMenu()
  }

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user)
    setDeleteDialogOpen(true)
    handleCloseMenu()
  }

  const handleResendInvitation = (user: User) => {
    resendInvitationMutation.mutate({
      email: user.email,
      token: user.invitationToken
    })
  }

  const handleSubmit = () => {
    if (selectedUser) {
      updateUserMutation.mutate({
        id: selectedUser.id,
        data: formData,
      })
    } else {
      createUserMutation.mutate(formData)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'client',
      phone: '',
      title: '',
      department: '',
    })
  }

  const getRoleStyle = (role: UserRole) => {
    switch (role) {
      case 'master': return { backgroundColor: '#000000', color: 'white' } // Black
      case 'admin': return { backgroundColor: '#f44336', color: 'white' } // Red
      case 'sales': return { backgroundColor: '#4caf50', color: 'white' } // Green
      case 'producer': return { backgroundColor: '#ffeb3b', color: 'black' } // Yellow
      case 'talent': return { backgroundColor: '#9c27b0', color: 'white' } // Purple
      case 'client': return { backgroundColor: '#2196f3', color: 'white' } // Blue
      default: return { backgroundColor: '#757575', color: 'white' } // Grey
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success'
      case 'inactive': return 'error'
      case 'invited': return 'info'
      default: return 'default'
    }
  }

  const getStatusLabel = (user: User) => {
    // Check if user has never logged in and email is not verified (invited but not activated)
    if (!user.lastLoginAt && !user.emailVerified) {
      return 'Invited'
    }
    // Check if admin has deactivated the account
    if (!user.isActive) {
      return 'Inactive'
    }
    // User is active and has logged in or verified email
    return 'Active'
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.USERS_VIEW}>
      <AdminOnly>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
                User Management
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage users and their roles
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => router.push('/admin/users/import')}
              >
                Bulk Import
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setInviteDialogOpen(true)}
              >
                Invite User
              </Button>
            </Box>
          </Box>

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                  label="Role"
                  variant="filled"
                >
                  <MenuItem value="all">All Roles</MenuItem>
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
                  variant="filled"
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                  <MenuItem value="invited">Invited</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Paper>

          {/* Email Status Alert */}
          {emailStatus.show && (
            <Alert 
              severity={emailStatus.success ? 'success' : 'warning'}
              onClose={() => setEmailStatus({ ...emailStatus, show: false })}
              sx={{ mb: 3 }}
            >
              <Typography variant="body2">{emailStatus.message}</Typography>
              {emailStatus.details && (
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  {emailStatus.details.provider && `Provider: ${emailStatus.details.provider}`}
                  {emailStatus.details.duration && ` | Time: ${emailStatus.details.duration}ms`}
                </Typography>
              )}
            </Alert>
          )}

          {/* Users Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Last Login</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((user: User) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={user.avatar}>
                          {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {user.name || user.email || 'Unknown User'}
                          </Typography>
                          {user.title && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {user.title}
                            </Typography>
                          )}
                          {user.department && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {user.department}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email || 'No email'}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role}
                        size="small"
                        sx={getRoleStyle(user.role)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(user)}
                        size="small"
                        color={getStatusColor(getStatusLabel(user))}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {user.organization?.name || 'Unknown Organization'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={(e) => handleOpenMenu(e, user)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Action Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleCloseMenu}
          >
            <MenuItem onClick={() => menuUser && handleEditUser(menuUser)}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit User</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => menuUser && updateRoleMutation.mutate({
              id: menuUser.id,
              role: menuUser.role === 'admin' ? 'client' : 'admin'
            })}>
              <ListItemIcon>
                <ShieldIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Change Role</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => menuUser && updateStatusMutation.mutate({
              id: menuUser.id,
              status: menuUser.isActive ? 'inactive' : 'active'
            })}>
              <ListItemIcon>
                {menuUser?.isActive ? (
                  <BlockIcon fontSize="small" />
                ) : (
                  <CheckCircleIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText>
                {menuUser?.isActive ? 'Deactivate User' : 'Activate User'}
              </ListItemText>
            </MenuItem>
            {menuUser && !menuUser.lastLoginAt && !menuUser.emailVerified && (
              <MenuItem onClick={() => menuUser && handleResendInvitation(menuUser)}>
                <ListItemIcon>
                  <SendIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Resend Invitation</ListItemText>
              </MenuItem>
            )}
            <MenuItem onClick={() => menuUser && handleDeleteUser(menuUser)}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete User</ListItemText>
            </MenuItem>
          </Menu>

          {/* Invite User Dialog */}
          <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                <TextField
                  label="Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  fullWidth
                  required
                />
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    label="Role"
                  >
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="sales">Sales</MenuItem>
                    <MenuItem value="producer">Producer</MenuItem>
                    <MenuItem value="talent">Talent</MenuItem>
                    <MenuItem value="client">Client</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Phone (optional)"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  fullWidth
                />
                <Alert severity="info">
                  An invitation email will be sent to the user with login instructions and a secure link to set up their account.
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    The inviter will be CC'd and the master account will be BCC'd on the invitation.
                  </Typography>
                </Alert>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setInviteDialogOpen(false)
                resetForm()
              }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={createUserMutation.isPending}
              >
                Send Invitation
              </Button>
            </DialogActions>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Edit User</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                <TextField
                  label="Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  fullWidth
                  required
                />
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    label="Role"
                  >
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="sales">Sales</MenuItem>
                    <MenuItem value="producer">Producer</MenuItem>
                    <MenuItem value="talent">Talent</MenuItem>
                    <MenuItem value="client">Client</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Phone (optional)"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  fullWidth
                  placeholder="(555) 123-4567"
                />
                <TextField
                  label="Job Title (optional)"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  fullWidth
                  placeholder="e.g., Marketing Manager"
                />
                <TextField
                  label="Department (optional)"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  fullWidth
                  placeholder="e.g., Sales, Marketing, Production"
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setDialogOpen(false)
                setSelectedUser(null)
                resetForm()
              }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={updateUserMutation.isPending}
              >
                Save Changes
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
            <DialogTitle>Delete User</DialogTitle>
            <DialogContent>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This action cannot be undone.
              </Alert>
              <Typography>
                Are you sure you want to delete the user "{selectedUser?.name}"?
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setDeleteDialogOpen(false)
                setSelectedUser(null)
              }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
                disabled={deleteUserMutation.isPending}
              >
                Delete User
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </DashboardLayout>
    </AdminOnly>
    </RouteProtection>
  )
}