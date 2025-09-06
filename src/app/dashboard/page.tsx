'use client'


import React, { useState, useCallback, useRef } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Skeleton,
} from '@mui/material'
import { DateRangeSelector } from '@/components/common/DateRangeSelector'
import {
  TrendingUp,
  TrendingDown,
  MoreVert,
  Download,
  Refresh,
  Campaign,
  AttachMoney,
  Visibility,
  TouchApp,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DashboardLayoutSimple as DashboardLayout } from '@/components/layout/DashboardLayout-simple'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import CampaignStatusChart from '@/components/dashboard/CampaignStatusChart'
import TopShows from '@/components/dashboard/TopShows'
import { RecentCampaigns } from '@/components/dashboard/RecentCampaigns'
import { UpcomingDeadlines } from '@/components/dashboard/UpcomingDeadlines'
import VisualExportModal from '@/components/VisualExportModal'
import { PDFExporter, createChartCanvas } from '@/utils/pdfExport'
import { exportToCSV, exportToJSON } from '@/utils/export'
import { dashboardApi, type DashboardMetrics } from '@/services/dashboardApi'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import { queryKeys } from '@/config/queryClient'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [dateRange, setDateRange] = useState('thisMonth')
  
  // Redirect based on role - do it during render to avoid hydration issues
  useEffect(() => {
    if (!user) return
    
    // Only redirect if we're not already on the correct page
    const shouldRedirect = user.role !== 'admin' && user.role !== 'master'
    
    if (shouldRedirect) {
      const redirectMap: Record<string, string> = {
        'sales': '/seller',
        'producer': '/producer',
        'talent': '/talent',
        'client': '/client'
      }
      
      const redirectPath = redirectMap[user.role]
      if (redirectPath) {
        router.replace(redirectPath)
      }
    }
  }, [user?.role]) // Only depend on role, not the entire user object

  // Use React Query for dashboard data with real-time updates
  const { 
    data: dashboardData, 
    isLoading: loading, 
    error, 
    refetch,
    isRefetching: refreshing
  } = useQuery({
    queryKey: queryKeys.dashboard.metrics(dateRange),
    queryFn: () => dashboardApi.getDashboardData(dateRange),
    refetchOnWindowFocus: false, // Disable refetch on window focus to prevent loops
    refetchInterval: false, // Disable automatic refetching
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  })

  // Debounced cache invalidation to prevent rapid successive invalidations
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  
  const debouncedInvalidateCache = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    
    debounceTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    }, 1000) // Wait 1 second before invalidating
  }, [queryClient])

  const loadDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      await refetch()
    }
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleRefresh = () => {
    loadDashboardData(true)
  }

  // Show loading state while auth is loading
  if (authLoading) {
    return (
    <RouteProtection requiredPermission={PERMISSIONS.DASHBOARD_VIEW}>
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    </RouteProtection>
    )
  }

  const handleExport = async (format: string, settings: any) => {
    if (!dashboardData) return

    try {
      if (format === 'pdf') {
        const exporter = new PDFExporter({
          title: 'PodcastFlow Pro Dashboard Report',
          subtitle: `Generated on ${new Date().toLocaleDateString('en-US', { timeZone: 'UTC' })}`,
          orientation: settings.orientation || 'portrait'
        })

        // Add executive summary
        if (settings.includeSummary) {
          exporter.addSummarySection([
            { label: 'Active Campaigns', value: dashboardData.activeCampaigns },
            { label: 'Monthly Revenue', value: `$${(dashboardData.monthlyRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
            { label: 'Total Impressions', value: dashboardData.totalImpressions },
            { label: 'Conversion Rate', value: `${dashboardData.conversionRate}%` }
          ])
        }

        // Add charts
        if (settings.includeCharts) {
          // Revenue trend chart
          const revenueChart = await createChartCanvas('line', {
            labels: dashboardData.revenueByMonth.map(d => d.month),
            datasets: [{
              label: 'Monthly Revenue',
              data: dashboardData.revenueByMonth.map(d => d.revenue),
              borderColor: '#1976d2',
              backgroundColor: 'rgba(25, 118, 210, 0.1)',
              tension: 0.4
            }]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Revenue Trend (Last 12 Months)'
              }
            }
          })
          await exporter.addChart(revenueChart)

          // Campaign status pie chart
          const statusChart = await createChartCanvas('pie', {
            labels: dashboardData.campaignStatusData.map(d => d.status),
            datasets: [{
              data: dashboardData.campaignStatusData.map(d => d.count),
              backgroundColor: ['#4caf50', '#ff9800', '#2196f3']
            }]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Campaign Status Distribution'
              }
            }
          })
          await exporter.addChart(statusChart)

          // Top shows bar chart
          const showsChart = await createChartCanvas('bar', {
            labels: dashboardData.topShows.map(s => s.name),
            datasets: [{
              label: 'Revenue',
              data: dashboardData.topShows.map(s => parseInt(s.revenue.replace(/[$,]/g, ''))),
              backgroundColor: '#9c27b0'
            }]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Top Performing Shows by Revenue'
              }
            }
          })
          await exporter.addChart(showsChart)
        }

        // Add raw data tables
        if (settings.includeRawData) {
          // Campaign status table
          exporter.addTable(
            ['Status', 'Count', 'Percentage'],
            dashboardData.campaignStatusData.map(d => [
              d.status,
              d.count.toString(),
              `${d.percentage}%`
            ]),
            'Campaign Status Breakdown'
          )

          // Top shows table
          exporter.addTable(
            ['Show Name', 'Revenue', 'Impressions', 'Trend'],
            dashboardData.topShows.map(s => [
              s.name,
              s.revenue,
              s.impressions,
              `${s.trend === 'up' ? '↑' : '↓'} ${Math.abs(s.change)}%`
            ]),
            'Top Performing Shows'
          )
        }

        exporter.addFooter('PodcastFlow Pro - Dashboard Analytics')
        await exporter.save('dashboard-report.pdf')
      }
      else if (format === 'csv') {
        const csvData = [
          ['Dashboard Report', new Date().toLocaleDateString('en-US', { timeZone: 'UTC' })],
          [],
          ['Key Metrics'],
          ['Metric', 'Value'],
          ['Active Campaigns', dashboardData.activeCampaigns],
          ['Monthly Revenue', dashboardData.monthlyRevenue],
          ['Total Impressions', dashboardData.totalImpressions],
          ['Conversion Rate', `${dashboardData.conversionRate}%`],
          [],
          ['Campaign Status'],
          ['Status', 'Count', 'Percentage'],
          ...dashboardData.campaignStatusData.map(d => [d.status, d.count, `${d.percentage}%`]),
          [],
          ['Top Shows'],
          ['Show Name', 'Revenue', 'Impressions', 'Trend', 'Change'],
          ...dashboardData.topShows.map(s => [
            s.name,
            s.revenue,
            s.impressions,
            s.trend,
            `${s.change}%`
          ])
        ]
        
        exportToCSV(csvData, 'dashboard-report.csv')
      }
      else if (format === 'json') {
        const jsonData = {
          generatedAt: new Date().toISOString(),
          metrics: {
            activeCampaigns: dashboardData.activeCampaigns,
            monthlyRevenue: dashboardData.monthlyRevenue,
            totalImpressions: dashboardData.totalImpressions,
            conversionRate: dashboardData.conversionRate
          },
          campaignStatus: dashboardData.campaignStatusData,
          topShows: dashboardData.topShows,
          revenueByMonth: dashboardData.revenueByMonth
        }
        
        exportToJSON(jsonData, 'dashboard-report.json')
      }
      
      handleMenuClose()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Loading skeletons for KPI cards */}
            {[1, 2, 3, 4].map(i => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card>
                  <CardContent>
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="40%" height={40} />
                    <Skeleton variant="text" width="30%" />
                  </CardContent>
                </Card>
              </Grid>
            ))}
            
            {/* Loading skeleton for charts */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Skeleton variant="rectangular" height={300} />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto' }} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </DashboardLayout>
    )
  }

  if (error && !dashboardData) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error?.message || 'Failed to load dashboard data. Please try again.'}
          </Alert>
          <Button variant="contained" onClick={() => refetch()}>
            Retry
          </Button>
        </Box>
      </DashboardLayout>
    )
  }

  // Use empty data structure if no data loaded
  const data = dashboardData || {
    activeCampaigns: 0,
    pendingCampaigns: 0,
    monthlyRevenue: 0,
    totalImpressions: '0',
    totalClicks: '0',
    conversionRate: 0,
    revenueGrowth: 0,
    campaignStatusData: [],
    topShows: [],
    revenueByMonth: [],
    upcomingDeadlines: []
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
            Dashboard
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="body1" color="text.secondary">
              Welcome back! Here's your campaign performance overview.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<Campaign />} 
              onClick={() => router.push('/campaigns/new')}
              sx={{ whiteSpace: 'nowrap' }}
            >
              New Campaign
            </Button>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <DateRangeSelector
                value={dateRange}
                onChange={setDateRange}
                hideCustom
              />
              <Button 
                variant="outlined" 
                startIcon={<Refresh />} 
                onClick={handleRefresh}
                disabled={refreshing}
                size="small"
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </Box>
            <IconButton onClick={handleMenuClick}>
              <MoreVert />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => setExportModalOpen(true)}>
                <Download sx={{ mr: 1 }} /> Export Dashboard
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {error && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => queryClient.resetQueries({ queryKey: ['dashboard'] })}>
            {error?.message || 'Some data may be outdated. Dashboard will refresh automatically.'}
          </Alert>
        )}

        {/* KPI Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Active Campaigns
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                      {data.activeCampaigns}
                    </Typography>
                    {data.pendingCampaigns > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        +{data.pendingCampaigns} pending
                      </Typography>
                    )}
                  </Box>
                  <Campaign color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      {dateRange === 'today' ? 'Today\'s Revenue' :
                       dateRange === 'yesterday' ? 'Yesterday\'s Revenue' :
                       dateRange === 'thisWeek' ? 'This Week\'s Revenue' :
                       dateRange === 'lastWeek' ? 'Last Week\'s Revenue' :
                       dateRange === 'thisMonth' ? 'This Month\'s Revenue' :
                       dateRange === 'lastMonth' ? 'Last Month\'s Revenue' :
                       dateRange === 'last30Days' ? 'Last 30 Days Revenue' :
                       dateRange === 'last90Days' ? 'Last 90 Days Revenue' :
                       dateRange === 'thisYear' ? 'This Year\'s Revenue' :
                       'Revenue'}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                      ${(data.monthlyRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                    {data.revenueGrowth !== 0 && (
                      <Chip
                        label={`${data.revenueGrowth > 0 ? '+' : ''}${data.revenueGrowth.toFixed(2)}%`}
                        size="small"
                        color={data.revenueGrowth > 0 ? "success" : "error"}
                        icon={data.revenueGrowth > 0 ? <TrendingUp /> : <TrendingDown />}
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                  <AttachMoney color="success" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Total Impressions
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                      {typeof data.totalImpressions === 'number' 
                        ? data.totalImpressions.toLocaleString('en-US')
                        : parseInt(data.totalImpressions || '0').toLocaleString('en-US')}
                    </Typography>
                    {data.totalClicks && (
                      <Chip
                        label={`${typeof data.totalClicks === 'number' 
                          ? data.totalClicks.toLocaleString('en-US') 
                          : parseInt(data.totalClicks || '0').toLocaleString('en-US')} clicks`}
                        size="small"
                        sx={{ 
                          mt: 1,
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          fontWeight: 500,
                        }}
                      />
                    )}
                  </Box>
                  <Visibility color="info" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Conversion Rate
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                      {data.conversionRate}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Avg. across campaigns
                    </Typography>
                  </Box>
                  <TouchApp color="warning" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts and Tables */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <RevenueChart data={data.revenueByMonth} />
          </Grid>
          <Grid item xs={12} md={4}>
            <CampaignStatusChart data={data.campaignStatusData} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ height: 400 }}>
              <TopShows shows={data.topShows} />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ height: 400 }}>
              <RecentCampaigns limit={5} onCampaignChange={debouncedInvalidateCache} dateRange={dateRange} />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <UpcomingDeadlines deadlines={data.upcomingDeadlines} loading={loading} />
          </Grid>
        </Grid>
      </Box>

      <VisualExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Dashboard Report"
        onExport={handleExport}
        availableFormats={['pdf', 'csv', 'json']}
        defaultFormat="pdf"
      />
    </DashboardLayout>
  )
}