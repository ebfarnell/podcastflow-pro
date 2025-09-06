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

export async function POST(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const { notificationId } = params
    
    const notificationIndex = mockNotifications.findIndex(n => n.id === notificationId)
    
    if (notificationIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      )
    }

    // Mark notification as read
    mockNotifications[notificationIndex] = {
      ...mockNotifications[notificationIndex],
      isRead: true,
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: mockNotifications[notificationIndex]
    })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to mark notification as read' },
      { status: 500 }
    )
  }
}