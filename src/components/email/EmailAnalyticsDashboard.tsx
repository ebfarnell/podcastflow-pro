'use client'

import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  Email as EmailIcon,
  Send as SendIcon,
  DoneAll as DeliveredIcon,
  Visibility as OpenIcon,
  TouchApp as ClickIcon,
  Warning as BounceIcon,
  Report as ComplaintIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import api from '@/lib/api'

interface EmailAnalyticsProps {
  organizationId?: string
  dateRange?: {
    start: string
    end: string
  }
}

interface MetricCardProps {
  icon: React.ReactNode
  title: string
  value: number | string
  subtitle?: string
  color: string
  trend?: number
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, subtitle, color, trend }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        <Box
          sx={{
            backgroundColor: `${color}20`,
            borderRadius: '12px',
            p: 1.5,
            mr: 2
          }}
        >
          {React.cloneElement(icon as React.ReactElement, { sx: { color, fontSize: 28 } })}
        </Box>
        <Box flex={1}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Box display="flex" alignItems="baseline" gap={1}>
            <Typography variant="h5" fontWeight="bold">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
            {trend !== undefined && (
              <Chip
                size="small"
                icon={trend > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                label={`${trend > 0 ? '+' : ''}${trend}%`}
                color={trend > 0 ? 'success' : 'error'}
                sx={{ height: 20 }}
              />
            )}
          </Box>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
)

export default function EmailAnalyticsDashboard({ organizationId, dateRange }: EmailAnalyticsProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['email-analytics', organizationId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organizationId', organizationId)
      if (dateRange?.start) params.append('startDate', dateRange.start)
      if (dateRange?.end) params.append('endDate', dateRange.end)
      
      const response = await api.get(`/api/email/analytics?${params}`)
      return response.data
    },
    refetchInterval: 60000 // Refresh every minute
  })

  if (isLoading || !data) {
    return (
      <Box p={3}>
        <LinearProgress />
      </Box>
    )
  }

  const { summary, timeSeries, topEmails } = data

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Email Analytics</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Summary Metrics */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <MetricCard
            icon={<SendIcon />}
            title="Sent"
            value={summary.totalSent}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <MetricCard
            icon={<DeliveredIcon />}
            title="Delivered"
            value={summary.totalDelivered}
            subtitle={`${summary.deliveryRate.toFixed(1)}% rate`}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <MetricCard
            icon={<OpenIcon />}
            title="Opened"
            value={summary.totalOpened}
            subtitle={`${summary.openRate.toFixed(1)}% rate`}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <MetricCard
            icon={<ClickIcon />}
            title="Clicked"
            value={summary.totalClicked}
            subtitle={`${summary.clickRate.toFixed(1)}% rate`}
            color="#9c27b0"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <MetricCard
            icon={<BounceIcon />}
            title="Bounced"
            value={summary.totalBounced}
            subtitle={`${summary.bounceRate.toFixed(1)}% rate`}
            color="#f44336"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <MetricCard
            icon={<ComplaintIcon />}
            title="Complaints"
            value={summary.totalComplained}
            subtitle={`${summary.complaintRate.toFixed(2)}% rate`}
            color="#ff5722"
          />
        </Grid>
      </Grid>

      {/* Time Series Chart */}
      {timeSeries && timeSeries.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Email Activity Over Time
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Area type="monotone" dataKey="sent" stackId="1" stroke="#2196f3" fill="#2196f3" />
                  <Area type="monotone" dataKey="delivered" stackId="1" stroke="#4caf50" fill="#4caf50" />
                  <Area type="monotone" dataKey="opened" stackId="1" stroke="#ff9800" fill="#ff9800" />
                  <Area type="monotone" dataKey="clicked" stackId="1" stroke="#9c27b0" fill="#9c27b0" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Engagement Chart */}
      {timeSeries && timeSeries.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Engagement Rates
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries.map(item => ({
                  date: item.date,
                  openRate: item.delivered > 0 ? (item.opened / item.delivered) * 100 : 0,
                  clickRate: item.opened > 0 ? (item.clicked / item.opened) * 100 : 0,
                  bounceRate: item.sent > 0 ? (item.bounced / item.sent) * 100 : 0
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip formatter={(value: any) => `${value.toFixed(1)}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="openRate" name="Open Rate" stroke="#ff9800" />
                  <Line type="monotone" dataKey="clickRate" name="Click Rate" stroke="#9c27b0" />
                  <Line type="monotone" dataKey="bounceRate" name="Bounce Rate" stroke="#f44336" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Top Performing Emails */}
      {topEmails && topEmails.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Top Performing Emails
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Subject</TableCell>
                    <TableCell align="right">Opens</TableCell>
                    <TableCell align="right">Clicks</TableCell>
                    <TableCell align="right">Click Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topEmails.map((email, index) => (
                    <TableRow key={index}>
                      <TableCell>{email.subject}</TableCell>
                      <TableCell align="right">{email.opens}</TableCell>
                      <TableCell align="right">{email.clicks}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${email.clickRate.toFixed(1)}%`}
                          size="small"
                          color={email.clickRate > 10 ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}