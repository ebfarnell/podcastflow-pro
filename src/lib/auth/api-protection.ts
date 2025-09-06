import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { hasPermission, hasAnyPermission, hasAllPermissions } from '@/types/auth'

export interface ApiProtectionConfig {
  requiredPermission?: string
  requiredPermissions?: string[]
  requireAllPermissions?: boolean
  allowedRoles?: string[] // Legacy support, prefer permissions
}

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string
    email: string
    name: string
    role: string
    organizationId: string
  }
}

/**
 * API route protection middleware
 * Validates authentication and permissions for API endpoints
 */
export async function withApiProtection(
  handler: (request: AuthenticatedRequest, context?: any) => Promise<NextResponse>,
  config?: ApiProtectionConfig
) {
  return async function protectedHandler(
    request: AuthenticatedRequest,
    context?: any
  ): Promise<NextResponse> {
    try {
      // Get session and verify authentication
      const authToken = request.cookies.get('auth-token')?.value
      if (!authToken) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      const user = await UserService.validateSession(authToken)
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid session' },
          { status: 401 }
        )
      }

      // Attach user to request
      request.user = user

      // Check permissions if specified
      if (config) {
        const { 
          requiredPermission, 
          requiredPermissions, 
          requireAllPermissions = false,
          allowedRoles 
        } = config

        // Legacy role check (deprecated - prefer permissions)
        if (allowedRoles && !allowedRoles.includes(user.role)) {
          return NextResponse.json(
            { 
              error: 'Insufficient permissions',
              details: `Role '${user.role}' is not authorized for this operation`
            },
            { status: 403 }
          )
        }

        // Modern permission-based check
        if (requiredPermission) {
          if (!hasPermission(user.role, requiredPermission)) {
            return NextResponse.json(
              { 
                error: 'Insufficient permissions',
                details: `Missing required permission: ${requiredPermission}`
              },
              { status: 403 }
            )
          }
        }

        if (requiredPermissions && requiredPermissions.length > 0) {
          const hasRequiredPerms = requireAllPermissions
            ? hasAllPermissions(user.role, requiredPermissions)
            : hasAnyPermission(user.role, requiredPermissions)

          if (!hasRequiredPerms) {
            const permType = requireAllPermissions ? 'all' : 'any'
            return NextResponse.json(
              { 
                error: 'Insufficient permissions',
                details: `Missing required permissions (need ${permType} of): ${requiredPermissions.join(', ')}`
              },
              { status: 403 }
            )
          }
        }
      }

      // All checks passed, call the handler
      return await handler(request, context)
    } catch (error) {
      console.error('API protection error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Simpler protection for API routes that only need authentication
 */
export async function withAuth(
  handler: (request: AuthenticatedRequest, context?: any) => Promise<NextResponse>
) {
  return withApiProtection(handler)
}

/**
 * Protection for admin-only API routes
 */
export async function withAdminProtection(
  handler: (request: AuthenticatedRequest, context?: any) => Promise<NextResponse>
) {
  return withApiProtection(handler, {
    allowedRoles: ['master', 'admin']
  })
}

/**
 * Protection for master-only API routes
 */
export async function withMasterProtection(
  handler: (request: AuthenticatedRequest, context?: any) => Promise<NextResponse>
) {
  return withApiProtection(handler, {
    allowedRoles: ['master']
  })
}

/**
 * Helper function to check user permissions in API routes
 */
export function checkUserPermissions(
  userRole: string,
  requiredPermission?: string,
  requiredPermissions?: string[],
  requireAllPermissions = false
): boolean {
  if (requiredPermission) {
    return hasPermission(userRole, requiredPermission)
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    return requireAllPermissions
      ? hasAllPermissions(userRole, requiredPermissions)
      : hasAnyPermission(userRole, requiredPermissions)
  }

  return true
}

/**
 * Extract user from authenticated request
 */
export function getRequestUser(request: AuthenticatedRequest) {
  return request.user
}