import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartContainer } from '@/components/charts/ChartContainer'
import { getCampaignStatusColor } from '@/lib/theme/colors'

interface CampaignStatusData {
  status: string
  count: number
  percentage: number
}

interface CampaignStatusChartProps {
  data: CampaignStatusData[]
}

export default function CampaignStatusChart({ data }: CampaignStatusChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Campaign Distribution
          </Typography>
          <Skeleton variant="rectangular" height={300} />
        </CardContent>
      </Card>
    )
  }

  // Transform data to include name field for legend
  const chartData = data.map(item => ({
    name: item.status,
    value: item.count,
    percentage: item.percentage,
    fill: getCampaignStatusColor(item.status)
  }))

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Campaign Distribution
        </Typography>
        <ChartContainer height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              dataKey="value"
              nameKey="name"
              label={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value, name) => [`${value} campaign${value !== 1 ? 's' : ''}`, name]}
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc' }}
            />
            <Legend 
              verticalAlign="bottom"
              align="center"
              layout="horizontal"
              wrapperStyle={{
                paddingTop: '10px',
                fontSize: '12px'
              }}
              formatter={(value, entry) => `${value} (${entry.payload.percentage}%)`}
              iconSize={14}
              iconType="square"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}