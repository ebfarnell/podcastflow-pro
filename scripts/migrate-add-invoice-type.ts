#!/usr/bin/env node

/**
 * Migration: Add 'type' column to Invoice table across all organization schemas
 * 
 * This script:
 * 1. Discovers all org_* schemas
 * 2. Adds 'type' column with default 'incoming'
 * 3. Adds CHECK constraint and index
 * 4. Backfills existing records
 * 5. Reports counts per organization
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production';

interface OrgSchema {
  schema_name: string;
}

interface InvoiceCount {
  type: string;
  count: string;
}

async function runMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  let totalSchemas = 0;
  let successfulSchemas = 0;
  let failedSchemas: string[] = [];
  const schemaCounts: Record<string, InvoiceCount[]> = {};

  try {
    console.log('🚀 Starting Invoice type column migration...');
    console.log('Database:', DATABASE_URL.replace(/:[^@]*@/, ':****@'));
    console.log('Timestamp:', new Date().toISOString());
    console.log('');

    // Step 1: Discover all org schemas
    const schemasResult = await pool.query<OrgSchema>(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'org_%'
      ORDER BY schema_name
    `);

    const schemas = schemasResult.rows;
    totalSchemas = schemas.length;
    console.log(`📊 Found ${totalSchemas} organization schemas to migrate\n`);

    // Step 2: Process each schema
    for (const { schema_name } of schemas) {
      console.log(`Processing ${schema_name}...`);
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Check if column already exists
        const columnExists = await client.query(`
          SELECT COUNT(*) as count
          FROM information_schema.columns
          WHERE table_schema = $1
          AND table_name = 'Invoice'
          AND column_name = 'type'
        `, [schema_name]);

        if (columnExists.rows[0].count === '0') {
          // Add the type column with default
          console.log(`  ➕ Adding type column...`);
          await client.query(`
            ALTER TABLE "${schema_name}"."Invoice" 
            ADD COLUMN "type" TEXT NOT NULL DEFAULT 'incoming'
          `);
        } else {
          console.log(`  ✓ Type column already exists`);
        }

        // Check if constraint exists
        const constraintExists = await client.query(`
          SELECT COUNT(*) as count
          FROM information_schema.table_constraints
          WHERE table_schema = $1
          AND table_name = 'Invoice'
          AND constraint_name = 'invoice_type_check'
        `, [schema_name]);

        if (constraintExists.rows[0].count === '0') {
          // Add CHECK constraint
          console.log(`  ➕ Adding CHECK constraint...`);
          await client.query(`
            ALTER TABLE "${schema_name}"."Invoice"
            ADD CONSTRAINT invoice_type_check 
            CHECK ("type" IN ('incoming', 'outgoing'))
          `);
        } else {
          console.log(`  ✓ CHECK constraint already exists`);
        }

        // Check if index exists
        const indexExists = await client.query(`
          SELECT COUNT(*) as count
          FROM pg_indexes
          WHERE schemaname = $1
          AND tablename = 'Invoice'
          AND indexname = 'Invoice_type_idx'
        `, [schema_name]);

        if (indexExists.rows[0].count === '0') {
          // Create index
          console.log(`  ➕ Creating index on type column...`);
          await client.query(`
            CREATE INDEX "Invoice_type_idx" 
            ON "${schema_name}"."Invoice" ("type")
          `);
        } else {
          console.log(`  ✓ Index already exists`);
        }

        // Backfill any NULL values (shouldn't be any with DEFAULT, but safety check)
        console.log(`  🔄 Ensuring all records have type set...`);
        const updateResult = await client.query(`
          UPDATE "${schema_name}"."Invoice"
          SET "type" = 'incoming'
          WHERE "type" IS NULL
        `);
        
        if (updateResult.rowCount && updateResult.rowCount > 0) {
          console.log(`  ✅ Updated ${updateResult.rowCount} records to 'incoming'`);
        }

        // Get counts by type
        const countsResult = await client.query<InvoiceCount>(`
          SELECT "type", COUNT(*) as count
          FROM "${schema_name}"."Invoice"
          GROUP BY "type"
          ORDER BY "type"
        `);

        schemaCounts[schema_name] = countsResult.rows;

        await client.query('COMMIT');
        successfulSchemas++;
        console.log(`  ✅ ${schema_name} migration completed successfully`);
        
        // Print counts
        if (countsResult.rows.length > 0) {
          console.log(`  📊 Invoice counts:`);
          countsResult.rows.forEach(row => {
            console.log(`     - ${row.type}: ${row.count}`);
          });
        } else {
          console.log(`  📊 No invoices found in this schema`);
        }
        console.log('');

      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Error migrating ${schema_name}:`, error);
        failedSchemas.push(schema_name);
        console.log('');
      } finally {
        client.release();
      }
    }

    // Step 3: Print summary report
    console.log('═'.repeat(60));
    console.log('📈 MIGRATION SUMMARY REPORT');
    console.log('═'.repeat(60));
    console.log(`Total schemas processed: ${totalSchemas}`);
    console.log(`✅ Successful: ${successfulSchemas}`);
    console.log(`❌ Failed: ${failedSchemas.length}`);
    
    if (failedSchemas.length > 0) {
      console.log('\nFailed schemas:');
      failedSchemas.forEach(schema => console.log(`  - ${schema}`));
    }

    console.log('\n📊 Invoice Type Distribution by Organization:');
    console.log('─'.repeat(60));
    
    let grandTotalIncoming = 0;
    let grandTotalOutgoing = 0;
    
    Object.entries(schemaCounts).forEach(([schema, counts]) => {
      console.log(`\n${schema}:`);
      if (counts.length === 0) {
        console.log('  No invoices');
      } else {
        counts.forEach(({ type, count }) => {
          console.log(`  ${type}: ${count}`);
          if (type === 'incoming') grandTotalIncoming += parseInt(count);
          if (type === 'outgoing') grandTotalOutgoing += parseInt(count);
        });
      }
    });

    console.log('\n' + '─'.repeat(60));
    console.log('Grand Totals:');
    console.log(`  Incoming: ${grandTotalIncoming}`);
    console.log(`  Outgoing: ${grandTotalOutgoing}`);
    console.log(`  Total: ${grandTotalIncoming + grandTotalOutgoing}`);
    console.log('═'.repeat(60));

    if (failedSchemas.length > 0) {
      console.error('\n⚠️  Migration completed with errors. Please review failed schemas.');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully for all schemas!');
      console.log('Timestamp:', new Date().toISOString());
    }

  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});