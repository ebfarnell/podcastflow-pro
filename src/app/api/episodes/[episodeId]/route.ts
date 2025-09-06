import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { EpisodeStatus } from '@prisma/client'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


async function getHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  try {
    // Await the params promise
    const { episodeId } = await params

    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    console.log(`🎙️ Episodes API: Fetching episode ${episodeId} for org ${orgSlug}`)

    // Fetch episode from organization schema including YouTube fields
    const episodeQuery = `
      SELECT 
        e.*,
        s.name as "showName",
        s."organizationId" as "showOrgId",
        s.host as "showHost",
        s.category as "showCategory",
        s."youtubeChannelId",
        s."youtubeChannelUrl"
      FROM "Episode" e
      INNER JOIN "Show" s ON s.id = e."showId"
      WHERE e.id = $1
    `
    
    const episodeResult = await querySchema<any>(orgSlug, episodeQuery, [episodeId])
    const episode = episodeResult[0]

    if (!episode) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (episode.showOrgId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Transform for compatibility - include YouTube data
    const transformedEpisode = {
      id: episode.id,
      episodeId: episode.id,
      showId: episode.showId,
      showName: episode.showName,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      description: episode.description || '',
      duration: episode.duration,
      releaseDate: episode.airDate || episode.createdAt,
      airDate: episode.airDate,
      status: episode.status,
      scriptUrl: episode.scriptUrl || '',
      audioUrl: episode.audioUrl || '',
      assignedTalent: [],
      sponsorSegments: [],
      createdAt: episode.createdAt,
      updatedAt: episode.updatedAt,
      // YouTube fields - including new analytics fields
      youtubeVideoId: episode.youtubeVideoId,
      youtubeUrl: episode.youtubeUrl,
      youtubeViewCount: episode.youtubeViewCount,
      youtubeLikeCount: episode.youtubeLikeCount,
      youtubeCommentCount: episode.youtubeCommentCount,
      youtubeDuration: episode.youtubeDuration,
      youtubeThumbnailUrl: episode.youtubeThumbnailUrl,
      youtubePublishedAt: episode.youtubePublishedAt,
      youtubeAvgViewDuration: episode.youtubeAvgViewDuration,
      youtubeAvgViewPercentage: episode.youtubeAvgViewPercentage,
      youtubeWatchTimeHours: episode.youtubeWatchTimeHours,
      youtubeImpressions: episode.youtubeImpressions,
      youtubeCTR: episode.youtubeCTR,
      youtubeSubscribersGained: episode.youtubeSubscribersGained,
      youtubeSubscribersLost: episode.youtubeSubscribersLost,
      youtubeEstimatedMinutesWatched: episode.youtubeEstimatedMinutesWatched,
      youtubeShares: episode.youtubeShares,
      youtubeDislikeCount: episode.youtubeDislikeCount,
      youtubeRetentionRate: episode.youtubeRetentionRate,
      youtubeLastSyncedAt: episode.youtubeLastSyncedAt,
      // Calculate net subscribers
      youtubeNewSubscribers: (episode.youtubeSubscribersGained || 0) - (episode.youtubeSubscribersLost || 0),
      // Megaphone fields
      megaphoneId: episode.megaphoneId,
      megaphoneDownloads: episode.megaphoneDownloads,
      megaphoneUniqueListeners: episode.megaphoneUniqueListeners,
      megaphoneCompletionRate: episode.megaphoneCompletionRate,
      show: {
        id: episode.showId,
        name: episode.showName,
        host: episode.showHost,
        category: episode.showCategory,
        youtubeChannelId: episode.youtubeChannelId,
        youtubeChannelUrl: episode.youtubeChannelUrl
      }
    }

    console.log(`✅ Episodes API: Retrieved episode: ${episode.title}`)

    return NextResponse.json(transformedEpisode)

  } catch (error) {
    console.error('❌ Episodes API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function putHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  try {
    // Await the params promise
    const { episodeId } = await params

    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only producers and admin can update episodes
    if (!['producer', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, duration, releaseDate, status, scriptUrl, audioUrl } = body

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get existing episode
    const episodeQuery = `
      SELECT 
        e.*,
        s.name as "showName",
        s."organizationId" as "showOrgId",
        s.id as "showId"
      FROM "Episode" e
      INNER JOIN "Show" s ON s.id = e."showId"
      WHERE e.id = $1
    `
    
    const episodeResult = await querySchema<any>(orgSlug, episodeQuery, [episodeId])
    const existingEpisode = episodeResult[0]

    if (!existingEpisode) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (existingEpisode.showOrgId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // For producers, verify they're assigned to the show
    if (user.role === 'producer') {
      const assignmentCheck = await querySchema<any>(
        orgSlug,
        `SELECT 1 FROM "_ShowToUser" WHERE "A" = $1 AND "B" = $2`,
        [existingEpisode.showId, user.id]
      )

      if (assignmentCheck.length === 0) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Build update query
    const updateFields = []
    const updateParams = []
    let paramIndex = 1

    if (title !== undefined) {
      updateFields.push(`title = $${paramIndex++}`)
      updateParams.push(title)
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`)
      updateParams.push(description)
    }
    if (duration !== undefined) {
      updateFields.push(`duration = $${paramIndex++}`)
      updateParams.push(duration)
    }
    if (releaseDate !== undefined) {
      updateFields.push(`"airDate" = $${paramIndex++}`)
      updateParams.push(releaseDate ? new Date(releaseDate) : null)
    }
    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`)
      updateParams.push(status)
    }
    if (scriptUrl !== undefined) {
      updateFields.push(`"scriptUrl" = $${paramIndex++}`)
      updateParams.push(scriptUrl)
    }
    if (audioUrl !== undefined) {
      updateFields.push(`"audioUrl" = $${paramIndex++}`)
      updateParams.push(audioUrl)
    }

    updateFields.push(`"updatedBy" = $${paramIndex++}`)
    updateParams.push(user.id)
    updateFields.push(`"updatedAt" = NOW()`)

    // Add episode ID for WHERE clause
    updateParams.push(episodeId)

    const updateQuery = `
      UPDATE "Episode"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const updateResult = await querySchema<any>(orgSlug, updateQuery, updateParams)
    const updatedEpisode = updateResult[0]

    console.log(`✅ Episodes API: Updated episode: ${updatedEpisode.title}`)

    const transformedEpisode = {
      id: updatedEpisode.id,
      episodeId: updatedEpisode.id,
      showId: updatedEpisode.showId,
      showName: existingEpisode.showName,
      episodeNumber: updatedEpisode.episodeNumber,
      title: updatedEpisode.title,
      description: updatedEpisode.description || '',
      duration: updatedEpisode.duration,
      releaseDate: updatedEpisode.airDate || updatedEpisode.createdAt,
      airDate: updatedEpisode.airDate,
      status: updatedEpisode.status,
      scriptUrl: updatedEpisode.scriptUrl || '',
      audioUrl: updatedEpisode.audioUrl || '',
      assignedTalent: [],
      sponsorSegments: [],
      createdAt: updatedEpisode.createdAt,
      updatedAt: updatedEpisode.updatedAt
    }

    return NextResponse.json({
      success: true,
      episode: transformedEpisode
    })

  } catch (error) {
    console.error('❌ Episodes API Error:', error)
    return NextResponse.json(
      { error: 'Failed to update episode' },
      { status: 500 }
    )
  }
}

async function deleteHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  try {
    // Await the params promise
    const { episodeId } = await params

    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admin and master can delete episodes
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Only administrators can delete episodes' },
        { status: 403 }
      )
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if episode exists
    const episodeQuery = `
      SELECT 
        e.*,
        s.name as "showName",
        s."organizationId" as "showOrgId"
      FROM "Episode" e
      INNER JOIN "Show" s ON s.id = e."showId"
      WHERE e.id = $1
    `
    
    const episodeResult = await querySchema<any>(orgSlug, episodeQuery, [episodeId])
    const existingEpisode = episodeResult[0]

    if (!existingEpisode) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (existingEpisode.showOrgId !== user.organizationId && user.role !== 'master') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Delete episode
    await querySchema(orgSlug, 'DELETE FROM "Episode" WHERE id = $1', [episodeId])

    console.log(`✅ Episodes API: Deleted episode: ${existingEpisode.title}`)

    return NextResponse.json({
      success: true,
      message: 'Episode deleted successfully'
    })

  } catch (error) {
    console.error('❌ Episodes API Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete episode' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest, context: { params: Promise<{ episodeId: string }> }) => {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Validate session and get user
    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Add user to request
    const authenticatedRequest = request as AuthenticatedRequest
    authenticatedRequest.user = user
    
    return getHandler(authenticatedRequest, { params: context.params })
  } catch (error) {
    console.error('GET /api/episodes/[episodeId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Use direct function export to fix production build issue
export const PUT = async (request: NextRequest, context: { params: Promise<{ episodeId: string }> }) => {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Validate session and get user
    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Add user to request
    const authenticatedRequest = request as AuthenticatedRequest
    authenticatedRequest.user = user
    
    return putHandler(authenticatedRequest, { params: context.params })
  } catch (error) {
    console.error('PUT /api/episodes/[episodeId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Use direct function export to fix production build issue
export const DELETE = async (request: NextRequest, context: { params: Promise<{ episodeId: string }> }) => {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Validate session and get user
    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Add user to request
    const authenticatedRequest = request as AuthenticatedRequest
    authenticatedRequest.user = user
    
    return deleteHandler(authenticatedRequest, { params: context.params })
  } catch (error) {
    console.error('DELETE /api/episodes/[episodeId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
