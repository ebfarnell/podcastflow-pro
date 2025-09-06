import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth/api-protection'
import { realTimeAnalytics } from '@/lib/analytics/real-time-pipeline'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/analytics/real-time/dashboard - Get real-time dashboard metrics
export const GET = await withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const timeWindow = parseInt(searchParams.get('timeWindow') || '3600') // Default 1 hour

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      )
    }

    console.log('📊 Getting real-time dashboard metrics:', { organizationId, timeWindow })

    // Get organization metrics
    const campaignMetrics = await realTimeAnalytics.getOrganizationMetrics(organizationId, timeWindow)

    // Calculate aggregated metrics
    const aggregated = campaignMetrics.reduce((acc, metrics) => ({
      totalImpressions: acc.totalImpressions + metrics.impressions,
      totalClicks: acc.totalClicks + metrics.clicks,
      totalConversions: acc.totalConversions + metrics.conversions,
      totalSpent: acc.totalSpent + metrics.totalSpent,
      totalAdPlaybacks: acc.totalAdPlaybacks + metrics.adPlaybacks,
      totalViewTime: acc.totalViewTime + (metrics.averageViewTime * metrics.adPlaybacks),
      activeCampaigns: acc.activeCampaigns + 1
    }), {
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalSpent: 0,
      totalAdPlaybacks: 0,
      totalViewTime: 0,
      activeCampaigns: 0
    })

    // Calculate overall rates
    const overallCtr = aggregated.totalImpressions > 0 
      ? (aggregated.totalClicks / aggregated.totalImpressions) * 100 
      : 0

    const overallConversionRate = aggregated.totalClicks > 0 
      ? (aggregated.totalConversions / aggregated.totalClicks) * 100 
      : 0

    const overallCpc = aggregated.totalClicks > 0 
      ? aggregated.totalSpent / aggregated.totalClicks 
      : 0

    const overallCpa = aggregated.totalConversions > 0 
      ? aggregated.totalSpent / aggregated.totalConversions 
      : 0

    const averageViewTime = aggregated.totalAdPlaybacks > 0 
      ? aggregated.totalViewTime / aggregated.totalAdPlaybacks 
      : 0

    // Get top performing campaigns
    const topCampaigns = campaignMetrics
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5)
      .map(metrics => ({
        campaignId: metrics.campaignId,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        conversions: metrics.conversions,
        ctr: metrics.ctr,
        spent: metrics.totalSpent
      }))

    // Get recent activity trends (last hour in 5-minute intervals)
    const trendData = await getTrendData(organizationId, timeWindow)

    return NextResponse.json({
      success: true,
      organizationId,
      timeWindow,
      summary: {
        totalImpressions: aggregated.totalImpressions,
        totalClicks: aggregated.totalClicks,
        totalConversions: aggregated.totalConversions,
        totalSpent: aggregated.totalSpent,
        activeCampaigns: aggregated.activeCampaigns,
        overallCtr,
        overallConversionRate,
        overallCpc,
        overallCpa,
        averageViewTime
      },
      topCampaigns,
      trendData,
      campaignMetrics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Real-time dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to get real-time dashboard metrics' },
      { status: 500 }
    )
  }
})

// Helper function to get trend data
async function getTrendData(organizationId: string, timeWindow: number) {
  try {
    const prisma = (await import('@/lib/db/prisma')).default
    
    // Get analytics for the time window in hourly buckets
    const startTime = new Date(Date.now() - timeWindow * 1000)
    
    const analytics = await prisma.campaignAnalytics.findMany({
      where: {
        organizationId,
        date: {
          gte: startTime
        }
      },
      include: {
        campaign: {
          select: { name: true }
        }
      },
      orderBy: { date: 'asc' }
    })

    // Group by hour
    const hourlyData = analytics.reduce((acc, record) => {
      const hourKey = new Date(record.date).toISOString().substring(0, 13) + ':00:00.000Z'
      
      if (!acc[hourKey]) {
        acc[hourKey] = {
          timestamp: hourKey,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spent: 0
        }
      }

      acc[hourKey].impressions += record.impressions
      acc[hourKey].clicks += record.clicks
      acc[hourKey].conversions += record.conversions
      acc[hourKey].spent += record.spent

      return acc
    }, {} as any)

    return Object.values(hourlyData).slice(-12) // Last 12 hours

  } catch (error) {
    console.error('❌ Error getting trend data:', error)
    return []
  }
}
