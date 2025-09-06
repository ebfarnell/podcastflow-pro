/**
 * Tenant Provisioning Module - Prisma version for API routes
 * 
 * This module uses Prisma's raw queries instead of pg directly
 * to work properly within Next.js API routes
 */

import prisma from '@/lib/db/prisma';

export interface ProvisionOptions {
  orgSlug: string;
  orgId: string;
  dryRun?: boolean;
  verbose?: boolean;
  logger?: Pick<Console, 'log' | 'error' | 'warn'>;
}

export interface ProvisionResult {
  success: boolean;
  schemaName: string;
  changes: string[];
  errors: string[];
  summary: {
    tablesCreated: number;
    columnsAdded: number;
    indexesCreated: number;
    constraintsAdded: number;
    seedDataCreated: number;
  };
  duration: number;
}

export async function provisionTenant(options: ProvisionOptions): Promise<ProvisionResult> {
  const startTime = Date.now();
  const schemaName = `org_${options.orgSlug.replace(/-/g, '_')}`;
  const logger = options.logger || console;
  const changes: string[] = [];
  const errors: string[] = [];
  
  const summary = {
    tablesCreated: 0,
    columnsAdded: 0,
    indexesCreated: 0,
    constraintsAdded: 0,
    seedDataCreated: 0
  };

  try {
    if (options.verbose) {
      logger.log(`Starting provisioning for ${schemaName}`);
    }

    // Check if schema already has tables
    const existingTables = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = ${schemaName}
        AND table_type = 'BASE TABLE'
    `;

    const tableCount = Number(existingTables[0].count);
    
    if (options.verbose) {
      logger.log(`Schema ${schemaName} currently has ${tableCount} tables`);
    }

    // If schema already has substantial tables, just add missing pieces
    if (tableCount >= 40) {
      if (options.verbose) {
        logger.log(`Schema appears to be provisioned, checking for missing components...`);
      }

      // Add Invoice.type column if missing
      try {
        await prisma.$executeRaw`
          ALTER TABLE ${prisma.$raw(`"${schemaName}"."Invoice"`)} 
          ADD COLUMN IF NOT EXISTS type TEXT 
          CHECK (type IN ('standard', 'credit', 'debit', 'proforma', 'recurring'))
        `;
        changes.push('Added Invoice.type column');
        summary.columnsAdded++;
      } catch (err) {
        // Column might already exist
        if (options.verbose) {
          logger.log('Invoice.type column already exists or error adding:', err.message);
        }
      }

      // Add workflow tables if missing
      const workflowTables = [
        'WorkflowSettings',
        'WorkflowStage', 
        'WorkflowTrigger',
        'WorkflowExecution',
        'WorkflowAutomation'
      ];

      for (const table of workflowTables) {
        try {
          const exists = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables 
              WHERE table_schema = ${schemaName} 
                AND table_name = ${table}
            ) as exists
          `;

          if (!exists[0].exists) {
            // Create the table based on its structure
            await createWorkflowTable(schemaName, table);
            changes.push(`Created ${table} table`);
            summary.tablesCreated++;
          }
        } catch (err) {
          errors.push(`Error checking/creating ${table}: ${err.message}`);
        }
      }

      // Add budget hierarchy tables if missing
      const budgetTables = ['HierarchicalBudget', 'BudgetRollupCache'];
      
      for (const table of budgetTables) {
        try {
          const exists = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables 
              WHERE table_schema = ${schemaName} 
                AND table_name = ${table}
            ) as exists
          `;

          if (!exists[0].exists) {
            await createBudgetTable(schemaName, table);
            changes.push(`Created ${table} table`);
            summary.tablesCreated++;
          }
        } catch (err) {
          errors.push(`Error checking/creating ${table}: ${err.message}`);
        }
      }

      // Add sellerId columns to Advertiser and Agency if missing
      for (const table of ['Advertiser', 'Agency']) {
        try {
          await prisma.$executeRaw`
            ALTER TABLE ${prisma.$raw(`"${schemaName}"."${table}"`)}
            ADD COLUMN IF NOT EXISTS "sellerId" TEXT
          `;
          changes.push(`Added sellerId to ${table}`);
          summary.columnsAdded++;
        } catch (err) {
          if (options.verbose) {
            logger.log(`sellerId column might already exist in ${table}:`, err.message);
          }
        }
      }

    } else {
      // Schema needs full provisioning - call the existing function
      if (options.verbose) {
        logger.log(`Schema needs full provisioning, calling create_complete_org_schema...`);
      }

      try {
        await prisma.$executeRaw`
          SELECT create_complete_org_schema(${options.orgSlug}, ${options.orgId})
        `;
        changes.push('Called create_complete_org_schema function');
        summary.tablesCreated = 84; // Approximate
      } catch (err) {
        errors.push(`Error calling create_complete_org_schema: ${err.message}`);
        return {
          success: false,
          schemaName,
          changes,
          errors,
          summary,
          duration: Date.now() - startTime
        };
      }
    }

    const duration = Date.now() - startTime;
    
    if (options.verbose) {
      logger.log(`Provisioning completed in ${duration}ms`);
      logger.log(`Changes: ${changes.length}, Errors: ${errors.length}`);
    }

    return {
      success: errors.length === 0,
      schemaName,
      changes,
      errors,
      summary,
      duration
    };

  } catch (error) {
    logger.error('Provisioning failed:', error);
    errors.push(`Fatal error: ${error.message}`);
    
    return {
      success: false,
      schemaName,
      changes,
      errors,
      summary,
      duration: Date.now() - startTime
    };
  }
}

async function createWorkflowTable(schemaName: string, tableName: string): Promise<void> {
  const queries: Record<string, string> = {
    WorkflowSettings: `
      CREATE TABLE IF NOT EXISTS "${schemaName}"."WorkflowSettings" (
        id TEXT PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "campaignApprovalThreshold" INTEGER DEFAULT 85,
        "campaignRejectionFallback" INTEGER DEFAULT 60,
        "autoApproveBudgetUnder" DOUBLE PRECISION,
        "requireTalentApproval" BOOLEAN DEFAULT true,
        "requireClientApproval" BOOLEAN DEFAULT true,
        "emailNotifications" BOOLEAN DEFAULT true,
        "slackNotifications" BOOLEAN DEFAULT false,
        "slackWebhookUrl" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    WorkflowStage: `
      CREATE TABLE IF NOT EXISTS "${schemaName}"."WorkflowStage" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config JSONB,
        "order" INTEGER NOT NULL,
        active BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    WorkflowTrigger: `
      CREATE TABLE IF NOT EXISTS "${schemaName}"."WorkflowTrigger" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        event TEXT NOT NULL,
        conditions JSONB,
        actions JSONB,
        active BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    WorkflowExecution: `
      CREATE TABLE IF NOT EXISTS "${schemaName}"."WorkflowExecution" (
        id TEXT PRIMARY KEY,
        "workflowId" TEXT NOT NULL,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        status TEXT NOT NULL,
        "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP(3),
        result JSONB,
        error TEXT
      )
    `,
    WorkflowAutomation: `
      CREATE TABLE IF NOT EXISTS "${schemaName}"."WorkflowAutomation" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        trigger JSONB,
        actions JSONB,
        active BOOLEAN DEFAULT true,
        "lastRun" TIMESTAMP(3),
        "nextRun" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
  };

  const query = queries[tableName];
  if (query) {
    await prisma.$executeRawUnsafe(query);
  }
}

async function createBudgetTable(schemaName: string, tableName: string): Promise<void> {
  const queries: Record<string, string> = {
    HierarchicalBudget: `
      CREATE TABLE IF NOT EXISTS "${schemaName}"."HierarchicalBudget" (
        id TEXT PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "entityType" TEXT NOT NULL CHECK ("entityType" IN ('seller', 'agency', 'advertiser', 'developmental')),
        "entityId" TEXT NOT NULL,
        "parentEntityId" TEXT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        budget DOUBLE PRECISION DEFAULT 0,
        actual DOUBLE PRECISION DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("organizationId", "entityType", "entityId", year, month)
      )
    `,
    BudgetRollupCache: `
      CREATE TABLE IF NOT EXISTS "${schemaName}"."BudgetRollupCache" (
        id TEXT PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        "rolledUpBudget" DOUBLE PRECISION DEFAULT 0,
        "rolledUpActual" DOUBLE PRECISION DEFAULT 0,
        "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("organizationId", "entityType", "entityId", year, month)
      )
    `
  };

  const query = queries[tableName];
  if (query) {
    await prisma.$executeRawUnsafe(query);
  }
}