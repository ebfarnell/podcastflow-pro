import { ReactNode } from 'react'
import { Card, CardContent, Typography, Box, Avatar } from '@mui/material'
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material'

interface KPICardProps {
  title: string
  value: string
  change: string
  trend: 'up' | 'down' | 'neutral'
  icon: ReactNode
  color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info'
}

export function KPICard({ title, value, change, trend, icon, color }: KPICardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp sx={{ fontSize: 16 }} />
      case 'down':
        return <TrendingDown sx={{ fontSize: 16 }} />
      default:
        return <TrendingFlat sx={{ fontSize: 16 }} />
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
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ mb: 1 }}>
              {value}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {getTrendIcon()}
              <Typography
                variant="body2"
                sx={{ color: getTrendColor() }}
              >
                {change}
              </Typography>
            </Box>
          </Box>
          <Avatar
            sx={{
              bgcolor: `${color}.light`,
              color: `${color}.main`,
              width: 48,
              height: 48,
            }}
          >
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  )
}