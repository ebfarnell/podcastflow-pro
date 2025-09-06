import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/auth-middleware'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { episodeId: string } }
) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { episodeId } = params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

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
        'GET',
        `/api/analytics/episodes/${episodeId}/trends`,
        request
      )
    }

    // Verify episode exists and user has access
    const episodeQuery = `SELECT id FROM "Episode" WHERE id = $1`
    const episodes = await querySchema<any>(orgSlug, episodeQuery, [episodeId])
    
    if (!episodes || episodes.length === 0) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    // Calculate date range
    const now = new Date()
    let fromDate: Date
    let toDate = endDate ? new Date(endDate) : now

    if (startDate) {
      fromDate = new Date(startDate)
    } else {
      switch (period) {
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        case '1y':
          fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
        default:
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }
    }

    // Fetch daily analytics data for trends using schema-aware queries
    const analyticsQuery = `
      SELECT 
        date, downloads, "uniqueListeners", completions, "adRevenue",
        "spotifyListens", "appleListens", "googleListens", "otherListens",
        shares, likes, comments, "avgListenTime"
      FROM "EpisodeAnalytics"
      WHERE "episodeId" = $1 AND date >= $2 AND date <= $3
      ORDER BY date ASC
    `
    const analyticsData = await querySchema<any>(orgSlug, analyticsQuery, [episodeId, fromDate, toDate])

    // Transform data for frontend consumption
    const trendsData = analyticsData.map(record => ({
      date: new Date(record.date).toISOString().split('T')[0], // Format as YYYY-MM-DD
      downloads: record.downloads,
      listeners: record.uniqueListeners,
      completions: record.completions,
      revenue: Number(record.adRevenue),
      platforms: {
        spotify: record.spotifyListens,
        apple: record.appleListens,
        google: record.googleListens,
        other: record.otherListens
      },
      engagement: {
        shares: record.shares,
        likes: record.likes,
        comments: record.comments,
        avgListenTime: record.avgListenTime
      }
    }))

    // Fill in missing dates with zero values if needed
    const allDates: string[] = []
    const currentDate = new Date(fromDate)
    while (currentDate <= toDate) {
      allDates.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    const completeData = allDates.map(date => {
      const existingData = trendsData.find(d => d.date === date)
      return existingData || {
        date,
        downloads: 0,
        listeners: 0,
        completions: 0,
        revenue: 0,
        platforms: { spotify: 0, apple: 0, google: 0, other: 0 },
        engagement: { shares: 0, likes: 0, comments: 0, avgListenTime: 0 }
      }
    })

    return NextResponse.json({
      episodeId,
      period,
      totalDataPoints: completeData.length,
      trends: completeData
    })

  } catch (error) {
    console.error('Episode trends API error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch episode trends',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}