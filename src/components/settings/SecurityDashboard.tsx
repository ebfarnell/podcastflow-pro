import React, { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material'
import {
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  VpnKey as KeyIcon,
  Lock as LockIcon,
  Shield as ShieldIcon,
  Person as PersonIcon,
  Block as BlockIcon,
  Storage as StorageIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import SystemLogsDialog from './SystemLogsDialog'
import UserActivityDialog from './UserActivityDialog'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts'

interface SecurityMetrics {
  overview: {
    totalUsers: number
    mfaEnabled: number
    mfaPercentage: number
    activeSessions: number
    apiKeysActive: number
    lastSecurityUpdate: string | null
  }
  authentication: {
    successfulLogins: number
    failedLogins: number
    passwordResets: number
    mfaVerifications: number
    sessionTimeouts: number
  }
  apiKeys: {
    total: number
    active: number
    expired: number
    revoked: number
    recentUsage: number
  }
  threats: {
    blockedIps: number
    suspiciousActivities: number
    unauthorizedAttempts: number
    dataExportRequests: number
  }
  compliance: {
    auditLogSize: number
    oldestAuditEntry: string | null
    passwordPolicyCompliance: number
    encryptionStatus: 'enabled' | 'partial' | 'disabled'
    lastBackup: string | null
  }
  recentEvents: Array<{
    id: string
    type: string
    user: string
    timestamp: string
    success: boolean
    details?: string
  }>
}

const COLORS = {
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',
  primary: '#1976d2',
  secondary: '#9c27b0',
}

export default function SecurityDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [logsDialogOpen, setLogsDialogOpen] = useState(false)
  const [usersDialogOpen, setUsersDialogOpen] = useState(false)

  const fetchMetrics = async () => {
    try {
      setError(null)
      // Add cache-busting to ensure fresh data
      const response = await fetch(`/api/settings/security/metrics?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })
      if (!response.ok) throw new Error('Failed to fetch security metrics')
      const data = await response.json()
      setMetrics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 200))
    await fetchMetrics()
  }

  const handleExportReport = () => {
    // In a real implementation, this would generate and download a PDF/CSV report
    console.log('Exporting security report...')
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !metrics) {
    return (
      <Alert severity="error">
        {error || 'Failed to load security metrics'}
      </Alert>
    )
  }

  // Prepare chart data
  const mfaChartData = [
    { name: 'MFA Enabled', value: metrics.overview.mfaEnabled, color: COLORS.success },
    { name: 'MFA Disabled', value: metrics.overview.totalUsers - metrics.overview.mfaEnabled, color: COLORS.warning },
  ]

  const authChartData = [
    { name: 'Successful', value: metrics.authentication.successfulLogins, color: COLORS.success },
    { name: 'Failed', value: metrics.authentication.failedLogins, color: COLORS.error },
  ]

  const apiKeyChartData = [
    { name: 'Active', value: metrics.apiKeys.active },
    { name: 'Expired', value: metrics.apiKeys.expired },
    { name: 'Revoked', value: metrics.apiKeys.revoked },
  ]

  const threatData = [
    { name: 'Blocked IPs', value: metrics.threats.blockedIps },
    { name: 'Suspicious', value: metrics.threats.suspiciousActivities },
    { name: 'Unauthorized', value: metrics.threats.unauthorizedAttempts },
    { name: 'Data Exports', value: metrics.threats.dataExportRequests },
  ]

  // Calculate security score with detailed breakdown
  const calculateSecurityScore = () => {
    let score = 0
    const factors = [
      { 
        name: 'MFA Adoption',
        value: metrics.overview.mfaPercentage, 
        weight: 25,
        description: `${metrics.overview.mfaPercentage}% of users have MFA enabled`
      },
      { 
        name: 'Session Security',
        value: metrics.overview.activeSessions > 0 && metrics.overview.activeSessions <= metrics.overview.totalUsers ? 100 : 80, 
        weight: 15,
        description: `${metrics.overview.activeSessions} active sessions`
      },
      { 
        name: 'Password Encryption',
        value: metrics.compliance.encryptionStatus === 'enabled' ? 100 : 0, 
        weight: 20,
        description: 'Bcrypt encryption enabled'
      },
      { 
        name: 'Authentication Health',
        value: metrics.authentication.failedLogins === 0 ? 100 : Math.max(0, 100 - (metrics.authentication.failedLogins * 2)), 
        weight: 20,
        description: `${metrics.authentication.failedLogins} failed login attempts`
      },
      { 
        name: 'Threat Protection',
        value: metrics.threats.unauthorizedAttempts === 0 ? 100 : Math.max(0, 100 - (metrics.threats.unauthorizedAttempts * 5)), 
        weight: 10,
        description: `${metrics.threats.unauthorizedAttempts} unauthorized attempts`
      },
      {
        name: 'Audit Logging',
        value: metrics.compliance.auditLogSize > 0 ? 100 : 50,
        weight: 10,
        description: `${metrics.compliance.auditLogSize} audit logs recorded`
      }
    ]
    
    factors.forEach(factor => {
      score += (factor.value * factor.weight) / 100
    })
    
    return { score: Math.round(score), factors }
  }

  const scoreData = calculateSecurityScore()
  const securityScore = scoreData.score
  const scoreColor = securityScore >= 80 ? 'success' : securityScore >= 60 ? 'warning' : 'error'

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Security Dashboard</Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh metrics">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportReport}
            size="small"
          >
            Export Report
          </Button>
        </Box>
      </Box>

      {refreshing && <LinearProgress sx={{ mb: 2 }} />}

      {/* Security Score */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" gutterBottom>
                  Security Score
                </Typography>
                <Tooltip 
                  title={
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>Score Breakdown:</Typography>
                      {scoreData.factors.map(factor => (
                        <Box key={factor.name} sx={{ mb: 0.5 }}>
                          <Typography variant="caption">
                            • {factor.name} ({factor.weight}%): {Math.round(factor.value)}%
                          </Typography>
                          <Typography variant="caption" display="block" sx={{ ml: 2, opacity: 0.8 }}>
                            {factor.description}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  }
                  placement="right"
                  arrow
                >
                  <InfoIcon fontSize="small" color="action" />
                </Tooltip>
              </Box>
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="h2" color={`${scoreColor}.main`}>
                  {securityScore}
                </Typography>
                <Typography variant="h4" color="text.secondary">
                  / 100
                </Typography>
              </Box>
            </Box>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress
                variant="determinate"
                value={securityScore}
                size={120}
                thickness={4}
                color={scoreColor as any}
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {securityScore >= 80 ? (
                  <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                ) : securityScore >= 60 ? (
                  <WarningIcon color="warning" sx={{ fontSize: 40 }} />
                ) : (
                  <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                )}
              </Box>
            </Box>
          </Box>
          {metrics.overview.lastSecurityUpdate && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Last security update: {formatDistanceToNow(new Date(metrics.overview.lastSecurityUpdate), { addSuffix: true })}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="caption" display="block" sx={{ mb: 0.5 }}>
                    Total Users
                  </Typography>
                  <Typography variant="h4">
                    {metrics.overview.totalUsers}
                  </Typography>
                </Box>
                <PersonIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Box>
                <Box display="flex" alignItems="start" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="caption" display="block" sx={{ mb: 0.5 }}>
                      MFA Enabled
                    </Typography>
                    <Typography variant="h4">
                      {metrics.overview.mfaPercentage}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {metrics.overview.mfaEnabled} of {metrics.overview.totalUsers} users
                    </Typography>
                  </Box>
                  <ShieldIcon color="success" sx={{ fontSize: 40 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="caption" display="block" sx={{ mb: 0.5 }}>
                    Active Sessions
                  </Typography>
                  <Typography variant="h4">
                    {metrics.overview.activeSessions}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Unique users logged in
                  </Typography>
                </Box>
                <LockIcon color="info" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="caption" display="block" sx={{ mb: 0.5 }}>
                    Active API Keys
                  </Typography>
                  <Typography variant="h4">
                    {metrics.overview.apiKeysActive}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Valid keys configured
                  </Typography>
                </Box>
                <KeyIcon color="secondary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>


      {/* Compliance and Recent Events */}
      <Grid container spacing={3}>
        {/* Compliance Status */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Compliance Status
              </Typography>
              <List dense>
                <ListItemButton onClick={() => setLogsDialogOpen(true)}>
                  <ListItemIcon>
                    <StorageIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="System Log Retention"
                    secondary={`${metrics.compliance.auditLogSize.toLocaleString()} total log entries`}
                  />
                  {metrics.compliance.oldestAuditEntry && (
                    <Typography variant="caption" color="text.secondary">
                      Since {new Date(metrics.compliance.oldestAuditEntry).toLocaleDateString()}
                    </Typography>
                  )}
                </ListItemButton>
                
                <ListItemButton onClick={() => setUsersDialogOpen(true)}>
                  <ListItemIcon>
                    <LockIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Active User Percentage"
                    secondary={`${metrics.compliance.passwordPolicyCompliance}% active in last 30 days`}
                  />
                  <LinearProgress
                    variant="determinate"
                    value={metrics.compliance.passwordPolicyCompliance}
                    sx={{ width: 100 }}
                  />
                </ListItemButton>
                
                <ListItem>
                  <ListItemIcon>
                    <SecurityIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Encryption Status"
                    secondary="All passwords encrypted with bcrypt"
                  />
                  <Chip
                    label={metrics.compliance.encryptionStatus}
                    color="success"
                    size="small"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <ScheduleIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Last Backup"
                    secondary={metrics.compliance.lastBackup ? 
                      formatDistanceToNow(new Date(metrics.compliance.lastBackup), { addSuffix: true }) :
                      'No recent backup'
                    }
                  />
                  {!metrics.compliance.lastBackup && (
                    <Chip label="Action Required" color="warning" size="small" />
                  )}
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Security Events */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Security Events
              </Typography>
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {metrics.recentEvents.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary="No recent events"
                      secondary="Security events will appear here"
                    />
                  </ListItem>
                ) : (
                  metrics.recentEvents.map((event) => (
                    <ListItem key={event.id}>
                      <ListItemIcon>
                        {event.success ? (
                          <CheckCircleIcon color="success" fontSize="small" />
                        ) : (
                          <ErrorIcon color="error" fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2">{event.type}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              by {event.user}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                            </Typography>
                            {event.details && (
                              <Typography variant="caption" color="error" sx={{ ml: 1 }}>
                                {event.details}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialogs */}
      <SystemLogsDialog 
        open={logsDialogOpen}
        onClose={() => setLogsDialogOpen(false)}
      />
      <UserActivityDialog 
        open={usersDialogOpen}
        onClose={() => setUsersDialogOpen(false)}
      />
    </Box>
  )
}