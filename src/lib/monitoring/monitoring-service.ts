import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import os from 'os'

export interface MetricData {
  cpuUsage?: number
  memoryUsage?: number
  diskUsage?: number
  serverLoad?: number
  networkIncoming?: number
  networkOutgoing?: number
  activeConnections?: number
  apiCalls?: number
  avgLatency?: number
  errorRate?: number
  activeUsers?: number
  dbConnections?: number
  cacheHitRate?: number
  cacheMissRate?: number
}

export interface AlertData {
  type: 'critical' | 'warning' | 'info'
  severity: 'high' | 'medium' | 'low'
  title: string
  message: string
  source: string
  metric?: string
  threshold?: number
  actualValue?: number
  metadata?: any
}

export interface LogData {
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  source: string
  message: string
  userId?: string
  organizationId?: string
  requestId?: string
  ipAddress?: string
  userAgent?: string
  endpoint?: string
  httpMethod?: string
  statusCode?: number
  errorCode?: string
  errorStack?: string
  metadata?: any
}

export class MonitoringService {
  private metricsBuffer: MetricData[] = []
  private metricsInterval: NodeJS.Timeout | null = null

  constructor() {
    // Start collecting system metrics every minute
    this.startMetricsCollection()
  }

  /**
   * Start automatic metrics collection
   */
  private startMetricsCollection() {
    if (this.metricsInterval) return

    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics()
      } catch (error) {
        console.error('Error collecting system metrics:', error)
      }
    }, 60000) // Every minute
  }

  /**
   * Stop metrics collection
   */
  stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
      this.metricsInterval = null
    }
  }

  /**
   * Collect current system metrics
   */
  async collectSystemMetrics() {
    try {
      // Get system metrics
      const cpuUsage = process.cpuUsage()
      const memoryUsage = process.memoryUsage()
      const loadAvg = os.loadavg()

      // Calculate percentages
      const totalMemory = os.totalmem()
      const freeMemory = os.freemem()
      const usedMemory = totalMemory - freeMemory
      const memoryPercent = (usedMemory / totalMemory) * 100

      // Get database connection count
      const dbConnections = await prisma.$executeRaw`
        SELECT COUNT(*) as count FROM pg_stat_activity 
        WHERE datname = current_database()
      ` as any

      // Get active users count (sessions in last hour)
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const activeSessions = await prisma.session.count({
        where: {
          lastAccessedAt: { gte: hourAgo }
        }
      })

      // Store metrics
      const metrics: MetricData = {
        cpuUsage: Math.min((cpuUsage.user + cpuUsage.system) / 1000000 / os.cpus().length, 100),
        memoryUsage: memoryPercent,
        serverLoad: loadAvg[0] * 100 / os.cpus().length, // 1-minute load average as percentage
        diskUsage: 0, // Would need additional logic to get disk usage
        activeConnections: activeSessions,
        activeUsers: activeSessions,
        dbConnections: parseInt(dbConnections) || 0,
        networkIncoming: 0, // Would need real network monitoring integration
        networkOutgoing: 0, // Would need real network monitoring integration
        apiCalls: 0, // Will be incremented by API middleware
        avgLatency: 0, // Will be calculated from API logs
        errorRate: 0, // Will be calculated from API logs
        cacheHitRate: 0, // Would need cache implementation
        cacheMissRate: 0
      }

      await this.recordMetrics(metrics)

      // Check for alerts
      await this.checkMetricThresholds(metrics)

    } catch (error) {
      console.error('Error collecting system metrics:', error)
    }
  }

  /**
   * Record metrics to database
   */
  async recordMetrics(data: MetricData) {
    try {
      // Map field names to match database schema
      const dbData = {
        cpu: data.cpuUsage || 0,
        memory: data.memoryUsage || 0,
        disk: data.diskUsage || 0,
        activeUsers: data.activeUsers || 0,
        apiRequests: data.requests || 0,
        avgResponseTime: data.avgResponseTime || 0,
        timestamp: new Date(),
        details: data as any
      }
      await prisma.systemMetric.create({ data: dbData })
      console.log('📊 System metrics recorded')
    } catch (error) {
      console.error('Error recording metrics:', error)
    }
  }

  /**
   * Check metric thresholds and create alerts
   */
  async checkMetricThresholds(metrics: MetricData) {
    const alerts: AlertData[] = []

    // CPU usage alert
    if (metrics.cpuUsage && metrics.cpuUsage > 80) {
      alerts.push({
        type: 'critical',
        severity: 'high',
        title: 'High CPU Usage',
        message: `CPU usage is at ${metrics.cpuUsage.toFixed(1)}%`,
        source: 'server',
        metric: 'cpuUsage',
        threshold: 80,
        actualValue: metrics.cpuUsage
      })
    }

    // Memory usage alert
    if (metrics.memoryUsage && metrics.memoryUsage > 85) {
      alerts.push({
        type: metrics.memoryUsage > 90 ? 'critical' : 'warning',
        severity: metrics.memoryUsage > 90 ? 'high' : 'medium',
        title: 'High Memory Usage',
        message: `Memory usage is at ${metrics.memoryUsage.toFixed(1)}%`,
        source: 'server',
        metric: 'memoryUsage',
        threshold: 85,
        actualValue: metrics.memoryUsage
      })
    }

    // Server load alert
    if (metrics.serverLoad && metrics.serverLoad > 70) {
      alerts.push({
        type: 'warning',
        severity: 'medium',
        title: 'High Server Load',
        message: `Server load is at ${metrics.serverLoad.toFixed(1)}%`,
        source: 'server',
        metric: 'serverLoad',
        threshold: 70,
        actualValue: metrics.serverLoad
      })
    }

    // Database connections alert
    if (metrics.dbConnections && metrics.dbConnections > 90) {
      alerts.push({
        type: 'warning',
        severity: 'medium',
        title: 'High Database Connections',
        message: `Database has ${metrics.dbConnections} active connections`,
        source: 'database',
        metric: 'dbConnections',
        threshold: 90,
        actualValue: metrics.dbConnections
      })
    }

    // Create alerts in database
    for (const alert of alerts) {
      await this.createAlert(alert)
    }
  }

  /**
   * Create an alert
   */
  async createAlert(data: AlertData) {
    try {
      // Check if similar unresolved alert exists
      const existingAlert = await prisma.monitoringAlert.findFirst({
        where: {
          type: data.type,
          source: data.source,
          metric: data.metric,
          resolved: false,
          timestamp: {
            gte: new Date(Date.now() - 30 * 60 * 1000) // Within last 30 minutes
          }
        }
      })

      if (!existingAlert) {
        await prisma.monitoringAlert.create({
          data: {
            ...data,
            metadata: data.metadata || {}
          }
        })
        console.log(`🚨 Alert created: ${data.title}`)
      }
    } catch (error) {
      console.error('Error creating alert:', error)
    }
  }

  /**
   * Log system event
   */
  async log(data: LogData) {
    try {
      await prisma.systemLog.create({
        data: {
          ...data,
          metadata: data.metadata || {}
        }
      })
    } catch (error) {
      console.error('Error creating system log:', error)
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    const services = await prisma.serviceHealth.findMany()
    
    // If no services registered, create defaults
    if (services.length === 0) {
      const defaultServices = ['API Gateway', 'Database', 'Authentication', 'Cache', 'Email Service']
      for (const serviceName of defaultServices) {
        await prisma.serviceHealth.create({
          data: {
            serviceName,
            status: 'healthy',
            uptime: 99.9,
            responseTime: 150, // Default response time in production
            errorRate: 0.01 // Default 1% error rate
          }
        })
      }
      return this.getSystemHealth()
    }

    // Calculate overall health
    const unhealthyCount = services.filter(s => s.status !== 'healthy').length
    let overallStatus = 'healthy'
    if (unhealthyCount > 0) {
      overallStatus = unhealthyCount > 2 ? 'critical' : 'degraded'
    }

    return {
      status: overallStatus,
      services: services.map(s => ({
        name: s.serviceName,
        status: s.status,
        uptime: s.uptime / 100,
        latency: s.responseTime,
        errorRate: s.errorRate,
        lastChecked: s.lastCheckTime
      })),
      lastChecked: new Date().toISOString()
    }
  }

  /**
   * Get metrics for a time range
   */
  async getMetrics(hours: number = 1) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    const metrics = await prisma.systemMetric.findMany({
      where: {
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'asc' }
    })

    // Transform database fields to match expected interface
    return metrics.map(m => ({
      ...m,
      cpuUsage: m.cpu,
      memoryUsage: m.memory,
      diskUsage: m.disk,
      requests: m.apiRequests,
      errorRate: 0 // Calculate from details if needed
    }))
  }

  /**
   * Get recent alerts
   */
  async getAlerts(limit: number = 50, includeResolved: boolean = false) {
    const where: Prisma.MonitoringAlertWhereInput = {}
    if (!includeResolved) {
      where.resolved = false
    }

    const alerts = await prisma.monitoringAlert.findMany({
      where,
      include: {
        resolver: true
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    })

    return alerts
  }

  /**
   * Get system logs
   */
  async getLogs(filter: {
    level?: string
    source?: string
    userId?: string
    organizationId?: string
    limit?: number
    since?: Date
  }) {
    const where: Prisma.SystemLogWhereInput = {}
    
    if (filter.level) where.level = filter.level
    if (filter.source) where.source = filter.source
    if (filter.userId) where.userId = filter.userId
    if (filter.organizationId) where.organizationId = filter.organizationId
    if (filter.since) where.timestamp = { gte: filter.since }

    const logs = await prisma.systemLog.findMany({
      where,
      include: {
        user: true,
        organization: true
      },
      orderBy: { timestamp: 'desc' },
      take: filter.limit || 100
    })

    return logs
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string, note?: string) {
    const alert = await prisma.monitoringAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNote: note
      }
    })

    await this.log({
      level: 'info',
      source: 'monitoring',
      message: `Alert resolved: ${alert.title}`,
      userId: resolvedBy,
      metadata: { alertId, note }
    })

    return alert
  }

  /**
   * Update service health
   */
  async updateServiceHealth(
    serviceName: string,
    status: string,
    responseTime?: number,
    errorRate?: number,
    errorMessage?: string
  ) {
    const service = await prisma.serviceHealth.upsert({
      where: { serviceName },
      update: {
        status,
        responseTime: responseTime || 0,
        errorRate: errorRate || 0,
        lastCheckTime: new Date(),
        lastErrorTime: errorMessage ? new Date() : undefined,
        lastErrorMessage: errorMessage,
        consecutiveFailures: status === 'healthy' ? 0 : { increment: 1 }
      },
      create: {
        serviceName,
        status,
        responseTime: responseTime || 0,
        errorRate: errorRate || 0
      }
    })

    // Create alert if service is critical
    if (status === 'critical' || status === 'offline') {
      await this.createAlert({
        type: 'critical',
        severity: 'high',
        title: `Service ${serviceName} is ${status}`,
        message: errorMessage || `Service ${serviceName} health check failed`,
        source: 'health-check',
        metric: 'service-health',
        metadata: { serviceName, status }
      })
    }

    return service
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData() {
    const [
      systemHealth,
      recentMetrics,
      activeAlerts,
      recentLogs,
      currentMetrics
    ] = await Promise.all([
      this.getSystemHealth(),
      this.getMetrics(1), // Last hour
      this.getAlerts(10, false),
      this.getLogs({ limit: 20 }),
      prisma.systemMetric.findFirst({
        orderBy: { timestamp: 'desc' }
      })
    ])

    return {
      systemHealth,
      serverMetrics: currentMetrics ? {
        activeConnections: currentMetrics.activeConnections,
        serverLoad: currentMetrics.serverLoad,
        memoryUsage: currentMetrics.memoryUsage,
        diskUsage: currentMetrics.diskUsage,
        networkTraffic: {
          incoming: currentMetrics.networkIncoming,
          outgoing: currentMetrics.networkOutgoing
        }
      } : null,
      metricsHistory: recentMetrics,
      alerts: activeAlerts,
      recentLogs,
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(retentionDays: number = 30) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    const [metricsDeleted, alertsDeleted, logsDeleted] = await Promise.all([
      prisma.systemMetric.deleteMany({
        where: { timestamp: { lt: cutoffDate } }
      }),
      prisma.monitoringAlert.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          resolved: true
        }
      }),
      prisma.systemLog.deleteMany({
        where: { timestamp: { lt: cutoffDate } }
      })
    ])

    console.log(`🗑️ Monitoring cleanup: ${metricsDeleted.count} metrics, ${alertsDeleted.count} alerts, ${logsDeleted.count} logs deleted`)
    
    return {
      metricsDeleted: metricsDeleted.count,
      alertsDeleted: alertsDeleted.count,
      logsDeleted: logsDeleted.count
    }
  }
}

export const monitoringService = new MonitoringService()