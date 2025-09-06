'use client'

import { Box, Typography, Grid, Card, CardContent, Button } from '@mui/material'
import { DashboardLayoutSimple as DashboardLayout } from '@/components/layout/DashboardLayout-simple'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { 
  Business, 
  People, 
  TrendingUp, 
  Storage,
  Add,
  Assessment 
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

export default function MasterDashboard() {
  const { user } = useAuth()
  const router = useRouter()

  // Fetch platform statistics
  const { data: stats, refetch } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      // Import masterApi service
      const { masterApi } = await import('@/services/masterApi')
      
      // Fetch real analytics data
      const analytics = await masterApi.analytics.getGlobalMetrics('30d')
      
      console.log('Platform Overview - Analytics response:', analytics)
      
      return {
        totalOrganizations: analytics.totalOrganizations,
        activeOrganizations: analytics.totalOrganizations, // All are active for now
        totalUsers: analytics.totalUsers,
        activeUsers: analytics.activeUsers,
        totalRevenue: analytics.totalRevenue,
        monthlyGrowth: 0, // No historical data available yet
        storageUsed: Math.round((analytics.storageUsed / 1000) * 100), // Convert GB to percentage of 1TB limit
        apiCalls: analytics.apiCalls,
        organizations: analytics.organizations // Include organizations for the list
      }
    },
    refetchInterval: false, // Disable automatic refresh
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    cacheTime: 10 * 60 * 1000, // Cache for 10 minutes
  })

  return (
    <RouteProtection requiredPermission={PERMISSIONS.MASTER_VIEW_ALL}>
      <DashboardLayout>
      <RoleGuard roles={['master']}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
                Platform Overview
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Welcome back, {user?.name}. Here's your platform summary.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => refetch()}
              >
                Refresh Data
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => router.push('/master/organizations/new')}
              >
                Invite Organization
              </Button>
            </Box>
          </Box>

          <Grid container spacing={3}>
            {/* Organizations */}
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/master/organizations')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <Business sx={{ mr: 2, color: 'primary.main', fontSize: 40 }} />
                    <Box>
                      <Typography color="text.secondary" variant="body2" gutterBottom>
                        Total Organizations
                      </Typography>
                      <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                        {stats?.totalOrganizations || 0}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="success.main">
                    {stats?.activeOrganizations || 0} active
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Users */}
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/master/users')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <People sx={{ mr: 2, color: 'info.main', fontSize: 40 }} />
                    <Box>
                      <Typography color="text.secondary" variant="body2" gutterBottom>
                        Total Users
                      </Typography>
                      <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                        {stats?.totalUsers || 0}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="success.main">
                    {stats?.activeUsers || 0} active today
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Revenue */}
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/master/billing')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <TrendingUp sx={{ mr: 2, color: 'success.main', fontSize: 40 }} />
                    <Box>
                      <Typography color="text.secondary" variant="body2" gutterBottom>
                        Monthly Revenue
                      </Typography>
                      <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                        ${(stats?.totalRevenue || 0).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="success.main">
                    +{stats?.monthlyGrowth || 0}% growth
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Platform Health */}
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/master/analytics')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <Storage sx={{ mr: 2, color: 'warning.main', fontSize: 40 }} />
                    <Box>
                      <Typography color="text.secondary" variant="body2" gutterBottom>
                        Platform Health
                      </Typography>
                      <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                        {100 - (stats?.storageUsed || 0)}%
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {stats?.storageUsed || 0}% resources used
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Recent Organizations */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom sx={{ color: 'text.primary', mb: 3 }}>
              Recent Organizations
            </Typography>
            <Grid container spacing={3}>
              {(stats?.organizations || []).slice(0, 3).map((org: any) => (
                <Grid item xs={12} md={4} key={org.name}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 3
                      }
                    }} 
                    onClick={() => router.push('/master/organizations')}
                  >
                    <CardContent>
                      <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>{org.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {org.plan} Plan • {org.users} users
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'success.main' }}>
                        ${org.revenue?.toLocaleString() || 0}/month
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {(!stats?.organizations || stats.organizations.length === 0) && (
                <Grid item xs={12}>
                  <Card sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                      No organizations yet. Invite your first organization to get started.
                    </Typography>
                  </Card>
                </Grid>
              )}
            </Grid>
          </Box>

          {/* Quick Actions */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom sx={{ color: 'text.primary', mb: 3 }}>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  size="large"
                  startIcon={<Business />}
                  onClick={() => router.push('/master/organizations/new')}
                  sx={{ py: 2, justifyContent: 'flex-start' }}
                >
                  Invite Organization
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  size="large"
                  startIcon={<People />}
                  onClick={() => router.push('/master/users')}
                  sx={{ py: 2, justifyContent: 'flex-start' }}
                >
                  Manage Users
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  size="large"
                  startIcon={<Assessment />}
                  onClick={() => router.push('/master/analytics')}
                  sx={{ py: 2, justifyContent: 'flex-start' }}
                >
                  View Analytics
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  size="large"
                  startIcon={<Storage />}
                  onClick={() => router.push('/master/settings')}
                  sx={{ py: 2, justifyContent: 'flex-start' }}
                >
                  Platform Settings
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </RoleGuard>
    </DashboardLayout>
    </RouteProtection>
  )
}