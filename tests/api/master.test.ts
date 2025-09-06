import { GET as masterAnalyticsGet } from '@/app/api/master/analytics/route'
import { GET as masterBillingGet } from '@/app/api/master/billing/route'
import { GET as masterOrganizationsGet } from '@/app/api/master/organizations/route'
import { GET as masterUsersGet } from '@/app/api/master/users/route'
import { GET as masterSettingsGet, PUT as masterSettingsPut } from '@/app/api/master/settings/route'
import { createTestUser, createTestSession, createTestCampaign, createAuthenticatedRequest, cleanupTestData, assertApiResponse, assertErrorResponse } from '../helpers/test-utils'

describe('/api/master', () => {
  let masterUser: any
  let regularUser: any
  let masterSessionToken: string
  let regularSessionToken: string
  let organizationId: string

  beforeEach(async () => {
    masterUser = await createTestUser({
      email: 'master-test@example.com',
      role: 'master'
    })
    
    regularUser = await createTestUser({
      email: 'regular-test@example.com',
      role: 'admin'
    })
    
    organizationId = regularUser.organizationId
    masterSessionToken = await createTestSession(masterUser.id)
    regularSessionToken = await createTestSession(regularUser.id)
    
    // Create test campaign for analytics
    await createTestCampaign({
      organizationId,
      name: 'Master Test Campaign'
    })
  })

  afterEach(async () => {
    if (masterUser.organizationId) {
      await cleanupTestData(masterUser.organizationId)
    }
    if (organizationId) {
      await cleanupTestData(organizationId)
    }
  })

  describe('GET /api/master/analytics', () => {
    it('should return master analytics data (master only)', async () => {
      const request = createAuthenticatedRequest('/api/master/analytics', 'GET', null, masterSessionToken)

      const response = await masterAnalyticsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['totalUsers', 'totalOrganizations', 'totalCampaigns', 'totalRevenue', 'metrics', 'timestamp'])
      expect(typeof data.totalUsers).toBe('number')
      expect(typeof data.totalOrganizations).toBe('number')
      expect(typeof data.totalCampaigns).toBe('number')
      expect(Array.isArray(data.metrics)).toBe(true)
    })

    it('should reject non-master users', async () => {
      const request = createAuthenticatedRequest('/api/master/analytics', 'GET', null, regularSessionToken)

      const response = await masterAnalyticsGet(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      assertErrorResponse(data, 403)
    })

    it('should handle date range parameters', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const endDate = new Date().toISOString()
      
      const request = createAuthenticatedRequest(
        `/api/master/analytics?startDate=${startDate}&endDate=${endDate}`, 
        'GET', 
        null, 
        masterSessionToken
      )

      const response = await masterAnalyticsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/master/billing', () => {
    it('should return master billing data (master only)', async () => {
      const request = createAuthenticatedRequest('/api/master/billing', 'GET', null, masterSessionToken)

      const response = await masterBillingGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['totalRevenue', 'monthlyRevenue', 'billingMetrics', 'organizations', 'timestamp'])
      expect(typeof data.totalRevenue).toBe('number')
      expect(typeof data.monthlyRevenue).toBe('number')
      expect(Array.isArray(data.organizations)).toBe(true)
    })

    it('should reject non-master users', async () => {
      const request = createAuthenticatedRequest('/api/master/billing', 'GET', null, regularSessionToken)

      const response = await masterBillingGet(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      assertErrorResponse(data, 403)
    })

    it('should handle billing period parameters', async () => {
      const request = createAuthenticatedRequest('/api/master/billing?period=2025-01', 'GET', null, masterSessionToken)

      const response = await masterBillingGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/master/organizations', () => {
    it('should return all organizations (master only)', async () => {
      const request = createAuthenticatedRequest('/api/master/organizations', 'GET', null, masterSessionToken)

      const response = await masterOrganizationsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['organizations', 'total', 'timestamp'])
      expect(Array.isArray(data.organizations)).toBe(true)
      expect(data.organizations.length).toBeGreaterThan(0)
      
      const org = data.organizations[0]
      assertApiResponse(org, ['id', 'name', 'email', 'plan', 'status', 'userCount', 'campaignCount'])
    })

    it('should reject non-master users', async () => {
      const request = createAuthenticatedRequest('/api/master/organizations', 'GET', null, regularSessionToken)

      const response = await masterOrganizationsGet(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      assertErrorResponse(data, 403)
    })

    it('should handle pagination parameters', async () => {
      const request = createAuthenticatedRequest('/api/master/organizations?limit=10&offset=0', 'GET', null, masterSessionToken)

      const response = await masterOrganizationsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.organizations.length).toBeLessThanOrEqual(10)
    })

    it('should handle search parameters', async () => {
      const request = createAuthenticatedRequest('/api/master/organizations?search=test', 'GET', null, masterSessionToken)

      const response = await masterOrganizationsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })

    it('should handle status filter', async () => {
      const request = createAuthenticatedRequest('/api/master/organizations?status=active', 'GET', null, masterSessionToken)

      const response = await masterOrganizationsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/master/users', () => {
    it('should return all users across organizations (master only)', async () => {
      const request = createAuthenticatedRequest('/api/master/users', 'GET', null, masterSessionToken)

      const response = await masterUsersGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['users', 'total', 'timestamp'])
      expect(Array.isArray(data.users)).toBe(true)
      expect(data.users.length).toBeGreaterThan(0)
      
      const user = data.users[0]
      assertApiResponse(user, ['id', 'name', 'email', 'role', 'isActive', 'organizationName'])
    })

    it('should reject non-master users', async () => {
      const request = createAuthenticatedRequest('/api/master/users', 'GET', null, regularSessionToken)

      const response = await masterUsersGet(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      assertErrorResponse(data, 403)
    })

    it('should handle role filter', async () => {
      const request = createAuthenticatedRequest('/api/master/users?role=admin', 'GET', null, masterSessionToken)

      const response = await masterUsersGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.users.every((u: any) => u.role === 'admin')).toBe(true)
    })

    it('should handle active filter', async () => {
      const request = createAuthenticatedRequest('/api/master/users?active=true', 'GET', null, masterSessionToken)

      const response = await masterUsersGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.users.every((u: any) => u.isActive === true)).toBe(true)
    })

    it('should handle organization filter', async () => {
      const request = createAuthenticatedRequest(`/api/master/users?organizationId=${organizationId}`, 'GET', null, masterSessionToken)

      const response = await masterUsersGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/master/settings', () => {
    it('should return master settings (master only)', async () => {
      const request = createAuthenticatedRequest('/api/master/settings', 'GET', null, masterSessionToken)

      const response = await masterSettingsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['settings', 'timestamp'])
      expect(data.settings).toHaveProperty('platform')
      expect(data.settings).toHaveProperty('features')
      expect(data.settings).toHaveProperty('limits')
    })

    it('should reject non-master users', async () => {
      const request = createAuthenticatedRequest('/api/master/settings', 'GET', null, regularSessionToken)

      const response = await masterSettingsGet(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      assertErrorResponse(data, 403)
    })
  })

  describe('PUT /api/master/settings', () => {
    it('should update master settings (master only)', async () => {
      const settingsUpdate = {
        platform: {
          name: 'PodcastFlow Pro - Updated',
          maintenanceMode: false
        },
        features: {
          realTimeAnalytics: true,
          advancedReporting: true
        },
        limits: {
          maxCampaignsPerOrg: 100,
          maxUsersPerOrg: 50
        }
      }

      const request = createAuthenticatedRequest('/api/master/settings', 'PUT', settingsUpdate, masterSessionToken)

      const response = await masterSettingsPut(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['success', 'settings', 'timestamp'])
      expect(data.settings.platform.name).toBe(settingsUpdate.platform.name)
      expect(data.settings.features.realTimeAnalytics).toBe(true)
    })

    it('should reject non-master users', async () => {
      const settingsUpdate = {
        platform: { name: 'Unauthorized Update' }
      }

      const request = createAuthenticatedRequest('/api/master/settings', 'PUT', settingsUpdate, regularSessionToken)

      const response = await masterSettingsPut(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      assertErrorResponse(data, 403)
    })

    it('should handle partial settings updates', async () => {
      const partialUpdate = {
        features: {
          realTimeAnalytics: false
        }
      }

      const request = createAuthenticatedRequest('/api/master/settings', 'PUT', partialUpdate, masterSessionToken)

      const response = await masterSettingsPut(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings.features.realTimeAnalytics).toBe(false)
    })

    it('should validate settings structure', async () => {
      const invalidUpdate = {
        invalidSection: {
          invalidProperty: 'value'
        }
      }

      const request = createAuthenticatedRequest('/api/master/settings', 'PUT', invalidUpdate, masterSessionToken)

      const response = await masterSettingsPut(request)
      // Should still work but ignore invalid sections
      expect(response.status).toBe(200)
    })
  })

  describe('Master endpoint authentication', () => {
    it('should reject unauthenticated requests to all master endpoints', async () => {
      const endpoints = [
        '/api/master/analytics',
        '/api/master/billing', 
        '/api/master/organizations',
        '/api/master/users',
        '/api/master/settings'
      ]

      for (const endpoint of endpoints) {
        const request = createAuthenticatedRequest(endpoint, 'GET')
        
        let response
        switch (endpoint) {
          case '/api/master/analytics':
            response = await masterAnalyticsGet(request)
            break
          case '/api/master/billing':
            response = await masterBillingGet(request)
            break
          case '/api/master/organizations':
            response = await masterOrganizationsGet(request)
            break
          case '/api/master/users':
            response = await masterUsersGet(request)
            break
          case '/api/master/settings':
            response = await masterSettingsGet(request)
            break
          default:
            continue
        }

        expect(response.status).toBe(401)
        const data = await response.json()
        assertErrorResponse(data, 401)
      }
    })

    it('should reject users with insufficient role', async () => {
      const roles = ['client', 'talent', 'producer', 'sales', 'admin']
      
      for (const role of roles) {
        const testUser = await createTestUser({
          email: `${role}-test@example.com`,
          role
        })
        const testSessionToken = await createTestSession(testUser.id)

        const request = createAuthenticatedRequest('/api/master/analytics', 'GET', null, testSessionToken)
        const response = await masterAnalyticsGet(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        assertErrorResponse(data, 403)

        await cleanupTestData(testUser.organizationId)
      }
    })
  })
})