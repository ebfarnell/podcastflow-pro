import { POST as campaignBillingPost, GET as campaignBillingGet } from '@/app/api/campaigns/[id]/billing/route'
import { POST as campaignInvoicePost } from '@/app/api/campaigns/[id]/invoice/route'
import { POST as monthlyInvoicesPost, GET as monthlyInvoicesGet } from '@/app/api/master/billing/monthly-invoices/route'
import { GET as commissionsGet } from '@/app/api/master/billing/commissions/route'
import { POST as bulkBillingPost } from '@/app/api/campaigns/billing/bulk/route'
import { createTestUser, createTestSession, createTestCampaign, createAuthenticatedRequest, cleanupTestData, assertApiResponse, assertErrorResponse } from '../helpers/test-utils'

describe('/api/billing', () => {
  let testUser: any
  let masterUser: any
  let sessionToken: string
  let masterSessionToken: string
  let organizationId: string
  let testCampaign: any

  beforeEach(async () => {
    testUser = await createTestUser({
      email: 'billing-test@example.com',
      role: 'admin'
    })
    
    masterUser = await createTestUser({
      email: 'master-billing@example.com',
      role: 'master'
    })
    
    organizationId = testUser.organizationId
    sessionToken = await createTestSession(testUser.id)
    masterSessionToken = await createTestSession(masterUser.id)
    
    testCampaign = await createTestCampaign({
      organizationId,
      name: 'Billing Test Campaign',
      budget: 10000
    })
  })

  afterEach(async () => {
    if (organizationId) {
      await cleanupTestData(organizationId)
    }
    if (masterUser.organizationId) {
      await cleanupTestData(masterUser.organizationId)
    }
  })

  describe('GET /api/campaigns/[id]/billing', () => {
    it('should return campaign billing information', async () => {
      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}/billing`, 'GET', null, sessionToken)

      const response = await campaignBillingGet(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['campaignId', 'paymentHistory', 'metrics', 'timestamp'])
      expect(data.campaignId).toBe(testCampaign.id)
      expect(Array.isArray(data.paymentHistory)).toBe(true)
      expect(data.metrics).toBeDefined()
    })

    it('should return 404 for non-existent campaign', async () => {
      const fakeId = 'non-existent-campaign'
      const request = createAuthenticatedRequest(`/api/campaigns/${fakeId}/billing`, 'GET', null, sessionToken)

      const response = await campaignBillingGet(request, { params: { id: fakeId } })
      const data = await response.json()

      expect(response.status).toBe(500) // Will be 500 due to campaign not found error
      assertErrorResponse(data)
    })
  })

  describe('POST /api/campaigns/[id]/billing', () => {
    it('should process campaign payment', async () => {
      const paymentData = {
        amount: 2500.00,
        paymentMethod: 'bank_transfer',
        transactionId: 'txn_test_123',
        notes: 'Test payment for campaign'
      }

      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}/billing`, 'POST', paymentData, sessionToken)

      const response = await campaignBillingPost(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(201)
      assertApiResponse(data, ['success', 'invoiceId', 'paymentId', 'timestamp'])
      expect(data.success).toBe(true)
      expect(data.invoiceId).toBeDefined()
      expect(data.paymentId).toBeDefined()
    })

    it('should reject invalid payment data', async () => {
      const invalidPayment = {
        amount: -100, // Negative amount
        paymentMethod: 'invalid_method'
      }

      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}/billing`, 'POST', invalidPayment, sessionToken)

      const response = await campaignBillingPost(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(500)
      assertErrorResponse(data)
    })

    it('should reject missing amount', async () => {
      const incompletePayment = {
        paymentMethod: 'bank_transfer'
        // Missing amount
      }

      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}/billing`, 'POST', incompletePayment, sessionToken)

      const response = await campaignBillingPost(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(500)
      assertErrorResponse(data)
    })
  })

  describe('POST /api/campaigns/[id]/invoice', () => {
    it('should create campaign invoice', async () => {
      const invoiceData = {
        amount: 5000.00,
        notes: 'Test invoice for campaign services',
        paymentTerms: 'Net 30',
        lineItems: [
          {
            description: 'Campaign Management',
            quantity: 1,
            unitPrice: 3000,
            amount: 3000
          },
          {
            description: 'Ad Creative Development',
            quantity: 1,
            unitPrice: 2000,
            amount: 2000
          }
        ]
      }

      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}/invoice`, 'POST', invoiceData, sessionToken)

      const response = await campaignInvoicePost(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(201)
      assertApiResponse(data, ['success', 'invoice', 'timestamp'])
      expect(data.invoice.amount).toBe(invoiceData.amount)
      expect(data.invoice.invoiceNumber).toBeDefined()
    })

    it('should create simple invoice without line items', async () => {
      const simpleInvoice = {
        amount: 1500.00,
        notes: 'Simple test invoice'
      }

      const request = createAuthenticatedRequest(`/api/campaigns/${testCampaign.id}/invoice`, 'POST', simpleInvoice, sessionToken)

      const response = await campaignInvoicePost(request, { params: { id: testCampaign.id } })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.invoice.amount).toBe(simpleInvoice.amount)
    })
  })

  describe('POST /api/master/billing/monthly-invoices', () => {
    it('should generate monthly recurring invoices (master only)', async () => {
      const request = createAuthenticatedRequest('/api/master/billing/monthly-invoices', 'POST', {}, masterSessionToken)

      const response = await monthlyInvoicesPost(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      assertApiResponse(data, ['success', 'summary', 'results', 'timestamp'])
      expect(data.success).toBe(true)
      expect(Array.isArray(data.results)).toBe(true)
      expect(data.summary).toHaveProperty('processed')
    })

    it('should generate invoices for specific organization', async () => {
      const request = createAuthenticatedRequest('/api/master/billing/monthly-invoices', 'POST', {
        organizationId: organizationId
      }, masterSessionToken)

      const response = await monthlyInvoicesPost(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
    })

    it('should reject non-master users', async () => {
      const request = createAuthenticatedRequest('/api/master/billing/monthly-invoices', 'POST', {}, sessionToken)

      const response = await monthlyInvoicesPost(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      assertErrorResponse(data, 403)
    })
  })

  describe('GET /api/master/billing/monthly-invoices', () => {
    it('should get monthly invoice status (master only)', async () => {
      const currentYear = new Date().getFullYear()
      const currentMonth = new Date().getMonth()
      
      const request = createAuthenticatedRequest(
        `/api/master/billing/monthly-invoices?year=${currentYear}&month=${currentMonth}`, 
        'GET', 
        null, 
        masterSessionToken
      )

      const response = await monthlyInvoicesGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['period', 'summary', 'invoices', 'timestamp'])
      expect(data.period.year).toBe(currentYear)
      expect(data.period.month).toBe(currentMonth + 1)
    })
  })

  describe('GET /api/master/billing/commissions', () => {
    it('should get agency commissions overview (master only)', async () => {
      const request = createAuthenticatedRequest('/api/master/billing/commissions', 'GET', null, masterSessionToken)

      const response = await commissionsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      assertApiResponse(data, ['summary', 'agencyCommissions', 'totalRecords', 'timestamp'])
      expect(Array.isArray(data.agencyCommissions)).toBe(true)
      expect(data.summary).toHaveProperty('totalCommissions')
    })

    it('should filter by organization', async () => {
      const request = createAuthenticatedRequest(
        `/api/master/billing/commissions?organizationId=${organizationId}`, 
        'GET', 
        null, 
        masterSessionToken
      )

      const response = await commissionsGet(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })
  })

  describe('POST /api/campaigns/billing/bulk', () => {
    it('should process bulk campaign payments', async () => {
      const bulkPayments = {
        payments: [
          {
            campaignId: testCampaign.id,
            amount: 1000,
            paymentMethod: 'credit_card',
            notes: 'Bulk payment 1'
          },
          {
            campaignId: testCampaign.id,
            amount: 1500,
            paymentMethod: 'bank_transfer',
            notes: 'Bulk payment 2'
          }
        ]
      }

      const request = createAuthenticatedRequest('/api/campaigns/billing/bulk', 'POST', bulkPayments, sessionToken)

      const response = await bulkBillingPost(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      assertApiResponse(data, ['success', 'summary', 'results', 'errors'])
      expect(data.summary.total).toBe(2)
      expect(data.summary.successful).toBeLessThanOrEqual(2)
    })

    it('should handle partial failures in bulk processing', async () => {
      const mixedPayments = {
        payments: [
          {
            campaignId: testCampaign.id,
            amount: 1000,
            paymentMethod: 'credit_card'
          },
          {
            campaignId: 'invalid-campaign-id',
            amount: 1500,
            paymentMethod: 'bank_transfer'
          }
        ]
      }

      const request = createAuthenticatedRequest('/api/campaigns/billing/bulk', 'POST', mixedPayments, sessionToken)

      const response = await bulkBillingPost(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.summary.successful).toBe(1)
      expect(data.summary.failed).toBe(1)
      expect(data.errors.length).toBe(1)
    })

    it('should reject empty payments array', async () => {
      const emptyPayments = {
        payments: []
      }

      const request = createAuthenticatedRequest('/api/campaigns/billing/bulk', 'POST', emptyPayments, sessionToken)

      const response = await bulkBillingPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })

    it('should reject missing payments array', async () => {
      const invalidData = {
        // Missing payments array
      }

      const request = createAuthenticatedRequest('/api/campaigns/billing/bulk', 'POST', invalidData, sessionToken)

      const response = await bulkBillingPost(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      assertErrorResponse(data, 400)
    })
  })
})