'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  Grid,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Divider,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Api as ApiIcon,
  Memory as MemoryIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend } from 'recharts'
import { format, subHours, subDays } from 'date-fns'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ChartContainer } from '@/components/charts/ChartContainer'
import { useQuery } from '@tanstack/react-query'
import { monitoringApi } from '@/services/api'
import { MasterOnly } from '@/components/auth/RoleGuard'

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical'
  services: {
    name: string
    status: 'operational' | 'degraded' | 'down'
    latency: number
    errorRate: number
    uptime: number
  }[]
  lastChecked: string
}

interface Metrics {
  timestamp: string
  apiCalls: number
  avgLatency: number
  errorRate: number
  activeUsers: number
  cpuUsage: number
  memoryUsage: number
  dbConnections: number
}

interface Alert {
  id: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  service: string
  timestamp: string
  resolved: boolean
}

const CHART_COLORS = {
  primary: '#1976d2',
  secondary: '#dc004e',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3'
}

export default function MonitoringPage() {
  const [timeRange, setTimeRange] = useState('1h')
  const [autoRefresh, setAutoRefresh] = useState(false) // Default off for cost efficiency
  const [selectedService, setSelectedService] = useState('all')

  // Fetch system health
  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => monitoringApi.getSystemHealth(),
    refetchInterval: autoRefresh ? 30000 : false // Refresh every 30 seconds
  })

  // Fetch metrics
  const { data: metricsData, refetch: refetchMetrics } = useQuery({
    queryKey: ['metrics', timeRange],
    queryFn: () => monitoringApi.getMetrics({ timeRange }),
    refetchInterval: autoRefresh ? 60000 : false // Refresh every minute
  })

  // Fetch alerts
  const { data: alertsData, refetch: refetchAlerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => monitoringApi.getAlerts({ unresolved: true }),
    refetchInterval: autoRefresh ? 30000 : false
  })

  const health = healthData || {
    status: 'healthy',
    services: [],
    lastChecked: new Date().toISOString()
  }

  const metrics = metricsData?.metrics || []
  const alerts = alertsData?.alerts || []

  // Calculate summary stats
  const currentMetrics = metrics[metrics.length - 1] || {}
  const avgLatency = metrics.reduce((sum, m) => sum + (m.avgLatency || 0), 0) / metrics.length || 0
  const totalApiCalls = metrics.reduce((sum, m) => sum + (m.apiCalls || 0), 0)
  const avgErrorRate = metrics.reduce((sum, m) => sum + (m.errorRate || 0), 0) / metrics.length || 0

  const handleRefresh = () => {
    refetchHealth()
    refetchMetrics()
    refetchAlerts()
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
        return 'success'
      case 'degraded':
        return 'warning'
      case 'critical':
      case 'down':
        return 'error'
      default:
        return 'default'
    }
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
        return <CheckIcon color="success" />
      case 'degraded':
        return <WarningIcon color="warning" />
      case 'critical':
      case 'down':
        return <ErrorIcon color="error" />
      default:
        return <WarningIcon />
    }
  }

  const formatUptime = (uptime: number) => {
    return `${(uptime * 100).toFixed(2)}%`
  }

  // Prepare chart data
  const latencyChartData = metrics.map(m => ({
    time: format(new Date(m.timestamp), 'HH:mm'),
    latency: m.avgLatency
  }))

  const apiCallsChartData = metrics.map(m => ({
    time: format(new Date(m.timestamp), 'HH:mm'),
    calls: m.apiCalls,
    errors: Math.round(m.apiCalls * (m.errorRate / 100))
  }))

  const resourceChartData = metrics.map(m => ({
    time: format(new Date(m.timestamp), 'HH:mm'),
    cpu: m.cpuUsage,
    memory: m.memoryUsage
  }))

  const serviceHealthData = health.services.map(s => ({
    name: s.name,
    uptime: s.uptime * 100,
    downtime: (1 - s.uptime) * 100
  }))

  return (
    <MasterOnly>
      <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
            System Monitoring
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl variant="filled" size="small" sx={{ minWidth: 150, backgroundColor: 'white', borderRadius: 1 }}>
              <InputLabel id="time-range-label">Time Range</InputLabel>
              <Select
                labelId="time-range-label"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="1h">Last Hour</MenuItem>
                <MenuItem value="6h">Last 6 Hours</MenuItem>
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant={autoRefresh ? 'contained' : 'outlined'}
              onClick={() => setAutoRefresh(!autoRefresh)}
              size="small"
            >
              Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* System Health Overview */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    System Status
                  </Typography>
                  <Typography variant="h5">
                    {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
                  </Typography>
                </Box>
                {getHealthIcon(health.status)}
              </Box>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    API Calls
                  </Typography>
                  <Typography variant="h5">
                    {totalApiCalls.toLocaleString()}
                  </Typography>
                </Box>
                <ApiIcon color="primary" />
              </Box>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Avg Latency
                  </Typography>
                  <Typography variant="h5">
                    {avgLatency.toFixed(0)}ms
                  </Typography>
                </Box>
                <SpeedIcon color="primary" />
              </Box>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Error Rate
                  </Typography>
                  <Typography variant="h5" color={avgErrorRate > 5 ? 'error' : 'inherit'}>
                    {avgErrorRate.toFixed(2)}%
                  </Typography>
                </Box>
                {avgErrorRate > 5 ? <ErrorIcon color="error" /> : <CheckIcon color="success" />}
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Active Alerts ({alerts.length})
              </Typography>
              <List dense>
                {alerts.map((alert: Alert) => (
                  <ListItem key={alert.id}>
                    <ListItemIcon>
                      {alert.severity === 'critical' && <ErrorIcon color="error" />}
                      {alert.severity === 'error' && <ErrorIcon color="error" />}
                      {alert.severity === 'warning' && <WarningIcon color="warning" />}
                      {alert.severity === 'info' && <WarningIcon color="info" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={alert.title}
                      secondary={`${alert.service} - ${format(new Date(alert.timestamp), 'PPp')}`}
                    />
                    <Chip
                      label={alert.severity}
                      size="small"
                      color={alert.severity === 'critical' || alert.severity === 'error' ? 'error' : alert.severity as any}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Card>
        )}

        {/* Service Health */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Service Health
                </Typography>
                {health.services.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    <Typography variant="body2">
                      No services registered yet
                    </Typography>
                    <Typography variant="caption">
                      Service health data will appear once services start reporting
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {health.services.map((service) => (
                    <ListItem key={service.name}>
                      <ListItemIcon>
                        {getHealthIcon(service.status)}
                      </ListItemIcon>
                      <ListItemText
                        primary={service.name}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Typography variant="caption">
                              Latency: {service.latency}ms
                            </Typography>
                            <Typography variant="caption">
                              Errors: {service.errorRate.toFixed(2)}%
                            </Typography>
                            <Typography variant="caption">
                              Uptime: {formatUptime(service.uptime)}
                            </Typography>
                          </Box>
                        }
                      />
                      <Chip
                        label={service.status}
                        size="small"
                        color={getHealthColor(service.status) as any}
                      />
                    </ListItem>
                  ))}
                  </List>
                )}
              </Box>
            </Card>
          </Grid>

          {/* Uptime Chart */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Service Uptime
                </Typography>
                <ChartContainer height={300}>
                  <BarChart data={serviceHealthData} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <ChartTooltip />
                    <Bar dataKey="uptime" fill={CHART_COLORS.success} name="Uptime %" />
                  </BarChart>
                </ChartContainer>
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Performance Charts */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  API Latency
                </Typography>
                {metrics.length === 0 ? (
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <TimelineIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      No metrics data available
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Metrics will appear once the system starts collecting data
                    </Typography>
                  </Box>
                ) : (
                  <ChartContainer height={300}>
                    <LineChart data={latencyChartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <ChartTooltip />
                      <Line 
                        type="monotone" 
                        dataKey="latency" 
                        stroke={CHART_COLORS.primary} 
                        name="Latency (ms)"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  API Calls & Errors
                </Typography>
                <ChartContainer height={300}>
                  <AreaChart data={apiCallsChartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <ChartTooltip />
                    <Area 
                      type="monotone" 
                      dataKey="calls" 
                      stackId="1"
                      stroke={CHART_COLORS.primary} 
                      fill={CHART_COLORS.primary}
                      name="API Calls"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="errors" 
                      stackId="1"
                      stroke={CHART_COLORS.error} 
                      fill={CHART_COLORS.error}
                      name="Errors"
                    />
                  </AreaChart>
                </ChartContainer>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Resource Usage
                </Typography>
                <ChartContainer height={300}>
                  <LineChart data={resourceChartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <ChartTooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="cpu" 
                      stroke={CHART_COLORS.primary} 
                      name="CPU %"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="memory" 
                      stroke={CHART_COLORS.secondary} 
                      name="Memory %"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ChartContainer>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
    </MasterOnly>
  )
}