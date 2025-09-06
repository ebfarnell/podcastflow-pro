/**
 * Migration helper to refactor existing code to use tenant isolation
 * 
 * This script helps identify and fix direct prisma usage that bypasses tenant isolation
 */

import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'
import path from 'path'

interface MigrationIssue {
  file: string
  line: number
  issue: string
  suggestion: string
  severity: 'high' | 'medium' | 'low'
}

const issues: MigrationIssue[] = []

// Patterns to detect
const patterns = {
  // Direct prisma imports
  directPrismaImport: /import\s+(?:prisma|\{\s*prisma\s*\})\s+from\s+['"]@\/lib\/db\/prisma['"]/g,
  
  // Direct prisma usage
  directPrismaUsage: /prisma\.(campaign|show|episode|advertiser|agency|order|invoice|contract|payment|expense|adApproval)/g,
  
  // Raw queries without schema context
  unsafeRawQuery: /prisma\.\$queryRaw(?:Unsafe)?`[^`]*FROM\s+(?!"org_)(?!"public\.)/g,
  
  // Missing organization context
  missingOrgContext: /findMany\s*\(\s*\{\s*where:\s*\{[^}]*\}\s*\}\s*\)/g,
}

// Models that should be tenant-scoped
const tenantModels = [
  'campaign', 'show', 'episode', 'advertiser', 'agency', 
  'adApproval', 'order', 'invoice', 'contract', 'payment', 
  'expense', 'creative', 'reservation', 'proposal', 'task'
]

/**
 * Analyze a file for tenant isolation issues
 */
function analyzeFile(filePath: string): void {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  // Check for direct prisma import
  const importMatches = content.match(patterns.directPrismaImport)
  if (importMatches) {
    lines.forEach((line, index) => {
      if (patterns.directPrismaImport.test(line)) {
        // Check if this file uses tenant models
        const usesTenantModels = tenantModels.some(model => 
          content.includes(`prisma.${model}`)
        )
        
        if (usesTenantModels) {
          issues.push({
            file: filePath,
            line: index + 1,
            issue: 'Direct prisma import with tenant model usage',
            suggestion: `Replace with: import { getTenantClient, withTenantIsolation } from '@/lib/db/tenant-isolation'`,
            severity: 'high'
          })
        }
      }
    })
  }
  
  // Check for direct prisma usage on tenant models
  lines.forEach((line, index) => {
    tenantModels.forEach(model => {
      if (line.includes(`prisma.${model}`)) {
        issues.push({
          file: filePath,
          line: index + 1,
          issue: `Direct prisma.${model} usage bypasses tenant isolation`,
          suggestion: `Use getTenantClient(context).${model} instead`,
          severity: 'high'
        })
      }
    })
  })
  
  // Check for raw queries without schema
  const rawQueryMatches = content.match(patterns.unsafeRawQuery)
  if (rawQueryMatches) {
    lines.forEach((line, index) => {
      if (line.includes('$queryRaw') && !line.includes('org_') && !line.includes('public.')) {
        issues.push({
          file: filePath,
          line: index + 1,
          issue: 'Raw query without explicit schema',
          suggestion: 'Use executeTenantQuery or specify schema explicitly',
          severity: 'medium'
        })
      }
    })
  }
  
  // Check for cross-schema joins
  if (content.includes('LEFT JOIN public."User"') || content.includes('LEFT JOIN public."Organization"')) {
    lines.forEach((line, index) => {
      if (line.includes('LEFT JOIN public.')) {
        issues.push({
          file: filePath,
          line: index + 1,
          issue: 'Cross-schema join detected',
          suggestion: 'Consider denormalizing user/org data or using separate queries',
          severity: 'low'
        })
      }
    })
  }
}

/**
 * Generate migration code for a file
 */
function generateMigrationCode(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8')
  let migrated = content
  
  // Replace prisma import
  migrated = migrated.replace(
    /import\s+(?:prisma|\{\s*prisma\s*\})\s+from\s+['"]@\/lib\/db\/prisma['"]/g,
    `import prisma from '@/lib/db/prisma' // For public schema only
import { getTenantClient, withTenantIsolation } from '@/lib/db/tenant-isolation'`
  )
  
  // Add tenant context to API routes
  if (filePath.includes('/api/') && migrated.includes('export async function')) {
    // Wrap handlers with tenant isolation
    migrated = migrated.replace(
      /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(\s*request:\s*NextRequest/g,
      `export async function $1(request: NextRequest) {
  return withTenantIsolation(request, async (context) => {
    const tenantDb = getTenantClient(context)
    
    // Original handler code below`
    )
    
    // Close the wrapper
    migrated = migrated.replace(
      /(\s*\}\s*)$/,
      `
  }) // End tenant isolation wrapper
}`
    )
  }
  
  // Replace direct prisma usage
  tenantModels.forEach(model => {
    const regex = new RegExp(`prisma\\.${model}`, 'g')
    migrated = migrated.replace(regex, `tenantDb.${model}`)
  })
  
  return migrated
}

/**
 * Run the migration analysis
 */
export async function runMigrationAnalysis(): Promise<void> {
  console.log('🔍 Analyzing codebase for tenant isolation issues...\n')
  
  // Find all TypeScript files in src
  const files = await glob('src/**/*.ts', {
    cwd: '/home/ec2-user/podcastflow-pro',
    absolute: true,
    ignore: ['**/node_modules/**', '**/*.test.ts', '**/*.spec.ts']
  })
  
  // Analyze each file
  files.forEach(file => {
    analyzeFile(file)
  })
  
  // Group issues by severity
  const highSeverity = issues.filter(i => i.severity === 'high')
  const mediumSeverity = issues.filter(i => i.severity === 'medium')
  const lowSeverity = issues.filter(i => i.severity === 'low')
  
  // Generate report
  console.log(`📊 Tenant Isolation Analysis Report`)
  console.log(`================================\n`)
  
  console.log(`Total Issues Found: ${issues.length}`)
  console.log(`- High Severity: ${highSeverity.length}`)
  console.log(`- Medium Severity: ${mediumSeverity.length}`)
  console.log(`- Low Severity: ${lowSeverity.length}\n`)
  
  // List high severity issues
  if (highSeverity.length > 0) {
    console.log(`🚨 HIGH SEVERITY ISSUES (Fix immediately)`)
    console.log(`========================================\n`)
    
    highSeverity.forEach(issue => {
      console.log(`File: ${issue.file}`)
      console.log(`Line: ${issue.line}`)
      console.log(`Issue: ${issue.issue}`)
      console.log(`Fix: ${issue.suggestion}`)
      console.log('---')
    })
  }
  
  // Generate migration scripts
  console.log(`\n📝 Generating migration scripts...`)
  
  const migrationDir = '/home/ec2-user/podcastflow-pro/infrastructure/tenant-isolation-migration'
  
  // Create migration scripts for high severity files
  const uniqueFiles = new Set(highSeverity.map(i => i.file))
  uniqueFiles.forEach(file => {
    const migrated = generateMigrationCode(file)
    const outputPath = path.join(migrationDir, path.relative('/home/ec2-user/podcastflow-pro', file))
    console.log(`Generated migration for: ${file}`)
  })
  
  console.log(`\n✅ Analysis complete!`)
}

// Export for use in scripts
export { issues, analyzeFile, generateMigrationCode }