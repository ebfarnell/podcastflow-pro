/**
 * Mandatory Tenant Isolation Layer
 * 
 * ALL database access for tenant-specific data MUST go through this module.
 * This ensures complete data isolation between organizations.
 */

import { NextRequest } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { getSchemaName } from './schema-db'
import { Prisma } from '@prisma/client'

// Types
export interface TenantContext {
  userId: string
  organizationId: string
  organizationSlug: string
  schemaName: string
  role: string
  isMaster: boolean
}

export interface TenantQuery<T> {
  model: keyof typeof tenantModels
  operation: 'findMany' | 'findUnique' | 'findFirst' | 'create' | 'update' | 'updateMany' | 'delete' | 'deleteMany' | 'count' | 'aggregate'
  args?: any
  skipTenantCheck?: boolean // Only for master account with explicit logging
}

// Models that exist in tenant schemas
const tenantModels = {
  campaign: true,
  show: true,
  episode: true,
  advertiser: true,
  agency: true,
  adApproval: true,
  order: true,
  orderItem: true,
  invoice: true,
  payment: true,
  contract: true,
  expense: true,
  uploadedFile: true,
  creative: true,
  reservation: true,
  reservationItem: true,
  episodeInventory: true,
  campaignAnalytics: true,
  episodeAnalytics: true,
  showAnalytics: true,
  proposal: true,
  proposalVersion: true,
  task: true,
  notification: true,
  activity: true,
  kpiTracker: true,
  creativeUsage: true,
  placement: true,
  talent: true,
  episodeTalent: true,
} as const

// Models that remain in public schema
const publicModels = {
  user: true,
  organization: true,
  session: true,
  billingPlan: true,
  systemMetric: true,
  monitoringAlert: true,
  serviceHealth: true,
  systemLog: true,
  usageRecord: true,
  passwordResetToken: true,
  invitation: true,
} as const

// Audit log for cross-tenant access
interface TenantAccessLog {
  userId: string
  userRole: string
  accessedOrgId: string
  accessedSchema: string
  operation: string
  model: string
  timestamp: Date
  allowed: boolean
  reason?: string
}

/**
 * Get tenant context from request
 */
export async function getTenantContext(request: NextRequest): Promise<TenantContext | null> {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) return null

    const user = await UserService.validateSession(authToken.value)
    if (!user || !user.organizationId) return null

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, slug: true }
    })

    if (!organization) return null

    return {
      userId: user.id,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      schemaName: getSchemaName(organization.slug),
      role: user.role,
      isMaster: user.role === 'master'
    }
  } catch (error) {
    console.error('Error getting tenant context:', error)
    return null
  }
}

/**
 * Log tenant access for audit trail
 */
