'use client'


import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Button,
} from '@mui/material'
import {
  TrendingUp,
  People,
  Business,
  AttachMoney,
  CloudQueue,
  Assessment,
  Speed,
  Storage,
  GetApp,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { MasterOnly } from '@/components/auth/RoleGuard'
import { useQuery } from '@tanstack/react-query'
import { masterApi, type MasterAnalytics } from '@/services/masterApi'

export default function GlobalAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d')
  const router = useRouter()

  // Fetch global analytics data
  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: ['master-analytics', timeRange],
    queryFn: () => masterApi.analytics.getGlobalMetrics(timeRange),
    refetchInterval: false, // Disable automatic refresh
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  })

  const handleExportReport = async () => {
    try {
      const blob = await masterApi.analytics.exportReport('pdf', {
        timeRange,
        includeCharts: true,
        includeData: true
      })
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `global-analytics-${timeRange}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting report:', error)
    }
  }

  if (isLoading) {
    return (
    <RouteProtection requiredPermission={PERMISSIONS.MASTER_VIEW_ALL}>
      <MasterOnly>
        <DashboardLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <Typography>Loading analytics data...</Typography>
          </Box>
        </DashboardLayout>
      </MasterOnly>
    </RouteProtection>
    )
  }

  if (error || !analyticsData) {
    return (
      <MasterOnly>
        <DashboardLayout>
          <Box sx={{ p: 3 }}>
            <Alert severity="error">
              Failed to load analytics data. Please try again.
            </Alert>
          </Box>
        </DashboardLayout>
      </MasterOnly>
    )
  }

  const { usageData, organizations, ...metrics } = analyticsData

  return (
    <MasterOnly>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
                Global Analytics
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Platform-wide metrics and performance analytics
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl variant="filled" sx={{ minWidth: 180, backgroundColor: 'white', borderRadius: 1 }}>
                <InputLabel id="time-range-label">Time Range</InputLabel>
                <Select
                  labelId="time-range-label"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <MenuItem value="7d">Last 7 days</MenuItem>
                  <MenuItem value="30d">Last 30 days</MenuItem>
                  <MenuItem value="90d">Last 90 days</MenuItem>
                  <MenuItem value="1y">Last year</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={<GetApp />}
                onClick={handleExportReport}
                sx={{ height: 56 }}
              >
                Export Report
              </Button>
            </Box>
          </Box>

          {/* Key Metrics */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={3}>
              <Card 
                sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.2s' } }}
                onClick={() => router.push('/master/users')}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <People sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Total Users
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {metrics.totalUsers.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    +12% from last month
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card 
                sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.2s' } }}
                onClick={() => router.push('/master/organizations')}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Business sx={{ mr: 2, color: 'info.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Organizations
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {metrics.totalOrganizations}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    +3 this month
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card 
                sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.2s' } }}
                onClick={() => router.push('/master/billing')}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AttachMoney sx={{ mr: 2, color: 'success.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      Total Revenue
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    ${metrics.totalRevenue.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    +8% from last month
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card 
                sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.2s' } }}
                onClick={() => router.push('/monitoring')}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Speed sx={{ mr: 2, color: 'warning.main' }} />
                    <Typography color="text.secondary" gutterBottom>
                      System Uptime
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: 'text.primary' }}>
                    {metrics.uptime}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg response: {metrics.avgResponseTime}ms
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Usage Analytics */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                    Platform Usage
                  </Typography>
                  {usageData.map((item) => (
                    <Box key={item.metric} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{item.metric}</Typography>
                        <Typography variant="body2">
                          {item.used.toLocaleString()} / {item.limit.toLocaleString()} {item.unit}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(item.used / item.limit) * 100}
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
                  <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                    System Health
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">API Calls (24h)</Typography>
                      <Typography variant="body2" color="success.main">
                        {metrics.apiCalls.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Storage Used</Typography>
                      <Typography variant="body2">
                        {metrics.storageUsed} TB
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Active Users (24h)</Typography>
                      <Typography variant="body2" color="primary.main">
                        {metrics.activeUsers.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Top Organizations */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                Top Organizations by Revenue
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Organization</TableCell>
                      <TableCell align="right">Users</TableCell>
                      <TableCell align="right">Monthly Revenue</TableCell>
                      <TableCell>Plan</TableCell>
                      <TableCell align="right">Revenue per User</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.name}>
                        <TableCell>{org.name}</TableCell>
                        <TableCell align="right">{org.users}</TableCell>
                        <TableCell align="right">${org.revenue.toLocaleString()}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              color: org.plan === 'Enterprise' ? 'primary.main' : 
                                     org.plan === 'Professional' ? 'info.main' : 'text.secondary'
                            }}
                          >
                            {org.plan}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          ${Math.round(org.revenue / org.users).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </DashboardLayout>
    </MasterOnly>
  )
}