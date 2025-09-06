/**
 * Tests for Campaign Invoices and Timeline API endpoints
 * Validates tenant isolation and data integrity
 */

const request = require('supertest')
const { NextRequest } = require('next/server')

// Mock the safeQuerySchema function
jest.mock('@/lib/db/schema-db', () => ({
  safeQuerySchema: jest.fn(),
}))

// Mock the session helper
jest.mock('@/lib/auth/session-helper', () => ({
  getSessionFromCookie: jest.fn(),
}))

const { safeQuerySchema } = require('@/lib/db/schema-db')
const { getSessionFromCookie } = require('@/lib/auth/session-helper')

describe('Campaign Invoices and Timeline API', () => {
  const mockSession = {
    userId: 'user1',
    organizationSlug: 'test_org',
    role: 'admin'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getSessionFromCookie.mockResolvedValue(mockSession)
  })

  describe('GET /api/campaigns/[id]/invoices', () => {
    const { GET } = require('@/app/api/campaigns/[id]/invoices/route')

    test('should enforce tenant isolation by using organizationSlug', async () => {
      safeQuerySchema.mockResolvedValue({ data: [], error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/invoices')
      const response = await GET(request, { params: { id: '123' } })
      
      expect(safeQuerySchema).toHaveBeenCalledWith(
        'test_org', // organizationSlug from session
        expect.any(String),
        expect.any(Array)
      )
    })

    test('should return 401 if no session', async () => {
      getSessionFromCookie.mockResolvedValue(null)
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/invoices')
      const response = await GET(request, { params: { id: '123' } })
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('should return empty data on query error (defensive handling)', async () => {
      safeQuerySchema.mockResolvedValue({ 
        data: null, 
        error: 'Database connection failed' 
      })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/invoices')
      const response = await GET(request, { params: { id: '123' } })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.invoices).toEqual([])
      expect(data.totals).toEqual({ issued: 0, paid: 0, outstanding: 0 })
    })

    test('should query invoices by campaign ID through InvoiceItem relationship', async () => {
      safeQuerySchema.mockResolvedValue({ data: [], error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/test-campaign-id/invoices')
      const response = await GET(request, { params: { id: 'test-campaign-id' } })
      
      // Check that the query includes the campaign ID filter
      const [, query, params] = safeQuerySchema.mock.calls[0]
      expect(query).toContain('ii."campaignId" = $1')
      expect(params[0]).toBe('test-campaign-id')
    })

    test('should support pagination parameters', async () => {
      safeQuerySchema.mockResolvedValue({ data: [], error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/invoices?page=2&pageSize=5')
      const response = await GET(request, { params: { id: '123' } })
      
      // Check that LIMIT and OFFSET are applied
      const [, query, params] = safeQuerySchema.mock.calls[0]
      expect(query).toContain('LIMIT')
      expect(query).toContain('OFFSET')
      expect(params).toContain(5) // pageSize
      expect(params).toContain(5) // offset (page 2 * pageSize - pageSize)
    })

    test('should support status filtering', async () => {
      safeQuerySchema.mockResolvedValue({ data: [], error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/invoices?status=paid')
      const response = await GET(request, { params: { id: '123' } })
      
      const [, query, params] = safeQuerySchema.mock.calls[0]
      expect(query).toContain('i."status" = $')
      expect(params).toContain('paid')
    })

    test('should support date range filtering', async () => {
      safeQuerySchema.mockResolvedValue({ data: [], error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/invoices?from=2024-01-01&to=2024-12-31')
      const response = await GET(request, { params: { id: '123' } })
      
      const [, query, params] = safeQuerySchema.mock.calls[0]
      expect(query).toContain('i."issueDate" >= $')
      expect(query).toContain('i."issueDate" <= $')
      expect(params).toContain('2024-01-01')
      expect(params).toContain('2024-12-31')
    })

    test('should calculate totals correctly', async () => {
      const mockInvoices = [
        { id: '1', totalAmount: 1000, status: 'paid' },
        { id: '2', totalAmount: 2000, status: 'sent' },
        { id: '3', totalAmount: 500, status: 'void' }
      ]
      
      const mockTotals = [{
        totalIssued: 2500, // excludes void
        totalPaid: 1000,
        totalOutstanding: 1500
      }]
      
      safeQuerySchema
        .mockResolvedValueOnce({ data: mockInvoices, error: null }) // invoices query
        .mockResolvedValueOnce({ data: [{ count: 3 }], error: null }) // count query
        .mockResolvedValueOnce({ data: mockTotals, error: null }) // totals query
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/invoices')
      const response = await GET(request, { params: { id: '123' } })
      const data = await response.json()
      
      expect(data.totals).toEqual({
        issued: 2500,
        paid: 1000,
        outstanding: 1500
      })
    })
  })

  describe('GET /api/campaigns/[id]/timeline', () => {
    const { GET } = require('@/app/api/campaigns/[id]/timeline/route')

    test('should enforce tenant isolation by using organizationSlug', async () => {
      safeQuerySchema.mockResolvedValue({ data: [{ id: 'c1', name: 'Test Campaign' }], error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/timeline')
      const response = await GET(request, { params: { id: '123' } })
      
      expect(safeQuerySchema).toHaveBeenCalledWith(
        'test_org', // organizationSlug from session
        expect.any(String),
        expect.any(Array)
      )
    })

    test('should return 401 if no session', async () => {
      getSessionFromCookie.mockResolvedValue(null)
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/timeline')
      const response = await GET(request, { params: { id: '123' } })
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('should return 404 if campaign not found', async () => {
      safeQuerySchema.mockResolvedValue({ data: [], error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/nonexistent/timeline')
      const response = await GET(request, { params: { id: 'nonexistent' } })
      const data = await response.json()
      
      expect(response.status).toBe(404)
      expect(data.error).toBe('Campaign not found')
    })

    test('should query multiple data sources for timeline events', async () => {
      const mockCampaign = [{
        id: '123',
        name: 'Test Campaign',
        orderId: 'order-123',
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'user1'
      }]
      
      safeQuerySchema
        .mockResolvedValueOnce({ data: mockCampaign, error: null }) // campaign query
        .mockResolvedValueOnce({ data: [], error: null }) // activities query
        .mockResolvedValueOnce({ data: [], error: null }) // approvals query
        .mockResolvedValueOnce({ data: [], error: null }) // orders query
        .mockResolvedValueOnce({ data: [], error: null }) // contracts query
        .mockResolvedValueOnce({ data: [], error: null }) // invoices query
        .mockResolvedValueOnce({ data: [], error: null }) // schedule changes query
        .mockResolvedValueOnce({ data: [], error: null }) // status changes query
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/timeline')
      const response = await GET(request, { params: { id: '123' } })
      const data = await response.json()
      
      // Should include campaign creation event
      expect(data.events).toContainEqual(
        expect.objectContaining({
          type: 'campaign_created',
          title: 'Campaign Created',
          source: 'campaign'
        })
      )
    })

    test('should support event type filtering', async () => {
      const mockCampaign = [{ id: '123', name: 'Test Campaign' }]
      safeQuerySchema.mockResolvedValue({ data: mockCampaign, error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/timeline?types=approval,invoice')
      const response = await GET(request, { params: { id: '123' } })
      
      // Should not query other event types when filtering
      expect(safeQuerySchema).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/Activity/), // Should still query activities but filter
        expect.any(Array)
      )
    })

    test('should support cursor-based pagination', async () => {
      const mockCampaign = [{ id: '123', name: 'Test Campaign' }]
      const mockEvents = [
        {
          id: 'event1',
          type: 'campaign_created',
          title: 'Campaign Created',
          timestamp: '2024-01-02T00:00:00Z'
        },
        {
          id: 'event2',
          type: 'activity',
          title: 'Activity Event',
          timestamp: '2024-01-01T00:00:00Z'
        }
      ]
      
      safeQuerySchema.mockResolvedValue({ data: mockCampaign, error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/timeline?cursor=2024-01-01T12:00:00Z&limit=1')
      const response = await GET(request, { params: { id: '123' } })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toHaveProperty('nextCursor')
      expect(data).toHaveProperty('hasMore')
    })

    test('should support date range filtering in timeline queries', async () => {
      const mockCampaign = [{ id: '123', name: 'Test Campaign' }]
      safeQuerySchema.mockResolvedValue({ data: mockCampaign, error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/timeline?from=2024-01-01&to=2024-12-31')
      const response = await GET(request, { params: { id: '123' } })
      
      // Check that date filters are applied to sub-queries
      const queryCalls = safeQuerySchema.mock.calls
      const activityQuery = queryCalls.find(call => call[1].includes('Activity'))
      expect(activityQuery[1]).toContain('createdAt')
    })

    test('should handle defensive error cases gracefully', async () => {
      safeQuerySchema.mockResolvedValue({ data: null, error: 'Connection failed' })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/timeline')
      const response = await GET(request, { params: { id: '123' } })
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.events).toEqual([])
      expect(data.hasMore).toBe(false)
    })
  })

  describe('Cross-tenant isolation tests', () => {
    test('invoices API should not leak data between organizations', async () => {
      const session1 = { ...mockSession, organizationSlug: 'org1' }
      const session2 = { ...mockSession, organizationSlug: 'org2' }
      
      getSessionFromCookie.mockResolvedValueOnce(session1)
      safeQuerySchema.mockResolvedValue({ data: [], error: null })
      
      const { GET } = require('@/app/api/campaigns/[id]/invoices/route')
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/invoices')
      await GET(request, { params: { id: '123' } })
      
      expect(safeQuerySchema).toHaveBeenCalledWith('org1', expect.any(String), expect.any(Array))
      
      // Reset and test with different org
      jest.clearAllMocks()
      getSessionFromCookie.mockResolvedValueOnce(session2)
      safeQuerySchema.mockResolvedValue({ data: [], error: null })
      
      await GET(request, { params: { id: '123' } })
      expect(safeQuerySchema).toHaveBeenCalledWith('org2', expect.any(String), expect.any(Array))
    })

    test('timeline API should not leak data between organizations', async () => {
      const session1 = { ...mockSession, organizationSlug: 'org1' }
      const session2 = { ...mockSession, organizationSlug: 'org2' }
      
      getSessionFromCookie.mockResolvedValueOnce(session1)
      safeQuerySchema.mockResolvedValue({ data: [{ id: '123', name: 'Test' }], error: null })
      
      const { GET } = require('@/app/api/campaigns/[id]/timeline/route')
      const request = new NextRequest('http://localhost:3000/api/campaigns/123/timeline')
      await GET(request, { params: { id: '123' } })
      
      expect(safeQuerySchema).toHaveBeenCalledWith('org1', expect.any(String), expect.any(Array))
      
      // Reset and test with different org
      jest.clearAllMocks()
      getSessionFromCookie.mockResolvedValueOnce(session2)
      safeQuerySchema.mockResolvedValue({ data: [{ id: '123', name: 'Test' }], error: null })
      
      await GET(request, { params: { id: '123' } })
      expect(safeQuerySchema).toHaveBeenCalledWith('org2', expect.any(String), expect.any(Array))
    })
  })

  describe('Data integrity and validation', () => {
    test('should validate campaign ID parameter', async () => {
      const { GET } = require('@/app/api/campaigns/[id]/invoices/route')
      
      safeQuerySchema.mockResolvedValue({ data: [], error: null })
      
      const request = new NextRequest('http://localhost:3000/api/campaigns/test-id-123/invoices')
      await GET(request, { params: { id: 'test-id-123' } })
      
      const [, query, params] = safeQuerySchema.mock.calls[0]
      expect(params[0]).toBe('test-id-123')
    })

    test('should handle SQL injection attempts safely', async () => {
      const { GET } = require('@/app/api/campaigns/[id]/invoices/route')
      
      safeQuerySchema.mockResolvedValue({ data: [], error: null })
      
      const maliciousCampaignId = "'; DROP TABLE Campaign; --"
      const request = new NextRequest('http://localhost:3000/api/campaigns/malicious/invoices')
      await GET(request, { params: { id: maliciousCampaignId } })
      
      // safeQuerySchema should be called with parameterized queries
      const [, query, params] = safeQuerySchema.mock.calls[0]
      expect(query).toContain('$1') // Parameterized query
      expect(params[0]).toBe(maliciousCampaignId) // Parameter is safely passed
    })

    test('should return consistent empty states', async () => {
      const { GET: getInvoices } = require('@/app/api/campaigns/[id]/invoices/route')
      const { GET: getTimeline } = require('@/app/api/campaigns/[id]/timeline/route')
      
      // Test invoices empty state
      safeQuerySchema.mockResolvedValue({ data: null, error: 'No data' })
      
      const invoicesRequest = new NextRequest('http://localhost:3000/api/campaigns/123/invoices')
      const invoicesResponse = await getInvoices(invoicesRequest, { params: { id: '123' } })
      const invoicesData = await invoicesResponse.json()
      
      expect(invoicesData.invoices).toEqual([])
      expect(invoicesData.totals).toEqual({ issued: 0, paid: 0, outstanding: 0 })
      
      // Test timeline empty state  
      jest.clearAllMocks()
      safeQuerySchema.mockResolvedValue({ data: [], error: null }) // Campaign not found
      
      const timelineRequest = new NextRequest('http://localhost:3000/api/campaigns/123/timeline')
      const timelineResponse = await getTimeline(timelineRequest, { params: { id: '123' } })
      
      expect(timelineResponse.status).toBe(404)
    })
  })
})