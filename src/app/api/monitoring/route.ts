import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { monitoringService } from '@/lib/monitoring/monitoring-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'dashboard'
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const level = url.searchParams.get('level') || 'all'
    const hours = parseInt(url.searchParams.get('hours') || '1')
    const includeResolved = url.searchParams.get('includeResolved') === 'true'

    // Verify authentication using cookie
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Validate session
    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Check if user is master
    if (user.role !== 'master') {
      return NextResponse.json(
        { error: 'Master access required' },
        { status: 403 }
      )
    }

    // Log API access
    await monitoringService.log({
      level: 'info',
      source: 'monitoring-api',
      message: `Monitoring data accessed: ${type}`,
      userId: user.id,
      organizationId: user.organizationId || undefined,
      endpoint: '/api/monitoring',
      httpMethod: 'GET',
      metadata: { type, limit, level }
    })

    switch (type) {
      case 'dashboard':
        const dashboardData = await monitoringService.getDashboardData()
        return NextResponse.json(dashboardData)
      
      case 'health':
        const healthData = await monitoringService.getSystemHealth()
        return NextResponse.json(healthData)
      
      case 'metrics':
        const metricsData = await monitoringService.getMetrics(hours)
        return NextResponse.json({ metrics: metricsData })
      
      case 'alerts':
        const alertsData = await monitoringService.getAlerts(limit, includeResolved)
        return NextResponse.json({ alerts: alertsData })
      
      case 'logs':
        const logsData = await monitoringService.getLogs({
          level: level !== 'all' ? level : undefined,
          limit,
          since: hours ? new Date(Date.now() - hours * 60 * 60 * 1000) : undefined
        })
        return NextResponse.json({ logs: logsData })
      
      default:
        return NextResponse.json(
          { error: 'Invalid monitoring type' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Monitoring API error:', error)
    await monitoringService.log({
      level: 'error',
      source: 'monitoring-api',
      message: 'Failed to retrieve monitoring data',
      errorCode: 'MONITORING_GET_ERROR',
      errorStack: error instanceof Error ? error.stack : undefined,
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Verify authentication using cookie
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Validate session
    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Check if user is master
    if (user.role !== 'master') {
      return NextResponse.json(
        { error: 'Master access required' },
        { status: 403 }
      )
    }

    // Handle different monitoring actions
    const { action, data } = body

    switch (action) {
      case 'resolve_alert':
        const resolvedAlert = await monitoringService.resolveAlert(
          data.alertId,
          user.id,
          data.note
        )
        return NextResponse.json({
          message: 'Alert resolved successfully',
          alert: resolvedAlert
        })
      
      case 'create_alert':
        await monitoringService.createAlert(data)
        return NextResponse.json({
          message: 'Alert created successfully'
        })
      
      case 'update_service_health':
        const service = await monitoringService.updateServiceHealth(
          data.serviceName,
          data.status,
          data.responseTime,
          data.errorRate,
          data.errorMessage
        )
        return NextResponse.json({
          message: 'Service health updated',
          service
        })
      
      case 'cleanup_old_data':
        const cleanup = await monitoringService.cleanupOldData(data.retentionDays || 30)
        return NextResponse.json({
          message: 'Old data cleaned up successfully',
          ...cleanup
        })
      
      case 'collect_metrics':
        await monitoringService.collectSystemMetrics()
        return NextResponse.json({
          message: 'System metrics collected successfully'
        })
      
      default:
        return NextResponse.json(
          { error: 'Invalid monitoring action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Monitoring POST error:', error)
    await monitoringService.log({
      level: 'error',
      source: 'monitoring-api',
      message: 'Failed to process monitoring action',
      userId: request.cookies.get('auth-token')?.value,
      errorCode: 'MONITORING_POST_ERROR',
      errorStack: error instanceof Error ? error.stack : undefined,
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
