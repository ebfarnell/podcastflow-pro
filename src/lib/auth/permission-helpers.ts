import { PERMISSIONS } from '@/types/auth'

/**
 * Mapping of API endpoints to required permissions
 * This serves as documentation and can be used for automated protection
 */
export const API_PERMISSIONS: Record<string, {
  GET?: string | string[]
  POST?: string | string[]
  PUT?: string | string[]
  DELETE?: string | string[]
  requireAll?: boolean
}> = {
  // Dashboard
  '/api/dashboard': {
    GET: PERMISSIONS.DASHBOARD_VIEW
  },

  // Users
  '/api/users': {
    GET: PERMISSIONS.USERS_VIEW,
    POST: PERMISSIONS.USERS_CREATE
  },
  '/api/users/[id]': {
    GET: PERMISSIONS.USERS_VIEW,
    PUT: PERMISSIONS.USERS_UPDATE,
    DELETE: PERMISSIONS.USERS_DELETE
  },
  '/api/users/[id]/role': {
    PUT: PERMISSIONS.USERS_ASSIGN_ROLE
  },
  '/api/users/[id]/status': {
    PUT: PERMISSIONS.USERS_UPDATE
  },

  // Organizations
  '/api/organizations': {
    GET: PERMISSIONS.ORGS_VIEW,
    POST: PERMISSIONS.ORGS_CREATE
  },
  '/api/organizations/[id]': {
    GET: PERMISSIONS.ORGS_VIEW,
    PUT: PERMISSIONS.ORGS_UPDATE,
    DELETE: PERMISSIONS.ORGS_DELETE
  },

  // Campaigns
  '/api/campaigns': {
    GET: PERMISSIONS.CAMPAIGNS_VIEW,
    POST: PERMISSIONS.CAMPAIGNS_CREATE
  },
  '/api/campaigns/[id]': {
    GET: PERMISSIONS.CAMPAIGNS_VIEW,
    PUT: PERMISSIONS.CAMPAIGNS_UPDATE,
    DELETE: PERMISSIONS.CAMPAIGNS_DELETE
  },
  '/api/campaigns/[id]/approve': {
    POST: PERMISSIONS.CAMPAIGNS_APPROVE
  },

  // Orders
  '/api/orders': {
    GET: PERMISSIONS.ORDERS_VIEW,
    POST: PERMISSIONS.ORDERS_CREATE
  },
  '/api/orders/[id]': {
    GET: PERMISSIONS.ORDERS_VIEW,
    PUT: PERMISSIONS.ORDERS_UPDATE,
    DELETE: PERMISSIONS.ORDERS_DELETE
  },
  '/api/orders/[id]/approve': {
    POST: PERMISSIONS.ORDERS_APPROVE
  },

  // Shows
  '/api/shows': {
    GET: PERMISSIONS.SHOWS_VIEW,
    POST: PERMISSIONS.SHOWS_CREATE
  },
  '/api/shows/[id]': {
    GET: PERMISSIONS.SHOWS_VIEW,
    PUT: PERMISSIONS.SHOWS_UPDATE,
    DELETE: PERMISSIONS.SHOWS_DELETE
  },

  // Episodes
  '/api/episodes': {
    GET: PERMISSIONS.EPISODES_VIEW,
    POST: PERMISSIONS.EPISODES_CREATE
  },
  '/api/episodes/[id]': {
    GET: PERMISSIONS.EPISODES_VIEW,
    PUT: PERMISSIONS.EPISODES_UPDATE,
    DELETE: PERMISSIONS.EPISODES_DELETE
  },
  '/api/episodes/[id]/publish': {
    POST: PERMISSIONS.EPISODES_PUBLISH
  },

  // Advertisers
  '/api/advertisers': {
    GET: PERMISSIONS.ADVERTISERS_VIEW,
    POST: PERMISSIONS.ADVERTISERS_CREATE
  },
  '/api/advertisers/[id]': {
    GET: PERMISSIONS.ADVERTISERS_VIEW,
    PUT: PERMISSIONS.ADVERTISERS_UPDATE,
    DELETE: PERMISSIONS.ADVERTISERS_DELETE
  },

  // Agencies
  '/api/agencies': {
    GET: PERMISSIONS.AGENCIES_VIEW,
    POST: PERMISSIONS.AGENCIES_CREATE
  },
  '/api/agencies/[id]': {
    GET: PERMISSIONS.AGENCIES_VIEW,
    PUT: PERMISSIONS.AGENCIES_UPDATE,
    DELETE: PERMISSIONS.AGENCIES_DELETE
  },

  // Contracts
  '/api/contracts': {
    GET: PERMISSIONS.CONTRACTS_VIEW,
    POST: PERMISSIONS.CONTRACTS_CREATE
  },
  '/api/contracts/[id]': {
    GET: PERMISSIONS.CONTRACTS_VIEW,
    PUT: PERMISSIONS.CONTRACTS_UPDATE,
    DELETE: PERMISSIONS.CONTRACTS_DELETE
  },
  '/api/contracts/[id]/actions': {
    POST: [PERMISSIONS.CONTRACTS_APPROVE, PERMISSIONS.CONTRACTS_SEND, PERMISSIONS.CONTRACTS_EXECUTE]
  },
  '/api/contracts/templates': {
    GET: PERMISSIONS.CONTRACTS_TEMPLATES,
    POST: PERMISSIONS.CONTRACTS_TEMPLATES
  },

  // Approvals
  '/api/ad-approvals': {
    GET: PERMISSIONS.APPROVALS_VIEW,
    POST: PERMISSIONS.APPROVALS_CREATE
  },
  '/api/ad-approvals/[id]': {
    GET: PERMISSIONS.APPROVALS_VIEW,
    PUT: PERMISSIONS.APPROVALS_UPDATE
  },
  '/api/ad-approvals/[id]/approve': {
    POST: PERMISSIONS.APPROVALS_APPROVE
  },
  '/api/ad-approvals/[id]/reject': {
    POST: PERMISSIONS.APPROVALS_REJECT
  },

  // Executive Reports
  '/api/executive/reports': {
    GET: PERMISSIONS.EXECUTIVE_REPORTS_VIEW
  },
  '/api/executive/reports/pl': {
    GET: PERMISSIONS.EXECUTIVE_REPORTS_PL
  },
  '/api/executive/reports/revenue': {
    GET: PERMISSIONS.EXECUTIVE_REPORTS_REVENUE
  },

  // Budget
  '/api/budget': {
    GET: PERMISSIONS.BUDGET_VIEW,
    POST: PERMISSIONS.BUDGET_CREATE
  },
  '/api/budget/[id]': {
    GET: PERMISSIONS.BUDGET_VIEW,
    PUT: PERMISSIONS.BUDGET_UPDATE,
    DELETE: PERMISSIONS.BUDGET_DELETE
  },

  // Reports
  '/api/reports': {
    GET: PERMISSIONS.REPORTS_VIEW,
    POST: PERMISSIONS.REPORTS_CREATE
  },
  '/api/reports/[id]': {
    GET: PERMISSIONS.REPORTS_VIEW,
    PUT: PERMISSIONS.REPORTS_CREATE,
    DELETE: PERMISSIONS.REPORTS_CREATE
  },
  '/api/reports/[id]/export': {
    GET: PERMISSIONS.REPORTS_EXPORT
  },

  // QuickBooks
  '/api/quickbooks': {
    GET: PERMISSIONS.QUICKBOOKS_VIEW,
    POST: PERMISSIONS.QUICKBOOKS_SYNC
  },
  '/api/quickbooks/sync': {
    POST: PERMISSIONS.QUICKBOOKS_SYNC
  },
  '/api/quickbooks/configure': {
    PUT: PERMISSIONS.QUICKBOOKS_CONFIGURE
  },

  // Settings
  '/api/settings': {
    GET: PERMISSIONS.SETTINGS_VIEW,
    PUT: PERMISSIONS.SETTINGS_UPDATE
  },
  '/api/settings/admin': {
    GET: PERMISSIONS.SETTINGS_ADMIN,
    PUT: PERMISSIONS.SETTINGS_ADMIN
  },

  // Master-only endpoints
  '/api/master/organizations': {
    GET: PERMISSIONS.MASTER_MANAGE_ORGS,
    POST: PERMISSIONS.MASTER_MANAGE_ORGS
  },
  '/api/master/analytics': {
    GET: PERMISSIONS.MASTER_VIEW_ALL
  },
  '/api/master/impersonate': {
    POST: PERMISSIONS.MASTER_IMPERSONATE
  }
}

