#!/usr/bin/env node
"use strict";
/**
 * Audit Script for New Organization Provisioning
 *
 * This script:
 * 1. Compares existing org schemas with what the provisioning function creates
 * 2. Identifies missing tables, columns, constraints, and indexes
 * 3. Validates app-layer wiring for tenant isolation
 * 4. Produces a comprehensive audit report
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://podcastflow:PodcastFlow2025Prod@localhost:5432/podcastflow_production';
async function auditNewOrgProvisioning() {
    const pool = new pg_1.Pool({
        connectionString: DATABASE_URL,
    });
    const auditResult = {
        referenceSchema: 'org_podcastflow_pro',
        provisioningFunction: 'create_complete_org_schema',
        missingTables: [],
        missingColumns: {},
        missingConstraints: {},
        missingIndexes: {},
        extraTables: [],
        apiRouteIssues: []
    };
    try {
        console.log('🔍 Starting New Organization Provisioning Audit');
        console.log('='.repeat(80));
        console.log('Reference Schema:', auditResult.referenceSchema);
        console.log('Database:', DATABASE_URL.replace(/:[^@]*@/, ':****@'));
        console.log('Timestamp:', new Date().toISOString());
        console.log('');
        // Step 1: Get all tables from reference schema
        console.log('📊 Analyzing reference schema tables...');
        const refTablesResult = await pool.query(`
      SELECT 
        table_name,
        COUNT(*) OVER (PARTITION BY table_name) as column_count
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      GROUP BY table_name
      ORDER BY table_name
    `, [auditResult.referenceSchema]);
        const refTables = new Set(refTablesResult.rows.map(r => r.table_name));
        console.log(`Found ${refTables.size} tables in reference schema\n`);
        // Step 2: Create a test schema using the provisioning function
        console.log('🧪 Creating test schema using provisioning function...');
        const testOrgSlug = `test-audit-${Date.now()}`;
        const testOrgId = `test-org-${Date.now()}`;
        const testSchemaName = `org_${testOrgSlug.replace(/-/g, '_')}`;
        try {
            // Call the provisioning function
            await pool.query(`SELECT create_complete_org_schema($1::text, $2::text)`, [testOrgSlug, testOrgId]);
            console.log(`Created test schema: ${testSchemaName}\n`);
            // Get tables from test schema
            const testTablesResult = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `, [testSchemaName]);
            const testTables = new Set(testTablesResult.rows.map(r => r.table_name));
            console.log(`Provisioning function created ${testTables.size} tables\n`);
            // Step 3: Compare tables
            console.log('📋 Comparing table structures...\n');
            // Find missing tables
            for (const table of refTables) {
                if (!testTables.has(table)) {
                    auditResult.missingTables.push(table);
                }
            }
            // Find extra tables (shouldn't happen, but check anyway)
            for (const table of testTables) {
                if (!refTables.has(table)) {
                    auditResult.extraTables.push(table);
                }
            }
            // Step 4: For common tables, compare columns, constraints, and indexes
            const commonTables = Array.from(refTables).filter(t => testTables.has(t));
            for (const tableName of commonTables) {
                // Compare columns
                const refColumns = await pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, [auditResult.referenceSchema, tableName]);
                const testColumns = await pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, [testSchemaName, tableName]);
                const refColNames = new Set(refColumns.rows.map(c => c.column_name));
                const testColNames = new Set(testColumns.rows.map(c => c.column_name));
                const missingCols = Array.from(refColNames).filter(c => !testColNames.has(c));
                if (missingCols.length > 0) {
                    auditResult.missingColumns[tableName] = missingCols;
                }
                // Compare constraints
                const refConstraints = await pool.query(`
          SELECT tc.constraint_name, tc.constraint_type, cc.check_clause
          FROM information_schema.table_constraints tc
          LEFT JOIN information_schema.check_constraints cc 
            ON tc.constraint_name = cc.constraint_name 
            AND tc.constraint_schema = cc.constraint_schema
          WHERE tc.table_schema = $1 AND tc.table_name = $2
            AND tc.constraint_type IN ('CHECK', 'UNIQUE', 'FOREIGN KEY')
          ORDER BY tc.constraint_name
        `, [auditResult.referenceSchema, tableName]);
                const testConstraints = await pool.query(`
          SELECT tc.constraint_name, tc.constraint_type, cc.check_clause
          FROM information_schema.table_constraints tc
          LEFT JOIN information_schema.check_constraints cc 
            ON tc.constraint_name = cc.constraint_name 
            AND tc.constraint_schema = cc.constraint_schema
          WHERE tc.table_schema = $1 AND tc.table_name = $2
            AND tc.constraint_type IN ('CHECK', 'UNIQUE', 'FOREIGN KEY')
          ORDER BY tc.constraint_name
        `, [testSchemaName, tableName]);
                const refConstraintNames = new Set(refConstraints.rows.map(c => c.constraint_name));
                const testConstraintNames = new Set(testConstraints.rows.map(c => c.constraint_name));
                const missingConstraints = Array.from(refConstraintNames).filter(c => !testConstraintNames.has(c));
                if (missingConstraints.length > 0) {
                    auditResult.missingConstraints[tableName] = missingConstraints;
                }
                // Compare indexes
                const refIndexes = await pool.query(`
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = $1 AND tablename = $2
            AND indexname NOT LIKE '%_pkey'
          ORDER BY indexname
        `, [auditResult.referenceSchema, tableName]);
                const testIndexes = await pool.query(`
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = $1 AND tablename = $2
            AND indexname NOT LIKE '%_pkey'
          ORDER BY indexname
        `, [testSchemaName, tableName]);
                const refIndexNames = new Set(refIndexes.rows.map(i => i.indexname));
                const testIndexNames = new Set(testIndexes.rows.map(i => i.indexname));
                const missingIndexes = Array.from(refIndexNames).filter(i => !testIndexNames.has(i));
                if (missingIndexes.length > 0) {
                    auditResult.missingIndexes[tableName] = missingIndexes;
                }
            }
            // Step 5: Clean up test schema
            console.log('🧹 Cleaning up test schema...');
            await pool.query(`DROP SCHEMA IF EXISTS "${testSchemaName}" CASCADE`);
            console.log('Test schema cleaned up\n');
        }
        catch (error) {
            console.error('Error during test schema creation:', error);
            // Try to clean up anyway
            try {
                await pool.query(`DROP SCHEMA IF EXISTS "${testSchemaName}" CASCADE`);
            }
            catch (cleanupError) {
                console.error('Failed to clean up test schema:', cleanupError);
            }
        }
        // Step 6: Check API routes for tenant isolation
        console.log('🔍 Checking API routes for tenant isolation...');
        const apiDir = path.join(__dirname, '../src/app/api');
        const routeFiles = findRouteFiles(apiDir);
        for (const file of routeFiles) {
            const content = fs.readFileSync(file, 'utf-8');
            // Check for direct prisma usage without schema isolation
            if (content.includes('prisma.') && !content.includes('safeQuerySchema') && !content.includes('querySchema')) {
                const relativePath = path.relative(apiDir, file);
                if (!relativePath.includes('auth') && !relativePath.includes('health') && !relativePath.includes('master')) {
                    auditResult.apiRouteIssues.push(`${relativePath}: Uses direct prisma without schema isolation`);
                }
            }
            // Check for SQL queries without schema qualification
            if (content.includes('SELECT') && content.includes('FROM') && !content.includes('org_')) {
                const relativePath = path.relative(apiDir, file);
                if (!relativePath.includes('auth') && !relativePath.includes('health') && !relativePath.includes('master')) {
                    auditResult.apiRouteIssues.push(`${relativePath}: Contains SQL query that might not use tenant schema`);
                }
            }
        }
        // Step 7: Generate audit report
        generateAuditReport(auditResult);
    }
    catch (error) {
        console.error('Fatal error during audit:', error);
        process.exit(1);
    }
    finally {
        await pool.end();
    }
}
function findRouteFiles(dir) {
    const files = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...findRouteFiles(fullPath));
            }
            else if (entry.name === 'route.ts' || entry.name === 'route.js') {
                files.push(fullPath);
            }
        }
    }
    catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
    }
    return files;
}
function generateAuditReport(result) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 AUDIT REPORT: New Organization Provisioning');
    console.log('='.repeat(80));
    // Missing tables
    if (result.missingTables.length > 0) {
        console.log('\n❌ MISSING TABLES (not created by provisioning function):');
        console.log('─'.repeat(60));
        result.missingTables.forEach(table => {
            console.log(`  • ${table}`);
        });
        console.log(`\nTotal: ${result.missingTables.length} tables missing`);
    }
    else {
        console.log('\n✅ All tables are created by provisioning function');
    }
    // Missing columns
    const tablesWithMissingColumns = Object.keys(result.missingColumns);
    if (tablesWithMissingColumns.length > 0) {
        console.log('\n❌ MISSING COLUMNS:');
        console.log('─'.repeat(60));
        tablesWithMissingColumns.forEach(table => {
            console.log(`  ${table}:`);
            result.missingColumns[table].forEach(col => {
                console.log(`    • ${col}`);
            });
        });
        console.log(`\nTotal: ${tablesWithMissingColumns.length} tables with missing columns`);
    }
    else {
        console.log('\n✅ All columns match in common tables');
    }
    // Missing constraints
    const tablesWithMissingConstraints = Object.keys(result.missingConstraints);
    if (tablesWithMissingConstraints.length > 0) {
        console.log('\n⚠️  MISSING CONSTRAINTS:');
        console.log('─'.repeat(60));
        tablesWithMissingConstraints.forEach(table => {
            console.log(`  ${table}:`);
            result.missingConstraints[table].forEach(constraint => {
                console.log(`    • ${constraint}`);
            });
        });
        console.log(`\nTotal: ${tablesWithMissingConstraints.length} tables with missing constraints`);
    }
    // Missing indexes
    const tablesWithMissingIndexes = Object.keys(result.missingIndexes);
    if (tablesWithMissingIndexes.length > 0) {
        console.log('\n⚠️  MISSING INDEXES:');
        console.log('─'.repeat(60));
        tablesWithMissingIndexes.forEach(table => {
            console.log(`  ${table}:`);
            result.missingIndexes[table].forEach(index => {
                console.log(`    • ${index}`);
            });
        });
        console.log(`\nTotal: ${tablesWithMissingIndexes.length} tables with missing indexes`);
    }
    // API route issues
    if (result.apiRouteIssues.length > 0) {
        console.log('\n⚠️  API ROUTE TENANT ISOLATION ISSUES:');
        console.log('─'.repeat(60));
        result.apiRouteIssues.forEach(issue => {
            console.log(`  • ${issue}`);
        });
        console.log(`\nTotal: ${result.apiRouteIssues.length} potential issues`);
    }
    else {
        console.log('\n✅ API routes appear to use proper tenant isolation');
    }
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY:');
    console.log('─'.repeat(60));
    const totalIssues = result.missingTables.length +
        tablesWithMissingColumns.length +
        tablesWithMissingConstraints.length +
        tablesWithMissingIndexes.length +
        result.apiRouteIssues.length;
    if (totalIssues === 0) {
        console.log('✅ New organization provisioning is complete and correct!');
    }
    else {
        console.log(`❌ Found ${totalIssues} categories of issues that need to be fixed:`);
        console.log(`  • ${result.missingTables.length} missing tables`);
        console.log(`  • ${tablesWithMissingColumns.length} tables with missing columns`);
        console.log(`  • ${tablesWithMissingConstraints.length} tables with missing constraints`);
        console.log(`  • ${tablesWithMissingIndexes.length} tables with missing indexes`);
        console.log(`  • ${result.apiRouteIssues.length} API route issues`);
        console.log('\n📝 Next step: Run provision-tenant.ts to fix these issues');
    }
    // Save report to file
    const reportPath = path.join(__dirname, `audit-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`\n📁 Full audit report saved to: ${reportPath}`);
    console.log('='.repeat(80));
}
// Run the audit
auditNewOrgProvisioning().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
