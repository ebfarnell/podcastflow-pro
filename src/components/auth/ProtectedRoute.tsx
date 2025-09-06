'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Box, Typography, Button } from '@mui/material'
import { LockOutlined } from '@mui/icons-material'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermissions?: string[]
  requiredRoles?: string[]
  fallbackUrl?: string
}

export function ProtectedRoute({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  fallbackUrl = '/dashboard'
}: ProtectedRouteProps) {
  const router = useRouter()
  const { user, isLoading, hasAllPermissions } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      // Check if we're on a page that shouldn't redirect
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname
        if (pathname === '/master/impersonate' || pathname === '/master/impersonate-standalone' || pathname === '/login') {
          console.log('🔍 ProtectedRoute: Skipping redirect for', pathname)
          return
        }
      }
      router.push('/login')
    }
  }, [isLoading, user, router])

  // Check role-based access
  const hasRequiredRole = requiredRoles.length === 0 || 
    (user && requiredRoles.includes(user.role))

  // Check permission-based access
  const hasRequiredPermissions = requiredPermissions.length === 0 || 
    hasAllPermissions(requiredPermissions)

  // Show loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh'
        }}
      >
        <Typography>Loading...</Typography>
      </Box>
    )
  }

  // Not logged in
  if (!user) {
    return null
  }

  // Access denied
  if (!hasRequiredRole || !hasRequiredPermissions) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 3
        }}
      >
        <LockOutlined sx={{ fontSize: 64, color: 'text.secondary' }} />
        <Typography variant="h4" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          You don't have permission to access this page.
        </Typography>
        <Button
          variant="contained"
          onClick={() => router.push(fallbackUrl)}
        >
          Go to Dashboard
        </Button>
      </Box>
    )
  }

  // Access granted
  return <>{children}</>
}

// Role-specific route guards
export function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      {children}
    </ProtectedRoute>
  )
}

export function SellerRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['admin', 'sales']}>
      {children}
    </ProtectedRoute>
  )
}

export function ProducerRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['admin', 'producer']}>
      {children}
    </ProtectedRoute>
  )
}

export function TalentRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['admin', 'talent']}>
      {children}
    </ProtectedRoute>
  )
}

export function ClientRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['admin', 'client']}>
      {children}
    </ProtectedRoute>
  )
}