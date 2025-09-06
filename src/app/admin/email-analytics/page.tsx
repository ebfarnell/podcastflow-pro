'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Grid,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Alert,
  Button,
  Menu,
  Divider,
  Tabs,
  Tab
} from '@mui/material'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { 
  Email as EmailIcon,
  Send as SendIcon,
  CheckCircle as DeliveredIcon,
  Visibility as OpenIcon,
  TouchApp as ClickIcon,
  Error as BounceIcon,
  Warning as ComplaintIcon,
  Block as BlockIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon
} from '@mui/icons-material'
import { format, subDays } from 'date-fns'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AllEmailsTab } from '@/components/email/AllEmailsTab'

interface EmailAnalytics {
  summary: {
    totalSent: number
    totalDelivered: number
    totalOpened: number
    totalClicked: number
    totalBounced: number
    totalComplained: number
    uniqueOpens: number
    uniqueClicks: number
    deliveryRate: number
    openRate: number
    clickRate: number
    bounceRate: number
    complaintRate: number
  }
  timeSeries: Array<{
    date: string
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
    failed: number
  }>
  templates: Array<{
    key: string
    name: string
    category: string
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
    deliveryRate: number
    openRate: number
  }>
  bounces: {
    total: number
    byType: Record<string, number>
  }
  suppression: {
    total: number
    byReason: Record<string, number>
  }
  dateRange: {
    start: string
    end: string
  }
}

const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4']

const StatCard = ({ 
  title, 
  value, 
  icon, 
  color, 
  percentage 
}: { 
  title: string
  value: number | string
  icon: React.ReactNode
  color: string
  percentage?: number
}) => (
  <Card>
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>
          {percentage !== undefined && (
            <Typography variant="body2" color={color}>
              {percentage.toFixed(1)}%
            </Typography>
          )}
        </Box>
        <Box sx={{ color, opacity: 0.3 }}>
          {icon}
        </Box>
      </Stack>
    </CardContent>
  </Card>
)

