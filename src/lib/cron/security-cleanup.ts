#!/usr/bin/env node
/**
 * Security Log Cleanup Cron Job
 * 
 * This script is designed to be run daily via cron or PM2
 * It cleans up old logs according to retention policies
 * 
 * Usage:
 * - Direct: npx tsx src/lib/cron/security-cleanup.ts
 * - PM2: pm2 start src/lib/cron/security-cleanup.ts --cron "0 2 * * *"
 * - Cron: 0 2 * * * cd /home/ec2-user/podcastflow-pro && npx tsx src/lib/cron/security-cleanup.ts
 */

import { runCleanupTasks } from '../security/log-retention'
import prisma from '../db/prisma'

async function main() {
  console.log('='.repeat(60))
  console.log(`🔐 Security Log Cleanup - ${new Date().toISOString()}`)
  console.log('='.repeat(60))

  try {
    // Run cleanup tasks
    const results = await runCleanupTasks()

    // Log results to system log
    await prisma.systemLog.create({
      data: {
        level: 'info',
        message: 'Security log cleanup completed',
        component: 'security-cleanup-cron',
        metadata: results as any
      }
    })

    console.log('\n📊 Cleanup Summary:')
    console.log(`  Security Audit Logs: ${results.securityAuditLogs} deleted`)
    console.log(`  Login Attempts: ${results.loginAttempts} deleted`)
    console.log(`  System Logs: ${results.systemLogs} deleted`)
    console.log(`  System Metrics: ${results.systemMetrics} deleted`)
    console.log(`  Monitoring Alerts: ${results.monitoringAlerts} deleted`)
    console.log(`  Expired Sessions: ${results.sessions} deleted`)
    console.log(`  Used Backup Codes: ${results.backupCodes} deleted`)
    console.log(`  Total: ${results.total} records deleted`)
    
    console.log('\n✅ Security log cleanup completed successfully')
    process.exit(0)

  } catch (error) {
    console.error('❌ Error during security log cleanup:', error)
    
    // Log error to system log
    await prisma.systemLog.create({
      data: {
        level: 'error',
        message: 'Security log cleanup failed',
        component: 'security-cleanup-cron',
        metadata: {
          error: error instanceof Error ? error.message : String(error)
        } as any
      }
    }).catch(console.error)

    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { main as runSecurityCleanup }