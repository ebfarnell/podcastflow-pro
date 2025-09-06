'use client'

import { useState } from 'react'
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip
} from '@mui/material'
import {
  Assessment,
  Receipt,
  TrendingUp,
  AccountBalance,
  AttachMoney,
  Description
} from '@mui/icons-material'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { FinancialReportsTab } from '@/components/financial/FinancialReportsTab'
import { UnifiedBudgetPlanning } from '@/components/budget/UnifiedBudgetPlanning'
import { ExpensesTab } from '@/components/financial/ExpensesTab'
import { PaymentsInvoicesTab } from '@/components/financial/PaymentsInvoicesTab'
import { RevenueProjections } from '@/components/budget/RevenueProjections'
import { useQuery } from '@tanstack/react-query'

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
      id={`financial-tabpanel-${index}`}
      aria-labelledby={`financial-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function FinancialHubPage() {
  const [selectedTab, setSelectedTab] = useState(0)

  // Fetch financial summary data
  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['financial-summary'],
    queryFn: async () => {
      const response = await fetch('/api/financial/summary')
      if (!response.ok) throw new Error('Failed to fetch financial summary')
      return response.json()
    }
  })

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue)
  }

  return (
    <RouteProtection requiredPermission={PERMISSIONS.FINANCIAL_VIEW}>
      <DashboardLayout>
        <Box sx={{ width: '100%' }}>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Financial Management Hub
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Comprehensive financial reporting, budgeting, and analysis tools
            </Typography>
          </Box>

          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        MTD Revenue
                      </Typography>
                      <Typography variant="h5">
                        ${summaryData?.mtdRevenue?.toLocaleString() || '0'}
                      </Typography>
                      <Chip
                        label={`${summaryData?.revenueGrowth >= 0 ? '+' : ''}${summaryData?.revenueGrowth || 0}% vs last month`}
                        size="small"
                        color={summaryData?.revenueGrowth >= 0 ? "success" : "error"}
                      />
                    </Box>
                    <AttachMoney color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
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
                        MTD Expenses
                      </Typography>
                      <Typography variant="h5">
                        ${summaryData?.mtdExpenses?.toLocaleString() || '0'}
                      </Typography>
                      <Chip
                        label={`${summaryData?.expenseRatio || 0}% of revenue`}
                        size="small"
                        color="info"
                      />
                    </Box>
                    <Receipt color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
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
                        Net Profit
                      </Typography>
                      <Typography variant="h5">
                        ${summaryData?.netProfit?.toLocaleString() || '0'}
                      </Typography>
                      <Chip
                        label={`${summaryData?.profitMargin || 0}% margin`}
                        size="small"
                        color={summaryData?.profitMargin >= 20 ? "success" : "warning"}
                      />
                    </Box>
                    <TrendingUp color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
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
                        Outstanding
                      </Typography>
                      <Typography variant="h5">
                        ${summaryData?.outstandingInvoices?.toLocaleString() || '0'}
                      </Typography>
                      <Chip
                        label={`${summaryData?.overdueCount || 0} overdue`}
                        size="small"
                        color={summaryData?.overdueCount > 0 ? "error" : "success"}
                      />
                    </Box>
                    <AccountBalance color="primary" sx={{ fontSize: 40, opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Tabs */}
          <Paper sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={selectedTab} 
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab 
                  label="Reports" 
                  icon={<Assessment />} 
                  iconPosition="start"
                />
                <Tab 
                  label="Budget Planning" 
                  icon={<AccountBalance />} 
                  iconPosition="start"
                />
                <Tab 
                  label="Revenue Projections" 
                  icon={<TrendingUp />} 
                  iconPosition="start"
                />
                <Tab 
                  label="Expenses" 
                  icon={<Receipt />} 
                  iconPosition="start"
                />
                <Tab 
                  label="Payments & Invoices" 
                  icon={<AccountBalance />} 
                  iconPosition="start"
                />
              </Tabs>
            </Box>

            {/* Tab Panels */}
            <Box sx={{ p: 3 }}>
              <TabPanel value={selectedTab} index={0}>
                <FinancialReportsTab />
              </TabPanel>
              
              <TabPanel value={selectedTab} index={1}>
                <UnifiedBudgetPlanning />
              </TabPanel>
              
              <TabPanel value={selectedTab} index={2}>
                <RevenueProjections />
              </TabPanel>
              
              <TabPanel value={selectedTab} index={3}>
                <ExpensesTab />
              </TabPanel>
              
              <TabPanel value={selectedTab} index={4}>
                <PaymentsInvoicesTab />
              </TabPanel>
            </Box>
          </Paper>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}