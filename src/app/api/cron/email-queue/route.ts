import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/services/email'
import { EmailQueueService } from '@/services/email/queue-service'
import prisma from '@/lib/db/prisma'

export async function POST(request: NextRequest) {
  try {
    // Verify cron authentication
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'podcastflow-cron-2025'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('🚫 Unauthorized cron request to email-queue')
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      )
    }

    console.log('📧 Starting email queue processor...')
    const startTime = Date.now()

    // Initialize email service
    await emailService.initialize()

    // Process the queue
    const queueService = new EmailQueueService()
    await queueService.processQueue(emailService)

    // Get queue statistics
    const stats = await queueService.getQueueStatus()
    const duration = Date.now() - startTime

    console.log(`✅ Email queue processed in ${duration}ms`)
    console.log(`📊 Queue stats - Pending: ${stats.pending}, Processing: ${stats.processing}, Sent: ${stats.sent}, Failed: ${stats.failed}`)

    // Log metrics
    await prisma.systemLog.create({
      data: {
        level: 'info',
        source: 'email-queue-cron',
        message: `Email queue processed: ${stats.sent} sent, ${stats.failed} failed`,
        metadata: {
          duration,
          stats,
          timestamp: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      duration,
      stats
    })
  } catch (error: any) {
    console.error('❌ Email queue processor error:', error)
    
    // Log error
    await prisma.systemLog.create({
      data: {
        level: 'error',
        source: 'email-queue-cron',
        message: `Email queue processor failed: ${error.message}`,
        metadata: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      }
    })

    return NextResponse.json(
      { error: 'Email queue processing failed', details: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint for testing/monitoring
export async function GET(request: NextRequest) {
  try {
    const queueService = new EmailQueueService()
    const stats = await queueService.getQueueStatus()
    
    return NextResponse.json({
      status: 'Email queue worker is available',
      queueStats: stats,
      lastRun: await getLastRunTime()
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get queue status', details: error.message },
      { status: 500 }
    )
  }
}

async function getLastRunTime() {
  const lastLog = await prisma.systemLog.findFirst({
    where: {
      source: 'email-queue-cron',
      level: 'info'
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
  
  return lastLog?.createdAt || null
}