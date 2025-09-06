/**
 * Unit tests for schema-db utilities
 * Tests the core multi-tenant database functions
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock Prisma and database dependencies
jest.mock('@/lib/db/prisma', () => ({
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
}));

// Import the module to test
const {
  getSchemaName,
  sanitizeOrgSlug,
  querySchema,
  queryAllSchemas,
  SchemaModels
} = require('../../src/lib/db/schema-db');

describe('Schema Database Utilities', () => {
  describe('getSchemaName', () => {
    test('should convert organization slug to schema name', () => {
      expect(getSchemaName('podcastflow-pro')).toBe('org_podcastflow_pro');
      expect(getSchemaName('unfy')).toBe('org_unfy');
      expect(getSchemaName('test-company')).toBe('org_test_company');
    });

    test('should handle uppercase and special characters', () => {
      expect(getSchemaName('Test-Company')).toBe('org_test_company');
      expect(getSchemaName('ACME-Corp')).toBe('org_acme_corp');
    });

    test('should handle edge cases', () => {
      expect(getSchemaName('')).toBe('org_');
      expect(getSchemaName('a')).toBe('org_a');
      expect(getSchemaName('multiple-dash-test')).toBe('org_multiple_dash_test');
    });
  });

  describe('sanitizeOrgSlug', () => {
    test('should sanitize organization slugs for SQL safety', () => {
      expect(sanitizeOrgSlug('podcastflow-pro')).toBe('podcastflow_pro');
      expect(sanitizeOrgSlug('test-company')).toBe('test_company');
    });

    test('should handle special characters', () => {
      expect(sanitizeOrgSlug('test@company')).toBe('test_company');
      expect(sanitizeOrgSlug('test.company')).toBe('test_company');
      expect(sanitizeOrgSlug('test company')).toBe('test_company');
    });

    test('should prevent SQL injection attempts', () => {
      expect(sanitizeOrgSlug("test'; DROP TABLE users; --")).toBe('test_drop_table_users');
      expect(sanitizeOrgSlug('test"company')).toBe('test_company');
      expect(sanitizeOrgSlug('test\\company')).toBe('test_company');
    });
  });

  describe('Schema Models', () => {
    test('should provide consistent model interface', () => {
      const models = ['campaign', 'show', 'episode', 'advertiser', 'agency'];
      
      models.forEach(model => {
        expect(SchemaModels[model]).toBeDefined();
        expect(typeof SchemaModels[model].findMany).toBe('function');
        expect(typeof SchemaModels[model].findUnique).toBe('function');
        expect(typeof SchemaModels[model].create).toBe('function');
        expect(typeof SchemaModels[model].update).toBe('function');
        expect(typeof SchemaModels[model].delete).toBe('function');
      });
    });
  });

  describe('Schema Validation', () => {
    test('should validate schema names match expected pattern', () => {
      const validSchemas = [
        'org_podcastflow_pro',
        'org_unfy',
        'org_test_company'
      ];

      validSchemas.forEach(schema => {
        expect(schema).toMatch(/^org_[a-z0-9_]+$/);
      });
    });

    test('should reject invalid schema patterns', () => {
      const invalidSchemas = [
        'podcastflow_pro', // missing org_ prefix
        'org_Test_Company', // uppercase letters
        'org_test-company', // contains dash
        'org_test company', // contains space
        'org_test@company', // contains special char
      ];

      invalidSchemas.forEach(schema => {
        expect(schema).not.toMatch(/^org_[a-z0-9_]+$/);
      });
    });
  });
});

describe('Integration Scenarios', () => {
  describe('Multi-organization scenarios', () => {
    const testOrganizations = [
      { slug: 'podcastflow-pro', schema: 'org_podcastflow_pro' },
      { slug: 'unfy', schema: 'org_unfy' },
      { slug: 'test-company', schema: 'org_test_company' }
    ];

    test('should generate unique schemas for each organization', () => {
      const schemas = testOrganizations.map(org => getSchemaName(org.slug));
      const uniqueSchemas = [...new Set(schemas)];
      
      expect(schemas.length).toBe(uniqueSchemas.length);
      expect(schemas).toEqual(expect.arrayContaining(testOrganizations.map(org => org.schema)));
    });

    test('should maintain consistent schema naming', () => {
      testOrganizations.forEach(org => {
        const schema1 = getSchemaName(org.slug);
        const schema2 = getSchemaName(org.slug);
        expect(schema1).toBe(schema2);
        expect(schema1).toBe(org.schema);
      });
    });
  });

  describe('Security scenarios', () => {
    test('should prevent schema name injection', () => {
      const maliciousInputs = [
        "test'; DROP SCHEMA org_test; --",
        "test\"; SELECT * FROM users; --",
        "test\\'; INSERT INTO campaigns; --"
      ];

      maliciousInputs.forEach(input => {
        const schema = getSchemaName(input);
        expect(schema).toMatch(/^org_[a-z0-9_]+$/);
        expect(schema).not.toContain(';');
        expect(schema).not.toContain('--');
        expect(schema).not.toContain('DROP');
        expect(schema).not.toContain('SELECT');
        expect(schema).not.toContain('INSERT');
      });
    });
  });
});

describe('Error Handling', () => {
  test('should handle null/undefined organization slugs gracefully', () => {
    expect(() => getSchemaName(null)).not.toThrow();
    expect(() => getSchemaName(undefined)).not.toThrow();
    expect(getSchemaName(null)).toBe('org_null');
    expect(getSchemaName(undefined)).toBe('org_undefined');
  });

  test('should handle empty organization slugs', () => {
    expect(() => getSchemaName('')).not.toThrow();
    expect(getSchemaName('')).toBe('org_');
  });

  test('should handle very long organization slugs', () => {
    const longSlug = 'a'.repeat(100);
    expect(() => getSchemaName(longSlug)).not.toThrow();
    expect(getSchemaName(longSlug)).toBe(`org_${'a'.repeat(100)}`);
  });
});

module.exports = {
  getSchemaName,
  sanitizeOrgSlug
};