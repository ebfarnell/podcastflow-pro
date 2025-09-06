import { POST as realTimePost, GET as realTimeGet } from '@/app/api/analytics/real-time/route'
import { GET as campaignRealTimeGet, POST as campaignRealTimePost } from '@/app/api/campaigns/[id]/analytics/real-time/route'
import { GET as dashboardGet } from '@/app/api/analytics/real-time/dashboard/route'
import { POST as subscribePost, DELETE as subscribeDelete } from '@/app/api/analytics/real-time/subscribe/route'
import { POST as simulatePost, GET as simulateGet } from '@/app/api/analytics/real-time/simulate/route'
import { createTestUser, createTestSession, createTestCampaign, createAuthenticatedRequest, cleanupTestData, assertApiResponse, assertErrorResponse, wait } from '../helpers/test-utils'

describe('/api/analytics/real-time', () => {
  let testUser: any
  let sessionToken: string
  let organizationId: string
  let testCampaign: any

  beforeEach(async () => {
    testUser = await createTestUser({
      email: 'realtime-test@example.com',
      role: 'admin'
    })
    organizationId = testUser.organizationId
    sessionToken = await createTestSession(testUser.id)
    
    testCampaign = await createTestCampaign({
      organizationId,
      name: 'Real-time Analytics Test Campaign'
    })
  })

  afterEach(async () => {
    if (organizationId) {
      await cleanupTestData(organizationId)
    }
  })

  describe('POST /api/analytics/real-time', () => {
    it('should ingest single analytics event', async () => {
      const event = {
        event: {
          eventType: 'impression',
          campaignId: testCampaign.id,
          organizationId: organizationId,
          metadata: {
            sessionId: 'test-session-123',
            deviceType: 'mobile',
            location: 'New York, NY'
          }
        }
      }

      const request = createAuthenticatedRequest('/api/analytics/real-time', 'POST', event, sessionToken)

      const response = await realTimePost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'message', 'timestamp'])
      expect(data.success).toBe(true)
      expect(data.message).toContain('Event ingested successfully')
    })

    it('should ingest batch analytics events', async () => {
      const events = {
        events: [
          {
            eventType: 'impression',
            campaignId: testCampaign.id,
            organizationId: organizationId
          },
          {
            eventType: 'click',
            campaignId: testCampaign.id,
            organizationId: organizationId,
            value: 1.50
          },
          {
            eventType: 'conversion',
            campaignId: testCampaign.id,
            organizationId: organizationId,
            value: 25.00
          }
        ]
      }

      const request = createAuthenticatedRequest('/api/analytics/real-time', 'POST', events, sessionToken)

      const response = await realTimePost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'message', 'count', 'timestamp'])
      expect(data.success).toBe(true)
      expect(data.count).toBe(3)
    })

    it('should reject invalid event data', async () => {
      const invalidEvent = {
        event: {
          eventType: 'invalid-type',
          // Missing required fields
        }
      }

      const request = createAuthenticatedRequest('/api/analytics/real-time', 'POST', invalidEvent, sessionToken)

      const response = await realTimePost(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      assertErrorResponse(data)
    })

    it('should reject missing event data', async () => {
      const emptyData = {}

      const request = createAuthenticatedRequest('/api/analytics/real-time', 'POST', emptyData, sessionToken)

      const response = await realTimePost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
      expect(data.error).toContain('event')
    })
  })

  describe('GET /api/analytics/real-time', () => {
    it('should return pipeline status', async () => {
      const request = createAuthenticatedRequest('/api/analytics/real-time', 'GET', null, sessionToken)

      const response = await realTimeGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['status', 'timestamp'])
      expect(data.status).toHaveProperty('bufferSize')
      expect(data.status).toHaveProperty('isProcessing')
    })

    it('should return campaign metrics when campaignId provided', async () => {
      const request = createAuthenticatedRequest(
        `/api/analytics/real-time?campaignId=${testCampaign.id}&timeWindow=3600`, 
        'GET', 
        null, 
        sessionToken
      )

      const response = await realTimeGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['status', 'metrics', 'timeWindow', 'timestamp'])
      // metrics may be null if no recent data
    })

    it('should return organization metrics when organizationId provided', async () => {
      const request = createAuthenticatedRequest(
        `/api/analytics/real-time?organizationId=${organizationId}&timeWindow=3600`, 
        'GET', 
        null, 
        sessionToken
      )

      const response = await realTimeGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['status', 'organizationMetrics', 'timeWindow', 'timestamp'])
      expect(Array.isArray(data.organizationMetrics)).toBe(true)
    })
  })

  describe('GET /api/campaigns/[id]/analytics/real-time', () => {
    it('should return campaign real-time metrics', async () => {
      const request = createAuthenticatedRequest(
        `/api/campaigns/${testCampaign.id}/analytics/real-time?timeWindow=3600`, 
        'GET', 
        null, 
        sessionToken
      )

      const response = await campaignRealTimeGet(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'metrics', 'timeWindow', 'timestamp'])
      // metrics may be null if no recent analytics data
    })

    it('should handle different time windows', async () => {
      const request = createAuthenticatedRequest(
        `/api/campaigns/${testCampaign.id}/analytics/real-time?timeWindow=7200`, // 2 hours
        'GET', 
        null, 
        sessionToken
      )

      const response = await campaignRealTimeGet(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.timeWindow).toBe(7200)
    })
  })

  describe('POST /api/campaigns/[id]/analytics/real-time', () => {
    it('should ingest campaign-specific analytics event', async () => {
      const eventData = {
        eventType: 'click',
        metadata: {
          sessionId: 'campaign-session-456',
          deviceType: 'desktop',
          userAgent: 'Mozilla/5.0...'
        },
        value: 2.25
      }

      const request = createAuthenticatedRequest(
        `/api/campaigns/${testCampaign.id}/analytics/real-time`, 
        'POST', 
        eventData, 
        sessionToken
      )

      const response = await campaignRealTimePost(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'message', 'campaignId', 'eventType', 'timestamp'])
      expect(data.campaignId).toBe(testCampaign.id)
      expect(data.eventType).toBe('click')
    })

    it('should reject events for inactive campaigns', async () => {
      // Set campaign to inactive
      const prisma = require('@/lib/db/prisma').default
      await prisma.campaign.update({
        where: { id: testCampaign.id },
        data: { status: 'paused' }
      })

      const eventData = {
        eventType: 'impression'
      }

      const request = createAuthenticatedRequest(
        `/api/campaigns/${testCampaign.id}/analytics/real-time`, 
        'POST', 
        eventData, 
        sessionToken
      )

      const response = await campaignRealTimePost(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
      expect(data.error).toContain('not active')
    })

    it('should reject events for non-existent campaigns', async () => {
      const fakeId = 'non-existent-campaign'
      const eventData = {
        eventType: 'impression'
      }

      const request = createAuthenticatedRequest(
        `/api/campaigns/${fakeId}/analytics/real-time`, 
        'POST', 
        eventData, 
        sessionToken
      )

      const response = await campaignRealTimePost(request, { params: { id: fakeId } })
      const data = await response.json()

      expect(response.status).toBe(404)
      assertErrorResponse(data, 404)
    })
  })

  describe('GET /api/analytics/real-time/dashboard', () => {
    it('should return real-time dashboard metrics', async () => {
      const request = createAuthenticatedRequest(
        `/api/analytics/real-time/dashboard?organizationId=${organizationId}&timeWindow=3600`, 
        'GET', 
        null, 
        sessionToken
      )

      const response = await dashboardGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'organizationId', 'timeWindow', 'summary', 'topCampaigns', 'trendData', 'timestamp'])
      expect(data.organizationId).toBe(organizationId)
      expect(Array.isArray(data.topCampaigns)).toBe(true)
      expect(Array.isArray(data.trendData)).toBe(true)
    })

    it('should require organizationId parameter', async () => {
      const request = createAuthenticatedRequest('/api/analytics/real-time/dashboard', 'GET', null, sessionToken)

      const response = await dashboardGet(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
      expect(data.error).toContain('organizationId')
    })
  })

  describe('POST /api/analytics/real-time/subscribe', () => {
    it('should create analytics subscription', async () => {
      const subscriptionData = {
        organizationId: organizationId,
        campaignIds: [testCampaign.id]
      }

      const request = createAuthenticatedRequest('/api/analytics/real-time/subscribe', 'POST', subscriptionData, sessionToken)

      const response = await subscribePost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'subscription', 'timestamp'])
      expect(data.subscription.organizationId).toBe(organizationId)
      expect(data.subscription.campaignIds).toContain(testCampaign.id)
    })

    it('should create subscription for all campaigns', async () => {
      const subscriptionData = {
        organizationId: organizationId
        // No campaignIds = all campaigns
      }

      const request = createAuthenticatedRequest('/api/analytics/real-time/subscribe', 'POST', subscriptionData, sessionToken)

      const response = await subscribePost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.subscription.organizationId).toBe(organizationId)
    })

    it('should reject missing organizationId', async () => {
      const invalidData = {
        campaignIds: [testCampaign.id]
        // Missing organizationId
      }

      const request = createAuthenticatedRequest('/api/analytics/real-time/subscribe', 'POST', invalidData, sessionToken)

      const response = await subscribePost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })
  })

  describe('POST /api/analytics/real-time/simulate', () => {
    it('should start analytics simulation', async () => {
      const simulationData = {
        action: 'start',
        campaignIds: [testCampaign.id],
        organizationId: organizationId,
        options: {
          eventsPerMinute: 30,
          duration: 1, // 1 minute
          impressionRate: 0.6,
          clickRate: 0.3,
          conversionRate: 0.1
        }
      }

      const request = createAuthenticatedRequest('/api/analytics/real-time/simulate', 'POST', simulationData, sessionToken)

      const response = await simulatePost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'message', 'campaignIds', 'options', 'timestamp'])
      expect(data.success).toBe(true)

      // Wait a moment then stop simulation
      await wait(2000)
      
      const stopRequest = createAuthenticatedRequest('/api/analytics/real-time/simulate', 'POST', { action: 'stop' }, sessionToken)
      await simulatePost(stopRequest)
    })

    it('should generate event burst', async () => {
      const burstData = {
        action: 'burst',
        campaignIds: [testCampaign.id],
        organizationId: organizationId,
        options: {
          count: 50
        }
      }

      const request = createAuthenticatedRequest('/api/analytics/real-time/simulate', 'POST', burstData, sessionToken)

      const response = await simulatePost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.count).toBe(50)
    })

    it('should simulate user journey', async () => {
      const journeyData = {
        action: 'journey',
        campaignIds: [testCampaign.id],
        organizationId: organizationId
      }

      const request = createAuthenticatedRequest('/api/analytics/real-time/simulate', 'POST', journeyData, sessionToken)

      const response = await simulatePost(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toContain('user journeys')
    })

    it('should reject invalid action', async () => {
      const invalidData = {
        action: 'invalid-action',
        campaignIds: [testCampaign.id],
        organizationId: organizationId
      }

      const request = createAuthenticatedRequest('/api/analytics/real-time/simulate', 'POST', invalidData, sessionToken)

      const response = await simulatePost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })
  })

  describe('GET /api/analytics/real-time/simulate', () => {
    it('should return simulation status', async () => {
      const request = createAuthenticatedRequest('/api/analytics/real-time/simulate', 'GET', null, sessionToken)

      const response = await simulateGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'status', 'timestamp'])
      expect(data.status).toHaveProperty('isRunning')
      expect(data.status).toHaveProperty('intervalId')
    })
  })
})