'use client'


import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  LinearProgress,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider
} from '@mui/material'
import {
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  Campaign as CampaignIcon,
  TrendingDown as TrendingDownIcon,
  Visibility as VisibilityIcon,
  MouseIcon,
  AccessTime as TimeIcon,
  Phone as PhoneIcon,
  Computer as ComputerIcon,
  Tablet as TabletIcon,
  Refresh as RefreshIcon,
  Share as ShareIcon,
  StarBorder as StarIcon
} from '@mui/icons-material'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ScatterChart,
  Scatter
} from 'recharts'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { useAuth } from '@/contexts/AuthContext'
import { DateRangePicker } from '@/components/analytics/DateRangePicker'
import { KPICard } from '@/components/analytics/KPICard'
import dayjs, { Dayjs } from 'dayjs'
import { DateRangeSelector } from '@/components/common/DateRangeSelector'
import { VisualExportModal } from '@/components/exports/VisualExportModal'
import { ChartContainer } from '@/components/charts/ChartContainer'
import { PDFExporter, createChartCanvas } from '@/utils/pdfExport'
import { exportToCSV, exportToJSON } from '@/utils/export'
import { analyticsApi, type AnalyticsKPIs, type RevenueData, type PerformanceData, type AudienceData, type CampaignPerformance } from '@/services/analyticsApi'
import { CircularProgress } from '@mui/material'
// Temporarily commented out for build testing
// import { RateTrendsAnalytics } from '@/components/analytics/RateTrendsAnalytics'
import { useOrganization } from '@/contexts/OrganizationContext'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()
  const [timeRange, setTimeRange] = useState('30d')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realTimeData, setRealTimeData] = useState<any>(null)
  const [customStartDate, setCustomStartDate] = useState<Dayjs | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Dayjs | null>(null)
  const [tabValue, setTabValue] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(false)
  
  // Detailed analytics state
  const [overviewData, setOverviewData] = useState<any>({})
  const [campaignData, setCampaignData] = useState<any[]>([])
  const [performanceDetailData, setPerformanceDetailData] = useState<any[]>([])
  const [episodeData, setEpisodeData] = useState<any[]>([])
  const [showData, setShowData] = useState<any[]>([])
  
  const [kpis, setKpis] = useState<AnalyticsKPIs>({
    totalRevenue: 0,
    revenueGrowth: 0,
    activeCampaigns: 0,
    campaignGrowth: 0,
    totalImpressions: 0,
    impressionGrowth: 0,
    uniqueListeners: 0,
    listenerGrowth: 0,
    averageCTR: 0,
    conversionRate: 0
  })
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([])
  const [audienceData, setAudienceData] = useState<AudienceData[]>([])
  const [campaignPerformance, setCampaignPerformance] = useState<CampaignPerformance[]>([])
  const [insights, setInsights] = useState<any>({})

  useEffect(() => {
    loadAnalyticsData()
    loadDetailedAnalytics()
    // Set up real-time data refresh
    let interval: NodeJS.Timeout | null = null
    if (autoRefresh) {
      interval = setInterval(() => {
        loadRealTimeData()
      }, 30000) // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timeRange, campaignFilter, customStartDate, customEndDate, autoRefresh, user?.organizationId])

  const loadAnalyticsData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Prepare parameters based on time range
      const params: any = { campaignFilter }
      
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        params.startDate = customStartDate.format('YYYY-MM-DD')
        params.endDate = customEndDate.format('YYYY-MM-DD')
      } else {
        params.timeRange = timeRange
      }
      
      // Load all analytics data in parallel
      const [analyticsResponse, kpisResponse, revenueResponse, performanceResponse, audienceResponse, campaignResponse] = await Promise.all([
        analyticsApi.getAnalytics(params),
        analyticsApi.getKPIs(timeRange === 'custom' ? undefined : timeRange, params.startDate, params.endDate),
        analyticsApi.getRevenueData({ ...params, granularity: 'monthly' }),
        analyticsApi.getPerformanceData(params),
        analyticsApi.getAudienceData({ type: 'age' }),
        analyticsApi.getCampaignPerformance({ ...params, limit: 5, sort: 'revenue:desc' })
      ])

      // Use data from comprehensive analytics response if available, otherwise use individual responses
      setKpis(analyticsResponse.kpis.totalRevenue ? analyticsResponse.kpis : kpisResponse)
      setRevenueData(analyticsResponse.revenueData.length > 0 ? analyticsResponse.revenueData : revenueResponse)
      setPerformanceData(analyticsResponse.performanceData.length > 0 ? analyticsResponse.performanceData : performanceResponse)
      setAudienceData(analyticsResponse.audienceData.length > 0 ? analyticsResponse.audienceData : audienceResponse)
      setCampaignPerformance(analyticsResponse.campaignPerformance.length > 0 ? analyticsResponse.campaignPerformance : campaignResponse)
      setInsights(analyticsResponse.insights || {})
    } catch (err) {
      console.error('Error loading analytics data:', err)
      setError('Failed to load analytics data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadDetailedAnalytics = async () => {
    if (!user?.organizationId) {
      console.log('No organizationId available, skipping analytics load')
      return
    }

    try {
      const params = new URLSearchParams()
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        params.set('startDate', customStartDate.format('YYYY-MM-DD'))
        params.set('endDate', customEndDate.format('YYYY-MM-DD'))
      } else {
        params.set('timeRange', timeRange)
      }

      // Load detailed analytics data in parallel
      const [
        campaignsResponse,
        audienceResponse,
        performanceResponse,
        episodesResponse,
        showsResponse
      ] = await Promise.all([
        fetch(`/api/analytics/campaigns?${params}`),
        fetch(`/api/analytics/audience?${params}`),
        fetch(`/api/analytics/performance?${params}`),
        fetch(`/api/analytics/episodes?${params}`),
        fetch(`/api/analytics/shows?${params}`)
      ])

      const [campaigns, audience, performance, episodes, shows] = await Promise.all([
        campaignsResponse.json(),
        audienceResponse.json(),
        performanceResponse.json(),
        episodesResponse.json(),
        showsResponse.json()
      ])

      setCampaignData(campaigns.data || [])
      // Use the main audienceData state for consistency
      if (audience.data && audience.data.length > 0) {
        setAudienceData(audience.data)
      }
      setPerformanceDetailData(performance.data || [])
      setEpisodeData(episodes.data || [])
      setShowData(shows.data || [])
      
    } catch (err) {
      console.error('Error loading detailed analytics:', err)
    }
  }

  const loadRealTimeData = async () => {
    if (!user?.organizationId) {
      console.log('No organizationId available, skipping real-time data load')
      return
    }

    try {
      const response = await fetch(`/api/analytics/real-time/dashboard?timeWindow=3600&organizationId=${user.organizationId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setRealTimeData(data)
        }
      }
    } catch (error) {
      console.error('Error loading real-time data:', error)
    }
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d']

  const handleExport = async (format: string, settings: any) => {
    try {
      if (format === 'pdf') {
        const exporter = new PDFExporter({
          title: 'PodcastFlow Pro Analytics Report',
          subtitle: `${timeRange === 'custom' ? 'Custom Range' : `Last ${timeRange}`} - Generated on ${new Date().toLocaleDateString()}`,
          orientation: settings.orientation || 'landscape'
        })

        // KPI Summary
        if (settings.includeSummary) {
          exporter.addSummarySection([
            { label: 'Total Revenue', value: `$${((kpis.totalRevenue || 0) / 1000000).toFixed(2)}M` },
            { label: 'Active Campaigns', value: (kpis.activeCampaigns || 0).toString() },
            { label: 'Total Impressions', value: `${((kpis.totalImpressions || 0) / 1000000).toFixed(1)}M` },
            { label: 'Unique Listeners', value: `${((kpis.uniqueListeners || 0) / 1000).toFixed(0)}K` },
            { label: 'Average CTR', value: `${(kpis.averageCTR || 0).toFixed(1)}%` },
            { label: 'Revenue Growth', value: `${(kpis.revenueGrowth || 0) > 0 ? '+' : ''}${(kpis.revenueGrowth || 0).toFixed(1)}%` },
            { label: 'Listener Growth', value: `${(kpis.listenerGrowth || 0) > 0 ? '+' : ''}${(kpis.listenerGrowth || 0).toFixed(1)}%` },
            { label: 'Conversion Rate', value: `${(kpis.conversionRate || 0).toFixed(2)}%` }
          ])
        }

        if (settings.includeCharts) {
          // Revenue trend area chart
          const revenueChart = await createChartCanvas('line', {
            labels: revenueData.map(d => d.month),
            datasets: [
              {
                label: 'Revenue',
                data: revenueData.map(d => d.revenue),
                borderColor: '#8884d8',
                backgroundColor: 'rgba(136, 132, 216, 0.2)',
                fill: true,
                tension: 0.4
              },
              {
                label: 'Target',
                data: revenueData.map(d => d.target),
                borderColor: '#82ca9d',
                backgroundColor: 'rgba(130, 202, 157, 0.2)',
                fill: true,
                tension: 0.4
              }
            ]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Revenue Trend Analysis'
              }
            }
          })
          await exporter.addChart(revenueChart)

          // Audience demographics pie chart
          const audienceChart = await createChartCanvas('pie', {
            labels: audienceData.map(d => d.name),
            datasets: [{
              data: audienceData.map(d => d.value),
              backgroundColor: COLORS
            }]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Audience Demographics by Age'
              }
            }
          })
          await exporter.addChart(audienceChart)

          // Campaign performance bar chart
          const campaignChart = await createChartCanvas('bar', {
            labels: campaignPerformance.map(d => d.name),
            datasets: [
              {
                label: 'Revenue ($)',
                data: campaignPerformance.map(d => d.revenue),
                backgroundColor: '#8884d8',
                yAxisID: 'y'
              },
              {
                label: 'Impressions',
                data: campaignPerformance.map(d => d.impressions),
                backgroundColor: '#82ca9d',
                yAxisID: 'y1'
              }
            ]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Campaign Performance Comparison'
              }
            },
            scales: {
              y: {
                type: 'linear',
                display: true,
                position: 'left'
              },
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                grid: {
                  drawOnChartArea: false
                }
              }
            }
          })
          await exporter.addChart(campaignChart)

          // Engagement metrics line chart
          const engagementChart = await createChartCanvas('line', {
            labels: performanceData.map(d => d.date),
            datasets: [
              {
                label: 'CTR (%)',
                data: performanceData.map(d => d.ctr),
                borderColor: '#ffc658',
                backgroundColor: 'rgba(255, 198, 88, 0.2)',
                yAxisID: 'y1'
              }
            ]
          }, {
            plugins: {
              title: {
                display: true,
                text: 'Engagement Metrics Over Time'
              }
            },
            scales: {
              y1: {
                type: 'linear',
                display: true,
                position: 'right'
              }
            }
          })
          await exporter.addChart(engagementChart)
        }

        if (settings.includeRawData) {
          // Detailed revenue table
          exporter.addTable(
            ['Month', 'Revenue', 'Target', 'Variance', 'Growth %'],
            revenueData.map((d, index) => [
              d.month,
              `$${d.revenue.toLocaleString()}`,
              `$${d.target.toLocaleString()}`,
              `$${(d.revenue - d.target).toLocaleString()}`,
              index > 0 ? `${((d.revenue - revenueData[index - 1].revenue) / revenueData[index - 1].revenue * 100).toFixed(1)}%` : 'N/A'
            ]),
            'Monthly Revenue Analysis'
          )

          // Campaign performance table
          exporter.addTable(
            ['Campaign', 'Revenue', 'Impressions', 'CTR', 'CPA', 'ROI'],
            campaignPerformance.map(c => [
              c.name,
              `$${c.revenue.toLocaleString()}`,
              c.impressions >= 1000000 ? `${(c.impressions / 1000000).toFixed(1)}M` : c.impressions.toLocaleString(),
              '2.8%',
              '$24.50',
              c.roi ? `${c.roi}%` : 'N/A'
            ]),
            'Campaign Performance Details'
          )

          // Engagement metrics table
          exporter.addTable(
            ['Date', 'Impressions', 'Clicks', 'CTR (%)', 'Conversions', 'CVR (%)'],
            performanceData.map(d => [
              new Date(d.date).toLocaleDateString(),
              d.impressions.toLocaleString(),
              d.clicks.toLocaleString(),
              `${d.ctr}%`,
              Math.floor(d.clicks * 0.05).toLocaleString(),
              `${(Math.floor(d.clicks * 0.05) / d.clicks * 100).toFixed(2)}%`
            ]),
            'Weekly Engagement Metrics'
          )
        }

        exporter.addFooter('PodcastFlow Pro - Analytics & Insights')
        await exporter.save(`analytics-report-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf`)
      }
      else if (format === 'csv') {
        const csvData = [
          ['Analytics Report', new Date().toLocaleDateString(), timeRange],
          [],
          ['Key Performance Indicators'],
          ['Metric', 'Value', 'Change'],
          ['Total Revenue', `$${(kpis.totalRevenue / 1000000).toFixed(2)}M`, `${kpis.revenueGrowth > 0 ? '+' : ''}${kpis.revenueGrowth.toFixed(1)}%`],
          ['Active Campaigns', kpis.activeCampaigns.toString(), `${kpis.campaignGrowth > 0 ? '+' : ''}${kpis.campaignGrowth}`],
          ['Total Impressions', `${(kpis.totalImpressions / 1000000).toFixed(1)}M`, `${kpis.impressionGrowth > 0 ? '+' : ''}${kpis.impressionGrowth.toFixed(1)}%`],
          ['Unique Listeners', `${(kpis.uniqueListeners / 1000).toFixed(0)}K`, `${kpis.listenerGrowth > 0 ? '+' : ''}${kpis.listenerGrowth.toFixed(1)}%`],
          [],
          ['Revenue by Month'],
          ['Month', 'Revenue', 'Target', 'Variance'],
          ...revenueData.map(d => [
            d.month,
            d.revenue,
            d.target,
            d.revenue - d.target
          ]),
          [],
          ['Campaign Performance'],
          ['Campaign', 'Revenue', 'Impressions'],
          ...campaignPerformance.map(c => [
            c.name,
            c.revenue,
            c.impressions
          ]),
          [],
          ['Audience Demographics'],
          ['Age Group', 'Percentage'],
          ...audienceData.map(a => [a.name, `${a.value}%`])
        ]
        
        exportToCSV(csvData, `analytics-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`)
      }
      else if (format === 'json') {
        const jsonData = {
          generatedAt: new Date().toISOString(),
          timeRange,
          kpis,
          revenueData,
          performanceData,
          audienceData,
          campaignPerformance,
          insights
        }
        
        exportToJSON(jsonData, `analytics-report-${timeRange}-${new Date().toISOString().split('T')[0]}.json`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      throw error
    }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.DASHBOARD_ANALYTICS}>
      <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Typography variant="h4" component="h1" sx={{ color: 'text.primary', mb: 3 }}>
          Performance Analytics Center
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <DateRangeSelector
              value={timeRange}
              onChange={setTimeRange}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomDateChange={(start, end) => {
                setCustomStartDate(start)
                setCustomEndDate(end)
              }}
            />
            <Button startIcon={<DownloadIcon />} variant="outlined" onClick={() => setExportModalOpen(true)}>
              Export Report
            </Button>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Real-time Panel */}
        {realTimeData && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Real-Time Analytics</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Auto Refresh"
                  />
                  <IconButton onClick={loadRealTimeData} size="small">
                    <RefreshIcon />
                  </IconButton>
                </Box>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary">
                      {realTimeData.summary?.totalImpressions?.toLocaleString() || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Impressions (1h)
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {realTimeData.summary?.totalClicks?.toLocaleString() || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Clicks (1h)
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="info.main">
                      {realTimeData.summary?.overallCtr?.toFixed(1) || 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      CTR (1h)
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main">
                      {realTimeData.summary?.activeCampaigns || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Campaigns
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              {realTimeData?.timestamp && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Last updated: {new Date(realTimeData.timestamp).toLocaleString()}
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            {loading ? (
              <Card><CardContent><Skeleton variant="text" height={32} /><Skeleton variant="text" width="60%" /></CardContent></Card>
            ) : (
              <KPICard
                title="Total Revenue"
                value={kpis.totalRevenue >= 1000000 ? `$${(kpis.totalRevenue / 1000000).toFixed(2)}M` : `$${(kpis.totalRevenue / 1000).toFixed(0)}K`}
                change={`${kpis.revenueGrowth > 0 ? '+' : ''}${kpis.revenueGrowth.toFixed(1)}%`}
                trend={kpis.revenueGrowth > 0 ? "up" : "down"}
                icon={<MoneyIcon />}
                color="success"
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {loading ? (
              <Card><CardContent><Skeleton variant="text" height={32} /><Skeleton variant="text" width="60%" /></CardContent></Card>
            ) : (
              <KPICard
                title="Active Campaigns"
                value={kpis.activeCampaigns.toString()}
                change={`${kpis.campaignGrowth > 0 ? '+' : ''}${kpis.campaignGrowth}`}
                trend={kpis.campaignGrowth > 0 ? "up" : "down"}
                icon={<CampaignIcon />}
                color="primary"
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {loading ? (
              <Card><CardContent><Skeleton variant="text" height={32} /><Skeleton variant="text" width="60%" /></CardContent></Card>
            ) : (
              <KPICard
                title="Total Impressions"
                value={kpis.totalImpressions >= 1000000 ? `${(kpis.totalImpressions / 1000000).toFixed(1)}M` : `${(kpis.totalImpressions / 1000).toFixed(0)}K`}
                change={`${kpis.impressionGrowth > 0 ? '+' : ''}${kpis.impressionGrowth.toFixed(1)}%`}
                trend={kpis.impressionGrowth > 0 ? "up" : "down"}
                icon={<TrendingUpIcon />}
                color="info"
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {loading ? (
              <Card><CardContent><Skeleton variant="text" height={32} /><Skeleton variant="text" width="60%" /></CardContent></Card>
            ) : (
              <KPICard
                title="Unique Listeners"
                value={kpis.uniqueListeners >= 1000000 ? `${(kpis.uniqueListeners / 1000000).toFixed(1)}M` : `${(kpis.uniqueListeners / 1000).toFixed(0)}K`}
                change={`${kpis.listenerGrowth > 0 ? '+' : ''}${kpis.listenerGrowth.toFixed(1)}%`}
                trend={kpis.listenerGrowth > 0 ? "up" : "down"}
                icon={<PeopleIcon />}
                color="secondary"
              />
            )}
          </Grid>
        </Grid>

        {/* Charts Grid */}
        <Grid container spacing={3}>
          {/* Revenue Trend */}
          <Grid item xs={12} lg={8}>
            <Card sx={{ height: 400 }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                  Revenue Trend
                </Typography>
                {loading ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Skeleton variant="rectangular" width="100%" height={300} />
                  </Box>
                ) : revenueData.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.secondary">No revenue data available</Typography>
                  </Box>
                ) : (
                  <Box sx={{ flex: 1 }}>
                    <ChartContainer height={320}>
                      <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `$${value / 1000}K`} />
                        <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#8884d8"
                          fill="#8884d8"
                          fillOpacity={0.6}
                        />
                        <Area
                          type="monotone"
                          dataKey="target"
                          stroke="#82ca9d"
                          fill="#82ca9d"
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Audience Demographics */}
          <Grid item xs={12} lg={4}>
            <Card sx={{ height: 400 }}>
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                  Audience Demographics
                </Typography>
                {loading ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Skeleton variant="circular" width={200} height={200} />
                  </Box>
                ) : audienceData.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.secondary">No audience data available</Typography>
                  </Box>
                ) : (
                  <Box sx={{ flex: 1 }}>
                    <ChartContainer height={340}>
                      <PieChart>
                        <Pie
                          data={audienceData}
                          cx="50%"
                          cy="45%"
                          labelLine={false}
                          label={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {audienceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend 
                          verticalAlign="bottom"
                          align="center"
                          layout="horizontal"
                          wrapperStyle={{
                            paddingTop: '20px',
                            fontSize: '12px',
                            display: 'flex',
                            justifyContent: 'center'
                          }}
                          formatter={(value, entry) => `${value}: ${entry.payload.value}%`}
                          iconSize={14}
                          iconType="square"
                        />
                      </PieChart>
                    </ChartContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Campaign Performance Dashboard */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    Campaign Performance Overview
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Filter</InputLabel>
                      <Select
                        value={campaignFilter}
                        label="Filter"
                        variant="outlined"
                        onChange={(e) => setCampaignFilter(e.target.value)}
                      >
                        <MenuItem value="all">All Campaigns</MenuItem>
                        <MenuItem value="active">Active Only</MenuItem>
                        <MenuItem value="completed">Completed</MenuItem>
                      </Select>
                    </FormControl>
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.location.href = '/campaigns'
                        }
                      }}
                    >
                      View All
                    </Button>
                  </Box>
                </Box>

                {loading ? (
                  <Box>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      {[1, 2, 3, 4].map((i) => (
                        <Grid item xs={6} md={3} key={i}>
                          <Card variant="outlined">
                            <CardContent sx={{ p: 2 }}>
                              <Skeleton variant="text" height={20} width="60%" />
                              <Skeleton variant="text" height={32} width="80%" />
                              <Skeleton variant="text" height={16} width="40%" />
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                    <Skeleton variant="rectangular" height={240} />
                  </Box>
                ) : campaignPerformance.length === 0 ? (
                  <Box sx={{ 
                    height: 300, 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 2
                  }}>
                    <CampaignIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                    <Typography color="text.secondary" variant="h6">
                      No campaigns found
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Create your first campaign to see performance metrics
                    </Typography>
                    <Button 
                      variant="contained" 
                      sx={{ mt: 2 }}
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.location.href = '/campaigns/new'
                        }
                      }}
                    >
                      Create Campaign
                    </Button>
                  </Box>
                ) : (
                  <>
                    {/* Performance Summary Cards */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={6} md={3}>
                        <Card variant="outlined" sx={{ borderColor: 'primary.main', borderWidth: 2 }}>
                          <CardContent sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Total Revenue
                            </Typography>
                            <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 600 }}>
                              ${campaignPerformance.reduce((sum, c) => sum + c.revenue, 0).toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="success.main">
                              {campaignPerformance.length} campaigns
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Card variant="outlined">
                          <CardContent sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Total Impressions
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 600 }}>
                              {(campaignPerformance.reduce((sum, c) => sum + c.impressions, 0) / 1000000).toFixed(1)}M
                            </Typography>
                            <Typography variant="caption" color="info.main">
                              Across all campaigns
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Card variant="outlined">
                          <CardContent sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Avg. CPM
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 600 }}>
                              ${(campaignPerformance.reduce((sum, c) => sum + c.revenue, 0) / 
                                 (campaignPerformance.reduce((sum, c) => sum + c.impressions, 0) / 1000)).toFixed(2)}
                            </Typography>
                            <Typography variant="caption" color="warning.main">
                              Cost per 1K impressions
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Card variant="outlined">
                          <CardContent sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Top Performer
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                              {campaignPerformance.length > 0 ? 
                                campaignPerformance.reduce((top, current) => 
                                  current.revenue > top.revenue ? current : top
                                ).name.substring(0, 12) + (campaignPerformance.reduce((top, current) => 
                                  current.revenue > top.revenue ? current : top
                                ).name.length > 12 ? '...' : '') 
                                : 'N/A'
                              }
                            </Typography>
                            <Typography variant="caption" color="success.main">
                              ${campaignPerformance.length > 0 ? 
                                campaignPerformance.reduce((top, current) => 
                                  current.revenue > top.revenue ? current : top
                                ).revenue.toLocaleString() 
                                : '0'
                              }
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>

                    {/* Campaign Performance Chart */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
                        Revenue vs Impressions by Campaign
                      </Typography>
                      <ChartContainer height={280}>
                        <BarChart data={campaignPerformance.slice(0, 6)} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="name" 
                            angle={-45} 
                            textAnchor="end" 
                            height={80}
                            fontSize={12}
                            tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                          />
                          <YAxis yAxisId="left" orientation="left" stroke="#8884d8" fontSize={12} />
                          <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" fontSize={12} />
                          <RechartsTooltip 
                            formatter={(value: number, name: string) => [
                              name === 'Revenue ($)' ? `$${value.toLocaleString()}` : value.toLocaleString(),
                              name
                            ]}
                            labelFormatter={(label) => `Campaign: ${label}`}
                          />
                          <Legend 
                            wrapperStyle={{ paddingTop: '10px' }}
                            iconSize={12}
                          />
                          <Bar 
                            yAxisId="left" 
                            dataKey="revenue" 
                            fill="#8884d8" 
                            name="Revenue ($)"
                            radius={[2, 2, 0, 0]}
                          />
                          <Bar 
                            yAxisId="right" 
                            dataKey="impressions" 
                            fill="#82ca9d" 
                            name="Impressions"
                            radius={[2, 2, 0, 0]}
                          />
                        </BarChart>
                      </ChartContainer>
                    </Box>

                    {/* Quick Stats Table */}
                    {campaignPerformance.length > 6 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                          {campaignPerformance.length > 6 ? `Showing top 6 of ${campaignPerformance.length} campaigns` : ''}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Detailed Analytics Tabs */}
          <Grid item xs={12}>
            <Card>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="analytics tabs">
                  <Tab label="Campaign Performance" />
                  <Tab label="Audience Insights" />
                  <Tab label="Performance Trends" />
                  <Tab label="Content Analytics" />
                </Tabs>
              </Box>

              {/* Tab Panels */}
              <TabPanel value={tabValue} index={0}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Campaign Performance
                    </Typography>
                    {loading ? (
                      <Skeleton variant="rectangular" height={400} />
                    ) : campaignData.length > 0 ? (
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Campaign</TableCell>
                              <TableCell align="right">Revenue</TableCell>
                              <TableCell align="right">Impressions</TableCell>
                              <TableCell align="right">Clicks</TableCell>
                              <TableCell align="right">CTR</TableCell>
                              <TableCell align="right">Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {campaignData.slice(0, 10).map((campaign, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="medium">
                                    {campaign.name || `Campaign ${index + 1}`}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  ${(campaign.revenue || 0).toLocaleString()}
                                </TableCell>
                                <TableCell align="right">
                                  {(campaign.impressions || 0).toLocaleString()}
                                </TableCell>
                                <TableCell align="right">
                                  {(campaign.clicks || 0).toLocaleString()}
                                </TableCell>
                                <TableCell align="right">
                                  {campaign.ctr ? `${campaign.ctr.toFixed(2)}%` : '0.00%'}
                                </TableCell>
                                <TableCell align="right">
                                  <Chip 
                                    label={campaign.status || 'Active'} 
                                    color={campaign.status === 'active' ? 'success' : 'default'}
                                    size="small" 
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Alert severity="info">No campaign data available for the selected period.</Alert>
                    )}
                  </CardContent>
                </Card>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ height: 400 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Audience Demographics
                        </Typography>
                        {loading ? (
                          <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto' }} />
                        ) : audienceData.length > 0 ? (
                          <ChartContainer height={300}>
                            <PieChart>
                              <Pie
                                data={audienceData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {audienceData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip />
                            </PieChart>
                          </ChartContainer>
                        ) : (
                          <Alert severity="info">No audience data available.</Alert>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card sx={{ height: 400 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Device Breakdown
                        </Typography>
                        <Box sx={{ 
                          height: 300, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexDirection: 'column'
                        }}>
                          <Alert severity="info" sx={{ width: '100%' }}>
                            <Typography variant="body2">
                              Device analytics are not currently available from integrated platforms.
                            </Typography>
                            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                              This data will be available when device tracking is enabled through podcast hosting platforms.
                            </Typography>
                          </Alert>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Performance Trends
                    </Typography>
                    {loading ? (
                      <Skeleton variant="rectangular" height={300} />
                    ) : Array.isArray(performanceDetailData) && performanceDetailData.length > 0 ? (
                      <ChartContainer height={300}>
                        <ComposedChart data={performanceDetailData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <RechartsTooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="impressions" fill="#8884d8" name="Impressions" />
                          <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#ff7300" name="CTR %" />
                        </ComposedChart>
                      </ChartContainer>
                    ) : (
                      <Alert severity="info">No performance data available.</Alert>
                    )}
                  </CardContent>
                </Card>
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <Alert severity="info">
                  Content analytics for episodes and shows will be available here.
                  This section will show episode performance, listener engagement, and content insights.
                </Alert>
              </TabPanel>

            </Card>
          </Grid>
        </Grid>
      </Box>


      <VisualExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Analytics Report"
        onExport={handleExport}
        availableFormats={['pdf', 'csv', 'json']}
        defaultFormat="pdf"
      />
    </DashboardLayout>
    </RouteProtection>
  )
}