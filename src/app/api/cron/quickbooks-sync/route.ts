import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { quickBooksSyncService } from '@/lib/quickbooks/sync-service'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify this is a valid cron request (in production, you'd check a secret header)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting scheduled QuickBooks sync...')

    // Find all active QuickBooks integrations with auto-sync enabled
    const integrations = await prisma.quickBooksIntegration.findMany({
      where: {
        isActive: true,
        syncSettings: {
          path: '$.autoSync',
          equals: true
        }
      }
    })

    console.log(`Found ${integrations.length} integrations to sync`)

    const results = []

    for (const integration of integrations) {
      try {
        // Check sync frequency settings
        const settings = integration.syncSettings as any
        const frequency = settings?.frequency || 'daily'
        
        // Determine if sync is due
        const lastSync = integration.lastSyncAt
        const now = new Date()
        let shouldSync = false

        if (!lastSync) {
          shouldSync = true
        } else {
          const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)
          
          if (frequency === 'hourly' && hoursSinceLastSync >= 1) {
            shouldSync = true
          } else if (frequency === 'daily' && hoursSinceLastSync >= 24) {
            shouldSync = true
          } else if (frequency === 'weekly' && hoursSinceLastSync >= 168) {
            shouldSync = true
          } else if (frequency === 'monthly' && hoursSinceLastSync >= 720) {
            shouldSync = true
          }
        }

        if (shouldSync) {
          console.log(`Starting sync for organization ${integration.organizationId}`)
          
          // Start the sync process
          const syncId = await quickBooksSyncService.startSync(
            integration.organizationId,
            'system', // System user ID
            { type: 'incremental' }
          )

          results.push({
            organizationId: integration.organizationId,
            syncId,
            status: 'started'
          })
        } else {
          console.log(`Skipping sync for organization ${integration.organizationId} - not due yet`)
          
          results.push({
            organizationId: integration.organizationId,
            status: 'skipped',
            reason: 'not_due'
          })
        }
      } catch (error) {
        console.error(`Error syncing organization ${integration.organizationId}:`, error)
        
        results.push({
          organizationId: integration.organizationId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Clean up old sync records (keep last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const deletedCount = await prisma.quickBooksSync.deleteMany({
      where: {
        completedAt: {
          lt: thirtyDaysAgo
        }
      }
    })

    console.log(`Cleaned up ${deletedCount.count} old sync records`)

    return NextResponse.json({
      success: true,
      message: 'QuickBooks sync cron job completed',
      results,
      cleanedUp: deletedCount.count
    })
  } catch (error) {
    console.error('Error in QuickBooks sync cron job:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}