export default function EmailAnalyticsPage() {
  const [tabValue, setTabValue] = useState(0)
  const [dateRange, setDateRange] = useState(30)
  const [groupBy, setGroupBy] = useState('day')
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null)
  const [templateFilter, setTemplateFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const { data: analytics, isLoading, error } = useQuery<EmailAnalytics>({
    queryKey: ['email-analytics', dateRange, groupBy, templateFilter, categoryFilter],
    queryFn: async () => {
      const startDate = subDays(new Date(), dateRange).toISOString()
      const endDate = new Date().toISOString()
      
      const params = new URLSearchParams({
        startDate,
        endDate,
        groupBy
      })
      
      if (templateFilter !== 'all') params.append('templateKey', templateFilter)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)
      
      const response = await fetch(`/api/email/analytics?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch email analytics')
      }
      
      return response.json()
    }
  })

  // Only show loading/error for Analytics Overview tab
  const showAnalyticsLoading = tabValue === 0 && isLoading
  const showAnalyticsError = tabValue === 0 && error
  const showAnalyticsContent = tabValue === 0 && analytics

  const { summary, timeSeries, templates, bounces, suppression } = analytics || {
    summary: {},
    timeSeries: [],
    templates: [],
    bounces: { total: 0, byType: {} },
    suppression: { total: 0, byReason: {} }
  }
  
  // Get unique template categories for filter
  const categories = [...new Set(templates.map((t: any) => t.category))].filter(Boolean).sort()

  return (
    <DashboardLayout>
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Email Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor email performance and deliverability
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Analytics Overview" />
            <Tab label="All Emails" />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        {tabValue === 0 && (
          <Box>
            {showAnalyticsLoading && <LinearProgress />}
            {showAnalyticsError && (
              <Alert severity="error">
                Failed to load email analytics. Please try again later.
              </Alert>
            )}
            {showAnalyticsContent && (
              <>

        {/* Controls */}
        <Stack direction="row" spacing={2} sx={{ mb: 3, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              label="Date Range"
              onChange={(e) => setDateRange(Number(e.target.value))}
            >
              <MenuItem value={7}>Last 7 days</MenuItem>
              <MenuItem value={30}>Last 30 days</MenuItem>
              <MenuItem value={90}>Last 90 days</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Group By</InputLabel>
            <Select
              value={groupBy}
              label="Group By"
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <MenuItem value="day">Day</MenuItem>
              <MenuItem value="week">Week</MenuItem>
              <MenuItem value="month">Month</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              label="Category"
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          </Stack>
          
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={(e) => setExportAnchorEl(e.currentTarget)}
          >
            Export
          </Button>
        </Stack>
        
        {/* Export Menu */}
        <Menu
          anchorEl={exportAnchorEl}
          open={Boolean(exportAnchorEl)}
          onClose={() => setExportAnchorEl(null)}
        >
          <MenuItem onClick={() => handleExport('csv', 'summary')}>
            <CsvIcon sx={{ mr: 1 }} /> Export Summary as CSV
          </MenuItem>
          <MenuItem onClick={() => handleExport('csv', 'timeseries')}>
            <CsvIcon sx={{ mr: 1 }} /> Export Time Series as CSV
          </MenuItem>
          <MenuItem onClick={() => handleExport('csv', 'templates')}>
            <CsvIcon sx={{ mr: 1 }} /> Export Template Stats as CSV
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleExport('pdf', 'report')}>
            <PdfIcon sx={{ mr: 1 }} /> Generate PDF Report
          </MenuItem>
        </Menu>

        {/* Summary Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Emails Sent"
              value={summary.totalSent}
              icon={<SendIcon sx={{ fontSize: 40 }} />}
              color="#2196F3"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Delivered"
              value={summary.totalDelivered}
              icon={<DeliveredIcon sx={{ fontSize: 40 }} />}
              color="#4CAF50"
              percentage={summary.deliveryRate}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Opened"
              value={summary.totalOpened}
              icon={<OpenIcon sx={{ fontSize: 40 }} />}
              color="#FF9800"
              percentage={summary.openRate}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Clicked"
              value={summary.totalClicked}
              icon={<ClickIcon sx={{ fontSize: 40 }} />}
              color="#9C27B0"
              percentage={summary.clickRate}
            />
          </Grid>
        </Grid>

        {/* Time Series Chart */}
        <Card sx={{ mb: 4 }}>
          <CardHeader title="Email Activity Over Time" />
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke="#2196F3" name="Sent" />
                <Line type="monotone" dataKey="delivered" stroke="#4CAF50" name="Delivered" />
                <Line type="monotone" dataKey="opened" stroke="#FF9800" name="Opened" />
                <Line type="monotone" dataKey="clicked" stroke="#9C27B0" name="Clicked" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          {/* Template Performance */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardHeader title="Template Performance" />
              <CardContent>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Template</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Sent</TableCell>
                        <TableCell align="right">Delivery Rate</TableCell>
                        <TableCell align="right">Open Rate</TableCell>
                        <TableCell align="right">Bounces</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {templates.slice(0, 10).map((template) => (
                        <TableRow key={template.key}>
                          <TableCell>{template.name}</TableCell>
                          <TableCell>
                            <Chip 
                              label={template.category} 
                              size="small" 
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">{template.sent.toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={template.deliveryRate > 95 ? 'success.main' : 'text.secondary'}
                            >
                              {template.deliveryRate.toFixed(1)}%
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={template.openRate > 20 ? 'success.main' : 'text.secondary'}
                            >
                              {template.openRate.toFixed(1)}%
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={template.bounced > 0 ? 'error.main' : 'text.secondary'}
                            >
                              {template.bounced}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Bounce & Suppression Stats */}
          <Grid item xs={12} lg={4}>
            <Stack spacing={3}>
              {/* Bounce Types */}
              <Card>
                <CardHeader title="Bounce Types" />
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={Object.entries(bounces.byType).map(([type, count]) => ({
                          name: type,
                          value: count
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {Object.entries(bounces.byType).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <Typography variant="body2" color="textSecondary" align="center">
                    Total Bounces: {bounces.total}
                  </Typography>
                </CardContent>
              </Card>

              {/* Suppression List */}
              <Card>
                <CardHeader title="Suppression List" />
                <CardContent>
                  <Stack spacing={2}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">Total Suppressed</Typography>
                      <Typography variant="h6">{suppression.total}</Typography>
                    </Box>
                    {Object.entries(suppression.byReason).map(([reason, count]) => (
                      <Box key={reason} display="flex" justifyContent="space-between">
                        <Typography variant="body2" textTransform="capitalize">
                          {reason.replace('_', ' ')}
                        </Typography>
                        <Typography variant="body2">{count}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        {/* Warnings */}
        {summary.bounceRate > 5 && (
          <Alert severity="warning" sx={{ mt: 3 }}>
            Your bounce rate ({summary.bounceRate.toFixed(1)}%) is above the recommended threshold of 5%. 
            This may impact your sender reputation.
          </Alert>
        )}
        
        {summary.complaintRate > 0.1 && (
          <Alert severity="error" sx={{ mt: 3 }}>
            Your complaint rate ({summary.complaintRate.toFixed(2)}%) is above the acceptable threshold of 0.1%. 
            Immediate action is required to maintain good sender reputation.
          </Alert>
        )}
              </>
            )}
          </Box>
        )}

        {/* All Emails Tab */}
        {tabValue === 1 && (
          <AllEmailsTab />
        )}
      </Box>
    </DashboardLayout>
  )
  
  // Export handlers
  async function handleExport(format: 'csv' | 'pdf', type: string) {
    setExportAnchorEl(null)
    
    if (!analytics) {
      alert('No data to export')
      return
    }
    
    if (format === 'csv') {
      let csvContent = ''
      let filename = ''
      
      switch (type) {
        case 'summary':
          csvContent = generateSummaryCSV(analytics.summary)
          filename = `email-analytics-summary-${new Date().toISOString().split('T')[0]}.csv`
          break
        case 'timeseries':
          csvContent = generateTimeSeriesCSV(analytics.timeSeries)
          filename = `email-analytics-timeseries-${new Date().toISOString().split('T')[0]}.csv`
          break
        case 'templates':
          csvContent = generateTemplatesCSV(analytics.templates)
          filename = `email-analytics-templates-${new Date().toISOString().split('T')[0]}.csv`
          break
      }
      
      downloadCSV(csvContent, filename)
    } else if (format === 'pdf') {
      // Generate PDF report
      try {
        const response = await fetch('/api/email/analytics/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: 'pdf',
            data: analytics,
            dateRange: { days: dateRange, groupBy }
          })
        })
        
        if (!response.ok) throw new Error('Failed to generate PDF')
        
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `email-analytics-report-${new Date().toISOString().split('T')[0]}.pdf`
        a.click()
        window.URL.revokeObjectURL(url)
      } catch (error) {
        console.error('PDF export error:', error)
        alert('Failed to generate PDF report')
      }
    }
  }
  
  function generateSummaryCSV(summary: any): string {
    const headers = ['Metric', 'Value', 'Rate (%)']
    const rows = [
      ['Total Sent', summary.totalSent, ''],
      ['Total Delivered', summary.totalDelivered, summary.deliveryRate.toFixed(2)],
      ['Total Opened', summary.totalOpened, summary.openRate.toFixed(2)],
      ['Unique Opens', summary.uniqueOpens, ''],
      ['Total Clicked', summary.totalClicked, summary.clickRate.toFixed(2)],
      ['Unique Clicks', summary.uniqueClicks, ''],
      ['Total Bounced', summary.totalBounced, summary.bounceRate.toFixed(2)],
      ['Total Complained', summary.totalComplained, summary.complaintRate.toFixed(2)]
    ]
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
  
  function generateTimeSeriesCSV(timeSeries: any[]): string {
    const headers = ['Date', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Bounced', 'Complained', 'Failed']
    const rows = timeSeries.map(row => [
      row.date,
      row.sent,
      row.delivered,
      row.opened,
      row.clicked,
      row.bounced,
      row.complained,
      row.failed
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
  
  function generateTemplatesCSV(templates: any[]): string {
    const headers = ['Template', 'Category', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Bounced', 'Complained', 'Delivery Rate (%)', 'Open Rate (%)']
    const rows = templates.map(t => [
      t.name,
      t.category,
      t.sent,
      t.delivered,
      t.opened,
      t.clicked,
      t.bounced,
      t.complained,
      t.deliveryRate.toFixed(2),
      t.openRate.toFixed(2)
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
  
  function downloadCSV(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }
}