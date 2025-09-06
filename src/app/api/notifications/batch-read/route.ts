import { NextRequest, NextResponse } from 'next/server'

// Mock notifications data - in production this would come from DynamoDB
// This should be synchronized with other route files
const mockNotifications = [
  {
    id: 'notif-1',
    title: 'New Campaign Created',
    message: 'Your "Tech Talk Q1" campaign has been created successfully.',
    type: 'info',
    userId: 'user-1',
    organizationId: 'org-techstart',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'notif-2',
    title: 'Campaign Performance Update',
    message: 'Your "Morning Coffee Show" campaign has achieved 95% of its target revenue.',
    type: 'success',
    userId: 'user-1',
    organizationId: 'org-techstart',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'notif-3',
    title: 'Payment Received',
    message: 'Payment of $2,500 has been received for the "Business Insights" campaign.',
    type: 'success',
    userId: 'user-1',
    organizationId: 'org-techstart',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationIds } = body

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json(
        { success: false, error: 'Invalid notification IDs provided' },
        { status: 400 }
      )
    }

    const updatedNotifications = []
    const now = new Date().toISOString()

    // Mark each specified notification as read
    for (const notificationId of notificationIds) {
      const notificationIndex = mockNotifications.findIndex(n => n.id === notificationId)
      
      if (notificationIndex !== -1) {
        mockNotifications[notificationIndex] = {
          ...mockNotifications[notificationIndex],
          isRead: true,
          updatedAt: now
        }
        updatedNotifications.push(mockNotifications[notificationIndex])
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: updatedNotifications.length,
        notifications: updatedNotifications
      }
    })
  } catch (error) {
    console.error('Error marking notifications as read:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to mark notifications as read' },
      { status: 500 }
    )
  }
}