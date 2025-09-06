import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { notificationService, NotificationType } from '@/lib/notifications/notification-service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { 
      type, 
      title, 
      message, 
      userId, 
      userIds, 
      actionUrl, 
      sendEmail = false, 
      emailData 
    } = body

    // Validate required fields
    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'Type, title, and message are required' },
        { status: 400 }
      )
    }

    if (!userId && !userIds) {
      return NextResponse.json(
        { error: 'Either userId or userIds must be provided' },
        { status: 400 }
      )
    }

    // Check if user has permission to send notifications
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let result: boolean | number = false

    if (userId) {
      // Send to single user
      result = await notificationService.sendNotification({
        title,
        message,
        type: type as NotificationType,
        userId,
        actionUrl,
        sendEmail,
        emailData,
      })
    } else if (userIds && Array.isArray(userIds)) {
      // Send to multiple users
      result = await notificationService.sendBulkNotification({
        title,
        message,
        type: type as NotificationType,
        userIds,
        actionUrl,
        sendEmail,
        emailData,
      })
    }

    if (result) {
      return NextResponse.json({
        success: true,
        message: userId 
          ? 'Notification sent successfully'
          : `Notification sent to ${result} users`,
        sentCount: typeof result === 'number' ? result : 1
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to send notification' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ Send notification API error:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}