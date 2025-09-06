import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { showMetricsService } from '@/lib/shows/show-metrics-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/shows/metrics/summary - Get metrics summary for all shows
export const GET = await withApiProtection(async (request: NextRequest) => {
  try {
    const { user } = request as any

    console.log('📊 Getting shows metrics summary for organization:', user.organizationId)

    const summary = await showMetricsService.getShowsMetricsSummary(user.organizationId)

    // Calculate totals
    const totals = summary.reduce((acc, show) => ({
      totalSubscribers: acc.totalSubscribers + show.totalSubscribers,
      monthlyDownloads: acc.monthlyDownloads + show.monthlyDownloads,
      averageListeners: acc.averageListeners + show.averageListeners,
      totalRevenue: acc.totalRevenue + show.totalRevenue,
      monthlyRevenue: acc.monthlyRevenue + show.monthlyRevenue
    }), {
      totalSubscribers: 0,
      monthlyDownloads: 0,
      averageListeners: 0,
      totalRevenue: 0,
      monthlyRevenue: 0
    })

    return NextResponse.json({
      shows: summary,
      totals,
      count: summary.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Shows metrics summary error:', error)
    return NextResponse.json(
      { error: 'Failed to get shows metrics summary' },
      { status: 500 }
    )
  }
})
