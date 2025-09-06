import { Pool, PoolClient } from 'pg'
import prisma from '@/lib/db/prisma'

// Connection pools per schema
const schemaPools = new Map<string, Pool>()

// Get schema name from organization slug
export function getSchemaName(orgSlug: string): string {
  const sanitized = orgSlug.toLowerCase().replace(/-/g, '_')
  return `org_${sanitized}`
}

// Get all organization slugs from the database
export async function getAllOrganizationSlugs(): Promise<string[]> {
  const organizations = await prisma.organization.findMany({
    where: { isActive: true },
    select: { slug: true }
  })
  return organizations.map(org => org.slug)
}

// Get or create a connection pool for a schema
function getSchemaPool(schemaName: string): Pool {
  if (!schemaPools.has(schemaName)) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5, // Max connections per schema
      options: `-c search_path=${schemaName},public`
    })
    
    schemaPools.set(schemaName, pool)
  }
  
  return schemaPools.get(schemaName)!
}

// Execute a query in a specific schema
export async function querySchema<T>(
  orgSlug: string,
  query: string,
  params?: any[]
): Promise<T[]> {
  const schemaName = getSchemaName(orgSlug)
  const pool = getSchemaPool(schemaName)
  
  try {
    const result = await pool.query(query, params)
    if (!result || !result.rows) {
      console.error(`Query returned undefined result for schema ${schemaName}`)
      return []
    }
    return result.rows
  } catch (error) {
    console.error(`Error querying schema ${schemaName}:`, error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error
  }
}

// Safe query function that returns empty array on error instead of throwing
export async function safeQuerySchema<T>(
  orgSlug: string,
  query: string,
  params?: any[]
): Promise<{ data: T[], error?: Error }> {
  const schemaName = getSchemaName(orgSlug)
  const startTime = Date.now()
  
  try {
    const pool = getSchemaPool(schemaName)
    const result = await pool.query(query, params)
    const executionTime = Date.now() - startTime
    
    // Log slow queries
    if (executionTime > 1000) {
      console.warn(`Slow query detected (${executionTime}ms) for ${schemaName}:`, query.substring(0, 100))
    }
    
    QueryLogger.logQuery(orgSlug, query, params, executionTime)
    
    if (!result || !result.rows) {
      console.warn(`Query returned undefined result for schema ${schemaName}`)
      console.warn('Query:', query)
      console.warn('Params:', params)
      return { data: [] }
    }
    
    return { data: result.rows }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    const executionTime = Date.now() - startTime
    
    QueryLogger.logError(orgSlug, query, params || [], err)
    
    // Enhanced error categorization
    if (err.message.includes('does not exist')) {
      console.error(`Schema or table missing in ${schemaName}`);
    } else if (err.message.includes('permission denied')) {
      console.error(`Permission denied for ${schemaName}`);
    } else if (err.message.includes('Connection terminated') || err.message.includes('connection')) {
      console.error(`Connection error for ${schemaName} (${executionTime}ms)`);
      // Potentially recreate pool for connection issues
      if (err.message.includes('Connection terminated')) {
        console.log(`Attempting to recreate pool for ${schemaName}`);
        schemaPools.delete(schemaName);
      }
    } else if (err.message.includes('timeout')) {
      console.error(`Query timeout for ${schemaName} after ${executionTime}ms`);
    }
    
    return { data: [], error: err }
  }
}

// Get a client for a specific schema (for transactions)
export async function getSchemaClient(orgSlug: string): Promise<{
  client: PoolClient
  release: () => void
}> {
  const schemaName = getSchemaName(orgSlug)
  const pool = getSchemaPool(schemaName)
  const client = await pool.connect()
  
  return {
    client,
    release: () => client.release()
  }
}

// Helper to get organization slug from user
export async function getUserOrgSlug(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true }
  })
  
  return user?.organization?.slug || null
}

