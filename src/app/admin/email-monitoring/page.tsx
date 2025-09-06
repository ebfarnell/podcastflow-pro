'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Divider,
} from '@mui/material'
import {
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

interface EmailAnalytics {
  period: string
  dateRange: {
    start: string
    end: string
  }
  overview: {
    totalNotifications: number
    emailNotifications: number
    engagementRate: number
    readNotifications: number
    unreadNotifications: number
  }
  delivery: {
    delivered: number
    bounced: number
    failed: number
    opened: number
    clicked: number
  }
  notificationsByType: Array<{
    type: string
    count: number
    percentage: number
  }>
  chartData: Array<{
    date: string
    notifications: number
    emailsSent: number
    emailsDelivered: number
    emailsOpened: number
  }>
  recentNotifications: Array<{
    id: string
    type: string
    title: string
    message: string
    read: boolean
    createdAt: string
    user: {
      id: string
      email: string
      name: string
      role: string
      organization: string
    }
  }>
  topEngagedUsers: Array<{
    user: {
      id: string
      email: string
      name: string
      role: string
      organization: {
        name: string
      }
    }
    readCount: number
  }>
  emailConfig: {
    provider: string
    region: string
    sandboxMode: boolean
    fromAddress: string
    replyToAddress: string
  }
}

export default function EmailMonitoringPage() {
  const [period, setPeriod] = useState('7d')
  const [triggerCron, setTriggerCron] = useState(false)

  const { data: analytics, isLoading, refetch } = useQuery<EmailAnalytics>({
    queryKey: ['email-analytics', period],
    queryFn: async () => {
      const response = await api.get(`/admin/email-analytics?period=${period}`)
      return response.data
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })

  const handleTriggerCron = async () => {
    setTriggerCron(true)
    try {
      await api.post('/cron/email-notifications')
      refetch()
    } catch (error) {
      console.error('Failed to trigger cron job:', error)
    } finally {
      setTriggerCron(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'success'
      case 'opened':
        return 'info'
      case 'bounced':
        return 'warning'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'user_invitation':
        return 'primary'
      case 'task_assignment':
        return 'secondary'
      case 'campaign_status_update':
        return 'info'
      case 'payment_reminder':
        return 'warning'
      case 'report_ready':
        return 'success'
      case 'system_maintenance':
        return 'error'
      default:
        return 'default'
    }
  }

  if (isLoading) {
    return (
      <RouteProtection requiredPermission={PERMISSIONS.ADMIN_ACCESS}>
        <DashboardLayout>
          <LinearProgress />
        </DashboardLayout>
      </RouteProtection>
    )
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.ADMIN_ACCESS}>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
            Email Monitoring Dashboard
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Monitor email delivery, engagement, and notification performance
          </Typography>
        </Box>

        {/* Controls */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Time Period</InputLabel>
                  <Select
                    value={period}
                    label="Time Period"
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <MenuItem value="1d">Last 24 hours</MenuItem>
                    <MenuItem value="7d">Last 7 days</MenuItem>
                    <MenuItem value="30d">Last 30 days</MenuItem>
                    <MenuItem value="90d">Last 90 days</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => refetch()}
                  fullWidth
                >
                  Refresh Data
                </Button>
              </Grid>

              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={handleTriggerCron}
                  disabled={triggerCron}
                  fullWidth
                >
                  {triggerCron ? 'Triggering...' : 'Trigger Email Check'}
                </Button>
              </Grid>

              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Period: {analytics?.dateRange.start && new Date(analytics.dateRange.start).toLocaleDateString()} - {analytics?.dateRange.end && new Date(analytics.dateRange.end).toLocaleDateString()}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Configuration Status */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Email System Configuration
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <EmailIcon color="primary" />
                  <Box>
                    <Typography variant="body1">
                      Provider: {analytics?.emailConfig.provider?.toUpperCase() || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Region: {analytics?.emailConfig.region || 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    label={analytics?.emailConfig.sandboxMode ? 'Sandbox Mode' : 'Production Mode'}
                    color={analytics?.emailConfig.sandboxMode ? 'warning' : 'success'}
                    icon={analytics?.emailConfig.sandboxMode ? <WarningIcon /> : <CheckCircleIcon />}
                  />
                  <Typography variant="body2" color="textSecondary">
                    From: {analytics?.emailConfig.fromAddress}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {analytics?.emailConfig.sandboxMode && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                SES is in sandbox mode. Only verified email addresses can receive emails.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Overview Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <EmailIcon color="primary" />
                  <Box>
                    <Typography variant="h4" color="primary">
                      {analytics?.overview.totalNotifications || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Notifications
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <SendIcon color="secondary" />
                  <Box>
                    <Typography variant="h4" color="secondary">
                      {analytics?.overview.emailNotifications || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Email Notifications
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TrendingUpIcon color="success" />
                  <Box>
                    <Typography variant="h4" color="success">
                      {analytics?.overview.engagementRate || 0}%
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Engagement Rate
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircleIcon color="info" />
                  <Box>
                    <Typography variant="h4" color="info">
                      {analytics?.delivery.delivered || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Emails Delivered
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Delivery Statistics */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Email Delivery Statistics
            </Typography>
            
            <Grid container spacing={3}>
              {analytics?.delivery && Object.entries(analytics.delivery).map(([key, value]) => (
                <Grid item xs={12} md={2.4} key={key}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" color={getStatusColor(key)}>
                      {value}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Notification Types */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Notifications by Type
                </Typography>
                
                {analytics?.notificationsByType.map((type) => (
                  <Box key={type.type} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Chip
                        label={type.type.replace('_', ' ').toUpperCase()}
                        color={getNotificationTypeColor(type.type) as any}
                        size="small"
                      />
                      <Typography variant="body2">
                        {type.count} ({type.percentage}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={type.percentage}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Top Engaged Users
                </Typography>
                
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell align="right">Read Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics?.topEngagedUsers.map((engagement) => (
                        <TableRow key={engagement.user.id}>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">
                                {engagement.user.name || engagement.user.email}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {engagement.user.organization?.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={engagement.user.role}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="primary">
                              {engagement.readCount}
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
        </Grid>

        {/* Recent Notifications */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Notifications
            </Typography>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Organization</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics?.recentNotifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <Chip
                          label={notification.type.replace('_', ' ')}
                          color={getNotificationTypeColor(notification.type) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {notification.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {notification.user.name || notification.user.email}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {notification.user.role}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {notification.user.organization}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={notification.read ? 'Read' : 'Unread'}
                          color={notification.read ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </DashboardLayout>
    </RouteProtection>
  )
}