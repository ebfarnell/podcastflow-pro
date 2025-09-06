'use client'

import { ReactNode } from 'react'
import { ErrorState } from './ErrorState'

interface QueryErrorBoundaryProps {
  children: ReactNode
  error: any
  isLoading: boolean
  loadingComponent?: ReactNode
  errorTitle?: string
  errorMessage?: string
  backUrl?: string
  onRetry?: () => void
}

export function QueryErrorBoundary({
  children,
  error,
  isLoading,
  loadingComponent,
  errorTitle,
  errorMessage,
  backUrl,
  onRetry
}: QueryErrorBoundaryProps) {
  if (isLoading) {
    return loadingComponent || null
  }

  if (error) {
    // Handle different types of errors
    let title = errorTitle || 'Unable to load data'
    let message = errorMessage || 'We encountered an error while fetching the data.'

    // Check for specific error types
    if (error?.response?.status === 404) {
      title = 'Not Found'
      message = 'The requested resource could not be found.'
    } else if (error?.response?.status === 403) {
      title = 'Access Denied'
      message = 'You don\'t have permission to access this resource.'
    } else if (error?.response?.status === 401) {
      title = 'Authentication Required'
      message = 'Please log in to access this resource.'
    } else if (error?.response?.status >= 500) {
      title = 'Server Error'
      message = 'Our servers are experiencing issues. Please try again later.'
    } else if (error?.name === 'NetworkError' || error?.message?.includes('fetch')) {
      title = 'Connection Error'
      message = 'Unable to connect to the server. Please check your internet connection.'
    }

    return (
      <ErrorState
        title={title}
        message={message}
        backUrl={backUrl}
        onRetry={onRetry}
        showRefreshButton={!!onRetry}
      />
    )
  }

  return <>{children}</>
}