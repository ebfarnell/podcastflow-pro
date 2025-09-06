'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/auth'
import { Box, Typography, Button } from '@mui/material'
import { useRouter } from 'next/navigation'
import LockIcon from '@mui/icons-material/Lock'

interface RoleGuardProps {
  children: React.ReactNode
  roles?: UserRole[]
  permissions?: string[]
  requireAll?: boolean
  fallback?: React.ReactNode
}

export function RoleGuard({
  children,
  roles,
  permissions,
  requireAll = true,
  fallback,
}: RoleGuardProps) {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth()
  const router = useRouter()

  // Check role-based access
  const hasRequiredRole = !roles || (user && roles.includes(user.role))

  // Check permission-based access
  let hasRequiredPermissions = true
  if (permissions && permissions.length > 0) {
    hasRequiredPermissions = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions)
  }

  // Grant access if both role and permission checks pass
  const hasAccess = hasRequiredRole && hasRequiredPermissions

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          textAlign: 'center',
          p: 4,
        }}
      >
        <LockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          You don't have permission to access this resource.
        </Typography>
        <Button variant="contained" onClick={() => router.back()}>
          Go Back
        </Button>
      </Box>
    )
  }

  return <>{children}</>
}

// Convenience components for common role checks
export function AdminOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard roles={['master', 'admin']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export function SellerOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard roles={['sales']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export function ProducerOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard roles={['producer']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export function SellerOrAdmin({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard roles={['sales', 'admin']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export function MasterOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard roles={['master']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

/**
 * Permission-based access control component
 * 
 * @param children - React nodes to render if permission check passes
 * @param permission - Single permission string to check
 * @param permissions - Array of permissions to check (alternative to single permission)
 * @param requireAll - If true, requires all permissions. If false, requires at least one. Default: true
 * @param fallback - Optional fallback component to render if permission check fails
 * 
 * @example
 * // Single permission
 * <HasPermission permission={PERMISSIONS.ORDERS_VIEW}>
 *   <OrdersList />
 * </HasPermission>
 * 
 * @example
 * // Multiple permissions (requires all)
 * <HasPermission permissions={[PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_UPDATE]}>
 *   <UserManagement />
 * </HasPermission>
 * 
 * @example
 * // Multiple permissions (requires any)
 * <HasPermission permissions={[PERMISSIONS.SALES_VIEW, PERMISSIONS.ADMIN_VIEW]} requireAll={false}>
 *   <SalesReport />
 * </HasPermission>
 */
export function HasPermission({ 
  children, 
  permission, 
  permissions,
  requireAll = true,
  fallback 
}: { 
  children: React.ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  fallback?: React.ReactNode 
}) {
  const permissionList = permission ? [permission] : permissions || []
  
  return (
    <RoleGuard permissions={permissionList} requireAll={requireAll} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export default RoleGuard