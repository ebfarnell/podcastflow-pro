import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from './access-logger'

export interface User {
  id: string
  organizationId: string
  role: string
}

export interface OwnershipResult {
  hasAccess: boolean
  isCrossOrg: boolean
  reason: string
}

/**
 * Verify organization ownership and log cross-org access
 */
export class OrganizationOwnership {
  
  /**
   * Verify that a user can access a specific organization's data
   */
  static async verifyAccess(
    user: User,
    targetOrganizationId: string,
    action: string,
    resource: string,
    request?: Request
  ): Promise<OwnershipResult> {
    
    // Users can always access their own organization
    if (user.organizationId === targetOrganizationId) {
      return {
        hasAccess: true,
        isCrossOrg: false,
        reason: 'same_organization'
      }
    }

    // Master users can access any organization (but we log it)
    if (user.role === 'master') {
      // Log the cross-organization access
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId,
        targetOrganizationId,
        action,
        resource,
        request
      )

      return {
        hasAccess: true,
        isCrossOrg: true,
        reason: 'master_override'
      }
    }

    // All other users are denied cross-organization access
    return {
      hasAccess: false,
      isCrossOrg: true,
      reason: 'insufficient_permissions'
    }
  }

  /**
   * Verify ownership of a specific resource within an organization
   */
  static async verifyResourceOwnership(
    user: User,
    resourceType: string,
    resourceId: string,
    action: string,
    request?: Request
  ): Promise<OwnershipResult> {
    
    try {
      const orgSlug = await getUserOrgSlug(user.id)
      if (!orgSlug) {
        return {
          hasAccess: false,
          isCrossOrg: false,
          reason: 'no_organization'
        }
      }

      let ownershipQuery = ''
      let tableName = ''

      // Build query based on resource type
      switch (resourceType) {
        case 'proposal':
          tableName = 'Proposal'
          ownershipQuery = `
            SELECT id, "organizationId", "createdBy" 
            FROM "Proposal" 
            WHERE id = $1
          `
          break
        case 'campaign':
          tableName = 'Campaign'
          ownershipQuery = `
            SELECT id, "organizationId", "createdBy" 
            FROM "Campaign" 
            WHERE id = $1
          `
          break
        case 'show':
          tableName = 'Show'
          ownershipQuery = `
            SELECT id, "organizationId", "createdBy" 
            FROM "Show" 
            WHERE id = $1
          `
          break
        case 'episode':
          tableName = 'Episode'
          ownershipQuery = `
            SELECT id, "organizationId", "createdBy" 
            FROM "Episode" 
            WHERE id = $1
          `
          break
        default:
          return {
            hasAccess: false,
            isCrossOrg: false,
            reason: 'unsupported_resource_type'
          }
      }

      const resources = await querySchema<{
        id: string
        organizationId: string
        createdBy: string
      }>(orgSlug, ownershipQuery, [resourceId])

      if (!resources.length) {
        return {
          hasAccess: false,
          isCrossOrg: false,
          reason: 'resource_not_found'
        }
      }

      const resource = resources[0]

      // Check organization ownership
      const orgCheck = await this.verifyAccess(
        user,
        resource.organizationId,
        action,
        `${resourceType}/${resourceId}`,
        request
      )

      if (!orgCheck.hasAccess) {
        return orgCheck
      }

      // For non-master users, also verify they created the resource or have admin/sales role
      if (user.role !== 'master') {
        const canAccess = resource.createdBy === user.id || 
                         ['admin', 'sales'].includes(user.role)
        
        if (!canAccess) {
          return {
            hasAccess: false,
            isCrossOrg: orgCheck.isCrossOrg,
            reason: 'not_creator_or_admin'
          }
        }
      }

      return {
        hasAccess: true,
        isCrossOrg: orgCheck.isCrossOrg,
        reason: orgCheck.reason
      }

    } catch (error) {
      console.error('❌ Resource ownership verification failed:', error)
      return {
        hasAccess: false,
        isCrossOrg: false,
        reason: 'verification_error'
      }
    }
  }

  /**
   * Middleware function to check organization access
   */
  static createAccessMiddleware(
    organizationIdExtractor: (request: Request) => string | Promise<string>
  ) {
    return async (user: User, request: Request) => {
      const targetOrgId = await organizationIdExtractor(request)
      const action = request.method || 'UNKNOWN'
      const resource = new URL(request.url).pathname

      const result = await this.verifyAccess(user, targetOrgId, action, resource, request)
      
      if (!result.hasAccess) {
        throw new Error(`Access denied: ${result.reason}`)
      }

      return result
    }
  }
}

export const orgOwnership = OrganizationOwnership