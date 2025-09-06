/**
 * Enhanced Show Metrics API v2
 * Uses real YouTube and Megaphone data with the ShowMetricsAggregator
 * 
 * GET /api/shows/[id]/metrics/v2
 */

import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug } from '@/lib/db/schema-db'
import { ShowMetricsAggregator } from '@/server/aggregators/showMetrics'
import { v4 as uuidv4 } from 'uuid'

// Force dynamic rendering for routes that use cookies/auth
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Feature flag - can be controlled via environment variable
const SHOW_VIEW_DETAILS_REAL_DATA = process.env.SHOW_VIEW_DETAILS_REAL_DATA === 'true' || false

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const correlationId = uuidv4()
  
  try {
    const showId = params.id
    
    // Parse query parameters
    const url = new URL(request.url)
    const window = url.searchParams.get('window') || '30d'
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined
    
    if (!showId) {
      console.log(`[${correlationId}] Missing showId`)
      return NextResponse.json(
        { code: 'E_INPUT', message: 'Show ID is required', correlationId },
        { status: 400 }
      )
    }
    
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { code: 'E_AUTH', message: 'Unauthorized', correlationId },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { code: 'E_AUTH', message: 'Unauthorized', correlationId },
        { status: 401 }
      )
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json(
        { code: 'E_ORG', message: 'Organization not found', correlationId },
        { status: 404 }
      )
    }

    // Get organization ID
    const orgId = user.organizationId
    if (!orgId) {
      return NextResponse.json(
        { code: 'E_ORG', message: 'User not associated with an organization', correlationId },
        { status: 400 }
      )
    }

    console.log(`[${correlationId}] Fetching enhanced metrics for show ${showId}`, {
      orgId,
      orgSlug,
      window,
      startDate,
      endDate,
      featureFlag: SHOW_VIEW_DETAILS_REAL_DATA
    })

    // Check feature flag
    if (!SHOW_VIEW_DETAILS_REAL_DATA) {
      // Return mock response for backward compatibility
      return NextResponse.json({
        message: 'Real data feature disabled. Enable SHOW_VIEW_DETAILS_REAL_DATA to use.',
        show: { id: showId, name: 'Mock Show' },
        totals: {
          youtubeViews: null,
          megaphoneDownloads: null,
          likes: null,
          comments: null,
          avgViewDurationSec: null,
          uniqueViewers: null,
          uniqueListeners: null,
          subscriberCount: null,
        },
        timeseries: { daily: [] },
        engagement: {
          likeRate: null,
          commentRate: null,
          viewThroughRate: null,
          listenThroughRate: null,
        },
        freshness: {},
        status: {
          youtubeConnected: false,
          megaphoneConnected: false,
          youtubeOAuthRequired: false,
          partialData: false,
          errors: ['Feature flag SHOW_VIEW_DETAILS_REAL_DATA is disabled'],
        }
      })
    }

    // Use the aggregator to fetch real data
    const aggregator = new ShowMetricsAggregator(orgId, orgSlug)
    
    try {
      const metrics = await aggregator.getShowMetrics({
        orgId,
        orgSlug,
        showId,
        window: window as '30d' | '90d' | 'custom',
        startDate,
        endDate,
      })

      console.log(`[${correlationId}] Successfully aggregated metrics`, {
        youtubeConnected: metrics.status.youtubeConnected,
        megaphoneConnected: metrics.status.megaphoneConnected,
        hasYouTubeData: metrics.totals.youtubeViews !== null,
        hasMegaphoneData: metrics.totals.megaphoneDownloads !== null,
        timeseriesCount: metrics.timeseries.daily.length,
        errors: metrics.status.errors,
      })

      return NextResponse.json(metrics)
    } catch (aggregatorError: any) {
      console.error(`[${correlationId}] Aggregator error:`, aggregatorError)
      
      // Return partial response even if aggregator fails
      return NextResponse.json({
        show: { id: showId, name: 'Unknown' },
        totals: {
          youtubeViews: null,
          megaphoneDownloads: null,
          likes: null,
          comments: null,
          avgViewDurationSec: null,
          uniqueViewers: null,
          uniqueListeners: null,
          subscriberCount: null,
        },
        timeseries: { daily: [] },
        engagement: {
          likeRate: null,
          commentRate: null,
          viewThroughRate: null,
          listenThroughRate: null,
        },
        freshness: {},
        status: {
          youtubeConnected: false,
          megaphoneConnected: false,
          youtubeOAuthRequired: false,
          partialData: true,
          errors: [aggregatorError.message || 'Failed to aggregate metrics'],
        }
      })
    }

  } catch (error: any) {
    console.error(`[${correlationId}] Show metrics v2 error:`, error)
    return NextResponse.json(
      { 
        code: 'E_UNEXPECTED',
        message: 'Failed to get show metrics',
        correlationId,
        error: error.message
      },
      { status: 500 }
    )
  }
}