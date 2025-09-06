/**
 * Multi-Tenant Isolation Test Suite
 * 
 * This test suite verifies that tenant data isolation is properly enforced
 * throughout the PodcastFlow Pro application.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { querySchema, getSchemaModels } from '@/lib/db/schema-db'
import { UserService } from '@/lib/auth/user-service'
import { testApi } from './test-utils'

// Test organizations
const ORG_1 = {
  id: 'test-org-1',
  slug: 'org_test_1',
  name: 'Test Organization 1'
}

const ORG_2 = {
  id: 'test-org-2', 
  slug: 'org_test_2',
  name: 'Test Organization 2'
}

// Test users for each organization
const USER_ORG_1 = {
  id: 'test-user-1',
  email: 'user1@org1.com',
  organizationId: ORG_1.id,
  role: 'admin'
}

const USER_ORG_2 = {
  id: 'test-user-2',
  email: 'user2@org2.com', 
  organizationId: ORG_2.id,
  role: 'admin'
}

const MASTER_USER = {
  id: 'test-master',
  email: 'master@podcastflow.pro',
  role: 'master'
}

describe('Multi-Tenant Data Isolation', () => {
  let prisma: PrismaClient
  let org1Token: string
  let org2Token: string
  let masterToken: string

  beforeAll(async () => {
    prisma = new PrismaClient()
    
    // Create test organizations and users
    // Note: In real tests, use transactions and cleanup
    
    // Create auth tokens
    org1Token = await UserService.createSession(USER_ORG_1.id)
    org2Token = await UserService.createSession(USER_ORG_2.id)
    masterToken = await UserService.createSession(MASTER_USER.id)
  })

  afterAll(async () => {
    // Cleanup test data
    await prisma.$disconnect()
  })

  describe('Schema Isolation', () => {
    test('Organization 1 cannot query Organization 2 schema', async () => {
      // Attempt to query Org 2's schema with Org 1's context
      await expect(async () => {
        await querySchema(ORG_2.slug, 'SELECT * FROM "Campaign"', [], {
          userId: USER_ORG_1.id,
          organizationId: ORG_1.id
        })
      }).rejects.toThrow('Access denied')
    })

    test('Each organization sees only their own campaigns', async () => {
      // Create test campaigns in each org's schema
      const org1Campaigns = await querySchema(
        ORG_1.slug,
        'SELECT COUNT(*) as count FROM "Campaign"',
        []
      )
      
      const org2Campaigns = await querySchema(
        ORG_2.slug,
        'SELECT COUNT(*) as count FROM "Campaign"',
        []
      )
      
      // Verify isolation
      expect(org1Campaigns).not.toEqual(org2Campaigns)
    })
  })

  describe('API Route Isolation', () => {
    test('GET /api/campaigns returns only organization-specific campaigns', async () => {
      // Org 1 request
      const org1Response = await testApi({
        method: 'GET',
        path: '/api/campaigns',
        token: org1Token
      })
      
      // Org 2 request
      const org2Response = await testApi({
        method: 'GET',
        path: '/api/campaigns',
        token: org2Token
      })
      
      // Verify no overlap in campaign IDs
      const org1Ids = org1Response.data.map((c: any) => c.id)
      const org2Ids = org2Response.data.map((c: any) => c.id)
      const overlap = org1Ids.filter((id: string) => org2Ids.includes(id))
      
      expect(overlap).toHaveLength(0)
    })

    test('POST /api/campaigns creates in correct organization schema', async () => {
      const campaignData = {
        name: 'Test Campaign',
        budget: 10000
      }
      
      // Create campaign as Org 1
      const response = await testApi({
        method: 'POST',
        path: '/api/campaigns',
        token: org1Token,
        body: campaignData
      })
      
      // Verify it exists only in Org 1's schema
      const org1Count = await querySchema(
        ORG_1.slug,
        'SELECT COUNT(*) as count FROM "Campaign" WHERE name = $1',
        ['Test Campaign']
      )
      
      const org2Count = await querySchema(
        ORG_2.slug,
        'SELECT COUNT(*) as count FROM "Campaign" WHERE name = $1',
        ['Test Campaign']
      )
      
      expect(org1Count[0].count).toBe(1)
      expect(org2Count[0].count).toBe(0)
    })

    test('PUT /api/campaigns/:id cannot update cross-organization', async () => {
      // Get a campaign from Org 1
      const campaigns = await querySchema(
        ORG_1.slug,
        'SELECT id FROM "Campaign" LIMIT 1',
        []
      )
      const campaignId = campaigns[0]?.id
      
      if (campaignId) {
        // Try to update as Org 2 user
        const response = await testApi({
          method: 'PUT',
          path: `/api/campaigns/${campaignId}`,
          token: org2Token,
          body: { name: 'Hacked Campaign' }
        })
        
        expect(response.status).toBe(404) // Should not find the campaign
      }
    })

    test('DELETE /api/campaigns/:id cannot delete cross-organization', async () => {
      // Similar to PUT test
      const campaigns = await querySchema(
        ORG_1.slug,
        'SELECT id FROM "Campaign" LIMIT 1',
        []
      )
      const campaignId = campaigns[0]?.id
      
      if (campaignId) {
        const response = await testApi({
          method: 'DELETE',
          path: `/api/campaigns/${campaignId}`,
          token: org2Token
        })
        
        expect(response.status).toBe(404)
      }
    })
  })

  describe('Master Account Access', () => {
    test('Master can read from all organization schemas', async () => {
      // Master should be able to query both schemas
      const org1Data = await querySchema(
        ORG_1.slug,
        'SELECT COUNT(*) as count FROM "Campaign"',
        [],
        { userId: MASTER_USER.id, role: 'master' }
      )
      
      const org2Data = await querySchema(
        ORG_2.slug,
        'SELECT COUNT(*) as count FROM "Campaign"',
        [],
        { userId: MASTER_USER.id, role: 'master' }
      )
      
      expect(org1Data).toBeDefined()
      expect(org2Data).toBeDefined()
    })

    test('Master API requests are logged for audit', async () => {
      // Make a cross-org request as master
      await testApi({
        method: 'GET',
        path: '/api/campaigns',
        token: masterToken,
        headers: { 'X-Target-Org': ORG_1.id }
      })
      
      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          userId: MASTER_USER.id,
          action: 'CROSS_ORG_ACCESS'
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      })
      
      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].targetOrganizationId).toBe(ORG_1.id)
    })
  })

  describe('File Storage Isolation', () => {
    test('File uploads include organization path', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      
      const response = await testApi({
        method: 'POST',
        path: '/api/upload/documents',
        token: org1Token,
        formData: { file }
      })
      
      // Verify file path includes organization
      expect(response.data.path).toMatch(/org_test_1/)
    })

    test('Cannot access files from other organizations', async () => {
      // Upload file as Org 1
      const file = new File(['sensitive data'], 'secret.pdf', { type: 'application/pdf' })
      const uploadResponse = await testApi({
        method: 'POST',
        path: '/api/upload/documents',
        token: org1Token,
        formData: { file }
      })
      
      const fileId = uploadResponse.data.id
      
      // Try to access as Org 2
      const accessResponse = await testApi({
        method: 'GET',
        path: `/api/files/${fileId}`,
        token: org2Token
      })
      
      expect(accessResponse.status).toBe(404)
    })
  })

  describe('Bulk Operations', () => {
    test('Bulk delete only affects organization data', async () => {
      // Create test campaigns in both orgs
      await querySchema(
        ORG_1.slug,
        'INSERT INTO "Campaign" (id, name, budget) VALUES ($1, $2, $3)',
        ['bulk-test-1', 'Bulk Test 1', 1000]
      )
      
      await querySchema(
        ORG_2.slug,
        'INSERT INTO "Campaign" (id, name, budget) VALUES ($1, $2, $3)',
        ['bulk-test-2', 'Bulk Test 2', 2000]
      )
      
      // Bulk delete as Org 1
      await testApi({
        method: 'DELETE',
        path: '/api/campaigns/bulk',
        token: org1Token,
        body: { ids: ['bulk-test-1', 'bulk-test-2'] }
      })
      
      // Verify only Org 1's campaign was deleted
      const org1Count = await querySchema(
        ORG_1.slug,
        'SELECT COUNT(*) as count FROM "Campaign" WHERE id = $1',
        ['bulk-test-1']
      )
      
      const org2Count = await querySchema(
        ORG_2.slug,
        'SELECT COUNT(*) as count FROM "Campaign" WHERE id = $1',
        ['bulk-test-2']
      )
      
      expect(org1Count[0].count).toBe(0) // Deleted
      expect(org2Count[0].count).toBe(1) // Still exists
    })
  })

  describe('Search and Filtering', () => {
    test('Global search only returns organization data', async () => {
      // Search across all entities
      const response = await testApi({
        method: 'GET',
        path: '/api/search?q=test',
        token: org1Token
      })
      
      // Verify all results belong to Org 1
      const results = response.data
      for (const result of results) {
        if (result.organizationId) {
          expect(result.organizationId).toBe(ORG_1.id)
        }
      }
    })
  })

  describe('Reporting and Analytics', () => {
    test('Analytics aggregations are organization-scoped', async () => {
      const response = await testApi({
        method: 'GET',
        path: '/api/analytics/revenue',
        token: org1Token
      })
      
      // Verify data doesn't include other orgs
      expect(response.data.organizationId).toBe(ORG_1.id)
      expect(response.data.totalRevenue).toBeGreaterThanOrEqual(0)
    })

    test('Export functions only export organization data', async () => {
      const response = await testApi({
        method: 'POST',
        path: '/api/organizations/export',
        token: org1Token
      })
      
      const exportData = response.data
      
      // Verify export only contains Org 1 data
      expect(exportData.organization.id).toBe(ORG_1.id)
      expect(exportData.campaigns.every((c: any) => 
        c.organizationId === ORG_1.id
      )).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('Errors do not leak cross-tenant information', async () => {
      // Try to access non-existent resource
      const response = await testApi({
        method: 'GET',
        path: '/api/campaigns/non-existent-id',
        token: org1Token
      })
      
      // Error should be generic
      expect(response.status).toBe(404)
      expect(response.data.error).toBe('Campaign not found')
      // Should not reveal if ID exists in another org
      expect(response.data.error).not.toMatch(/organization/i)
    })
  })
})

/**
 * Test utility functions
 */
export async function testApi(options: {
  method: string
  path: string
  token: string
  body?: any
  formData?: any
  headers?: Record<string, string>
}) {
  // Implementation would make actual HTTP requests
  // This is a placeholder for the test structure
  return {
    status: 200,
    data: {}
  }
}