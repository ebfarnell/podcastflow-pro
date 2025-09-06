// Production-ready API service with organization isolation

import { organizationService, OrganizationUser, Organization } from './organizationService'

export interface ApiContext {
  userId: string
  organizationId: string
  role: string
  permissions: string[]
}

export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
}

export interface ApiError {
  code: string
  message: string
  status: number
}

class ApiService {
  private currentContext: ApiContext | null = null

  setContext(context: ApiContext) {
    this.currentContext = context
  }

  getContext(): ApiContext | null {
    return this.currentContext
  }

  private requireAuth(): ApiContext {
    if (!this.currentContext) {
      throw this.createError('UNAUTHORIZED', 'Authentication required', 401)
    }
    return this.currentContext
  }

  private createError(code: string, message: string, status: number): ApiError {
    return { code, message, status }
  }

  private hasPermission(permission: string): boolean {
    const context = this.currentContext
    if (!context) return false
    
    // Master accounts have all permissions
    if (context.role === 'master') return true
    
    return context.permissions.includes(permission)
  }

  private canAccessOrganization(targetOrgId: string): boolean {
    const context = this.currentContext
    if (!context) return false
    
    return organizationService.canAccessOrganization(
      context.organizationId, 
      targetOrgId, 
      context.role
    )
  }

  // User API endpoints
  async getUsers(params: {
    role?: string
    status?: string
    search?: string
    page?: number
    limit?: number
  } = {}): Promise<ApiResponse<OrganizationUser[]>> {
    const context = this.requireAuth()

    if (!this.hasPermission('user:read')) {
      throw this.createError('FORBIDDEN', 'Insufficient permissions to read users', 403)
    }

    let users: OrganizationUser[]

    if (context.role === 'master') {
      // Master accounts see all users across all organizations
      users = organizationService.getAllUsers()
      
      // Add organization names for master view
      users = users.map(user => ({
        ...user,
        organizationName: organizationService.getOrganization(user.organizationId)?.name
      })) as OrganizationUser[]
    } else {
      // Regular accounts see only their organization's users
      users = organizationService.getUsersByOrganization(context.organizationId, {
        role: params.role,
        status: params.status,
        search: params.search
      })
    }

    // Apply pagination
    const page = params.page || 1
    const limit = params.limit || 50
    const start = (page - 1) * limit
    const paginatedUsers = users.slice(start, start + limit)

    return {
      data: paginatedUsers,
      success: true,
      meta: {
        total: users.length,
        page,
        limit
      }
    }
  }

  async getUser(userId: string): Promise<ApiResponse<OrganizationUser>> {
    const context = this.requireAuth()

    if (!this.hasPermission('user:read')) {
      throw this.createError('FORBIDDEN', 'Insufficient permissions to read user', 403)
    }

    const user = organizationService.getUser(userId)
    if (!user) {
      throw this.createError('NOT_FOUND', 'User not found', 404)
    }

    if (!organizationService.canAccessUser(context.organizationId, userId, context.role)) {
      throw this.createError('FORBIDDEN', 'Cannot access user from different organization', 403)
    }

    return {
      data: user,
      success: true
    }
  }

  async createUser(userData: {
    email: string
    name: string
    role: 'admin' | 'seller' | 'producer' | 'talent' | 'client'
    phone?: string
  }): Promise<ApiResponse<OrganizationUser>> {
    const context = this.requireAuth()

    if (!this.hasPermission('user:write')) {
      throw this.createError('FORBIDDEN', 'Insufficient permissions to create user', 403)
    }

    // Check if user already exists
    const existingUser = organizationService.getUserByEmail(userData.email)
    if (existingUser) {
      throw this.createError('CONFLICT', 'User with this email already exists', 409)
    }

    // Set default permissions based on role
    const permissions = this.getDefaultPermissions(userData.role)

    const newUser = organizationService.createUser({
      ...userData,
      status: 'active',
      organizationId: context.organizationId,
      permissions
    })

    return {
      data: newUser,
      success: true,
      message: 'User created successfully'
    }
  }

