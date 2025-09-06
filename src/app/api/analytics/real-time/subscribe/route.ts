import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { analyticsWebSocket } from '@/lib/analytics/websocket-service'
import crypto from 'crypto'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/analytics/real-time/subscribe - Subscribe to real-time updates
export const POST = await withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { organizationId, campaignIds } = body

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      )
    }

    // Generate subscription ID using timestamp and random hex
    const subscriptionId = `sub_${Date.now()}_${Buffer.from(crypto.randomUUID()).toString('hex').substr(0, 9)}`

    // Create subscription
    const subscription = analyticsWebSocket.subscribe(subscriptionId, organizationId, campaignIds)

    console.log('📡 Real-time analytics subscription created:', {
      subscriptionId,
      organizationId,
      campaignIds: campaignIds?.length || 'all'
    })

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        organizationId: subscription.organizationId,
        campaignIds: subscription.campaignIds,
        active: subscription.active
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Analytics subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
})

// DELETE /api/analytics/real-time/subscribe - Unsubscribe from updates
export const DELETE = await withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('subscriptionId')

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscriptionId is required' },
        { status: 400 }
      )
    }

    analyticsWebSocket.unsubscribe(subscriptionId)

    return NextResponse.json({
      success: true,
      message: 'Subscription removed',
      subscriptionId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Analytics unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to remove subscription' },
      { status: 500 }
    )
  }
})
