import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { analyticsWebSocket } from '@/lib/analytics/websocket-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/analytics/real-time/updates - Get pending updates for a subscription (Server-Sent Events)
export const GET = await withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('subscriptionId')
    const format = searchParams.get('format') || 'json' // 'json' or 'sse'

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscriptionId is required' },
        { status: 400 }
      )
    }

    const subscription = analyticsWebSocket.getSubscription(subscriptionId)
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    if (format === 'sse') {
      // Server-Sent Events format
      return handleServerSentEvents(subscriptionId, subscription)
    } else {
      // Regular JSON response
      const updates = analyticsWebSocket.getPendingUpdates(subscriptionId)

      return NextResponse.json({
        success: true,
        subscriptionId,
        updates,
        count: updates.length,
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('❌ Analytics updates error:', error)
    return NextResponse.json(
      { error: 'Failed to get updates' },
      { status: 500 }
    )
  }
})

// Handle Server-Sent Events streaming
function handleServerSentEvents(subscriptionId: string, subscription: any) {
  const stream = new ReadableStream({
    start(controller) {
      console.log('📡 Starting SSE stream for:', subscriptionId)

      // Send initial connection event
      const initEvent = `data: ${JSON.stringify({
        type: 'connected',
        subscriptionId,
        timestamp: new Date().toISOString()
      })}\n\n`
      
      controller.enqueue(new TextEncoder().encode(initEvent))

      // Set up polling for updates
      const pollInterval = setInterval(() => {
        try {
          // Check if subscription is still active
          const currentSub = analyticsWebSocket.getSubscription(subscriptionId)
          if (!currentSub || !currentSub.active) {
            console.log('📡 Subscription inactive, closing SSE:', subscriptionId)
            clearInterval(pollInterval)
            controller.close()
            return
          }

          // Get pending updates
          const updates = analyticsWebSocket.getPendingUpdates(subscriptionId)
          
          if (updates.length > 0) {
            for (const update of updates) {
              const event = `data: ${JSON.stringify({
                type: 'update',
                data: update,
                timestamp: new Date().toISOString()
              })}\n\n`
              
              controller.enqueue(new TextEncoder().encode(event))
            }
          } else {
            // Send heartbeat
            const heartbeat = `data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString()
            })}\n\n`
            
            controller.enqueue(new TextEncoder().encode(heartbeat))
          }

        } catch (error) {
          console.error('❌ SSE polling error:', error)
          clearInterval(pollInterval)
          controller.error(error)
        }
      }, 2000) // Poll every 2 seconds

      // Clean up on client disconnect
      const cleanup = () => {
        console.log('📡 Cleaning up SSE stream:', subscriptionId)
        clearInterval(pollInterval)
        analyticsWebSocket.unsubscribe(subscriptionId)
      }

      // Set timeout for cleanup (30 minutes max)
      setTimeout(cleanup, 30 * 60 * 1000)
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}
