import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar
} from '@mui/material'
import { TrendingUp, TrendingDown } from '@mui/icons-material'

interface Show {
  id: string
  name: string
  host: string
  category: string
  revenue: string
  impressions: string
  trend: 'up' | 'down' | 'stable'
  change: number
}

interface TopShowsProps {
  shows: Show[]
}

export default function TopShows({ shows }: TopShowsProps) {
  if (!shows || shows.length === 0) {
    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom>
            Top 5 Performing Shows
          </Typography>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No show performance data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  const getTrendIcon = (trend: Show['trend']) => {
    if (trend === 'up') return <TrendingUp color="success" />
    if (trend === 'down') return <TrendingDown color="error" />
    return undefined
  }

  const getTrendColor = (trend: Show['trend']) => {
    if (trend === 'up') return 'success'
    if (trend === 'down') return 'error'
    return 'default'
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom>
          Top Performing Shows
        </Typography>
        <TableContainer sx={{ flex: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Show</TableCell>
                <TableCell align="right">Revenue</TableCell>
                <TableCell align="right">Impressions</TableCell>
                <TableCell align="right">Trend</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shows.map((show) => (
                <TableRow key={show.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                        {show.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {show.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {show.host} • {show.category}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {show.revenue}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {show.impressions}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      icon={getTrendIcon(show.trend)}
                      label={`${show.change > 0 ? '+' : ''}${show.change}%`}
                      size="small"
                      color={getTrendColor(show.trend)}
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}