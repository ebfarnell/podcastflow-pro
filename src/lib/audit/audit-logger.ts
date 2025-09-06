import prisma from '@/lib/db/prisma'
import { AuditLogEntry } from '@/types/security'

interface CreateAuditLogParams {
  organizationId: string
  userId: string
  userEmail: string
  action: string
  resource: string
  resourceId?: string
  changes?: Record<string, any>
  ipAddress: string
  userAgent: string
  success: boolean
  errorMessage?: string
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    // Store audit log in SystemLog table (public schema)
    await prisma.systemLog.create({
      data: {
        level: params.success ? 'info' : 'error',
        source: 'security_audit',
        message: `${params.action}: ${params.resource}`,
        organizationId: params.organizationId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          userEmail: params.userEmail,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId,
          changes: params.changes,
          success: params.success,
          errorMessage: params.errorMessage,
        },
        createdAt: new Date(),
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - audit logging should not break the main flow
  }
}

export async function getAuditLogs(
  organizationId: string,
  filters?: {
    userId?: string
    action?: string
    resource?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  }
): Promise<AuditLogEntry[]> {
  try {
    const where: any = {
      source: 'security_audit',
      organizationId: organizationId,
    }

    if (filters?.userId) {
      where.userId = filters.userId
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {}
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate
      }
    }

    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    })

    return logs.map(log => ({
      id: log.id,
      organizationId: log.organizationId || '',
      userId: log.userId || '',
      userEmail: (log.metadata as any)?.userEmail || '',
      action: (log.metadata as any)?.action || '',
      resource: (log.metadata as any)?.resource || '',
      resourceId: (log.metadata as any)?.resourceId,
      changes: (log.metadata as any)?.changes,
      ipAddress: log.ipAddress || '',
      userAgent: log.userAgent || '',
      timestamp: log.createdAt.toISOString(),
      success: (log.metadata as any)?.success || false,
      errorMessage: (log.metadata as any)?.errorMessage,
    }))
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return []
  }
}

// Cleanup old audit logs based on retention policy
export async function cleanupAuditLogs(organizationId: string, retentionDays: number): Promise<number> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const result = await prisma.systemLog.deleteMany({
      where: {
        source: 'security_audit',
        organizationId: organizationId,
        createdAt: {
          lt: cutoffDate,
        },
      },
    })

    return result.count
  } catch (error) {
    console.error('Failed to cleanup audit logs:', error)
    return 0
  }
}