// Clean up all connections
export async function closeSchemaPools(): Promise<void> {
  for (const [name, pool] of schemaPools) {
    await pool.end()
  }
  schemaPools.clear()
}

// Schema-aware model helpers
export const SchemaModels = {
  // Campaign operations
  campaign: {
    async findMany(orgSlug: string, where?: any, options?: any) {
      let query = 'SELECT * FROM "Campaign"'
      const params: any[] = []
      
      if (where) {
        const conditions: string[] = []
        let paramIndex = 1
        
        // Note: organizationId filtering no longer needed due to schema isolation
        // All queries within org schema are automatically filtered by organization
        
        if (where.status) {
          if (typeof where.status === 'string') {
            conditions.push(`"status" = $${paramIndex++}`)
            params.push(where.status)
          } else if (where.status.in && Array.isArray(where.status.in)) {
            const placeholders = where.status.in.map((_, index) => `$${paramIndex + index}`).join(', ')
            conditions.push(`"status" IN (${placeholders})`)
            params.push(...where.status.in)
            paramIndex += where.status.in.length
          }
        }
        
        if (where.createdBy) {
          if (typeof where.createdBy === 'string') {
            conditions.push(`"createdBy" = $${paramIndex++}`)
            params.push(where.createdBy)
          } else if (where.createdBy.in && Array.isArray(where.createdBy.in)) {
            const placeholders = where.createdBy.in.map((_, index) => `$${paramIndex + index}`).join(', ')
            conditions.push(`"createdBy" IN (${placeholders})`)
            params.push(...where.createdBy.in)
            paramIndex += where.createdBy.in.length
          }
        }
        
        if (where.probability) {
          if (typeof where.probability === 'number') {
            conditions.push(`"probability" = $${paramIndex++}`)
            params.push(where.probability)
          } else if (where.probability.in && Array.isArray(where.probability.in)) {
            const placeholders = where.probability.in.map((_, index) => `$${paramIndex + index}`).join(', ')
            conditions.push(`"probability" IN (${placeholders})`)
            params.push(...where.probability.in)
            paramIndex += where.probability.in.length
          }
        }
        
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ')
        }
      }
      
      if (options?.orderBy) {
        const orderClauses = Object.entries(options.orderBy)
          .map(([field, order]) => `"${field}" ${order}`)
          .join(', ')
        query += ' ORDER BY ' + orderClauses
      }
      
      if (options?.take) {
        query += ` LIMIT ${options.take}`
      }
      
      const { data, error } = await safeQuerySchema(orgSlug, query, params)
      if (error) {
        console.error(`Error in campaign.findMany for org ${orgSlug}:`, error.message)
        return []
      }
      return data
    },
    
    async findUnique(orgSlug: string, id: string) {
      const { data, error } = await safeQuerySchema(
        orgSlug,
        'SELECT * FROM "Campaign" WHERE "id" = $1',
        [id]
      )
      if (error) {
        console.error(`Error in campaign.findUnique for org ${orgSlug}:`, error.message)
        return null
      }
      return data[0] || null
    },
    
    async create(orgSlug: string, data: any) {
      const columns = Object.keys(data)
      const values = Object.values(data)
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
      
      const query = `
        INSERT INTO "Campaign" (${columns.map(c => `"${c}"`).join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `
      
      const result = await querySchema(orgSlug, query, values)
      return result[0]
    },
    
    async update(orgSlug: string, id: string, data: any) {
      const updates = Object.entries(data)
        .map(([key, _], i) => `"${key}" = $${i + 2}`)
        .join(', ')
      
      const query = `
        UPDATE "Campaign"
        SET ${updates}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
        RETURNING *
      `
      
      const result = await querySchema(orgSlug, query, [id, ...Object.values(data)])
      return result[0]
    },
    
    async delete(orgSlug: string, id: string) {
      const result = await querySchema(
        orgSlug,
        'DELETE FROM "Campaign" WHERE "id" = $1 RETURNING *',
        [id]
      )
      return result[0]
    }
  },
  
  // Show operations
  show: {
    async findMany(orgSlug: string, where?: any, options?: any) {
      let query = 'SELECT * FROM "Show"'
      const params: any[] = []
      
      if (where) {
        const conditions: string[] = []
        let paramIndex = 1
        
        // Note: organizationId filtering no longer needed due to schema isolation
        // All queries within org schema are automatically filtered by organization
        
        if (where.isActive !== undefined) {
          conditions.push(`"isActive" = $${paramIndex++}`)
          params.push(where.isActive)
        }
        
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ')
        }
      }
      
      if (options?.orderBy) {
        const orderClauses = Object.entries(options.orderBy)
          .map(([field, order]) => `"${field}" ${order}`)
          .join(', ')
        query += ' ORDER BY ' + orderClauses
      }
      
      const { data, error } = await safeQuerySchema(orgSlug, query, params)
      if (error) {
        console.error(`Error in show.findMany for org ${orgSlug}:`, error.message)
        return []
      }
      return data
    },
    
    async findUnique(orgSlug: string, id: string) {
      const { data, error } = await safeQuerySchema(
        orgSlug,
        'SELECT * FROM "Show" WHERE "id" = $1',
        [id]
      )
      if (error) {
        console.error(`Error in show.findUnique for org ${orgSlug}:`, error.message)
        return null
      }
      return data[0] || null
    },
    
    async create(orgSlug: string, data: any) {
      const columns = Object.keys(data)
      const values = Object.values(data)
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
      
      const query = `
        INSERT INTO "Show" (${columns.map(c => `"${c}"`).join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `
      
      const result = await querySchema(orgSlug, query, values)
      return result[0]
    }
  },
  
  // Episode operations
  episode: {
    async findMany(orgSlug: string, where?: any, options?: any) {
      let query = 'SELECT * FROM "Episode"'
      const params: any[] = []
      
      if (where) {
        const conditions: string[] = []
        let paramIndex = 1
        
        if (where.showId) {
          conditions.push(`"showId" = $${paramIndex++}`)
          params.push(where.showId)
        }
        
        // Note: organizationId filtering no longer needed due to schema isolation
        // All queries within org schema are automatically filtered by organization
        
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ')
        }
      }
      
      const { data, error } = await safeQuerySchema(orgSlug, query, params)
      if (error) {
        console.error(`Error in episode.findMany for org ${orgSlug}:`, error.message)
        return []
      }
      return data
    }
  },
  
  // Advertiser operations
  advertiser: {
    async findMany(orgSlug: string, where?: any, options?: any) {
      let query = 'SELECT * FROM "Advertiser"'
      const params: any[] = []
      
      if (where) {
        const conditions: string[] = []
        let paramIndex = 1
        
        // Note: organizationId filtering no longer needed due to schema isolation
        // All queries within org schema are automatically filtered by organization
        
        if (where.id) {
          if (typeof where.id === 'string') {
            conditions.push(`"id" = $${paramIndex++}`)
            params.push(where.id)
          } else if (where.id.in && Array.isArray(where.id.in)) {
            const placeholders = where.id.in.map((_, index) => `$${paramIndex + index}`).join(', ')
            conditions.push(`"id" IN (${placeholders})`)
            params.push(...where.id.in)
            paramIndex += where.id.in.length
          }
        }
        
        if (where.isActive !== undefined) {
          conditions.push(`"isActive" = $${paramIndex++}`)
          params.push(where.isActive)
        }
        
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ')
        }
      }
      
      const { data, error } = await safeQuerySchema(orgSlug, query, params)
      if (error) {
        console.error(`Error in advertiser.findMany for org ${orgSlug}:`, error.message)
        return []
      }
      return data
    },
    
    async findUnique(orgSlug: string, id: string) {
      const { data, error } = await safeQuerySchema(
        orgSlug,
        'SELECT * FROM "Advertiser" WHERE "id" = $1',
        [id]
      )
      if (error) {
        console.error(`Error in advertiser.findUnique for org ${orgSlug}:`, error.message)
        return null
      }
      return data[0] || null
    },
    
    async create(orgSlug: string, data: any) {
      const columns = Object.keys(data)
      const values = Object.values(data)
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
      
      const query = `
        INSERT INTO "Advertiser" (${columns.map(c => `"${c}"`).join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `
      
      const result = await querySchema(orgSlug, query, values)
      return result[0]
    }
  },
  
  // Add more models as needed...
}

