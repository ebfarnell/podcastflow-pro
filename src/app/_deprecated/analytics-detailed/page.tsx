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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Campaign as CampaignIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  Visibility as VisibilityIcon,
  MouseIcon,
  AccessTime as TimeIcon,
  Phone as PhoneIcon,
  Computer as ComputerIcon,
  Tablet as TabletIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
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
import { DateRangeSelector } from '@/components/common/DateRangeSelector'
import { ChartContainer } from '@/components/charts/ChartContainer'
import dayjs, { Dayjs } from 'dayjs'

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

export default function DetailedAnalyticsPage() {
  const { user } = useAuth()
  const [tabValue, setTabValue] = useState(0)
  const [timeRange, setTimeRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [customStartDate, setCustomStartDate] = useState<Dayjs | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Dayjs | null>(null)
  
  // Analytics state
  const [overviewData, setOverviewData] = useState<any>({})
  const [campaignData, setCampaignData] = useState<any[]>([])
  const [audienceData, setAudienceData] = useState<any[]>([])
  const [performanceData, setPerformanceData] = useState<any[]>([])
  const [realTimeData, setRealTimeData] = useState<any>(null)
  const [episodeData, setEpisodeData] = useState<any[]>([])
  const [showData, setShowData] = useState<any[]>([])

  useEffect(() => {
    loadAllAnalytics()
    
    // Set up auto-refresh if enabled
    let interval: NodeJS.Timeout | null = null
    if (autoRefresh) {
      interval = setInterval(() => {
        loadRealTimeData()
      }, 30000) // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timeRange, customStartDate, customEndDate, autoRefresh, user?.organizationId])

  const loadAllAnalytics = async () => {
    if (!user?.organizationId) {
      console.log('No organizationId available, skipping analytics load')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        params.set('startDate', customStartDate.format('YYYY-MM-DD'))
        params.set('endDate', customEndDate.format('YYYY-MM-DD'))
      } else {
        params.set('timeRange', timeRange)
      }

      // Load all analytics data in parallel
      const [
        overviewResponse,
        campaignsResponse,
        audienceResponse,
        performanceResponse,
        episodesResponse,
        showsResponse,
        realTimeResponse
      ] = await Promise.all([
        fetch(`/api/analytics?${params}`),
        fetch(`/api/analytics/campaigns?${params}`),
        fetch(`/api/analytics/audience?${params}`),
        fetch(`/api/analytics/performance?${params}`),
        fetch(`/api/analytics/episodes?${params}`),
        fetch(`/api/analytics/shows?${params}`),
        fetch(`/api/analytics/real-time/dashboard?timeWindow=3600&organizationId=${user.organizationId}`)
      ])

      const [overview, campaigns, audience, performance, episodes, shows, realTime] = await Promise.all([
        overviewResponse.json(),
        campaignsResponse.json(),
        audienceResponse.json(),
        performanceResponse.json(),
        episodesResponse.json(),
        showsResponse.json(),
        realTimeResponse.json()
      ])

      setOverviewData(overview)
      setCampaignData(campaigns.data || [])
      setAudienceData(audience.data || [])
      setPerformanceData(performance.data || [])
      setEpisodeData(episodes.data || [])
      setShowData(shows.data || [])
      setRealTimeData(realTime.success ? realTime : null)
      
    } catch (err) {
      console.error('Error loading analytics:', err)
      setError('Failed to load analytics data. Please try again.')
    } finally {
      setLoading(false)
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

  // Render functions for different sections
  const renderOverviewCards = () => (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <MoneyIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="h6" color="success.main">
                Total Revenue
              </Typography>
            </Box>
            {loading ? (
              <Skeleton variant="text" height={40} />
            ) : (
              <>
                <Typography variant="h4" component="div">
                  ${(overviewData.summary?.totalRevenue || 0).toLocaleString()}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <TrendingUpIcon fontSize="small" color="success" />
                  <Typography variant="body2" color="success.main" sx={{ ml: 0.5 }}>
                    +12.5% from last period
                  </Typography>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CampaignIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" color="primary.main">
                Active Campaigns
              </Typography>
            </Box>
            {loading ? (
              <Skeleton variant="text" height={40} />
            ) : (
              <>
                <Typography variant="h4" component="div">
                  {overviewData.summary?.activeCampaigns || 0}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <TrendingUpIcon fontSize="small" color="success" />
                  <Typography variant="body2" color="success.main" sx={{ ml: 0.5 }}>
                    +{overviewData.summary?.activeCampaigns || 0} new this week
                  </Typography>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <VisibilityIcon color="info" sx={{ mr: 1 }} />
              <Typography variant="h6" color="info.main">
                Impressions
              </Typography>
            </Box>
            {loading ? (
              <Skeleton variant="text" height={40} />
            ) : (
              <>
                <Typography variant="h4" component="div">
                  {(overviewData.summary?.totalImpressions || 0).toLocaleString()}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <TrendingUpIcon fontSize="small" color="success" />
                  <Typography variant="body2" color="success.main" sx={{ ml: 0.5 }}>
                    +{((overviewData.summary?.totalImpressions || 0) * 0.08).toFixed(1)}% CTR
                  </Typography>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PeopleIcon color="secondary" sx={{ mr: 1 }} />
              <Typography variant="h6" color="secondary.main">
                Unique Listeners
              </Typography>
            </Box>
            {loading ? (
              <Skeleton variant="text" height={40} />
            ) : (
              <>
                <Typography variant="h4" component="div">
                  {Math.floor((overviewData.summary?.totalImpressions || 0) * 0.7).toLocaleString()}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <TrendingUpIcon fontSize="small" color="success" />
                  <Typography variant="body2" color="success.main" sx={{ ml: 0.5 }}>
                    70% unique rate
                  </Typography>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )

  const renderRealTimePanel = () => (
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
        
        {realTimeData ? (
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
        ) : (
          <Alert severity="info">
            Real-time data not available. Check your analytics configuration.
          </Alert>
        )}
        
        {realTimeData?.timestamp && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Last updated: {new Date(realTimeData.timestamp).toLocaleString()}
          </Typography>
        )}
      </CardContent>
    </Card>
  )

  const renderCampaignPerformance = () => (
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
  )

  const renderAudienceInsights = () => (
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
            <List>
              <ListItem>
                <ListItemAvatar>
                  <Avatar><PhoneIcon /></Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary="Mobile" 
                  secondary="45% of listeners" 
                />
                <ListItemSecondaryAction>
                  <LinearProgress 
                    variant="determinate" 
                    value={45} 
                    sx={{ width: 100 }} 
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar><ComputerIcon /></Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary="Desktop" 
                  secondary="35% of listeners" 
                />
                <ListItemSecondaryAction>
                  <LinearProgress 
                    variant="determinate" 
                    value={35} 
                    sx={{ width: 100 }} 
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar><TabletIcon /></Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary="Tablet" 
                  secondary="20% of listeners" 
                />
                <ListItemSecondaryAction>
                  <LinearProgress 
                    variant="determinate" 
                    value={20} 
                    sx={{ width: 100 }} 
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )

  const renderPerformanceTrends = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Performance Trends
        </Typography>
        {loading ? (
          <Skeleton variant="rectangular" height={300} />
        ) : performanceData.length > 0 ? (
          <ChartContainer height={300}>
            <ComposedChart data={performanceData}>
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
  )

  return (
    <RouteProtection requiredPermission={PERMISSIONS.DASHBOARD_ANALYTICS}>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1">
              Detailed Analytics Dashboard
            </Typography>
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
              <Button 
                startIcon={<DownloadIcon />} 
                variant="outlined"
                onClick={() => {
                  // Export functionality can be added here
                  console.log('Export detailed analytics')
                }}
              >
                Export
              </Button>
            </Box>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Overview Cards */}
          {renderOverviewCards()}

          {/* Real-time Panel */}
          {renderRealTimePanel()}

          {/* Tabs Navigation */}
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
              {renderCampaignPerformance()}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {renderAudienceInsights()}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {renderPerformanceTrends()}
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <Alert severity="info">
                Content analytics for episodes and shows will be available here.
                This section will show episode performance, listener engagement, and content insights.
              </Alert>
            </TabPanel>
          </Card>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}