'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { CssBaseline } from '@mui/material'
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Button,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Chip,
} from '@mui/material'
import {
  Business,
  Person,
  Login,
  Info,
  Warning,
  ArrowBack,
} from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { User } from '@/types/auth'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

// Define a simplified Organization type for the impersonate page
type Organization = {
  id: string
  name: string
  subscriptionTier?: string
  status?: string
}

export default function ImpersonateStandalonePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [authUser, setAuthUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Check authentication manually without using AuthContext
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔍 Checking auth manually...')
        const response = await fetch('/api/auth/check', {
          credentials: 'include'
        })
        const data = await response.json()
        console.log('🔍 Auth check response:', data)
        
        if (data.authenticated && data.user) {
          setAuthUser(data.user)
        }
      } catch (error) {
        console.error('🔍 Auth check failed:', error)
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Pre-select organization from URL params
  useEffect(() => {
    const orgParam = searchParams.get('org')
    if (orgParam) {
      setSelectedOrg(orgParam)
    }
  }, [searchParams])

  // Fetch organizations
  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      // Use fetch directly instead of masterApi to avoid auth redirects
      const response = await fetch('/api/master/organizations', {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch organizations')
      }
      const data = await response.json()
      console.log('Organizations API response:', data)
      // The API returns { organizations: [...] } not { data: [...] }
      return (data.organizations || []) as Organization[]
    },
    enabled: !!authUser && authUser.role === 'master',
  })

  // Fetch users for selected organization
  const { data: users = [] } = useQuery({
    queryKey: ['organization-users', selectedOrg],
    queryFn: async () => {
      if (!selectedOrg) return []
      // Use fetch directly instead of masterApi to avoid auth redirects
      const response = await fetch(`/api/master/users?organizationId=${selectedOrg}`, {
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      console.log('Users API response:', data)
      // The API returns { users: [...] }
      return (data.users || []) as User[]
    },
    enabled: !!selectedOrg && !!authUser && authUser.role === 'master',
  })

  const handleOrgChange = (event: SelectChangeEvent) => {
    setSelectedOrg(event.target.value)
    setSelectedUser('') // Reset user selection
  }

  const handleUserChange = (event: SelectChangeEvent) => {
    setSelectedUser(event.target.value)
  }

  const handleImpersonate = async () => {
    if (!selectedUser) return

    setIsImpersonating(true)

    try {
      // Call the impersonation API to get a new auth token
      const response = await fetch(`/api/master/users/${selectedUser}/impersonate`, {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Store original user info and impersonation flag
        sessionStorage.setItem('impersonation', JSON.stringify({
          originalUser: authUser,
          impersonatingUser: selectedUserData,
          organizationId: selectedOrg,
          isImpersonating: true
        }))

        // The API should have set the auth-token cookie
        // Use window.location to do a full page reload
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1000)
      } else {
        throw new Error('Failed to impersonate user')
      }
    } catch (error) {
      console.error('Failed to impersonate user:', error)
      setIsImpersonating(false)
    }
  }

  const selectedOrgData = organizations.find(org => org.id === selectedOrg)
  const selectedUserData = users.find(user => user.id === selectedUser)

  if (authLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography>Loading authentication...</Typography>
        </Box>
      </DashboardLayout>
    )
  }

  if (!authUser) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography>Authentication required. Please log in.</Typography>
          <Button onClick={() => router.push('/login')} sx={{ mt: 2 }}>
            Go to Login
          </Button>
        </Box>
      </DashboardLayout>
    )
  }

  if (authUser.role !== 'master') {
    return (
      <DashboardLayout>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography>Access denied. Master role required.</Typography>
          <Button onClick={() => router.push('/dashboard')} sx={{ mt: 2 }}>
            Go to Dashboard
          </Button>
        </Box>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
            View as Organization
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Impersonate any user to view the platform from their perspective
          </Typography>

          <Alert severity="warning" sx={{ mb: 4 }}>
            <Typography variant="body2" component="div">
              <strong>Important:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                <li>All actions taken while impersonating will be logged</li>
                <li>You will have the permissions of the impersonated user</li>
                <li>A banner will indicate you are in impersonation mode</li>
                <li>Click "Exit Impersonation" to return to your master account</li>
              </ul>
            </Typography>
          </Alert>

          {isImpersonating && (
            <Alert severity="success" sx={{ mb: 4 }}>
              Impersonating {selectedUserData?.name}. Redirecting to dashboard...
            </Alert>
          )}

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                Select Organization & User
              </Typography>

              {/* Organization Selection */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Organization</InputLabel>
                <Select
                  value={selectedOrg}
                  onChange={handleOrgChange}
                  label="Organization"
                >
                  <MenuItem value="">
                    <em>Select an organization</em>
                  </MenuItem>
                  {organizations.map((org) => (
                    <MenuItem key={org.id} value={org.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Business sx={{ mr: 2, color: 'text.secondary' }} />
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1">{org.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {org.subscriptionTier || 'Starter'} • {org.status || 'active'}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* User Selection */}
              <FormControl fullWidth sx={{ mb: 3 }} disabled={!selectedOrg}>
                <InputLabel>User</InputLabel>
                <Select
                  value={selectedUser}
                  onChange={handleUserChange}
                  label="User"
                >
                  <MenuItem value="">
                    <em>Select a user</em>
                  </MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                          {user.name?.[0] || user.email[0]}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1">{user.name || user.email}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {user.email} • {user.role}
                          </Typography>
                        </Box>
                        <Chip 
                          label={user.role} 
                          size="small" 
                          color={user.role === 'admin' ? 'primary' : 'default'}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Selected Info */}
              {selectedOrgData && selectedUserData && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                    Impersonation Preview
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <Business />
                      </ListItemIcon>
                      <ListItemText
                        primary="Organization"
                        secondary={selectedOrgData.name}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Person />
                      </ListItemIcon>
                      <ListItemText
                        primary="User"
                        secondary={`${selectedUserData.name} (${selectedUserData.email})`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Info />
                      </ListItemIcon>
                      <ListItemText
                        primary="Role"
                        secondary={selectedUserData.role}
                      />
                    </ListItem>
                  </List>
                </>
              )}

              {/* Action Button */}
              <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<Login />}
                  onClick={handleImpersonate}
                  disabled={!selectedUser || isImpersonating}
                  size="large"
                >
                  Start Impersonation
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </DashboardLayout>
  )
}