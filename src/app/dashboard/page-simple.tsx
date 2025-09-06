'use client'

import { Box, Typography } from '@mui/material'
import { DashboardLayoutSimple as DashboardLayout } from '@/components/layout/DashboardLayout-simple'

export default function SimpleDashboardPage() {
  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1">
          Dashboard is loading...
        </Typography>
      </Box>
    </DashboardLayout>
  )
}