  async updateUser(userId: string, updates: {
    name?: string
    email?: string
    role?: 'admin' | 'seller' | 'producer' | 'talent' | 'client'
    phone?: string
    status?: 'active' | 'inactive' | 'suspended'
  }): Promise<ApiResponse<OrganizationUser>> {
    const context = this.requireAuth()

    if (!this.hasPermission('user:write')) {
      throw this.createError('FORBIDDEN', 'Insufficient permissions to update user', 403)
    }

    if (!organizationService.canAccessUser(context.organizationId, userId, context.role)) {
      throw this.createError('FORBIDDEN', 'Cannot update user from different organization', 403)
    }

    const updatedUser = organizationService.updateUser(userId, updates)
    if (!updatedUser) {
      throw this.createError('NOT_FOUND', 'User not found', 404)
    }

    return {
      data: updatedUser,
      success: true,
      message: 'User updated successfully'
    }
  }

  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    const context = this.requireAuth()

    if (!this.hasPermission('user:delete')) {
      throw this.createError('FORBIDDEN', 'Insufficient permissions to delete user', 403)
    }

    if (!organizationService.canAccessUser(context.organizationId, userId, context.role)) {
      throw this.createError('FORBIDDEN', 'Cannot delete user from different organization', 403)
    }

    const deleted = organizationService.deleteUser(userId)
    if (!deleted) {
      throw this.createError('NOT_FOUND', 'User not found', 404)
    }

    return {
      data: undefined,
      success: true,
      message: 'User deleted successfully'
    }
  }

  async updateUserRole(userId: string, role: string): Promise<ApiResponse<OrganizationUser>> {
    const context = this.requireAuth()

    if (!this.hasPermission('user:write')) {
      throw this.createError('FORBIDDEN', 'Insufficient permissions to update user role', 403)
    }

    const permissions = this.getDefaultPermissions(role as any)
    
    return this.updateUser(userId, { 
      role: role as any,
      permissions
    } as any)
  }

  async updateUserStatus(userId: string, status: string): Promise<ApiResponse<OrganizationUser>> {
    const context = this.requireAuth()

    if (!this.hasPermission('user:write')) {
      throw this.createError('FORBIDDEN', 'Insufficient permissions to update user status', 403)
    }

    return this.updateUser(userId, { 
      status: status as any
    })
  }

  // Organization API endpoints
  async getOrganizations(): Promise<ApiResponse<Organization[]>> {
    const context = this.requireAuth()

    if (context.role === 'master') {
      // Master accounts see all organizations
      const organizations = organizationService.getAllOrganizations()
      return {
        data: organizations,
        success: true
      }
    } else {
      // Regular accounts see only their organization
      const organization = organizationService.getOrganization(context.organizationId)
      return {
        data: organization ? [organization] : [],
        success: true
      }
    }
  }

  async getOrganization(orgId: string): Promise<ApiResponse<Organization>> {
    const context = this.requireAuth()

    if (!this.canAccessOrganization(orgId)) {
      throw this.createError('FORBIDDEN', 'Cannot access organization', 403)
    }

    const organization = organizationService.getOrganization(orgId)
    if (!organization) {
      throw this.createError('NOT_FOUND', 'Organization not found', 404)
    }

    return {
      data: organization,
      success: true
    }
  }

  private getDefaultPermissions(role: string): string[] {
    const permissionMap = {
      admin: ['user:read', 'user:write', 'user:delete', 'campaign:read', 'campaign:write', 'analytics:read', 'settings:read', 'settings:write'],
      seller: ['campaign:read', 'campaign:write', 'client:read', 'client:write', 'analytics:read'],
      producer: ['show:read', 'show:write', 'episode:read', 'episode:write', 'campaign:read', 'analytics:read'],
      talent: ['show:read', 'episode:read', 'schedule:read', 'analytics:read'],
      client: ['campaign:read', 'analytics:read', 'report:read']
    }

    return permissionMap[role as keyof typeof permissionMap] || []
  }
}

// Singleton instance
export const apiService = new ApiService()

// Helper function to initialize context from auth
export function initializeApiContext(user: any) {
  if (!user) return

  const orgId = user.organizationId || 'org-techstart'
  const permissions = apiService['getDefaultPermissions'](user.role)

  apiService.setContext({
    userId: user.id,
    organizationId: orgId,
    role: user.role,
    permissions
  })
}