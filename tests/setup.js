/**
 * Jest test setup file
 * Configures global test environment for multi-tenant tests
 */

// Set test timeout to 30 seconds for integration tests
jest.setTimeout(30000);

// Global test configuration
global.TEST_CONFIG = {
  database: {
    user: 'podcastflow',
    password: 'PodcastFlow2025Prod',
    host: 'localhost',
    database: 'podcastflow_production',
    port: 5432,
  },
  api: {
    baseUrl: 'http://localhost:3000',
    timeout: 10000
  },
  organizations: [
    {
      slug: 'podcastflow-pro',
      name: 'PodcastFlow Pro',
      testUser: {
        email: 'admin@podcastflow.pro',
        password: 'admin123'
      }
    },
    {
      slug: 'unfy',
      name: 'Unfy',
      testUser: {
        email: 'michael@unfy.com',
        password: 'EMunfy2025'
      }
    }
  ]
};

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  // Only show errors that aren't expected test errors
  if (!args[0]?.toString().includes('Expected test error')) {
    originalConsoleError(...args);
  }
};

console.warn = (...args) => {
  // Only show warnings that aren't expected test warnings
  if (!args[0]?.toString().includes('Expected test warning')) {
    originalConsoleWarn(...args);
  }
};

// Global setup for all tests
beforeAll(async () => {
  // Verify application is running
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${global.TEST_CONFIG.api.baseUrl}/api/auth/check`);
    if (!response.ok) {
      throw new Error(`Application not responding: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Application is not running on localhost:3000');
    console.error('Please start the application before running tests:');
    console.error('  pm2 restart podcastflow-pro');
    process.exit(1);
  }

  // Verify database connection
  try {
    const { Client } = require('pg');
    const client = new Client(global.TEST_CONFIG.database);
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
  } catch (error) {
    console.error('❌ Cannot connect to PostgreSQL database');
    console.error('Please ensure PostgreSQL is running with correct credentials');
    process.exit(1);
  }

  console.log('✅ Test environment verified');
});

// Global teardown
afterAll(async () => {
  // Clean up any test data if needed
  console.log('🧹 Test cleanup completed');
});

// Helper functions for tests
global.testHelpers = {
  async loginUser(orgSlug) {
    const org = global.TEST_CONFIG.organizations.find(o => o.slug === orgSlug);
    if (!org) {
      throw new Error(`No test user configured for organization: ${orgSlug}`);
    }

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${global.TEST_CONFIG.api.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(org.testUser)
    });

    if (!response.ok) {
      throw new Error(`Login failed for ${orgSlug}: ${response.status}`);
    }

    const cookies = response.headers.get('set-cookie');
    const authToken = cookies?.match(/auth-token=([^;]+)/)?.[1];
    
    if (!authToken) {
      throw new Error(`No auth token received for ${orgSlug}`);
    }

    return authToken;
  },

  async queryDatabase(query, params = []) {
    const { Client } = require('pg');
    const client = new Client(global.TEST_CONFIG.database);
    
    try {
      await client.connect();
      const result = await client.query(query, params);
      return result;
    } finally {
      await client.end();
    }
  },

  getSchemaName(orgSlug) {
    return `org_${orgSlug.toLowerCase().replace(/-/g, '_')}`;
  },

  async createTestData(orgSlug, tableName, data) {
    const schemaName = this.getSchemaName(orgSlug);
    const columns = Object.keys(data).map(k => `"${k}"`).join(', ');
    const values = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${schemaName}."${tableName}" (${columns}) VALUES (${values}) RETURNING *`;
    
    const result = await this.queryDatabase(query, Object.values(data));
    return result.rows[0];
  },

  async cleanupTestData(orgSlug, tableName, condition, params = []) {
    const schemaName = this.getSchemaName(orgSlug);
    const query = `DELETE FROM ${schemaName}."${tableName}" WHERE ${condition}`;
    
    await this.queryDatabase(query, params);
  }
};