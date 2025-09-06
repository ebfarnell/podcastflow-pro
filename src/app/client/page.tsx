'use client'

import { Box, Typography, Grid, Card, CardContent, LinearProgress } from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { Campaign, AttachMoney, Assessment, Schedule } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { clientsApi, campaignApi } from '@/services/api'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ClientDashboard() {
  const { user } = useAuth()
  const router = useRouter()

  // Fetch client's campaigns
  const { data: campaignsData } = useQuery({
    queryKey: ['client-campaigns', user?.id],
    queryFn: async () => {
      // In a real app, this would fetch only the client's campaigns
      const response = await campaignApi.list({ client: user?.id })
      return response
    },
    enabled: !!user
  })

  const campaigns = campaignsData?.campaigns || []
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'active').length
  const totalBudget = campaigns.reduce((sum: number, c: any) => sum + (c.budget || 0), 0)
  const totalSpent = campaigns.reduce((sum: number, c: any) => sum + (c.spent || 0), 0)

  return (
    <DashboardLayout>
      <RoleGuard roles={['client', 'admin']}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Campaign Overview
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Welcome back, {user?.name}! Here's your campaign summary.
          </Typography>

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
                onClick={() => router.push('/client/campaigns')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Campaign sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Active Campaigns
                    </Typography>
                  </Box>
                  <Typography variant="h4">
                    {activeCampaigns}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Currently running
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
                onClick={() => router.push('/client/billing')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AttachMoney sx={{ mr: 2, color: 'success.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Total Budget
                    </Typography>
                  </Box>
                  <Typography variant="h4">
                    ${totalBudget.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Across all campaigns
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
                onClick={() => router.push('/analytics')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Assessment sx={{ mr: 2, color: 'info.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Total Spent
                    </Typography>
                  </Box>
                  <Typography variant="h4">
                    ${totalSpent.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% of budget used
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0} 
                    sx={{ mt: 2 }}
                  />
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
                onClick={() => router.push('/client/reports')}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Schedule sx={{ mr: 2, color: 'warning.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Next Report
                    </Typography>
                  </Box>
                  <Typography variant="h6">
                    Monthly
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Report scheduled for month end
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Recent Campaigns */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>
              Your Campaigns
            </Typography>
            {campaigns.length > 0 ? (
              <Grid container spacing={2}>
                {campaigns.slice(0, 3).map((campaign: any) => (
                  <Grid item xs={12} md={4} key={campaign.id}>
                    <Card 
                      sx={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/campaigns/${campaign.id}`)}
                    >
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {campaign.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Status: {campaign.status}
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            Budget: ${campaign.budget?.toLocaleString() || 0}
                          </Typography>
                          <Typography variant="body2">
                            Spent: ${campaign.spent?.toLocaleString() || 0}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography color="text.secondary">
                No campaigns yet. Contact your account manager to get started.
              </Typography>
            )}
          </Box>
        </Box>
      </RoleGuard>
    </DashboardLayout>
  )
}