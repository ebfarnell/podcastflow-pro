import { NextRequest, NextResponse } from 'next/server'
import { monitoringService } from './monitoring-service'
import { randomUUID } from 'crypto'

export interface MonitoringContext {
  requestId: string
  startTime: number
  endpoint: string
  method: string
  userId?: string
  organizationId?: string
}

/**
 * Create a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`
}

/**
 * Extract user info from request
 */
async function extractUserInfo(request: NextRequest): Promise<{ userId?: string; organizationId?: string }> {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) return {}

    // Import UserService dynamically to avoid circular dependencies
    const { UserService } = await import('@/lib/auth/user-service')
    const user = await UserService.validateSession(authToken.value)
    
    if (user) {
      return {
        userId: user.id,
        organizationId: user.organizationId || undefined
      }
    }
  } catch (error) {
    console.error('Error extracting user info:', error)
  }
  return {}
}

/**
 * Start monitoring for a request
 */
export async function startMonitoring(request: NextRequest): Promise<MonitoringContext> {
  const requestId = generateRequestId()
  const { userId, organizationId } = await extractUserInfo(request)
  
  const context: MonitoringContext = {
    requestId,
    startTime: Date.now(),
    endpoint: request.nextUrl.pathname,
    method: request.method,
    userId,
    organizationId
  }

  // Log request start
  await monitoringService.log({
    level: 'debug',
    source: 'api-gateway',
    message: `API Request started: ${context.method} ${context.endpoint}`,
    userId: context.userId,
    organizationId: context.organizationId,
    requestId: context.requestId,
    endpoint: context.endpoint,
    httpMethod: context.method,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  })

  return context
}

/**
 * Complete monitoring for a request
 */
export async function completeMonitoring(
  context: MonitoringContext,
  response: NextResponse,
  error?: Error
) {
  const duration = Date.now() - context.startTime
  const statusCode = response.status

  // Update API metrics
  await updateApiMetrics(duration, statusCode, error)

  // Log based on status
  if (error || statusCode >= 500) {
    await monitoringService.log({
      level: 'error',
      source: 'api-gateway',
      message: `API Request failed: ${context.method} ${context.endpoint}`,
      userId: context.userId,
      organizationId: context.organizationId,
      requestId: context.requestId,
      endpoint: context.endpoint,
      httpMethod: context.method,
      statusCode,
      errorCode: error ? 'INTERNAL_ERROR' : `HTTP_${statusCode}`,
      errorStack: error?.stack,
      metadata: {
        duration,
        error: error?.message
      }
    })

    // Create alert for high error rates
    if (statusCode >= 500) {
      await monitoringService.createAlert({
        type: 'warning',
        severity: 'medium',
        title: 'API Error Rate Increase',
        message: `${context.endpoint} returned ${statusCode}`,
        source: 'api-gateway',
        metric: 'errorRate',
        metadata: {
          endpoint: context.endpoint,
          statusCode,
          requestId: context.requestId
        }
      })
    }
  } else if (statusCode >= 400) {
    await monitoringService.log({
      level: 'warning',
      source: 'api-gateway',
      message: `API Request client error: ${context.method} ${context.endpoint}`,
      userId: context.userId,
      organizationId: context.organizationId,
      requestId: context.requestId,
      endpoint: context.endpoint,
      httpMethod: context.method,
      statusCode,
      metadata: { duration }
    })
  } else if (duration > 3000) {
    // Log slow requests
    await monitoringService.log({
      level: 'warning',
      source: 'api-gateway',
      message: `Slow API request: ${context.method} ${context.endpoint} took ${duration}ms`,
      userId: context.userId,
      organizationId: context.organizationId,
      requestId: context.requestId,
      endpoint: context.endpoint,
      httpMethod: context.method,
      statusCode,
      metadata: { duration }
    })
  } else {
    // Success - only log if debug level
    await monitoringService.log({
      level: 'debug',
      source: 'api-gateway',
      message: `API Request completed: ${context.method} ${context.endpoint}`,
      userId: context.userId,
      organizationId: context.organizationId,
      requestId: context.requestId,
      endpoint: context.endpoint,
      httpMethod: context.method,
      statusCode,
      metadata: { duration }
    })
  }

  // Update service health
  await monitoringService.updateServiceHealth(
    'API Gateway',
    statusCode >= 500 ? 'degraded' : 'healthy',
    duration,
    error ? 1 : 0,
    error?.message
  )
}

/**
 * Update API metrics in memory (will be persisted by monitoring service)
 */
let apiMetrics = {
  totalCalls: 0,
  totalDuration: 0,
  errorCount: 0,
  lastReset: Date.now()
}

async function updateApiMetrics(duration: number, statusCode: number, error?: Error) {
  apiMetrics.totalCalls++
  apiMetrics.totalDuration += duration
  if (error || statusCode >= 500) {
    apiMetrics.errorCount++
  }

  // Reset metrics every hour
  if (Date.now() - apiMetrics.lastReset > 60 * 60 * 1000) {
    apiMetrics = {
      totalCalls: 0,
      totalDuration: 0,
      errorCount: 0,
      lastReset: Date.now()
    }
  }

  // Record current metrics
  await monitoringService.recordMetrics({
    apiCalls: apiMetrics.totalCalls,
    avgLatency: apiMetrics.totalCalls > 0 ? apiMetrics.totalDuration / apiMetrics.totalCalls : 0,
    errorRate: apiMetrics.totalCalls > 0 ? (apiMetrics.errorCount / apiMetrics.totalCalls) * 100 : 0
  })
}

/**
 * Monitoring wrapper for API routes
 */
export function withMonitoring(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    const monitoringContext = await startMonitoring(request)
    
    try {
      const response = await handler(request, context)
      await completeMonitoring(monitoringContext, response)
      return response
    } catch (error) {
      const errorResponse = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
      await completeMonitoring(monitoringContext, errorResponse, error as Error)
      throw error
    }
  }
}