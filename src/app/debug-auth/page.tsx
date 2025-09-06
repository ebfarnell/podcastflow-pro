'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography } from '@mui/material'

export default function DebugAuthPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to home in production
    if (process.env.NODE_ENV === 'production') {
      router.push('/')
    }
  }, [router])
  
  if (process.env.NODE_ENV === 'production') {
    return null
  }
  
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Debug Auth Page - Development Only
      </Typography>
      
      <Box sx={{ mt: 4, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
        <Typography variant="h6">⚠️ Development Environment Only</Typography>
        <Typography>This page is disabled in production.</Typography>
        <Typography>Test credentials should be stored in environment variables or AWS Secrets Manager.</Typography>
      </Box>
    </Box>
  )
}