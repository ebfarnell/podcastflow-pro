import { GET as campaignsGet, POST as campaignsPost } from '@/app/api/campaigns/route'
import { GET as campaignGet, PUT as campaignPut, DELETE as campaignDelete } from '@/app/api/campaigns/[id]/route'
import { GET as analyticsGet, POST as analyticsPost } from '@/app/api/campaigns/[id]/analytics/route'
import { createTestUser, createTestSession, createTestCampaign, createAuthenticatedRequest, cleanupTestData, assertApiResponse, assertErrorResponse } from '../helpers/test-utils'

describe('/api/campaigns', () => {
  let testUser: any
  let sessionToken: string
  let organizationId: string
  let testCampaign: any

  beforeEach(async () => {
    testUser = await createTestUser({
      email: 'campaigns-test@example.com',
      role: 'admin'
    })
    organizationId = testUser.organizationId
    sessionToken = await createTestSession(testUser.id)
    
    testCampaign = await createTestCampaign({
      organizationId,
      name: 'Test Campaign for API'
    })
  })

  afterEach(async () => {
    if (organizationId) {
      await cleanupTestData(organizationId)
    }
  })

  describe('GET /api/campaigns', () => {
    it('should return campaigns for authenticated user', async () => {
      const request = createAuthenticatedRequest('/api/campaigns', 'GET', null, sessionToken)

      const response = await campaignsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['campaigns', 'total', 'timestamp'])
      expect(Array.isArray(data.campaigns)).toBe(true)
      expect(data.campaigns.length).toBeGreaterThan(0)
      
      const campaign = data.campaigns[0]
      assertApiResponse(campaign, ['id', 'name', 'status', 'budget', 'organizationId'])
    })

    it('should return empty array for organization with no campaigns', async () => {
      // Create new user with different organization
      const newUser = await createTestUser({
        email: 'nocampaigns@example.com'
      })
      const newSessionToken = await createTestSession(newUser.id)

      const request = createAuthenticatedRequest('/api/campaigns', 'GET', null, newSessionToken)

      const response = await campaignsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.campaigns).toEqual([])
      expect(data.total).toBe(0)

      await cleanupTestData(newUser.organizationId)
    })

    it('should reject unauthenticated requests', async () => {
      const request = createAuthenticatedRequest('/api/campaigns', 'GET')

      const response = await campaignsGet(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      assertErrorResponse(data, 401)
    })

    it('should handle pagination parameters', async () => {
      const request = createAuthenticatedRequest('/api/campaigns?limit=5&offset=0', 'GET', null, sessionToken)

      const response = await campaignsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.campaigns.length).toBeLessThanOrEqual(5)
    })

    it('should handle search parameters', async () => {
      const request = createAuthenticatedRequest(`/api/campaigns?search=${testCampaign.name}`, 'GET', null, sessionToken)

      const response = await campaignsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.campaigns.some((c: any) => c.name.includes(testCampaign.name))).toBe(true)
    })
  })

  describe('POST /api/campaigns', () => {
    it('should create new campaign', async () => {
      const newCampaign = {
        name: 'New Test Campaign',
        advertiserId: testCampaign.advertiserId,
        budget: 10000,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Test campaign description'
      }

      const request = createAuthenticatedRequest('/api/campaigns', 'POST', newCampaign, sessionToken)

      const response = await campaignsPost(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      assertApiResponse(data, ['success', 'campaign'])
      expect(data.campaign.name).toBe(newCampaign.name)
      expect(data.campaign.budget).toBe(newCampaign.budget)
      expect(data.campaign.organizationId).toBe(organizationId)
    })

    it('should reject invalid campaign data', async () => {
      const invalidCampaign = {
        name: '', // Empty name
        budget: -1000 // Negative budget
      }

      const request = createAuthenticatedRequest('/api/campaigns', 'POST', invalidCampaign, sessionToken)

      const response = await campaignsPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })

    it('should reject missing required fields', async () => {
      const incompleteCampaign = {
        budget: 5000
        // Missing name and other required fields
      }

      const request = createAuthenticatedRequest('/api/campaigns', 'POST', incompleteCampaign, sessionToken)

      const response = await campaignsPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })
  })

  describe('GET /api/campaigns/[id]', () => {
    it('should return specific campaign', async () => {
      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}`, 'GET', null, sessionToken)

      const response = await campaignGet(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['campaign'])
      expect(data.campaign.id).toBe(testCampaign.id)
      expect(data.campaign.name).toBe(testCampaign.name)
    })

    it('should return 404 for non-existent campaign', async () => {
      const fakeId = 'non-existent-id'
      const request = createAuthenticatedRequest(`/api/campaigns/${fakeId}`, 'GET', null, sessionToken)

      const response = await campaignGet(request, { params: { id: fakeId } })
      const data = await response.json()

      expect(response.status).toBe(404)
      assertErrorResponse(data, 404)
    })

    it('should reject access to other organization campaigns', async () => {
      // Create different organization user
      const otherUser = await createTestUser({ email: 'other@example.com' })
      const otherSessionToken = await createTestSession(otherUser.id)

      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}`, 'GET', null, otherSessionToken)

      const response = await campaignGet(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(404)
      assertErrorResponse(data, 404)

      await cleanupTestData(otherUser.organizationId)
    })
  })

  describe('PUT /api/campaigns/[id]', () => {
    it('should update campaign', async () => {
      const updates = {
        name: 'Updated Campaign Name',
        budget: 15000,
        description: 'Updated description'
      }

      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}`, 'PUT', updates, sessionToken)

      const response = await campaignPut(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'campaign'])
      expect(data.campaign.name).toBe(updates.name)
      expect(data.campaign.budget).toBe(updates.budget)
    })

    it('should reject invalid updates', async () => {
      const invalidUpdates = {
        budget: -5000, // Negative budget
        status: 'invalid-status'
      }

      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}`, 'PUT', invalidUpdates, sessionToken)

      const response = await campaignPut(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })
  })

  describe('DELETE /api/campaigns/[id]', () => {
    it('should delete campaign', async () => {
      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}`, 'DELETE', null, sessionToken)

      const response = await campaignDelete(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'message'])

      // Verify campaign is deleted
      const verifyRequest = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}`, 'GET', null, sessionToken)
      const verifyResponse = await campaignGet(verifyRequest, { params: { id: testCampaign.id } })
      
      expect(verifyResponse.status).toBe(404)
    })

    it('should return 404 for non-existent campaign', async () => {
      const fakeId = 'non-existent-id'
      const request = createAuthenticatedRequest(`/api/campaigns/${fakeId}`, 'DELETE', null, sessionToken)

      const response = await campaignDelete(request, { params: { id: fakeId } })
      const data = await response.json()

      expect(response.status).toBe(404)
      assertErrorResponse(data, 404)
    })
  })

  describe('GET /api/campaigns/[id]/analytics', () => {
    it('should return campaign analytics', async () => {
      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}/analytics`, 'GET', null, sessionToken)

      const response = await analyticsGet(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['analytics', 'summary', 'daily'])
      expect(Array.isArray(data.daily)).toBe(true)
    })

    it('should handle date range parameters', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const endDate = new Date().toISOString()
      
      const request = createAuthenticatedRequest(
        `/api/campaigns/${testCampaign.id}/analytics?startDate=${startDate}&endDate=${endDate}`, 
        'GET', 
        null, 
        sessionToken
      )

      const response = await analyticsGet(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['analytics', 'summary', 'daily'])
    })
  })

  describe('POST /api/campaigns/[id]/analytics', () => {
    it('should record campaign analytics', async () => {
      const analyticsData = {
        date: new Date().toISOString(),
        impressions: 1000,
        clicks: 50,
        conversions: 5,
        spent: 100
      }

      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}/analytics`, 'POST', analyticsData, sessionToken)

      const response = await analyticsPost(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(201)
      assertApiResponse(data, ['success', 'analytics'])
      expect(data.analytics.impressions).toBe(analyticsData.impressions)
      expect(data.analytics.clicks).toBe(analyticsData.clicks)
    })

    it('should reject invalid analytics data', async () => {
      const invalidData = {
        impressions: -100, // Negative impressions
        clicks: 'invalid' // Non-numeric clicks
      }

      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}/analytics`, 'POST', invalidData, sessionToken)

      const response = await analyticsPost(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })
  })
})