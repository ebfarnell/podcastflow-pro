'use client'

import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Chip, 
  LinearProgress,
  Button,
  Alert
} from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { Campaign, AttachMoney, Assessment, TrendingUp } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { campaignApi } from '@/services/api'
import { useRouter } from 'next/navigation'

export default function ClientCampaignsPage() {
  const { user } = useAuth()
  const router = useRouter()

  // Fetch client's campaigns
  const { data: campaignsData, isLoading, error } = useQuery({
    queryKey: ['client-campaigns', user?.id],
    queryFn: async () => {
      const response = await campaignApi.list({ client: user?.id })
      return response
    },
    enabled: !!user
  })

  const campaigns = campaignsData?.campaigns || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'paused': return 'warning'
      case 'completed': return 'info'
      case 'draft': return 'default'
      default: return 'default'
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <RoleGuard roles={['client', 'admin']}>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography>Loading campaigns...</Typography>
          </Box>
        </RoleGuard>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <RoleGuard roles={['client', 'admin']}>
          <Box sx={{ p: 4 }}>
            <Alert severity="error">
              Failed to load campaigns. Please try again later.
            </Alert>
          </Box>
        </RoleGuard>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <RoleGuard roles={['client', 'admin']}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <div>
              <Typography variant="h4" component="h1" gutterBottom>
                My Campaigns
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage and monitor your advertising campaigns
              </Typography>
            </div>
            <Button 
              variant="contained" 
              startIcon={<Campaign />}
              onClick={() => router.push('/campaigns/new')}
            >
              New Campaign
            </Button>
          </Box>

          {campaigns.length > 0 ? (
            <Grid container spacing={3}>
              {campaigns.map((campaign: any) => (
                <Grid item xs={12} md={6} lg={4} key={campaign.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        boxShadow: 3,
                        transform: 'translateY(-2px)',
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                    onClick={() => router.push(`/campaigns/${campaign.id}`)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h6" component="h2" gutterBottom>
                          {campaign.name || 'Unnamed Campaign'}
                        </Typography>
                        <Chip 
                          label={campaign.status || 'draft'} 
                          color={getStatusColor(campaign.status)}
                          size="small"
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {campaign.description || 'No description available'}
                      </Typography>

                      <Box sx={{ mt: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Budget
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            ${(campaign.budget || 0).toLocaleString()}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            Spent
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            ${(campaign.spent || 0).toLocaleString()}
                          </Typography>
                        </Box>

                        <LinearProgress 
                          variant="determinate" 
                          value={campaign.budget > 0 ? Math.min((campaign.spent || 0) / campaign.budget * 100, 100) : 0}
                          sx={{ mb: 2 }}
                        />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : 'No start date'}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <TrendingUp sx={{ fontSize: 16, mr: 0.5, color: 'success.main' }} />
                            <Typography variant="caption" color="success.main">
                              {campaign.impressions || 0} impressions
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <Campaign sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No campaigns yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Contact your account manager to create your first campaign and start reaching your audience.
                </Typography>
                <Button 
                  variant="outlined" 
                  onClick={() => router.push('/campaigns/new')}
                >
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          )}
        </Box>
      </RoleGuard>
    </DashboardLayout>
  )
}