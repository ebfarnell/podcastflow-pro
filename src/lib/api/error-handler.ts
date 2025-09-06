/**
 * Centralized API error handling utilities
 */

export interface ApiError {
  status: number
  message: string
  details?: any
  isAuthError: boolean
  isPermissionError: boolean
  isNotFound: boolean
  isValidationError: boolean
  isServerError: boolean
}

/**
 * Parse API error responses into a consistent format
 */
export function parseApiError(error: any): ApiError {
  const status = error?.response?.status || error?.status || 500
  const data = error?.response?.data || error?.data || error
  
  // Extract error message
  let message = 'An unexpected error occurred'
  if (typeof data === 'string') {
    message = data
  } else if (data?.error) {
    message = data.error
  } else if (data?.message) {
    message = data.message
  } else if (error?.message) {
    message = error.message
  }
  
  // Categorize error type
  const isAuthError = status === 401 && (
    message.toLowerCase().includes('authentication') ||
    message.toLowerCase().includes('unauthorized') ||
    message.toLowerCase().includes('session') ||
    message.toLowerCase().includes('token')
  )
  
  const isPermissionError = status === 403 || (
    status === 401 && (
      message.toLowerCase().includes('permission') ||
      message.toLowerCase().includes('forbidden') ||
      message.toLowerCase().includes('access denied')
    )
  )
  
  const isNotFound = status === 404
  const isValidationError = status === 400
  const isServerError = status >= 500
  
  return {
    status,
    message,
    details: data,
    isAuthError,
    isPermissionError,
    isNotFound,
    isValidationError,
    isServerError
  }
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyErrorMessage(error: ApiError): string {
  if (error.isAuthError) {
    return 'Your session has expired. Please log in again.'
  }
  
  if (error.isPermissionError) {
    return 'You do not have permission to access this resource.'
  }
  
  if (error.isNotFound) {
    return 'The requested resource was not found.'
  }
  
  if (error.isValidationError) {
    return error.message || 'Please check your input and try again.'
  }
  
  if (error.isServerError) {
    return 'A server error occurred. Please try again later.'
  }
  
  return error.message || 'An unexpected error occurred.'
}

/**
 * Log API errors with appropriate detail level
 */
export function logApiError(context: string, error: any): void {
  const parsedError = parseApiError(error)
  
  console.error(`❌ API Error in ${context}:`, {
    status: parsedError.status,
    message: parsedError.message,
    isAuthError: parsedError.isAuthError,
    isPermissionError: parsedError.isPermissionError,
    details: parsedError.details,
    originalError: error
  })
  
  // Don't log sensitive auth details in production
  if (process.env.NODE_ENV === 'development') {
    console.error('Full error:', error)
  }
}

/**
 * Handle API errors in React Query
 */
export function handleQueryError(error: any): void {
  const parsedError = parseApiError(error)
  
  // Only redirect for true auth errors (not permission errors)
  // Skip redirect for episode pages - let component handle auth gracefully
  if (parsedError.isAuthError && typeof window !== 'undefined') {
    const pathname = window.location.pathname
    if (!pathname.includes('/login') && !pathname.includes('/episodes/')) {
      console.log('Session expired - redirecting to login')
      window.location.href = '/login'
    } else if (pathname.includes('/episodes/')) {
      console.log('🛑 Error Handler: Skipping redirect for episode page, letting component handle auth')
    }
  }
  
  // Let React Query handle the error display
  throw error
}