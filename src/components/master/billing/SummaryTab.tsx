'use client'

import { Box, Grid, Card, CardContent, Typography, Paper } from '@mui/material'
import { AttachMoney, TrendingDown, Assessment, AccountBalance } from '@mui/icons-material'
import { formatCurrency } from '@/lib/utils/currency'
import { ComprehensiveDateRangeSelector } from '@/components/common/ComprehensiveDateRangeSelector'
import { Dayjs } from 'dayjs'

interface SummaryTabProps {
  billingData: any
  expensesData: any
  timeRange: string
  onTimeRangeChange: (value: string) => void
  customStartDate?: Dayjs | null
  customEndDate?: Dayjs | null
  onCustomDateChange?: (startDate: Dayjs | null, endDate: Dayjs | null) => void
}

export function SummaryTab({ 
  billingData, 
  expensesData,
  timeRange,
  onTimeRangeChange,
  customStartDate,
  customEndDate,
  onCustomDateChange
}: SummaryTabProps) {
  const revenue = billingData?.metrics?.totalRevenue || 0
  const monthlyRevenue = billingData?.metrics?.monthlyRecurring || 0
  const totalExpenses = expensesData?.summary?.total || 0
  const recurringExpenses = expensesData?.summary?.recurring || 0
  
  // Calculate EBITDA (simplified - Revenue minus Operating Expenses)
  const ebitda = monthlyRevenue - recurringExpenses
  const ebitdaMargin = monthlyRevenue > 0 ? (ebitda / monthlyRevenue) * 100 : 0
  
  // Calculate Net Income (simplified)
  const netIncome = revenue - totalExpenses
  const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0

  return (
    <Box>
      {/* Date Range Selector */}
      <Box sx={{ mb: 3 }}>
        <ComprehensiveDateRangeSelector
          value={timeRange}
          onChange={onTimeRangeChange}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomDateChange={onCustomDateChange}
          variant="full"
        />
      </Box>

      {/* Financial Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AttachMoney sx={{ mr: 2, color: 'success.main' }} />
                <Typography color="text.secondary">Total Revenue</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: 'text.primary' }}>
                {formatCurrency(revenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                YTD from subscriptions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingDown sx={{ mr: 2, color: 'error.main' }} />
                <Typography color="text.secondary">Total Expenses</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: 'text.primary' }}>
                {formatCurrency(totalExpenses)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Operating costs
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assessment sx={{ mr: 2, color: 'primary.main' }} />
                <Typography color="text.secondary">EBITDA</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: 'text.primary' }}>
                {formatCurrency(ebitda)}
              </Typography>
              <Typography variant="body2" color={ebitda >= 0 ? 'success.main' : 'error.main'}>
                {ebitdaMargin.toFixed(1)}% margin
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalance sx={{ mr: 2, color: 'info.main' }} />
                <Typography color="text.secondary">Net Income</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: 'text.primary' }}>
                {formatCurrency(netIncome)}
              </Typography>
              <Typography variant="body2" color={netIncome >= 0 ? 'success.main' : 'error.main'}>
                {netMargin.toFixed(1)}% margin
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Breakdown */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
              Revenue Breakdown
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                <Typography>Monthly Recurring Revenue</Typography>
                <Typography fontWeight="bold">{formatCurrency(monthlyRevenue)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                <Typography>One-time Revenue</Typography>
                <Typography fontWeight="bold">{formatCurrency(0)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderTop: 1, borderColor: 'divider', mt: 1 }}>
                <Typography fontWeight="bold">Total Revenue</Typography>
                <Typography fontWeight="bold" color="success.main">
                  {formatCurrency(revenue)}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
              Expense Breakdown
            </Typography>
            <Box sx={{ mt: 2 }}>
              {expensesData?.summary?.byCategory && Object.entries(expensesData.summary.byCategory).map(([category, amount]) => (
                <Box key={category} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                  <Typography>{category}</Typography>
                  <Typography fontWeight="bold">{formatCurrency(amount as number)}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderTop: 1, borderColor: 'divider', mt: 1 }}>
                <Typography fontWeight="bold">Total Expenses</Typography>
                <Typography fontWeight="bold" color="error.main">
                  {formatCurrency(totalExpenses)}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
              Financial Summary
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1">Revenue</Typography>
                <Typography variant="subtitle1" fontWeight="bold">
                  {formatCurrency(revenue)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1">Operating Expenses</Typography>
                <Typography variant="subtitle1" fontWeight="bold" color="error.main">
                  -{formatCurrency(totalExpenses)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight="bold">EBITDA</Typography>
                <Typography variant="subtitle1" fontWeight="bold" color={ebitda >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(ebitda)} ({ebitdaMargin.toFixed(1)}%)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2 }}>
                <Typography variant="h6" fontWeight="bold">Net Income</Typography>
                <Typography variant="h6" fontWeight="bold" color={netIncome >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(netIncome)} ({netMargin.toFixed(1)}%)
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}