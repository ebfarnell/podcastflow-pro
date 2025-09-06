import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { activityService } from '@/lib/activities/activity-service'

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
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const sort = url.searchParams.get('sort') || 'createdAt:desc'
    const producerId = url.searchParams.get('producerId')

    console.log('🎙️ Shows API: Fetching shows', { status, limit, sort, producerId, userRole: user.role })

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Build query with filters
    let whereConditions = []
    let queryParams = []
    let paramIndex = 1

    if (status && status !== 'all') {
      whereConditions.push(`s."isActive" = $${paramIndex}`)
      queryParams.push(status === 'active')
      paramIndex++
    }

    // If producerId is provided or user is a producer, filter by assigned producer
    if (producerId || user.role === 'producer') {
      const filterProducerId = producerId || user.id
      whereConditions.push(`EXISTS (
        SELECT 1 FROM "_ShowToUser" stu 
        WHERE stu."A" = s.id AND stu."B" = $${paramIndex}
      )`)
      queryParams.push(filterProducerId)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const orderBy = sort.startsWith('createdAt') 
      ? `ORDER BY s."createdAt" ${sort.endsWith('desc') ? 'DESC' : 'ASC'}` 
      : 'ORDER BY s.name ASC'

    // Fetch shows with all related data
    const showsQuery = `
      SELECT 
        s.*,
        (
          SELECT COUNT(*)::int 
          FROM "Episode" e 
          WHERE e."showId" = s.id AND e.status = 'published'
        ) as "publishedEpisodeCount",
        (
          SELECT COUNT(*)::int 
          FROM "Episode" e 
          WHERE e."showId" = s.id
        ) as "totalEpisodeCount",
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            )
          )
          FROM public."User" u
          INNER JOIN "_ShowToUser" stu ON stu."B" = u.id
          WHERE stu."A" = s.id AND u.role = 'producer'
        ) as "assignedProducers",
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            )
          )
          FROM public."User" u
          INNER JOIN "_ShowToUser" stu ON stu."B" = u.id
          WHERE stu."A" = s.id AND u.role = 'talent'
        ) as "assignedTalent"
      FROM "Show" s
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex}
    `
    queryParams.push(limit)

    const shows = await querySchema(orgSlug, showsQuery, queryParams)

    // Fetch metrics for shows if they exist
    const showIds = shows.map((show: any) => show.id)
    const metricsQuery = `
      SELECT * FROM "ShowMetrics" 
      WHERE "showId" = ANY($1)
    `
    const metrics = await querySchema(orgSlug, metricsQuery, [showIds])
    const metricsMap = metrics.reduce((acc: any, metric: any) => {
      acc[metric.showId] = metric
      return acc
    }, {})

    // Transform shows data for compatibility
    const transformedShows = shows.map((show: any) => {
      const showMetrics = metricsMap[show.id]
      const producers = show.assignedProducers || []
      const talent = show.assignedTalent || []

      return {
        id: show.id,
        showId: show.id, // For backwards compatibility
        name: show.name,
        description: show.description || '',
        host: show.host || talent[0]?.name || 'Unknown Host',
        category: show.category || 'General',
        genre: show.category || 'General',
        frequency: show.releaseFrequency || 'weekly',
        status: show.isActive ? 'active' : 'inactive',
        assignedProducers: producers.map((p: any) => p.id),
        assignedTalent: talent.map((t: any) => t.id),
        producerNames: producers.map((p: any) => p.name),
        talentNames: talent.map((t: any) => t.name),
        episodeCount: show.totalEpisodeCount || 0,
        publishedEpisodeCount: show.publishedEpisodeCount || 0,
        subscribers: showMetrics?.totalSubscribers || 0,
        subscriberCount: showMetrics?.totalSubscribers || 0,
        subscriberGrowth: showMetrics?.subscriberGrowth || 0,
        averageListeners: showMetrics?.averageListeners || 0,
        createdAt: new Date(show.createdAt).toISOString(),
        updatedAt: new Date(show.updatedAt).toISOString()
      }
    })

    console.log(`✅ Shows API: Returning ${transformedShows.length} shows`)
    
    return NextResponse.json({
      shows: transformedShows,
      total: transformedShows.length,
      success: true
    })

  } catch (error) {
    console.error('❌ Shows API Error:', error)
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

    // Only admin can create shows
    if (user.role !== 'admin' && user.role !== 'master') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, assignedProducers, assignedTalent } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Create show
    const showId = 'show_' + Math.random().toString(36).substr(2, 16)
    const createShowQuery = `
      INSERT INTO "Show" (
        id, name, description, "isActive", "createdBy", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, true, $4, NOW(), NOW())
      RETURNING *
    `
    
    const newShows = await querySchema(
      orgSlug, 
      createShowQuery,
      [showId, name, description || '', user.id]
    )
    const newShow = newShows[0]

    // Assign producers and talent
    if (assignedProducers?.length > 0) {
      const producerValues = assignedProducers.map((producerId: string) => 
        `('${showId}', '${producerId}')`
      ).join(',')
      
      const assignProducersQuery = `
        INSERT INTO "_ShowToUser" ("A", "B") 
        VALUES ${producerValues}
      `
      await querySchema(orgSlug, assignProducersQuery)
    }

    if (assignedTalent?.length > 0) {
      const talentValues = assignedTalent.map((talentId: string) => 
        `('${showId}', '${talentId}')`
      ).join(',')
      
      const assignTalentQuery = `
        INSERT INTO "_ShowToUser" ("A", "B") 
        VALUES ${talentValues}
      `
      await querySchema(orgSlug, assignTalentQuery)
    }

    // Fetch the created show with assigned users
    const resultQuery = `
      SELECT 
        s.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            )
          )
          FROM public."User" u
          INNER JOIN "_ShowToUser" stu ON stu."B" = u.id
          WHERE stu."A" = s.id AND u.role = 'producer'
        ) as "assignedProducers",
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            )
          )
          FROM public."User" u
          INNER JOIN "_ShowToUser" stu ON stu."B" = u.id
          WHERE stu."A" = s.id AND u.role = 'talent'
        ) as "assignedTalent"
      FROM "Show" s
      WHERE s.id = $1
    `
    
    const result = await querySchema(orgSlug, resultQuery, [showId])
    const createdShow = result[0]

    console.log(`✅ Shows API: Created new show: ${name}`)

    // Log activity
    await activityService.logShowActivity(
      createdShow,
      'created',
      user,
      {
        assignedProducers: createdShow.assignedProducers?.map((p: any) => p.name) || [],
        assignedTalent: createdShow.assignedTalent?.map((t: any) => t.name) || []
      }
    )

    return NextResponse.json({
      success: true,
      show: {
        ...createdShow,
        showId: createdShow.id, // For backwards compatibility
        host: createdShow.assignedTalent?.[0]?.name || 'Unknown Host',
        category: 'General',
        genre: 'General',
        frequency: 'weekly',
        status: 'active',
        episodeCount: 0,
        subscriberCount: 0,
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Shows API Error:', error)
    return NextResponse.json(
      { error: 'Failed to create show' },
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
