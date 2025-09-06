import prisma from '@/lib/db/prisma'

interface SecurityAuditLogEntry {
  organizationId: string
  userId?: string
  userEmail?: string
  action: string
  resource: string
  resourceId?: string
  changes?: any
  ipAddress: string
  userAgent: string
  success: boolean
  errorMessage?: string
}

/**
 * Create a security audit log entry
 */
export async function createSecurityAuditLog(entry: SecurityAuditLogEntry): Promise<void> {
  try {
    await prisma.securityAuditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId,
        userEmail: entry.userEmail,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        changes: entry.changes || {},
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        success: entry.success,
        errorMessage: entry.errorMessage
      }
    })
  } catch (error) {
    console.error('Failed to create security audit log:', error)
    // Don't throw - audit logging should not break the application
  }
}

/**
 * Query security audit logs
 */
export async function querySecurityAuditLogs(
  organizationId: string,
  filters: {
    userId?: string
    action?: string
    resource?: string
    startDate?: Date
    endDate?: Date
    success?: boolean
  } = {},
  pagination: {
    page?: number
    limit?: number
  } = {}
): Promise<{
  logs: any[]
  total: number
  page: number
  pages: number
}> {
  const page = pagination.page || 1
  const limit = pagination.limit || 50
  const skip = (page - 1) * limit

  const where: any = {
    organizationId
  }

  if (filters.userId) where.userId = filters.userId
  if (filters.action) where.action = filters.action
  if (filters.resource) where.resource = filters.resource
  if (filters.success !== undefined) where.success = filters.success
  
  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }

  const [logs, total] = await Promise.all([
    prisma.securityAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.securityAuditLog.count({ where })
  ])

  return {
    logs,
    total,
    page,
    pages: Math.ceil(total / limit)
  }
}

/**
 * Clean up old audit logs based on retention policy
 */
export async function cleanupOldAuditLogs(
  organizationId: string,
  retentionDays: number
): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  const result = await prisma.securityAuditLog.deleteMany({
    where: {
      organizationId,
      createdAt: {
        lt: cutoffDate
      }
    }
  })

  return result.count
}