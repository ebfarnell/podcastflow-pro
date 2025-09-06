import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { EpisodeStatus } from '@prisma/client'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


async function getHandler(request: AuthenticatedRequest) {
  try {
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

    // Get query parameters
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const showId = url.searchParams.get('showId')
    const producerId = url.searchParams.get('producerId')
    const assignedOnly = url.searchParams.get('assignedOnly') === 'true'
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const sort = url.searchParams.get('sort') || 'releaseDate:desc'

    console.log('🎙️ Episodes API: Fetching episodes', { status, showId, producerId, assignedOnly, limit, sort })

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build query with filters
    let whereConditions = []
    let queryParams = []
    let paramIndex = 1

    // Add status filter
    if (status && status !== 'all') {
      whereConditions.push(`e.status = $${paramIndex}`)
      queryParams.push(status)
      paramIndex++
    }

    // Add show filter
    if (showId && showId !== 'all') {
      whereConditions.push(`e."showId" = $${paramIndex}`)
      queryParams.push(showId)
      paramIndex++
    }

    // For talent/producers, filter by assigned shows if requested
    if (assignedOnly && (user.role === 'talent' || user.role === 'producer')) {
      // First get assigned shows
      const assignedShowsQuery = `
        SELECT DISTINCT s.id 
        FROM "Show" s
        INNER JOIN "_ShowToUser" stu ON stu."A" = s.id
        WHERE stu."B" = $1
      `
      const assignedShows = await querySchema<{id: string}>(orgSlug, assignedShowsQuery, [user.id])
      
      if (assignedShows.length > 0) {
        const showIds = assignedShows.map(s => s.id)
        whereConditions.push(`e."showId" = ANY($${paramIndex}::text[])`)
        queryParams.push(showIds)
        paramIndex++
      } else {
        // No assigned shows, return empty result
        return NextResponse.json({
          episodes: [],
          total: 0,
          success: true
        })
      }
    }

    // Filter by producer if producerId is specified
    if (producerId) {
      const producerShowsQuery = `
        SELECT DISTINCT s.id 
        FROM "Show" s
        INNER JOIN "_ShowToUser" stu ON stu."A" = s.id
        WHERE stu."B" = $1
      `
      const producerShows = await querySchema<{id: string}>(orgSlug, producerShowsQuery, [producerId])
      
      if (producerShows.length > 0) {
        const showIds = producerShows.map(s => s.id)
        whereConditions.push(`e."showId" = ANY($${paramIndex}::text[])`)
        queryParams.push(showIds)
        paramIndex++
      } else {
        // No shows for this producer
        return NextResponse.json({
          episodes: [],
          total: 0,
          success: true
        })
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const orderBy = sort.startsWith('releaseDate') 
      ? `ORDER BY e."airDate" ${sort.endsWith('desc') ? 'DESC' : 'ASC'}`
      : 'ORDER BY e."episodeNumber" DESC'

    // Fetch episodes from organization schema
    const episodesQuery = `
      SELECT 
        e.*,
        s.name as "showName",
        s.host as "showHost",
        s.category as "showCategory"
      FROM "Episode" e
      INNER JOIN "Show" s ON s.id = e."showId"
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex}
    `
    queryParams.push(limit)
    
    const episodes = await querySchema<any>(orgSlug, episodesQuery, queryParams)

    // Transform episodes data for compatibility
    const transformedEpisodes = episodes.map(episode => ({
      id: episode.id,
      episodeId: episode.id, // For backwards compatibility
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
      assignedTalent: [], // Would need to add this to schema
      sponsorSegments: [], // Would need to add this to schema
      createdAt: episode.createdAt,
      updatedAt: episode.updatedAt,
      show: {
        id: episode.showId,
        name: episode.showName,
        host: episode.showHost,
        category: episode.showCategory
      }
    }))

    console.log(`✅ Episodes API: Returning ${transformedEpisodes.length} episodes`)
    
    return NextResponse.json({
      episodes: transformedEpisodes,
      total: transformedEpisodes.length,
      success: true
    })

  } catch (error) {
    console.error('❌ Episodes API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
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

    // Only producers and admin can create episodes
    if (!['producer', 'admin', 'master'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { showId, episodeNumber, title, description, duration, releaseDate } = body

    // Validate required fields
    if (!showId || !title || !episodeNumber) {
      return NextResponse.json(
        { error: 'showId, title, and episodeNumber are required' },
        { status: 400 }
      )
    }

    // Get organization slug
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify show exists and user has access
    let showQuery = `
      SELECT s.* FROM "Show" s
      WHERE s.id = $1 AND s."organizationId" = $2
    `
    let showParams = [showId, user.organizationId]
    
    // For producers, also check assignment
    if (user.role === 'producer') {
      showQuery += `
        AND EXISTS (
          SELECT 1 FROM "_ShowToUser" stu 
          WHERE stu."A" = s.id AND stu."B" = $3
        )
      `
      showParams.push(user.id)
    }
    
    const showResult = await querySchema<any>(orgSlug, showQuery, showParams)
    const show = showResult[0]

    if (!show) {
      return NextResponse.json(
        { error: 'Show not found or access denied' },
        { status: 404 }
      )
    }

    // Generate unique ID for the episode
    const episodeId = `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create episode in organization schema
    const createEpisodeQuery = `
      INSERT INTO "Episode" (
        id,
        "showId",
        "episodeNumber",
        title,
        description,
        duration,
        "airDate",
        status,
        "createdBy",
        "organizationId",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
      )
      RETURNING *
    `
    
    const episodeParams = [
      episodeId,
      showId,
      episodeNumber,
      title,
      description || null,
      duration || 30,
      releaseDate ? new Date(releaseDate) : null,
      'draft',
      user.id,
      user.organizationId
    ]
    
    const newEpisodeResult = await querySchema<any>(orgSlug, createEpisodeQuery, episodeParams)
    const newEpisode = newEpisodeResult[0]

    console.log(`✅ Episodes API: Created new episode: ${title}`)

    const transformedEpisode = {
      id: newEpisode.id,
      episodeId: newEpisode.id,
      showId: newEpisode.showId,
      showName: show.name,
      episodeNumber: newEpisode.episodeNumber,
      title: newEpisode.title,
      description: newEpisode.description || '',
      duration: newEpisode.duration,
      releaseDate: newEpisode.airDate || newEpisode.createdAt,
      airDate: newEpisode.airDate,
      status: newEpisode.status,
      scriptUrl: newEpisode.scriptUrl || '',
      audioUrl: newEpisode.audioUrl || '',
      assignedTalent: [],
      sponsorSegments: [],
      createdAt: newEpisode.createdAt,
      updatedAt: newEpisode.updatedAt,
      show: {
        id: show.id,
        name: show.name,
        host: show.host,
        category: show.category
      }
    }

    return NextResponse.json({
      success: true,
      episode: transformedEpisode
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Episodes API Error:', error)
    return NextResponse.json(
      { error: 'Failed to create episode' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest) => {
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
  
  return getHandler(authenticatedRequest)
}

// Use direct function export to fix production build issue
export const POST = async (request: NextRequest) => {
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
  
  return postHandler(authenticatedRequest)
}
