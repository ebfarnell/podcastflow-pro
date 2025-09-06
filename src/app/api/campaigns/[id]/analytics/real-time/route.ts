import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { realTimeAnalytics } from '@/lib/analytics/real-time-pipeline'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'
import { UserService } from '@/lib/auth/user-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/campaigns/[id]/analytics/real-time - Get real-time metrics for a campaign
export const GET = await withApiProtection(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const campaignId = params.id
    const { searchParams } = new URL(request.url)
    const timeWindow = parseInt(searchParams.get('timeWindow') || '3600') // Default 1 hour

    console.log('📊 Getting real-time campaign metrics:', { campaignId, timeWindow })

    const metrics = await realTimeAnalytics.getRealTimeMetrics(campaignId, timeWindow)

    if (!metrics) {
      return NextResponse.json({
        success: true,
        metrics: null,
        message: 'No recent analytics data found',
        timeWindow,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      metrics,
      timeWindow,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Real-time campaign metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to get real-time campaign metrics' },
      { status: 500 }
    )
  }
})

// POST /api/campaigns/[id]/analytics/real-time - Ingest analytics events for a campaign
export const POST = await withApiProtection(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const campaignId = params.id
    const body = await request.json()

    console.log('📊 Ingesting campaign analytics event:', { campaignId, eventType: body.eventType })

    // Get user for authorization
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'POST',
        `/api/campaigns/${campaignId}/analytics/real-time`,
        request
      )
    }
    
    // Get campaign to validate using schema-aware query
    const campaignQuery = `SELECT id, status FROM "Campaign" WHERE id = $1`
    const campaigns = await querySchema<any>(orgSlug, campaignQuery, [campaignId])
    
    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    const campaign = campaigns[0]

    if (campaign.status !== 'active') {
      return NextResponse.json(
        { error: 'Campaign is not active' },
        { status: 400 }
      )
    }

    // Create analytics event
    const event = {
      ...body,
      campaignId,
      organizationId: user.organizationId,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date()
    }

    await realTimeAnalytics.ingestEvent(event)

    return NextResponse.json({
      success: true,
      message: 'Analytics event ingested successfully',
      campaignId,
      eventType: body.eventType,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Campaign analytics event error:', error)
    return NextResponse.json(
      { error: 'Failed to ingest analytics event' },
      { status: 500 }
    )
  }
})
