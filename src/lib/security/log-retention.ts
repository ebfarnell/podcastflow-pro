import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export interface RetentionPolicy {
  securityAuditLogs: number // days
  loginAttempts: number // days
  systemLogs: number // days
  systemMetrics: number // days
  monitoringAlerts: number // days
}

/**
 * Get retention policy for an organization
 */
export async function getRetentionPolicy(organizationId: string): Promise<RetentionPolicy> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true }
  })

  const securitySettings = (org?.settings as any)?.security || {}
  const retentionPolicy = securitySettings.logRetention || {}

  // Return policy with defaults
  return {
    securityAuditLogs: retentionPolicy.securityAuditLogs || 90,
    loginAttempts: retentionPolicy.loginAttempts || 30,
    systemLogs: retentionPolicy.systemLogs || 30,
    systemMetrics: retentionPolicy.systemMetrics || 7,
    monitoringAlerts: retentionPolicy.monitoringAlerts || 60
  }
}

/**
 * Clean up old security audit logs
 */
export async function cleanupSecurityAuditLogs(organizationId: string): Promise<number> {
  const policy = await getRetentionPolicy(organizationId)
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - policy.securityAuditLogs)

  console.log(`🧹 Cleaning security audit logs older than ${cutoffDate.toISOString()}`)

  const result = await prisma.securityAuditLog.deleteMany({
    where: {
      organizationId,
      createdAt: {
        lt: cutoffDate
      }
    }
  })

  console.log(`✅ Deleted ${result.count} old security audit logs`)
  return result.count
}

/**
 * Clean up old login attempts
 */
export async function cleanupLoginAttempts(): Promise<number> {
  // Login attempts are global, use a fixed retention of 30 days
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 30)

  console.log(`🧹 Cleaning login attempts older than ${cutoffDate.toISOString()}`)

  const result = await prisma.loginAttempt.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      }
    }
  })

  console.log(`✅ Deleted ${result.count} old login attempts`)
  return result.count
}

/**
 * Clean up old system logs
 */
export async function cleanupSystemLogs(): Promise<number> {
  // System logs use a fixed retention of 30 days
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 30)

  console.log(`🧹 Cleaning system logs older than ${cutoffDate.toISOString()}`)

  const result = await prisma.systemLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      }
    }
  })

  console.log(`✅ Deleted ${result.count} old system logs`)
  return result.count
}

/**
 * Clean up old system metrics
 */
export async function cleanupSystemMetrics(): Promise<number> {
  // System metrics use a fixed retention of 7 days
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 7)

  console.log(`🧹 Cleaning system metrics older than ${cutoffDate.toISOString()}`)

  const result = await prisma.systemMetric.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      }
    }
  })

  console.log(`✅ Deleted ${result.count} old system metrics`)
  return result.count
}

/**
 * Clean up old monitoring alerts
 */
export async function cleanupMonitoringAlerts(): Promise<number> {
  // Monitoring alerts use a fixed retention of 60 days
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 60)

  console.log(`🧹 Cleaning monitoring alerts older than ${cutoffDate.toISOString()}`)

  const result = await prisma.monitoringAlert.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      },
      status: 'resolved' // Only delete resolved alerts
    }
  })

  console.log(`✅ Deleted ${result.count} old monitoring alerts`)
  return result.count
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date()

  console.log(`🧹 Cleaning expired sessions`)

  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: now
      }
    }
  })

  console.log(`✅ Deleted ${result.count} expired sessions`)
  return result.count
}

/**
 * Clean up used 2FA backup codes older than 90 days
 */
export async function cleanupUsedBackupCodes(): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 90)

  console.log(`🧹 Cleaning used backup codes older than ${cutoffDate.toISOString()}`)

  const result = await prisma.twoFactorBackupCode.deleteMany({
    where: {
      used: true,
      usedAt: {
        lt: cutoffDate
      }
    }
  })

  console.log(`✅ Deleted ${result.count} old used backup codes`)
  return result.count
}

/**
 * Run all cleanup tasks for an organization
 */
