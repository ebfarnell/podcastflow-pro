import { Card, CardContent, Typography, Box } from '@mui/material'
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material'

interface MetricsCardProps {
  title: string
  value: string
  change: string
  trend: 'up' | 'down' | 'neutral'
}

export function MetricsCard({ title, value, change, trend }: MetricsCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp sx={{ color: 'success.main' }} />
      case 'down':
        return <TrendingDown sx={{ color: 'error.main' }} />
      default:
        return <TrendingFlat sx={{ color: 'text.secondary' }} />
    }
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'success.main'
      case 'down':
        return 'error.main'
      default:
        return 'text.secondary'
    }
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <CardContent sx={{ flex: 1 }}>
        <Typography color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" component="div">
          {value}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          {getTrendIcon()}
          <Typography
            variant="body2"
            sx={{ color: getTrendColor(), ml: 0.5 }}
          >
            {change}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}