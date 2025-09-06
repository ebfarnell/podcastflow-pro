import prisma from '@/lib/db/prisma'

export interface AccessLogEntry {
  userId: string
  userRole: string
  action: string
  resource: string
  organizationAccessed?: string
  userOrganizationId?: string
  ipAddress?: string
  userAgent?: string
  crossOrgAccess: boolean
  timestamp: Date
}

class AccessLogger {
  /**
   * Log access attempts, especially cross-organization access by master users
   */
  async logAccess(entry: Omit<AccessLogEntry, 'timestamp' | 'crossOrgAccess'>) {
    try {
      // Determine if this is cross-organization access
      const crossOrgAccess = entry.userRole === 'master' && 
                           entry.organizationAccessed && 
                           entry.userOrganizationId !== entry.organizationAccessed

      const logEntry: AccessLogEntry = {
        ...entry,
        crossOrgAccess,
        timestamp: new Date()
      }

      // Log to console for immediate monitoring
      if (crossOrgAccess) {
        console.warn('🚨 CROSS-ORG ACCESS:', {
          master: entry.userId,
          fromOrg: entry.userOrganizationId,
          accessedOrg: entry.organizationAccessed,
          action: entry.action,
          resource: entry.resource,
          ip: entry.ipAddress
        })
      }

      // Store in database for audit trail
      await prisma.systemLog.create({
        data: {
          level: crossOrgAccess ? 'warn' : 'info',
          message: `${entry.userRole} user ${entry.userId} ${entry.action} ${entry.resource}`,
          metadata: JSON.stringify(logEntry),
          createdAt: new Date()
        }
      })

      return true
    } catch (error) {
      console.error('❌ Failed to log access:', error)
      return false
    }
  }

  /**
   * Log master user accessing another organization's data
   */
  async logMasterCrossOrgAccess(
    userId: string,
    userOrgId: string,
    accessedOrgId: string,
    action: string,
    resource: string,
    request?: Request
  ) {
    const ipAddress = request?.headers.get('x-forwarded-for') || 
                     request?.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request?.headers.get('user-agent') || 'unknown'

    return this.logAccess({
      userId,
      userRole: 'master',
      action,
      resource,
      organizationAccessed: accessedOrgId,
      userOrganizationId: userOrgId,
      ipAddress,
      userAgent
    })
  }

  /**
   * Get cross-organization access logs for audit
   */
  async getCrossOrgAccessLogs(limit = 100) {
    try {
      const logs = await prisma.systemLog.findMany({
        where: {
          message: {
            contains: 'master user'
          },
          metadata: {
            path: '$.crossOrgAccess',
            equals: true
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      })

      return logs.map(log => ({
        ...log,
        metadata: JSON.parse(log.metadata || '{}')
      }))
    } catch (error) {
      console.error('❌ Failed to get cross-org access logs:', error)
      return []
    }
  }

  /**
   * Get access statistics for master users
   */
  async getMasterAccessStats(days = 7) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const stats = await prisma.systemLog.groupBy({
        by: ['level'],
        where: {
          message: {
            contains: 'master user'
          },
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          id: true
        }
      })

      return {
        totalAccess: stats.reduce((sum, stat) => sum + stat._count.id, 0),
        crossOrgAccess: stats.find(s => s.level === 'warn')?._count.id || 0,
        normalAccess: stats.find(s => s.level === 'info')?._count.id || 0,
        period: `${days} days`
      }
    } catch (error) {
      console.error('❌ Failed to get master access stats:', error)
      return null
    }
  }
}

export const accessLogger = new AccessLogger()