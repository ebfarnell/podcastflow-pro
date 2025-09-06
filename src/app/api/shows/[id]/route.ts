import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'
import { activityService } from '@/lib/activities/activity-service'

export const dynamic = 'force-dynamic'

async function getShow(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Await async params in Next.js 14.1.0
  const { id } = await params
  const showId = id

  try {
    // Get authenticated user
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
    
    // Query show from organization schema
    const showQuery = `
      SELECT 
        s.*,
        (
          SELECT COUNT(*) FROM "Episode" WHERE "showId" = s.id
        ) as episode_count,
        (
          SELECT json_agg(
            json_build_object(
              'id', e.id,
              'episodeNumber', e."episodeNumber",
              'title', e.title,
              'duration', e.duration,
              'airDate', e."airDate",
              'status', e.status
            )
          )
          FROM (
            SELECT * FROM "Episode"
            WHERE "showId" = s.id
            ORDER BY "episodeNumber" DESC
            LIMIT 5
          ) e
        ) as episodes,
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'avatar', u.avatar,
              'role', u.role
            )
          )
          FROM public."User" u
          WHERE u.id IN (
            SELECT "B" FROM "_ShowToUser" WHERE "A" = s.id
          )
          AND u.role = 'producer'
        ) as assigned_producers,
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'avatar', u.avatar,
              'role', u.role
            )
          )
          FROM public."User" u
          WHERE u.id IN (
            SELECT "B" FROM "_ShowToUser" WHERE "A" = s.id
          )
          AND u.role = 'talent'
        ) as assigned_talent
      FROM "Show" s
      WHERE s.id = $1
    `
    
    const result = await querySchema<any>(orgSlug, showQuery, [showId])
    
    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }
    
    const show = result[0]

    if (!show) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }

    // Calculate performance metrics from episodes
    const episodeStatsQuery = `
      SELECT 
        AVG(duration) as avg_duration,
        COUNT(*) as count
      FROM "Episode"
      WHERE "showId" = $1
    `
    const episodeStats = await querySchema<any>(orgSlug, episodeStatsQuery, [showId])

    // Get campaign revenue for this show
    const campaignRevenueQuery = `
      SELECT 
        SUM(c.budget) as total_budget,
        SUM(c.spent) as total_spent
      FROM "Campaign" c
      WHERE EXISTS (
        SELECT 1 FROM "Order" o
        WHERE o."campaignId" = c.id
        AND EXISTS (
          SELECT 1 FROM "OrderItem" oi
          WHERE oi."orderId" = o.id
          AND oi."showId" = $1
        )
      )
    `
    const campaignRevenue = await querySchema<any>(orgSlug, campaignRevenueQuery, [showId])

    const responseData = {
      id: show.id,
      name: show.name,
      description: show.description,
      host: show.host,
      category: show.category,
      organizationId: show.organizationId,
      isActive: show.isActive,
      createdAt: show.createdAt,
      updatedAt: show.updatedAt,
      createdBy: show.createdBy,
      updatedBy: show.updatedBy,
      releaseFrequency: show.releaseFrequency,
      showId: show.id, // Add backward compatibility
      totalEpisodes: parseInt(show.episode_count) || 0,
      avgDuration: parseFloat(episodeStats[0]?.avg_duration) || 0,
      totalRevenue: parseFloat(campaignRevenue[0]?.total_spent) || 0,
      monthlyRevenue: Math.round((parseFloat(campaignRevenue[0]?.total_spent) || 0) / 12), // Rough monthly average
      activeCampaigns: 0, // Campaigns are counted separately
      status: show.isActive ? 'active' : 'inactive',
      publishSchedule: show.releaseFrequency || 'Weekly',
      genre: show.category || 'General',
      socialMedia: {
        twitter: '',
        instagram: '', 
        facebook: ''
      },
      episodes: show.episodes || [],
      producers: show.assigned_producers || [],
      assignedProducers: show.assigned_producers || [],
      talent: show.assigned_talent || [],
      assignedTalent: show.assigned_talent || [],
      _count: {
        episodes: parseInt(show.episode_count) || 0
      },
      // Include all monetization fields - now available in Show table
      pricingModel: show.pricingModel || 'cpm',
      preRollCpm: parseFloat(show.preRollCpm) || 25,
      preRollSpotCost: parseFloat(show.preRollSpotCost) || 500,
      midRollCpm: parseFloat(show.midRollCpm) || 30,
      midRollSpotCost: parseFloat(show.midRollSpotCost) || 750,
      postRollCpm: parseFloat(show.postRollCpm) || 20,
      postRollSpotCost: parseFloat(show.postRollSpotCost) || 400,
      preRollSlots: show.preRollSlots !== null && show.preRollSlots !== undefined ? parseInt(show.preRollSlots) : 1,
      midRollSlots: show.midRollSlots !== null && show.midRollSlots !== undefined ? parseInt(show.midRollSlots) : 2,
      postRollSlots: show.postRollSlots !== null && show.postRollSlots !== undefined ? parseInt(show.postRollSlots) : 1,
      avgEpisodeDownloads: parseInt(show.avgEpisodeDownloads) || 0,
      // Revenue projection fields
      selloutProjection: parseFloat(show.selloutProjection) || 0,
      estimatedEpisodeValue: parseFloat(show.estimatedEpisodeValue) || 0,
      revenueSharingType: show.revenueSharingType,
      revenueSharingPercentage: parseFloat(show.revenueSharingPercentage) || 0,
      revenueSharingFixedAmount: parseFloat(show.revenueSharingFixedAmount) || 0,
      revenueSharingNotes: show.revenueSharingNotes,
      // talentContractUrl: show.talentContractUrl, // Field doesn't exist
      // YouTube integration fields
      youtubeChannelUrl: show.youtubeChannelUrl,
      youtubeChannelId: show.youtubeChannelId,
      youtubeChannelName: show.youtubeChannelName,
      youtubePlaylistId: show.youtubePlaylistId,
      youtubeSyncEnabled: show.youtubeSyncEnabled,
      youtubeAutoCreateEpisodes: show.youtubeAutoCreateEpisodes,
      youtubeLastSyncAt: show.youtubeLastSyncAt
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error fetching show:', error)
    return NextResponse.json(
      { error: 'Failed to fetch show' },
      { status: 500 }
    )
  }
}

