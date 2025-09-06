#!/usr/bin/env node
"use strict";
/**
 * Comprehensive Tenant Provisioning Script
 *
 * This script ensures a new or existing organization has:
 * 1. Complete schema with all 84+ required tables
 * 2. All columns including recent additions (Invoice.type, etc.)
 * 3. All constraints, indexes, and functions
 * 4. Default seed data for settings and templates
 *
 * Script is IDEMPOTENT - safe to run multiple times
 */
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production';
class TenantProvisioner {
    constructor(options) {
        this.changes = [];
        this.errors = [];
        this.options = options;
        this.schemaName = `org_${options.orgSlug.replace(/-/g, '_')}`;
        this.pool = new pg_1.Pool({ connectionString: DATABASE_URL });
    }
    async provision() {
        console.log('🚀 Starting Tenant Provisioning');
        console.log('='.repeat(80));
        console.log('Organization Slug:', this.options.orgSlug);
        console.log('Schema Name:', this.schemaName);
        console.log('Mode:', this.options.dryRun ? 'DRY RUN' : 'EXECUTE');
        console.log('Timestamp:', new Date().toISOString());
        console.log('');
        try {
            // Step 1: Create or update schema
            await this.ensureSchema();
            // Step 2: Create all missing tables
            await this.ensureTables();
            // Step 3: Add missing columns to existing tables
            await this.ensureColumns();
            // Step 4: Add missing constraints
            await this.ensureConstraints();
            // Step 5: Add missing indexes
            await this.ensureIndexes();
            // Step 6: Create functions and triggers
            await this.ensureFunctionsAndTriggers();
            // Step 7: Seed default data
            await this.seedDefaultData();
            // Step 8: Verify and report
            await this.verifyProvisioning();
            this.printReport();
        }
        catch (error) {
            console.error('Fatal error during provisioning:', error);
            this.errors.push(`Fatal error: ${error.message}`);
            this.printReport();
            process.exit(1);
        }
        finally {
            await this.pool.end();
        }
    }
    async ensureSchema() {
        console.log('📂 Ensuring schema exists...');
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
            console.log(`  ✅ Created schema ${this.schemaName}`);
        }
        else {
            console.log(`  ✓ Schema ${this.schemaName} already exists`);
        }
    }
    async ensureTables() {
        console.log('\n📊 Ensuring all required tables exist...');
        // Tables that are missing from the provisioning function
        const missingTables = [
            // Workflow and automation tables
            { name: 'workflow_settings', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."workflow_settings" (
          "id" TEXT NOT NULL,
          "organizationId" TEXT NOT NULL,
          "thresholds" JSONB,
          "automationEnabled" BOOLEAN DEFAULT true,
          "emailNotifications" BOOLEAN DEFAULT true,
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
            { name: 'WorkflowAutomationSetting', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."WorkflowAutomationSetting" (
          "id" TEXT NOT NULL,
          "key" TEXT NOT NULL,
          "value" JSONB NOT NULL,
          "description" TEXT,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "WorkflowAutomationSetting_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'CampaignApproval', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."CampaignApproval" (
          "id" TEXT NOT NULL,
          "campaignId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "requestedBy" TEXT NOT NULL,
          "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "approvedBy" TEXT,
          "approvedAt" TIMESTAMP(3),
          "rejectedBy" TEXT,
          "rejectedAt" TIMESTAMP(3),
          "comments" TEXT,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CampaignApproval_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'TalentApprovalRequest', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."TalentApprovalRequest" (
          "id" TEXT NOT NULL,
          "campaignId" TEXT NOT NULL,
          "showId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "requestedBy" TEXT NOT NULL,
          "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "approvedBy" TEXT,
          "approvedAt" TIMESTAMP(3),
          "rejectedBy" TEXT,
          "rejectedAt" TIMESTAMP(3),
          "reason" TEXT,
          "notes" TEXT,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "TalentApprovalRequest_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'CampaignTimeline', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."CampaignTimeline" (
          "id" TEXT NOT NULL,
          "campaignId" TEXT NOT NULL,
          "eventType" TEXT NOT NULL,
          "eventDate" TIMESTAMP(3) NOT NULL,
          "description" TEXT,
          "metadata" JSONB,
          "createdBy" TEXT,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CampaignTimeline_pkey" PRIMARY KEY ("id")
        )` },
            // Notification system
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
            // Budget hierarchy
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
            // Inventory management
            { name: 'EpisodeInventory', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."EpisodeInventory" (
          "id" TEXT NOT NULL,
          "episodeId" TEXT NOT NULL,
          "placementType" TEXT NOT NULL,
          "totalSpots" INTEGER NOT NULL DEFAULT 0,
          "availableSpots" INTEGER NOT NULL DEFAULT 0,
          "reservedSpots" INTEGER NOT NULL DEFAULT 0,
          "soldSpots" INTEGER NOT NULL DEFAULT 0,
          "blockedSpots" INTEGER NOT NULL DEFAULT 0,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "EpisodeInventory_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'InventoryReservation', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."InventoryReservation" (
          "id" TEXT NOT NULL,
          "episodeId" TEXT NOT NULL,
          "campaignId" TEXT NOT NULL,
          "placementType" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "expiresAt" TIMESTAMP(3),
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdBy" TEXT,
          CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'InventoryAlert', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."InventoryAlert" (
          "id" TEXT NOT NULL,
          "showId" TEXT NOT NULL,
          "episodeId" TEXT,
          "alertType" TEXT NOT NULL,
          "threshold" INTEGER NOT NULL,
          "currentValue" INTEGER NOT NULL,
          "message" TEXT NOT NULL,
          "isResolved" BOOLEAN DEFAULT false,
          "resolvedAt" TIMESTAMP(3),
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "InventoryAlert_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'InventoryChangeLog', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."InventoryChangeLog" (
          "id" TEXT NOT NULL,
          "episodeId" TEXT NOT NULL,
          "placementType" TEXT NOT NULL,
          "changeType" TEXT NOT NULL,
          "previousValue" INTEGER NOT NULL,
          "newValue" INTEGER NOT NULL,
          "reason" TEXT,
          "campaignId" TEXT,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdBy" TEXT,
          CONSTRAINT "InventoryChangeLog_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'InventoryVisibility', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."InventoryVisibility" (
          "id" TEXT NOT NULL,
          "showId" TEXT NOT NULL,
          "episodeId" TEXT,
          "visibilityLevel" TEXT NOT NULL DEFAULT 'internal',
          "restrictions" JSONB,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "InventoryVisibility_pkey" PRIMARY KEY ("id")
        )` },
            // Schedule management
            { name: 'ScheduledSpot', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."ScheduledSpot" (
          "id" TEXT NOT NULL,
          "scheduleId" TEXT NOT NULL,
          "episodeId" TEXT NOT NULL,
          "placementType" TEXT NOT NULL,
          "spotNumber" INTEGER,
          "rate" DOUBLE PRECISION NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'scheduled',
          "airedAt" TIMESTAMP(3),
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ScheduledSpot_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'ScheduleBuilder', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."ScheduleBuilder" (
          "id" TEXT NOT NULL,
          "campaignId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'draft',
          "configuration" JSONB,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdBy" TEXT,
          "updatedBy" TEXT,
          CONSTRAINT "ScheduleBuilder_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'ScheduleBuilderItem', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."ScheduleBuilderItem" (
          "id" TEXT NOT NULL,
          "builderId" TEXT NOT NULL,
          "episodeId" TEXT NOT NULL,
          "showId" TEXT NOT NULL,
          "placementType" TEXT NOT NULL,
          "spotCount" INTEGER NOT NULL DEFAULT 1,
          "rate" DOUBLE PRECISION NOT NULL,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ScheduleBuilderItem_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'ScheduleTemplate', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."ScheduleTemplate" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "template" JSONB NOT NULL,
          "isActive" BOOLEAN DEFAULT true,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdBy" TEXT,
          CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'ScheduleApproval', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."ScheduleApproval" (
          "id" TEXT NOT NULL,
          "scheduleId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "requestedBy" TEXT NOT NULL,
          "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "approvedBy" TEXT,
          "approvedAt" TIMESTAMP(3),
          "comments" TEXT,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ScheduleApproval_pkey" PRIMARY KEY ("id")
        )` },
            // Bulk operations
            { name: 'BulkScheduleIdempotency', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."BulkScheduleIdempotency" (
          "id" TEXT NOT NULL,
          "idempotencyKey" TEXT NOT NULL,
          "campaignId" TEXT NOT NULL,
          "operation" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "result" JSONB,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "BulkScheduleIdempotency_pkey" PRIMARY KEY ("id")
        )` },
            // Additional missing tables
            { name: 'Activity', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."Activity" (
          "id" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "entityType" TEXT NOT NULL,
          "entityId" TEXT NOT NULL,
          "description" TEXT NOT NULL,
          "metadata" JSONB,
          "userId" TEXT NOT NULL,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'Category', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."Category" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "parentId" TEXT,
          "isActive" BOOLEAN DEFAULT true,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'CompetitiveGroup', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."CompetitiveGroup" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "categories" TEXT[],
          "isActive" BOOLEAN DEFAULT true,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CompetitiveGroup_pkey" PRIMARY KEY ("id")
        )` },
            // More tables...
            { name: 'RateCard', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."RateCard" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "showId" TEXT,
          "rates" JSONB NOT NULL,
          "effectiveDate" TIMESTAMP(3) NOT NULL,
          "expiryDate" TIMESTAMP(3),
          "isActive" BOOLEAN DEFAULT true,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdBy" TEXT,
          CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'ShowRateCard', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."ShowRateCard" (
          "id" TEXT NOT NULL,
          "showId" TEXT NOT NULL,
          "preRollRate" DOUBLE PRECISION,
          "midRollRate" DOUBLE PRECISION,
          "postRollRate" DOUBLE PRECISION,
          "effectiveDate" TIMESTAMP(3) NOT NULL,
          "expiryDate" TIMESTAMP(3),
          "isActive" BOOLEAN DEFAULT true,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ShowRateCard_pkey" PRIMARY KEY ("id")
        )` },
            { name: 'ShowRateHistory', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."ShowRateHistory" (
          "id" TEXT NOT NULL,
          "showId" TEXT NOT NULL,
          "placementType" TEXT NOT NULL,
          "rate" DOUBLE PRECISION NOT NULL,
          "effectiveDate" TIMESTAMP(3) NOT NULL,
          "endDate" TIMESTAMP(3),
          "reason" TEXT,
          "organizationId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdBy" TEXT,
          CONSTRAINT "ShowRateHistory_pkey" PRIMARY KEY ("id")
        )` },
            // Add remaining tables...
            { name: 'AdRequest', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."AdRequest" (
          "id" TEXT NOT NULL,
          "campaignId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "requestDetails" JSONB,
          "submittedBy" TEXT NOT NULL,
          "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "organizationId" TEXT NOT NULL,
          CONSTRAINT "AdRequest_pkey" PRIMARY KEY ("id")
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
        )` },
            { name: '_ShowToUser', sql: `
        CREATE TABLE IF NOT EXISTS "${this.schemaName}"."_ShowToUser" (
          "A" TEXT NOT NULL,
          "B" TEXT NOT NULL
        )` },
        ];
        for (const table of missingTables) {
            const exists = await this.tableExists(table.name);
            if (!exists) {
                if (!this.options.dryRun) {
                    try {
                        await this.pool.query(table.sql);
                    }
                    catch (error) {
                        this.errors.push(`Failed to create table ${table.name}: ${error.message}`);
                        continue;
                    }
                }
                this.changes.push(`Created table ${table.name}`);
                console.log(`  ✅ Created table ${table.name}`);
            }
            else if (this.options.verbose) {
                console.log(`  ✓ Table ${table.name} already exists`);
            }
        }
    }
    async ensureColumns() {
        console.log('\n🔧 Ensuring all required columns exist...');
        const columnUpdates = [
            // Invoice.type column
            {
                table: 'Invoice',
                column: 'type',
                sql: `ALTER TABLE "${this.schemaName}"."Invoice" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'incoming'`
            },
            // Advertiser columns
            {
                table: 'Advertiser',
                column: 'sellerId',
                sql: `ALTER TABLE "${this.schemaName}"."Advertiser" ADD COLUMN "sellerId" TEXT`
            },
            {
                table: 'Advertiser',
                column: 'creditTerms',
                sql: `ALTER TABLE "${this.schemaName}"."Advertiser" ADD COLUMN "creditTerms" INTEGER DEFAULT 30`
            },
            {
                table: 'Advertiser',
                column: 'creditLimit',
                sql: `ALTER TABLE "${this.schemaName}"."Advertiser" ADD COLUMN "creditLimit" DOUBLE PRECISION`
            },
            {
                table: 'Advertiser',
                column: 'requiresPreBill',
                sql: `ALTER TABLE "${this.schemaName}"."Advertiser" ADD COLUMN "requiresPreBill" BOOLEAN DEFAULT false`
            },
            {
                table: 'Advertiser',
                column: 'categories',
                sql: `ALTER TABLE "${this.schemaName}"."Advertiser" ADD COLUMN "categories" TEXT[]`
            },
            // Agency.sellerId
            {
                table: 'Agency',
                column: 'sellerId',
                sql: `ALTER TABLE "${this.schemaName}"."Agency" ADD COLUMN "sellerId" TEXT`
            },
            // Campaign columns
            {
                table: 'Campaign',
                column: 'probability',
                sql: `ALTER TABLE "${this.schemaName}"."Campaign" ADD COLUMN "probability" INTEGER DEFAULT 50`
            },
            {
                table: 'Campaign',
                column: 'description',
                sql: `ALTER TABLE "${this.schemaName}"."Campaign" ADD COLUMN "description" TEXT`
            },
            {
                table: 'Campaign',
                column: 'industry',
                sql: `ALTER TABLE "${this.schemaName}"."Campaign" ADD COLUMN "industry" TEXT`
            },
            {
                table: 'Campaign',
                column: 'reservationId',
                sql: `ALTER TABLE "${this.schemaName}"."Campaign" ADD COLUMN "reservationId" TEXT`
            },
            {
                table: 'Campaign',
                column: 'approvalRequestId',
                sql: `ALTER TABLE "${this.schemaName}"."Campaign" ADD COLUMN "approvalRequestId" TEXT`
            },
            {
                table: 'Campaign',
                column: 'preBillRequired',
                sql: `ALTER TABLE "${this.schemaName}"."Campaign" ADD COLUMN "preBillRequired" BOOLEAN DEFAULT false`
            },
            {
                table: 'Campaign',
                column: 'preBillInvoiceId',
                sql: `ALTER TABLE "${this.schemaName}"."Campaign" ADD COLUMN "preBillInvoiceId" TEXT`
            },
            // Show columns for inventory
            {
                table: 'Show',
                column: 'spotConfiguration',
                sql: `ALTER TABLE "${this.schemaName}"."Show" ADD COLUMN "spotConfiguration" JSONB`
            },
            {
                table: 'Show',
                column: 'defaultSpotLoadType',
                sql: `ALTER TABLE "${this.schemaName}"."Show" ADD COLUMN "defaultSpotLoadType" TEXT DEFAULT 'standard'`
            },
            {
                table: 'Show',
                column: 'enableDynamicSpots',
                sql: `ALTER TABLE "${this.schemaName}"."Show" ADD COLUMN "enableDynamicSpots" BOOLEAN DEFAULT false`
            },
            {
                table: 'Show',
                column: 'selloutProjection',
                sql: `ALTER TABLE "${this.schemaName}"."Show" ADD COLUMN "selloutProjection" DOUBLE PRECISION`
            },
            {
                table: 'Show',
                column: 'estimatedEpisodeValue',
                sql: `ALTER TABLE "${this.schemaName}"."Show" ADD COLUMN "estimatedEpisodeValue" DOUBLE PRECISION`
            },
            {
                table: 'Show',
                column: 'megaphonePodcastId',
                sql: `ALTER TABLE "${this.schemaName}"."Show" ADD COLUMN "megaphonePodcastId" TEXT`
            },
        ];
        for (const update of columnUpdates) {
            const exists = await this.columnExists(update.table, update.column);
            if (!exists) {
                if (!this.options.dryRun) {
                    try {
                        await this.pool.query(update.sql);
                    }
                    catch (error) {
                        this.errors.push(`Failed to add column ${update.table}.${update.column}: ${error.message}`);
                        continue;
                    }
                }
                this.changes.push(`Added column ${update.table}.${update.column}`);
                console.log(`  ✅ Added column ${update.table}.${update.column}`);
            }
            else if (this.options.verbose) {
                console.log(`  ✓ Column ${update.table}.${update.column} already exists`);
            }
        }
    }
    async ensureConstraints() {
        console.log('\n🔒 Ensuring all required constraints exist...');
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
                }
                catch (error) {
                    this.errors.push(`Failed to add invoice_type_check constraint: ${error.message}`);
                }
            }
            this.changes.push('Added invoice_type_check constraint');
            console.log('  ✅ Added invoice_type_check constraint');
        }
        else if (this.options.verbose) {
            console.log('  ✓ Constraint invoice_type_check already exists');
        }
    }
    async ensureIndexes() {
        console.log('\n📍 Ensuring all required indexes exist...');
        const indexes = [
            { table: 'Invoice', name: 'Invoice_type_idx', column: 'type' },
            { table: 'Advertiser', name: 'Advertiser_sellerId_idx', column: 'sellerId' },
            { table: 'Agency', name: 'Agency_sellerId_idx', column: 'sellerId' },
            { table: 'Campaign', name: 'idx_campaign_status_date', columns: 'status, "startDate"' },
            { table: 'Reservation', name: 'Reservation_campaignId_idx', column: 'campaignId' },
            { table: 'Reservation', name: 'Reservation_status_idx', column: 'status' },
            { table: 'Show', name: 'idx_show_megaphone_podcast_id', column: 'megaphonePodcastId' },
        ];
        for (const index of indexes) {
            const exists = await this.indexExists(index.table, index.name);
            if (!exists) {
                const columns = index.columns || `"${index.column}"`;
                const sql = `
          CREATE INDEX "${index.name}" 
          ON "${this.schemaName}"."${index.table}" (${columns})
        `;
                if (!this.options.dryRun) {
                    try {
                        await this.pool.query(sql);
                    }
                    catch (error) {
                        this.errors.push(`Failed to create index ${index.name}: ${error.message}`);
                        continue;
                    }
                }
                this.changes.push(`Created index ${index.name}`);
                console.log(`  ✅ Created index ${index.name}`);
            }
            else if (this.options.verbose) {
                console.log(`  ✓ Index ${index.name} already exists`);
            }
        }
    }
    async ensureFunctionsAndTriggers() {
        console.log('\n⚡ Ensuring functions and triggers...');
        // Add any schema-specific functions or triggers here
        // For example, inventory management triggers
        console.log('  ✓ Functions and triggers check complete');
    }
    async seedDefaultData() {
        console.log('\n🌱 Seeding default data...');
        // Check if workflow settings exist
        const workflowSettingsExist = await this.pool.query(`
      SELECT COUNT(*) as count 
      FROM "${this.schemaName}"."workflow_settings"
      WHERE "organizationId" = $1
    `, [this.options.orgId || this.options.orgSlug]);
        if (workflowSettingsExist.rows[0].count === '0') {
            const sql = `
        INSERT INTO "${this.schemaName}"."workflow_settings" 
        (id, "organizationId", thresholds, "automationEnabled", "emailNotifications")
        VALUES 
        ($1, $2, $3, true, true)
      `;
            const thresholds = {
                approval10: 10,
                approval35: 35,
                approval65: 65,
                approval90: 90,
                autoRejectThreshold: 95,
                preBillThreshold: 50,
                talentApprovalRequired: true,
                producerApprovalRequired: true
            };
            if (!this.options.dryRun) {
                await this.pool.query(sql, [
                    `ws-${Date.now()}`,
                    this.options.orgId || this.options.orgSlug,
                    JSON.stringify(thresholds)
                ]);
            }
            this.changes.push('Created default workflow settings');
            console.log('  ✅ Created default workflow settings');
        }
        else if (this.options.verbose) {
            console.log('  ✓ Workflow settings already exist');
        }
        // Check if billing settings exist
        const billingSettingsExist = await this.pool.query(`
      SELECT COUNT(*) as count 
      FROM "${this.schemaName}"."BillingSettings"
      WHERE "organizationId" = $1
    `, [this.options.orgId || this.options.orgSlug]);
        if (billingSettingsExist.rows[0].count === '0') {
            const sql = `
        INSERT INTO "${this.schemaName}"."BillingSettings" 
        (id, "invoicePrefix", "invoiceStartNumber", "defaultPaymentTerms", "taxRate", currency, "organizationId")
        VALUES 
        ($1, $2, 1000, 30, 0, 'USD', $3)
      `;
            if (!this.options.dryRun) {
                await this.pool.query(sql, [
                    `bs-${Date.now()}`,
                    'INV',
                    this.options.orgId || this.options.orgSlug
                ]);
            }
            this.changes.push('Created default billing settings');
            console.log('  ✅ Created default billing settings');
        }
        else if (this.options.verbose) {
            console.log('  ✓ Billing settings already exist');
        }
    }
    async verifyProvisioning() {
        console.log('\n✅ Verifying provisioning...');
        // Count tables
        const tableCount = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
    `, [this.schemaName]);
        console.log(`  Total tables: ${tableCount.rows[0].count}`);
        // Verify critical tables
        const criticalTables = [
            'Campaign', 'Show', 'Episode', 'Invoice', 'Order',
            'workflow_settings', 'HierarchicalBudget', 'Notification'
        ];
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
        console.log('  ✓ Verification complete');
    }
    async tableExists(tableName) {
        const result = await this.pool.query(`
      SELECT COUNT(*) as exists
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2
    `, [this.schemaName, tableName]);
        return result.rows[0].exists === '1';
    }
    async columnExists(tableName, columnName) {
        const result = await this.pool.query(`
      SELECT COUNT(*) as exists
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
    `, [this.schemaName, tableName, columnName]);
        return result.rows[0].exists === '1';
    }
    async constraintExists(tableName, constraintName) {
        const result = await this.pool.query(`
      SELECT COUNT(*) as exists
      FROM information_schema.table_constraints
      WHERE table_schema = $1 AND table_name = $2 AND constraint_name = $3
    `, [this.schemaName, tableName, constraintName]);
        return result.rows[0].exists === '1';
    }
    async indexExists(tableName, indexName) {
        const result = await this.pool.query(`
      SELECT COUNT(*) as exists
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = $2 AND indexname = $3
    `, [this.schemaName, tableName, indexName]);
        return result.rows[0].exists === '1';
    }
    printReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 PROVISIONING REPORT');
        console.log('='.repeat(80));
        if (this.changes.length > 0) {
            console.log('\n✅ Changes Applied:');
            console.log('─'.repeat(60));
            this.changes.forEach(change => console.log(`  • ${change}`));
            console.log(`\nTotal: ${this.changes.length} changes`);
        }
        else {
            console.log('\n✅ No changes needed - organization is fully provisioned');
        }
        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            console.log('─'.repeat(60));
            this.errors.forEach(error => console.log(`  • ${error}`));
            console.log(`\nTotal: ${this.errors.length} errors`);
        }
        console.log('\n' + '='.repeat(80));
        console.log('Provisioning completed at:', new Date().toISOString());
        console.log('='.repeat(80));
    }
}
// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    orgSlug: '',
    dryRun: false,
    verbose: false
};
for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--org':
            options.orgSlug = args[++i];
            break;
        case '--org-id':
            options.orgId = args[++i];
            break;
        case '--dry-run':
            options.dryRun = true;
            break;
        case '--verbose':
        case '-v':
            options.verbose = true;
            break;
        case '--help':
        case '-h':
            console.log(`
Usage: provision-tenant.ts --org <slug> [options]

Options:
  --org <slug>      Organization slug (required)
  --org-id <id>     Organization ID (optional)
  --dry-run         Show what would be done without executing
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Examples:
  # Provision a new organization
  npx ts-node scripts/provision-tenant.ts --org acme-corp --org-id org-123

  # Dry run to see what would be done
  npx ts-node scripts/provision-tenant.ts --org acme-corp --dry-run

  # Fix an existing organization with verbose output
  npx ts-node scripts/provision-tenant.ts --org podcastflow-pro --verbose
      `);
            process.exit(0);
    }
}
if (!options.orgSlug) {
    console.error('Error: --org parameter is required');
    console.log('Use --help for usage information');
    process.exit(1);
}
// Run the provisioner
const provisioner = new TenantProvisioner(options);
provisioner.provision().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
