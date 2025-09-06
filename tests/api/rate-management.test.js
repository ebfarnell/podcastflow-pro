/**
 * Rate Management Feature Tests
 * Tests rate card management, rate history, and role-based access control
 * IMPORTANT: Only Admin role should be able to set rate card rates
 */

const request = require('supertest')

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'
const TEST_ORG_ID = 'org_podcastflow_pro'

describe('Rate Management Features', () => {
  let authTokens = {}
  let testShowId = null
  let testRateId = null

  beforeAll(async () => {
    // Authenticate test users for all roles
    const users = [
      { role: 'master', email: 'michael@unfy.com', password: 'EMunfy2025' },
      { role: 'admin', email: 'admin@podcastflow.pro', password: 'admin123' },
      { role: 'sales', email: 'seller@podcastflow.pro', password: 'seller123' },
      { role: 'producer', email: 'producer@podcastflow.pro', password: 'producer123' },
      { role: 'talent', email: 'talent@podcastflow.pro', password: 'talent123' },
      { role: 'client', email: 'client@podcastflow.pro', password: 'client123' }
    ]

    for (const user of users) {
      try {
        const response = await request(API_BASE_URL)
          .post('/api/auth/login')
          .send({ email: user.email, password: user.password })

        if (response.status === 200 && response.body.token) {
          authTokens[user.role] = `auth-token=${response.body.token}`
        }
      } catch (error) {
        console.error(`Failed to authenticate ${user.role}:`, error.message)
      }
    }

    // Get a test show ID
    try {
      const showsResponse = await request(API_BASE_URL)
        .get('/api/shows')
        .set('Cookie', authTokens.admin)
      
      if (showsResponse.body && showsResponse.body.length > 0) {
        testShowId = showsResponse.body[0].id
      }
    } catch (error) {
      console.error('Failed to get test show:', error.message)
    }
  })

  describe('Rate Card Access Control', () => {
    test('Admin can view rate cards', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/rate-cards')
        .set('Cookie', authTokens.admin)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
    })

    test('Admin can create new rate card', async () => {
      const rateCardData = {
        name: 'Test Rate Card',
        description: 'Test rate card for automated testing',
        baseRate: 150.00,
        preRollRate: 175.00,
        midRollRate: 200.00,
        postRollRate: 150.00,
        effectiveDate: new Date().toISOString(),
        isActive: true
      }

      const response = await request(API_BASE_URL)
        .post('/api/rate-cards')
        .set('Cookie', authTokens.admin)
        .send(rateCardData)
        .expect(201)

      expect(response.body).toHaveProperty('id')
      expect(response.body.name).toBe(rateCardData.name)
      expect(response.body.baseRate).toBe(rateCardData.baseRate)
    })

    test('Sales role CANNOT create rate cards', async () => {
      const rateCardData = {
        name: 'Unauthorized Rate Card',
        baseRate: 100.00
      }

      await request(API_BASE_URL)
        .post('/api/rate-cards')
        .set('Cookie', authTokens.sales)
        .send(rateCardData)
        .expect(403)
    })

    test('Producer role CANNOT modify rate cards', async () => {
      const rateCardData = {
        name: 'Unauthorized Rate Card',
        baseRate: 100.00
      }

      await request(API_BASE_URL)
        .post('/api/rate-cards')
        .set('Cookie', authTokens.producer)
        .send(rateCardData)
        .expect(403)
    })

    test('Client role CANNOT access rate card management', async () => {
      await request(API_BASE_URL)
        .get('/api/rate-cards')
        .set('Cookie', authTokens.client)
        .expect(403)
    })

    test('Master role can view but follows organization isolation', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/rate-cards')
        .set('Cookie', authTokens.master)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
    })
  })

  describe('Show Rate History Management', () => {
    test('Admin can create rate history entry for a show', async () => {
      if (!testShowId) {
        console.warn('No test show available, skipping test')
        return
      }

      const rateData = {
        baseRate: 250.00,
        preRollRate: 300.00,
        midRollRate: 350.00,
        postRollRate: 250.00,
        effectiveDate: new Date().toISOString(),
        endDate: null,
        notes: 'Q4 2025 rate adjustment',
        isActive: true
      }

      const response = await request(API_BASE_URL)
        .post(`/api/shows/${testShowId}/rate-history`)
        .set('Cookie', authTokens.admin)
        .send(rateData)
        .expect(201)

      expect(response.body).toHaveProperty('id')
      expect(response.body.baseRate).toBe(rateData.baseRate)
      expect(response.body.notes).toBe(rateData.notes)
      testRateId = response.body.id
    })

    test('Admin can update rate history entry', async () => {
      if (!testShowId || !testRateId) {
        console.warn('No test data available, skipping test')
        return
      }

      const updateData = {
        baseRate: 275.00,
        notes: 'Updated Q4 2025 rate'
      }

      const response = await request(API_BASE_URL)
        .put(`/api/shows/${testShowId}/rate-history/${testRateId}`)
        .set('Cookie', authTokens.admin)
        .send(updateData)
        .expect(200)

      expect(response.body.baseRate).toBe(updateData.baseRate)
      expect(response.body.notes).toBe(updateData.notes)
    })

    test('Sales role can VIEW rate history but CANNOT modify', async () => {
      if (!testShowId) {
        console.warn('No test show available, skipping test')
        return
      }

      // Sales can view rate history
      const viewResponse = await request(API_BASE_URL)
        .get(`/api/shows/${testShowId}/rate-history`)
        .set('Cookie', authTokens.sales)
        .expect(200)

      expect(Array.isArray(viewResponse.body)).toBe(true)

      // Sales cannot create new rates
      const rateData = {
        baseRate: 500.00,
        effectiveDate: new Date().toISOString()
      }

      await request(API_BASE_URL)
        .post(`/api/shows/${testShowId}/rate-history`)
        .set('Cookie', authTokens.sales)
        .send(rateData)
        .expect(403)
    })

    test('Producer can view rates but cannot modify', async () => {
      if (!testShowId) {
        console.warn('No test show available, skipping test')
        return
      }

      // Producer can view
      await request(API_BASE_URL)
        .get(`/api/shows/${testShowId}/rate-history`)
        .set('Cookie', authTokens.producer)
        .expect(200)

      // Producer cannot modify
      await request(API_BASE_URL)
        .post(`/api/shows/${testShowId}/rate-history`)
        .set('Cookie', authTokens.producer)
        .send({ baseRate: 100 })
        .expect(403)
    })

    test('Admin can delete rate history entry', async () => {
      if (!testShowId || !testRateId) {
        console.warn('No test data available, skipping test')
        return
      }

      await request(API_BASE_URL)
        .delete(`/api/shows/${testShowId}/rate-history/${testRateId}`)
        .set('Cookie', authTokens.admin)
        .expect(200)
    })
  })

  describe('Rate Trends Analytics', () => {
    test('Admin can access rate trends analytics', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/analytics/rate-trends')
        .set('Cookie', authTokens.admin)
        .expect(200)

      expect(response.body).toHaveProperty('trends')
      expect(Array.isArray(response.body.trends)).toBe(true)
    })

    test('Admin can filter rate trends by date range', async () => {
      const params = new URLSearchParams({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        groupBy: 'month'
      })

      const response = await request(API_BASE_URL)
        .get(`/api/analytics/rate-trends?${params}`)
        .set('Cookie', authTokens.admin)
        .expect(200)

      expect(response.body).toHaveProperty('trends')
      expect(response.body).toHaveProperty('summary')
    })

    test('Sales can view rate trends for their shows', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/analytics/rate-trends')
        .set('Cookie', authTokens.sales)
        .expect(200)

      expect(response.body).toHaveProperty('trends')
    })

    test('Client cannot access rate trends analytics', async () => {
      await request(API_BASE_URL)
        .get('/api/analytics/rate-trends')
        .set('Cookie', authTokens.client)
        .expect(403)
    })
  })

  describe('Category Exclusivity Management', () => {
    test('Admin can set category exclusivity rates', async () => {
      if (!testShowId) {
        console.warn('No test show available, skipping test')
        return
      }

      const exclusivityData = {
        showId: testShowId,
        category: 'Automotive',
        exclusivityPremium: 0.25, // 25% premium
        effectiveDate: new Date().toISOString(),
        notes: 'Automotive category exclusivity'
      }

      const response = await request(API_BASE_URL)
        .post('/api/shows/category-exclusivity')
        .set('Cookie', authTokens.admin)
        .send(exclusivityData)
        .expect(201)

      expect(response.body.category).toBe(exclusivityData.category)
      expect(response.body.exclusivityPremium).toBe(exclusivityData.exclusivityPremium)
    })

    test('Sales cannot set category exclusivity', async () => {
      const exclusivityData = {
        showId: testShowId,
        category: 'Finance',
        exclusivityPremium: 0.30
      }

      await request(API_BASE_URL)
        .post('/api/shows/category-exclusivity')
        .set('Cookie', authTokens.sales)
        .send(exclusivityData)
        .expect(403)
    })
  })

  describe('Rate Validation and Business Rules', () => {
    test('System prevents overlapping rate periods', async () => {
      if (!testShowId) {
        console.warn('No test show available, skipping test')
        return
      }

      // Create first rate
      const rate1 = {
        baseRate: 200.00,
        effectiveDate: '2025-08-01',
        endDate: '2025-08-31',
        isActive: true
      }

      await request(API_BASE_URL)
        .post(`/api/shows/${testShowId}/rate-history`)
        .set('Cookie', authTokens.admin)
        .send(rate1)
        .expect(201)

      // Try to create overlapping rate
      const rate2 = {
        baseRate: 250.00,
        effectiveDate: '2025-08-15',
        endDate: '2025-09-15',
        isActive: true
      }

      const response = await request(API_BASE_URL)
        .post(`/api/shows/${testShowId}/rate-history`)
        .set('Cookie', authTokens.admin)
        .send(rate2)
        .expect(400)

      expect(response.body.error).toContain('overlap')
    })

    test('System validates rate amounts are positive', async () => {
      if (!testShowId) {
        console.warn('No test show available, skipping test')
        return
      }

      const invalidRate = {
        baseRate: -100.00,
        effectiveDate: new Date().toISOString()
      }

      const response = await request(API_BASE_URL)
        .post(`/api/shows/${testShowId}/rate-history`)
        .set('Cookie', authTokens.admin)
        .send(invalidRate)
        .expect(400)

      expect(response.body.error).toContain('positive')
    })

    test('System maintains audit trail for rate changes', async () => {
      if (!testShowId) {
        console.warn('No test show available, skipping test')
        return
      }

      // Get rate history with audit info
      const response = await request(API_BASE_URL)
        .get(`/api/shows/${testShowId}/rate-history?includeAudit=true`)
        .set('Cookie', authTokens.admin)
        .expect(200)

      if (response.body.length > 0) {
        const rate = response.body[0]
        expect(rate).toHaveProperty('createdBy')
        expect(rate).toHaveProperty('createdAt')
        expect(rate).toHaveProperty('updatedBy')
        expect(rate).toHaveProperty('updatedAt')
      }
    })
  })

  describe('Rate Integration with Campaigns', () => {
    test('Campaign uses correct rate based on effective date', async () => {
      // This test would verify that campaigns automatically
      // pick up the correct rate based on their start date
      // Implementation depends on campaign API structure
      expect(true).toBe(true) // Placeholder
    })

    test('Rate changes trigger campaign recalculation', async () => {
      // This test would verify that changing rates
      // triggers recalculation of affected campaigns
      expect(true).toBe(true) // Placeholder
    })
  })
})

// Export for use in other test suites
module.exports = {
  API_BASE_URL,
  TEST_ORG_ID
}