'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteProtection } from '@/components/auth/RouteProtection'
import { PERMISSIONS } from '@/types/auth'
import { MegaphoneIntegrationSetup } from '@/components/integrations/MegaphoneIntegrationSetup'
import { Box, Typography } from '@mui/material'

export default function MegaphoneIntegrationPage() {
  return (
    <RouteProtection requiredPermission={PERMISSIONS.ADMIN_ACCESS}>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Megaphone Integration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Connect your organization to Megaphone for automated podcast analytics, revenue tracking, and data synchronization.
          </Typography>
        </Box>

        <MegaphoneIntegrationSetup />
      </DashboardLayout>
    </RouteProtection>
  )
}