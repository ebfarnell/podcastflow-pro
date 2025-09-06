/**
 * Structured logging for workflow operations
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export enum WorkflowPhase {
  INITIALIZATION = 'INITIALIZATION',
  VALIDATION = 'VALIDATION',
  EXECUTION = 'EXECUTION',
  COMPLETION = 'COMPLETION',
  ERROR_HANDLING = 'ERROR_HANDLING'
}

export interface WorkflowLogContext {
  workflowId: string
  workflowType: string
  campaignId?: string
  organizationId?: string
  organizationSlug?: string
  userId?: string
  phase: WorkflowPhase
  timestamp: Date
  duration?: number
  metadata?: Record<string, any>
}

export interface WorkflowMetrics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageDuration: number
  lastExecutionTime: Date
  errorRate: number
  activeWorkflows: number
}

class WorkflowLogger {
  private metrics: Map<string, WorkflowMetrics> = new Map()
  private activeWorkflows: Map<string, Date> = new Map()

  /**
   * Log structured workflow event
   */
  log(
    level: LogLevel,
    message: string,
    context: Partial<WorkflowLogContext>
  ) {
    const timestamp = new Date()
    const logEntry = {
      level,
      message,
      timestamp: timestamp.toISOString(),
      ...context,
      environment: process.env.NODE_ENV,
      service: 'campaign-workflow'
    }

    // In production, this would go to CloudWatch or similar
    // For now, use console with structured format
    const prefix = this.getLogPrefix(level)
    console.log(`${prefix} [Workflow] ${JSON.stringify(logEntry)}`)

    // Update metrics if workflow completed
    if (context.phase === WorkflowPhase.COMPLETION && context.workflowId) {
      this.updateMetrics(context.workflowType || 'unknown', true, context.duration)
      this.activeWorkflows.delete(context.workflowId)
    } else if (context.phase === WorkflowPhase.ERROR_HANDLING && context.workflowId) {
      this.updateMetrics(context.workflowType || 'unknown', false, context.duration)
      this.activeWorkflows.delete(context.workflowId)
    } else if (context.phase === WorkflowPhase.INITIALIZATION && context.workflowId) {
      this.activeWorkflows.set(context.workflowId, timestamp)
    }
  }

  /**
   * Start workflow tracking
   */
  startWorkflow(workflowId: string, workflowType: string, metadata?: Record<string, any>): Date {
    const startTime = new Date()
    this.activeWorkflows.set(workflowId, startTime)
    
    this.log(LogLevel.INFO, `Workflow started: ${workflowType}`, {
      workflowId,
      workflowType,
      phase: WorkflowPhase.INITIALIZATION,
      timestamp: startTime,
      metadata
    })

    return startTime
  }

  /**
   * End workflow tracking
   */
  endWorkflow(
    workflowId: string,
    workflowType: string,
    startTime: Date,
    success: boolean,
    metadata?: Record<string, any>
  ) {
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    this.log(
      success ? LogLevel.INFO : LogLevel.ERROR,
      `Workflow ${success ? 'completed' : 'failed'}: ${workflowType}`,
      {
        workflowId,
        workflowType,
        phase: success ? WorkflowPhase.COMPLETION : WorkflowPhase.ERROR_HANDLING,
        timestamp: endTime,
        duration,
        metadata
      }
    )

    this.activeWorkflows.delete(workflowId)
    this.updateMetrics(workflowType, success, duration)
  }

  /**
   * Log workflow error
   */
  error(
    workflowId: string,
    workflowType: string,
    error: Error,
    context?: Partial<WorkflowLogContext>
  ) {
    this.log(LogLevel.ERROR, `Workflow error: ${error.message}`, {
      workflowId,
      workflowType,
      phase: WorkflowPhase.ERROR_HANDLING,
      timestamp: new Date(),
      metadata: {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        ...context?.metadata
      },
      ...context
    })
  }

  /**
   * Log workflow warning
   */
  warn(message: string, context: Partial<WorkflowLogContext>) {
    this.log(LogLevel.WARN, message, context)
  }

  /**
   * Log workflow info
   */
  info(message: string, context: Partial<WorkflowLogContext>) {
    this.log(LogLevel.INFO, message, context)
  }

  /**
   * Log workflow debug
   */
  debug(message: string, context: Partial<WorkflowLogContext>) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      this.log(LogLevel.DEBUG, message, context)
    }
  }

  /**
   * Get metrics for a workflow type
   */
  getMetrics(workflowType?: string): WorkflowMetrics | Map<string, WorkflowMetrics> {
    if (workflowType) {
      return this.metrics.get(workflowType) || this.createEmptyMetrics()
    }
    return this.metrics
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): Array<{ id: string; startTime: Date; duration: number }> {
    const now = new Date()
    return Array.from(this.activeWorkflows.entries()).map(([id, startTime]) => ({
      id,
      startTime,
      duration: now.getTime() - startTime.getTime()
    }))
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this.metrics.clear()
  }

  private updateMetrics(workflowType: string, success: boolean, duration?: number) {
    const existing = this.metrics.get(workflowType) || this.createEmptyMetrics()
    
    existing.totalExecutions++
    if (success) {
      existing.successfulExecutions++
    } else {
      existing.failedExecutions++
    }
    
    if (duration) {
      // Update average duration
      const totalDuration = existing.averageDuration * (existing.totalExecutions - 1) + duration
      existing.averageDuration = Math.round(totalDuration / existing.totalExecutions)
    }
    
    existing.lastExecutionTime = new Date()
    existing.errorRate = existing.failedExecutions / existing.totalExecutions
    existing.activeWorkflows = this.getActiveWorkflowsForType(workflowType)
    
    this.metrics.set(workflowType, existing)
  }

  private getActiveWorkflowsForType(workflowType: string): number {
    // In a real implementation, we'd track type per workflow
    // For now, return total active
    return this.activeWorkflows.size
  }

  private createEmptyMetrics(): WorkflowMetrics {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      lastExecutionTime: new Date(),
      errorRate: 0,
      activeWorkflows: 0
    }
  }

  private getLogPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍'
      case LogLevel.INFO:
        return '📝'
      case LogLevel.WARN:
        return '⚠️'
      case LogLevel.ERROR:
        return '❌'
      case LogLevel.CRITICAL:
        return '🚨'
      default:
        return '📝'
    }
  }
}

// Export singleton instance
export const workflowLogger = new WorkflowLogger()