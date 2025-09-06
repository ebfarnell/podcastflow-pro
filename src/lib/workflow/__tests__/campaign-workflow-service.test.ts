import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { CampaignWorkflowService } from '../campaign-workflow-service'
import { querySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

// Mock dependencies
jest.mock('@/lib/db/schema-db')
jest.mock('uuid')
jest.mock('../workflow-logger')

const mockQuerySchema = querySchema as jest.MockedFunction<typeof querySchema>
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>

describe('CampaignWorkflowService', () => {
  let service: CampaignWorkflowService
  const testOrgSlug = 'org_podcastflow_pro'
  const testUserId = 'user-123'
  const testCampaignId = 'campaign-456'

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CampaignWorkflowService()
    
    // Default mock implementations
    mockUuidv4.mockReturnValue('mock-uuid-123')
    mockQuerySchema.mockResolvedValue([])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('handleProbabilityChange', () => {
    const mockCampaign = {
      id: testCampaignId,
      name: 'Test Campaign',
      probability: 90,
      reservationId: null,
      approvalRequestId: null,
      budget: 10000,
      advertiserId: 'adv-123',
      agencyId: 'agency-456',
      organizationId: 'org-123'
    }

    it('should trigger 90% workflow when probability reaches 90', async () => {
      mockQuerySchema
        .mockResolvedValueOnce([mockCampaign]) // getCampaign
        .mockResolvedValueOnce([]) // checkExistingApproval
        .mockResolvedValueOnce([{ id: 'approval-123' }]) // createApprovalRequest
        .mockResolvedValueOnce([]) // updateCampaignApproval

      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        65, // oldProbability
        90, // newProbability
        testUserId
      )

      expect(result.triggered).toBe(true)
      expect(result.approvalRequestId).toBe('approval-123')
      expect(mockQuerySchema).toHaveBeenCalledTimes(4)
    })

    it('should not trigger workflow if probability is below 90', async () => {
      const campaign = { ...mockCampaign, probability: 75 }
      mockQuerySchema.mockResolvedValueOnce([campaign])

      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        75,
        testUserId
      )

      expect(result.triggered).toBe(false)
      expect(mockQuerySchema).toHaveBeenCalledTimes(1)
    })

    it('should not trigger if already has approval request', async () => {
      const campaign = { 
        ...mockCampaign, 
        approvalRequestId: 'existing-approval'
      }
      mockQuerySchema.mockResolvedValueOnce([campaign])

      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        85,
        90,
        testUserId
      )

      expect(result.triggered).toBe(false)
      expect(result.reason).toContain('already has approval')
    })

    it('should handle campaign not found', async () => {
      mockQuerySchema.mockResolvedValueOnce([]) // No campaign found

      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        90,
        testUserId
      )

      expect(result.triggered).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should handle errors gracefully', async () => {
      mockQuerySchema.mockRejectedValueOnce(new Error('Database error'))

      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        90,
        testUserId
      )

      expect(result.triggered).toBe(false)
      expect(result.error).toContain('Database error')
    })
  })

  describe('createInventoryReservation', () => {
    const mockShow = {
      id: 'show-123',
      name: 'Test Show',
      defaultRate: 1000
    }

    const mockEpisodes = [
      { id: 'ep-1', showId: 'show-123', airDate: '2025-02-01' },
      { id: 'ep-2', showId: 'show-123', airDate: '2025-02-08' }
    ]

    it('should create inventory reservations for campaign', async () => {
      mockQuerySchema
        .mockResolvedValueOnce([mockShow]) // getShow
        .mockResolvedValueOnce(mockEpisodes) // getEpisodes
        .mockResolvedValueOnce([{ id: 'schedule-123' }]) // createSchedule
        .mockResolvedValueOnce([]) // createReservations

      const result = await service['createInventoryReservation'](
        testOrgSlug,
        testCampaignId,
        10000, // budget
        testUserId
      )

      expect(result.success).toBe(true)
      expect(result.scheduleId).toBe('schedule-123')
      expect(result.reservedSpots).toBe(2)
      expect(mockQuerySchema).toHaveBeenCalledTimes(4)
    })

    it('should handle no available shows', async () => {
      mockQuerySchema.mockResolvedValueOnce([]) // No shows

      const result = await service['createInventoryReservation'](
        testOrgSlug,
        testCampaignId,
        10000,
        testUserId
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('No shows available')
    })

    it('should handle no available episodes', async () => {
      mockQuerySchema
        .mockResolvedValueOnce([mockShow])
        .mockResolvedValueOnce([]) // No episodes

      const result = await service['createInventoryReservation'](
        testOrgSlug,
        testCampaignId,
        10000,
        testUserId
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('No episodes available')
    })
  })

  describe('processApproval', () => {
    const mockApproval = {
      id: 'approval-123',
      campaignId: testCampaignId,
      status: 'pending'
    }

    const mockCampaign = {
      id: testCampaignId,
      name: 'Test Campaign',
      advertiserId: 'adv-123',
      agencyId: 'agency-456',
      budget: 10000,
      organizationId: 'org-123'
    }

    it('should process campaign approval successfully', async () => {
      mockQuerySchema
        .mockResolvedValueOnce([mockApproval]) // getApproval
        .mockResolvedValueOnce([mockCampaign]) // getCampaign
        .mockResolvedValueOnce([]) // updateApproval
        .mockResolvedValueOnce([]) // updateCampaign
        .mockResolvedValueOnce([{ id: 'order-123' }]) // createOrder

      const result = await service.processApproval(
        testOrgSlug,
        'approval-123',
        'approve',
        testUserId,
        'Approved for production'
      )

      expect(result.success).toBe(true)
      expect(result.orderId).toBe('order-123')
      expect(mockQuerySchema).toHaveBeenCalledTimes(5)
    })

    it('should process campaign rejection successfully', async () => {
      mockQuerySchema
        .mockResolvedValueOnce([mockApproval])
        .mockResolvedValueOnce([mockCampaign])
        .mockResolvedValueOnce([]) // updateApproval
        .mockResolvedValueOnce([]) // updateCampaign
        .mockResolvedValueOnce([]) // releaseInventory

      const result = await service.processApproval(
        testOrgSlug,
        'approval-123',
        'reject',
        testUserId,
        'Budget constraints'
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('rejected')
      expect(mockQuerySchema).toHaveBeenCalledTimes(5)
    })

    it('should handle approval not found', async () => {
      mockQuerySchema.mockResolvedValueOnce([]) // No approval

      const result = await service.processApproval(
        testOrgSlug,
        'approval-123',
        'approve',
        testUserId
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should handle invalid action', async () => {
      const result = await service.processApproval(
        testOrgSlug,
        'approval-123',
        'invalid-action' as any,
        testUserId
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid action')
    })
  })

  describe('getWorkflowMetrics', () => {
    it('should return workflow metrics', () => {
      const metrics = service.getWorkflowMetrics()

      expect(metrics).toHaveProperty('totalExecuted')
      expect(metrics).toHaveProperty('successCount')
      expect(metrics).toHaveProperty('failureCount')
      expect(metrics).toHaveProperty('activeCount')
      expect(metrics).toHaveProperty('successRate')
      expect(metrics).toHaveProperty('averageExecutionTime')
    })
  })

  describe('checkWorkflowHealth', () => {
    it('should check workflow health status', async () => {
      mockQuerySchema
        .mockResolvedValueOnce([{ count: '5' }]) // pending approvals
        .mockResolvedValueOnce([{ count: '10' }]) // active reservations

      const health = await service.checkWorkflowHealth(testOrgSlug)

      expect(health.status).toBe('healthy')
      expect(health.pendingApprovals).toBe(5)
      expect(health.activeReservations).toBe(10)
      expect(health.metrics).toBeDefined()
    })

    it('should return degraded status for high pending approvals', async () => {
      mockQuerySchema
        .mockResolvedValueOnce([{ count: '15' }]) // high pending
        .mockResolvedValueOnce([{ count: '5' }])

      const health = await service.checkWorkflowHealth(testOrgSlug)

      expect(health.status).toBe('degraded')
      expect(health.pendingApprovals).toBe(15)
    })

    it('should handle errors and return unhealthy status', async () => {
      mockQuerySchema.mockRejectedValueOnce(new Error('Database error'))

      const health = await service.checkWorkflowHealth(testOrgSlug)

      expect(health.status).toBe('unhealthy')
      expect(health.error).toContain('Database error')
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle null campaign values', async () => {
      const campaignWithNulls = {
        id: testCampaignId,
        name: null,
        probability: 90,
        reservationId: null,
        approvalRequestId: null,
        budget: null,
        advertiserId: null,
        agencyId: null,
        organizationId: 'org-123'
      }

      mockQuerySchema.mockResolvedValueOnce([campaignWithNulls])

      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        90,
        testUserId
      )

      // Should still process but with defaults
      expect(result.triggered).toBeDefined()
    })

    it('should handle concurrent workflow triggers', async () => {
      const campaign = {
        id: testCampaignId,
        name: 'Test Campaign',
        probability: 90,
        reservationId: null,
        approvalRequestId: null
      }

      mockQuerySchema
        .mockResolvedValueOnce([campaign])
        .mockResolvedValueOnce([{ id: 'existing-approval' }]) // Already exists

      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        85,
        90,
        testUserId
      )

      expect(result.triggered).toBe(false)
      expect(result.reason).toContain('already exists')
    })

    it('should handle database transaction failures', async () => {
      mockQuerySchema
        .mockResolvedValueOnce([{ id: testCampaignId, probability: 90 }])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Transaction failed'))

      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        85,
        90,
        testUserId
      )

      expect(result.triggered).toBe(false)
      expect(result.error).toContain('Transaction failed')
    })
  })
})