import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { useTheme } from '@mui/material/styles'
import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material'
import { ChartContainer } from '@/components/charts/ChartContainer'

interface RevenueChartProps {
  data?: Array<{
    month: string
    revenue: number
    target?: number
  }>
}

export function RevenueChart({ data }: RevenueChartProps) {
  const theme = useTheme()

  const formatCurrency = (value: number) => {
    return `$${(value / 1000).toFixed(0)}K`
  }

  // Use provided targets or calculate based on revenue trend
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    return data.map((item, index) => {
      // Use provided target if available, otherwise calculate 10% growth
      const target = item.target !== undefined 
        ? item.target 
        : Math.round((index > 0 ? data[index - 1].revenue : item.revenue) * 1.1)
      
      return {
        month: item.month,
        revenue: item.revenue,
        target: target
      }
    })
  }, [data])

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Revenue Trend
          </Typography>
          <Skeleton variant="rectangular" height={300} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Revenue Trend
        </Typography>
        <ChartContainer height={300}>
          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 30,
              left: 20,
              bottom: 20,
            }}
          >
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis
          dataKey="month"
          stroke={theme.palette.text.secondary}
        />
        <YAxis
          stroke={theme.palette.text.secondary}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Actual Revenue"
          stroke={theme.palette.primary.main}
          strokeWidth={2}
          dot={{ fill: theme.palette.primary.main }}
        />
        <Line
          type="monotone"
          dataKey="target"
          name="Target Revenue"
          stroke={theme.palette.secondary.main}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: theme.palette.secondary.main }}
        />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}