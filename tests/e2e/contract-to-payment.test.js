/**
 * End-to-End Contract-to-Payment Cycle Tests
 * Tests the complete workflow from contract creation to payment receipt
 */

const request = require('supertest')
const dayjs = require('dayjs')

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

describe('End-to-End Contract to Payment Cycle', () => {
  let authToken = {}
  let workflowData = {}
  
  beforeAll(async () => {
    // Authenticate as admin for full workflow testing
    const loginResponse = await request(API_BASE_URL)
      .post('/api/auth/login')
      .send({ email: 'admin@podcastflow.pro', password: 'admin123' })
      .expect(200)
    
    authToken = `auth-token=${loginResponse.body.token}`
  })

  describe('Phase 1: Campaign and Contract Creation', () => {
    test('Create advertiser for campaign', async () => {
      const advertiserData = {
        name: 'E2E Test Advertiser',
        contactEmail: 'test@advertiser.com',
        contactName: 'Test Contact',
        industry: 'Technology',
        budget: 50000
      }

      const response = await request(API_BASE_URL)
        .post('/api/advertisers')
        .set('Cookie', authToken)
        .send(advertiserData)
        .expect(201)

      workflowData.advertiserId = response.body.id
      expect(response.body.name).toBe(advertiserData.name)
    })

    test('Create campaign with budget', async () => {
      const campaignData = {
        name: 'E2E Test Campaign',
        advertiserId: workflowData.advertiserId,
        startDate: dayjs().add(7, 'days').toISOString(),
        endDate: dayjs().add(37, 'days').toISOString(),
        budget: 25000,
        status: 'draft',
        objectives: 'Test campaign for E2E workflow validation'
      }

      const response = await request(API_BASE_URL)
        .post('/api/campaigns')
        .set('Cookie', authToken)
        .send(campaignData)
        .expect(201)

      workflowData.campaignId = response.body.id
      expect(response.body.budget).toBe(campaignData.budget)
    })

    test('Schedule campaign spots on shows', async () => {
      // Get available shows
      const showsResponse = await request(API_BASE_URL)
        .get('/api/shows')
        .set('Cookie', authToken)
        .expect(200)
      
      const shows = showsResponse.body.slice(0, 2) // Use first 2 shows
      
      const scheduleData = {
        campaignId: workflowData.campaignId,
        spots: shows.map(show => ({
          showId: show.id,
          placementType: 'mid-roll',
          date: dayjs().add(10, 'days').toISOString(),
          rate: show.baseRate || 250
        }))
      }

      const response = await request(API_BASE_URL)
        .post('/api/campaigns/schedule')
        .set('Cookie', authToken)
        .send(scheduleData)
        .expect(200)

      workflowData.scheduledSpots = response.body.spots
      expect(response.body.totalCost).toBeGreaterThan(0)
    })

    test('Generate contract from campaign', async () => {
      const contractData = {
        campaignId: workflowData.campaignId,
        type: 'insertion_order',
        title: `IO - ${workflowData.campaignId}`,
        terms: 'Net 30',
        requiresSignature: true
      }

      const response = await request(API_BASE_URL)
        .post('/api/contracts')
        .set('Cookie', authToken)
        .send(contractData)
        .expect(200)

      workflowData.contractId = response.body.id
      expect(response.body.status).toBe('draft')
      expect(response.body.totalValue).toBeGreaterThan(0)
    })
  })

  describe('Phase 2: Contract Approval and Execution', () => {
    test('Submit contract for approval', async () => {
      const submitData = {
        action: 'submit_for_approval',
        notes: 'Contract ready for review'
      }

      const response = await request(API_BASE_URL)
        .put(`/api/contracts/${workflowData.contractId}`)
        .set('Cookie', authToken)
        .send(submitData)
        .expect(200)

      expect(response.body.status).toBe('pending_approval')
    })

    test('Approve contract', async () => {
      const approvalData = {
        action: 'approve',
        approvalNotes: 'Contract approved for execution'
      }

      const response = await request(API_BASE_URL)
        .put(`/api/contracts/${workflowData.contractId}`)
        .set('Cookie', authToken)
        .send(approvalData)
        .expect(200)

      expect(response.body.status).toBe('approved')
      expect(response.body.approvedAt).toBeDefined()
    })

    test('Send contract for signature', async () => {
      const signatureData = {
        action: 'send_for_signature',
        recipientEmail: 'test@advertiser.com',
        message: 'Please review and sign the attached contract'
      }

      const response = await request(API_BASE_URL)
        .put(`/api/contracts/${workflowData.contractId}`)
        .set('Cookie', authToken)
        .send(signatureData)
        .expect(200)

      expect(response.body.status).toBe('sent_for_signature')
      workflowData.signatureRequestId = response.body.signatureRequestId
    })

    test('Simulate contract signature', async () => {
      // In real scenario, this would be handled by DocuSign webhook
      const signatureData = {
        action: 'mark_as_signed',
        signedAt: new Date().toISOString(),
        signatureId: 'test-signature-123'
      }

      const response = await request(API_BASE_URL)
        .put(`/api/contracts/${workflowData.contractId}`)
        .set('Cookie', authToken)
        .send(signatureData)
        .expect(200)

      expect(response.body.status).toBe('executed')
      expect(response.body.executedAt).toBeDefined()
    })
  })

  describe('Phase 3: Order Creation and Billing', () => {
    test('Create order from executed contract', async () => {
      const orderData = {
        contractId: workflowData.contractId,
        campaignId: workflowData.campaignId,
        advertiserId: workflowData.advertiserId,
        autoGenerateInvoice: false // Will generate manually for testing
      }

      const response = await request(API_BASE_URL)
        .post('/api/orders')
        .set('Cookie', authToken)
        .send(orderData)
        .expect(201)

      workflowData.orderId = response.body.id
      expect(response.body.status).toBe('active')
      expect(response.body.totalAmount).toBeGreaterThan(0)
    })

    test('Generate invoice from order', async () => {
      const invoiceData = {
        orderId: workflowData.orderId,
        dueDate: dayjs().add(30, 'days').toISOString(),
        terms: 'Net 30',
        includeDetails: true
      }

      const response = await request(API_BASE_URL)
        .post('/api/invoices')
        .set('Cookie', authToken)
        .send(invoiceData)
        .expect(201)

      workflowData.invoiceId = response.body.id
      workflowData.invoiceNumber = response.body.invoiceNumber
      expect(response.body.status).toBe('draft')
      expect(response.body.totalAmount).toBeGreaterThan(0)
    })

    test('Send invoice to client', async () => {
      const sendData = {
        action: 'send',
        recipientEmail: 'test@advertiser.com',
        ccEmails: ['accounting@podcastflow.pro'],
        message: 'Please find attached invoice for your recent campaign'
      }

      const response = await request(API_BASE_URL)
        .put(`/api/invoices/${workflowData.invoiceId}`)
        .set('Cookie', authToken)
        .send(sendData)
        .expect(200)

      expect(response.body.status).toBe('sent')
      expect(response.body.sentAt).toBeDefined()
    })
  })

  describe('Phase 4: Payment Processing', () => {
    test('Record partial payment', async () => {
      const partialPaymentData = {
        invoiceId: workflowData.invoiceId,
        amount: 10000,
        paymentMethod: 'wire_transfer',
        transactionId: 'WIRE-001-PARTIAL',
        paymentDate: new Date().toISOString(),
        notes: 'Partial payment received'
      }

      const response = await request(API_BASE_URL)
        .post('/api/payments')
        .set('Cookie', authToken)
        .send(partialPaymentData)
        .expect(201)

      workflowData.partialPaymentId = response.body.id
      expect(response.body.amount).toBe(10000)
      expect(response.body.status).toBe('completed')
    })

    test('Invoice shows partial payment status', async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/invoices/${workflowData.invoiceId}`)
        .set('Cookie', authToken)
        .expect(200)

      expect(response.body.status).toBe('partially_paid')
      expect(response.body.paidAmount).toBe(10000)
      expect(response.body.remainingAmount).toBeGreaterThan(0)
    })

    test('Record final payment', async () => {
      // Get remaining amount
      const invoiceResponse = await request(API_BASE_URL)
        .get(`/api/invoices/${workflowData.invoiceId}`)
        .set('Cookie', authToken)
        .expect(200)

      const finalPaymentData = {
        invoiceId: workflowData.invoiceId,
        amount: invoiceResponse.body.remainingAmount,
        paymentMethod: 'wire_transfer',
        transactionId: 'WIRE-002-FINAL',
        paymentDate: new Date().toISOString(),
        notes: 'Final payment received'
      }

      const response = await request(API_BASE_URL)
        .post('/api/payments')
        .set('Cookie', authToken)
        .send(finalPaymentData)
        .expect(201)

      workflowData.finalPaymentId = response.body.id
      expect(response.body.status).toBe('completed')
    })

    test('Invoice marked as fully paid', async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/invoices/${workflowData.invoiceId}`)
        .set('Cookie', authToken)
        .expect(200)

      expect(response.body.status).toBe('paid')
      expect(response.body.paidAt).toBeDefined()
      expect(response.body.remainingAmount).toBe(0)
    })

    test('Order status updated to completed', async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/orders/${workflowData.orderId}`)
        .set('Cookie', authToken)
        .expect(200)

      expect(response.body.status).toBe('completed')
      expect(response.body.completedAt).toBeDefined()
    })
  })

  describe('Phase 5: Reporting and Analytics', () => {
    test('Generate payment report', async () => {
      const reportParams = new URLSearchParams({
        startDate: dayjs().subtract(30, 'days').toISOString(),
        endDate: dayjs().add(1, 'day').toISOString(),
        groupBy: 'advertiser'
      })

      const response = await request(API_BASE_URL)
        .get(`/api/reports/payments?${reportParams}`)
        .set('Cookie', authToken)
        .expect(200)

      expect(response.body).toHaveProperty('totalReceived')
      expect(response.body).toHaveProperty('payments')
      expect(Array.isArray(response.body.payments)).toBe(true)
    })

    test('Verify contract fulfillment metrics', async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/contracts/${workflowData.contractId}/metrics`)
        .set('Cookie', authToken)
        .expect(200)

      expect(response.body).toHaveProperty('fulfillmentRate')
      expect(response.body).toHaveProperty('paymentStatus')
      expect(response.body.paymentStatus).toBe('paid')
    })

    test('Check campaign ROI with payments', async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/campaigns/${workflowData.campaignId}/analytics`)
        .set('Cookie', authToken)
        .expect(200)

      expect(response.body).toHaveProperty('revenue')
      expect(response.body).toHaveProperty('costs')
      expect(response.body).toHaveProperty('profit')
      expect(response.body.revenue).toBeGreaterThan(0)
    })
  })

  describe('Error Recovery and Edge Cases', () => {
    test('Handle duplicate invoice generation gracefully', async () => {
      const invoiceData = {
        orderId: workflowData.orderId,
        dueDate: dayjs().add(30, 'days').toISOString()
      }

      const response = await request(API_BASE_URL)
        .post('/api/invoices')
        .set('Cookie', authToken)
        .send(invoiceData)
        .expect(400)

      expect(response.body.error).toContain('already exists')
    })

    test('Prevent overpayment on invoice', async () => {
      const overpaymentData = {
        invoiceId: workflowData.invoiceId,
        amount: 100000, // Way more than invoice amount
        paymentMethod: 'check',
        transactionId: 'CHK-OVERPAY'
      }

      const response = await request(API_BASE_URL)
        .post('/api/payments')
        .set('Cookie', authToken)
        .send(overpaymentData)
        .expect(400)

      expect(response.body.error).toContain('exceeds')
    })

    test('Contract cannot be deleted after execution', async () => {
      await request(API_BASE_URL)
        .delete(`/api/contracts/${workflowData.contractId}`)
        .set('Cookie', authToken)
        .expect(400)
    })
  })

  afterAll(async () => {
    // Clean up test data if needed
    console.log('E2E Test Workflow Data:', {
      advertiserId: workflowData.advertiserId,
      campaignId: workflowData.campaignId,
      contractId: workflowData.contractId,
      orderId: workflowData.orderId,
      invoiceId: workflowData.invoiceId,
      invoiceNumber: workflowData.invoiceNumber
    })
  })
})

module.exports = { API_BASE_URL }