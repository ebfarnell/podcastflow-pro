'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface PermissionGuardProps {
  children: ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  fallback?: ReactNode
  roles?: string[] // Legacy support
}

/**
 * Component that conditionally renders children based on user permissions
 * Useful for hiding/showing UI elements based on user access
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  roles // Legacy role-based support
}: PermissionGuardProps) {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth()

  if (!user) {
    return <>{fallback}</>
  }

  // Legacy role-based check (deprecated but still supported)
  if (roles && roles.length > 0) {
    if (!roles.includes(user.role)) {
      return <>{fallback}</>
    }
  }

  // Permission-based checks
  if (permission) {
    if (!hasPermission(permission)) {
      return <>{fallback}</>
    }
  }

  if (permissions && permissions.length > 0) {
    const hasRequiredPermissions = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions)
    
    if (!hasRequiredPermissions) {
      return <>{fallback}</>
    }
  }

  // User has required permissions, render children
  return <>{children}</>
}

/**
 * Hook for permission checking in components
 */
export function usePermissions() {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth()

  return {
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccess: (permission?: string, permissions?: string[], requireAll = false) => {
      if (!user) return false
      
      if (permission) {
        return hasPermission(permission)
      }
      
      if (permissions && permissions.length > 0) {
        return requireAll 
          ? hasAllPermissions(permissions) 
          : hasAnyPermission(permissions)
      }
      
      return true
    },
    // Legacy role-based helper (deprecated)
    hasRole: (role: string) => user?.role === role,
    hasAnyRole: (roles: string[]) => user ? roles.includes(user.role) : false
  }
}