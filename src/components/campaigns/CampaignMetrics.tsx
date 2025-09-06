import { useState } from 'react'
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import { ChartContainer } from '@/components/charts/ChartContainer'
// Analytics API import removed to prevent accidental usage

interface CampaignMetricsProps {
  campaignId: string
}

export function CampaignMetrics({ campaignId }: CampaignMetricsProps) {
  const [timeRange, setTimeRange] = useState('7d')
  const [metricType, setMetricType] = useState('impressions')

  // Analytics API disabled to prevent infinite loop - using empty data
  const metrics = null
  const isLoading = false
  const error = null

  // Data structure interface
  interface ChartDataPoint {
    date: string
    impressions: number
    clicks: number
    conversions: number
    cost: number
  }

  // Empty data for when analytics API is disabled
  const emptyData: ChartDataPoint[] = []
  const chartData: ChartDataPoint[] = metrics?.data || emptyData

  const renderChart = () => {
    switch (metricType) {
      case 'impressions':
        return (
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="impressions" stroke="#8884d8" fill="#8884d8" />
          </AreaChart>
        )
      case 'engagement':
        return (
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="clicks" stroke="#8884d8" name="Clicks" />
            <Line type="monotone" dataKey="conversions" stroke="#82ca9d" name="Conversions" />
          </LineChart>
        )
      case 'cost':
        return (
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value}`} />
            <Bar dataKey="cost" fill="#8884d8" />
          </BarChart>
        )
      default:
        return null
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Metric Type</InputLabel>
          <Select
            value={metricType}
            label="Metric Type"
            onChange={(e) => setMetricType(e.target.value)}
          >
            <MenuItem value="impressions">Impressions</MenuItem>
            <MenuItem value="engagement">Engagement</MenuItem>
            <MenuItem value="cost">Cost Analysis</MenuItem>
          </Select>
        </FormControl>

        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={(_, newValue) => newValue && setTimeRange(newValue)}
          size="small"
        >
          <ToggleButton value="7d">7 Days</ToggleButton>
          <ToggleButton value="30d">30 Days</ToggleButton>
          <ToggleButton value="90d">90 Days</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <ChartContainer height={400}>
        {renderChart() || <div />}
      </ChartContainer>

      {/* Key Metrics Summary */}
      <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="textSecondary">
            Avg. Daily Impressions
          </Typography>
          <Typography variant="h6">
            {chartData.length > 0 ? (chartData.reduce((acc: number, d) => acc + d.impressions, 0) / chartData.length).toLocaleString() : '0'}
          </Typography>
        </Box>
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="textSecondary">
            Click-Through Rate
          </Typography>
          <Typography variant="h6">
            {chartData.length > 0 && chartData.reduce((acc: number, d) => acc + d.impressions, 0) > 0 
              ? ((chartData.reduce((acc: number, d) => acc + d.clicks, 0) / chartData.reduce((acc: number, d) => acc + d.impressions, 0)) * 100).toFixed(2)
              : '0.00'}%
          </Typography>
        </Box>
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="textSecondary">
            Conversion Rate
          </Typography>
          <Typography variant="h6">
            {chartData.length > 0 && chartData.reduce((acc: number, d) => acc + d.clicks, 0) > 0
              ? ((chartData.reduce((acc: number, d) => acc + d.conversions, 0) / chartData.reduce((acc: number, d) => acc + d.clicks, 0)) * 100).toFixed(2)
              : '0.00'}%
          </Typography>
        </Box>
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="textSecondary">
            Cost Per Conversion
          </Typography>
          <Typography variant="h6">
            ${chartData.length > 0 && chartData.reduce((acc: number, d) => acc + d.conversions, 0) > 0
              ? (chartData.reduce((acc: number, d) => acc + d.cost, 0) / chartData.reduce((acc: number, d) => acc + d.conversions, 0)).toFixed(2)
              : '0.00'}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}