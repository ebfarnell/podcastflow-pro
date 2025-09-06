import { NextRequest, NextResponse } from 'next/server'

// Mock notifications data - in production this would come from DynamoDB
// This should be synchronized with the main route's data
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await params
    
    const notification = mockNotifications.find(n => n.id === notificationId)
    
    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: notification
    })
  } catch (error) {
    console.error('Error fetching notification:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await params
    const body = await request.json()
    
    const notificationIndex = mockNotifications.findIndex(n => n.id === notificationId)
    
    if (notificationIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      )
    }

    // Update the notification
    mockNotifications[notificationIndex] = {
      ...mockNotifications[notificationIndex],
      ...body,
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: mockNotifications[notificationIndex]
    })
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await params
    
    const notificationIndex = mockNotifications.findIndex(n => n.id === notificationId)
    
    if (notificationIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      )
    }

    // Remove the notification
    const deletedNotification = mockNotifications.splice(notificationIndex, 1)[0]

    return NextResponse.json({
      success: true,
      data: deletedNotification
    })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}