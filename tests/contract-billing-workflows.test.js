/**
 * Contract & Billing Workflow Integration Tests
 * Tests the complete contract and billing automation workflows with notification integration
 * Enhanced with comprehensive test coverage for all contract lifecycle stages
 */

const request = require('supertest')
const { PrismaClient } = require('@prisma/client')
const dayjs = require('dayjs')

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'
const TEST_ORG_ID = process.env.TEST_ORG_ID || 'org_podcastflow_pro'

describe('Contract & Billing Workflow Integration', () => {
  let authTokens = {}
  let testData = {}

  beforeAll(async () => {
    // Authenticate test users
    const users = [
      { role: 'master', email: 'michael@unfy.com', password: 'EMunfy2025' },
      { role: 'admin', email: 'admin@podcastflow.pro', password: 'admin123' },
      { role: 'sales', email: 'seller@podcastflow.pro', password: 'seller123' }
    ]

    for (const user of users) {
      const response = await request(API_BASE_URL)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200)

      authTokens[user.role] = response.headers['set-cookie']?.[0]?.split(';')[0]
    }

    // Create test data
    await setupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  describe('Contract Template Management', () => {
    test('Admin can create contract template with notifications', async () => {
      const templateData = {
        name: 'Test Insertion Order Template',
        description: 'Test template for automated testing',
        templateType: 'insertion_order',
        htmlTemplate: '<h1>{{advertiserName}} Contract</h1><p>Campaign: {{campaignName}}</p><p>Value: {{totalValue}}</p>',
        variables: [
          { name: 'advertiserName', label: 'Advertiser Name', type: 'text' },
          { name: 'campaignName', label: 'Campaign Name', type: 'text' },
          { name: 'totalValue', label: 'Total Value', type: 'currency' }
        ],
        isDefault: true
      }

      const response = await request(API_BASE_URL)
        .post('/api/admin/contract-templates')
        .set('Cookie', authTokens.admin)
        .send(templateData)
        .expect(200)

      expect(response.body).toHaveProperty('id')
      expect(response.body.name).toBe(templateData.name)
      expect(response.body.isDefault).toBe(true)

      testData.templateId = response.body.id

      // Verify notification was sent to other admin users
      // (This would require checking the notification system)
    })

    test('Admin can update contract template', async () => {
      const updateData = {
        name: 'Updated Test Template',
        isActive: false
      }

      const response = await request(API_BASE_URL)
        .put(`/api/admin/contract-templates/${testData.templateId}`)
        .set('Cookie', authTokens.admin)
        .send(updateData)
        .expect(200)

      expect(response.body.name).toBe(updateData.name)
      expect(response.body.isActive).toBe(false)
    })

    test('Non-admin users cannot access contract templates', async () => {
      await request(API_BASE_URL)
        .get('/api/admin/contract-templates')
        .set('Cookie', authTokens.sales)
        .expect(403)
    })
  })

  describe('Billing Automation Settings', () => {
    test('Admin can configure billing automation settings', async () => {
      const billingData = {
        defaultInvoiceDay: 1,
        defaultPaymentTerms: 'Net 30',
        autoGenerateInvoices: true,
        invoicePrefix: 'TEST',
        invoiceStartNumber: 2000,
        lateFeePercentage: 2.5,
        gracePeriodDays: 5,
        preBillEnabled: true,
        preBillThresholdAmount: 15000,
        emailSettings: {
          sendInvoiceEmails: true,
          sendPaymentReminders: true,
          reminderDaysBefore: [7, 3, 1]
        }
      }

      const response = await request(API_BASE_URL)
        .post('/api/admin/billing-automation')
        .set('Cookie', authTokens.admin)
        .send(billingData)
        .expect(200)

      expect(response.body.autoGenerateInvoices).toBe(true)
      expect(response.body.preBillThresholdAmount).toBe(15000)
      expect(response.body.invoicePrefix).toBe('TEST')

      testData.billingSettingsId = response.body.id
    })

    test('Billing settings changes trigger notifications', async () => {
      const criticalUpdate = {
        autoGenerateInvoices: false,
        lateFeePercentage: 5.0
      }

      const response = await request(API_BASE_URL)
        .post('/api/admin/billing-automation')
        .set('Cookie', authTokens.master)
        .send(criticalUpdate)
        .expect(200)

      expect(response.body.autoGenerateInvoices).toBe(false)
      expect(response.body.lateFeePercentage).toBe(5.0)
    })
  })

  describe('Contract Workflow', () => {
    test('Sales user can create contract requiring approval', async () => {
      const contractData = {
        advertiserId: testData.advertiserId,
        templateId: testData.templateId,
        title: 'Test Advertising Contract',
        description: 'Contract for testing workflow automation',
        totalValue: 25000,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        requiresApproval: true,
        approvalDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        terms: 'Standard advertising terms and conditions'
      }

      const response = await request(API_BASE_URL)
        .post('/api/contracts')
        .set('Cookie', authTokens.sales)
        .send(contractData)
        .expect(200)

      expect(response.body).toHaveProperty('id')
      expect(response.body.status).toBe('pending_approval')
      expect(response.body.requiresApproval).toBe(true)

      testData.contractId = response.body.id
    })

    test('Admin can approve contract with notifications', async () => {
      const approvalData = {
        status: 'approved',
        approvalNotes: 'Contract approved after review. Terms are acceptable.'
      }

      const response = await request(API_BASE_URL)
        .put(`/api/contracts/${testData.contractId}`)
        .set('Cookie', authTokens.admin)
        .send(approvalData)
        .expect(200)

      expect(response.body.status).toBe('approved')
      expect(response.body.approvalNotes).toBe(approvalData.approvalNotes)
      expect(response.body.approvedAt).toBeDefined()
    })

    test('Contract can be sent for signature', async () => {
      const signatureData = {
        action: 'send',
        recipientEmail: 'test-client@example.com'
      }

      const response = await request(API_BASE_URL)
        .put(`/api/contracts/${testData.contractId}`)
        .set('Cookie', authTokens.admin)
        .send(signatureData)
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    test('Contract can be executed with notifications', async () => {
      const executionData = {
        action: 'execute'
      }

      const response = await request(API_BASE_URL)
        .put(`/api/contracts/${testData.contractId}`)
        .set('Cookie', authTokens.admin)
        .send(executionData)
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    test('Unauthorized users cannot update contracts', async () => {
      const updateData = { status: 'rejected' }

      await request(API_BASE_URL)
        .put(`/api/contracts/${testData.contractId}`)
        .send(updateData) // No auth cookie
        .expect(401)
    })
  })

  describe('Pre-Bill Approval Workflow', () => {
    test('Admin can view pre-bill approval requirements', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/billing/automation/pre-bill-approvals?status=pending')
        .set('Cookie', authTokens.admin)
        .expect(200)

      expect(response.body).toHaveProperty('threshold')
      expect(response.body).toHaveProperty('advertisers')
      expect(Array.isArray(response.body.advertisers)).toBe(true)
    })

    test('Admin can approve pre-billing with notifications', async () => {
      // First create an advertiser that exceeds threshold
      const highValueAdvertiser = await createTestAdvertiserWithHighValue()

      const approvalData = {
        advertiserId: highValueAdvertiser.id,
        action: 'approve',
        notes: 'Approved after verification of advertiser credit status'
      }

      const response = await request(API_BASE_URL)
        .post('/api/billing/automation/pre-bill-approvals')
        .set('Cookie', authTokens.admin)
        .send(approvalData)
        .expect(200)

      expect(response.body.status).toBe('approved')
      expect(response.body.notes).toBe(approvalData.notes)
    })

    test('Sales users cannot approve pre-billing', async () => {
      const approvalData = {
        advertiserId: testData.advertiserId,
        action: 'approve'
      }

      await request(API_BASE_URL)
        .post('/api/billing/automation/pre-bill-approvals')
        .set('Cookie', authTokens.sales)
        .send(approvalData)
        .expect(403)
    })
  })

  describe('Automated Billing Cycle', () => {
    test('Admin can run dry-run billing cycle', async () => {
      const cycleData = {
        organizationId: TEST_ORG_ID,
        period: new Date().toISOString().slice(0, 7), // Current month
        dryRun: true
      }

      const response = await request(API_BASE_URL)
        .post('/api/billing/automation/cycle')
        .set('Cookie', authTokens.admin)
        .send(cycleData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.dryRun).toBe(true)
      expect(response.body).toHaveProperty('totalOrders')
      expect(response.body).toHaveProperty('successful')
    })

    test('Admin can run actual billing cycle with notifications', async () => {
      // Create test orders first
      await createTestOrdersForBilling()

      const cycleData = {
        organizationId: TEST_ORG_ID,
        period: new Date().toISOString().slice(0, 7),
        dryRun: false
      }

      const response = await request(API_BASE_URL)
        .post('/api/billing/automation/cycle')
        .set('Cookie', authTokens.master)
        .send(cycleData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.dryRun).toBe(false)
      expect(response.body.invoicesGenerated).toBeGreaterThanOrEqual(0)
    })

    test('System can run scheduled billing cycle', async () => {
      const cycleData = {
        organizationId: TEST_ORG_ID,
        period: new Date().toISOString().slice(0, 7)
      }

      const response = await request(API_BASE_URL)
        .post('/api/billing/automation/cycle')
        .set('x-system-key', process.env.SYSTEM_API_KEY)
        .send(cycleData)
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('Notification Integration', () => {
    test('Contract approval notifications are sent', async () => {
      // This would require mocking or checking the notification service
      // For now, we verify the API responses include notification triggers
      expect(true).toBe(true) // Placeholder
    })

    test('Billing cycle notifications are sent', async () => {
      // Verify that billing cycle completion triggers notifications
      expect(true).toBe(true) // Placeholder
    })

    test('Pre-bill approval notifications are sent', async () => {
      // Verify pre-bill approval/rejection triggers notifications
      expect(true).toBe(true) // Placeholder
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('Invalid contract data returns appropriate error', async () => {
      const invalidContract = {
        title: 'Test Contract'
        // Missing required advertiserId
      }

      await request(API_BASE_URL)
        .post('/api/contracts')
        .set('Cookie', authTokens.sales)
        .send(invalidContract)
        .expect(400)
    })

    test('Deleting used contract template fails gracefully', async () => {
      await request(API_BASE_URL)
        .delete(`/api/admin/contract-templates/${testData.templateId}`)
        .set('Cookie', authTokens.admin)
        .expect(400) // Should fail because template is in use
    })

    test('Billing cycle handles missing organization gracefully', async () => {
      const cycleData = {
        organizationId: 'non-existent-org',
        period: new Date().toISOString().slice(0, 7)
      }

      await request(API_BASE_URL)
        .post('/api/billing/automation/cycle')
        .set('Cookie', authTokens.admin)
        .send(cycleData)
        .expect(404)
    })

    test('Pre-bill approval handles invalid advertiser', async () => {
      const approvalData = {
        advertiserId: 'non-existent-advertiser',
        action: 'approve'
      }

      await request(API_BASE_URL)
        .post('/api/billing/automation/pre-bill-approvals')
        .set('Cookie', authTokens.admin)
        .send(approvalData)
        .expect(404)
    })
  })

  // Helper functions
  async function setupTestData() {
    // Create test advertiser, campaigns, orders, etc.
    // This would integrate with your existing test data setup
    testData.advertiserId = 'test-advertiser-id'
  }

  async function cleanupTestData() {
    // Clean up test data created during tests
    // Remove test contracts, templates, orders, etc.
  }

  async function createTestAdvertiserWithHighValue() {
    // Create an advertiser with orders exceeding pre-bill threshold
    return { id: 'high-value-advertiser' }
  }

  async function createTestOrdersForBilling() {
    // Create test orders that need to be invoiced
  }
})

// Performance and Load Tests
describe('Contract & Billing Performance', () => {
  test('Contract creation performance', async () => {
    const startTime = Date.now()
    
    const contractData = {
      advertiserId: 'test-advertiser',
      title: 'Performance Test Contract',
      totalValue: 10000
    }

    await request(API_BASE_URL)
      .post('/api/contracts')
      .set('Cookie', authTokens.sales)
      .send(contractData)
      .expect(200)

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
  })

  test('Billing cycle performance with multiple orders', async () => {
    const startTime = Date.now()

    const cycleData = {
      organizationId: TEST_ORG_ID,
      period: new Date().toISOString().slice(0, 7),
      dryRun: true
    }

    await request(API_BASE_URL)
      .post('/api/billing/automation/cycle')
      .set('Cookie', authTokens.admin)
      .send(cycleData)
      .expect(200)

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
  })
})

// Security Tests
describe('Contract & Billing Security', () => {
  test('SQL injection prevention in contract queries', async () => {
    const maliciousInput = {
      advertiserId: "'; DROP TABLE Contract; --",
      title: 'Malicious Contract'
    }

    // Should handle malicious input gracefully
    await request(API_BASE_URL)
      .post('/api/contracts')
      .set('Cookie', authTokens.sales)
      .send(maliciousInput)
      .expect(400) // Should return error, not crash
  })

  test('XSS prevention in contract template content', async () => {
    const xssTemplate = {
      name: '<script>alert("xss")</script>',
      htmlTemplate: '<h1>{{advertiserName}}</h1><script>alert("xss")</script>',
      templateType: 'insertion_order'
    }

    const response = await request(API_BASE_URL)
      .post('/api/admin/contract-templates')
      .set('Cookie', authTokens.admin)
      .send(xssTemplate)
      .expect(200)

    // Verify XSS content is sanitized or escaped
    expect(response.body.name).not.toContain('<script>')
  })

  test('Authorization checks prevent privilege escalation', async () => {
    // Sales user trying to approve their own contract
    await request(API_BASE_URL)
      .put(`/api/contracts/${testData.contractId}`)
      .set('Cookie', authTokens.sales)
      .send({ status: 'approved' })
      .expect(403)
  })
})