async function updateShow(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: showId } = await params
  console.log('🔄 Shows API: Updating show', showId)

  try {
    // Get authenticated user
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
    
    const body = await request.json()
    console.log('📝 Shows API: Update request body:', body)
    
    // Build update query dynamically
    const updateFields: string[] = []
    const updateParams: any[] = []
    let paramIndex = 1
    
    // Basic fields
    if (body.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`)
      updateParams.push(body.name)
    }
    if (body.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`)
      updateParams.push(body.description)
    }
    if (body.host !== undefined) {
      updateFields.push(`host = $${paramIndex++}`)
      updateParams.push(body.host)
    }
    if (body.genre !== undefined) {
      updateFields.push(`category = $${paramIndex++}`)
      updateParams.push(body.genre)
    }
    if (body.publishSchedule !== undefined) {
      updateFields.push(`"releaseFrequency" = $${paramIndex++}`)
      updateParams.push(body.publishSchedule)
    }
    if (body.status !== undefined) {
      updateFields.push(`"isActive" = $${paramIndex++}`)
      updateParams.push(body.status === 'active')
    }
    
    // Monetization fields - commented out as these columns don't exist in Show table
    // These are stored in ShowRateCard table instead
    /*
    if (body.pricingModel !== undefined) {
      updateFields.push(`"pricingModel" = $${paramIndex++}`)
      updateParams.push(body.pricingModel)
    }
    if (body.preRollCpm !== undefined) {
      updateFields.push(`"preRollCpm" = $${paramIndex++}`)
      updateParams.push(body.preRollCpm)
    }
    if (body.preRollSpotCost !== undefined) {
      updateFields.push(`"preRollSpotCost" = $${paramIndex++}`)
      updateParams.push(body.preRollSpotCost)
    }
    if (body.midRollCpm !== undefined) {
      updateFields.push(`"midRollCpm" = $${paramIndex++}`)
      updateParams.push(body.midRollCpm)
    }
    if (body.midRollSpotCost !== undefined) {
      updateFields.push(`"midRollSpotCost" = $${paramIndex++}`)
      updateParams.push(body.midRollSpotCost)
    }
    if (body.postRollCpm !== undefined) {
      updateFields.push(`"postRollCpm" = $${paramIndex++}`)
      updateParams.push(body.postRollCpm)
    }
    if (body.postRollSpotCost !== undefined) {
      updateFields.push(`"postRollSpotCost" = $${paramIndex++}`)
      updateParams.push(body.postRollSpotCost)
    }
    if (body.preRollSlots !== undefined) {
      updateFields.push(`"preRollSlots" = $${paramIndex++}`)
      updateParams.push(body.preRollSlots)
    }
    if (body.midRollSlots !== undefined) {
      updateFields.push(`"midRollSlots" = $${paramIndex++}`)
      updateParams.push(body.midRollSlots)
    }
    if (body.postRollSlots !== undefined) {
      updateFields.push(`"postRollSlots" = $${paramIndex++}`)
      updateParams.push(body.postRollSlots)
    }
    if (body.avgEpisodeDownloads !== undefined) {
      updateFields.push(`"avgEpisodeDownloads" = $${paramIndex++}`)
      updateParams.push(body.avgEpisodeDownloads)
    }
    */
    
    // YouTube Integration fields
    if (body.youtubeChannelUrl !== undefined) {
      updateFields.push(`"youtubeChannelUrl" = $${paramIndex++}`)
      updateParams.push(body.youtubeChannelUrl)
    }
    if (body.youtubeChannelId !== undefined) {
      updateFields.push(`"youtubeChannelId" = $${paramIndex++}`)
      updateParams.push(body.youtubeChannelId)
    }
    if (body.youtubeChannelName !== undefined) {
      updateFields.push(`"youtubeChannelName" = $${paramIndex++}`)
      updateParams.push(body.youtubeChannelName)
    }
    if (body.youtubePlaylistId !== undefined) {
      updateFields.push(`"youtubePlaylistId" = $${paramIndex++}`)
      updateParams.push(body.youtubePlaylistId)
    }
    if (body.youtubeSyncEnabled !== undefined) {
      updateFields.push(`"youtubeSyncEnabled" = $${paramIndex++}`)
      updateParams.push(body.youtubeSyncEnabled)
    }
    if (body.youtubeAutoCreateEpisodes !== undefined) {
      updateFields.push(`"youtubeAutoCreateEpisodes" = $${paramIndex++}`)
      updateParams.push(body.youtubeAutoCreateEpisodes)
    }
    
    // Always update timestamp and user
    updateFields.push(`"updatedAt" = $${paramIndex++}`)
    updateParams.push(new Date())
    updateFields.push(`"updatedBy" = $${paramIndex++}`)
    updateParams.push(user.id)
    
    // Add showId for WHERE clause
    updateParams.push(showId)
    
    const updateQuery = `
      UPDATE "Show"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `
    
    const result = await querySchema<any>(orgSlug, updateQuery, updateParams)
    
    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }
    
    // Handle user assignments separately with organization validation
    if (body.assignedProducers !== undefined || body.assignedTalent !== undefined) {
      // Collect all user IDs to validate
      const assignments: string[] = []
      if (body.assignedProducers) {
        assignments.push(...body.assignedProducers)
      }
      if (body.assignedTalent) {
        assignments.push(...body.assignedTalent)
      }
      
      // SECURITY: Validate all users belong to the same organization
      if (assignments.length > 0) {
        const userValidationQuery = `
          SELECT id FROM public."User" 
          WHERE id = ANY($1) 
          AND "organizationId" = $2
        `
        const { data: validUsers = [] } = await safeQuerySchema(
          orgSlug, 
          userValidationQuery, 
          [assignments, user.organizationId]
        )
        
        if (validUsers.length !== assignments.length) {
          const invalidUserCount = assignments.length - validUsers.length
          return NextResponse.json(
            { 
              error: `${invalidUserCount} user(s) do not belong to your organization and cannot be assigned`,
              details: { 
                attemptedCount: assignments.length,
                validCount: validUsers.length 
              }
            },
            { status: 403 }
          )
        }
      }
      
      // First clear existing assignments
      await querySchema(orgSlug, `DELETE FROM "_ShowToUser" WHERE "A" = $1`, [showId])
      
      // Add new validated assignments
      if (assignments.length > 0) {
        const insertValues = assignments.map((userId, index) => 
          `($1, $${index + 2}, $${index + assignments.length + 2})`
        ).join(', ')
        
        await querySchema(
          orgSlug,
          `INSERT INTO "_ShowToUser" ("A", "B", "assignedBy") VALUES ${insertValues}`,
          [showId, ...assignments, ...assignments.map(() => user.id)]
        )
        
        // Log assignment activity
        await activityService.logActivity({
          type: 'show',
          action: 'bulk_assigned_users_to_show',
          title: 'Bulk User Assignment',
          description: `Assigned ${assignments.length} users to show "${result[0].name}"`,
          actorId: user.id,
          actorName: user.name,
          actorEmail: user.email,
          actorRole: user.role,
          targetType: 'show',
          targetId: showId,
          targetName: result[0].name,
          organizationId: user.organizationId,
          showId: showId,
          metadata: {
            assignedUserIds: assignments,
            assignmentCount: assignments.length
          }
        })
      }
    }

    // Trigger YouTube sync if YouTube URL was updated and sync is enabled
    const showData = result[0]
    if ((body.youtubeChannelUrl !== undefined || body.youtubeSyncEnabled === true) && 
        showData.youtubeChannelUrl && 
        showData.youtubeSyncEnabled) {
      
      console.log('🎬 Triggering YouTube sync for show:', showId)
      
      // Call the sync endpoint internally
      try {
        const syncUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/shows/${showId}/sync-youtube`
        const syncResponse = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `auth-token=${authToken.value}`
          }
        })
        
        if (!syncResponse.ok) {
          const errorData = await syncResponse.json()
          console.error('YouTube sync failed:', errorData.error)
          // Don't fail the update, just log the sync error
        } else {
          const syncResult = await syncResponse.json()
          console.log('YouTube sync completed:', syncResult)
          
          // Add sync results to the response
          showData.youtubeSyncResult = syncResult
        }
      } catch (syncError) {
        console.error('Error triggering YouTube sync:', syncError)
        // Don't fail the update, just log the sync error
      }
    }

    return NextResponse.json(showData)
  } catch (error) {
    console.error('Error updating show:', error)
    return NextResponse.json(
      { error: 'Failed to update show' },
      { status: 500 }
    )
  }
}

async function deleteShow(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: showId } = await params

  try {
    // Get authenticated user
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Only admin and master can delete shows
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Only administrators can delete shows' }, { status: 403 })
    }
    
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Parse query params for deletion mode
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') // 'force' (cascade delete episodes) or 'inactive' (set as inactive)
    
    // Check if show exists and get related counts
    const showQuery = `
      SELECT 
        s.id,
        s.name,
        s."isActive",
        (SELECT COUNT(*) FROM "Episode" WHERE "showId" = s.id) as episode_count,
        (SELECT COUNT(DISTINCT oi."orderId") 
         FROM "OrderItem" oi
         WHERE oi."showId" = s.id) as order_count,
        (SELECT COUNT(DISTINCT o."campaignId") 
         FROM "Order" o 
         JOIN "OrderItem" oi ON oi."orderId" = o.id 
         WHERE oi."showId" = s.id) as campaign_count
      FROM "Show" s
      WHERE s.id = $1
    `
    
    const { data: result, error: queryError } = await safeQuerySchema(orgSlug, showQuery, [showId])
    
    if (queryError) {
      console.error('Error checking show for deletion:', queryError)
      return NextResponse.json(
        { error: 'Failed to check show status' },
        { status: 500 }
      )
    }
    
    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }
    
    const show = result[0]
    const episodeCount = parseInt(show.episode_count)
    const orderCount = parseInt(show.order_count)
    const campaignCount = parseInt(show.campaign_count)

    // If show has orders, it can only be set to inactive
    if (orderCount > 0) {
      if (mode === 'inactive') {
        // Set show as inactive
        const { error: updateError } = await safeQuerySchema(
          orgSlug, 
          `UPDATE "Show" SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1 RETURNING id`, 
          [showId]
        )
        
        if (updateError) {
          console.error('Error setting show inactive:', updateError)
          return NextResponse.json(
            { error: 'Failed to set show as inactive' },
            { status: 500 }
          )
        }

        return NextResponse.json({ 
          message: 'Show set as inactive successfully',
          action: 'inactive'
        })
      } else {
        // Cannot delete - has orders
        return NextResponse.json(
          { 
            error: 'Cannot delete show with existing orders',
            details: {
              episodes: episodeCount,
              orders: orderCount,
              campaigns: campaignCount,
              canSetInactive: true
            }
          },
          { status: 400 }
        )
      }
    }

    // If show has episodes but no orders, offer cascade delete
    if (episodeCount > 0) {
      if (mode === 'force') {
        // Cascade delete episodes
        const { error: deleteEpisodesError } = await safeQuerySchema(
          orgSlug, 
          `DELETE FROM "Episode" WHERE "showId" = $1`, 
          [showId]
        )
        
        if (deleteEpisodesError) {
          console.error('Error deleting episodes:', deleteEpisodesError)
          return NextResponse.json(
            { error: 'Failed to delete episodes' },
            { status: 500 }
          )
        }
      } else {
        // Return info about what would be deleted
        return NextResponse.json(
          { 
            error: 'Show has episodes that need to be deleted',
            details: {
              episodes: episodeCount,
              orders: orderCount,
              campaigns: campaignCount,
              canDelete: true,
              canSetInactive: false
            }
          },
          { status: 400 }
        )
      }
    }
    
    // Delete show assignments first
    const { error: assignmentError } = await safeQuerySchema(orgSlug, `DELETE FROM "_ShowToUser" WHERE "A" = $1`, [showId])
    if (assignmentError) {
      console.error('Error deleting show assignments:', assignmentError)
    }
    
    // Delete the show
    const { error: deleteError } = await safeQuerySchema(orgSlug, `DELETE FROM "Show" WHERE id = $1`, [showId])
    if (deleteError) {
      console.error('Error deleting show:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete show' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: episodeCount > 0 ? 'Show and all episodes deleted successfully' : 'Show deleted successfully',
      action: 'deleted',
      deletedEpisodes: episodeCount
    })
  } catch (error) {
    console.error('Error deleting show:', error)
    return NextResponse.json(
      { error: 'Failed to delete show' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
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
    
    return getShow(authenticatedRequest, { params: context.params })
  } catch (error) {
    console.error('GET /api/shows/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const PUT = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
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
    
    return updateShow(authenticatedRequest, { params: context.params })
  } catch (error) {
    console.error('PUT /api/shows/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH method - same as PUT for partial updates
export const PATCH = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
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
    
    return updateShow(authenticatedRequest, { params: context.params })
  } catch (error) {
    console.error('PATCH /api/shows/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const DELETE = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
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
    
    return deleteShow(authenticatedRequest, { params: context.params })
  } catch (error) {
    console.error('DELETE /api/shows/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}