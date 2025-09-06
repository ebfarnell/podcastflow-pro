import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { NotificationQueueProcessor } from '@/lib/notifications/queue-processor'
import prisma from '@/lib/db/prisma'

// Process notification queue manually (for testing or manual trigger)
export async function POST(request: NextRequest) {
  try {
    // Check if this is a cron job request or admin request
    const cronSecret = request.headers.get('x-cron-secret')
    const isCronJob = cronSecret === process.env.CRON_SECRET
    
    if (!isCronJob) {
      // Require admin authentication for manual trigger
      const session = await getSessionFromCookie(request)
      if (!session || !['admin', 'master'].includes(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    
    const { batchSize = 10 } = await request.json().catch(() => ({}))
    
    // Process notifications
    const processor = new NotificationQueueProcessor({ batchSize })
    
    // Get pending notifications
    const pendingCount = await prisma.notificationQueue.count({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: new Date()
        }
      }
    })
    
    if (pendingCount === 0) {
      return NextResponse.json({
        message: 'No notifications to process',
        processed: 0,
        pending: 0
      })
    }
    
    console.log(`📬 Processing ${pendingCount} pending notifications`)
    
    // Process one batch
    const notifications = await prisma.notificationQueue.findMany({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: new Date()
        }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' }
      ],
      take: batchSize
    })
    
    const results = []
    
    for (const notification of notifications) {
      try {
        // Import delivery functions
        const { sendBulkNotifications } = await import('@/lib/notifications/delivery-service')
        
        const { eventType, eventPayload, recipientIds, organizationId, metadata } = notification
        const channels = metadata?.channels || ['email', 'inApp']
        
        // Mark as processing
        await prisma.notificationQueue.update({
          where: { id: notification.id },
          data: {
            status: 'processing',
            attempts: notification.attempts + 1
          }
        })
        
        // Send notifications
        const deliveryResults = await sendBulkNotifications(
          {
            eventType,
            eventPayload,
            organizationId,
            recipientIds: recipientIds as string[]
          },
          channels
        )
        
        // Mark as completed
        await prisma.notificationQueue.update({
          where: { id: notification.id },
          data: {
            status: 'completed',
            processedAt: new Date(),
            metadata: {
              ...metadata,
              deliveryResults
            }
          }
        })
        
        results.push({
          notificationId: notification.id,
          status: 'completed',
          deliveryResults
        })
      } catch (error) {
        console.error(`❌ Error processing notification ${notification.id}:`, error)
        
        // Update with error
        await prisma.notificationQueue.update({
          where: { id: notification.id },
          data: {
            status: notification.attempts >= notification.maxAttempts ? 'failed' : 'pending',
            lastError: error instanceof Error ? error.message : 'Unknown error',
            scheduledFor: notification.attempts < notification.maxAttempts 
              ? new Date(Date.now() + 5000 * notification.attempts) // Exponential backoff
              : undefined
          }
        })
        
        results.push({
          notificationId: notification.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // Get updated counts
    const remainingCount = await prisma.notificationQueue.count({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: new Date()
        }
      }
    })
    
    return NextResponse.json({
      message: 'Notifications processed',
      processed: results.length,
      successful: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'error').length,
      remaining: remainingCount,
      results
    })
  } catch (error) {
    console.error('❌ Error processing notifications:', error)
    return NextResponse.json(
      { error: 'Failed to process notifications' },
      { status: 500 }
    )
  }
}

// Get queue status
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session || !['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const [pending, processing, completed, failed, skipped] = await Promise.all([
      prisma.notificationQueue.count({ where: { status: 'pending' }}),
      prisma.notificationQueue.count({ where: { status: 'processing' }}),
      prisma.notificationQueue.count({ where: { status: 'completed' }}),
      prisma.notificationQueue.count({ where: { status: 'failed' }}),
      prisma.notificationQueue.count({ where: { status: 'skipped' }})
    ])
    
    // Get recent notifications
    const recent = await prisma.notificationQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        eventType: true,
        status: true,
        priority: true,
        attempts: true,
        createdAt: true,
        processedAt: true
      }
    })
    
    return NextResponse.json({
      stats: {
        pending,
        processing,
        completed,
        failed,
        skipped,
        total: pending + processing + completed + failed + skipped
      },
      recent
    })
  } catch (error) {
    console.error('❌ Error getting queue status:', error)
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    )
  }
}