// Master account helpers
export async function queryAllSchemas<T>(
  query: (orgSlug: string) => Promise<T[]>
): Promise<Array<T & { _orgSlug: string }>> {
  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    select: { slug: true }
  })
  
  const results: Array<T & { _orgSlug: string }> = []
  
  for (const org of orgs) {
    try {
      const orgResults = await query(org.slug)
      for (const result of orgResults) {
        results.push({ ...result, _orgSlug: org.slug })
      }
    } catch (error) {
      console.error(`Error querying ${org.slug}:`, error)
    }
  }
  
  return results
}

// Helper to create tables for new organization
export async function createOrganizationSchema(orgId: string, orgSlug: string): Promise<void> {
  const schemaName = getSchemaName(orgSlug)
  
  // Use the public connection to create schema
  await prisma.$executeRaw`
    SELECT create_complete_org_schema(${orgSlug}::text, ${orgId}::text)
  `
  
  console.log(`Created schema ${schemaName} for organization ${orgSlug}`)
}

// Budget-specific utilities (added after migration)
export const BudgetUtils = {
  async getHierarchicalBudgets(orgSlug: string, filters?: {
    year?: number;
    month?: number;
    sellerId?: string;
    entityType?: 'advertiser' | 'agency' | 'seller';
    includeInactive?: boolean;
  }) {
    let query = 'SELECT * FROM "HierarchicalBudget"';
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.year) {
        conditions.push(`"year" = $${paramIndex++}`);
        params.push(filters.year);
      }
      if (filters.month) {
        conditions.push(`"month" = $${paramIndex++}`);
        params.push(filters.month);
      }
      if (filters.sellerId) {
        conditions.push(`"sellerId" = $${paramIndex++}`);
        params.push(filters.sellerId);
      }
      if (filters.entityType) {
        conditions.push(`"entityType" = $${paramIndex++}`);
        params.push(filters.entityType);
      }
      if (!filters.includeInactive) {
        conditions.push('"isActive" = true');
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY "year", "month", "entityType", "entityName"';

    const { data, error } = await safeQuerySchema(orgSlug, query, params);
    if (error) {
      console.error(`Error fetching hierarchical budgets for ${orgSlug}:`, error.message);
      return [];
    }
    return data;
  },

  // Dynamic budget rollup calculations
  async calculateBudgetRollups(orgSlug: string, filters?: {
    year?: number;
    month?: number;
    sellerId?: string;
  }) {
    let query = `
      SELECT 
        hb."sellerId",
        hb.year,
        hb.month,
        SUM(hb."budgetAmount") as "totalBudget",
        SUM(hb."actualAmount") as "totalActual",
        SUM(hb."actualAmount" - hb."budgetAmount") as "budgetVariance",
        CASE 
          WHEN SUM(hb."budgetAmount") > 0 
          THEN ABS(SUM(hb."actualAmount" - hb."budgetAmount")) < (SUM(hb."budgetAmount") * 0.1)
          ELSE false
        END as "isOnTarget"
      FROM "HierarchicalBudget" hb
      WHERE hb."isActive" = true
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.year) {
        conditions.push(`hb.year = $${paramIndex++}`);
        params.push(filters.year);
      }
      if (filters.month) {
        conditions.push(`hb.month = $${paramIndex++}`);
        params.push(filters.month);
      }
      if (filters.sellerId) {
        conditions.push(`hb."sellerId" = $${paramIndex++}`);
        params.push(filters.sellerId);
      }
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' GROUP BY hb."sellerId", hb.year, hb.month ORDER BY hb.year, hb.month, hb."sellerId"';

    const { data, error } = await safeQuerySchema(orgSlug, query, params);
    if (error) {
      console.error(`Error calculating budget rollups for ${orgSlug}:`, error.message);
      return [];
    }
    return data;
  }
};

// Schema validation utilities
export const SchemaUtils = {
  async validateSchemaExists(orgSlug: string): Promise<boolean> {
    const schemaName = getSchemaName(orgSlug);
    try {
      const { data } = await safeQuerySchema(
        orgSlug,
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1",
        [schemaName]
      );
      return data.length > 0;
    } catch {
      return false;
    }
  },

  async validateTableExists(orgSlug: string, tableName: string): Promise<boolean> {
    const schemaName = getSchemaName(orgSlug);
    try {
      const { data } = await safeQuerySchema(
        orgSlug,
        "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2",
        [schemaName, tableName]
      );
      return data.length > 0;
    } catch {
      return false;
    }
  },

  async getSchemaTableCount(orgSlug: string): Promise<number> {
    const schemaName = getSchemaName(orgSlug);
    try {
      const { data } = await safeQuerySchema(
        orgSlug,
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = $1",
        [schemaName]
      );
      return parseInt(data[0]?.count || '0');
    } catch {
      return 0;
    }
  }
};

// Enhanced error handling and logging
export const QueryLogger = {
  logQuery(orgSlug: string, query: string, params?: any[], executionTime?: number) {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_QUERIES) {
      console.log(`[${getSchemaName(orgSlug)}] Query:`, query.substring(0, 100) + (query.length > 100 ? '...' : ''));
      if (params?.length) {
        console.log(`[${getSchemaName(orgSlug)}] Params:`, params);
      }
      if (executionTime) {
        console.log(`[${getSchemaName(orgSlug)}] Execution time: ${executionTime}ms`);
      }
    }
  },

  logError(orgSlug: string, query: string, params: any[], error: Error) {
    console.error(`[${getSchemaName(orgSlug)}] Query failed:`);
    console.error(`Query: ${query}`);
    console.error(`Params:`, params);
    console.error(`Error: ${error.message}`);
    
    // Log additional context for common errors
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error(`Hint: Table may not exist in schema ${getSchemaName(orgSlug)}`);
    } else if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.error(`Hint: Column may not exist. Check if migration is needed.`);
    } else if (error.message.includes('permission denied')) {
      console.error(`Hint: Check database permissions for schema ${getSchemaName(orgSlug)}`);
    }
  }
};

// Connection pool health monitoring
export const PoolMonitor = {
  getPoolStats(): Array<{ schema: string; totalCount: number; idleCount: number; waitingCount: number }> {
    const stats: Array<{ schema: string; totalCount: number; idleCount: number; waitingCount: number }> = [];
    
    for (const [schemaName, pool] of schemaPools) {
      stats.push({
        schema: schemaName,
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      });
    }
    
    return stats;
  },

  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    let healthy = true;
    
    for (const [schemaName, pool] of schemaPools) {
      try {
        // Test connection
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
      } catch (error) {
        healthy = false;
        issues.push(`Schema ${schemaName}: ${error instanceof Error ? error.message : 'Connection failed'}`);
      }
      
      // Check for connection leaks
      if (pool.totalCount > 10) {
        issues.push(`Schema ${schemaName}: High connection count (${pool.totalCount})`);
      }
      
      if (pool.waitingCount > 5) {
        issues.push(`Schema ${schemaName}: High waiting count (${pool.waitingCount})`);
      }
    }
    
    return { healthy, issues };
  }
}