export async function runCleanupTasks(organizationId?: string): Promise<{
  securityAuditLogs: number
  loginAttempts: number
  systemLogs: number
  systemMetrics: number
  monitoringAlerts: number
  sessions: number
  backupCodes: number
  total: number
}> {
  console.log('🚀 Starting log retention cleanup tasks')

  const results = {
    securityAuditLogs: 0,
    loginAttempts: 0,
    systemLogs: 0,
    systemMetrics: 0,
    monitoringAlerts: 0,
    sessions: 0,
    backupCodes: 0,
    total: 0
  }

  try {
    // Clean up organization-specific logs if organizationId provided
    if (organizationId) {
      results.securityAuditLogs = await cleanupSecurityAuditLogs(organizationId)
    } else {
      // Clean up for all organizations
      const orgs = await prisma.organization.findMany({
        select: { id: true }
      })

      for (const org of orgs) {
        results.securityAuditLogs += await cleanupSecurityAuditLogs(org.id)
      }
    }

    // Clean up global logs
    results.loginAttempts = await cleanupLoginAttempts()
    results.systemLogs = await cleanupSystemLogs()
    results.systemMetrics = await cleanupSystemMetrics()
    results.monitoringAlerts = await cleanupMonitoringAlerts()
    results.sessions = await cleanupExpiredSessions()
    results.backupCodes = await cleanupUsedBackupCodes()

    // Calculate total
    results.total = 
      results.securityAuditLogs +
      results.loginAttempts +
      results.systemLogs +
      results.systemMetrics +
      results.monitoringAlerts +
      results.sessions +
      results.backupCodes

    console.log('✅ Log retention cleanup completed successfully', results)
    return results

  } catch (error) {
    console.error('❌ Error during log retention cleanup:', error)
    throw error
  }
}

/**
 * Get storage statistics for logs
 */
export async function getLogStorageStats(organizationId?: string): Promise<{
  securityAuditLogs: { count: number; oldestEntry: Date | null }
  loginAttempts: { count: number; oldestEntry: Date | null }
  systemLogs: { count: number; oldestEntry: Date | null }
  systemMetrics: { count: number; oldestEntry: Date | null }
  monitoringAlerts: { count: number; oldestEntry: Date | null }
  sessions: { count: number; active: number; expired: number }
  backupCodes: { count: number; used: number; unused: number }
}> {
  const now = new Date()

  // Security audit logs
  const securityAuditLogsCount = await prisma.securityAuditLog.count(
    organizationId ? { where: { organizationId } } : undefined
  )
  const oldestAuditLog = await prisma.securityAuditLog.findFirst({
    where: organizationId ? { organizationId } : undefined,
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  })

  // Login attempts
  const loginAttemptsCount = await prisma.loginAttempt.count()
  const oldestLoginAttempt = await prisma.loginAttempt.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  })

  // System logs
  const systemLogsCount = await prisma.systemLog.count()
  const oldestSystemLog = await prisma.systemLog.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  })

  // System metrics
  const systemMetricsCount = await prisma.systemMetric.count()
  const oldestSystemMetric = await prisma.systemMetric.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  })

  // Monitoring alerts
  const monitoringAlertsCount = await prisma.monitoringAlert.count()
  const oldestMonitoringAlert = await prisma.monitoringAlert.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  })

  // Sessions
  const sessionsCount = await prisma.session.count()
  const activeSessions = await prisma.session.count({
    where: { expiresAt: { gt: now } }
  })
  const expiredSessions = sessionsCount - activeSessions

  // Backup codes
  const backupCodesCount = await prisma.twoFactorBackupCode.count()
  const usedBackupCodes = await prisma.twoFactorBackupCode.count({
    where: { used: true }
  })
  const unusedBackupCodes = backupCodesCount - usedBackupCodes

  return {
    securityAuditLogs: {
      count: securityAuditLogsCount,
      oldestEntry: oldestAuditLog?.createdAt || null
    },
    loginAttempts: {
      count: loginAttemptsCount,
      oldestEntry: oldestLoginAttempt?.createdAt || null
    },
    systemLogs: {
      count: systemLogsCount,
      oldestEntry: oldestSystemLog?.createdAt || null
    },
    systemMetrics: {
      count: systemMetricsCount,
      oldestEntry: oldestSystemMetric?.createdAt || null
    },
    monitoringAlerts: {
      count: monitoringAlertsCount,
      oldestEntry: oldestMonitoringAlert?.createdAt || null
    },
    sessions: {
      count: sessionsCount,
      active: activeSessions,
      expired: expiredSessions
    },
    backupCodes: {
      count: backupCodesCount,
      used: usedBackupCodes,
      unused: unusedBackupCodes
    }
  }
}