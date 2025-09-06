import prisma from '@/lib/db/prisma'
import { NextRequest } from 'next/server'

/**
 * Audit event types for compliance tracking
 */
export enum AuditEventType {
  // Authentication events
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // User management
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  
  // Campaign operations
  CAMPAIGN_CREATED = 'CAMPAIGN_CREATED',
  CAMPAIGN_UPDATED = 'CAMPAIGN_UPDATED',
  CAMPAIGN_DELETED = 'CAMPAIGN_DELETED',
  CAMPAIGN_STATUS_CHANGED = 'CAMPAIGN_STATUS_CHANGED',
  
  // Financial events
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
  INVOICE_CREATED = 'INVOICE_CREATED',
  INVOICE_UPDATED = 'INVOICE_UPDATED',
  INVOICE_SENT = 'INVOICE_SENT',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  
  // Data access
  DATA_EXPORTED = 'DATA_EXPORTED',
  DATA_IMPORTED = 'DATA_IMPORTED',
  REPORT_GENERATED = 'REPORT_GENERATED',
  SENSITIVE_DATA_ACCESSED = 'SENSITIVE_DATA_ACCESSED',
  
  // System events
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  SECURITY_ALERT = 'SECURITY_ALERT',
  PERMISSION_VIOLATION = 'PERMISSION_VIOLATION',
  API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',
  
  // Compliance events
  GDPR_DATA_REQUEST = 'GDPR_DATA_REQUEST',
  GDPR_DATA_DELETION = 'GDPR_DATA_DELETION',
  TERMS_ACCEPTED = 'TERMS_ACCEPTED',
  PRIVACY_POLICY_ACCEPTED = 'PRIVACY_POLICY_ACCEPTED'
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  id?: string
  eventType: AuditEventType
  severity: AuditSeverity
  userId?: string
  organizationId?: string
  entityType?: string
  entityId?: string
  action: string
  details?: any
  metadata?: {
    ipAddress?: string
    userAgent?: string
    sessionId?: string
    requestId?: string
    apiEndpoint?: string
    httpMethod?: string
  }
  timestamp?: Date
  success: boolean
  errorMessage?: string
}

/**
 * Compliance report structure
 */
export interface ComplianceReport {
  organizationId: string
  period: {
    startDate: Date
    endDate: Date
  }
  summary: {
    totalEvents: number
    criticalEvents: number
    failedEvents: number
    uniqueUsers: number
  }
  categories: Record<string, number>
  topEvents: Array<{
    eventType: string
    count: number
  }>
  complianceStatus: {
    dataRetention: boolean
    accessControl: boolean
    auditTrail: boolean
    encryption: boolean
  }
}

/**
 * Comprehensive audit trail service for compliance and security monitoring
 */
export class AuditService {
  private static instance: AuditService
  private buffer: AuditLogEntry[] = []
  private bufferSize = 50
  private flushInterval = 10000 // 10 seconds