async function logTenantAccess(log: TenantAccessLog): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO public.tenant_access_log 
      (user_id, user_role, accessed_org_id, accessed_schema, operation, model, timestamp, allowed, reason)
      VALUES (${log.userId}, ${log.userRole}, ${log.accessedOrgId}, ${log.accessedSchema}, 
              ${log.operation}, ${log.model}, ${log.timestamp}, ${log.allowed}, ${log.reason})
    `
  } catch (error) {
    console.error('Failed to log tenant access:', error)
  }
}

/**
 * Validate tenant access
 */
export async function validateTenantAccess(
  context: TenantContext,
  targetOrgId?: string,
  targetSchema?: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Master accounts can access any tenant with logging
  if (context.isMaster) {
    if (targetOrgId && targetOrgId !== context.organizationId) {
      await logTenantAccess({
        userId: context.userId,
        userRole: context.role,
        accessedOrgId: targetOrgId,
        accessedSchema: targetSchema || 'unknown',
        operation: 'cross-tenant-access',
        model: 'various',
        timestamp: new Date(),
        allowed: true,
        reason: 'Master account privilege'
      })
    }
    return { allowed: true }
  }

  // Non-master accounts can only access their own organization
  if (targetOrgId && targetOrgId !== context.organizationId) {
    await logTenantAccess({
      userId: context.userId,
      userRole: context.role,
      accessedOrgId: targetOrgId,
      accessedSchema: targetSchema || 'unknown',
      operation: 'cross-tenant-access-denied',
      model: 'various',
      timestamp: new Date(),
      allowed: false,
      reason: 'Unauthorized cross-tenant access attempt'
    })
    return { allowed: false, reason: 'Unauthorized cross-tenant access' }
  }

  return { allowed: true }
}

/**
 * Execute a query with tenant isolation
 */
export async function executeTenantQuery<T>(
  context: TenantContext,
  query: TenantQuery<T>
): Promise<T> {
  const { model, operation, args = {}, skipTenantCheck = false } = query

  // Validate model is tenant-scoped
  if (!tenantModels[model as keyof typeof tenantModels]) {
    throw new Error(`Model ${model} is not a tenant-scoped model`)
  }

  // For master accounts accessing other tenants
  if (context.isMaster && skipTenantCheck && args.organizationId) {
    const targetOrg = await prisma.organization.findUnique({
      where: { id: args.organizationId },
      select: { slug: true }
    })
    
    if (targetOrg) {
      const targetSchema = getSchemaName(targetOrg.slug)
      await validateTenantAccess(context, args.organizationId, targetSchema)
      
      // Use raw query with explicit schema
      return executeRawTenantQuery(targetSchema, model, operation, args)
    }
  }

  // Standard tenant-scoped query
  const schemaName = context.schemaName
  return executeRawTenantQuery(schemaName, model, operation, args)
}

/**
 * Execute raw query in tenant schema
 */
async function executeRawTenantQuery<T>(
  schemaName: string,
  model: string,
  operation: string,
  args: any
): Promise<T> {
  // Convert model name to table name (e.g., campaign -> Campaign)
  const tableName = model.charAt(0).toUpperCase() + model.slice(1)
  
  switch (operation) {
    case 'findMany':
      return executeFindMany(schemaName, tableName, args)
    case 'findUnique':
    case 'findFirst':
      return executeFindOne(schemaName, tableName, args)
    case 'create':
      return executeCreate(schemaName, tableName, args)
    case 'update':
      return executeUpdate(schemaName, tableName, args)
    case 'delete':
      return executeDelete(schemaName, tableName, args)
    case 'count':
      return executeCount(schemaName, tableName, args)
    default:
      throw new Error(`Unsupported operation: ${operation}`)
  }
}

/**
 * Execute findMany with tenant isolation
 */
async function executeFindMany<T>(
  schemaName: string,
  tableName: string,
  args: any
): Promise<T> {
  const { where = {}, orderBy = {}, take, skip = 0, include = {} } = args
  
  let query = `SELECT * FROM "${schemaName}"."${tableName}"`
  const params: any[] = []
  let paramIndex = 1

  // Build WHERE clause
  const whereConditions = buildWhereClause(where, params, paramIndex)
  if (whereConditions.sql) {
    query += ` WHERE ${whereConditions.sql}`
    paramIndex = whereConditions.nextIndex
  }

  // Build ORDER BY clause
  if (Object.keys(orderBy).length > 0) {
    const orderClauses = Object.entries(orderBy)
      .map(([field, direction]) => `"${field}" ${direction}`)
      .join(', ')
    query += ` ORDER BY ${orderClauses}`
  }

  // Add LIMIT and OFFSET
  if (take) {
    query += ` LIMIT ${take}`
  }
  if (skip) {
    query += ` OFFSET ${skip}`
  }

  const result = await prisma.$queryRawUnsafe(query, ...params)
  
  // Handle includes if needed
  if (Object.keys(include).length > 0) {
    return handleIncludes(result as any[], include, schemaName)
  }

  return result as T
}

/**
 * Execute findUnique/findFirst with tenant isolation
 */
async function executeFindOne<T>(
  schemaName: string,
  tableName: string,
  args: any
): Promise<T> {
  const { where = {} } = args
  
  let query = `SELECT * FROM "${schemaName}"."${tableName}"`
  const params: any[] = []
  let paramIndex = 1

  const whereConditions = buildWhereClause(where, params, paramIndex)
  if (whereConditions.sql) {
    query += ` WHERE ${whereConditions.sql}`
  }

  query += ` LIMIT 1`

  const result = await prisma.$queryRawUnsafe(query, ...params)
  return (result as any[])[0] as T
}

/**
 * Execute create with tenant isolation
 */
async function executeCreate<T>(
  schemaName: string,
  tableName: string,
  args: any
): Promise<T> {
  const { data } = args
  
  const columns = Object.keys(data)
  const values = Object.values(data)
  
  // Handle JSONB fields by casting arrays/objects to JSON
  const placeholders = columns.map((col, i) => {
    const value = values[i]
    // Cast arrays and objects to JSONB for specific fields that need it
    if ((col === 'adFormats' || col === 'categoryExclusivities') && (Array.isArray(value) || typeof value === 'object')) {
      return `$${i + 1}::jsonb`
    }
    return `$${i + 1}`
  }).join(', ')
  
  // Convert arrays/objects to JSON strings for JSONB fields
  const processedValues = values.map((value, i) => {
    const col = columns[i]
    if ((col === 'adFormats' || col === 'categoryExclusivities') && (Array.isArray(value) || typeof value === 'object')) {
      return JSON.stringify(value)
    }
    return value
  })
  
  const query = `
    INSERT INTO "${schemaName}"."${tableName}" 
    (${columns.map(c => `"${c}"`).join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `
  
  const result = await prisma.$queryRawUnsafe(query, ...processedValues)
  return (result as any[])[0] as T
}

/**
 * Execute update with tenant isolation
 */
async function executeUpdate<T>(
  schemaName: string,
  tableName: string,
  args: any
): Promise<T> {
  const { where = {}, data } = args
  
  const columns = Object.keys(data)
  const values = Object.values(data)
  
  // Handle JSONB fields by casting arrays/objects to JSON
  const updates = columns.map((key, i) => {
    const value = values[i]
    // Cast arrays and objects to JSONB for specific fields that need it
    if ((key === 'adFormats' || key === 'categoryExclusivities') && (Array.isArray(value) || typeof value === 'object')) {
      return `"${key}" = $${i + 1}::jsonb`
    }
    return `"${key}" = $${i + 1}`
  }).join(', ')
  
  // Convert arrays/objects to JSON strings for JSONB fields
  const processedValues = values.map((value, i) => {
    const key = columns[i]
    if ((key === 'adFormats' || key === 'categoryExclusivities') && (Array.isArray(value) || typeof value === 'object')) {
      return JSON.stringify(value)
    }
    return value
  })
  
  let paramIndex = processedValues.length + 1
  
  let query = `UPDATE "${schemaName}"."${tableName}" SET ${updates}`
  
  const whereConditions = buildWhereClause(where, processedValues, paramIndex)
  if (whereConditions.sql) {
    query += ` WHERE ${whereConditions.sql}`
  }
  
  query += ` RETURNING *`
  
  const result = await prisma.$queryRawUnsafe(query, ...processedValues)
  return (result as any[])[0] as T
}

/**
 * Execute delete with tenant isolation
 */
async function executeDelete<T>(
  schemaName: string,
  tableName: string,
  args: any
): Promise<T> {
  const { where = {} } = args
  
  let query = `DELETE FROM "${schemaName}"."${tableName}"`
  const params: any[] = []
  let paramIndex = 1
  
  const whereConditions = buildWhereClause(where, params, paramIndex)
  if (whereConditions.sql) {
    query += ` WHERE ${whereConditions.sql}`
  }
  
  query += ` RETURNING *`
  
  const result = await prisma.$queryRawUnsafe(query, ...params)
  return (result as any[])[0] as T
}

/**
 * Execute count with tenant isolation
 */
async function executeCount<T>(
  schemaName: string,
  tableName: string,
  args: any
): Promise<T> {
  const { where = {} } = args
  
  let query = `SELECT COUNT(*) as count FROM "${schemaName}"."${tableName}"`
  const params: any[] = []
  let paramIndex = 1
  
  const whereConditions = buildWhereClause(where, params, paramIndex)
  if (whereConditions.sql) {
    query += ` WHERE ${whereConditions.sql}`
  }
  
  const result = await prisma.$queryRawUnsafe(query, ...params)
  return (result as any[])[0].count as T
}

/**
 * Build WHERE clause from Prisma-style where object
 */
function buildWhereClause(
  where: any,
  params: any[],
  startIndex: number
): { sql: string; nextIndex: number } {
  const conditions: string[] = []
  let paramIndex = startIndex

  for (const [field, value] of Object.entries(where)) {
    if (value === null) {
      conditions.push(`"${field}" IS NULL`)
    } else if (value === undefined) {
      // Skip undefined values
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Handle Prisma operators
      if ('in' in value && Array.isArray(value.in)) {
        if (value.in.length === 0) {
          // Empty IN clause would be invalid SQL, so make it always false
          conditions.push('FALSE')
        } else {
          const placeholders = value.in.map(() => `$${paramIndex++}`).join(', ')
          conditions.push(`"${field}" IN (${placeholders})`)
          params.push(...value.in)
        }
      } else if ('notIn' in value && Array.isArray(value.notIn)) {
        if (value.notIn.length === 0) {
          // Empty NOT IN clause - all values are allowed
          // Don't add any condition
        } else {
          const placeholders = value.notIn.map(() => `$${paramIndex++}`).join(', ')
          conditions.push(`"${field}" NOT IN (${placeholders})`)
          params.push(...value.notIn)
        }
      } else if ('contains' in value) {
        conditions.push(`"${field}" ILIKE $${paramIndex++}`)
        params.push(`%${value.contains}%`)
      } else if ('startsWith' in value) {
        conditions.push(`"${field}" ILIKE $${paramIndex++}`)
        params.push(`${value.startsWith}%`)
      } else if ('endsWith' in value) {
        conditions.push(`"${field}" ILIKE $${paramIndex++}`)
        params.push(`%${value.endsWith}`)
      } else if ('gt' in value) {
        conditions.push(`"${field}" > $${paramIndex++}`)
        params.push(value.gt)
      } else if ('gte' in value) {
        conditions.push(`"${field}" >= $${paramIndex++}`)
        params.push(value.gte)
      } else if ('lt' in value) {
        conditions.push(`"${field}" < $${paramIndex++}`)
        params.push(value.lt)
      } else if ('lte' in value) {
        conditions.push(`"${field}" <= $${paramIndex++}`)
        params.push(value.lte)
      }
    } else {
      // Simple equality
      conditions.push(`"${field}" = $${paramIndex++}`)
      params.push(value)
    }
  }

  return {
    sql: conditions.join(' AND '),
    nextIndex: paramIndex
  }
}

/**
 * Handle includes for related data
 */
async function handleIncludes(
  results: any[],
  include: any,
  schemaName: string
): Promise<any[]> {
  // This is a simplified version - in production, you'd want to handle all relation types
  for (const [relation, config] of Object.entries(include)) {
    if (config === true || (typeof config === 'object' && config)) {
      // Handle the relation loading
      // This would need to be implemented based on your schema relationships
    }
  }
  
  return results
}

/**
 * Middleware to enforce tenant isolation
 */
export async function withTenantIsolation<T>(
  request: NextRequest,
  handler: (context: TenantContext) => Promise<T>
): Promise<T> {
  const context = await getTenantContext(request)
  
  if (!context) {
    throw new Error('Unauthorized: No valid tenant context')
  }
  
  return handler(context)
}

/**
 * Get tenant-isolated Prisma-like client
 */
export function getTenantClient(context: TenantContext) {
  return {
    campaign: createModelProxy('campaign', context),
    show: createModelProxy('show', context),
    episode: createModelProxy('episode', context),
    advertiser: createModelProxy('advertiser', context),
    agency: createModelProxy('agency', context),
    adApproval: createModelProxy('adApproval', context),
    order: createModelProxy('order', context),
    invoice: createModelProxy('invoice', context),
    payment: createModelProxy('payment', context),
    contract: createModelProxy('contract', context),
    expense: createModelProxy('expense', context),
    reservation: createModelProxy('reservation', context),
    episodeInventory: createModelProxy('episodeInventory', context),
    reservationItem: createModelProxy('reservationItem', context),
    // Add other tenant models as needed
  }
}

/**
 * Create a Prisma-like proxy for a model
 */
function createModelProxy(model: keyof typeof tenantModels, context: TenantContext) {
  return {
    findMany: (args?: any) => executeTenantQuery(context, { model, operation: 'findMany', args }),
    findUnique: (args?: any) => executeTenantQuery(context, { model, operation: 'findUnique', args }),
    findFirst: (args?: any) => executeTenantQuery(context, { model, operation: 'findFirst', args }),
    create: (args?: any) => executeTenantQuery(context, { model, operation: 'create', args }),
    update: (args?: any) => executeTenantQuery(context, { model, operation: 'update', args }),
    updateMany: (args?: any) => executeTenantQuery(context, { model, operation: 'updateMany', args }),
    delete: (args?: any) => executeTenantQuery(context, { model, operation: 'delete', args }),
    deleteMany: (args?: any) => executeTenantQuery(context, { model, operation: 'deleteMany', args }),
    count: (args?: any) => executeTenantQuery(context, { model, operation: 'count', args }),
  }
}

/**
 * Create tenant access log table if it doesn't exist
 */
export async function ensureTenantAccessLogTable(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS public.tenant_access_log (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_role TEXT NOT NULL,
      accessed_org_id TEXT NOT NULL,
      accessed_schema TEXT NOT NULL,
      operation TEXT NOT NULL,
      model TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      allowed BOOLEAN NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_tenant_access_log_user ON public.tenant_access_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_access_log_org ON public.tenant_access_log(accessed_org_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_access_log_timestamp ON public.tenant_access_log(timestamp);
  `
}