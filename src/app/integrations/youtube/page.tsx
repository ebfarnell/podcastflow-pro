'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { YouTubeIntegration } from '@/components/integrations/YouTubeIntegration'
import { Box, Typography, IconButton } from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'

export default function YouTubeIntegrationPage() {
  const router = useRouter()

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={() => router.back()} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            YouTube Integration
          </Typography>
        </Box>
        
        <YouTubeIntegration />
      </Box>
    </DashboardLayout>
  )
}