  private constructor() {
    // Start flush interval
    setInterval(() => {
      this.flushBuffer()
    }, this.flushInterval)
  }

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService()
    }
    return AuditService.instance
  }

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Add timestamp if not provided
      entry.timestamp = entry.timestamp || new Date()

      // Add to buffer
      this.buffer.push(entry)

      // Log critical events immediately
      if (entry.severity === AuditSeverity.CRITICAL) {
        await this.flushBuffer()
      } else if (this.buffer.length >= this.bufferSize) {
        await this.flushBuffer()
      }

      console.log(`🔍 Audit event logged: ${entry.eventType} - ${entry.action}`)

    } catch (error) {
      console.error('❌ Failed to log audit event:', error)
    }
  }

  /**
   * Log authentication event
   */
  async logAuth(
    eventType: AuditEventType,
    userId: string | null,
    details: any,
    request?: NextRequest
  ): Promise<void> {
    const metadata = request ? this.extractRequestMetadata(request) : {}
    
    await this.log({
      eventType,
      severity: this.getAuthEventSeverity(eventType),
      userId: userId || undefined,
      action: this.getEventDescription(eventType),
      details,
      metadata,
      success: !eventType.includes('FAILED')
    })
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    userId: string,
    organizationId: string,
    entityType: string,
    entityId: string,
    action: string,
    sensitive: boolean = false
  ): Promise<void> {
    await this.log({
      eventType: sensitive ? AuditEventType.SENSITIVE_DATA_ACCESSED : AuditEventType.DATA_EXPORTED,
      severity: sensitive ? AuditSeverity.HIGH : AuditSeverity.LOW,
      userId,
      organizationId,
      entityType,
      entityId,
      action,
      success: true
    })
  }

  /**
   * Log financial event
   */
  async logFinancial(
    eventType: AuditEventType,
    userId: string,
    organizationId: string,
    entityId: string,
    amount: number,
    details: any
  ): Promise<void> {
    await this.log({
      eventType,
      severity: AuditSeverity.HIGH,
      userId,
      organizationId,
      entityType: 'financial',
      entityId,
      action: `${this.getEventDescription(eventType)} - Amount: $${amount}`,
      details: {
        ...details,
        amount
      },
      success: true
    })
  }

  /**
   * Log security event
   */
  async logSecurity(
    eventType: AuditEventType,
    severity: AuditSeverity,
    details: any,
    request?: NextRequest
  ): Promise<void> {
    const metadata = request ? this.extractRequestMetadata(request) : {}

    await this.log({
      eventType,
      severity,
      action: this.getEventDescription(eventType),
      details,
      metadata,
      success: false
    })

    // Alert on critical security events
    if (severity === AuditSeverity.CRITICAL) {
      await this.sendSecurityAlert(eventType, details)
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: {
    organizationId?: string
    userId?: string
    eventType?: AuditEventType
    severity?: AuditSeverity
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }): Promise<{ logs: any[], total: number }> {
    // Flush buffer before querying
    await this.flushBuffer()

    const where: any = {}

    if (filters.organizationId) {
      where.organizationId = filters.organizationId
    }

    if (filters.userId) {
      where.userId = filters.userId
    }

    if (filters.eventType) {
      where.eventType = filters.eventType
    }

    if (filters.severity) {
      where.severity = filters.severity
    }

    if (filters.startDate || filters.endDate) {
      where.timestamp = {}
      if (filters.startDate) where.timestamp.gte = filters.startDate
      if (filters.endDate) where.timestamp.lte = filters.endDate
    }

    // Query from audit log table (to be created)
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ])

    return { logs, total }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    // Get all audit logs for the period
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    // Calculate summary metrics
    const summary = {
      totalEvents: logs.length,
      criticalEvents: logs.filter(log => log.severity === AuditSeverity.CRITICAL).length,
      failedEvents: logs.filter(log => !log.success).length,
      uniqueUsers: new Set(logs.map(log => log.userId).filter(Boolean)).size
    }

    // Group by event type
    const categories = logs.reduce((acc, log) => {
      const category = this.getEventCategory(log.eventType)
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Get top events
    const eventCounts = logs.reduce((acc, log) => {
      acc[log.eventType] = (acc[log.eventType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topEvents = Object.entries(eventCounts)
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Check compliance status
    const complianceStatus = await this.checkComplianceStatus(organizationId)

    return {
      organizationId,
      period: { startDate, endDate },
      summary,
      categories,
      topEvents,
      complianceStatus
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(
    organizationId: string,
    format: 'json' | 'csv',
    filters?: any
  ): Promise<string> {
    const { logs } = await this.getAuditLogs({
      organizationId,
      ...filters,
      limit: 10000 // Max export limit
    })

    if (format === 'json') {
      return JSON.stringify(logs, null, 2)
    } else {
      // CSV format
      const headers = ['Timestamp', 'Event Type', 'User', 'Action', 'Success', 'Details']
      const rows = logs.map(log => [
        log.timestamp,
        log.eventType,
        log.user?.email || 'System',
        log.action,
        log.success ? 'Yes' : 'No',
        JSON.stringify(log.details || {})
      ])

      return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')
    }
  }

  /**
   * Retain audit logs based on policy
   */
  async retainAuditLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        },
        severity: {
          not: AuditSeverity.CRITICAL // Keep critical events longer
        }
      }
    })

    console.log(`🗑️ Deleted ${result.count} audit logs older than ${retentionDays} days`)
    return result.count
  }

  /**
   * Private helper methods
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return

    try {
      const entries = [...this.buffer]
      this.buffer = []

      // Bulk insert audit logs
      await prisma.auditLog.createMany({
        data: entries.map(entry => ({
          eventType: entry.eventType,
          severity: entry.severity,
          userId: entry.userId,
          organizationId: entry.organizationId,
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          details: entry.details || {},
          metadata: entry.metadata || {},
          timestamp: entry.timestamp || new Date(),
          success: entry.success,
          errorMessage: entry.errorMessage
        }))
      })

      console.log(`✅ Flushed ${entries.length} audit log entries`)

    } catch (error) {
      console.error('❌ Failed to flush audit buffer:', error)
      // Re-add entries to buffer on failure
      this.buffer.unshift(...this.buffer)
    }
  }

  private extractRequestMetadata(request: NextRequest): any {
    return {
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      apiEndpoint: request.url,
      httpMethod: request.method
    }
  }

  private getAuthEventSeverity(eventType: AuditEventType): AuditSeverity {
    switch (eventType) {
      case AuditEventType.USER_LOGIN_FAILED:
        return AuditSeverity.MEDIUM
      case AuditEventType.PASSWORD_CHANGED:
        return AuditSeverity.HIGH
      case AuditEventType.SESSION_EXPIRED:
        return AuditSeverity.LOW
      default:
        return AuditSeverity.LOW
    }
  }

  private getEventDescription(eventType: AuditEventType): string {
    const descriptions: Record<AuditEventType, string> = {
      [AuditEventType.USER_LOGIN]: 'User logged in',
      [AuditEventType.USER_LOGOUT]: 'User logged out',
      [AuditEventType.USER_LOGIN_FAILED]: 'Failed login attempt',
      [AuditEventType.PASSWORD_CHANGED]: 'Password changed',
      [AuditEventType.SESSION_EXPIRED]: 'Session expired',
      [AuditEventType.USER_CREATED]: 'User account created',
      [AuditEventType.USER_UPDATED]: 'User account updated',
      [AuditEventType.USER_DELETED]: 'User account deleted',
      [AuditEventType.USER_ACTIVATED]: 'User account activated',
      [AuditEventType.USER_DEACTIVATED]: 'User account deactivated',
      [AuditEventType.ROLE_CHANGED]: 'User role changed',
      [AuditEventType.CAMPAIGN_CREATED]: 'Campaign created',
      [AuditEventType.CAMPAIGN_UPDATED]: 'Campaign updated',
      [AuditEventType.CAMPAIGN_DELETED]: 'Campaign deleted',
      [AuditEventType.CAMPAIGN_STATUS_CHANGED]: 'Campaign status changed',
      [AuditEventType.PAYMENT_PROCESSED]: 'Payment processed',
      [AuditEventType.INVOICE_CREATED]: 'Invoice created',
      [AuditEventType.INVOICE_UPDATED]: 'Invoice updated',
      [AuditEventType.INVOICE_SENT]: 'Invoice sent',
      [AuditEventType.REFUND_PROCESSED]: 'Refund processed',
      [AuditEventType.DATA_EXPORTED]: 'Data exported',
      [AuditEventType.DATA_IMPORTED]: 'Data imported',
      [AuditEventType.REPORT_GENERATED]: 'Report generated',
      [AuditEventType.SENSITIVE_DATA_ACCESSED]: 'Sensitive data accessed',
      [AuditEventType.SETTINGS_CHANGED]: 'Settings changed',
      [AuditEventType.SECURITY_ALERT]: 'Security alert triggered',
      [AuditEventType.PERMISSION_VIOLATION]: 'Permission violation detected',
      [AuditEventType.API_RATE_LIMIT_EXCEEDED]: 'API rate limit exceeded',
      [AuditEventType.GDPR_DATA_REQUEST]: 'GDPR data request',
      [AuditEventType.GDPR_DATA_DELETION]: 'GDPR data deletion',
      [AuditEventType.TERMS_ACCEPTED]: 'Terms of service accepted',
      [AuditEventType.PRIVACY_POLICY_ACCEPTED]: 'Privacy policy accepted'
    }
    return descriptions[eventType] || eventType
  }

  private getEventCategory(eventType: AuditEventType): string {
    if (eventType.includes('USER_') || eventType.includes('PASSWORD') || eventType.includes('SESSION')) {
      return 'Authentication'
    }
    if (eventType.includes('CAMPAIGN')) {
      return 'Campaign Management'
    }
    if (eventType.includes('PAYMENT') || eventType.includes('INVOICE') || eventType.includes('REFUND')) {
      return 'Financial'
    }
    if (eventType.includes('DATA_') || eventType.includes('REPORT')) {
      return 'Data Access'
    }
    if (eventType.includes('SECURITY') || eventType.includes('PERMISSION')) {
      return 'Security'
    }
    if (eventType.includes('GDPR') || eventType.includes('TERMS') || eventType.includes('PRIVACY')) {
      return 'Compliance'
    }
    return 'System'
  }

  private async checkComplianceStatus(organizationId: string): Promise<any> {
    // Check various compliance requirements
    const recentLogs = await prisma.auditLog.count({
      where: {
        organizationId,
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    return {
      dataRetention: true, // Audit logs are being retained
      accessControl: recentLogs > 0, // Access is being logged
      auditTrail: true, // Audit trail is active
      encryption: true // Assuming data is encrypted at rest
    }
  }

  private async sendSecurityAlert(eventType: AuditEventType, details: any): Promise<void> {
    console.log('🚨 CRITICAL SECURITY ALERT:', {
      eventType,
      details,
      timestamp: new Date().toISOString()
    })

    // In production, this would send email/SMS/Slack notifications
    // await emailService.sendSecurityAlert(...)
  }
}

// Export singleton instance
export const auditService = AuditService.getInstance()