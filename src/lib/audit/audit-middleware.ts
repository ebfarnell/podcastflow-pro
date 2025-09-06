import { NextRequest } from 'next/server'
import { auditService, AuditEventType, AuditSeverity } from './audit-service'

/**
 * Audit middleware to log API access and critical operations
 */

interface AuditContext {
  user?: any
  entityType?: string
  entityId?: string
  action?: string
}

/**
 * Log API endpoint access
 */
export async function logApiAccess(
  request: NextRequest,
  context: AuditContext,
  response?: Response
): Promise<void> {
  try {
    const { user, entityType, entityId, action } = context
    const method = request.method
    const path = new URL(request.url).pathname

    // Determine if this is a sensitive operation
    const isSensitive = isSensitiveEndpoint(path, method)
    const isFinancial = isFinancialEndpoint(path)
    const isDataModification = ['POST', 'PUT', 'DELETE'].includes(method)

    // Skip logging for non-sensitive GET requests to reduce noise
    if (method === 'GET' && !isSensitive && !isFinancial) {
      return
    }

    // Determine event type
    let eventType: AuditEventType = AuditEventType.DATA_EXPORTED
    let severity: AuditSeverity = AuditSeverity.LOW

    if (isFinancial) {
      if (path.includes('payment')) {
        eventType = AuditEventType.PAYMENT_PROCESSED
      } else if (path.includes('invoice')) {
        eventType = method === 'POST' ? AuditEventType.INVOICE_CREATED : AuditEventType.INVOICE_UPDATED
      }
      severity = AuditSeverity.HIGH
    } else if (path.includes('/users')) {
      if (method === 'POST') eventType = AuditEventType.USER_CREATED
      else if (method === 'PUT') eventType = AuditEventType.USER_UPDATED
      else if (method === 'DELETE') eventType = AuditEventType.USER_DELETED
      severity = AuditSeverity.MEDIUM
    } else if (path.includes('/campaigns')) {
      if (method === 'POST') eventType = AuditEventType.CAMPAIGN_CREATED
      else if (method === 'PUT') eventType = AuditEventType.CAMPAIGN_UPDATED
      else if (method === 'DELETE') eventType = AuditEventType.CAMPAIGN_DELETED
      severity = AuditSeverity.MEDIUM
    } else if (isSensitive) {
      eventType = AuditEventType.SENSITIVE_DATA_ACCESSED
      severity = AuditSeverity.HIGH
    }

    // Extract request metadata
    const metadata = {
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      apiEndpoint: path,
      httpMethod: method,
      requestId: request.headers.get('x-request-id') || undefined
    }

    // Log the event
    await auditService.log({
      eventType,
      severity,
      userId: user?.id,
      organizationId: user?.organizationId,
      entityType,
      entityId,
      action: action || `${method} ${path}`,
      metadata,
      success: response ? response.ok : true,
      errorMessage: response && !response.ok ? `HTTP ${response.status}` : undefined
    })

  } catch (error) {
    console.error('❌ Audit middleware error:', error)
    // Don't throw - audit logging should not break the application
  }
}

/**
 * Log authentication events
 */
export async function logAuthEvent(
  eventType: AuditEventType,
  request: NextRequest,
  userId?: string,
  details?: any,
  success: boolean = true
): Promise<void> {
  try {
    const metadata = {
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      apiEndpoint: new URL(request.url).pathname,
      httpMethod: request.method
    }

    await auditService.log({
      eventType,
      severity: getAuthEventSeverity(eventType),
      userId,
      action: getEventDescription(eventType),
      details,
      metadata,
      success,
      errorMessage: !success ? details?.error : undefined
    })

  } catch (error) {
    console.error('❌ Auth audit error:', error)
  }
}

/**
 * Log security events
 */
export async function logSecurityEvent(
  eventType: AuditEventType,
  request: NextRequest,
  details: any,
  severity: AuditSeverity = AuditSeverity.HIGH
): Promise<void> {
  try {
    await auditService.logSecurity(eventType, severity, details, request)
  } catch (error) {
    console.error('❌ Security audit error:', error)
  }
}

/**
 * Helper functions
 */
function isSensitiveEndpoint(path: string, method: string): boolean {
  const sensitivePatterns = [
    /\/api\/auth\//,
    /\/api\/users\//,
    /\/api\/master\//,
    /\/api\/audit\//,
    /\/api\/.*\/export/,
    /\/api\/.*\/download/
  ]

  return sensitivePatterns.some(pattern => pattern.test(path))
}

function isFinancialEndpoint(path: string): boolean {
  const financialPatterns = [
    /\/api\/.*\/billing/,
    /\/api\/.*\/payments?/,
    /\/api\/.*\/invoices?/,
    /\/api\/.*\/refund/,
    /\/api\/financials/
  ]

  return financialPatterns.some(pattern => pattern.test(path))
}

function getAuthEventSeverity(eventType: AuditEventType): AuditSeverity {
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

function getEventDescription(eventType: AuditEventType): string {
  const descriptions: Record<string, string> = {
    [AuditEventType.USER_LOGIN]: 'User logged in',
    [AuditEventType.USER_LOGOUT]: 'User logged out',
    [AuditEventType.USER_LOGIN_FAILED]: 'Failed login attempt',
    [AuditEventType.PASSWORD_CHANGED]: 'Password changed',
    [AuditEventType.SESSION_EXPIRED]: 'Session expired'
  }
  return descriptions[eventType] || eventType
}