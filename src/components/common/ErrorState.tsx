'use client'

import { Box, Typography, Button, Paper } from '@mui/material'
import { ErrorOutline, Refresh, ArrowBack } from '@mui/icons-material'
import { useRouter } from 'next/navigation'

interface ErrorStateProps {
  title?: string
  message?: string
  showBackButton?: boolean
  showRefreshButton?: boolean
  backUrl?: string
  onRetry?: () => void
  height?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We encountered an error while loading this page.',
  showBackButton = true,
  showRefreshButton = true,
  backUrl,
  onRetry,
  height = '50vh'
}: ErrorStateProps) {
  const router = useRouter()

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl)
    } else {
      router.back()
    }
  }

  const handleRefresh = () => {
    if (onRetry) {
      onRetry()
    } else if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height,
        px: 2
      }}
    >
      <Paper 
        sx={{ 
          p: 4, 
          textAlign: 'center', 
          maxWidth: 400,
          width: '100%'
        }}
        elevation={1}
      >
        <ErrorOutline 
          sx={{ 
            fontSize: 64, 
            color: 'error.main', 
            mb: 2 
          }} 
        />
        <Typography variant="h5" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {message}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          {showBackButton && (
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={handleBack}
            >
              Go Back
            </Button>
          )}
          {showRefreshButton && (
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={handleRefresh}
            >
              Try Again
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  )
}