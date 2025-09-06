'use client'

import { Box, Typography, Grid, Card, CardContent, CircularProgress, Alert } from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { campaignApi, approvalsApi, advertiserApi } from '@/services/api'

export default function SellerDashboard() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redirect if not a seller
    if (user && user.role !== 'sales' && user.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, router])

  // Fetch campaigns data
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns', 'seller-dashboard'],
    queryFn: async () => {
      const response = await campaignApi.getAll({ limit: 1000 })
      return response
    },
    enabled: !!user
  })

  // Fetch advertisers (clients) data
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['advertisers', 'seller-dashboard'],
    queryFn: async () => {
      const response = await advertiserApi.list()
      return response.advertisers || []
    },
    enabled: !!user
  })

  // Fetch ad approvals data
  const { data: approvalsData, isLoading: approvalsLoading } = useQuery({
    queryKey: ['ad-approvals', 'seller-dashboard'],
    queryFn: async () => {
      const response = await approvalsApi.list()
      // Filter for pending approvals
      return response.approvals?.filter((approval: any) => approval.status === 'pending') || []
    },
    enabled: !!user
  })

  // Calculate metrics from real data
  const activeCampaigns = campaignsData?.campaigns?.filter(c => c.status === 'active').length || 0
  const pendingCampaigns = campaignsData?.campaigns?.filter(c => c.status === 'pending' || c.status === 'draft').length || 0
  const totalClients = clientsData?.length || 0
  const pendingApprovals = approvalsData?.length || 0
  
  // Calculate revenue from campaigns
  const monthlyRevenue = campaignsData?.campaigns?.reduce((total, campaign) => {
    if (campaign.status === 'active') {
      return total + (campaign.budget || 0)
    }
    return total
  }, 0) || 0

  // Calculate new clients this month
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const newClientsThisMonth = clientsData?.filter(client => {
    const createdDate = new Date(client.createdAt)
    return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear
  }).length || 0

  const isLoading = campaignsLoading || clientsLoading || approvalsLoading

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
      <DashboardLayout>
      <RoleGuard roles={['sales', 'admin']}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Sales Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Welcome back, {user?.name}! Here's your sales overview.
          </Typography>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
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
                  onClick={() => router.push('/campaigns')}
                >
                  <CardContent sx={{ flex: 1 }}>
                    <Typography color="text.secondary" gutterBottom>
                      Active Campaigns
                    </Typography>
                    <Typography variant="h4">
                      {activeCampaigns}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pendingCampaigns} awaiting approval
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
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
                  onClick={() => router.push('/advertisers')}
                >
                  <CardContent sx={{ flex: 1 }}>
                    <Typography color="text.secondary" gutterBottom>
                      Total Clients
                    </Typography>
                    <Typography variant="h4">
                      {totalClients}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {newClientsThisMonth} new this month
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
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
                  onClick={() => router.push('/seller/billing')}
                >
                  <CardContent sx={{ flex: 1 }}>
                    <Typography color="text.secondary" gutterBottom>
                      Monthly Revenue
                    </Typography>
                    <Typography variant="h4">
                      ${(monthlyRevenue / 1000).toFixed(1)}K
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      From active campaigns
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
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
                  onClick={() => router.push('/post-sale?tab=creative&view=approvals')}
                >
                  <CardContent sx={{ flex: 1 }}>
                    <Typography color="text.secondary" gutterBottom>
                      Pending Approvals
                    </Typography>
                    <Typography variant="h4">
                      {pendingApprovals}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pendingApprovals > 0 ? 'Require immediate action' : 'All up to date'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      </RoleGuard>
    </DashboardLayout>
    </RouteProtection>
  )
}