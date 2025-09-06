/**
 * Episodes API Route
 * GET /api/shows/:id/episodes
 * 
 * Returns episodes for a specific show
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { resolveOrgSlug } from '@/lib/tenancy/resolve-org'
import { safeQuerySchema } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: showId } = await params
    
    // Authenticate user
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse query parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const includeYouTube = url.searchParams.get('youtube') !== 'false'
    
    // Resolve organization slug
    const orgSlug = await resolveOrgSlug(request, { showId })
    
    // Query episodes
    const episodesQuery = `
      SELECT 
        id,
        "showId",
        "episodeNumber",
        title,
        "airDate",
        duration,
        "durationSeconds",
        status,
        "createdBy",
        "createdAt",
        "updatedAt",
        ${includeYouTube ? `
          "youtubeVideoId",
          "youtubeUrl",
          "youtubeViewCount",
          "youtubeLikeCount",
          "youtubeCommentCount",
          "thumbnailUrl",
          "publishUrl",
          "megaphoneId",
          "megaphoneDownloads",
          "megaphoneImpressions",
          "megaphoneUniqueListeners",
          "megaphoneAvgListenTime",
          "megaphoneCompletionRate",
          "megaphoneUrl",
          "megaphoneLastSync",
          "audioDeliveryPlatform"
        ` : ''}
        "producerNotes",
        "talentNotes",
        "recordingDate"
      FROM "Episode"
      WHERE "showId" = $1 AND "organizationId" = $2
      ORDER BY "episodeNumber" DESC
      LIMIT $3 OFFSET $4
    `
    
    const { data: episodes, error } = await safeQuerySchema(
      orgSlug,
      episodesQuery,
      [showId, session.organizationId, limit, offset]
    )
    
    if (error) {
      console.error('Error fetching episodes:', error)
      return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 })
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM "Episode"
      WHERE "showId" = $1 AND "organizationId" = $2
    `
    
    const { data: countResult } = await safeQuerySchema(
      orgSlug,
      countQuery,
      [showId, session.organizationId]
    )
    
    const total = parseInt(countResult[0]?.total || '0')
    
    return NextResponse.json({
      success: true,
      data: episodes,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
    
  } catch (error) {
    console.error('Error in episodes route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch episodes' },
      { status: 500 }
    )
  }
}