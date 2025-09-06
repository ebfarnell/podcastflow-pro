import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { querySchema } from '@/lib/db/schema-db'
import { CampaignWorkflowService } from '@/lib/workflow/campaign-workflow-service'
import { v4 as uuidv4 } from 'uuid'

/**
 * Integration tests for 90% campaign automation workflow
 * Tests the complete flow from probability change to approval/rejection
 */
describe('90% Campaign Workflow Integration', () => {
  const testOrgSlug = 'org_test_workflow'
  const service = new CampaignWorkflowService()
  
  let testCampaignId: string
  let testUserId: string
  let testAdvertiserId: string
  let testAgencyId: string
  let testShowId: string

  beforeAll(async () => {
    // Setup test data in test schema
    testUserId = uuidv4()
    testAdvertiserId = uuidv4()
    testAgencyId = uuidv4()
    testShowId = uuidv4()
    testCampaignId = uuidv4()

    // Create test organization schema
    await querySchema('public', `
      CREATE SCHEMA IF NOT EXISTS ${testOrgSlug}
    `)

    // Create necessary tables in test schema
    await setupTestSchema(testOrgSlug)

    // Insert test data
    await insertTestData()
  })

  afterAll(async () => {
    // Cleanup test schema
    await querySchema('public', `
      DROP SCHEMA IF EXISTS ${testOrgSlug} CASCADE
    `)
  })

  beforeEach(async () => {
    // Reset campaign state before each test
    await querySchema(testOrgSlug, `
      UPDATE "Campaign" 
      SET probability = 50, 
          "reservationId" = NULL,
          "approvalRequestId" = NULL,
          status = 'active'
      WHERE id = $1
    `, [testCampaignId])

    // Clear any existing approvals
    await querySchema(testOrgSlug, `
      DELETE FROM "CampaignApproval" 
      WHERE "campaignId" = $1
    `, [testCampaignId])
  })

  describe('Probability Change Trigger', () => {
    it('should trigger workflow when probability reaches 90%', async () => {
      // Update campaign to 90%
      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50, // old probability
        90, // new probability
        testUserId
      )

      expect(result.triggered).toBe(true)
      expect(result.approvalRequestId).toBeDefined()

      // Verify approval request was created
      const approvals = await querySchema(testOrgSlug, `
        SELECT * FROM "CampaignApproval" 
        WHERE "campaignId" = $1
      `, [testCampaignId])

      expect(approvals.length).toBe(1)
      expect(approvals[0].status).toBe('pending')
      expect(approvals[0].requestedBy).toBe(testUserId)
    })

    it('should not trigger for probability below 90%', async () => {
      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        75, // Below threshold
        testUserId
      )

      expect(result.triggered).toBe(false)

      // Verify no approval created
      const approvals = await querySchema(testOrgSlug, `
        SELECT * FROM "CampaignApproval" 
        WHERE "campaignId" = $1
      `, [testCampaignId])

      expect(approvals.length).toBe(0)
    })

    it('should not duplicate approval requests', async () => {
      // First trigger
      await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        90,
        testUserId
      )

      // Attempt second trigger
      const result = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        90,
        95, // Still above 90
        testUserId
      )

      expect(result.triggered).toBe(false)
      expect(result.reason).toContain('already has approval')

      // Verify only one approval exists
      const approvals = await querySchema(testOrgSlug, `
        SELECT * FROM "CampaignApproval" 
        WHERE "campaignId" = $1
      `, [testCampaignId])

      expect(approvals.length).toBe(1)
    })
  })

  describe('Inventory Reservation', () => {
    it('should create inventory reservations at 90%', async () => {
      // Trigger workflow
      await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        90,
        testUserId
      )

      // Check for inventory reservations
      const reservations = await querySchema(testOrgSlug, `
        SELECT ir.*, s.name as show_name
        FROM "InventoryReservation" ir
        JOIN "Episode" e ON e.id = ir."episodeId"
        JOIN "Show" s ON s.id = e."showId"
        WHERE ir."campaignId" = $1
      `, [testCampaignId])

      expect(reservations.length).toBeGreaterThan(0)
      expect(reservations[0].status).toBe('reserved')
    })

    it('should release inventory on rejection', async () => {
      // First trigger workflow
      const triggerResult = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        90,
        testUserId
      )

      // Process rejection
      const rejectResult = await service.processApproval(
        testOrgSlug,
        triggerResult.approvalRequestId!,
        'reject',
        testUserId,
        'Budget constraints'
      )

      expect(rejectResult.success).toBe(true)

      // Verify inventory was released
      const reservations = await querySchema(testOrgSlug, `
        SELECT * FROM "InventoryReservation" 
        WHERE "campaignId" = $1
      `, [testCampaignId])

      expect(reservations.length).toBe(0)
    })
  })

  describe('Approval Processing', () => {
    it('should move campaign to Order on approval', async () => {
      // Trigger workflow
      const triggerResult = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        90,
        testUserId
      )

      // Process approval
      const approvalResult = await service.processApproval(
        testOrgSlug,
        triggerResult.approvalRequestId!,
        'approve',
        testUserId,
        'Ready for production'
      )

      expect(approvalResult.success).toBe(true)
      expect(approvalResult.orderId).toBeDefined()

      // Verify campaign status
      const campaigns = await querySchema(testOrgSlug, `
        SELECT * FROM "Campaign" WHERE id = $1
      `, [testCampaignId])

      expect(campaigns[0].probability).toBe(100)
      expect(campaigns[0].status).toBe('won')

      // Verify order was created
      const orders = await querySchema(testOrgSlug, `
        SELECT * FROM "Order" WHERE "campaignId" = $1
      `, [testCampaignId])

      expect(orders.length).toBe(1)
      expect(orders[0].status).toBe('active')
    })

    it('should revert campaign to 65% on rejection', async () => {
      // Trigger workflow
      const triggerResult = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        90,
        testUserId
      )

      // Process rejection
      const rejectResult = await service.processApproval(
        testOrgSlug,
        triggerResult.approvalRequestId!,
        'reject',
        testUserId,
        'Needs more work'
      )

      expect(rejectResult.success).toBe(true)

      // Verify campaign reverted
      const campaigns = await querySchema(testOrgSlug, `
        SELECT * FROM "Campaign" WHERE id = $1
      `, [testCampaignId])

      expect(campaigns[0].probability).toBe(65)
      expect(campaigns[0].status).toBe('active')
      expect(campaigns[0].reservationId).toBeNull()
      expect(campaigns[0].approvalRequestId).toBeNull()
    })

    it('should update approval status correctly', async () => {
      // Trigger workflow
      const triggerResult = await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        90,
        testUserId
      )

      // Process approval
      await service.processApproval(
        testOrgSlug,
        triggerResult.approvalRequestId!,
        'approve',
        testUserId,
        'Approved notes'
      )

      // Check approval record
      const approvals = await querySchema(testOrgSlug, `
        SELECT * FROM "CampaignApproval" WHERE id = $1
      `, [triggerResult.approvalRequestId])

      expect(approvals[0].status).toBe('approved')
      expect(approvals[0].approvedBy).toBe(testUserId)
      expect(approvals[0].approvedAt).toBeDefined()
      expect(approvals[0].approvalNotes).toBe('Approved notes')
    })
  })

  describe('Multi-tenant Isolation', () => {
    it('should not affect campaigns in other organizations', async () => {
      const otherOrgSlug = 'org_other_test'
      
      // Create another test org
      await querySchema('public', `
        CREATE SCHEMA IF NOT EXISTS ${otherOrgSlug}
      `)
      await setupTestSchema(otherOrgSlug)

      // Create campaign in other org
      const otherCampaignId = uuidv4()
      await querySchema(otherOrgSlug, `
        INSERT INTO "Campaign" (
          id, name, probability, status, 
          "organizationId", "createdAt", "updatedAt"
        ) VALUES ($1, $2, 50, 'active', $3, NOW(), NOW())
      `, [otherCampaignId, 'Other Org Campaign', 'other-org'])

      // Trigger workflow in first org
      await service.handleProbabilityChange(
        testOrgSlug,
        testCampaignId,
        50,
        90,
        testUserId
      )

      // Verify other org campaign unaffected
      const otherCampaigns = await querySchema(otherOrgSlug, `
        SELECT * FROM "Campaign" WHERE id = $1
      `, [otherCampaignId])

      expect(otherCampaigns[0].probability).toBe(50)

      // Cleanup
      await querySchema('public', `
        DROP SCHEMA IF EXISTS ${otherOrgSlug} CASCADE
      `)
    })
  })

  describe('Error Recovery', () => {
    it('should handle missing campaign gracefully', async () => {
      const result = await service.handleProbabilityChange(
        testOrgSlug,
        'non-existent-campaign',
        50,
        90,
        testUserId
      )

      expect(result.triggered).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should handle missing approval gracefully', async () => {
      const result = await service.processApproval(
        testOrgSlug,
        'non-existent-approval',
        'approve',
        testUserId
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should rollback on partial failure', async () => {
      // Create campaign with invalid advertiser reference
      const badCampaignId = uuidv4()
      await querySchema(testOrgSlug, `
        INSERT INTO "Campaign" (
          id, name, probability, status,
          "advertiserId", "organizationId",
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, 50, 'active', $3, $4, NOW(), NOW())
      `, [badCampaignId, 'Bad Campaign', 'invalid-advertiser', 'test-org'])

      // Attempt to trigger workflow
      const result = await service.handleProbabilityChange(
        testOrgSlug,
        badCampaignId,
        50,
        90,
        testUserId
      )

      // Should handle error gracefully
      expect(result.triggered).toBe(false)

      // Verify no partial data created
      const approvals = await querySchema(testOrgSlug, `
        SELECT * FROM "CampaignApproval" 
        WHERE "campaignId" = $1
      `, [badCampaignId])

      expect(approvals.length).toBe(0)
    })
  })

  // Helper functions
  async function setupTestSchema(schemaName: string) {
    // Create minimal tables needed for testing
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS ${schemaName}."Campaign" (
        id TEXT PRIMARY KEY,
        name TEXT,
        probability INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        "reservationId" TEXT,
        "approvalRequestId" TEXT,
        budget DECIMAL,
        "advertiserId" TEXT,
        "agencyId" TEXT,
        "organizationId" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        "createdBy" TEXT,
        "updatedBy" TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS ${schemaName}."CampaignApproval" (
        id TEXT PRIMARY KEY,
        "campaignId" TEXT,
        status TEXT DEFAULT 'pending',
        "requestedBy" TEXT,
        "requestedAt" TIMESTAMP DEFAULT NOW(),
        "approvedBy" TEXT,
        "approvedAt" TIMESTAMP,
        "rejectedBy" TEXT,
        "rejectedAt" TIMESTAMP,
        "approvalNotes" TEXT,
        "rejectionReason" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS ${schemaName}."Order" (
        id TEXT PRIMARY KEY,
        "orderNumber" TEXT,
        "campaignId" TEXT,
        "advertiserId" TEXT,
        "agencyId" TEXT,
        "totalAmount" DECIMAL,
        "netAmount" DECIMAL,
        status TEXT,
        "submittedAt" TIMESTAMP,
        "submittedBy" TEXT,
        "approvedAt" TIMESTAMP,
        "approvedBy" TEXT,
        "organizationId" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        "createdBy" TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS ${schemaName}."Show" (
        id TEXT PRIMARY KEY,
        name TEXT,
        "defaultRate" DECIMAL DEFAULT 1000,
        "organizationId" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS ${schemaName}."Episode" (
        id TEXT PRIMARY KEY,
        "showId" TEXT,
        title TEXT,
        "airDate" DATE,
        "organizationId" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS ${schemaName}."InventoryReservation" (
        id TEXT PRIMARY KEY,
        "campaignId" TEXT,
        "scheduleId" TEXT,
        "episodeId" TEXT,
        "spotType" TEXT,
        rate DECIMAL,
        status TEXT DEFAULT 'reserved',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS ${schemaName}."Advertiser" (
        id TEXT PRIMARY KEY,
        name TEXT,
        "organizationId" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS ${schemaName}."Agency" (
        id TEXT PRIMARY KEY,
        name TEXT,
        "organizationId" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`
    ]

    for (const query of tableQueries) {
      await querySchema('public', query)
    }
  }

  async function insertTestData() {
    // Insert test advertiser
    await querySchema(testOrgSlug, `
      INSERT INTO "Advertiser" (id, name, "organizationId")
      VALUES ($1, $2, $3)
    `, [testAdvertiserId, 'Test Advertiser', 'test-org'])

    // Insert test agency
    await querySchema(testOrgSlug, `
      INSERT INTO "Agency" (id, name, "organizationId")
      VALUES ($1, $2, $3)
    `, [testAgencyId, 'Test Agency', 'test-org'])

    // Insert test show
    await querySchema(testOrgSlug, `
      INSERT INTO "Show" (id, name, "defaultRate", "organizationId")
      VALUES ($1, $2, $3, $4)
    `, [testShowId, 'Test Show', 1000, 'test-org'])

    // Insert test episodes
    const episodeIds = [uuidv4(), uuidv4(), uuidv4()]
    for (let i = 0; i < episodeIds.length; i++) {
      await querySchema(testOrgSlug, `
        INSERT INTO "Episode" (
          id, "showId", title, "airDate", "organizationId"
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        episodeIds[i],
        testShowId,
        `Test Episode ${i + 1}`,
        new Date(2025, 1, i + 1).toISOString(),
        'test-org'
      ])
    }

    // Insert test campaign
    await querySchema(testOrgSlug, `
      INSERT INTO "Campaign" (
        id, name, probability, status, budget,
        "advertiserId", "agencyId", "organizationId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      testCampaignId,
      'Test Campaign',
      50,
      'active',
      10000,
      testAdvertiserId,
      testAgencyId,
      'test-org'
    ])
  }
})