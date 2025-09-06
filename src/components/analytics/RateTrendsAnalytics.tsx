'use client'

import { useState, useMemo } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  Alert,
  Skeleton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Analytics as AnalyticsIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Lightbulb as LightbulbIcon
} from '@mui/icons-material'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface RateTrend {
  period: string
  placementType: string
  showName: string
  showId: string
  avgRate: string
  minRate: string
  maxRate: string
  medianRate: string
  rateChanges: string
  changePercent: number | null
  changeAmount: number | null
  trendDirection: 'increasing' | 'decreasing' | 'stable'
}

interface RateTrendsAnalyticsProps {
  showId?: string
  organizationSlug: string
}

const placementTypes = [
  { value: 'pre-roll', label: 'Pre-roll', color: '#1976d2' },
  { value: 'mid-roll', label: 'Mid-roll', color: '#388e3c' },
  { value: 'post-roll', label: 'Post-roll', color: '#f57c00' },
  { value: 'host-read', label: 'Host Read', color: '#7b1fa2' },
  { value: 'sponsorship', label: 'Sponsorship', color: '#d32f2f' }
]

export default function RateTrendsAnalytics({ showId, organizationSlug }: RateTrendsAnalyticsProps) {
  const [timeframe, setTimeframe] = useState('12months')
  const [groupBy, setGroupBy] = useState('month')
  const [selectedPlacement, setSelectedPlacement] = useState('')
  const [showComparison, setShowComparison] = useState(false)
  const [optimizationDialogOpen, setOptimizationDialogOpen] = useState(false)
  const [targetRevenue, setTargetRevenue] = useState('')

  // Fetch rate trends data
  const { data: trendsData, isLoading, error, refetch } = useQuery({
    queryKey: ['rate-trends', showId, timeframe, groupBy, selectedPlacement, showComparison],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeframe,
        groupBy,
        comparison: showComparison.toString()
      })
      
      if (showId) params.set('showId', showId)
      if (selectedPlacement) params.set('placementType', selectedPlacement)

      const response = await fetch(`/api/analytics/rate-trends?${params}`)
      if (!response.ok) throw new Error('Failed to fetch rate trends')
      return response.json()
    }
  })

  // Rate optimization recommendations
  const optimizationMutation = useMutation({
    mutationFn: async (data: { showId: string; placementType?: string; targetRevenue?: number }) => {
      const response = await fetch('/api/analytics/rate-trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          timeframe
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get optimization recommendations')
      }
      
      return response.json()
    }
  })

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!trendsData?.trends) return []

    const dataByPeriod = trendsData.trends.reduce((acc: any, trend: RateTrend) => {
      const key = trend.period
      if (!acc[key]) {
        acc[key] = { period: key }
      }
      acc[key][trend.placementType] = parseFloat(trend.avgRate)
      return acc
    }, {})

    return Object.values(dataByPeriod).sort((a: any, b: any) => a.period.localeCompare(b.period))
  }, [trendsData])

  // Summary statistics
  const summaryStats = useMemo(() => {
    if (!trendsData?.summary) return null

    return {
      totalShows: trendsData.summary.totalShows,
      totalRateChanges: trendsData.summary.totalRateChanges,
      avgRate: parseFloat(trendsData.summary.avgRateAcrossAll),
      placementTypes: trendsData.summary.placementTypes,
      periods: trendsData.summary.periods
    }
  }, [trendsData])

  const getTrendIcon = (direction: string, changePercent: number | null) => {
    if (!changePercent || Math.abs(changePercent) < 5) {
      return <TrendingFlatIcon color="disabled" />
    }
    
    return direction === 'increasing' ? 
      <TrendingUpIcon color="success" /> : 
      <TrendingDownIcon color="error" />
  }

  const getChangeColor = (changePercent: number | null) => {
    if (!changePercent || Math.abs(changePercent) < 5) return 'default'
    return changePercent > 0 ? 'success' : 'error'
  }

  const handleOptimizationRequest = () => {
    if (!showId) return

    optimizationMutation.mutate({
      showId,
      placementType: selectedPlacement || undefined,
      targetRevenue: targetRevenue ? parseFloat(targetRevenue) : undefined
    })
  }

  const exportData = () => {
    if (!trendsData) return

    const csvData = trendsData.trends.map((trend: RateTrend) => ({
      Period: trend.period,
      'Placement Type': trend.placementType,
      'Show Name': trend.showName,
      'Average Rate': `$${trend.avgRate}`,
      'Min Rate': `$${trend.minRate}`,
      'Max Rate': `$${trend.maxRate}`,
      'Median Rate': `$${trend.medianRate}`,
      'Rate Changes': trend.rateChanges,
      'Change Percent': trend.changePercent ? `${trend.changePercent}%` : 'N/A',
      'Trend Direction': trend.trendDirection
    }))

    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rate-trends-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load rate trends: {error.message}
      </Alert>
    )
  }

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Timeframe</InputLabel>
              <Select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                label="Timeframe"
              >
                <MenuItem value="6months">6 Months</MenuItem>
                <MenuItem value="12months">12 Months</MenuItem>
                <MenuItem value="24months">24 Months</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Group By</InputLabel>
              <Select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                label="Group By"
              >
                <MenuItem value="month">Month</MenuItem>
                <MenuItem value="quarter">Quarter</MenuItem>
                <MenuItem value="year">Year</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Placement Type</InputLabel>
              <Select
                value={selectedPlacement}
                onChange={(e) => setSelectedPlacement(e.target.value)}
                label="Placement Type"
              >
                <MenuItem value="">All Types</MenuItem>
                {placementTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="outlined"
              onClick={() => setShowComparison(!showComparison)}
              color={showComparison ? 'primary' : 'inherit'}
            >
              Market Compare
            </Button>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <IconButton onClick={() => refetch()} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={exportData} disabled={!trendsData}>
              <DownloadIcon />
            </IconButton>
            {showId && (
              <IconButton 
                onClick={() => setOptimizationDialogOpen(true)}
                color="primary"
              >
                <LightbulbIcon />
              </IconButton>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Summary Cards */}
      {summaryStats && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  {summaryStats.totalShows}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Shows Tracked
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  {summaryStats.totalRateChanges}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rate Changes
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  ${summaryStats.avgRate.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Average Rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  {summaryStats.placementTypes.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Placement Types
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Rate Trends Chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>
            Rate Trends Over Time
          </Typography>
          
          {isLoading ? (
            <Skeleton variant="rectangular" height={400} />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <RechartsTooltip 
                  formatter={(value: any) => [`$${value?.toFixed(2)}`, 'Rate']}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                {placementTypes.map(type => (
                  <Line 
                    key={type.value}
                    type="monotone" 
                    dataKey={type.value} 
                    stroke={type.color}
                    strokeWidth={2}
                    name={type.label}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Box textAlign="center" py={8}>
              <Typography variant="body1" color="text.secondary">
                No rate data available for the selected criteria
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Current Rates Table */}
      {trendsData?.currentRates && trendsData.currentRates.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" mb={2}>
              Current Active Rates
            </Typography>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Show</TableCell>
                    <TableCell>Placement Type</TableCell>
                    <TableCell align="right">Current Rate</TableCell>
                    <TableCell>Effective Date</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trendsData.currentRates.map((rate: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{rate.showName}</TableCell>
                      <TableCell>
                        <Chip 
                          label={placementTypes.find(p => p.value === rate.placementType)?.label || rate.placementType}
                          size="small"
                          style={{ 
                            backgroundColor: placementTypes.find(p => p.value === rate.placementType)?.color + '20',
                            color: placementTypes.find(p => p.value === rate.placementType)?.color
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          ${parseFloat(rate.currentRate).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {new Date(rate.effectiveDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Chip label="Active" color="success" size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Market Comparison */}
      {showComparison && trendsData?.marketComparison && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" mb={2}>
              Market Comparison
            </Typography>
            
            <Grid container spacing={2}>
              {trendsData.marketComparison.map((market: any, index: number) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {placementTypes.find(p => p.value === market.placementType)?.label || market.placementType}
                    </Typography>
                    <Typography variant="h6" color="primary">
                      ${parseFloat(market.marketAvgRate).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Market Average
                    </Typography>
                    <Box mt={1}>
                      <Typography variant="caption">
                        Range: ${parseFloat(market.q25Rate).toFixed(2)} - ${parseFloat(market.q75Rate).toFixed(2)}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Rate Optimization Dialog */}
      <Dialog 
        open={optimizationDialogOpen} 
        onClose={() => setOptimizationDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Rate Optimization Recommendations</DialogTitle>
        <DialogContent>
          <Box mb={2}>
            <TextField
              label="Target Monthly Revenue (Optional)"
              type="number"
              value={targetRevenue}
              onChange={(e) => setTargetRevenue(e.target.value)}
              fullWidth
              InputProps={{ startAdornment: '$' }}
              helperText="Enter target revenue to get rate recommendations"
            />
          </Box>

          {optimizationMutation.data && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Recommendations for {optimizationMutation.data.showName}
              </Typography>
              
              {optimizationMutation.data.recommendations.map((rec: any, index: number) => (
                <Paper key={index} sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Chip 
                      label={placementTypes.find(p => p.value === rec.placementType)?.label || rec.placementType}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    {rec.recommendation === 'increase' && <TrendingUpIcon color="success" />}
                    {rec.recommendation === 'decrease' && <TrendingDownIcon color="error" />}
                    {rec.recommendation === 'maintain' && <TrendingFlatIcon color="disabled" />}
                  </Box>
                  
                  <Typography variant="body2" gutterBottom>
                    {rec.message}
                  </Typography>
                  
                  <Grid container spacing={2} mt={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Current Rate
                      </Typography>
                      <Typography variant="body1">
                        ${rec.currentRate}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Suggested Rate
                      </Typography>
                      <Typography variant="body1">
                        ${rec.suggestedRate}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  <Box mt={1}>
                    <Chip 
                      label={`${rec.confidence}% Confidence`}
                      size="small"
                      color={rec.confidence >= 75 ? 'success' : rec.confidence >= 50 ? 'warning' : 'default'}
                    />
                  </Box>
                </Paper>
              ))}
            </Box>
          )}

          {optimizationMutation.error && (
            <Alert severity="error">
              {optimizationMutation.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOptimizationDialogOpen(false)}>
            Close
          </Button>
          <Button 
            onClick={handleOptimizationRequest}
            variant="contained"
            disabled={!showId || optimizationMutation.isPending}
          >
            {optimizationMutation.isPending ? 'Analyzing...' : 'Get Recommendations'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}