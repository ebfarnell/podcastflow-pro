/**
 * YouTube Import Settings API
 * GET /api/shows/[id]/youtube-settings - Get current import settings
 * PUT /api/shows/[id]/youtube-settings - Update import settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { querySchema, safeQuerySchema } from '@/lib/db/schema-db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const showId = params.id
    const orgSlug = session.organizationSlug!

    // Get YouTube import settings for the show
    const query = `
      SELECT 
        "youtubeImportPodcasts",
        "youtubeImportShorts",
        "youtubeImportClips",
        "youtubeImportLive",
        "youtubeMinDuration",
        "youtubeMaxDuration",
        "youtubeTitleFilter",
        "youtubeExcludeFilter"
      FROM "Show"
      WHERE id = $1 AND "organizationId" = $2
    `
    
    const { data, error } = await safeQuerySchema(orgSlug, query, [showId, session.organizationId])
    
    if (error || !data || data.length === 0) {
      // Return default settings if not found
      return NextResponse.json({
        youtubeImportPodcasts: true,
        youtubeImportShorts: false,
        youtubeImportClips: false,
        youtubeImportLive: false,
        youtubeMinDuration: 600,
        youtubeMaxDuration: null,
        youtubeTitleFilter: null,
        youtubeExcludeFilter: null
      })
    }

    return NextResponse.json(data[0])
  } catch (error: any) {
    console.error('Error fetching YouTube settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can update settings
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const showId = params.id
    const orgSlug = session.organizationSlug!
    const body = await request.json()

    const {
      youtubeImportPodcasts = true,
      youtubeImportShorts = false,
      youtubeImportClips = false,
      youtubeImportLive = false,
      youtubeMinDuration = 600,
      youtubeMaxDuration = null,
      youtubeTitleFilter = null,
      youtubeExcludeFilter = null
    } = body

    // Update the show's YouTube import settings
    const updateQuery = `
      UPDATE "Show"
      SET 
        "youtubeImportPodcasts" = $3,
        "youtubeImportShorts" = $4,
        "youtubeImportClips" = $5,
        "youtubeImportLive" = $6,
        "youtubeMinDuration" = $7,
        "youtubeMaxDuration" = $8,
        "youtubeTitleFilter" = $9,
        "youtubeExcludeFilter" = $10,
        "updatedAt" = NOW()
      WHERE id = $1 AND "organizationId" = $2
    `

    await querySchema(orgSlug, updateQuery, [
      showId,
      session.organizationId,
      youtubeImportPodcasts,
      youtubeImportShorts,
      youtubeImportClips,
      youtubeImportLive,
      youtubeMinDuration,
      youtubeMaxDuration,
      youtubeTitleFilter,
      youtubeExcludeFilter
    ])

    return NextResponse.json({
      success: true,
      message: 'YouTube import settings updated'
    })
  } catch (error: any) {
    console.error('Error updating YouTube settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}