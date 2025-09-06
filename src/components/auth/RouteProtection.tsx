'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Box, Typography, Button, Alert } from '@mui/material'
import { Lock, ArrowBack } from '@mui/icons-material'

interface RouteProtectionProps {
  children: ReactNode
  requiredPermission?: string
  requiredPermissions?: string[]
  requireAllPermissions?: boolean // If true, user must have ALL permissions. If false (default), user needs ANY permission
  fallbackUrl?: string
  customErrorMessage?: string
}

export function RouteProtection({
  children,
  requiredPermission,
  requiredPermissions,
  requireAllPermissions = false,
  fallbackUrl = '/dashboard',
  customErrorMessage
}: RouteProtectionProps) {
  const { user, isLoading, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth()
  const router = useRouter()
  const [redirectTimer, setRedirectTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Clear any existing timer when dependencies change
    if (redirectTimer) {
      clearTimeout(redirectTimer)
      setRedirectTimer(null)
    }

    console.log('🔐 RouteProtection - Auth check:', {
      isLoading,
      hasUser: !!user,
      userEmail: user?.email,
      pathname: typeof window !== 'undefined' ? window.location.pathname : 'SSR'
    })

    // Only redirect if we're certain auth check is complete and user is not authenticated
    if (!isLoading && !user) {
      // SSR Fix: Guard all browser API access to prevent "location is not defined" errors
      // This check ensures window.location and router.push are only accessed on the client
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname
        // Skip redirect for auth-related pages to prevent redirect loops
        if (pathname === '/master/impersonate' || pathname === '/master/impersonate-standalone' || pathname === '/login') {
          console.log('🔍 RouteProtection: Skipping redirect for', pathname)
          return
        }
        
        console.log('🔐 RouteProtection - No user detected, will redirect in 300ms')
        
        // Add a small delay before redirecting to ensure auth context has fully loaded
        // This prevents premature redirects during client-side navigation
        const timer = setTimeout(() => {
          console.log('🔒 RouteProtection: No user after delay, redirecting to login')
          router.push('/login')
        }, 300) // 300ms delay to allow auth context to settle
        
        setRedirectTimer(timer)
      }
    } else if (!isLoading && user) {
      console.log('🔐 RouteProtection - User authenticated:', user.email)
    }

    // Cleanup function
    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer)
      }
    }
  }, [isLoading, user, router])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <Box sx={{
          width: 40,
          height: 40,
          border: '4px solid #e3f2fd',
          borderTop: '4px solid #2196f3',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          '@keyframes spin': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' }
          }
        }} />
        <Typography variant="body2" color="text.secondary">
          Checking permissions...
        </Typography>
      </Box>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return null
  }

  // Check permissions if specified
  if (requiredPermission || requiredPermissions) {
    let hasRequiredPermissions = false

    if (requiredPermission) {
      hasRequiredPermissions = hasPermission(requiredPermission)
    } else if (requiredPermissions) {
      if (requireAllPermissions) {
        hasRequiredPermissions = hasAllPermissions(requiredPermissions)
      } else {
        hasRequiredPermissions = hasAnyPermission(requiredPermissions)
      }
    }

    if (!hasRequiredPermissions) {
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          gap: 3,
          textAlign: 'center',
          px: 3
        }}>
          <Lock sx={{ fontSize: 80, color: 'text.secondary' }} />
          
          <Box>
            <Typography variant="h4" gutterBottom>
              Access Denied
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {customErrorMessage || 'You don\'t have permission to access this page.'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your role ({user.role}) doesn't include the required permissions for this feature.
            </Typography>
          </Box>

          <Alert severity="info" sx={{ maxWidth: 600 }}>
            <Typography variant="body2">
              If you believe you should have access to this page, please contact your administrator 
              to review your role permissions.
            </Typography>
          </Alert>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => router.back()}
            >
              Go Back
            </Button>
            <Button
              variant="contained"
              onClick={() => router.push(fallbackUrl)}
            >
              Go to Dashboard
            </Button>
          </Box>
        </Box>
      )
    }
  }

  // User has permission, render the protected content
  return <>{children}</>
}

// Higher-order component version for easier use
export function withRouteProtection<P extends object>(
  Component: React.ComponentType<P>,
  protectionConfig: Omit<RouteProtectionProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <RouteProtection {...protectionConfig}>
        <Component {...props} />
      </RouteProtection>
    )
  }
}

// Hook for checking permissions within components
export function useRouteProtection() {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth()
  
  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccess: (permission?: string, permissions?: string[], requireAll = false) => {
      if (permission) {
        return hasPermission(permission)
      }
      if (permissions) {
        return requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions)
      }
      return true
    }
  }
}