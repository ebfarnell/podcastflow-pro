'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
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
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { masterApi } from '@/lib/master-api'
import { Organization, User } from '@/types/auth'

function ImpersonatePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: currentUser } = useAuth()
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [isImpersonating, setIsImpersonating] = useState(false)


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
      const response = await masterApi.get('/organizations')
      return response.data as Organization[]
    },
  })

  // Fetch users for selected organization
  const { data: users = [] } = useQuery({
    queryKey: ['organization-users', selectedOrg],
    queryFn: async () => {
      if (!selectedOrg) return []
      const response = await masterApi.get(`/users?organizationId=${selectedOrg}`)
      return response.data as User[]
    },
    enabled: !!selectedOrg,
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
      const response = await masterApi.users.impersonateUser(selectedUser)
      
      if (response.token) {
        // Store original user info and impersonation flag
        sessionStorage.setItem('impersonation', JSON.stringify({
          originalUser: currentUser,
          impersonatingUser: response.user,
          organizationId: response.user.organizationId,
          organizationName: response.user.organizationName,
          isImpersonating: true,
          masterSession: true
        }))

        // Force a complete page reload to ensure all contexts are reset
        // This ensures the sidebar and permissions are properly updated
        window.location.href = '/dashboard'
      }
    } catch (error) {
      console.error('Failed to impersonate user:', error)
      setIsImpersonating(false)
      // You might want to show an error message here
    }
  }

  const selectedOrgData = organizations.find(org => org.id === selectedOrg)
  const selectedUserData = users.find(user => user.id === selectedUser)

  // Don't use DashboardLayout to avoid auth redirect issues
  // Check auth manually - but also check cookie directly if AuthContext fails
  const [manualAuthCheck, setManualAuthCheck] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const checkAuthManually = async () => {
      try {
        const response = await fetch('/api/auth/check', {
          credentials: 'include'
        })
        const data = await response.json()
        
        if (data.authenticated && data.user) {
          setManualAuthCheck(data.user)
        }
      } catch (error) {
        // Auth check failed
      } finally {
        setAuthLoading(false)
      }
    }

    if (!currentUser) {
      checkAuthManually()
    } else {
      setAuthLoading(false)
    }
  }, [currentUser])

  if (authLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography>Loading authentication...</Typography>
      </Box>
    )
  }

  const user = currentUser || manualAuthCheck
  if (!user) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography>Authentication required. Please log in.</Typography>
      </Box>
    )
  }

  if (user.role !== 'master') {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography>Access denied. Master role required.</Typography>
      </Box>
    )
  }

  return (
    <>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 4 }}>
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.push('/master')}
            sx={{ mb: 3 }}
          >
            Back to Master Dashboard
          </Button>
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
                            {org.plan} plan • {org.status}
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
    </>
  )
}

export default function ImpersonatePage() {
  return (
    <Suspense fallback={
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography>Loading...</Typography>
      </Box>
    }>
      <ImpersonatePageContent />
    </Suspense>
  )
}