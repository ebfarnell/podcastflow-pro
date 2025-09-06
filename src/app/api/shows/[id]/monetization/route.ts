import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { id: showId } = params

    // Get monetization fields from Show table
    const query = `
      SELECT 
        "pricingModel",
        "preRollCpm",
        "preRollSpotCost",
        "midRollCpm",
        "midRollSpotCost",
        "postRollCpm",
        "postRollSpotCost",
        "preRollSlots",
        "midRollSlots",
        "postRollSlots",
        "avgEpisodeDownloads",
        "selloutProjection",
        "estimatedEpisodeValue"
      FROM "Show"
      WHERE id = $1 AND "organizationId" = $2
    `

    const result = await querySchema<any>(orgSlug, query, [showId, user.organizationId])

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    const monetizationData = result[0]

    // Calculate the real average downloads from last 3 months
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const startDate = threeMonthsAgo.toISOString().split('T')[0]
    const endDate = new Date().toISOString().split('T')[0]

    // Get YouTube and Megaphone averages for last 3 months
    const metricsQuery = `
      SELECT 
        -- YouTube metrics (from Episode data)
        COALESCE(AVG(e."youtubeViewCount"), 0) as avg_youtube_views,
        -- Megaphone metrics
        COALESCE(AVG(e."megaphoneDownloads"), 0) as avg_megaphone_downloads,
        -- Combined total
        COALESCE(AVG(COALESCE(e."youtubeViewCount", 0) + COALESCE(e."megaphoneDownloads", 0)), 0) as avg_combined_reach,
        -- Episode count for context
        COUNT(DISTINCT e.id) as episode_count
      FROM "Episode" e
      WHERE e."showId" = $1 
        AND e.status = 'published'
        AND e."airDate" >= $2::date 
        AND e."airDate" <= $3::date
    `

    const metricsResult = await querySchema<any>(orgSlug, metricsQuery, [showId, startDate, endDate])
    
    const metrics = metricsResult?.[0] || {
      avg_youtube_views: 0,
      avg_megaphone_downloads: 0,
      avg_combined_reach: 0,
      episode_count: 0
    }

    // If we calculated a real average and it's different from stored value, use the calculated one
    const calculatedAvg = Math.round(parseFloat(metrics.avg_combined_reach))
    
    // Return the monetization data with the calculated average if available
    return NextResponse.json({
      ...monetizationData,
      avgEpisodeDownloads: calculatedAvg > 0 ? calculatedAvg : (monetizationData.avgEpisodeDownloads || 0),
      // Include metrics breakdown for the UI
      metricsBreakdown: {
        avgYoutubeViews: Math.round(parseFloat(metrics.avg_youtube_views)),
        avgMegaphoneDownloads: Math.round(parseFloat(metrics.avg_megaphone_downloads)),
        episodeCount: parseInt(metrics.episode_count),
        dateRange: `${startDate} to ${endDate}`,
        calculationNote: 'Average calculated from last 3 months of published episodes'
      }
    })

  } catch (error) {
    console.error('❌ Show monetization fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monetization data' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can update monetization
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { id: showId } = params
    const body = await request.json()
    const {
      pricingModel,
      preRollCpm,
      preRollSpotCost,
      midRollCpm,
      midRollSpotCost,
      postRollCpm,
      postRollSpotCost,
      preRollSlots,
      midRollSlots,
      postRollSlots,
      avgEpisodeDownloads,
      selloutProjection,
      estimatedEpisodeValue
    } = body

    // Build update query dynamically
    const updateFields: string[] = []
    const updateParams: any[] = []
    let paramIndex = 1

    if (pricingModel !== undefined) {
      updateFields.push(`"pricingModel" = $${paramIndex++}`)
      updateParams.push(pricingModel)
    }

    if (preRollCpm !== undefined) {
      updateFields.push(`"preRollCpm" = $${paramIndex++}`)
      updateParams.push(preRollCpm)
    }

    if (preRollSpotCost !== undefined) {
      updateFields.push(`"preRollSpotCost" = $${paramIndex++}`)
      updateParams.push(preRollSpotCost)
    }

    if (midRollCpm !== undefined) {
      updateFields.push(`"midRollCpm" = $${paramIndex++}`)
      updateParams.push(midRollCpm)
    }

    if (midRollSpotCost !== undefined) {
      updateFields.push(`"midRollSpotCost" = $${paramIndex++}`)
      updateParams.push(midRollSpotCost)
    }

    if (postRollCpm !== undefined) {
      updateFields.push(`"postRollCpm" = $${paramIndex++}`)
      updateParams.push(postRollCpm)
    }

    if (postRollSpotCost !== undefined) {
      updateFields.push(`"postRollSpotCost" = $${paramIndex++}`)
      updateParams.push(postRollSpotCost)
    }

    if (preRollSlots !== undefined) {
      updateFields.push(`"preRollSlots" = $${paramIndex++}`)
      updateParams.push(preRollSlots)
    }

    if (midRollSlots !== undefined) {
      updateFields.push(`"midRollSlots" = $${paramIndex++}`)
      updateParams.push(midRollSlots)
    }

    if (postRollSlots !== undefined) {
      updateFields.push(`"postRollSlots" = $${paramIndex++}`)
      updateParams.push(postRollSlots)
    }

    if (avgEpisodeDownloads !== undefined) {
      updateFields.push(`"avgEpisodeDownloads" = $${paramIndex++}`)
      updateParams.push(avgEpisodeDownloads)
    }

    if (selloutProjection !== undefined) {
      updateFields.push(`"selloutProjection" = $${paramIndex++}`)
      updateParams.push(selloutProjection)
    }

    if (estimatedEpisodeValue !== undefined) {
      updateFields.push(`"estimatedEpisodeValue" = $${paramIndex++}`)
      updateParams.push(estimatedEpisodeValue)
    }

    // Always update timestamp
    updateFields.push(`"updatedAt" = $${paramIndex++}`)
    updateParams.push(new Date())
    updateFields.push(`"updatedBy" = $${paramIndex++}`)
    updateParams.push(user.id)

    // Add showId and organizationId conditions
    updateParams.push(showId)
    updateParams.push(user.organizationId)

    const updateQuery = `
      UPDATE "Show"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND "organizationId" = $${paramIndex}
      RETURNING *
    `

    const result = await querySchema<any>(orgSlug, updateQuery, updateParams)

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      show: result[0]
    })

  } catch (error) {
    console.error('❌ Show monetization update error:', error)
    return NextResponse.json(
      { error: 'Failed to update monetization settings' },
      { status: 500 }
    )
  }
}