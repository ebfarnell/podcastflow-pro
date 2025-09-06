import { NextRequest, NextResponse } from 'next/server'
import { workflowLogger } from '@/lib/workflow/workflow-logger'
import { querySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: {
      status: 'ok' | 'error'
      message?: string
      latency?: number
    }
    workflows: {
      status: 'ok' | 'warning' | 'error'
      activeCount: number
      metrics: {
        campaign_90pct: {
          totalExecutions: number
          successRate: number
          averageDuration: number
          lastExecution?: string
        }
      }
    }
    approvals: {
      status: 'ok' | 'warning' | 'error'
      pendingCount: number
      oldestPending?: {
        id: string
        createdAt: string
        campaignName: string
      }
    }
    reservations: {
      status: 'ok' | 'warning' | 'error'
      activeCount: number
      expiringSoon: number
    }
  }
  metrics: {
    uptime: number
    memoryUsage: {
      rss: number
      heapUsed: number
      heapTotal: number
    }
    errorRate: number
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'ok'
        },
        workflows: {
          status: 'ok',
          activeCount: 0,
          metrics: {
            campaign_90pct: {
              totalExecutions: 0,
              successRate: 0,
              averageDuration: 0
            }
          }
        },
        approvals: {
          status: 'ok',
          pendingCount: 0
        },
        reservations: {
          status: 'ok',
          activeCount: 0,
          expiringSoon: 0
        }
      },
      metrics: {
        uptime: process.uptime(),
        memoryUsage: {
          rss: 0,
          heapUsed: 0,
          heapTotal: 0
        },
        errorRate: 0
      }
    }

    // Check database connectivity
    const dbStart = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1`
      health.checks.database.latency = Date.now() - dbStart
      health.checks.database.status = 'ok'
    } catch (error) {
      health.checks.database.status = 'error'
      health.checks.database.message = 'Database connection failed'
      health.status = 'unhealthy'
    }

    // Check workflow metrics
    const activeWorkflows = workflowLogger.getActiveWorkflows()
    health.checks.workflows.activeCount = activeWorkflows.length
    
    const workflowMetrics = workflowLogger.getMetrics('campaign_90pct')
    if (workflowMetrics && typeof workflowMetrics !== 'undefined' && 'totalExecutions' in workflowMetrics) {
      const metrics = workflowMetrics
      health.checks.workflows.metrics.campaign_90pct = {
        totalExecutions: metrics.totalExecutions,
        successRate: metrics.totalExecutions > 0 
          ? (metrics.successfulExecutions / metrics.totalExecutions) * 100 
          : 0,
        averageDuration: metrics.averageDuration,
        lastExecution: metrics.lastExecutionTime?.toISOString()
      }
      
      // Set warning if error rate is high
      if (metrics.errorRate > 0.2) {
        health.checks.workflows.status = 'warning'
        health.status = 'degraded'
      }
      
      health.metrics.errorRate = metrics.errorRate
    }

    // Check for long-running workflows
    const longRunning = activeWorkflows.filter(w => w.duration > 30000) // 30 seconds
    if (longRunning.length > 0) {
      health.checks.workflows.status = 'warning'
      if (health.status === 'healthy') {
        health.status = 'degraded'
      }
    }

    // Check pending approvals (using org_podcastflow_pro as default)
    try {
      const pendingQuery = `
        SELECT 
          ca.id,
          ca."createdAt",
          c.name as campaign_name
        FROM "CampaignApproval" ca
        JOIN "Campaign" c ON c.id = ca."campaignId"
        WHERE ca.status = 'pending'
        ORDER BY ca."createdAt" ASC
        LIMIT 1
      `
      const pendingApprovals = await querySchema<any>('org_podcastflow_pro', pendingQuery, [])
      
      if (pendingApprovals && pendingApprovals.length > 0) {
        health.checks.approvals.pendingCount = pendingApprovals.length
        
        const oldest = pendingApprovals[0]
        const ageInHours = (Date.now() - new Date(oldest.createdAt).getTime()) / (1000 * 60 * 60)
        
        health.checks.approvals.oldestPending = {
          id: oldest.id,
          createdAt: oldest.createdAt,
          campaignName: oldest.campaign_name
        }
        
        // Warning if approval pending for more than 24 hours
        if (ageInHours > 24) {
          health.checks.approvals.status = 'warning'
          if (health.status === 'healthy') {
            health.status = 'degraded'
          }
        }
      }
    } catch (error) {
      console.error('Error checking approvals:', error)
      health.checks.approvals.status = 'error'
    }

    // Check inventory reservations
    try {
      const reservationQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE "expiresAt" < NOW() + INTERVAL '1 hour') as expiring_soon
        FROM "InventoryReservation"
        WHERE status = 'held'
      `
      const reservations = await querySchema<any>('org_podcastflow_pro', reservationQuery, [])
      
      if (reservations && reservations.length > 0) {
        health.checks.reservations.activeCount = parseInt(reservations[0].total || '0')
        health.checks.reservations.expiringSoon = parseInt(reservations[0].expiring_soon || '0')
        
        // Warning if many reservations expiring soon
        if (health.checks.reservations.expiringSoon > 10) {
          health.checks.reservations.status = 'warning'
          if (health.status === 'healthy') {
            health.status = 'degraded'
          }
        }
      }
    } catch (error) {
      console.error('Error checking reservations:', error)
      health.checks.reservations.status = 'error'
    }

    // Get memory metrics
    const memUsage = process.memoryUsage()
    health.metrics.memoryUsage = {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
    }

    // Set appropriate HTTP status code
    const httpStatus = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 207 : 503

    // Add response time
    const responseTime = Date.now() - startTime

    return NextResponse.json({
      ...health,
      responseTime
    }, { status: httpStatus })

  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 503 })
  }
}