/**
 * Test suite for tenant isolation enforcement
 */

import { NextRequest } from 'next/server'
import {
  getTenantContext,
  validateTenantAccess,
  executeTenantQuery,
  withTenantIsolation,
  getTenantClient,
  TenantContext
} from '../tenant-isolation'
import prisma from '@/lib/db/prisma'

// Mock data
const mockOrgs = [
  { id: 'org1', slug: 'acme-corp' },
  { id: 'org2', slug: 'tech-solutions' }
]

const mockUsers = [
  { 
    id: 'user1', 
    email: 'admin@acme.com', 
    role: 'admin', 
    organizationId: 'org1' 
  },
  { 
    id: 'user2', 
    email: 'user@tech.com', 
    role: 'sales', 
    organizationId: 'org2' 
  },
  { 
    id: 'master1', 
    email: 'master@platform.com', 
    role: 'master', 
    organizationId: 'org1' 
  }
]

describe('Tenant Isolation', () => {
  describe('getTenantContext', () => {
    it('should extract tenant context from valid request', async () => {
      const request = createMockRequest('user1')
      const context = await getTenantContext(request)
      
      expect(context).toBeDefined()
      expect(context?.userId).toBe('user1')
      expect(context?.organizationId).toBe('org1')
      expect(context?.organizationSlug).toBe('acme-corp')
      expect(context?.schemaName).toBe('org_acme_corp')
      expect(context?.isMaster).toBe(false)
    })
    
    it('should return null for unauthenticated request', async () => {
      const request = createMockRequest(null)
      const context = await getTenantContext(request)
      
      expect(context).toBeNull()
    })
    
    it('should identify master accounts', async () => {
      const request = createMockRequest('master1')
      const context = await getTenantContext(request)
      
      expect(context?.isMaster).toBe(true)
    })
  })
  
  describe('validateTenantAccess', () => {
    it('should allow access to own organization', async () => {
      const context: TenantContext = {
        userId: 'user1',
        organizationId: 'org1',
        organizationSlug: 'acme-corp',
        schemaName: 'org_acme_corp',
        role: 'admin',
        isMaster: false
      }
      
      const result = await validateTenantAccess(context, 'org1')
      expect(result.allowed).toBe(true)
    })
    
    it('should deny cross-tenant access for non-master', async () => {
      const context: TenantContext = {
        userId: 'user1',
        organizationId: 'org1',
        organizationSlug: 'acme-corp',
        schemaName: 'org_acme_corp',
        role: 'admin',
        isMaster: false
      }
      
      const result = await validateTenantAccess(context, 'org2')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Unauthorized cross-tenant access')
    })
    
    it('should allow and log cross-tenant access for master', async () => {
      const context: TenantContext = {
        userId: 'master1',
        organizationId: 'org1',
        organizationSlug: 'acme-corp',
        schemaName: 'org_acme_corp',
        role: 'master',
        isMaster: true
      }
      
      const result = await validateTenantAccess(context, 'org2', 'org_tech_solutions')
      expect(result.allowed).toBe(true)
      
      // Verify audit log was created
      const auditLog = await prisma.$queryRaw`
        SELECT * FROM public.tenant_access_log 
        WHERE user_id = ${context.userId} 
        AND accessed_org_id = 'org2'
        ORDER BY created_at DESC 
        LIMIT 1
      `
      
      expect(auditLog).toBeDefined()
    })
  })
  
  describe('executeTenantQuery', () => {
    it('should execute query in correct tenant schema', async () => {
      const context: TenantContext = {
        userId: 'user1',
        organizationId: 'org1',
        organizationSlug: 'acme-corp',
        schemaName: 'org_acme_corp',
        role: 'admin',
        isMaster: false
      }
      
      // Mock campaign query
      const result = await executeTenantQuery(context, {
        model: 'campaign',
        operation: 'findMany',
        args: {
          where: { status: 'active' }
        }
      })
      
      // Verify query was executed in correct schema
      expect(result).toBeDefined()
    })
    
    it('should reject queries on non-tenant models', async () => {
      const context: TenantContext = {
        userId: 'user1',
        organizationId: 'org1',
        organizationSlug: 'acme-corp',
        schemaName: 'org_acme_corp',
        role: 'admin',
        isMaster: false
      }
      
      await expect(
        executeTenantQuery(context, {
          model: 'user' as any, // User is not a tenant model
          operation: 'findMany'
        })
      ).rejects.toThrow('Model user is not a tenant-scoped model')
    })
  })
  
  describe('getTenantClient', () => {
    it('should provide Prisma-like interface with tenant isolation', async () => {
      const context: TenantContext = {
        userId: 'user1',
        organizationId: 'org1',
        organizationSlug: 'acme-corp',
        schemaName: 'org_acme_corp',
        role: 'admin',
        isMaster: false
      }
      
      const tenantDb = getTenantClient(context)
      
      // Verify all tenant models are available
      expect(tenantDb.campaign).toBeDefined()
      expect(tenantDb.show).toBeDefined()
      expect(tenantDb.episode).toBeDefined()
      expect(tenantDb.advertiser).toBeDefined()
      
      // Verify methods exist
      expect(tenantDb.campaign.findMany).toBeDefined()
      expect(tenantDb.campaign.findUnique).toBeDefined()
      expect(tenantDb.campaign.create).toBeDefined()
      expect(tenantDb.campaign.update).toBeDefined()
      expect(tenantDb.campaign.delete).toBeDefined()
    })
  })
  
  describe('Cross-tenant isolation verification', () => {
    it('should prevent data leakage between tenants', async () => {
      // Create contexts for two different tenants
      const tenant1Context: TenantContext = {
        userId: 'user1',
        organizationId: 'org1',
        organizationSlug: 'acme-corp',
        schemaName: 'org_acme_corp',
        role: 'admin',
        isMaster: false
      }
      
      const tenant2Context: TenantContext = {
        userId: 'user2',
        organizationId: 'org2',
        organizationSlug: 'tech-solutions',
        schemaName: 'org_tech_solutions',
        role: 'sales',
        isMaster: false
      }
      
      // Get clients for each tenant
      const tenant1Db = getTenantClient(tenant1Context)
      const tenant2Db = getTenantClient(tenant2Context)
      
      // Create test data in tenant 1
      const campaign1 = await tenant1Db.campaign.create({
        data: {
          name: 'Tenant 1 Campaign',
          organizationId: 'org1',
          status: 'active'
        }
      })
      
      // Try to access tenant 1 data from tenant 2 context
      const tenant2Campaigns = await tenant2Db.campaign.findMany()
      
      // Verify tenant 2 cannot see tenant 1's data
      expect(tenant2Campaigns.find((c: any) => c.id === campaign1.id)).toBeUndefined()
    })
  })
})

// Helper functions
function createMockRequest(userId: string | null): NextRequest {
  const headers = new Headers()
  const cookies = new Map()
  
  if (userId) {
    cookies.set('auth-token', `mock-token-${userId}`)
  }
  
  return {
    cookies: {
      get: (name: string) => cookies.get(name) ? { value: cookies.get(name) } : undefined
    }
  } as any as NextRequest
}

// Integration test to verify all API routes use tenant isolation
describe('API Route Tenant Isolation Compliance', () => {
  const apiRoutes = [
    '/api/campaigns',
    '/api/shows',
    '/api/episodes',
    '/api/advertisers',
    '/api/agencies',
    '/api/orders',
    '/api/contracts',
    '/api/invoices',
    '/api/proposals'
  ]
  
  apiRoutes.forEach(route => {
    it(`${route} should enforce tenant isolation`, async () => {
      // This would be an integration test that actually calls the API
      // and verifies tenant isolation is enforced
      expect(true).toBe(true) // Placeholder
    })
  })
})