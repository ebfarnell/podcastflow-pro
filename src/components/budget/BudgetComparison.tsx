'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Compare,
  Timeline,
  BarChart,
  ShowChart,
  Analytics
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart as RechartsBarChart, Bar } from 'recharts'

interface ComparisonData {
  period: string
  currentBudget: number
  currentActual: number
  previousActual: number
  budgetVariance: number
  budgetVariancePercent: number
  yearOverYearGrowth: number
  isOnTarget: boolean
  sellersOnTarget: number
  sellersOffTarget: number
}

interface ComparisonSummary {
  totalCurrentBudget: number
  totalCurrentActual: number
  totalPreviousActual: number
  overallVariance: number
  overallYoYGrowth: number
  sellersOnTarget: number
  sellersOffTarget: number
  periodsAnalyzed: number
  bestPeriod: ComparisonData | null
  worstPeriod: ComparisonData | null
}

interface BudgetComparisonProps {
  year: number
  sellerId?: string
}

export function BudgetComparison({ year, sellerId }: BudgetComparisonProps) {
  const [compareYear, setCompareYear] = useState(year - 1)
  const [groupBy, setGroupBy] = useState<'month' | 'quarter' | 'year'>('month')
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')

  // Fetch comparison data
  const { data: comparisonData, isLoading, error } = useQuery({
    queryKey: ['budget-comparison', year, compareYear, groupBy, sellerId],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: year.toString(),
        compareYear: compareYear.toString(),
        groupBy,
        ...(sellerId && { sellerId })
      })
      const response = await fetch(`/api/budget/comparison?${params}`)
      if (!response.ok) throw new Error('Failed to fetch comparison data')
      return response.json()
    },
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getVarianceColor = (variance: number) => {
    if (variance > 10) return 'success'
    if (variance > -10) return 'warning'
    return 'error'
  }

  const getGrowthColor = (growth: number) => {
    if (growth > 15) return 'success'
    if (growth > 0) return 'info'
    if (growth > -10) return 'warning'
    return 'error'
  }

  // Prepare chart data
  const chartData = comparisonData?.comparison?.map((item: ComparisonData) => ({
    period: item.period,
    'Current Budget': item.currentBudget,
    'Current Actual': item.currentActual,
    'Previous Year Actual': item.previousActual,
    'YoY Growth %': item.yearOverYearGrowth
  })) || []

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load comparison data: {error.message}
      </Alert>
    )
  }

  const comparison: ComparisonData[] = comparisonData?.comparison || []
  const summary: ComparisonSummary = comparisonData?.summary || {
    totalCurrentBudget: 0,
    totalCurrentActual: 0,
    totalPreviousActual: 0,
    overallVariance: 0,
    overallYoYGrowth: 0,
    sellersOnTarget: 0,
    sellersOffTarget: 0,
    periodsAnalyzed: 0,
    bestPeriod: null,
    worstPeriod: null
  }

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Compare with</InputLabel>
              <Select
                value={compareYear}
                onChange={(e) => setCompareYear(e.target.value as number)}
                label="Compare with"
              >
                {Array.from({ length: 5 }, (_, i) => year - i - 1).map(y => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <ToggleButtonGroup
              value={groupBy}
              exclusive
              onChange={(e, newGroupBy) => newGroupBy && setGroupBy(newGroupBy)}
              size="small"
            >
              <ToggleButton value="month">Monthly</ToggleButton>
              <ToggleButton value="quarter">Quarterly</ToggleButton>
              <ToggleButton value="year">Yearly</ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          <Grid item xs={12} md={2}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newViewMode) => newViewMode && setViewMode(newViewMode)}
              size="small"
            >
              <ToggleButton value="table">
                <BarChart sx={{ mr: 1 }} />
                Table
              </ToggleButton>
              <ToggleButton value="chart">
                <ShowChart sx={{ mr: 1 }} />
                Chart
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Current Year Performance
              </Typography>
              <Typography variant="h5" color="primary.main">
                {formatCurrency(summary.totalCurrentActual)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                vs {formatCurrency(summary.totalCurrentBudget)} budgeted
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {summary.overallVariance >= 0 ? (
                  <TrendingUp color="success" sx={{ mr: 0.5 }} />
                ) : (
                  <TrendingDown color="error" sx={{ mr: 0.5 }} />
                )}
                <Typography 
                  variant="body2" 
                  color={summary.overallVariance >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(Math.abs(summary.overallVariance))} 
                  {summary.overallVariance >= 0 ? ' over' : ' under'} budget
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Year-over-Year Growth
              </Typography>
              <Typography 
                variant="h5" 
                color={summary.overallYoYGrowth >= 0 ? 'success.main' : 'error.main'}
              >
                {formatPercent(summary.overallYoYGrowth)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                vs {formatCurrency(summary.totalPreviousActual)} in {compareYear}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Growth: {formatCurrency(summary.totalCurrentActual - summary.totalPreviousActual)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Seller Performance
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={`${summary.sellersOnTarget} On Target`}
                  color="success" 
                  size="small" 
                />
                <Chip 
                  label={`${summary.sellersOffTarget} Off Target`}
                  color="error" 
                  size="small" 
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {summary.periodsAnalyzed} periods analyzed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Best vs Worst Period
              </Typography>
              {summary.bestPeriod && summary.worstPeriod ? (
                <>
                  <Typography variant="body2" color="success.main">
                    Best: {summary.bestPeriod.period} ({formatPercent(summary.bestPeriod.yearOverYearGrowth)})
                  </Typography>
                  <Typography variant="body2" color="error.main">
                    Worst: {summary.worstPeriod.period} ({formatPercent(summary.worstPeriod.yearOverYearGrowth)})
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      {viewMode === 'table' ? (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Budget vs Actual Comparison ({year} vs {compareYear})
            </Typography>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Current Budget</TableCell>
                    <TableCell align="right">Current Actual</TableCell>
                    <TableCell align="right">Budget Variance</TableCell>
                    <TableCell align="right">{compareYear} Actual</TableCell>
                    <TableCell align="right">YoY Growth</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comparison.map((row) => (
                    <TableRow key={row.period}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {row.period}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(row.currentBudget)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(row.currentActual)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <Typography 
                            variant="body2" 
                            color={row.budgetVariance >= 0 ? 'success.main' : 'error.main'}
                          >
                            {formatCurrency(row.budgetVariance)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatPercent(row.budgetVariancePercent)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(row.previousActual)}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {row.yearOverYearGrowth >= 0 ? (
                            <TrendingUp 
                              color={row.yearOverYearGrowth > 10 ? 'success' : 'info'} 
                              sx={{ mr: 0.5 }} 
                            />
                          ) : (
                            <TrendingDown color="error" sx={{ mr: 0.5 }} />
                          )}
                          <Typography 
                            variant="body2"
                            color={
                              row.yearOverYearGrowth > 10 ? 'success.main' :
                              row.yearOverYearGrowth > 0 ? 'info.main' : 'error.main'
                            }
                          >
                            {formatPercent(row.yearOverYearGrowth)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={row.isOnTarget ? 'On Target' : 'Off Target'}
                          color={row.isOnTarget ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Budget Performance Trends
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Budget vs Actual Performance
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="Current Budget" fill="#1976d2" name="Current Budget" />
                    <Bar dataKey="Current Actual" fill="#2e7d32" name="Current Actual" />
                    <Bar dataKey="Previous Year Actual" fill="#ed6c02" name={`${compareYear} Actual`} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Year-over-Year Growth Trend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Line 
                      type="monotone" 
                      dataKey="YoY Growth %" 
                      stroke="#1976d2" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="YoY Growth %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}