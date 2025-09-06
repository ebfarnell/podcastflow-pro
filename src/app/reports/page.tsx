'use client'


import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Tab,
  Tabs,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material'
import {
  Download,
  Schedule,
  TrendingUp,
  TrendingDown,
  Assessment,
  BarChart,
  ShowChart,
  PieChart,
  TableChart,
  Info as InfoIcon,
  InfoOutlined,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import {
  LineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { VisualExportModal } from '@/components/exports/VisualExportModal'
import { PDFExporter, createChartCanvas } from '@/utils/pdfExport'
import { exportToCSV, exportToJSON } from '@/utils/export'
import { ChartContainer } from '@/components/charts/ChartContainer'
import { analyticsApi } from '@/services/analyticsApi'
import { useQuery } from '@tanstack/react-query'
import dayjs, { Dayjs } from 'dayjs'
import { DateRangeSelector } from '@/components/common/DateRangeSelector'
import { CustomReportBuilder } from '@/components/reports/CustomReportBuilder'
import { useReportDateRange } from '@/hooks/useReportDateRange'


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function ReportsPage() {
  const [selectedTab, setSelectedTab] = useState(0)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  
  // Use unified date range hook
  const dateRange = useReportDateRange('7d')


  // Fetch revenue data
  const { data: revenueData = [], isLoading: revenueLoading } = useQuery({
    queryKey: ['revenue', dateRange.rangeKey, dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = dateRange.getApiParams()
      const response = await analyticsApi.getRevenueData({ ...params, granularity: 'monthly' })
      return response
    }
  })

  // Fetch campaign performance
  const { data: campaignData = [], isLoading: campaignLoading } = useQuery({
    queryKey: ['campaigns', dateRange.rangeKey, dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = dateRange.getApiParams()
      const response = await analyticsApi.getCampaignPerformance({ ...params, limit: 5, sort: 'revenue:desc' })
      return response
    }
  })

  // Fetch audience data
  const { data: audienceData = [], isLoading: audienceLoading } = useQuery({
    queryKey: ['audience', 'category'],
    queryFn: async () => {
      const response = await analyticsApi.getAudienceData({ type: 'category' })
      return response
    }
  })

  // Fetch audience insights
  const { data: audienceInsights, isLoading: insightsLoading } = useQuery({
    queryKey: ['audience', 'insights', dateRange.rangeKey, dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = dateRange.getApiParams()
      const response = await analyticsApi.getAudienceInsights(params)
      return response
    }
  })

  // Fetch KPIs
  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['kpis', dateRange.rangeKey, dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = dateRange.getApiParams()
      const response = await analyticsApi.getKPIs(params.timeRange, params.startDate, params.endDate)
      return response
    }
  })

  const isLoading = revenueLoading || campaignLoading || audienceLoading || kpiLoading || insightsLoading

  const handleScheduleReport = () => {
    alert('Report scheduling feature coming soon! You will be able to set up automated reports.')
  }

  const handleExport = async (format: string, settings: any) => {
    try {
      if (format === 'pdf') {
        const exporter = new PDFExporter({
          title: 'PodcastFlow Pro Analytics Report',
          subtitle: `${dateRange.getLabel()} - Generated on ${new Date().toLocaleDateString()}`,
          orientation: settings.orientation || 'landscape'
        })

        // Add executive summary with KPIs
        if (settings.includeSummary && kpiData) {
          exporter.addSummarySection([
            { label: 'Total Revenue', value: `$${(kpiData.totalRevenue || 0).toLocaleString()}` },
            { label: 'Total Impressions', value: (kpiData.totalImpressions || 0).toLocaleString() },
            { label: 'Average CTR', value: `${(kpiData.averageCTR || 0).toFixed(2)}%` },
            { label: 'Conversion Rate', value: `${(kpiData.conversionRate || 0).toFixed(2)}%` },
            { label: 'Active Campaigns', value: (kpiData.activeCampaigns || 0).toString() },
            { label: 'Revenue Growth', value: `${(kpiData.revenueGrowth || 0).toFixed(1)}%` },
            { label: 'Unique Listeners', value: (kpiData.uniqueListeners || 0).toLocaleString() },
            { label: 'Impression Growth', value: `${(kpiData.impressionGrowth || 0).toFixed(1)}%` }
          ])
        }

        if (settings.includeCharts) {
          // Revenue trend chart
          const revenueChart = await createChartCanvas(revenueData, 'line', {
            title: 'Revenue Trend vs Target'
          })
          await exporter.addChart(revenueChart, 'Revenue Trend vs Target')

          // Category distribution pie chart
          const categoryChart = await createChartCanvas(audienceData, 'pie', {
            title: 'Revenue Distribution by Category'
          })
          await exporter.addChart(categoryChart, 'Revenue Distribution by Category')

          // Campaign performance bar chart
          const campaignChart = await createChartCanvas(campaignData, 'bar', {
            title: 'Campaign Performance Comparison'
          })
          await exporter.addChart(campaignChart, 'Campaign Performance Comparison')

          // Add revenue vs target comparison if we have data
          if (revenueData.length > 0) {
            exporter.addNewPage()
            const performanceComparison = await createChartCanvas(revenueData, 'bar', {
              title: 'Revenue Performance vs Target'
            })
            await exporter.addChart(performanceComparison, 'Revenue Performance vs Target')
          }
        }

        if (settings.includeRawData) {
          // Top performing campaigns table
          exporter.addSection('Top Performing Campaigns')
          exporter.addTable(
            ['Campaign', 'Advertiser', 'Impressions', 'Clicks', 'CTR', 'Revenue', 'ROI'],
            campaignData.map(campaign => [
              campaign.name,
              campaign.advertiser || 'Unknown',
              (campaign.impressions || 0).toLocaleString(),
              (campaign.clicks || 0).toLocaleString(),
              `${(campaign.ctr || 0).toFixed(2)}%`,
              `$${(campaign.revenue || 0).toLocaleString()}`,
              `${(campaign.roi || 0).toFixed(0)}%`
            ])
          )

          // Monthly revenue breakdown
          exporter.addSection('Monthly Revenue Analysis')
          exporter.addTable(
            ['Month', 'Revenue', 'Target', 'Variance', 'Growth'],
            revenueData.map((d, index) => [
              d.month,
              `$${(d.revenue || 0).toLocaleString()}`,
              `$${(d.target || 0).toLocaleString()}`,
              `$${((d.revenue || 0) - (d.target || 0)).toLocaleString()}`,
              index > 0 ? `${((d.revenue - revenueData[index - 1].revenue) / revenueData[index - 1].revenue * 100).toFixed(1)}%` : 'N/A'
            ])
          )
        }

        exporter.save(`analytics-report-${dateRange.rangeKey}-${new Date().toISOString().split('T')[0]}.pdf`)
      }
      else if (format === 'csv') {
        const csvData = [
          ['Analytics Report', new Date().toLocaleDateString(), dateRange.getLabel()],
          [],
          ['Key Performance Indicators'],
          ['Metric', 'Value', 'Change', 'Period'],
          ['Total Revenue', `$${kpiData?.totalRevenue?.toLocaleString() || 0}`, `${kpiData?.revenueGrowth?.toFixed(1) || 0}%`, dateRange.getLabel()],
          ['Total Impressions', kpiData?.totalImpressions?.toLocaleString() || '0', `${kpiData?.impressionGrowth?.toFixed(1) || 0}%`, dateRange.getLabel()],
          ['Average CTR', `${kpiData?.averageCTR?.toFixed(2) || 0}%`, 'N/A', dateRange.getLabel()],
          ['Conversion Rate', `${kpiData?.conversionRate?.toFixed(2) || 0}%`, 'N/A', dateRange.getLabel()],
          ['Active Campaigns', kpiData?.activeCampaigns?.toString() || '0', `${kpiData?.campaignGrowth?.toFixed(0) || 0}`, dateRange.getLabel()],
          [],
          ['Top Performing Shows'],
          ['Campaign Name', 'Revenue', 'Impressions'],
          ...campaignData.map(campaign => [
            campaign.name,
            `$${(campaign.revenue || 0).toLocaleString()}`,
            (campaign.impressions || 0).toLocaleString()
          ]),
          [],
          ['Revenue by Category'],
          ['Category', 'Percentage'],
          ...audienceData.map(cat => [cat.name, `${cat.value}%`]),
          [],
          ['Monthly Revenue Data'],
          ['Month', 'Actual', 'Target', 'Variance'],
          ...revenueData.map(d => [
            d.month,
            `$${(d.revenue || 0).toLocaleString()}`,
            `$${(d.target || 0).toLocaleString()}`,
            `$${((d.revenue || 0) - (d.target || 0)).toLocaleString()}`
          ])
        ]
        
        exportToCSV(csvData, `analytics-report-${dateRange.rangeKey}-${new Date().toISOString().split('T')[0]}.csv`)
      }
      else if (format === 'json') {
        const jsonData = {
          generatedAt: new Date().toISOString(),
          period: dateRange.getLabel(),
          kpis: kpiData ? {
            totalRevenue: kpiData.totalRevenue,
            totalImpressions: kpiData.totalImpressions,
            averageCTR: kpiData.averageCTR,
            conversionRate: kpiData.conversionRate,
            activeCampaigns: kpiData.activeCampaigns,
            averageROI: 0 // Calculate from actual data if needed
          } : {},
          campaignData,
          audienceData,
          revenueData,
          topCampaigns: campaignData.slice(0, 3).map(campaign => ({
            campaign: campaign.name,
            advertiser: campaign.advertiser || 'Unknown',
            impressions: campaign.impressions,
            clicks: campaign.clicks || 0,
            ctr: campaign.ctr || 0,
            revenue: campaign.revenue,
            roi: campaign.roi || 0
          }))
        }
        
        exportToJSON(jsonData, `analytics-report-${dateRange.rangeKey}-${new Date().toISOString().split('T')[0]}.json`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      throw error
    }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.REPORTS_VIEW}>
      <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
              Reports Dashboard
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body1" color="text.secondary">
                Comprehensive insights into your podcast advertising performance
              </Typography>
              <Tooltip title="Revenue shown here is for the selected time period only. For all-time revenue, see the Billing page.">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<Schedule />} onClick={handleScheduleReport}>
              Schedule Report
            </Button>
            <Button variant="contained" startIcon={<Download />} onClick={() => setExportModalOpen(true)}>
              Export
            </Button>
          </Box>
        </Box>

        {/* Date Range Indicator */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" color="text.primary">
            Key Performance Metrics
          </Typography>
          <Chip
            label={`Period: ${dateRange.getLabel()}`}
            variant="outlined"
            color="primary"
            size="medium"
            sx={{ fontWeight: 500 }}
          />
          {/* Show notice if data sources are unavailable */}
          {kpiData?.sourcesUnavailable && kpiData.sourcesUnavailable.length > 0 && (
            <Alert severity="info" sx={{ flexGrow: 1, py: 0, ml: 2 }}>
              <Typography variant="caption">
                Limited data available - {kpiData.sourcesUnavailable.join(', ')} integration not connected
              </Typography>
            </Alert>
          )}
        </Box>

        {/* Quick Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Revenue
                    </Typography>
                    <Typography variant="h5">
                      ${isLoading ? '...' : (kpiData?.totalRevenue || 0).toLocaleString('en-US', { 
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                        notation: kpiData?.totalRevenue >= 1000000 ? 'compact' : 'standard',
                        compactDisplay: 'short'
                      })}
                    </Typography>
                    <Chip
                      label={`${kpiData?.revenueGrowth >= 0 ? '+' : ''}${(kpiData?.revenueGrowth || 0).toFixed(1)}% vs last period`}
                      size="small"
                      color={kpiData?.revenueGrowth >= 0 ? "success" : "error"}
                      icon={<TrendingUp />}
                    />
                  </Box>
                  <Assessment color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Impressions
                    </Typography>
                    <Typography variant="h5">
                      {isLoading ? '...' : (kpiData?.totalImpressions || 0).toLocaleString('en-US', { 
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                        notation: kpiData?.totalImpressions >= 1000000 ? 'compact' : 'standard',
                        compactDisplay: 'short'
                      })}
                    </Typography>
                    <Chip
                      label={`${kpiData?.impressionGrowth >= 0 ? '+' : ''}${(kpiData?.impressionGrowth || 0).toFixed(1)}% vs last period`}
                      size="small"
                      color={kpiData?.impressionGrowth >= 0 ? "success" : "error"}
                      icon={<TrendingUp />}
                    />
                  </Box>
                  <BarChart color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Avg CTR
                    </Typography>
                    <Typography variant="h5">
                      {isLoading ? '...' : `${(kpiData?.averageCTR || 0).toFixed(2)}%`}
                    </Typography>
                    <Chip
                      label={`CVR: ${(kpiData?.conversionRate || 0).toFixed(2)}%`}
                      size="small"
                      color="info"
                      icon={<ShowChart />}
                    />
                  </Box>
                  <ShowChart color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Active Campaigns
                    </Typography>
                    <Typography variant="h5">
                      {isLoading ? '...' : kpiData?.activeCampaigns || 0}
                    </Typography>
                    <Chip
                      label={`${kpiData?.campaignGrowth >= 0 ? '+' : ''}${(kpiData?.campaignGrowth || 0).toFixed(0)}% vs last period`}
                      size="small"
                      color={kpiData?.campaignGrowth >= 0 ? "success" : "error"}
                    />
                  </Box>
                  <PieChart color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Report Controls */}
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={selectedTab} onChange={(e, value) => setSelectedTab(value)}>
              <Tab label="Revenue" />
              <Tab label="Performance" />
              <Tab label="Audience" />
              <Tab label="Campaigns" />
              <Tab label="Custom Reports" />
            </Tabs>
          </Box>
          <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <DateRangeSelector
              value={dateRange.rangeKey}
              onChange={(value) => dateRange.setRange(value as any)}
              customStartDate={dateRange.customStart}
              customEndDate={dateRange.customEnd}
              onCustomDateChange={(start, end) => {
                if (start && end) {
                  dateRange.setRange('custom', { start, end })
                }
              }}
            />
            <Box sx={{ flexGrow: 1 }} />
          </Box>
        </Paper>

        {/* Loading State */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Tab Content */}
        {!isLoading && (
          <>
            {/* Revenue Tab */}
            {selectedTab === 0 && (
              <Grid container spacing={3}>
                <Grid item xs={12} lg={8}>
                  <Paper sx={{ p: 3, height: 400 }}>
                    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                        Revenue Trend
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <ChartContainer height={320}>
                          <LineChart data={revenueData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Actual Revenue" />
                            <Line type="monotone" dataKey="target" stroke="#82ca9d" name="Target" strokeDasharray="5 5" />
                          </LineChart>
                        </ChartContainer>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} lg={4}>
                  <Paper sx={{ p: 3, height: 400 }}>
                    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                        Revenue by Category
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <ChartContainer height={340}>
                          <RechartsPieChart>
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
                          </RechartsPieChart>
                        </ChartContainer>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* Performance Tab */}
            {selectedTab === 1 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Campaign Performance Metrics
                    </Typography>
                    <ChartContainer height={300}>
                      <RechartsBarChart data={campaignData} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Revenue ($)" />
                        <Bar yAxisId="right" dataKey="impressions" fill="#82ca9d" name="Impressions" />
                      </RechartsBarChart>
                    </ChartContainer>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* Audience Tab */}
            {selectedTab === 2 && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, height: 400 }}>
                    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                        Audience Demographics
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        {audienceData && audienceData.length > 0 ? (
                          <ChartContainer height={340}>
                            <RechartsPieChart>
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
                          </RechartsPieChart>
                        </ChartContainer>
                      ) : (
                        <Box sx={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          height: '100%',
                          color: 'text.secondary'
                        }}>
                          <PieChart sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No Demographic Data Available
                          </Typography>
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 300 }}>
                            Connect your podcast analytics platform (Spotify, Apple Podcasts, etc.) to see listener demographics
                          </Typography>
                        </Box>
                      )}
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, height: 400, overflow: 'auto' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ color: 'text.primary' }}>
                        Audience Insights
                      </Typography>
                      {audienceInsights?.meta?.attribution && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {audienceInsights.meta.attribution.youtube && (
                            <Chip label="YouTube" size="small" color="error" variant="outlined" />
                          )}
                          {audienceInsights.meta.attribution.megaphone && (
                            <Chip label="Megaphone" size="small" color="primary" variant="outlined" />
                          )}
                        </Box>
                      )}
                    </Box>
                    
                    {insightsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                      </Box>
                    ) : audienceInsights ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Engagement Metrics */}
                        <Box>
                          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                            Engagement
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Chip 
                              label={`${audienceInsights.avgListeningDuration} avg listen`}
                              size="small"
                              variant="outlined"
                            />
                            <Chip 
                              label={`${audienceInsights.completionRate}% completion`}
                              size="small"
                              variant="outlined"
                              color={audienceInsights.completionRate > 70 ? 'success' : 'warning'}
                            />
                          </Box>
                        </Box>

                        {/* Top Categories with Real Audience Data */}
                        {audienceInsights.categoryDistribution && audienceInsights.categoryDistribution.length > 0 ? (
                          <Box>
                            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                              Top Content Categories (by Audience)
                            </Typography>
                            {audienceInsights.categoryDistribution.slice(0, 3).map((cat: any, index: number) => (
                              <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                <Typography variant="body2">{cat.category}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" color="text.secondary">{cat.percent.toFixed(1)}%</Typography>
                                  <Tooltip title={`Views: ${(cat.views || 0).toLocaleString()}, Downloads: ${(cat.downloads || 0).toLocaleString()}`}>
                                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />
                                  </Tooltip>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        ) : audienceInsights.topCategories && audienceInsights.topCategories.length > 0 ? (
                          <Box>
                            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                              Top Content Categories
                            </Typography>
                            {audienceInsights.topCategories.slice(0, 3).map((cat: any, index: number) => (
                              <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                <Typography variant="body2">{cat.category}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" color="text.secondary">{cat.percentage || cat.percent}%</Typography>
                                  <Chip 
                                    label={cat.trend === 'up' ? '↗' : cat.trend === 'down' ? '↘' : '→'}
                                    size="small"
                                    color={cat.trend === 'up' ? 'success' : cat.trend === 'down' ? 'error' : 'default'}
                                    sx={{ minWidth: 'auto', width: 24, height: 20 }}
                                  />
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        ) : null}

                        {/* Listening Behavior */}
                        <Box>
                          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                            Listening Behavior
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                            <Chip 
                              label={`${audienceInsights.bingeBehavior}% binge listeners`}
                              size="small"
                              variant="outlined"
                            />
                            <Chip 
                              label={`${audienceInsights.returnListenerRate}% return rate`}
                              size="small"
                              variant="outlined"
                              color="success"
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            Preferred episode length: {audienceInsights.preferredEpisodeLength}
                          </Typography>
                        </Box>

                        {/* Top Markets with Real Geo Data */}
                        <Box>
                          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                            Top Markets
                          </Typography>
                          {audienceInsights.topMarkets && audienceInsights.topMarkets.length > 0 ? (
                            audienceInsights.topMarkets.slice(0, 3).map((market: any, index: number) => (
                              <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                <Typography variant="body2">{market.marketName || market.market}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    {(market.percent || market.share || 0).toFixed(1)}%
                                  </Typography>
                                  {(market.youtubeViews !== undefined || market.podcastDownloads !== undefined) && (
                                    <Tooltip title={`YouTube: ${(market.youtubeViews || 0).toLocaleString()}, Podcast: ${(market.podcastDownloads || 0).toLocaleString()}`}>
                                      <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />
                                    </Tooltip>
                                  )}
                                </Box>
                              </Box>
                            ))
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No market data available
                            </Typography>
                          )}
                        </Box>

                        {/* Device Breakdown */}
                        <Box>
                          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                            Listening Devices
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {audienceInsights.listeningDevices?.slice(0, 3).map((device: any, index: number) => (
                              <Chip 
                                key={index}
                                label={`${device.device} ${device.percentage}%`}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </Box>

                        {/* Content Velocity */}
                        {audienceInsights.contentVelocity && (
                          <Box>
                            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                              Content Velocity
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip 
                                label={`${(audienceInsights.contentVelocity?.kpi7d || 0).toLocaleString()} avg 7-day audience`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                              <Tooltip title="Average audience accumulation in first 7 days per episode">
                                <InfoOutlined sx={{ fontSize: 16, color: 'text.secondary', ml: 1 }} />
                              </Tooltip>
                            </Box>
                          </Box>
                        )}

                        {/* Growth Metrics - Show only if available */}
                        {(audienceInsights.subscriberGrowth > 0 || audienceInsights.churnRisk) && (
                          <Box>
                            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                              Growth & Risk
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {audienceInsights.subscriberGrowth > 0 && (
                                <Chip 
                                  label={`+${audienceInsights.subscriberGrowth}% subscriber growth`}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                              )}
                              {audienceInsights.churnRisk && audienceInsights.churnRisk !== 'Unknown' && (
                                <Chip 
                                  label={`${audienceInsights.churnRisk} churn risk`}
                                  size="small"
                                  color={audienceInsights.churnRisk === 'Low' ? 'success' : audienceInsights.churnRisk === 'High' ? 'error' : 'warning'}
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {audienceInsights?.meta?.message || 'No audience insights available for the selected period.'}
                        </Typography>
                        {audienceInsights?.meta?.message?.includes('Connect') && (
                          <Typography variant="caption" color="text.secondary">
                            Connect your YouTube channel or Megaphone account to see real audience analytics.
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Paper>
                </Grid>
                
                {/* Additional Audience Analytics Row */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, height: 300 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Peak Listening Times
                    </Typography>
                    {audienceInsights?.topListeningTimes ? (
                      <ChartContainer height={220}>
                        <RechartsBarChart data={audienceInsights.topListeningTimes} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" />
                          <YAxis />
                          <RechartsTooltip />
                          <Bar dataKey="percentage" fill="#8884d8" name="Audience %" />
                        </RechartsBarChart>
                      </ChartContainer>
                    ) : (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                        <CircularProgress />
                      </Box>
                    )}
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, height: 300 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Top Performing Shows
                    </Typography>
                    {audienceInsights?.topShows ? (
                      <Box sx={{ mt: 2 }}>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Show</TableCell>
                                <TableCell align="right">Listeners</TableCell>
                                <TableCell align="right">Growth</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {audienceInsights.topShows.slice(0, 5).map((show: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell>{show.show || 'Unknown'}</TableCell>
                                  <TableCell align="right">{(show.listeners || 0).toLocaleString()}</TableCell>
                                  <TableCell align="right">
                                    <Chip
                                      label={`${(show.growth || 0) > 0 ? '+' : ''}${show.growth || 0}%`}
                                      size="small"
                                      color={(show.growth || 0) > 0 ? 'success' : (show.growth || 0) < 0 ? 'error' : 'default'}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                        <CircularProgress />
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* Campaigns Tab */}
            {selectedTab === 3 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                      Campaign Performance Summary
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Campaign</TableCell>
                            <TableCell>Advertiser</TableCell>
                            <TableCell align="right">Impressions</TableCell>
                            <TableCell align="right">Clicks</TableCell>
                            <TableCell align="right">CTR</TableCell>
                            <TableCell align="right">Revenue</TableCell>
                            <TableCell align="right">ROI</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {campaignData.length > 0 ? campaignData.map((row, index) => (
                            <TableRow key={index}>
                              <TableCell>{row.name}</TableCell>
                              <TableCell>{row.advertiser || 'Unknown'}</TableCell>
                              <TableCell align="right">{(row.impressions || 0).toLocaleString()}</TableCell>
                              <TableCell align="right">{(row.clicks || 0).toLocaleString()}</TableCell>
                              <TableCell align="right">{(row.ctr || 0).toFixed(2)}%</TableCell>
                              <TableCell align="right">${(row.revenue || 0).toLocaleString()}</TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={`${row.roi?.toFixed(0) || 0}%`}
                                  size="small"
                                  color={row.roi > 300 ? 'success' : row.roi > 100 ? 'primary' : 'default'}
                                />
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow>
                              <TableCell colSpan={7} align="center">
                                No campaigns found for the selected period
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* Custom Reports Tab */}
            {selectedTab === 4 && (
              <CustomReportBuilder />
            )}
          </>
        )}
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
