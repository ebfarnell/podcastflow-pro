/**
 * YouTube Sync API
 * POST /api/youtube/sync/[showId] - Trigger sync for a specific show
 * GET /api/youtube/sync/[showId] - Get sync status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const MAX_RESULTS = 50
const ENCRYPTION_KEY = process.env.YOUTUBE_ENCRYPTION_KEY || 'a8f5f167f44f4964e6c998dee827110ca8f5f167f44f4964e6c998dee827110c'

function decrypt(text: string): string {
  if (!text.includes(':')) return text
  
  const parts = text.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encryptedText = Buffer.from(parts[1], 'hex')
  
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  )
  
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  
  return decrypted.toString()
}

function parseDuration(duration: string): number {
  if (!duration) return 0
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/)
  if (!match) return 0
  
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseFloat(match[3] || '0')
  
  return Math.floor(hours * 3600 + minutes * 60 + seconds)
}

function extractEpisodeNumber(title: string, currentMax: number): number {
  const patterns = [
    /(?:episode|ep\.?|#)\s*(\d+)/i,
    /^(\d+)[\s\-:]/,
    /\s(\d+)$/
  ]
  
  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (match) {
      const num = parseInt(match[1])
      if (!isNaN(num) && num > 0 && num < 10000) {
        return num
      }
    }
  }
  
  return currentMax + 1
}

export async function POST(
  request: NextRequest,
  { params }: { params: { showId: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - allow admin, master, and producer roles
    if (!['admin', 'master', 'producer'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { showId } = params
    const orgSlug = session.organizationSlug!

    // Get show details
    const showQuery = `
      SELECT id, name, "youtubeChannelId", "youtubeUploadsPlaylistId", "organizationId"
      FROM "Show"
      WHERE id = $1 AND "organizationId" = $2
    `
    const { data: showResult } = await safeQuerySchema(orgSlug, showQuery, [showId, session.organizationId])
    
    if (!showResult || showResult.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    const show = showResult[0]

    // Get API configuration
    const config = await prisma.youTubeApiConfig.findUnique({
      where: { organizationId: session.organizationId }
    })

    if (!config || !config.apiKey) {
      return NextResponse.json({ error: 'YouTube API not configured' }, { status: 400 })
    }

    const apiKey = decrypt(config.apiKey)

    // Fetch uploads playlist ID if missing
    let uploadsPlaylistId = show.youtubeUploadsPlaylistId
    if (!uploadsPlaylistId && show.youtubeChannelId) {
      const channelResponse = await fetch(
        `${YOUTUBE_API_BASE}/channels?part=contentDetails&id=${show.youtubeChannelId}&key=${apiKey}`
      )
      const channelData = await channelResponse.json()

      if (channelData.items && channelData.items.length > 0) {
        uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads
        
        // Update show with uploads playlist ID
        await querySchema(orgSlug, 
          `UPDATE "Show" SET "youtubeUploadsPlaylistId" = $1 WHERE id = $2`,
          [uploadsPlaylistId, showId]
        )
      } else {
        return NextResponse.json({ error: 'Could not fetch channel details' }, { status: 400 })
      }
    }

    if (!uploadsPlaylistId) {
      return NextResponse.json({ error: 'No uploads playlist ID available' }, { status: 400 })
    }

    // Start sync process
    let pageToken: string | null = null
    let totalVideos = 0
    let episodesCreated = 0
    let episodesUpdated = 0
    let pagesProcessed = 0
    const maxPages = 20 // Limit to 1000 videos per sync to avoid timeout

    do {
      // Fetch playlist items
      let playlistUrl = `${YOUTUBE_API_BASE}/playlistItems?part=contentDetails,snippet&playlistId=${uploadsPlaylistId}&maxResults=${MAX_RESULTS}&key=${apiKey}`
      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`
      }

      const playlistResponse = await fetch(playlistUrl)
      const playlistData = await playlistResponse.json()

      if (!playlistData.items || playlistData.items.length === 0) {
        break
      }

      // Get video IDs
      const videoIds = playlistData.items.map((item: any) => item.contentDetails.videoId)

      // Fetch detailed video information
      const videosResponse = await fetch(
        `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${apiKey}`
      )
      const videosData = await videosResponse.json()

      // Get current max episode number
      const { data: maxEpisodeResult } = await safeQuerySchema(orgSlug,
        `SELECT COALESCE(MAX("episodeNumber"), 0) as max_episode FROM "Episode" WHERE "showId" = $1`,
        [showId]
      )
      let currentMaxEpisode = maxEpisodeResult?.[0]?.max_episode || 0

      // Process each video
      for (const video of videosData.items) {
        // Filter out non-episode content
        const duration = parseDuration(video.contentDetails.duration)
        const title = video.snippet.title
        
        // Skip videos that are likely clips or shorts, not full episodes
        // Criteria: 
        // - Must be at least 30 minutes (1800 seconds) for a podcast episode
        // - OR have episode number in title (#XXX format)
        const hasEpisodeNumber = /[#]\d{3,}/.test(title)
        const isLongEnough = duration >= 1800
        
        if (!hasEpisodeNumber && !isLongEnough) {
          continue // Skip clips and shorts
        }
        
        totalVideos++

        // Check if episode exists
        const { data: existingEpisode } = await safeQuerySchema(orgSlug,
          `SELECT id FROM "Episode" WHERE "showId" = $1 AND "youtubeVideoId" = $2`,
          [showId, video.id]
        )

        if (existingEpisode && existingEpisode.length > 0) {
          // Update existing episode
          await querySchema(orgSlug,
            `UPDATE "Episode" 
             SET "youtubeViewCount" = $1, "youtubeLikeCount" = $2, "youtubeCommentCount" = $3, "updatedAt" = NOW()
             WHERE id = $4`,
            [
              parseInt(video.statistics?.viewCount || '0'),
              parseInt(video.statistics?.likeCount || '0'),
              parseInt(video.statistics?.commentCount || '0'),
              existingEpisode[0].id
            ]
          )
          episodesUpdated++
        } else {
          // Create new episode
          const episodeNumber = extractEpisodeNumber(video.snippet.title, currentMaxEpisode)
          if (episodeNumber > currentMaxEpisode) {
            currentMaxEpisode = episodeNumber
          }

          const episodeId = `ep_youtube_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

          await querySchema(orgSlug,
            `INSERT INTO "Episode" (
              id, "showId", "organizationId", "episodeNumber",
              title, duration, "durationSeconds", "airDate",
              status, "createdBy", "updatedAt", "youtubeVideoId",
              "youtubeUrl", "youtubeViewCount", "youtubeLikeCount",
              "youtubeCommentCount", "thumbnailUrl", "publishUrl"
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15, $16, $17
            )`,
            [
              episodeId,
              showId,
              session.organizationId,
              episodeNumber,
              video.snippet.title.substring(0, 500),
              duration,
              duration,
              new Date(video.snippet.publishedAt),
              'published',
              session.userId,
              video.id,
              `https://www.youtube.com/watch?v=${video.id}`,
              parseInt(video.statistics?.viewCount || '0'),
              parseInt(video.statistics?.likeCount || '0'),
              parseInt(video.statistics?.commentCount || '0'),
              video.snippet.thumbnails?.maxres?.url ||
                video.snippet.thumbnails?.high?.url ||
                video.snippet.thumbnails?.medium?.url ||
                video.snippet.thumbnails?.default?.url || '',
              `https://www.youtube.com/watch?v=${video.id}`
            ]
          )
          episodesCreated++
        }
      }

      pageToken = playlistData.nextPageToken
      pagesProcessed++

    } while (pageToken && pagesProcessed < maxPages)

    // Update show's last sync time
    await querySchema(orgSlug,
      `UPDATE "Show" SET "youtubeLastSyncAt" = NOW() WHERE id = $1`,
      [showId]
    )

    // Update quota usage
    const quotaUsed = pagesProcessed * 8 // Approximate quota usage
    await prisma.youTubeApiConfig.update({
      where: { organizationId: session.organizationId },
      data: {
        quotaUsed: {
          increment: quotaUsed
        }
      }
    })

    // Create sync log
    const syncLogId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await querySchema(orgSlug,
      `INSERT INTO "YouTubeSyncLog" (
        id, "organizationId", "syncType", status,
        "completedAt", "totalItems", "processedItems",
        "successfulItems", "failedItems", "quotaUsed",
        "syncConfig", results
      ) VALUES (
        $1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10, $11
      )`,
      [
        syncLogId,
        session.organizationId,
        'videos',
        'completed',
        totalVideos,
        totalVideos,
        episodesCreated + episodesUpdated,
        0,
        quotaUsed,
        JSON.stringify({ showId, maxPages }),
        JSON.stringify({
          created: episodesCreated,
          updated: episodesUpdated,
          totalProcessed: totalVideos
        })
      ]
    )

    return NextResponse.json({
      success: true,
      message: 'YouTube sync completed',
      stats: {
        totalVideos,
        episodesCreated,
        episodesUpdated,
        pagesProcessed,
        quotaUsed
      }
    })

  } catch (error: any) {
    console.error('YouTube sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { showId: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { showId } = params
    const orgSlug = session.organizationSlug!

    // Get show sync status
    const showQuery = `
      SELECT 
        s.id, 
        s.name, 
        s."youtubeLastSyncAt",
        COUNT(e.id) as episode_count
      FROM "Show" s
      LEFT JOIN "Episode" e ON e."showId" = s.id
      WHERE s.id = $1 AND s."organizationId" = $2
      GROUP BY s.id, s.name, s."youtubeLastSyncAt"
    `
    const { data: showResult } = await safeQuerySchema(orgSlug, showQuery, [showId, session.organizationId])

    if (!showResult || showResult.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    // Get recent sync logs
    const { data: syncLogs } = await safeQuerySchema(orgSlug,
      `SELECT * FROM "YouTubeSyncLog" 
       WHERE "organizationId" = $1 AND "syncConfig"::text LIKE $2
       ORDER BY "completedAt" DESC LIMIT 5`,
      [session.organizationId, `%"showId":"${showId}"%`]
    )

    return NextResponse.json({
      show: showResult[0],
      syncLogs: syncLogs || []
    })

  } catch (error: any) {
    console.error('Error fetching sync status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    )
  }
}