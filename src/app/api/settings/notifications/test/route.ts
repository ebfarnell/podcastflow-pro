import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'
import { sendNotification } from '@/lib/notifications/delivery-service'

// Force dynamic
export const dynamic = 'force-dynamic'

// Test notification schema
const testNotificationSchema = z.object({
  channel: z.enum(['email', 'inApp', 'slack', 'webhook']),
  eventType: z.string().optional().default('test_notification'),
  recipientEmail: z.string().email().optional(),
})

// POST /api/settings/notifications/test - Send test notification
export async function POST(request: NextRequest) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { channel, eventType, recipientEmail } = testNotificationSchema.parse(body)

    console.log(`🧪 Sending test notification via ${channel} for org ${session.organizationId}`)

    // Get organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        name: true,
        settings: true,
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const orgSettings = organization.settings as any || {}
    const notificationSettings = orgSettings.notifications || {}

    // Check if channel is enabled
    if (!notificationSettings.channels?.[channel]?.enabled) {
      return NextResponse.json(
        { error: `Channel ${channel} is not enabled` },
        { status: 400 }
      )
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prepare test notification data
    const testData = {
      title: `Test ${channel} Notification`,
      message: `This is a test notification sent via ${channel} channel at ${new Date().toLocaleString()}`,
      eventType,
      recipientId: user.id,
      recipientEmail: recipientEmail || user.email,
      recipientName: user.name || 'Test User',
      organizationId: organization.id,
      organizationName: organization.name,
      actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro'}/settings/notifications`,
      metadata: {
        test: true,
        sentBy: session.userId,
        sentAt: new Date().toISOString(),
        channel,
      }
    }

    // Send based on channel
    let result: any = { success: false }
    
    switch (channel) {
      case 'email':
        // For now, we'll simulate email sending
        console.log(`📧 Would send email to: ${testData.recipientEmail}`)
        console.log(`📧 Subject: ${testData.title}`)
        console.log(`📧 Body: ${testData.message}`)
        result = {
          success: true,
          channel: 'email',
          recipient: testData.recipientEmail,
          message: 'Test email notification simulated (email service not yet configured)'
        }
        break

      case 'inApp':
        // Create in-app notification
        const notification = await prisma.notification.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            title: testData.title,
            message: testData.message,
            type: 'test',
            eventType: testData.eventType,
            actionUrl: testData.actionUrl,
            metadata: testData.metadata,
            priority: 'normal',
            read: false,
          }
        })
        
        result = {
          success: true,
          channel: 'inApp',
          notificationId: notification.id,
          message: 'Test in-app notification created successfully'
        }
        break

      case 'slack':
        const slackWebhookUrl = notificationSettings.channels?.slack?.webhookUrl
        if (!slackWebhookUrl) {
          return NextResponse.json(
            { error: 'Slack webhook URL not configured' },
            { status: 400 }
          )
        }
        
        // For now, simulate Slack notification
        console.log(`💬 Would send to Slack webhook: ${slackWebhookUrl}`)
        console.log(`💬 Message: ${testData.message}`)
        result = {
          success: true,
          channel: 'slack',
          message: 'Test Slack notification simulated (webhook not yet implemented)'
        }
        break

      case 'webhook':
        const webhookUrl = notificationSettings.channels?.webhook?.url
        if (!webhookUrl) {
          return NextResponse.json(
            { error: 'Webhook URL not configured' },
            { status: 400 }
          )
        }
        
        // For now, simulate webhook call
        console.log(`🔗 Would send to webhook: ${webhookUrl}`)
        console.log(`🔗 Payload:`, testData)
        result = {
          success: true,
          channel: 'webhook',
          message: 'Test webhook notification simulated (webhook not yet implemented)'
        }
        break
    }

    // Log the test in delivery log
    const idempotencyKey = `test_${channel}_${Date.now()}`
    await prisma.notificationDelivery.create({
      data: {
        idempotencyKey,
        eventType: 'test_notification',
        eventPayload: testData,
        organizationId: organization.id,
        recipientId: user.id,
        recipientEmail: testData.recipientEmail,
        channel,
        status: result.success ? 'sent' : 'failed',
        attempts: 1,
        sentAt: result.success ? new Date() : null,
        metadata: {
          test: true,
          result
        }
      }
    })

    console.log(`✅ Test notification sent via ${channel}`)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('❌ Error sending test notification:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format', 
          details: error.errors 
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    )
  }
}