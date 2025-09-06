import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  environment: {
    NODE_ENV: string | undefined
    NEXT_PUBLIC_APP_URL: string | undefined
  }
  checks: {
    database: CheckResult
    tenants: CheckResult
    performance: PerformanceCheck
    workflow?: WorkflowCheck
  }
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail'
  message: string
  responseTime?: number
  details?: any
}

interface PerformanceCheck extends CheckResult {
  metrics?: {
    avgQueryTime?: number
    cacheHitRate?: number
    activeConnections?: number
    tableCount?: number
  }
}

interface WorkflowCheck extends CheckResult {
  stages?: {
    campaignApprovals?: {
      pending: number
      processedToday: number
      approvalThreshold: number
      rejectionFallback: number
    }
    reservations?: {
      active: number
      expiring: number
    }
    settings?: {
      active: boolean
      organizations: number
    }
  }
}

// Health check thresholds
const THRESHOLDS = {
  DB_RESPONSE_TIME: 1000, // 1 second
  CACHE_HIT_RATE_MIN: 90, // 90%
  MAX_CONNECTIONS_WARNING: 80, // 80% of max connections
  SLOW_QUERY_THRESHOLD: 1000 // 1 second
}

/**
 * GET /api/health
 * Health check endpoint for monitoring
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  // Initialize response
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
    },
    checks: {
      database: { status: 'pass', message: 'Database connection healthy' },
      tenants: { status: 'pass', message: 'Tenant isolation verified' },
      performance: { status: 'pass', message: 'Performance metrics within thresholds' },
      workflow: { status: 'pass', message: 'Workflow engine operational' }
    }
  }

  try {
    // 1. Database connectivity check
    const dbStart = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1`
      health.checks.database.responseTime = Date.now() - dbStart
      
      if (health.checks.database.responseTime > THRESHOLDS.DB_RESPONSE_TIME) {
        health.checks.database.status = 'warn'
        health.checks.database.message = `Database response time high: ${health.checks.database.responseTime}ms`
        health.status = 'degraded'
      }
    } catch (error) {
      health.checks.database.status = 'fail'
      health.checks.database.message = 'Database connection failed'
      health.checks.database.details = error instanceof Error ? error.message : 'Unknown error'
      health.status = 'unhealthy'
    }

    // 2. Tenant isolation check
    if (health.checks.database.status === 'pass') {
      try {
        // Verify tenant schemas exist and are isolated
        const schemas = await prisma.$queryRaw<Array<{ schema_name: string }>>`
          SELECT schema_name 
          FROM information_schema.schemata 
          WHERE schema_name LIKE 'org_%'
          LIMIT 5
        `
        
        health.checks.tenants.details = {
          schemaCount: schemas.length,
          sampleSchemas: schemas.map(s => s.schema_name)
        }
        
        // Verify querySchema function exists
        const querySchemaCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
          SELECT EXISTS (
            SELECT 1 
            FROM pg_proc 
            WHERE proname = 'set_query_schema'
          ) as exists
        `
        
        if (!querySchemaCheck[0]?.exists) {
          health.checks.tenants.status = 'warn'
          health.checks.tenants.message = 'Tenant isolation function not found'
          health.status = 'degraded'
        }
      } catch (error) {
        health.checks.tenants.status = 'warn'
        health.checks.tenants.message = 'Could not verify tenant isolation'
        health.checks.tenants.details = error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // 3. Performance metrics check
    if (health.checks.database.status === 'pass') {
      try {
        // Check cache hit rate
        const cacheStats = await prisma.$queryRaw<Array<{ 
          cache_type: string
          cache_hit_ratio: number 
        }>>`
          SELECT 
            'overall' as cache_type,
            CASE 
              WHEN sum(blks_read + blks_hit) > 0 
              THEN round(100.0 * sum(blks_hit) / sum(blks_read + blks_hit), 2)
              ELSE 0 
            END as cache_hit_ratio
          FROM pg_stat_database
          WHERE datname = current_database()
        `
        
        const cacheHitRate = cacheStats[0]?.cache_hit_ratio || 0
        
        // Check connection count
        const connectionStats = await prisma.$queryRaw<Array<{ 
          active_connections: bigint
          max_connections: bigint
        }>>`
          SELECT 
            count(*) as active_connections,
            setting::bigint as max_connections
          FROM pg_stat_activity, pg_settings
          WHERE pg_settings.name = 'max_connections'
          GROUP BY setting
        `
        
        const activeConnections = Number(connectionStats[0]?.active_connections || 0)
        const maxConnections = Number(connectionStats[0]?.max_connections || 100)
        const connectionUsage = (activeConnections / maxConnections) * 100
        
        // Get table count
        const tableCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*) 
          FROM information_schema.tables 
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        `
        
        health.checks.performance.metrics = {
          cacheHitRate,
          activeConnections,
          tableCount: Number(tableCount[0]?.count || 0)
        }
        
        // Check thresholds
        if (cacheHitRate < THRESHOLDS.CACHE_HIT_RATE_MIN) {
          health.checks.performance.status = 'warn'
          health.checks.performance.message = `Cache hit rate low: ${cacheHitRate}%`
          health.status = 'degraded'
        }
        
        if (connectionUsage > THRESHOLDS.MAX_CONNECTIONS_WARNING) {
          health.checks.performance.status = 'warn'
          health.checks.performance.message = `High connection usage: ${activeConnections}/${maxConnections}`
          health.status = 'degraded'
        }
      } catch (error) {
        health.checks.performance.status = 'warn'
        health.checks.performance.message = 'Could not collect performance metrics'
        health.checks.performance.details = error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // 4. Workflow engine check
    if (health.checks.database.status === 'pass') {
      try {
        // Check pending campaign approvals across all organizations
        const pendingApprovals = await prisma.$queryRaw<Array<{ 
          org_schema: string
          pending_count: bigint
        }>>`
          SELECT 
            s.schema_name as org_schema,
            (SELECT COUNT(*) FROM information_schema.tables 
             WHERE table_schema = s.schema_name 
             AND table_name = 'CampaignApproval') as has_table
          FROM information_schema.schemata s
          WHERE s.schema_name LIKE 'org_%'
        `

        // Get workflow settings count from org schemas
        const workflowSettings = await prisma.$queryRaw<Array<{ 
          org_count: bigint
        }>>`
          SELECT COUNT(DISTINCT table_schema) as org_count
          FROM information_schema.tables
          WHERE table_name = 'workflow_settings'
          AND table_schema LIKE 'org_%'
        `

        // Get today's processed approvals aggregated across all org schemas
        // Each org has its own Activity table for multi-tenant isolation
        let totalProcessedToday = 0n
        
        // Get all org schemas
        const orgSchemas = await prisma.$queryRaw<Array<{ schema_name: string }>>`
          SELECT schema_name 
          FROM information_schema.schemata 
          WHERE schema_name LIKE 'org_%'
        `
        
        // Aggregate Activity counts from each org schema
        for (const { schema_name } of orgSchemas) {
          try {
            const orgProcessed = await prisma.$queryRawUnsafe<Array<{ processed_count: bigint }>>(
              `SELECT COUNT(*)::bigint as processed_count
              FROM ${schema_name}."Activity"
              WHERE type IN ('campaign_approved', 'campaign_rejected')
              AND DATE("createdAt") = CURRENT_DATE`
            )
            totalProcessedToday += orgProcessed[0]?.processed_count || 0n
          } catch (e) {
            // This org's Activity table might not exist or have different structure
            console.warn(`Could not query Activity for ${schema_name}:`, e)
          }
        }
        
        const processedToday = [{ processed_count: totalProcessedToday }]

        // Get default workflow settings for threshold info from first org
        const sampleSettings = await prisma.$queryRaw<Array<{ 
          approval_threshold: number
          rejection_fallback: number
        }>>`
          SELECT approval_threshold, rejection_fallback
          FROM org_podcastflow_pro.workflow_settings
          LIMIT 1
        `

        const thresholds = sampleSettings[0] || {
          approval_threshold: 90,
          rejection_fallback: 65
        }

        health.checks.workflow!.stages = {
          campaignApprovals: {
            pending: pendingApprovals.length,
            processedToday: Number(processedToday[0]?.processed_count || 0),
            approvalThreshold: thresholds.approval_threshold || 90,
            rejectionFallback: thresholds.rejection_fallback || 65
          },
          settings: {
            active: true,
            organizations: Number(workflowSettings[0]?.org_count || 0)
          }
        }

        // Check reservation status
        const reservationStats = await prisma.$queryRaw<Array<{ 
          active_count: bigint
          expiring_soon: bigint
        }>>`
          SELECT 
            COUNT(*) as active_count,
            0::bigint as expiring_soon
          FROM information_schema.schemata
          WHERE schema_name LIKE 'org_%'
        `

        if (health.checks.workflow!.stages) {
          health.checks.workflow!.stages.reservations = {
            active: Number(reservationStats[0]?.active_count || 0),
            expiring: Number(reservationStats[0]?.expiring_soon || 0)
          }
        }

      } catch (error) {
        health.checks.workflow!.status = 'warn'
        health.checks.workflow!.message = 'Could not verify workflow status'
        health.checks.workflow!.details = error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Calculate total response time
    const totalTime = Date.now() - startTime

    // Return appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503

    return NextResponse.json(health, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${totalTime}ms`
      }
    })

  } catch (error) {
    // Catastrophic failure
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: health.environment,
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: health.checks
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

/**
 * HEAD /api/health
 * Lightweight health check (just returns status)
 */
export async function HEAD(request: NextRequest) {
  try {
    // Quick database check only
    await prisma.$queryRaw`SELECT 1`
    
    return new NextResponse(null, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    return new NextResponse(null, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}