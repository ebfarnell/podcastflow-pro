import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { WorkflowLogger, WorkflowPhase } from '../workflow-logger'

describe('WorkflowLogger', () => {
  let logger: WorkflowLogger

  beforeEach(() => {
    logger = new WorkflowLogger('test-workflow')
    jest.clearAllMocks()
    // Mock console methods
    global.console.log = jest.fn()
    global.console.error = jest.fn()
    global.console.warn = jest.fn()
  })

  describe('startWorkflow', () => {
    it('should initialize workflow with correct metadata', () => {
      const metadata = { campaignId: 'camp-123', userId: 'user-456' }
      logger.startWorkflow(metadata)

      expect(logger['activeWorkflowId']).toBeDefined()
      expect(logger['activeWorkflows'].size).toBe(1)
      
      const workflow = Array.from(logger['activeWorkflows'].values())[0]
      expect(workflow.metadata).toEqual(metadata)
      expect(workflow.phase).toBe(WorkflowPhase.INITIALIZATION)
      expect(workflow.startTime).toBeDefined()
    })

    it('should return unique workflow ID', () => {
      const id1 = logger.startWorkflow({})
      const id2 = logger.startWorkflow({})
      
      expect(id1).not.toBe(id2)
      expect(logger['activeWorkflows'].size).toBe(2)
    })
  })

  describe('logPhase', () => {
    it('should update workflow phase', () => {
      const workflowId = logger.startWorkflow({})
      logger.logPhase(workflowId, WorkflowPhase.VALIDATION)

      const workflow = logger['activeWorkflows'].get(workflowId)
      expect(workflow?.phase).toBe(WorkflowPhase.VALIDATION)
      expect(workflow?.events.length).toBe(1)
      expect(workflow?.events[0].type).toBe('phase_change')
    })

    it('should handle invalid workflow ID gracefully', () => {
      logger.logPhase('invalid-id', WorkflowPhase.EXECUTION)
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Workflow not found')
      )
    })
  })

  describe('logEvent', () => {
    it('should add event to workflow', () => {
      const workflowId = logger.startWorkflow({})
      const eventData = { action: 'test-action', result: 'success' }
      
      logger.logEvent(workflowId, 'test_event', eventData)

      const workflow = logger['activeWorkflows'].get(workflowId)
      expect(workflow?.events.length).toBe(1)
      expect(workflow?.events[0]).toMatchObject({
        type: 'test_event',
        data: eventData
      })
    })

    it('should handle multiple events', () => {
      const workflowId = logger.startWorkflow({})
      
      logger.logEvent(workflowId, 'event1', { data: 1 })
      logger.logEvent(workflowId, 'event2', { data: 2 })
      logger.logEvent(workflowId, 'event3', { data: 3 })

      const workflow = logger['activeWorkflows'].get(workflowId)
      expect(workflow?.events.length).toBe(3)
    })
  })

  describe('logError', () => {
    it('should log error and update phase', () => {
      const workflowId = logger.startWorkflow({})
      const error = new Error('Test error')
      
      logger.logError(workflowId, error, { context: 'test' })

      const workflow = logger['activeWorkflows'].get(workflowId)
      expect(workflow?.phase).toBe(WorkflowPhase.ERROR_HANDLING)
      expect(workflow?.error).toBe(error)
      expect(console.error).toHaveBeenCalled()
    })

    it('should handle string errors', () => {
      const workflowId = logger.startWorkflow({})
      
      logger.logError(workflowId, 'String error', {})

      const workflow = logger['activeWorkflows'].get(workflowId)
      expect(workflow?.error).toBeInstanceOf(Error)
      expect(workflow?.error?.message).toBe('String error')
    })
  })

  describe('endWorkflow', () => {
    it('should mark workflow as completed', () => {
      const workflowId = logger.startWorkflow({})
      
      logger.endWorkflow(workflowId, 'success')

      const workflow = logger['activeWorkflows'].get(workflowId)
      expect(workflow?.phase).toBe(WorkflowPhase.COMPLETION)
      expect(workflow?.endTime).toBeDefined()
      expect(workflow?.result).toBe('success')
    })

    it('should calculate execution time', () => {
      const workflowId = logger.startWorkflow({})
      
      // Simulate some time passing
      const workflow = logger['activeWorkflows'].get(workflowId)
      if (workflow) {
        workflow.startTime = Date.now() - 1000 // 1 second ago
      }
      
      logger.endWorkflow(workflowId, 'success')

      expect(workflow?.executionTime).toBeGreaterThanOrEqual(1000)
    })

    it('should update metrics', () => {
      const workflowId = logger.startWorkflow({})
      logger.endWorkflow(workflowId, 'success')

      const metrics = logger.getMetrics()
      expect(metrics.totalExecuted).toBe(1)
      expect(metrics.successCount).toBe(1)
      expect(metrics.failureCount).toBe(0)
    })
  })

  describe('getMetrics', () => {
    it('should return accurate metrics', () => {
      // Execute multiple workflows
      const id1 = logger.startWorkflow({})
      logger.endWorkflow(id1, 'success')

      const id2 = logger.startWorkflow({})
      logger.logError(id2, new Error('Failed'), {})
      logger.endWorkflow(id2, 'failure')

      const id3 = logger.startWorkflow({})
      logger.endWorkflow(id3, 'success')

      const id4 = logger.startWorkflow({}) // Active workflow
      
      const metrics = logger.getMetrics()

      expect(metrics.totalExecuted).toBe(3)
      expect(metrics.successCount).toBe(2)
      expect(metrics.failureCount).toBe(1)
      expect(metrics.activeCount).toBe(1)
      expect(metrics.successRate).toBe(66.67)
    })

    it('should handle no executed workflows', () => {
      const metrics = logger.getMetrics()
      
      expect(metrics.totalExecuted).toBe(0)
      expect(metrics.successRate).toBe(0)
      expect(metrics.averageExecutionTime).toBe(0)
    })
  })

  describe('getWorkflowStatus', () => {
    it('should return workflow status', () => {
      const workflowId = logger.startWorkflow({ test: 'data' })
      logger.logPhase(workflowId, WorkflowPhase.EXECUTION)
      
      const status = logger.getWorkflowStatus(workflowId)

      expect(status).toMatchObject({
        id: workflowId,
        phase: WorkflowPhase.EXECUTION,
        metadata: { test: 'data' },
        eventCount: 1
      })
    })

    it('should return null for invalid workflow', () => {
      const status = logger.getWorkflowStatus('invalid-id')
      expect(status).toBeNull()
    })
  })

  describe('cleanup', () => {
    it('should clean up completed workflows older than retention period', () => {
      // Create workflows with different ages
      const oldId = logger.startWorkflow({})
      const workflow = logger['activeWorkflows'].get(oldId)
      if (workflow) {
        workflow.endTime = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
        workflow.phase = WorkflowPhase.COMPLETION
      }

      const recentId = logger.startWorkflow({})
      logger.endWorkflow(recentId, 'success')

      const activeId = logger.startWorkflow({}) // Still active

      // Run cleanup
      logger['cleanupOldWorkflows']()

      expect(logger['activeWorkflows'].has(oldId)).toBe(false)
      expect(logger['activeWorkflows'].has(recentId)).toBe(true)
      expect(logger['activeWorkflows'].has(activeId)).toBe(true)
    })

    it('should not clean up active workflows', () => {
      const activeId = logger.startWorkflow({})
      
      // Try to cleanup immediately
      logger['cleanupOldWorkflows']()

      expect(logger['activeWorkflows'].has(activeId)).toBe(true)
    })
  })

  describe('structured logging', () => {
    it('should log with correct format', () => {
      const workflowId = logger.startWorkflow({ campaignId: 'camp-123' })
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[test-workflow]'),
        expect.stringContaining('INITIALIZATION'),
        expect.stringContaining('Started'),
        expect.objectContaining({
          workflowId,
          metadata: { campaignId: 'camp-123' }
        })
      )
    })

    it('should use appropriate log levels', () => {
      const workflowId = logger.startWorkflow({})
      
      // Info level for normal operations
      logger.logEvent(workflowId, 'test', {})
      expect(console.log).toHaveBeenCalled()

      // Error level for errors
      logger.logError(workflowId, new Error('Test'), {})
      expect(console.error).toHaveBeenCalled()
    })
  })
})