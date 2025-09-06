import { NextRequest, NextResponse } from 'next/server'
import { withTenantIsolation, getTenantClient } from '@/lib/db/tenant-isolation'
import prisma from '@/lib/db/prisma' // Only for public schema
import { EpisodeStatus } from '@prisma/client'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

/**
 * GET /api/episodes
 * List episodes with tenant isolation
 */
export async function GET(request: NextRequest) {
  return withTenantIsolation(request, async (context) => {
    try {
      // Get query parameters
      const url = new URL(request.url)
      const status = url.searchParams.get('status')
      const showId = url.searchParams.get('showId')
      const producerId = url.searchParams.get('producerId')
      const assignedOnly = url.searchParams.get('assignedOnly') === 'true'
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const sort = url.searchParams.get('sort') || 'releaseDate:desc'

      console.log('🎙️ Episodes API: Fetching episodes', { status, showId, producerId, assignedOnly, limit, sort })

      // Get tenant-isolated database client
      const tenantDb = getTenantClient(context)

      // Build base query filters
      const where: any = {}

      // Add status filter
      if (status && status !== 'all') {
        where.status = status as EpisodeStatus
      }

      // Add show filter
      if (showId && showId !== 'all') {
        where.showId = showId
      }

      // For talent/producers, filter by assigned shows if requested
      let assignedShowIds: string[] | null = null
      if (assignedOnly && (context.role === 'talent' || context.role === 'producer')) {
        // Get assigned shows using raw query
        const assignedShows = await prisma.$queryRaw<{id: string}[]>`
          SELECT DISTINCT s.id 
          FROM ${prisma.raw(`"${context.schemaName}"."Show"`)} s
          INNER JOIN ${prisma.raw(`"${context.schemaName}"."_ShowToUser"`)} stu ON stu."A" = s.id
          WHERE stu."B" = ${context.userId}
        `
        
        if (assignedShows.length > 0) {
          assignedShowIds = assignedShows.map(s => s.id)
          where.showId = { in: assignedShowIds }
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
        const producerShows = await prisma.$queryRaw<{id: string}[]>`
          SELECT DISTINCT s.id 
          FROM ${prisma.raw(`"${context.schemaName}"."Show"`)} s
          INNER JOIN ${prisma.raw(`"${context.schemaName}"."_ShowToUser"`)} stu ON stu."A" = s.id
          WHERE stu."B" = ${producerId}
        `
        
        if (producerShows.length > 0) {
          const producerShowIds = producerShows.map(s => s.id)
          if (where.showId?.in) {
            // Intersect with existing show filter
            where.showId.in = where.showId.in.filter((id: string) => producerShowIds.includes(id))
          } else {
            where.showId = { in: producerShowIds }
          }
        } else {
          // No shows for this producer
          return NextResponse.json({
            episodes: [],
            total: 0,
            success: true
          })
        }
      }

      // Determine sort order
      const [sortField, sortOrder] = sort.split(':')
      const orderBy = sortField === 'releaseDate' 
        ? { airDate: sortOrder === 'desc' ? 'desc' : 'asc' }
        : sortField === 'createdAt'
        ? { createdAt: sortOrder === 'desc' ? 'desc' : 'asc' }
        : { title: 'asc' }

      // Fetch episodes with shows
      console.log('🎙️ Episodes API: Query where clause:', JSON.stringify(where, null, 2))
      console.log('🎙️ Episodes API: Tenant schema:', context.schemaName)
      
      const episodes = await tenantDb.episode.findMany({
        where,
        orderBy,
        take: limit,
        include: {
          show: true
        }
      })
      
      console.log(`🎙️ Episodes API: Found ${episodes.length} episodes`)
      if (episodes.length > 0) {
        console.log('🎙️ Episodes API: First episode data:', {
          title: episodes[0].title,
          youtubeViewCount: episodes[0].youtubeViewCount,
          youtubeLikeCount: episodes[0].youtubeLikeCount,
          youtubeUrl: episodes[0].youtubeUrl,
          megaphoneDownloads: episodes[0].megaphoneDownloads
        })
      }

      // Get talent assignments from show level (episodes inherit from shows)
      const showIds = [...new Set(episodes.map(e => e.showId))]
      let talentMap = new Map()
      
      if (showIds.length > 0) {
        try {
          // Get talent assignments from _ShowToUser join table
          const showTalentQuery = `
            SELECT 
              s.id as show_id,
              json_agg(
                json_build_object(
                  'id', u.id,
                  'name', u.name,
                  'email', u.email,
                  'role', u.role
                ) ORDER BY u.name
              ) as talent
            FROM ${tenantDb.raw(`"${context.schemaName}"."Show"`)} s
            INNER JOIN ${tenantDb.raw(`"${context.schemaName}"."_ShowToUser"`)} stu ON stu."A" = s.id
            INNER JOIN public."User" u ON stu."B" = u.id
            WHERE s.id = ANY($1::text[]) AND u.role = 'talent'
            GROUP BY s.id
          `
          
          const showTalent = await tenantDb.$queryRaw(showTalentQuery, [showIds])
          
          // Map talent to each episode of the show
          episodes.forEach(episode => {
            const showData = showTalent.find((st: any) => st.show_id === episode.showId)
            const talent = showData ? showData.talent || [] : []
            talentMap.set(episode.id, talent)
          })
        } catch (error) {
          console.log('Error fetching show talent assignments:', error)
        }
      }

      // Get inventory data if exists
      let inventoryMap = new Map()
      try {
        const episodeIds = episodes.map(e => e.id)
        if (episodeIds.length > 0) {
          const inventory = await tenantDb.episodeInventory.findMany({
            where: { episodeId: { in: episodeIds } }
          })
          inventoryMap = new Map(inventory.map(i => [i.episodeId, i]))
        }
      } catch (error) {
        // EpisodeInventory might not exist
        console.log('EpisodeInventory not available:', error)
      }

      // Transform episodes for response
      const transformedEpisodes = episodes.map(episode => {
        const talent = talentMap.get(episode.id) || []
        const inventory = inventoryMap.get(episode.id)
        
        return {
          id: episode.id,
          episodeId: episode.id, // For backwards compatibility
          showId: episode.showId,
          showName: episode.show?.name || 'Unknown Show',
          title: episode.title,
          description: episode.description || '',
          status: episode.status,
          // Preserve the date as stored in DB without timezone conversion
          // If airDate is '2025-09-07 00:00:00', keep it as '2025-09-07'
          releaseDate: episode.airDate ? episode.airDate.toISOString().split('T')[0] : null,
          airDate: episode.airDate ? episode.airDate.toISOString().split('T')[0] : null,
          duration: episode.duration || 0,
          durationSeconds: episode.durationSeconds || null,
          episodeNumber: episode.episodeNumber || null,
          talent: talent.map((t: any) => t.name),
          talentDetails: talent,
          guestInfo: episode.guestInfo || '',
          productionNotes: episode.productionNotes || '',
          scriptUrl: null, // Field doesn't exist in current schema
          audioUrl: episode.publishUrl || null,
          // YouTube Analytics fields
          youtubeVideoId: episode.youtubeVideoId || null,
          youtubeViewCount: episode.youtubeViewCount ? Number(episode.youtubeViewCount) : 0,
          youtubeLikeCount: episode.youtubeLikeCount ? Number(episode.youtubeLikeCount) : 0,
          youtubeCommentCount: episode.youtubeCommentCount ? Number(episode.youtubeCommentCount) : 0,
          youtubeUrl: episode.youtubeUrl || null,
          youtubeShares: episode.youtubeShares ? Number(episode.youtubeShares) : 0,
          youtubeDislikeCount: episode.youtubeDislikeCount ? Number(episode.youtubeDislikeCount) : 0,
          youtubeSubscribersGained: episode.youtubeSubscribersGained ? Number(episode.youtubeSubscribersGained) : 0,
          youtubeSubscribersLost: episode.youtubeSubscribersLost ? Number(episode.youtubeSubscribersLost) : 0,
          youtubeAvgViewDuration: episode.youtubeAvgViewDuration ? Number(episode.youtubeAvgViewDuration) : 0,
          youtubeAvgViewPercentage: episode.youtubeAvgViewPercentage ? Number(episode.youtubeAvgViewPercentage) : 0,
          youtubeWatchTimeHours: episode.youtubeWatchTimeHours ? Number(episode.youtubeWatchTimeHours) : 0,
          youtubeImpressions: episode.youtubeImpressions ? Number(episode.youtubeImpressions) : 0,
          youtubeCTR: episode.youtubeCTR ? Number(episode.youtubeCTR) : 0,
          youtubeEstimatedMinutesWatched: episode.youtubeEstimatedMinutesWatched ? Number(episode.youtubeEstimatedMinutesWatched) : 0,
          youtubeRetentionRate: episode.youtubeRetentionRate ? Number(episode.youtubeRetentionRate) : 0,
          // Megaphone Analytics fields
          megaphoneId: episode.megaphoneId || null,
          megaphoneDownloads: episode.megaphoneDownloads ? Number(episode.megaphoneDownloads) : 0,
          megaphoneImpressions: episode.megaphoneImpressions ? Number(episode.megaphoneImpressions) : 0,
          megaphoneUniqueListeners: episode.megaphoneUniqueListeners ? Number(episode.megaphoneUniqueListeners) : 0,
          megaphoneAvgListenTime: episode.megaphoneAvgListenTime ? Number(episode.megaphoneAvgListenTime) : 0,
          megaphoneCompletionRate: episode.megaphoneCompletionRate ? Number(episode.megaphoneCompletionRate) : 0,
          megaphoneUrl: episode.megaphoneUrl || null,
          megaphoneLastSync: episode.megaphoneLastSync ? new Date(episode.megaphoneLastSync).toISOString() : null,
          audioDeliveryPlatform: episode.audioDeliveryPlatform || 'megaphone',
          inventory: inventory ? {
            preRollSlots: inventory.preRollSlots || 0,
            midRollSlots: inventory.midRollSlots || 0,
            postRollSlots: inventory.postRollSlots || 0,
            availableSlots: (inventory.preRollSlots || 0) + (inventory.midRollSlots || 0) + (inventory.postRollSlots || 0)
          } : null,
          createdAt: new Date(episode.createdAt).toISOString(),
          updatedAt: new Date(episode.updatedAt).toISOString()
        }
      })

      console.log(`✅ Episodes API: Returning ${transformedEpisodes.length} episodes for ${context.organizationSlug}`)

      return NextResponse.json({
        episodes: transformedEpisodes,
        total: transformedEpisodes.length,
        success: true
      })

    } catch (error) {
      console.error('❌ Episodes API Error:', error)
      return NextResponse.json(
        { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  })
}

/**
 * POST /api/episodes
 * Create a new episode with tenant isolation
 */
export async function POST(request: NextRequest) {
  return withTenantIsolation(request, async (context) => {
    try {
      const body = await request.json()
      console.log('🎙️ Episodes API: Creating episode with data:', JSON.stringify(body, null, 2))
      
      // Extract fields, handling both formats from different clients
      const { 
        showId, 
        title, 
        description, 
        airDate,
        releaseDate, // Client might send this instead of airDate
        publishDate, // Or this
        status = 'draft',
        duration,
        episodeNumber,
        guestInfo,
        productionNotes,
        tags,
        adSlots
      } = body

      // Validate required fields
      if (!showId || !title) {
        return NextResponse.json(
          { error: 'Show ID and title are required' },
          { status: 400 }
        )
      }

      // Sanitize and validate inputs
      const sanitizedTitle = title.trim()
      if (sanitizedTitle.length === 0) {
        return NextResponse.json(
          { error: 'Title cannot be empty' },
          { status: 400 }
        )
      }

      // Validate status
      const validStatuses = ['draft', 'scheduled', 'published', 'recording', 'editing']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }

      // Get tenant-isolated database client
      const tenantDb = getTenantClient(context)

      // Verify show exists and belongs to tenant
      const show = await tenantDb.show.findFirst({
        where: { 
          id: showId,
          organizationId: context.organizationId
        },
        select: {
          id: true,
          name: true
        }
      })

      if (!show) {
        return NextResponse.json(
          { error: 'Show not found or access denied' },
          { status: 404 }
        )
      }

      // Parse and validate dates
      let parsedAirDate = null
      const dateToUse = airDate || releaseDate || publishDate
      if (dateToUse) {
        try {
          parsedAirDate = new Date(dateToUse)
          if (isNaN(parsedAirDate.getTime())) {
            throw new Error('Invalid date')
          }
        } catch (error) {
          return NextResponse.json(
            { error: 'Invalid date format. Please use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)' },
            { status: 400 }
          )
        }
      }

      // Generate episode ID
      const episodeId = `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Create episode - only include fields that exist in the Episode model
      const episodeData: any = {
        id: episodeId,
        showId,
        title: sanitizedTitle,
        description: description?.trim() || '',
        airDate: parsedAirDate,
        status: status as EpisodeStatus,
        duration: parseInt(duration) || 0,
        episodeNumber: episodeNumber ? parseInt(episodeNumber) : null,
        guestInfo: guestInfo?.trim() || '',
        productionNotes: productionNotes?.trim() || '',
        organizationId: context.organizationId,
        // Note: createdBy field doesn't exist in Episode model
      }

      console.log('🎙️ Episodes API: Creating episode with processed data:', episodeData)

      const newEpisode = await tenantDb.episode.create({
        data: episodeData,
        include: {
          show: true
        }
      })

      // Create inventory record if model exists
      try {
        const inventoryData: any = {
          id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          episodeId: newEpisode.id,
          preRollSlots: adSlots?.preRoll || 1,
          midRollSlots: adSlots?.midRoll || 2,
          postRollSlots: adSlots?.postRoll || 1,
          preRollPrice: 500,
          midRollPrice: 750,
          postRollPrice: 400,
          preRollImpressions: 10000,
          midRollImpressions: 10000,
          postRollImpressions: 10000
        }
        
        await tenantDb.episodeInventory.create({
          data: inventoryData
        })
      } catch (error) {
        // EpisodeInventory model might not exist in all tenants
        console.log('EpisodeInventory not available, skipping:', error)
      }

      // NOTE: Talent assignments are now handled at the show level via _ShowToUser
      // Episodes inherit talent assignments from their parent show
      // If talentIds are provided, they should be assigned to the show instead

      // Log activity if model exists
      try {
        await tenantDb.activity.create({
          data: {
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'episode_created',
            description: `Created episode: ${newEpisode.title}`,
            userId: context.userId,
            metadata: {
              episodeId: newEpisode.id,
              showId: newEpisode.showId,
              showName: show.name
            }
          }
        })
      } catch (error) {
        // Activity model might not exist
        console.log('Activity logging not available:', error)
      }

      console.log(`✅ Episodes API: Created episode "${newEpisode.title}" with ID: ${newEpisode.id}`)

      // Return response in format expected by client
      const response = {
        id: newEpisode.id,
        title: newEpisode.title,
        description: newEpisode.description,
        showId: newEpisode.showId,
        showName: newEpisode.show?.name || show.name,
        airDate: newEpisode.airDate?.toISOString() || null,
        releaseDate: newEpisode.airDate?.toISOString() || null, // For compatibility
        publishDate: newEpisode.airDate?.toISOString() || null, // For compatibility
        status: newEpisode.status,
        duration: newEpisode.duration,
        episodeNumber: newEpisode.episodeNumber,
        guestInfo: newEpisode.guestInfo,
        productionNotes: newEpisode.productionNotes,
        tags: tags || [],
        createdAt: newEpisode.createdAt.toISOString(),
        updatedAt: newEpisode.updatedAt.toISOString()
      }

      return NextResponse.json(response, { status: 201 })

    } catch (error) {
      console.error('❌ Episodes API Error:', error)
      
      // Log detailed error for debugging
      if (error instanceof Error) {
        console.error('Error stack:', error.stack)
        console.error('Error message:', error.message)
      }
      
      // Check for specific Prisma errors
      if (error instanceof Error && error.message.includes('Unknown field')) {
        return NextResponse.json(
          { error: 'Database schema mismatch. Please contact support.' },
          { status: 500 }
        )
      }
      
      if (error instanceof Error && error.message.includes('Foreign key constraint')) {
        return NextResponse.json(
          { error: 'Invalid reference data. Please check your inputs.' },
          { status: 400 }
        )
      }
      
      // Generic error response - don't expose internal details
      return NextResponse.json(
        { error: 'Failed to create episode. Please try again.' },
        { status: 500 }
      )
    }
  })
}