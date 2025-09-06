import { NextRequest, NextResponse } from 'next/server'
import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma' // Only for public schema
import { activityService } from '@/lib/activities/activity-service'
import { PERMISSIONS } from '@/types/auth'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

/**
 * GET /api/shows
 * List shows with safe schema queries
 */
export async function GET(request: NextRequest) {
  try {
    // Get authentication and organization info
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get query parameters
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const includeInactive = url.searchParams.get('includeInactive') === 'true'
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const sort = url.searchParams.get('sort') || 'createdAt:desc'
    const producerId = url.searchParams.get('producerId')

    console.log('🎙️ Shows API: Fetching shows', { status, includeInactive, limit, sort, producerId, userRole: user.role })

    // Build where conditions for the SQL query
    const whereConditions: string[] = ['1=1']
    const queryParams: any[] = []
    let paramIndex = 1

    // Default to active-only unless explicitly including inactive
    if (!includeInactive) {
      if (status && status !== 'all') {
        whereConditions.push(`s."isActive" = $${paramIndex++}`)
        queryParams.push(status === 'active')
      } else {
        // Default to only active shows
        whereConditions.push(`s."isActive" = $${paramIndex++}`)
        queryParams.push(true)
      }
    } else if (status && status !== 'all') {
      // If includeInactive is true but status is specified
      whereConditions.push(`s."isActive" = $${paramIndex++}`)
      queryParams.push(status === 'active')
    }

    // Determine sort order
    let orderClause = 'ORDER BY s."createdAt" DESC'
    if (sort.startsWith('createdAt')) {
      orderClause = `ORDER BY s."createdAt" ${sort.endsWith('desc') ? 'DESC' : 'ASC'}`
    } else if (sort === 'name:asc' || sort === 'name:desc') {
      orderClause = `ORDER BY s.name ${sort.endsWith('desc') ? 'DESC' : 'ASC'}`
    }

    const whereClause = whereConditions.join(' AND ')

    // Fetch shows with episode counts
    const showsQuery = `
      SELECT 
        s.*,
        (
          SELECT COUNT(*) FROM "Episode" e 
          WHERE e."showId" = s.id AND e.status = 'published'
        ) as "publishedEpisodeCount",
        (
          SELECT COUNT(*) FROM "Episode" e 
          WHERE e."showId" = s.id
        ) as "totalEpisodeCount"
      FROM "Show" s
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex}
    `
    queryParams.push(limit)

    const { data: shows = [], error } = await safeQuerySchema(orgSlug, showsQuery, queryParams)
    if (error) {
      console.error('Error fetching shows:', error)
    }

    // Shows already include episode counts from the query above

    // Get assigned users from public schema
    const showIds = shows.map(s => s.id)
    let assignmentsResult: any[] = []
    
    if (showIds.length > 0) {
      const assignmentsQuery = `
        SELECT 
          stu."A" as show_id,
          json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            ) ORDER BY u.name
          ) FILTER (WHERE u.role = 'producer') as producers,
          json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            ) ORDER BY u.name
          ) FILTER (WHERE u.role = 'talent') as talent
        FROM "_ShowToUser" stu
        INNER JOIN public."User" u ON stu."B" = u.id
        WHERE stu."A" = ANY($1::text[])
        GROUP BY stu."A"
      `
      
      const { data: assignments = [] } = await safeQuerySchema(orgSlug, assignmentsQuery, [showIds])
      assignmentsResult = assignments
    }

      const assignmentsMap = new Map(
        assignmentsResult.map(a => [a.show_id, { 
          producers: a.producers || [], 
          talent: a.talent || [] 
        }])
      )

    // Get metrics if they exist
    let metricsMap = new Map()
    if (showIds.length > 0) {
      const metricsQuery = `
        SELECT * FROM "ShowMetrics" 
        WHERE "showId" = ANY($1::text[])
      `
      const { data: metrics = [] } = await safeQuerySchema(orgSlug, metricsQuery, [showIds])
      metricsMap = new Map(metrics.map((m: any) => [m.showId, m]))
    }

    // Get YouTube views for shows - aggregate from episodes only
    let youtubeViewsMap = new Map()
    if (showIds.length > 0) {
      // Get YouTube views from episodes linked to each show
      const episodeYouTubeQuery = `
        SELECT 
          e."showId",
          SUM(COALESCE(e."youtubeViewCount", 0)) as total_episode_views
        FROM "Episode" e
        WHERE e."showId" = ANY($1::text[])
          AND e."youtubeVideoId" IS NOT NULL
        GROUP BY e."showId"
      `
      const { data: episodeYouTubeData = [] } = await safeQuerySchema(orgSlug, episodeYouTubeQuery, [showIds])
      
      // Map episode views to shows
      episodeYouTubeData.forEach((ep: any) => {
        youtubeViewsMap.set(ep.showId, parseInt(ep.total_episode_views) || 0)
      })
    }

    // Get Megaphone downloads from EpisodeAnalytics
    let megaphoneDownloadsMap = new Map()
    if (showIds.length > 0) {
      // First try to get aggregated downloads from ShowAnalytics
      const showAnalyticsQuery = `
        SELECT 
          sa."showId",
          SUM(COALESCE(sa."totalDownloads", 0)) as total_downloads
        FROM "ShowAnalytics" sa
        WHERE sa."showId" = ANY($1::text[])
        GROUP BY sa."showId"
      `
      const { data: showAnalyticsData = [] } = await safeQuerySchema(orgSlug, showAnalyticsQuery, [showIds])
      
      showAnalyticsData.forEach((sa: any) => {
        megaphoneDownloadsMap.set(sa.showId, parseInt(sa.total_downloads) || 0)
      })
      
      // For shows without ShowAnalytics data, try aggregating from EpisodeAnalytics
      const showsWithoutAnalytics = showIds.filter(id => !megaphoneDownloadsMap.has(id))
      if (showsWithoutAnalytics.length > 0) {
        const episodeAnalyticsQuery = `
          SELECT 
            e."showId",
            SUM(COALESCE(ea."downloads", 0)) as total_downloads
          FROM "Episode" e
          INNER JOIN "EpisodeAnalytics" ea ON ea."episodeId" = e.id
          WHERE e."showId" = ANY($1::text[])
          GROUP BY e."showId"
        `
        const { data: episodeDownloadsData = [] } = await safeQuerySchema(orgSlug, episodeAnalyticsQuery, [showsWithoutAnalytics])
        
        episodeDownloadsData.forEach((ed: any) => {
          megaphoneDownloadsMap.set(ed.showId, parseInt(ed.total_downloads) || 0)
        })
      }
    }

    // Transform shows data for compatibility
    const transformedShows = shows.map((show: any) => {
      const assignments = assignmentsMap.get(show.id) || { producers: [], talent: [] }
      const showMetrics = metricsMap.get(show.id)
      const youtubeViews = youtubeViewsMap.get(show.id) || 0
      const megaphoneDownloads = megaphoneDownloadsMap.get(show.id) || 0
      const producers = assignments.producers || []
      const talent = assignments.talent || []

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
        isActive: show.isActive,
        assignedProducers: producers.map((p: any) => p.id),
        assignedTalent: talent.map((t: any) => t.id),
        producerNames: producers.map((p: any) => p.name),
        talentNames: talent.map((t: any) => t.name),
        assignedProducer: producers[0]?.name || null,
        episodeCount: parseInt(show.totalEpisodeCount) || 0,
        publishedEpisodeCount: parseInt(show.publishedEpisodeCount) || 0,
        subscribers: showMetrics?.totalSubscribers || 0,
        subscriberCount: showMetrics?.totalSubscribers || 0,
        subscriberGrowth: showMetrics?.subscriberGrowth || 0,
        averageListeners: showMetrics?.averageListeners || 0,
        downloads: megaphoneDownloads,  // Real Megaphone downloads from ShowAnalytics/EpisodeAnalytics
        views: youtubeViews,  // Real YouTube views from Episodes
        createdAt: new Date(show.createdAt).toISOString(),
        updatedAt: new Date(show.updatedAt).toISOString()
      }
    })

    // Filter by producer if needed (post-fetch filtering)
    let filteredShows = transformedShows
    if (producerId || user.role === 'producer') {
      const filterProducerId = producerId || user.id
      filteredShows = transformedShows.filter(show => 
        show.assignedProducers.includes(filterProducerId)
      )
    }

    console.log(`✅ Shows API: Returning ${filteredShows.length} shows for ${orgSlug}`)
    
    return NextResponse.json({
      shows: filteredShows,
      total: filteredShows.length,
      success: true
    })

  } catch (error) {
    console.error('❌ Shows API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/shows
 * Create a new show with safe schema queries
 */
export async function POST(request: NextRequest) {
  try {
    // Get authentication and organization info
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    const { name, description, assignedProducers, assignedTalent, host, category, releaseFrequency } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Generate unique ID for the show
    const showId = `show_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Create show
    const createShowQuery = `
      INSERT INTO "Show" (
        id, name, description, host, category, "releaseFrequency", 
        "isActive", "createdBy", "organizationId", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
      RETURNING *
    `
    
    const createParams = [
      showId,
      name,
      description || '',
      host || '',
      category || 'General',
      releaseFrequency || 'weekly',
      true,
      user.id,
      user.organizationId
    ]
    
    const { data: newShowResult } = await safeQuerySchema(orgSlug, createShowQuery, createParams)
    const newShow = newShowResult?.[0]

    // Assign producers and talent using raw query
    const assignments = []
    if (assignedProducers?.length > 0) {
      assignments.push(...assignedProducers.map((userId: string) => ({
        showId: newShow.id,
        userId
      })))
    }
    if (assignedTalent?.length > 0) {
      assignments.push(...assignedTalent.map((userId: string) => ({
        showId: newShow.id,
        userId
      })))
    }

    if (assignments.length > 0) {
      // Verify users exist and belong to the organization
      const userIds = assignments.map(a => a.userId)
      const validUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          organizationId: user.organizationId
        },
        select: { id: true }
      })
      const validUserIds = new Set(validUsers.map(u => u.id))

      // Filter assignments to only valid users
      const validAssignments = assignments.filter(a => validUserIds.has(a.userId))

      if (validAssignments.length > 0) {
        // Insert assignments using safe query
        for (const assignment of validAssignments) {
          const insertAssignmentQuery = `
            INSERT INTO "_ShowToUser" ("A", "B") VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `
          await safeQuerySchema(orgSlug, insertAssignmentQuery, [assignment.showId, assignment.userId])
        }
      }
    }

    // Log activity
    await activityService.logActivity({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'created',
      entityType: 'show',
      entityId: newShow.id,
      entityName: newShow.name,
      metadata: { 
        producerCount: assignedProducers?.length || 0,
        talentCount: assignedTalent?.length || 0
      }
    })

    console.log(`✅ Shows API: Created show "${newShow.name}" with ID: ${newShow.id}`)

    return NextResponse.json(newShow, { status: 201 })

  } catch (error) {
    console.error('❌ Shows API Error:', error)
    return NextResponse.json(
      { error: 'Failed to create show', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}