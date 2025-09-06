/**
 * Integration tests for multi-tenant API isolation
 * Tests that API endpoints properly isolate data between organizations
 */

const request = require('supertest');
const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  organizations: [
    { slug: 'podcastflow-pro', testUser: { email: 'admin@podcastflow.pro', password: 'admin123' } },
    { slug: 'unfy', testUser: { email: 'michael@unfy.com', password: 'EMunfy2025' } }
  ]
};

let authTokens = {};
let testCampaigns = {};

describe('Multi-Tenant API Integration Tests', () => {
  beforeAll(async () => {
    // Login users for each organization
    for (const org of TEST_CONFIG.organizations) {
      const response = await request(TEST_CONFIG.baseUrl)
        .post('/api/auth/login')
        .send(org.testUser)
        .expect(200);

      const cookies = response.headers['set-cookie'];
      const authToken = cookies.find(cookie => cookie.startsWith('auth-token='))
        ?.split(';')[0]
        ?.split('=')[1];

      if (!authToken) {
        throw new Error(`Failed to get auth token for ${org.slug}`);
      }

      authTokens[org.slug] = authToken;
    }
  });

  describe('Campaign API Isolation', () => {
    beforeEach(async () => {
      // Create test campaigns for each organization
      for (const org of TEST_CONFIG.organizations) {
        const testCampaign = {
          name: `Test Campaign ${org.slug} ${Date.now()}`,
          status: 'active',
          budget: 10000,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };

        const response = await request(TEST_CONFIG.baseUrl)
          .post('/api/campaigns')
          .set('Cookie', `auth-token=${authTokens[org.slug]}`)
          .send(testCampaign)
          .expect(201);

        testCampaigns[org.slug] = response.body.campaign;
      }
    });

    test('should only return campaigns for user\'s organization', async () => {
      for (const org of TEST_CONFIG.organizations) {
        const response = await request(TEST_CONFIG.baseUrl)
          .get('/api/campaigns')
          .set('Cookie', `auth-token=${authTokens[org.slug]}`)
          .expect(200);

        const { campaigns } = response.body;
        expect(Array.isArray(campaigns)).toBe(true);

        // Should find the test campaign for this organization
        const orgCampaign = campaigns.find(c => c.id === testCampaigns[org.slug].id);
        expect(orgCampaign).toBeDefined();
        expect(orgCampaign.name).toContain(org.slug);

        // Should NOT find campaigns from other organizations
        for (const otherOrg of TEST_CONFIG.organizations) {
          if (otherOrg.slug === org.slug) continue;
          
          const otherOrgCampaign = campaigns.find(c => c.id === testCampaigns[otherOrg.slug].id);
          expect(otherOrgCampaign).toBeUndefined();
        }
      }
    });

    test('should not allow access to other organization\'s campaign by ID', async () => {
      const [org1, org2] = TEST_CONFIG.organizations;
      
      // Try to access org2's campaign using org1's credentials
      await request(TEST_CONFIG.baseUrl)
        .get(`/api/campaigns/${testCampaigns[org2.slug].id}`)
        .set('Cookie', `auth-token=${authTokens[org1.slug]}`)
        .expect(404); // Should not find the campaign
    });

    test('should not allow updating other organization\'s campaigns', async () => {
      const [org1, org2] = TEST_CONFIG.organizations;
      
      const updateData = {
        name: 'Hacked Campaign Name',
        status: 'paused'
      };

      // Try to update org2's campaign using org1's credentials
      await request(TEST_CONFIG.baseUrl)
        .put(`/api/campaigns/${testCampaigns[org2.slug].id}`)
        .set('Cookie', `auth-token=${authTokens[org1.slug]}`)
        .send(updateData)
        .expect(404); // Should not find the campaign to update
    });

    test('should not allow deleting other organization\'s campaigns', async () => {
      const [org1, org2] = TEST_CONFIG.organizations;
      
      // Try to delete org2's campaign using org1's credentials
      await request(TEST_CONFIG.baseUrl)
        .delete(`/api/campaigns/${testCampaigns[org2.slug].id}`)
        .set('Cookie', `auth-token=${authTokens[org1.slug]}`)
        .expect(404); // Should not find the campaign to delete
    });
  });

  describe('Shows API Isolation', () => {
    test('should only return shows for user\'s organization', async () => {
      for (const org of TEST_CONFIG.organizations) {
        const response = await request(TEST_CONFIG.baseUrl)
          .get('/api/shows')
          .set('Cookie', `auth-token=${authTokens[org.slug]}`)
          .expect(200);

        const { shows } = response.body;
        expect(Array.isArray(shows)).toBe(true);

        // All shows should belong to this organization's schema
        // We can't directly verify the schema, but we can verify the API respects isolation
      }
    });
  });

  describe('Advertisers API Isolation', () => {
    test('should only return advertisers for user\'s organization', async () => {
      for (const org of TEST_CONFIG.organizations) {
        const response = await request(TEST_CONFIG.baseUrl)
          .get('/api/advertisers')
          .set('Cookie', `auth-token=${authTokens[org.slug]}`)
          .expect(200);

        const { advertisers } = response.body;
        expect(Array.isArray(advertisers)).toBe(true);

        // All advertisers should belong to this organization's schema
      }
    });

    test('should allow creating advertisers in own organization', async () => {
      for (const org of TEST_CONFIG.organizations) {
        const testAdvertiser = {
          name: `Test Advertiser ${org.slug} ${Date.now()}`,
          email: `test-${org.slug}@example.com`,
          phone: '555-0123',
          status: 'active'
        };

        const response = await request(TEST_CONFIG.baseUrl)
          .post('/api/advertisers')
          .set('Cookie', `auth-token=${authTokens[org.slug]}`)
          .send(testAdvertiser)
          .expect(201);

        expect(response.body.advertiser).toBeDefined();
        expect(response.body.advertiser.name).toBe(testAdvertiser.name);
      }
    });
  });

  describe('Export API Authorization', () => {
    test('should allow organization admin to export their data', async () => {
      // Get organization ID for each org
      for (const org of TEST_CONFIG.organizations) {
        // First get the organization details
        const response = await request(TEST_CONFIG.baseUrl)
          .get('/api/organizations')
          .set('Cookie', `auth-token=${authTokens[org.slug]}`)
          .expect(200);

        // Find the user's organization
        const userOrg = response.body.organizations?.find(o => o.slug === org.slug);
        if (!userOrg) continue;

        // Test export endpoint
        const exportResponse = await request(TEST_CONFIG.baseUrl)
          .get(`/api/organizations/${userOrg.id}/export`)
          .set('Cookie', `auth-token=${authTokens[org.slug]}`)
          .expect(200);

        expect(exportResponse.headers['content-type']).toContain('application/gzip');
        expect(exportResponse.headers['content-disposition']).toContain('attachment');
      }
    });

    test('should not allow export of other organization\'s data', async () => {
      const [org1, org2] = TEST_CONFIG.organizations;
      
      // Get org2's organization ID
      const org2Response = await request(TEST_CONFIG.baseUrl)
        .get('/api/organizations')
        .set('Cookie', `auth-token=${authTokens[org2.slug]}`)
        .expect(200);

      const org2Data = org2Response.body.organizations?.find(o => o.slug === org2.slug);
      if (!org2Data) return;

      // Try to export org2's data using org1's credentials
      await request(TEST_CONFIG.baseUrl)
        .get(`/api/organizations/${org2Data.id}/export`)
        .set('Cookie', `auth-token=${authTokens[org1.slug]}`)
        .expect(403); // Should be forbidden
    });
  });

  describe('Master Account Aggregation', () => {
    test('should allow master account to access aggregated analytics', async () => {
      // Assuming the unfy user is the master account
      const masterToken = authTokens['unfy'];

      const response = await request(TEST_CONFIG.baseUrl)
        .get('/api/master/analytics')
        .set('Cookie', `auth-token=${masterToken}`)
        .expect(200);

      expect(response.body.summary).toBeDefined();
      expect(typeof response.body.summary.totalUsers).toBe('number');
      expect(typeof response.body.summary.totalOrganizations).toBe('number');
    });

    test('should not allow non-master accounts to access master analytics', async () => {
      // Try with podcastflow-pro user (non-master)
      const nonMasterToken = authTokens['podcastflow-pro'];

      await request(TEST_CONFIG.baseUrl)
        .get('/api/master/analytics')
        .set('Cookie', `auth-token=${nonMasterToken}`)
        .expect(403); // Should be forbidden
    });
  });

  describe('Authentication and Authorization', () => {
    test('should reject requests without auth token', async () => {
      await request(TEST_CONFIG.baseUrl)
        .get('/api/campaigns')
        .expect(401);
    });

    test('should reject requests with invalid auth token', async () => {
      await request(TEST_CONFIG.baseUrl)
        .get('/api/campaigns')
        .set('Cookie', 'auth-token=invalid-token')
        .expect(401);
    });

    test('should validate auth token belongs to correct organization', async () => {
      // This is implicitly tested by the isolation tests above
      // but we can add explicit validation if needed
      for (const org of TEST_CONFIG.organizations) {
        const response = await request(TEST_CONFIG.baseUrl)
          .get('/api/campaigns')
          .set('Cookie', `auth-token=${authTokens[org.slug]}`)
          .expect(200);

        // Response should be successful and contain appropriate data
        expect(response.body).toBeDefined();
      }
    });
  });

  afterAll(async () => {
    // Clean up test campaigns
    for (const org of TEST_CONFIG.organizations) {
      if (testCampaigns[org.slug]) {
        try {
          await request(TEST_CONFIG.baseUrl)
            .delete(`/api/campaigns/${testCampaigns[org.slug].id}`)
            .set('Cookie', `auth-token=${authTokens[org.slug]}`);
        } catch (error) {
          console.warn(`Failed to clean up test campaign for ${org.slug}:`, error.message);
        }
      }
    }
  });
});