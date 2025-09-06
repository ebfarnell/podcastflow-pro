import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { realTimeAnalytics } from '@/lib/analytics/real-time-pipeline'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/analytics/real-time - Ingest analytics events
export const POST = await withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { events, event } = body

    console.log('📊 Ingesting real-time analytics:', {
      singleEvent: !!event,
      batchEvents: events?.length || 0
    })

    if (event) {
      // Single event
      await realTimeAnalytics.ingestEvent(event)
      
      return NextResponse.json({
        success: true,
        message: 'Event ingested successfully',
        timestamp: new Date().toISOString()
      })
    }

    if (events && Array.isArray(events)) {
      // Batch events
      await realTimeAnalytics.ingestBatch(events)
      
      return NextResponse.json({
        success: true,
        message: `${events.length} events ingested successfully`,
        count: events.length,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json(
      { error: 'Either "event" or "events" array is required' },
      { status: 400 }
    )

  } catch (error) {
    console.error('❌ Real-time analytics ingestion error:', error)
    return NextResponse.json(
      { error: 'Failed to ingest analytics events' },
      { status: 500 }
    )
  }
})

// GET /api/analytics/real-time - Get pipeline status
export const GET = await withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const organizationId = searchParams.get('organizationId')
    const timeWindow = parseInt(searchParams.get('timeWindow') || '3600')

    console.log('📊 Getting real-time analytics:', { campaignId, organizationId, timeWindow })

    const status = realTimeAnalytics.getStatus()

    let metrics = null
    let organizationMetrics = null

    if (campaignId) {
      metrics = await realTimeAnalytics.getRealTimeMetrics(campaignId, timeWindow)
    }

    if (organizationId) {
      organizationMetrics = await realTimeAnalytics.getOrganizationMetrics(organizationId, timeWindow)
    }

    return NextResponse.json({
      status,
      metrics,
      organizationMetrics,
      timeWindow,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Real-time analytics status error:', error)
    return NextResponse.json(
      { error: 'Failed to get real-time analytics status' },
      { status: 500 }
    )
  }
})
