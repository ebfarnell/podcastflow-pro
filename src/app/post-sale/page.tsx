'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Stack,
  Avatar,
  IconButton,
  Tooltip,
  Badge,
  Skeleton,
} from '@mui/material'
import {
  Assignment,
  Description,
  CheckCircle,
  Schedule,
  AttachMoney,
  Warning,
  TrendingUp,
  Notifications,
  Timeline,
  Task,
  ViewModule,
  ViewList,
  ViewKanban,
  CalendarMonth,
  Refresh,
  ExpandMore,
  ExpandLess,
  Palette,
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { isFeatureEnabled as checkFeatureEnabled, FEATURE_FLAGS } from '@/lib/feature-flags'

// Sub-components for each section
import OrdersSection from '@/components/post-sale/OrdersSection'
import ContractsSection from '@/components/post-sale/ContractsSection'
import CreativeManagementSection from '@/components/post-sale/CreativeManagementSection'
import BillingSection from '@/components/post-sale/BillingSection'
import NotificationsSection from '@/components/post-sale/NotificationsSection'

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
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function PostSaleDashboardPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedTab, setSelectedTab] = useState(0)
  const [showSummary, setShowSummary] = useState(true)
  
  // Tab mapping for URL parameters
  const tabMapping: Record<string, number> = {
    'orders': 0,
    'contracts': 1,
    'creative': 2,
    'billing': 3,
    'timeline': 4,
  }
  
  // Set initial tab based on URL parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabMapping[tabParam] !== undefined) {
      setSelectedTab(tabMapping[tabParam])
    }
  }, [searchParams])

  // Feature flag check
  const isFeatureEnabled = user ? checkFeatureEnabled(FEATURE_FLAGS.POST_SALE_MIGRATION, user.role, user.id) : false

  // Fetch dashboard summary data
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ['post-sale-dashboard'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/post-sale-dashboard', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          console.error('Dashboard API error:', response.status, errorData)
          throw new Error(errorData?.error || 'Failed to fetch dashboard data')
        }
        
        return response.json()
      } catch (err) {
        console.error('Error fetching dashboard:', err)
        throw err
      }
    },
    enabled: !!user && isFeatureEnabled,
    refetchInterval: 60000, // Refresh every minute
  })

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/login')
    }
  }, [user, sessionLoading, router])

  if (sessionLoading) return <DashboardLayout><LinearProgress /></DashboardLayout>
  if (!user) return null

  // Feature flag guard
  if (!isFeatureEnabled) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Access Restricted
          </Typography>
          <Typography color="textSecondary">
            This feature is currently available to admin and sales users only.
          </Typography>
        </Box>
      </DashboardLayout>
    )
  }

  const summary = dashboardData?.summary || {
    orders: { pending: 0, approved: 0, revenue: 0 },
    contracts: { draft: 0, awaiting_signature: 0, executed: 0 },
    creatives: { pending_approval: 0, in_production: 0, approved: 0 },
    tasks: { overdue: 0, today: 0, upcoming: 0 }
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.CAMPAIGNS_VIEW}>
      <DashboardLayout>
        <Box sx={{ flexGrow: 1 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                Post-Sale Dashboard
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                Unified view of orders, contracts, creatives, and approvals
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Tooltip title="Refresh data">
                <IconButton onClick={() => refetch()}>
                  <Refresh />
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={showSummary ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setShowSummary(!showSummary)}
              >
                {showSummary ? 'Hide' : 'Show'} Summary
              </Button>
            </Stack>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load dashboard data. Please try refreshing.
            </Alert>
          )}

          {/* Summary Cards */}
          {showSummary && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* Orders Summary */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography color="textSecondary" gutterBottom variant="subtitle2">
                          Active Orders
                        </Typography>
                        <Typography variant="h4">
                          {isLoading ? <Skeleton width={60} /> : (summary.orders.pending || 0) + (summary.orders.approved || 0)}
                        </Typography>
                        <Chip
                          label={`$${isLoading ? '0' : (summary.orders.revenue || 0).toLocaleString()} revenue`}
                          size="small"
                          sx={{ 
                            mt: 1,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            fontWeight: 500,
                          }}
                        />
                      </Box>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <Assignment />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Contracts Summary */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography color="textSecondary" gutterBottom variant="subtitle2">
                          Pending Contracts
                        </Typography>
                        <Typography variant="h4">
                          {isLoading ? <Skeleton width={60} /> : (summary.contracts.draft || 0) + (summary.contracts.awaiting_signature || 0)}
                        </Typography>
                        {/* FIX: Add consistent chip styling */}
                        <Chip
                          label={`${isLoading ? 0 : summary.contracts.executed || 0} executed`}
                          size="small"
                          sx={{ 
                            mt: 1,
                            bgcolor: 'success.main',
                            color: 'success.contrastText',
                            fontWeight: 500,
                          }}
                        />
                      </Box>
                      <Avatar sx={{ bgcolor: 'secondary.main' }}>
                        <Description />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Creative Management Summary */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography color="textSecondary" gutterBottom variant="subtitle2">
                          Creative Management
                        </Typography>
                        <Typography variant="h4">
                          {isLoading ? <Skeleton width={60} /> : (summary.creatives.pending_approval || 0) + (summary.creatives.in_production || 0)}
                        </Typography>
                        <Chip
                          label={`${isLoading ? 0 : summary.creatives.approved || 0} approved`}
                          size="small"
                          sx={{ 
                            mt: 1,
                            bgcolor: 'info.main',
                            color: 'info.contrastText',
                            fontWeight: 500,
                          }}
                        />
                      </Box>
                      <Avatar sx={{ bgcolor: 'info.main' }}>
                        <Palette />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Tasks Summary */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography color="textSecondary" gutterBottom variant="subtitle2">
                          Pending Tasks
                        </Typography>
                        <Typography variant="h4">
                          {isLoading ? <Skeleton width={60} /> : (summary.tasks.todayWithApprovals || summary.tasks.today || 0) + (summary.tasks.upcoming || 0)}
                        </Typography>
                        {/* Show appropriate chip based on task status */}
                        <Chip
                          label={
                            (summary.tasks.overdue || 0) > 0 
                              ? `${summary.tasks.overdue} overdue`
                              : (summary.tasks.today || 0) > 0
                              ? `${summary.tasks.today} due today`
                              : `${summary.tasks.upcoming || 0} upcoming`
                          }
                          size="small"
                          sx={{ 
                            mt: 1,
                            bgcolor: (summary.tasks.overdue || 0) > 0 
                              ? 'error.main'
                              : (summary.tasks.today || 0) > 0
                              ? 'warning.main'
                              : 'info.main',
                            color: (summary.tasks.overdue || 0) > 0 
                              ? 'error.contrastText'
                              : (summary.tasks.today || 0) > 0
                              ? 'warning.contrastText'
                              : 'info.contrastText',
                            fontWeight: 500,
                          }}
                        />
                      </Box>
                      <Avatar sx={{ bgcolor: 'warning.main' }}>
                        <Task />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Main Content Tabs */}
          <Paper sx={{ width: '100%' }}>
            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab 
                label={
                  <Badge badgeContent={dashboardData?.pendingActions?.orders || 0} color="error">
                    Orders
                  </Badge>
                } 
                icon={<Assignment />} 
                iconPosition="start" 
              />
              <Tab 
                label={
                  <Badge badgeContent={dashboardData?.pendingActions?.contracts || 0} color="error">
                    Contracts & IOs
                  </Badge>
                } 
                icon={<Description />} 
                iconPosition="start" 
              />
              <Tab 
                label={
                  <Badge badgeContent={(dashboardData?.pendingActions?.creatives || 0) + (dashboardData?.pendingActions?.approvals || 0) + (dashboardData?.pendingActions?.adRequests || 0)} color="error">
                    Creative Management
                  </Badge>
                } 
                icon={<Palette />} 
                iconPosition="start" 
              />
              <Tab 
                label={
                  <Badge badgeContent={dashboardData?.pendingActions?.billing || 0} color="error">
                    Billing
                  </Badge>
                } 
                icon={<AttachMoney />} 
                iconPosition="start" 
              />
              <Tab 
                label="Timeline" 
                icon={<Timeline />} 
                iconPosition="start" 
              />
            </Tabs>

            {/* Tab Panels */}
            <Box sx={{ p: 3 }}>
              <TabPanel value={selectedTab} index={0}>
                <OrdersSection />
              </TabPanel>
              <TabPanel value={selectedTab} index={1}>
                <ContractsSection />
              </TabPanel>
              <TabPanel value={selectedTab} index={2}>
                <CreativeManagementSection />
              </TabPanel>
              <TabPanel value={selectedTab} index={3}>
                <BillingSection />
              </TabPanel>
              <TabPanel value={selectedTab} index={4}>
                <NotificationsSection />
              </TabPanel>
            </Box>
          </Paper>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}