'use client'


import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Chip,
  Button,
  IconButton
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Assessment,
  Timeline,
  PieChart,
  Download,
  Refresh
} from '@mui/icons-material'
import { 
  LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'

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
      id={`executive-tabpanel-${index}`}
      aria-labelledby={`executive-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export default function ExecutiveReportsPage() {
  const { user, isLoading: sessionLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  
  // P&L State
  const [plYear, setPlYear] = useState(new Date().getFullYear())
  const [plStartMonth, setPlStartMonth] = useState(1)
  const [plEndMonth, setPlEndMonth] = useState(12)
  const [plData, setPlData] = useState<any>(null)
  
  // Revenue Projections State
  const [projectionMonths, setProjectionMonths] = useState(12)
  const [projectionData, setProjectionData] = useState<any>(null)

  useEffect(() => {
    if (!sessionLoading && (!user || !['master', 'admin'].includes(user.role))) {
      router.push('/dashboard')
    }
  }, [user, sessionLoading, router])

  useEffect(() => {
    if (user) {
      fetchPLData()
      fetchProjectionData()
    }
  }, [user, plYear, plStartMonth, plEndMonth, projectionMonths])

  const fetchPLData = async () => {
    try {
      const response = await fetch(
        `/api/executive/pl-report?year=${plYear}&startMonth=${plStartMonth}&endMonth=${plEndMonth}`
      )
      if (!response.ok) throw new Error('Failed to fetch P&L data')
      const data = await response.json()
      setPlData(data)
    } catch (err) {
      console.error('Error fetching P&L data:', err)
      setError('Failed to load P&L report')
    }
  }

  const fetchProjectionData = async () => {
    try {
      const response = await fetch(`/api/executive/revenue-projections?months=${projectionMonths}`)
      if (!response.ok) throw new Error('Failed to fetch projection data')
      const data = await response.json()
      setProjectionData(data)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching projection data:', err)
      setError('Failed to load revenue projections')
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  if (sessionLoading || loading) return (
    <RouteProtection requiredPermission={PERMISSIONS.REPORTS_EXECUTIVE_VIEW}>
      <DashboardLayout>
        <CircularProgress />
      </DashboardLayout>
    </RouteProtection>
  )
  if (!user || !['master', 'admin'].includes(user.role)) return null

  return (
    <RouteProtection requiredPermission={PERMISSIONS.REPORTS_EXECUTIVE_VIEW}>
      <DashboardLayout>
        <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Executive Reports
        </Typography>
        <IconButton onClick={() => { fetchPLData(); fetchProjectionData() }} color="primary">
          <Refresh />
        </IconButton>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} aria-label="executive reports tabs">
          <Tab label="P&L Statement" icon={<Assessment />} iconPosition="start" />
          <Tab label="Revenue Projections" icon={<Timeline />} iconPosition="start" />
          <Tab label="Budget Analysis" icon={<PieChart />} iconPosition="start" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        {/* P&L Statement Tab */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Year</InputLabel>
              <Select value={plYear} onChange={(e) => setPlYear(e.target.value as number)} label="Year">
                {[2023, 2024, 2025, 2026].map(year => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Start Month</InputLabel>
              <Select value={plStartMonth} onChange={(e) => setPlStartMonth(e.target.value as number)} label="Start Month">
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>End Month</InputLabel>
              <Select value={plEndMonth} onChange={(e) => setPlEndMonth(e.target.value as number)} label="End Month">
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {plData && (
          <>
            {/* Key Metrics */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Total Revenue</Typography>
                    <Typography variant="h4">{formatCurrency(plData.totals.revenue.total)}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <TrendingUp color="success" fontSize="small" />
                      <Typography variant="body2" color="success.main" sx={{ ml: 1 }}>
                        {formatPercent(plData.metrics.grossMargin)} margin
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Gross Profit</Typography>
                    <Typography variant="h4">{formatCurrency(plData.totals.grossProfit)}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {formatPercent((plData.totals.grossProfit / plData.totals.revenue.total) * 100)} of revenue
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>EBITDA</Typography>
                    <Typography variant="h4">{formatCurrency(plData.totals.ebitda)}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      {plData.totals.ebitda >= 0 ? (
                        <TrendingUp color="success" fontSize="small" />
                      ) : (
                        <TrendingDown color="error" fontSize="small" />
                      )}
                      <Typography 
                        variant="body2" 
                        color={plData.totals.ebitda >= 0 ? 'success.main' : 'error.main'}
                        sx={{ ml: 1 }}
                      >
                        {formatPercent(plData.metrics.ebitdaMargin)} margin
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Net Income</Typography>
                    <Typography variant="h4">{formatCurrency(plData.totals.netIncome)}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      {plData.totals.netIncome >= 0 ? (
                        <TrendingUp color="success" fontSize="small" />
                      ) : (
                        <TrendingDown color="error" fontSize="small" />
                      )}
                      <Typography 
                        variant="body2" 
                        color={plData.totals.netIncome >= 0 ? 'success.main' : 'error.main'}
                        sx={{ ml: 1 }}
                      >
                        {formatPercent(plData.metrics.netMargin)} margin
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* P&L Table */}
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    {plData.period.months.map((month: any) => (
                      <TableCell key={month.number} align="right">{month.name}</TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Revenue Section */}
                  <TableRow>
                    <TableCell colSpan={plData.period.months.length + 2} sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                      Revenue
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 3 }}>Advertising Revenue</TableCell>
                    {plData.period.months.map((month: any) => (
                      <TableCell key={month.number} align="right">
                        {formatCurrency(plData.monthlyPL[month.number].revenue.advertising)}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(plData.totals.revenue.advertising)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 3 }}>Other Revenue</TableCell>
                    {plData.period.months.map((month: any) => (
                      <TableCell key={month.number} align="right">
                        {formatCurrency(plData.monthlyPL[month.number].revenue.other)}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(plData.totals.revenue.other)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Revenue</TableCell>
                    {plData.period.months.map((month: any) => (
                      <TableCell key={month.number} align="right" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(plData.monthlyPL[month.number].revenue.total)}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(plData.totals.revenue.total)}
                    </TableCell>
                  </TableRow>

                  {/* COGS Section */}
                  <TableRow>
                    <TableCell colSpan={plData.period.months.length + 2} sx={{ bgcolor: 'grey.100', fontWeight: 'bold', pt: 3 }}>
                      Cost of Goods Sold
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 3 }}>Revenue Sharing</TableCell>
                    {plData.period.months.map((month: any) => (
                      <TableCell key={month.number} align="right">
                        {formatCurrency(plData.monthlyPL[month.number].cogs.showRevShare)}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(plData.totals.cogs.showRevShare)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 3 }}>Production Costs</TableCell>
                    {plData.period.months.map((month: any) => (
                      <TableCell key={month.number} align="right">
                        {formatCurrency(plData.monthlyPL[month.number].cogs.productionCosts)}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(plData.totals.cogs.productionCosts)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Gross Profit</TableCell>
                    {plData.period.months.map((month: any) => (
                      <TableCell key={month.number} align="right" sx={{ fontWeight: 'bold', bgcolor: 'success.light' }}>
                        {formatCurrency(plData.monthlyPL[month.number].grossProfit)}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'success.light' }}>
                      {formatCurrency(plData.totals.grossProfit)}
                    </TableCell>
                  </TableRow>

                  {/* Operating Expenses */}
                  <TableRow>
                    <TableCell colSpan={plData.period.months.length + 2} sx={{ bgcolor: 'grey.100', fontWeight: 'bold', pt: 3 }}>
                      Operating Expenses
                    </TableCell>
                  </TableRow>
                  {['salaries', 'benefits', 'bonuses', 'commissions', 'marketing', 'technology', 'office', 'professional', 'other'].map(expense => (
                    <TableRow key={expense}>
                      <TableCell sx={{ pl: 3, textTransform: 'capitalize' }}>{expense}</TableCell>
                      {plData.period.months.map((month: any) => (
                        <TableCell key={month.number} align="right">
                          {formatCurrency(plData.monthlyPL[month.number].expenses[expense])}
                        </TableCell>
                      ))}
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(plData.totals.expenses[expense])}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Operating Expenses</TableCell>
                    {plData.period.months.map((month: any) => (
                      <TableCell key={month.number} align="right" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(plData.monthlyPL[month.number].expenses.total)}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(plData.totals.expenses.total)}
                    </TableCell>
                  </TableRow>

                  {/* Net Income */}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>EBITDA</TableCell>
                    {plData.period.months.map((month: any) => (
                      <TableCell key={month.number} align="right" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(plData.monthlyPL[month.number].ebitda)}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(plData.totals.ebitda)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Net Income</TableCell>
                    {plData.period.months.map((month: any) => (
                      <TableCell 
                        key={month.number} 
                        align="right" 
                        sx={{ 
                          fontWeight: 'bold',
                          bgcolor: plData.monthlyPL[month.number].netIncome >= 0 ? 'success.light' : 'error.light'
                        }}
                      >
                        {formatCurrency(plData.monthlyPL[month.number].netIncome)}
                      </TableCell>
                    ))}
                    <TableCell 
                      align="right" 
                      sx={{ 
                        fontWeight: 'bold',
                        bgcolor: plData.totals.netIncome >= 0 ? 'success.light' : 'error.light'
                      }}
                    >
                      {formatCurrency(plData.totals.netIncome)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Revenue Projections Tab */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Projection Period</InputLabel>
              <Select 
                value={projectionMonths} 
                onChange={(e) => setProjectionMonths(e.target.value as number)} 
                label="Projection Period"
              >
                <MenuItem value={3}>3 Months</MenuItem>
                <MenuItem value={6}>6 Months</MenuItem>
                <MenuItem value={12}>12 Months</MenuItem>
                <MenuItem value={24}>24 Months</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {projectionData && (
          <>
            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Confirmed Revenue</Typography>
                    <Typography variant="h4">{formatCurrency(projectionData.summary.totalConfirmed)}</Typography>
                    <Chip 
                      label="Booked" 
                      color="success" 
                      size="small" 
                      sx={{ mt: 1 }} 
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Pending Revenue</Typography>
                    <Typography variant="h4">{formatCurrency(projectionData.summary.totalPending)}</Typography>
                    <Chip 
                      label="In Negotiation" 
                      color="warning" 
                      size="small" 
                      sx={{ mt: 1 }} 
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Projected Revenue</Typography>
                    <Typography variant="h4">{formatCurrency(projectionData.summary.totalPotential)}</Typography>
                    <Chip 
                      label={`${projectionData.summary.growthRate.toFixed(1)}% Growth`} 
                      color="info" 
                      size="small" 
                      sx={{ mt: 1 }} 
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Total Forecast</Typography>
                    <Typography variant="h4">{formatCurrency(projectionData.summary.totalProjected)}</Typography>
                    <Chip 
                      label={`${projectionData.summary.confidenceLevel} Confidence`} 
                      color={projectionData.summary.confidenceLevel === 'High' ? 'success' : 'default'} 
                      size="small" 
                      sx={{ mt: 1 }} 
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Revenue Projection Chart */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Monthly Revenue Projections</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={projectionData.monthlyProjections}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="confirmed" stackId="a" fill="#4caf50" name="Confirmed" />
                  <Bar dataKey="pending" stackId="a" fill="#ff9800" name="Pending" />
                  <Bar dataKey="potential" stackId="a" fill="#2196f3" name="Projected" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            {/* Top Advertisers and Shows */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>Top Advertisers by Revenue</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Advertiser</TableCell>
                          <TableCell align="right">Projected Revenue</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {projectionData.topAdvertisers.map((advertiser: any) => (
                          <TableRow key={advertiser.name}>
                            <TableCell>{advertiser.name}</TableCell>
                            <TableCell align="right">{formatCurrency(advertiser.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>Top Shows by Revenue</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Show</TableCell>
                          <TableCell align="right">Projected Revenue</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {projectionData.topShows.map((show: any) => (
                          <TableRow key={show.name}>
                            <TableCell>{show.name}</TableCell>
                            <TableCell align="right">{formatCurrency(show.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* Budget Analysis Tab */}
        {plData && plData.budgetComparison && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Budget vs Actual Analysis</Typography>
            </Grid>
            {Object.entries(plData.budgetComparison).map(([month, data]: [string, any]) => (
              <Grid item xs={12} md={4} key={month}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Month {month}
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="textSecondary">Revenue</Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography>{formatCurrency(data.revenue.actual)}</Typography>
                        <Chip 
                          label={`${data.revenue.percentVariance > 0 ? '+' : ''}${data.revenue.percentVariance.toFixed(1)}%`}
                          color={data.revenue.percentVariance >= 0 ? 'success' : 'error'}
                          size="small"
                        />
                      </Box>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="textSecondary">Expenses</Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography>{formatCurrency(data.expenses.actual)}</Typography>
                        <Chip 
                          label={`${data.expenses.percentVariance > 0 ? '+' : ''}${data.expenses.percentVariance.toFixed(1)}%`}
                          color={data.expenses.percentVariance <= 0 ? 'success' : 'error'}
                          size="small"
                        />
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Net Income</Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: 'bold' }}>{formatCurrency(data.netIncome.actual)}</Typography>
                        <Chip 
                          label={`${data.netIncome.percentVariance > 0 ? '+' : ''}${data.netIncome.percentVariance.toFixed(1)}%`}
                          color={data.netIncome.percentVariance >= 0 ? 'success' : 'error'}
                          size="small"
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>
        </Box>
      </DashboardLayout>
    </RouteProtection>
  )
}