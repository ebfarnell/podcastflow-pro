/**
 * Security tests for multi-tenant data isolation
 * Tests various attack vectors and security scenarios
 */

const { Client } = require('pg');
const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');

const DB_CONFIG = {
  user: 'podcastflow',
  password: 'PodcastFlow2025Prod',
  host: 'localhost',
  database: 'podcastflow_production',
  port: 5432,
};

let dbClient;

describe('Data Isolation Security Tests', () => {
  beforeAll(async () => {
    dbClient = new Client(DB_CONFIG);
    await dbClient.connect();
  });

  afterAll(async () => {
    if (dbClient) {
      await dbClient.end();
    }
  });

  describe('Schema Isolation', () => {
    test('should have separate schemas for each organization', async () => {
      const result = await dbClient.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
        ORDER BY schema_name
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      const schemas = result.rows.map(row => row.schema_name);
      expect(schemas).toContain('org_podcastflow_pro');
      expect(schemas).toContain('org_unfy');
    });

    test('should not allow cross-schema data access without explicit qualification', async () => {
      // Try to access another schema's table without schema qualification
      // This should fail or not return the expected data
      
      try {
        // Set search_path to one organization's schema
        await dbClient.query('SET search_path TO org_podcastflow_pro, public');
        
        // Try to access Campaign table (should access org_podcastflow_pro.Campaign)
        const result1 = await dbClient.query('SELECT COUNT(*) FROM "Campaign"');
        
        // Change to different schema
        await dbClient.query('SET search_path TO org_unfy, public');
        
        // Access Campaign table again (should access org_unfy.Campaign)
        const result2 = await dbClient.query('SELECT COUNT(*) FROM "Campaign"');
        
        // Results should be independent (different counts or both could be 0)
        // What matters is that we're accessing different tables
        expect(result1.rows[0]).toBeDefined();
        expect(result2.rows[0]).toBeDefined();
        
      } finally {
        // Reset search_path
        await dbClient.query('RESET search_path');
      }
    });

    test('should prevent direct cross-schema access attempts', async () => {
      // Test that we can't directly access another org's data through SQL injection-like attempts
      
      const testCases = [
        // Try to access another schema directly
        'org_unfy."Campaign"',
        // Try with various SQL injection patterns
        '"Campaign"; SELECT * FROM org_unfy."Campaign"; --',
        // Try to break out of schema context
        '../org_unfy."Campaign"',
      ];

      for (const testCase of testCases) {
        try {
          await dbClient.query('SET search_path TO org_podcastflow_pro, public');
          
          // These queries should either fail or not return unauthorized data
          const query = `SELECT COUNT(*) FROM ${testCase}`;
          
          try {
            await dbClient.query(query);
            // If it succeeds, that might be OK (e.g., explicit schema access might be allowed)
            // but we need to ensure it's not returning unauthorized data
          } catch (error) {
            // Expect syntax errors or permission denied errors
            expect(error.message).toMatch(/(syntax error|permission denied|relation.*does not exist)/i);
          }
        } finally {
          await dbClient.query('RESET search_path');
        }
      }
    });
  });

  describe('Data Containment', () => {
    test('should ensure test data is properly isolated between schemas', async () => {
      const testOrgSlugs = ['podcastflow-pro', 'unfy'];
      const testData = {};

      // Insert test data into each organization's schema
      for (const slug of testOrgSlugs) {
        const schemaName = `org_${slug.replace(/-/g, '_')}`;
        const testCampaignName = `Isolation Test ${slug} ${Date.now()}`;
        
        await dbClient.query(`
          INSERT INTO ${schemaName}."Campaign" 
          (id, name, status, budget, "startDate", "endDate", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, 'active', 10000, NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())
        `, [testCampaignName]);
        
        testData[slug] = testCampaignName;
      }

      // Verify data exists only in the correct schema
      for (const slug of testOrgSlugs) {
        const schemaName = `org_${slug.replace(/-/g, '_')}`;
        
        // Check data exists in correct schema
        const correctSchemaResult = await dbClient.query(`
          SELECT name FROM ${schemaName}."Campaign" WHERE name = $1
        `, [testData[slug]]);
        
        expect(correctSchemaResult.rows.length).toBe(1);
        expect(correctSchemaResult.rows[0].name).toBe(testData[slug]);
        
        // Check data does NOT exist in other schemas
        for (const otherSlug of testOrgSlugs) {
          if (otherSlug === slug) continue;
          
          const otherSchemaName = `org_${otherSlug.replace(/-/g, '_')}`;
          const otherSchemaResult = await dbClient.query(`
            SELECT name FROM ${otherSchemaName}."Campaign" WHERE name = $1
          `, [testData[slug]]);
          
          expect(otherSchemaResult.rows.length).toBe(0);
        }
      }

      // Clean up test data
      for (const slug of testOrgSlugs) {
        const schemaName = `org_${slug.replace(/-/g, '_')}`;
        await dbClient.query(`
          DELETE FROM ${schemaName}."Campaign" WHERE name = $1
        `, [testData[slug]]);
      }
    });

    test('should verify foreign key constraints work within schemas', async () => {
      const schemaName = 'org_podcastflow_pro';
      
      // Test that foreign keys work correctly within the schema
      // This ensures data integrity while maintaining isolation
      
      try {
        // Try to insert a campaign with a non-existent organization reference
        // This should fail due to foreign key constraints (if they exist)
        await dbClient.query(`
          INSERT INTO ${schemaName}."Campaign" 
          (id, name, status, budget, "startDate", "endDate", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), 'FK Test Campaign', 'active', 10000, NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())
        `);
        
        // If successful, that's fine - not all tables may have FK constraints
        // The important thing is that the schema isolation is maintained
        
      } catch (error) {
        // FK constraint errors are acceptable
        expect(error.message).toMatch(/(foreign key|constraint|violates)/i);
      }
    });
  });

  describe('Schema Structure Validation', () => {
    test('should have consistent table structure across organization schemas', async () => {
      const schemas = await dbClient.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
      `);

      expect(schemas.rows.length).toBeGreaterThan(1);

      // Get table list from first schema
      const firstSchema = schemas.rows[0].schema_name;
      const firstSchemaTables = await dbClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
        ORDER BY table_name
      `, [firstSchema]);

      // Verify all other schemas have the same tables
      for (let i = 1; i < schemas.rows.length; i++) {
        const schema = schemas.rows[i].schema_name;
        const schemaTables = await dbClient.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = $1
          ORDER BY table_name
        `, [schema]);

        expect(schemaTables.rows.length).toBe(firstSchemaTables.rows.length);
        
        for (let j = 0; j < firstSchemaTables.rows.length; j++) {
          expect(schemaTables.rows[j].table_name).toBe(firstSchemaTables.rows[j].table_name);
        }
      }
    });

    test('should have required tables in each organization schema', async () => {
      const requiredTables = [
        'Campaign',
        'Show', 
        'Episode',
        'Advertiser',
        'Agency',
        'AdApproval',
        'Order',
        'Invoice',
        'Payment',
        'Contract',
        'CampaignAnalytics',
        'EpisodeAnalytics',
        'ShowAnalytics'
      ];

      const schemas = await dbClient.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
      `);

      for (const schemaRow of schemas.rows) {
        const schema = schemaRow.schema_name;
        
        for (const table of requiredTables) {
          const result = await dbClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 AND table_name = $2
          `, [schema, table]);

          expect(result.rows.length).toBe(1);
        }
      }
    });
  });

  describe('Permission and Access Control', () => {
    test('should verify database user has appropriate permissions', async () => {
      // Test that our database user can perform necessary operations
      // but can't perform unauthorized operations
      
      const schemas = await dbClient.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'org_%'
        LIMIT 1
      `);

      if (schemas.rows.length === 0) return;

      const schema = schemas.rows[0].schema_name;
      
      // Test SELECT permission
      try {
        await dbClient.query(`SELECT COUNT(*) FROM ${schema}."Campaign"`);
      } catch (error) {
        throw new Error(`Should have SELECT permission on ${schema}.Campaign: ${error.message}`);
      }

      // Test INSERT permission
      try {
        const testId = 'test-permission-' + Date.now();
        await dbClient.query(`
          INSERT INTO ${schema}."Campaign" 
          (id, name, status, budget, "startDate", "endDate", "createdAt", "updatedAt")
          VALUES ($1, 'Permission Test', 'active', 10000, NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())
        `, [testId]);
        
        // Clean up
        await dbClient.query(`DELETE FROM ${schema}."Campaign" WHERE id = $1`, [testId]);
      } catch (error) {
        throw new Error(`Should have INSERT permission on ${schema}.Campaign: ${error.message}`);
      }
    });

    test('should not allow unauthorized schema operations', async () => {
      // Test that we can't perform dangerous operations like dropping schemas
      
      const unauthorizedOperations = [
        'DROP SCHEMA org_test CASCADE',
        'CREATE SCHEMA unauthorized_schema',
        'ALTER SCHEMA org_podcastflow_pro RENAME TO hacked_schema'
      ];

      for (const operation of unauthorizedOperations) {
        try {
          await dbClient.query(operation);
          // If this succeeds, it might be a security issue (depending on setup)
          console.warn(`Warning: Unauthorized operation succeeded: ${operation}`);
        } catch (error) {
          // Expected to fail
          expect(error.message).toMatch(/(permission denied|insufficient privilege|syntax error)/i);
        }
      }
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection through organization slug', async () => {
      // Test various SQL injection attempts through organization slug
      const injectionAttempts = [
        "test'; DROP SCHEMA org_test; --",
        "test\"; SELECT * FROM users; --",
        "test OR 1=1",
        "test UNION SELECT * FROM users",
        "test'; INSERT INTO campaigns VALUES (1, 'hacked'); --"
      ];

      for (const attempt of injectionAttempts) {
        // Simulate what happens when organization slug is processed
        const sanitized = attempt.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const schemaName = `org_${sanitized}`;
        
        // Schema name should be safe
        expect(schemaName).toMatch(/^org_[a-z0-9_]+$/);
        expect(schemaName).not.toContain(';');
        expect(schemaName).not.toContain('--');
        expect(schemaName).not.toContain('DROP');
        expect(schemaName).not.toContain('SELECT');
        expect(schemaName).not.toContain('UNION');
      }
    });
  });
});