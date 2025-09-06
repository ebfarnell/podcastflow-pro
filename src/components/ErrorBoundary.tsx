import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Button, Typography, Container } from '@mui/material'
import { Error as ErrorIcon } from '@mui/icons-material'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
    
    // Enhanced debugging for React error #310
    if (error.message && error.message.includes('310')) {
      console.error('=== REACT ERROR #310 DEBUGGING ===')
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      console.error('Component stack:', errorInfo.componentStack)
      console.error('Props at error time:', errorInfo)
      
      // Log current state of arrays that might be causing issues
      const stateSnapshot = {
        timestamp: new Date().toISOString(),
        pathname: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
      }
      console.error('State snapshot at error:', stateSnapshot)
    }
    
    // Check if it's a chunk loading error (browser only)
    if (error.message && error.message.includes('Loading chunk') && typeof window !== 'undefined') {
      console.log('Chunk loading error detected, reloading page...')
      window.location.reload()
      return
    }
    
    // Here you could send error to monitoring service like Sentry
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard'
    }
  }

  public render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes('Loading chunk')
      
      // For chunk errors, show updating message
      if (isChunkError) {
        return (
          <Container maxWidth="sm">
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                textAlign: 'center',
                gap: 3
              }}
            >
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <ErrorIcon sx={{ fontSize: 64, color: 'info.main', animation: 'spin 2s linear infinite' }} />
              </Box>
              <Typography variant="h4" component="h1" gutterBottom>
                Updating Application...
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Please wait while we refresh the page with the latest version.
              </Typography>
            </Box>
          </Container>
        )
      }
      
      return (
        <Container maxWidth="sm">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              textAlign: 'center',
              gap: 3
            }}
          >
            <ErrorIcon sx={{ fontSize: 64, color: 'error.main' }} />
            <Typography variant="h4" component="h1" gutterBottom>
              Oops! Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              We're sorry for the inconvenience. The application encountered an unexpected error.
            </Typography>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  width: '100%',
                  maxWidth: 600,
                  overflow: 'auto'
                }}
              >
                <Typography variant="caption" component="pre" sx={{ textAlign: 'left' }}>
                  {this.state.error.toString()}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="contained" onClick={this.handleReset}>
                Go to Dashboard
              </Button>
              <Button variant="outlined" onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload()
                }
              }}>
                Reload Page
              </Button>
            </Box>
          </Box>
        </Container>
      )
    }

    return this.props.children
  }
}