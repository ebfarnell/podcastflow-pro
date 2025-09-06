/**
 * Tenant Provisioning Module - Importable version
 * 
 * This module exports the provisioning functionality for use in API routes
 * while maintaining backward compatibility with the CLI script
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production';

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

export class TenantProvisioner {
  private pool: Pool;
  private options: ProvisionOptions;
  private schemaName: string;
  private changes: string[] = [];
  private errors: string[] = [];
  private logger: Pick<Console, 'log' | 'error' | 'warn'>;
  private startTime: number;

  constructor(options: ProvisionOptions) {
    this.options = options;
    this.schemaName = `org_${options.orgSlug.replace(/-/g, '_')}`;
    this.pool = new Pool({ connectionString: DATABASE_URL });
    this.logger = options.logger || console;
    this.startTime = Date.now();
  }

  async provision(): Promise<ProvisionResult> {
    const tablesCreated: string[] = [];
    const columnsAdded: string[] = [];
    const indexesCreated: string[] = [];
    const constraintsAdded: string[] = [];
    const seedDataCreated: string[] = [];

    try {
      this.logger.log(`🚀 Provisioning tenant: ${this.options.orgSlug}`);
      
      // Step 1: Create or update schema
      await this.ensureSchema();

      // Step 2: Create all missing tables
      const tables = await this.ensureTables();
      tablesCreated.push(...tables);

      // Step 3: Add missing columns to existing tables
      const columns = await this.ensureColumns();
      columnsAdded.push(...columns);

      // Step 4: Add missing constraints
      const constraints = await this.ensureConstraints();
      constraintsAdded.push(...constraints);

      // Step 5: Add missing indexes
      const indexes = await this.ensureIndexes();
      indexesCreated.push(...indexes);

      // Step 6: Create functions and triggers
      await this.ensureFunctionsAndTriggers();

      // Step 7: Seed default data
      const seedData = await this.seedDefaultData();
      seedDataCreated.push(...seedData);

      // Step 8: Verify provisioning
      await this.verifyProvisioning();

      const duration = Date.now() - this.startTime;
      
      return {
        success: true,
        schemaName: this.schemaName,
        changes: this.changes,
        errors: this.errors,
        summary: {
          tablesCreated: tablesCreated.length,
          columnsAdded: columnsAdded.length,
          indexesCreated: indexesCreated.length,
          constraintsAdded: constraintsAdded.length,
          seedDataCreated: seedDataCreated.length
        },
        duration
      };

    } catch (error) {
      this.logger.error('Fatal error during provisioning:', error);
      this.errors.push(`Fatal error: ${error.message}`);
      
      return {
        success: false,
        schemaName: this.schemaName,
        changes: this.changes,
        errors: this.errors,
        summary: {
          tablesCreated: tablesCreated.length,
          columnsAdded: columnsAdded.length,
          indexesCreated: indexesCreated.length,
          constraintsAdded: constraintsAdded.length,
          seedDataCreated: seedDataCreated.length
        },
        duration: Date.now() - this.startTime
      };
    } finally {
      await this.pool.end();
    }
  }

  private async ensureSchema(): Promise<void> {
    const checkQuery = `
      SELECT COUNT(*) as exists 
      FROM information_schema.schemata 
      WHERE schema_name = $1
    `;
    
    const result = await this.pool.query(checkQuery, [this.schemaName]);
    
    if (result.rows[0].exists === '0') {
      const createQuery = `
        CREATE SCHEMA IF NOT EXISTS "${this.schemaName}";
        GRANT ALL ON SCHEMA "${this.schemaName}" TO podcastflow;
      `;
      
      if (!this.options.dryRun) {
        await this.pool.query(createQuery);
      }
      this.changes.push(`Created schema ${this.schemaName}`);
      this.logger.log(`  ✅ Created schema ${this.schemaName}`);
    }
  }

  private async ensureTables(): Promise<string[]> {
    const created: string[] = [];
    
    // Tables that are missing from the base provisioning function
    const missingTables = [
      { name: 'workflow_settings', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."workflow_settings" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "stages" JSONB NOT NULL DEFAULT '[{"key": "planning", "label": "Planning", "threshold": 65}, {"key": "reservation", "label": "Reservation", "threshold": 90}, {"key": "order", "label": "Order", "threshold": 100}]'::jsonb,
          "approval_threshold" INTEGER DEFAULT 90,
          "rejection_fallback" INTEGER DEFAULT 65,
          "auto_reserve_at_90" BOOLEAN DEFAULT true,
          "require_admin_approval_at_90" BOOLEAN DEFAULT true,
          "auto_create_order_on_approval" BOOLEAN DEFAULT true,
          "email_notifications_enabled" BOOLEAN DEFAULT true,
          "slack_notifications_enabled" BOOLEAN DEFAULT false,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "workflow_settings_pkey" PRIMARY KEY ("id")
        )` },
      
      { name: 'WorkflowTrigger', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."WorkflowTrigger" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "triggerType" TEXT NOT NULL,
          "conditions" JSONB NOT NULL,
          "actions" JSONB NOT NULL,
          "isActive" BOOLEAN DEFAULT true,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdBy" TEXT,
          CONSTRAINT "WorkflowTrigger_pkey" PRIMARY KEY ("id")
        )` },

      { name: 'HierarchicalBudget', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."HierarchicalBudget" (
          "id" TEXT NOT NULL,
          "year" INTEGER NOT NULL,
          "month" INTEGER NOT NULL,
          "entityType" TEXT NOT NULL,
          "entityId" TEXT NOT NULL,
          "entityName" TEXT NOT NULL,
          "sellerId" TEXT,
          "budgetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "actualAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "isActive" BOOLEAN DEFAULT true,
          "notes" TEXT,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdBy" TEXT,
          "updatedBy" TEXT,
          CONSTRAINT "HierarchicalBudget_pkey" PRIMARY KEY ("id")
        )` },

      { name: 'Notification', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."Notification" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "data" JSONB,
          "isRead" BOOLEAN DEFAULT false,
          "readAt" TIMESTAMP(3),
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
        )` },

      { name: 'BillingSettings', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."BillingSettings" (
          "id" TEXT NOT NULL,
          "invoicePrefix" TEXT,
          "invoiceStartNumber" INTEGER DEFAULT 1000,
          "defaultPaymentTerms" INTEGER DEFAULT 30,
          "taxRate" DOUBLE PRECISION DEFAULT 0,
          "currency" TEXT DEFAULT 'USD',
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "BillingSettings_pkey" PRIMARY KEY ("id")
        )` }
    ];

    for (const table of missingTables) {
      const exists = await this.tableExists(table.name);
      if (!exists) {
        if (!this.options.dryRun) {
          try {
            await this.pool.query(table.sql);
            created.push(table.name);
            this.changes.push(`Created table ${table.name}`);
          } catch (error) {
            this.errors.push(`Failed to create table ${table.name}: ${error.message}`);
          }
        }
      }
    }

    return created;
  }

  private async ensureColumns(): Promise<string[]> {
    const added: string[] = [];
    
    const columnUpdates = [
      // Invoice.type column - CRITICAL for unified payments
      { 
        table: 'Invoice', 
        column: 'type',
        sql: `ALTER TABLE "${this.schemaName}"."Invoice" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'incoming'`
      },
      // Advertiser columns for hierarchical budgets
      {
        table: 'Advertiser',
        column: 'sellerId',
        sql: `ALTER TABLE "${this.schemaName}"."Advertiser" ADD COLUMN "sellerId" TEXT`
      },
      // Agency.sellerId for hierarchical budgets
      {
        table: 'Agency',
        column: 'sellerId',
        sql: `ALTER TABLE "${this.schemaName}"."Agency" ADD COLUMN "sellerId" TEXT`
      }
    ];

    for (const update of columnUpdates) {
      const exists = await this.columnExists(update.table, update.column);
      if (!exists) {
        if (!this.options.dryRun) {
          try {
            await this.pool.query(update.sql);
            added.push(`${update.table}.${update.column}`);
            this.changes.push(`Added column ${update.table}.${update.column}`);
          } catch (error) {
            // Column might already exist but with different properties
            if (!error.message.includes('already exists')) {
              this.errors.push(`Failed to add column ${update.table}.${update.column}: ${error.message}`);
            }
          }
        }
      }
    }

    return added;
  }

  private async ensureConstraints(): Promise<string[]> {
    const added: string[] = [];
    
    // Invoice type check constraint
    const constraintExists = await this.constraintExists('Invoice', 'invoice_type_check');
    if (!constraintExists) {
      const sql = `
        ALTER TABLE "${this.schemaName}"."Invoice"
        ADD CONSTRAINT invoice_type_check 
        CHECK ("type" IN ('incoming', 'outgoing'))
      `;
      
      if (!this.options.dryRun) {
        try {
          await this.pool.query(sql);
          added.push('invoice_type_check');
          this.changes.push('Added invoice_type_check constraint');
        } catch (error) {
          if (!error.message.includes('already exists')) {
            this.errors.push(`Failed to add invoice_type_check constraint: ${error.message}`);
          }
        }
      }
    }

    return added;
  }

  private async ensureIndexes(): Promise<string[]> {
    const created: string[] = [];
    
    const indexes = [
      { table: 'Invoice', name: 'Invoice_type_idx', column: 'type' },
      { table: 'Advertiser', name: 'Advertiser_sellerId_idx', column: 'sellerId' },
      { table: 'Agency', name: 'Agency_sellerId_idx', column: 'sellerId' }
    ];

    for (const index of indexes) {
      const exists = await this.indexExists(index.table, index.name);
      if (!exists) {
        const sql = `
          CREATE INDEX "${index.name}" 
          ON "${this.schemaName}"."${index.table}" ("${index.column}")
        `;
        
        if (!this.options.dryRun) {
          try {
            await this.pool.query(sql);
            created.push(index.name);
            this.changes.push(`Created index ${index.name}`);
          } catch (error) {
            if (!error.message.includes('already exists')) {
              this.errors.push(`Failed to create index ${index.name}: ${error.message}`);
            }
          }
        }
      }
    }

    return created;
  }

  private async ensureFunctionsAndTriggers(): Promise<void> {
    // Add any schema-specific functions or triggers here
  }

  private async seedDefaultData(): Promise<string[]> {
    const seeded: string[] = [];
    
    // Check if workflow settings exist
    const workflowSettingsExist = await this.pool.query(`
      SELECT COUNT(*) as count 
      FROM "${this.schemaName}"."workflow_settings"
      WHERE "organizationId" = $1
    `, [this.options.orgId]);

    if (workflowSettingsExist.rows[0].count === '0') {
      const sql = `
        INSERT INTO "${this.schemaName}"."workflow_settings" 
        (id, "organizationId", stages, "approval_threshold", "rejection_fallback", 
         "auto_reserve_at_90", "require_admin_approval_at_90", "auto_create_order_on_approval")
        VALUES 
        ($1, $2, $3, 90, 65, true, true, true)
      `;
      
      const stages = [
        { key: 'planning', label: 'Planning', threshold: 65 },
        { key: 'reservation', label: 'Reservation', threshold: 90 },
        { key: 'order', label: 'Order', threshold: 100 }
      ];
      
      if (!this.options.dryRun) {
        try {
          await this.pool.query(sql, [
            `ws-${Date.now()}`,
            this.options.orgId,
            JSON.stringify(stages)
          ]);
          seeded.push('workflow_settings');
          this.changes.push('Created default workflow settings');
        } catch (error) {
          this.errors.push(`Failed to seed workflow settings: ${error.message}`);
        }
      }
    }

    // Check if billing settings exist
    const billingSettingsExist = await this.pool.query(`
      SELECT COUNT(*) as count 
      FROM "${this.schemaName}"."BillingSettings"
      WHERE "organizationId" = $1
    `, [this.options.orgId]);

    if (billingSettingsExist.rows[0].count === '0') {
      const sql = `
        INSERT INTO "${this.schemaName}"."BillingSettings" 
        (id, "invoicePrefix", "invoiceStartNumber", "defaultPaymentTerms", "taxRate", currency, "organizationId")
        VALUES 
        ($1, $2, 1000, 30, 0, 'USD', $3)
      `;
      
      if (!this.options.dryRun) {
        try {
          await this.pool.query(sql, [
            `bs-${Date.now()}`,
            'INV',
            this.options.orgId
          ]);
          seeded.push('billing_settings');
          this.changes.push('Created default billing settings');
        } catch (error) {
          this.errors.push(`Failed to seed billing settings: ${error.message}`);
        }
      }
    }

    return seeded;
  }

  private async verifyProvisioning(): Promise<void> {
    // Count tables
    const tableCount = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
    `, [this.schemaName]);
    
    this.logger.log(`  Total tables in schema: ${tableCount.rows[0].count}`);
    
    // Verify critical tables
    const criticalTables = ['Campaign', 'Show', 'Episode', 'Invoice', 'workflow_settings'];
    
    for (const table of criticalTables) {
      const exists = await this.tableExists(table);
      if (!exists) {
        this.errors.push(`Critical table ${table} is missing`);
      }
    }
    
    // Verify Invoice.type column
    const invoiceTypeExists = await this.columnExists('Invoice', 'type');
    if (!invoiceTypeExists) {
      this.errors.push('Invoice.type column is missing');
    }
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const result = await this.pool.query(`
      SELECT COUNT(*) as exists
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2
    `, [this.schemaName, tableName]);
    
    return result.rows[0].exists === '1';
  }

  private async columnExists(tableName: string, columnName: string): Promise<boolean> {
    const result = await this.pool.query(`
      SELECT COUNT(*) as exists
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
    `, [this.schemaName, tableName, columnName]);
    
    return result.rows[0].exists === '1';
  }

  private async constraintExists(tableName: string, constraintName: string): Promise<boolean> {
    const result = await this.pool.query(`
      SELECT COUNT(*) as exists
      FROM information_schema.table_constraints
      WHERE table_schema = $1 AND table_name = $2 AND constraint_name = $3
    `, [this.schemaName, tableName, constraintName]);
    
    return result.rows[0].exists === '1';
  }

  private async indexExists(tableName: string, indexName: string): Promise<boolean> {
    const result = await this.pool.query(`
      SELECT COUNT(*) as exists
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = $2 AND indexname = $3
    `, [this.schemaName, tableName, indexName]);
    
    return result.rows[0].exists === '1';
  }
}

/**
 * Main provisioning function to be called from API routes
 */
export async function provisionTenant(options: ProvisionOptions): Promise<ProvisionResult> {
  const provisioner = new TenantProvisioner(options);
  return await provisioner.provision();
}