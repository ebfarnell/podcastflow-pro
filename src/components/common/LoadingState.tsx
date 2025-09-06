'use client'

import { Box, CircularProgress, Typography, Skeleton, Paper } from '@mui/material'

interface LoadingStateProps {
  message?: string
  height?: string
  variant?: 'spinner' | 'skeleton' | 'detailed'
  skeletonRows?: number
}

export function LoadingState({
  message = 'Loading...',
  height = '50vh',
  variant = 'spinner',
  skeletonRows = 3
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        {Array.from({ length: skeletonRows }, (_, index) => (
          <Skeleton key={index} variant="rectangular" height={40} sx={{ mb: 1 }} />
        ))}
      </Box>
    )
  }

  if (variant === 'detailed') {
    return (
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center', mb: 3 }}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {message}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please wait while we load your data...
          </Typography>
        </Paper>
        
        {/* Loading skeleton for content */}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {Array.from({ length: 4 }, (_, index) => (
            <Paper key={index} sx={{ p: 2 }}>
              <Skeleton variant="text" height={24} sx={{ mb: 1 }} />
              <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
              <Skeleton variant="text" height={20} width="60%" />
            </Paper>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height,
        gap: 2
      }}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" color="text.secondary">
        {message}
      </Typography>
    </Box>
  )
}