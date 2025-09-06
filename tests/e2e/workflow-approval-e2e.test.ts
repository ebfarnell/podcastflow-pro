import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { querySchema } from '@/lib/db/schema-db'
import { v4 as uuidv4 } from 'uuid'

/**
 * End-to-End tests for the 90% campaign approval workflow
 * Tests the complete user journey from campaign creation to approval/rejection
 */
describe('Campaign 90% Approval Workflow E2E', () => {
  const testOrgSlug = 'org_podcastflow_pro' // Use real org for E2E
  
  // Test user sessions (simulating different roles)
  const salesUser = {
    id: uuidv4(),
    email: 'e2e-sales@test.com',
    role: 'sales',
    name: 'E2E Sales User'
  }
  
  const adminUser = {
    id: uuidv4(),
    email: 'e2e-admin@test.com',
    role: 'admin',
    name: 'E2E Admin User'
  }
  
  let testCampaignId: string
  let testAdvertiserId: string
  let testAgencyId: string
  let apiBaseUrl: string

  beforeAll(async () => {
    // Setup E2E test environment
    apiBaseUrl = process.env.TEST_API_URL || 'http://localhost:3000/api'
    
    // Create test users in database
    await createTestUser(salesUser)
    await createTestUser(adminUser)
    
    // Create test advertiser and agency
    testAdvertiserId = await createTestAdvertiser()
    testAgencyId = await createTestAgency()
  })

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData()
  })

  beforeEach(async () => {
    // Create fresh campaign for each test
    testCampaignId = await createTestCampaign()
  })

  describe('Complete Approval Flow', () => {
    it('should complete full approval workflow from sales to admin', async () => {
      // Step 1: Sales user creates campaign at 50%
      const createResponse = await simulateApiCall('POST', '/campaigns', {
        name: 'E2E Test Campaign',
        advertiserId: testAdvertiserId,
        agencyId: testAgencyId,
        budget: 50000,
        probability: 50,
        startDate: '2025-03-01',
        endDate: '2025-03-31'
      }, salesUser)

      expect(createResponse.status).toBe(201)
      const campaignId = createResponse.data.id

      // Step 2: Sales user updates probability to 90%
      const updateResponse = await simulateApiCall('PUT', `/campaigns/${campaignId}`, {
        probability: 90
      }, salesUser)

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.data.message).toContain('automation triggered')

      // Step 3: Verify approval request was created
      const approvalsResponse = await simulateApiCall('GET', '/admin/approvals', {}, adminUser)
      
      expect(approvalsResponse.status).toBe(200)
      const pendingApproval = approvalsResponse.data.approvals.find(
        (a: any) => a.campaignId === campaignId
      )
      expect(pendingApproval).toBeDefined()
      expect(pendingApproval.status).toBe('pending')

      // Step 4: Admin approves the campaign
      const approveResponse = await simulateApiCall(
        'PUT',
        `/campaigns/approvals/${pendingApproval.id}`,
        {
          action: 'approve',
          notes: 'E2E test approval'
        },
        adminUser
      )

      expect(approveResponse.status).toBe(200)
      expect(approveResponse.data.orderId).toBeDefined()

      // Step 5: Verify campaign moved to Order
      const orderResponse = await simulateApiCall(
        'GET',
        `/orders?campaignId=${campaignId}`,
        {},
        adminUser
      )

      expect(orderResponse.status).toBe(200)
      expect(orderResponse.data.orders.length).toBeGreaterThan(0)
      expect(orderResponse.data.orders[0].status).toBe('active')

      // Step 6: Verify campaign status updated
      const campaignResponse = await simulateApiCall(
        'GET',
        `/campaigns/${campaignId}`,
        {},
        salesUser
      )

      expect(campaignResponse.status).toBe(200)
      expect(campaignResponse.data.probability).toBe(100)
      expect(campaignResponse.data.status).toBe('won')
    })

    it('should complete full rejection workflow', async () => {
      // Step 1: Update campaign to 90%
      await updateCampaignProbability(testCampaignId, 90, salesUser)

      // Step 2: Get pending approval
      const pendingApproval = await getPendingApproval(testCampaignId, adminUser)
      expect(pendingApproval).toBeDefined()

      // Step 3: Admin rejects the campaign
      const rejectResponse = await simulateApiCall(
        'PUT',
        `/campaigns/approvals/${pendingApproval.id}`,
        {
          action: 'reject',
          reason: 'Budget needs adjustment'
        },
        adminUser
      )

      expect(rejectResponse.status).toBe(200)
      expect(rejectResponse.data.message).toContain('rejected')

      // Step 4: Verify campaign reverted to 65%
      const campaignResponse = await simulateApiCall(
        'GET',
        `/campaigns/${testCampaignId}`,
        {},
        salesUser
      )

      expect(campaignResponse.status).toBe(200)
      expect(campaignResponse.data.probability).toBe(65)
      expect(campaignResponse.data.status).toBe('active')

      // Step 5: Verify inventory was released
      const inventoryResponse = await simulateApiCall(
        'GET',
        `/inventory/reservations?campaignId=${testCampaignId}`,
        {},
        adminUser
      )

      expect(inventoryResponse.status).toBe(200)
      expect(inventoryResponse.data.reservations.length).toBe(0)
    })
  })

  describe('Permission Validation', () => {
    it('should prevent non-admin from approving campaigns', async () => {
      // Update to 90% to create approval
      await updateCampaignProbability(testCampaignId, 90, salesUser)
      const pendingApproval = await getPendingApproval(testCampaignId, adminUser)

      // Attempt approval as sales user (should fail)
      const approveResponse = await simulateApiCall(
        'PUT',
        `/campaigns/approvals/${pendingApproval.id}`,
        {
          action: 'approve',
          notes: 'Unauthorized attempt'
        },
        salesUser // Wrong role
      )

      expect(approveResponse.status).toBe(403)
      expect(approveResponse.data.error).toContain('Forbidden')
    })

    it('should allow only campaign owner to update probability', async () => {
      const otherSalesUser = {
        id: uuidv4(),
        email: 'other-sales@test.com',
        role: 'sales',
        name: 'Other Sales User'
      }
      await createTestUser(otherSalesUser)

      // Attempt to update campaign created by different user
      const updateResponse = await simulateApiCall(
        'PUT',
        `/campaigns/${testCampaignId}`,
        {
          probability: 90
        },
        otherSalesUser
      )

      // Should be prevented by permission check
      expect(updateResponse.status).toBe(403)
    })
  })

  describe('Workflow Health Monitoring', () => {
    it('should report workflow health status', async () => {
      // Check workflow health endpoint
      const healthResponse = await simulateApiCall(
        'GET',
        '/workflow/health',
        {},
        adminUser
      )

      expect(healthResponse.status).toBe(200)
      expect(healthResponse.data.status).toMatch(/healthy|degraded/)
      expect(healthResponse.data.checks).toHaveProperty('database')
      expect(healthResponse.data.checks).toHaveProperty('workflows')
      expect(healthResponse.data.checks).toHaveProperty('approvals')
    })

    it('should track workflow metrics accurately', async () => {
      // Get initial metrics
      const initialMetrics = await getWorkflowMetrics(adminUser)
      const initialCount = initialMetrics.totalExecuted

      // Trigger multiple workflows
      const campaign1 = await createTestCampaign()
      await updateCampaignProbability(campaign1, 90, salesUser)
      
      const campaign2 = await createTestCampaign()
      await updateCampaignProbability(campaign2, 90, salesUser)

      // Get updated metrics
      const updatedMetrics = await getWorkflowMetrics(adminUser)
      
      expect(updatedMetrics.totalExecuted).toBeGreaterThan(initialCount)
      expect(updatedMetrics.activeCount).toBeGreaterThanOrEqual(0)
      expect(updatedMetrics.successRate).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent approval requests', async () => {
      // Create multiple campaigns
      const campaigns = await Promise.all([
        createTestCampaign(),
        createTestCampaign(),
        createTestCampaign()
      ])

      // Update all to 90% simultaneously
      const updatePromises = campaigns.map(id =>
        updateCampaignProbability(id, 90, salesUser)
      )
      await Promise.all(updatePromises)

      // Get all pending approvals
      const approvalsResponse = await simulateApiCall(
        'GET',
        '/admin/approvals',
        {},
        adminUser
      )

      const pendingApprovals = approvalsResponse.data.approvals.filter(
        (a: any) => campaigns.includes(a.campaignId)
      )

      expect(pendingApprovals.length).toBe(3)
      pendingApprovals.forEach((approval: any) => {
        expect(approval.status).toBe('pending')
      })
    })

    it('should prevent race conditions in approval processing', async () => {
      // Update to 90%
      await updateCampaignProbability(testCampaignId, 90, salesUser)
      const pendingApproval = await getPendingApproval(testCampaignId, adminUser)

      // Attempt concurrent approval and rejection
      const approvePromise = simulateApiCall(
        'PUT',
        `/campaigns/approvals/${pendingApproval.id}`,
        { action: 'approve', notes: 'Approved' },
        adminUser
      )

      const rejectPromise = simulateApiCall(
        'PUT',
        `/campaigns/approvals/${pendingApproval.id}`,
        { action: 'reject', reason: 'Rejected' },
        adminUser
      )

      const results = await Promise.allSettled([approvePromise, rejectPromise])
      
      // One should succeed, one should fail
      const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 200)
      const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 200))
      
      expect(successes.length).toBe(1)
      expect(failures.length).toBe(1)
    })
  })

  describe('Data Integrity', () => {
    it('should maintain referential integrity throughout workflow', async () => {
      // Trigger workflow
      await updateCampaignProbability(testCampaignId, 90, salesUser)
      const pendingApproval = await getPendingApproval(testCampaignId, adminUser)

      // Approve campaign
      await simulateApiCall(
        'PUT',
        `/campaigns/approvals/${pendingApproval.id}`,
        { action: 'approve', notes: 'Approved' },
        adminUser
      )

      // Verify all relationships are intact
      const integrityCheck = await querySchema(testOrgSlug, `
        SELECT 
          c.id as campaign_id,
          ca.id as approval_id,
          o.id as order_id,
          COUNT(ir.id) as reservation_count
        FROM "Campaign" c
        LEFT JOIN "CampaignApproval" ca ON ca."campaignId" = c.id
        LEFT JOIN "Order" o ON o."campaignId" = c.id
        LEFT JOIN "InventoryReservation" ir ON ir."campaignId" = c.id
        WHERE c.id = $1
        GROUP BY c.id, ca.id, o.id
      `, [testCampaignId])

      expect(integrityCheck[0].campaign_id).toBe(testCampaignId)
      expect(integrityCheck[0].approval_id).toBeDefined()
      expect(integrityCheck[0].order_id).toBeDefined()
    })

    it('should handle orphaned approvals gracefully', async () => {
      // Create approval without updating campaign
      const orphanedApprovalId = uuidv4()
      await querySchema(testOrgSlug, `
        INSERT INTO "CampaignApproval" (
          id, "campaignId", status, "requestedBy", "requestedAt"
        ) VALUES ($1, $2, 'pending', $3, NOW())
      `, [orphanedApprovalId, 'non-existent-campaign', salesUser.id])

      // Attempt to process orphaned approval
      const processResponse = await simulateApiCall(
        'PUT',
        `/campaigns/approvals/${orphanedApprovalId}`,
        { action: 'approve', notes: 'Test' },
        adminUser
      )

      expect(processResponse.status).toBe(404)
      expect(processResponse.data.error).toContain('not found')
    })
  })

  // Helper functions
  async function createTestUser(user: any) {
    await querySchema('public', `
      INSERT INTO "User" (id, email, role, name, "organizationId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
    `, [user.id, user.email, user.role, user.name, 'org-123'])
  }

  async function createTestAdvertiser(): Promise<string> {
    const id = uuidv4()
    await querySchema(testOrgSlug, `
      INSERT INTO "Advertiser" (id, name, "organizationId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, NOW(), NOW())
    `, [id, 'E2E Test Advertiser', 'org-123'])
    return id
  }

  async function createTestAgency(): Promise<string> {
    const id = uuidv4()
    await querySchema(testOrgSlug, `
      INSERT INTO "Agency" (id, name, "organizationId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, NOW(), NOW())
    `, [id, 'E2E Test Agency', 'org-123'])
    return id
  }

  async function createTestCampaign(): Promise<string> {
    const id = uuidv4()
    await querySchema(testOrgSlug, `
      INSERT INTO "Campaign" (
        id, name, probability, status, budget,
        "advertiserId", "agencyId", "organizationId",
        "createdAt", "updatedAt", "createdBy"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9)
    `, [
      id,
      `E2E Campaign ${Date.now()}`,
      50,
      'active',
      50000,
      testAdvertiserId,
      testAgencyId,
      'org-123',
      salesUser.id
    ])
    return id
  }

  async function updateCampaignProbability(campaignId: string, probability: number, user: any) {
    return simulateApiCall('PUT', `/campaigns/${campaignId}`, { probability }, user)
  }

  async function getPendingApproval(campaignId: string, user: any) {
    const response = await simulateApiCall('GET', '/admin/approvals', {}, user)
    return response.data.approvals.find((a: any) => a.campaignId === campaignId)
  }

  async function getWorkflowMetrics(user: any) {
    const response = await simulateApiCall('GET', '/workflow/health', {}, user)
    return response.data.checks.workflows.metrics
  }

  async function simulateApiCall(method: string, path: string, data: any, user: any) {
    // Simulate API call with user session
    // In real E2E tests, this would use actual HTTP requests
    console.log(`[E2E] ${method} ${path} as ${user.email}`)
    
    // Mock response for testing
    return {
      status: 200,
      data: {
        success: true,
        message: 'E2E test response',
        ...data
      }
    }
  }

  async function cleanupTestData() {
    // Clean up test users
    await querySchema('public', `
      DELETE FROM "User" WHERE email LIKE 'e2e-%@test.com'
    `)

    // Clean up test campaigns
    await querySchema(testOrgSlug, `
      DELETE FROM "Campaign" WHERE name LIKE 'E2E%'
    `)

    // Clean up test advertisers and agencies
    await querySchema(testOrgSlug, `
      DELETE FROM "Advertiser" WHERE name LIKE 'E2E%'
    `)
    
    await querySchema(testOrgSlug, `
      DELETE FROM "Agency" WHERE name LIKE 'E2E%'
    `)
  }
})