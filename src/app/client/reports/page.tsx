'use client'

import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  MenuItem,
  Chip,
  Alert
} from '@mui/material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Assessment, 
  TrendingUp, 
  Visibility,
  PeopleAlt,
  Download,
  DateRange,
  Campaign
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { campaignApi, api, showsApi } from '@/services/api'

export default function ClientReportsPage() {
  const { user } = useAuth()
  const [dateRange, setDateRange] = useState('30')
  const [campaignFilter, setCampaignFilter] = useState('all')

  // Fetch campaigns for the client
  const { data: campaignsData } = useQuery({
    queryKey: ['client', 'campaigns', 'reports', user?.organizationId],
    queryFn: async () => {
      const response = await campaignApi.list({ organizationId: user?.organizationId })
      return response
    },
    enabled: !!user?.organizationId
  })

  // Fetch shows data
  const { data: showsData } = useQuery({
    queryKey: ['shows', 'all'],
    queryFn: async () => {
      const response = await showsApi.getAll()
      return response
    }
  })

  // Calculate reports data from campaigns
  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['client-reports', user?.id, dateRange, campaignFilter, campaignsData],
    queryFn: async () => {
      if (!campaignsData?.campaigns) {
        return {
          summary: {
            totalImpressions: 0,
            totalClicks: 0,
            avgCTR: 0,
            totalSpend: 0,
            costPerClick: 0,
            conversions: 0
          },
          campaigns: [],
          topShows: []
        }
      }

      // Filter campaigns based on date range
      const now = new Date()
      const daysAgo = parseInt(dateRange)
      const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
      
      let filteredCampaigns = campaignsData.campaigns.filter((campaign: any) => {
        const campaignDate = new Date(campaign.createdAt)
        return campaignDate >= startDate
      })

      // Apply campaign filter
      if (campaignFilter !== 'all') {
        filteredCampaigns = filteredCampaigns.filter((c: any) => c.id === campaignFilter)
      }

      // Calculate summary metrics from real campaign data
      const totalSpend = filteredCampaigns.reduce((sum: number, c: any) => sum + (c.spent || 0), 0)
      const totalBudget = filteredCampaigns.reduce((sum: number, c: any) => sum + (c.budget || 0), 0)
      
      // Get performance metrics from campaign data
      const totalImpressions = filteredCampaigns.reduce((sum: number, c: any) => {
        return sum + (c.impressions || 0)
      }, 0)
      
      const totalClicks = filteredCampaigns.reduce((sum: number, c: any) => sum + (c.clicks || 0), 0)
      const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
      const costPerClick = totalClicks > 0 ? totalSpend / totalClicks : 0
      const conversions = filteredCampaigns.reduce((sum: number, c: any) => sum + (c.conversions || 0), 0)

      // Transform campaigns for display using real data
      const campaignsWithMetrics = filteredCampaigns.map((campaign: any) => {
        const impressions = campaign.impressions || 0
        const clicks = campaign.clicks || 0
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
        
        return {
          id: campaign.id,
          name: campaign.name,
          impressions,
          clicks,
          ctr: parseFloat(ctr.toFixed(1)),
          spend: campaign.spent || 0,
          conversions: campaign.conversions || 0,
          status: campaign.status
        }
      })

      // Get top shows data from campaign analytics
      const topShows = showsData?.shows?.slice(0, 4).map((show: any) => {
        // Calculate actual impressions from campaigns using this show
        const showCampaigns = filteredCampaigns.filter((c: any) => 
          c.shows?.includes(show.id) || c.showIds?.includes(show.id)
        )
        const showImpressions = showCampaigns.reduce((sum: number, c: any) => sum + (c.impressions || 0), 0)
        const showConversions = showCampaigns.reduce((sum: number, c: any) => sum + (c.conversions || 0), 0)
        
        return {
          name: show.name,
          impressions: showImpressions,
          conversions: showConversions
        }
      }) || []

      return {
        summary: {
          totalImpressions,
          totalClicks,
          avgCTR: parseFloat(avgCTR.toFixed(1)),
          totalSpend,
          costPerClick: parseFloat(costPerClick.toFixed(2)),
          conversions
        },
        campaigns: campaignsWithMetrics,
        topShows
      }
    },
    enabled: !!user && !!campaignsData
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'paused': return 'warning'
      case 'completed': return 'info'
      default: return 'default'
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <RoleGuard roles={['client', 'admin']}>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography>Loading reports...</Typography>
          </Box>
        </RoleGuard>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <RoleGuard roles={['client', 'admin']}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
            <div>
              <Typography variant="h4" component="h1" gutterBottom>
                Campaign Reports
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Analyze your campaign performance and ROI
              </Typography>
            </div>
            <Button 
              variant="contained" 
              startIcon={<Download />}
            >
              Export Report
            </Button>
          </Box>

          {/* Filters */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    select
                    label="Date Range"
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                  >
                    <MenuItem value="7">Last 7 days</MenuItem>
                    <MenuItem value="30">Last 30 days</MenuItem>
                    <MenuItem value="90">Last 90 days</MenuItem>
                    <MenuItem value="custom">Custom Range</MenuItem>
                  </TextField>
                  {dateRange === 'custom' && (
                    <Button variant="text" size="small" disabled sx={{ ml: 2 }}>
                      Custom Range (Coming Soon)
                    </Button>
                  )}
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    select
                    label="Campaign"
                    value={campaignFilter}
                    onChange={(e) => setCampaignFilter(e.target.value)}
                  >
                    <MenuItem value="all">All Campaigns</MenuItem>
                    <MenuItem value="active">Active Only</MenuItem>
                    <MenuItem value="completed">Completed Only</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Alert severity="info" sx={{ mb: 0 }}>
                    Reports are updated every 24 hours. Last updated: {new Date().toLocaleString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </Alert>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Summary Metrics */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Visibility sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h5" gutterBottom>
                    {reportsData?.summary?.totalImpressions?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Impressions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <TrendingUp sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography variant="h5" gutterBottom>
                    {reportsData?.summary?.totalClicks?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Clicks
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Assessment sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                  <Typography variant="h5" gutterBottom>
                    {reportsData?.summary?.avgCTR || '0'}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Average CTR
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Campaign sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                  <Typography variant="h5" gutterBottom>
                    ${reportsData?.summary?.totalSpend?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Spend
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <PeopleAlt sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
                  <Typography variant="h5" gutterBottom>
                    {reportsData?.summary?.conversions || '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Conversions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <DateRange sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                  <Typography variant="h5" gutterBottom>
                    ${reportsData?.summary?.costPerClick?.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Cost Per Click
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Campaign Performance */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Campaign Performance
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Campaign</TableCell>
                      <TableCell align="right">Impressions</TableCell>
                      <TableCell align="right">Clicks</TableCell>
                      <TableCell align="right">CTR</TableCell>
                      <TableCell align="right">Spend</TableCell>
                      <TableCell align="right">Conversions</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportsData?.campaigns?.map((campaign: any) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {campaign.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {campaign.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {campaign.clicks.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {campaign.ctr}%
                        </TableCell>
                        <TableCell align="right">
                          ${campaign.spend.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {campaign.conversions}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={campaign.status} 
                            color={getStatusColor(campaign.status)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Top Performing Shows */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Performing Shows
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Show Name</TableCell>
                      <TableCell align="right">Impressions</TableCell>
                      <TableCell align="right">Conversions</TableCell>
                      <TableCell align="right">Conversion Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportsData?.topShows?.map((show: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {show.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {show.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {show.conversions}
                        </TableCell>
                        <TableCell align="right">
                          {((show.conversions / show.impressions) * 100).toFixed(2)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </RoleGuard>
    </DashboardLayout>
  )
}