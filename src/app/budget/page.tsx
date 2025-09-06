'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  LinearProgress,
  Alert
} from '@mui/material'
import {
  AttachMoney,
  TrendingUp
} from '@mui/icons-material'
import { RevenueProjections } from '@/components/budget/RevenueProjections'
import { UnifiedBudgetPlanning } from '@/components/budget/UnifiedBudgetPlanning'

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
      id={`budget-tabpanel-${index}`}
      aria-labelledby={`budget-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
  )
}

export default function BudgetPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear())

  useEffect(() => {
    if (!sessionLoading && (!user || !['master', 'admin'].includes(user.role))) {
      router.push('/dashboard')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user) {
      setLoading(false)
    }
  }, [user])

  if (sessionLoading || loading) return <LinearProgress />
  if (!user || !['master', 'admin'].includes(user.role)) return null

  return (
    <DashboardLayout>
      <RouteProtection requiredPermission={PERMISSIONS.BUDGET_VIEW}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Budget Planning & Management
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Comprehensive budget management with flexible views, live analytics, and revenue projections.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Paper sx={{ width: '100%', mb: 3 }}>
            <Tabs 
              value={tabValue} 
              onChange={(e, v) => setTabValue(v)} 
              aria-label="budget tabs"
              variant="fullWidth"
            >
              <Tab 
                label="Budget Planning" 
                icon={<TrendingUp />} 
                iconPosition="start" 
              />
              <Tab 
                label="Revenue Projections" 
                icon={<AttachMoney />} 
                iconPosition="start" 
              />
            </Tabs>
          </Paper>

          <TabPanel value={tabValue} index={0}>
            <UnifiedBudgetPlanning 
              year={budgetYear} 
              onYearChange={setBudgetYear}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <RevenueProjections year={budgetYear} />
          </TabPanel>
        </Box>
      </RouteProtection>
    </DashboardLayout>
  )
}