/**
 * Get required permissions for a specific API endpoint and method
 */
export function getRequiredPermissions(
  path: string, 
  method: string
): { permissions?: string | string[], requireAll?: boolean } {
  const permissions = API_PERMISSIONS[path]
  if (!permissions) return {}
  
  const methodPermissions = permissions[method.toUpperCase() as keyof typeof permissions]
  if (!methodPermissions) return {}
  
  return {
    permissions: methodPermissions as string | string[],
    requireAll: permissions.requireAll || false
  }
}

/**
 * Component-level permission checking
 */
export interface PermissionGuardProps {
  children: React.ReactNode
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  fallback?: React.ReactNode
  role?: string // For legacy role-based checks
}

/**
 * Usage examples for updating API endpoints:
 * 
 * 1. Simple endpoint with single permission:
 * ```typescript
 * export const GET = withApiProtection(getHandler, {
 *   requiredPermission: PERMISSIONS.CAMPAIGNS_VIEW
 * })
 * ```
 * 
 * 2. Endpoint requiring multiple permissions (any):
 * ```typescript
 * export const POST = withApiProtection(postHandler, {
 *   requiredPermissions: [PERMISSIONS.CONTRACTS_APPROVE, PERMISSIONS.CONTRACTS_SEND],
 *   requireAllPermissions: false
 * })
 * ```
 * 
 * 3. Endpoint requiring all permissions:
 * ```typescript
 * export const DELETE = withApiProtection(deleteHandler, {
 *   requiredPermissions: [PERMISSIONS.USERS_DELETE, PERMISSIONS.SETTINGS_ADMIN],
 *   requireAllPermissions: true
 * })
 * ```
 * 
 * 4. Legacy role-based (still supported):
 * ```typescript
 * export const GET = withApiProtection(getHandler, {
 *   allowedRoles: ['master', 'admin']
 * })
 * ```
 */