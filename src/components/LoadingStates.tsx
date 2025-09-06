import { Skeleton, Box, Card, CardContent, Grid } from '@mui/material'

export function CampaignCardSkeleton() {
  return (
    <Card>
      <CardContent>
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="text" width="40%" height={20} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="text" width="30%" />
        </Box>
        <Skeleton variant="rectangular" height={8} sx={{ mb: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton variant="text" width="20%" />
          <Skeleton variant="text" width="20%" />
          <Skeleton variant="text" width="20%" />
        </Box>
      </CardContent>
    </Card>
  )
}

export function CampaignListSkeleton() {
  return (
    <Grid container spacing={3}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Grid item xs={12} md={6} lg={4} key={i}>
          <CampaignCardSkeleton />
        </Grid>
      ))}
    </Grid>
  )
}

export function DashboardMetricsSkeleton() {
  return (
    <Grid container spacing={3}>
      {[1, 2, 3, 4].map((i) => (
        <Grid item xs={12} sm={6} md={3} key={i}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="50%" height={20} />
              <Skeleton variant="text" width="80%" height={40} />
              <Skeleton variant="text" width="60%" height={16} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}

export function ChartSkeleton({ height = 400 }: { height?: number }) {
  return (
    <Box sx={{ width: '100%', height }}>
      <Skeleton variant="rectangular" width="100%" height="100%" />
    </Box>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Box>
      <Skeleton variant="rectangular" height={56} sx={{ mb: 1 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={52} sx={{ mb: 0.5 }} />
      ))}
    </Box>
  )
}