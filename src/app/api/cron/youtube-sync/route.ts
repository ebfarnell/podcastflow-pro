import { NextRequest, NextResponse } from 'next/server'
import { safeQuerySchema, querySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'

// Force dynamic rendering
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron job

/**
 * YouTube Daily Sync Cron Job
 * This endpoint should be called daily by a cron scheduler (e.g., GitHub Actions, Vercel Cron, or external service)
 * It syncs YouTube data for all organizations that have YouTube integration enabled with daily sync frequency
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication header check for cron service
    const cronSecret = request.headers.get('x-cron-secret')
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[YouTube Cron] Starting daily YouTube sync...')
    
    // Get all organizations with YouTube integration and daily sync enabled
    const organizations = await prisma.organization.findMany({
      where: {
        status: 'active'
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    })

    const syncResults = []
    
    for (const org of organizations) {
      try {
        // Check if organization has YouTube configuration
        const config = await prisma.youTubeApiConfig.findUnique({
          where: { organizationId: org.id }
        })

        if (!config || !config.apiKey) {
          console.log(`[YouTube Cron] Skipping ${org.name} - No YouTube API configured`)
          continue
        }

        // Check sync settings from YouTubeSyncSettings table if it exists
        const syncSettingsQuery = `
          SELECT "syncFrequency", "lastSyncAt"
          FROM "YouTubeSyncSettings"
          WHERE "organizationId" = $1
        `
        const { data: syncSettings } = await safeQuerySchema(
          org.slug,
          syncSettingsQuery,
          [org.id]
        ).catch(() => ({ data: null }))

        // Default to daily if no settings found
        const syncFrequency = syncSettings?.[0]?.syncFrequency || 'daily'
        const lastSyncAt = syncSettings?.[0]?.lastSyncAt

        // Check if sync is needed based on frequency
        if (syncFrequency === 'manual') {
          console.log(`[YouTube Cron] Skipping ${org.name} - Manual sync only`)
          continue
        }

        if (syncFrequency === 'hourly') {
          // Hourly syncs should be handled by a separate more frequent cron
          console.log(`[YouTube Cron] Skipping ${org.name} - Hourly sync (handled separately)`)
          continue
        }

        // Check if already synced today (for daily) or this week (for weekly)
        if (lastSyncAt) {
          const lastSync = new Date(lastSyncAt)
          const now = new Date()
          const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)
          
          if (syncFrequency === 'daily' && hoursSinceLastSync < 20) {
            console.log(`[YouTube Cron] Skipping ${org.name} - Already synced within 20 hours`)
            continue
          }
          
          if (syncFrequency === 'weekly' && hoursSinceLastSync < 24 * 6) {
            console.log(`[YouTube Cron] Skipping ${org.name} - Already synced within 6 days`)
            continue
          }
        }

        // Get all shows with YouTube channels for this organization
        const showsQuery = `
          SELECT id, name, "youtubeChannelId" 
          FROM "Show" 
          WHERE "organizationId" = $1 
            AND "youtubeChannelId" IS NOT NULL 
            AND "youtubeChannelId" != ''
        `
        const { data: shows } = await safeQuerySchema(
          org.slug,
          showsQuery,
          [org.id]
        )

        if (!shows || shows.length === 0) {
          console.log(`[YouTube Cron] ${org.name} - No shows with YouTube channels`)
          continue
        }

        console.log(`[YouTube Cron] Syncing ${shows.length} shows for ${org.name}`)
        
        let showsSynced = 0
        let totalEpisodes = 0
        
        // Sync each show directly without calling the API endpoint
        for (const show of shows) {
          try {
            console.log(`[YouTube Cron] Starting sync for show: ${show.name} (${show.id})`)
            
            // Get YouTube API key
            const apiKeyResult = await prisma.youTubeApiConfig.findUnique({
              where: { organizationId: org.id },
              select: { apiKey: true }
            })
            
            if (!apiKeyResult?.apiKey) {
              console.log(`[YouTube Cron] No API key configured for ${org.name}`)
              continue
            }
            
            // Get uploads playlist ID if not set
            let uploadsPlaylistId = show.youtubeUploadsPlaylistId
            if (!uploadsPlaylistId && show.youtubeChannelId) {
              // Fetch channel details to get uploads playlist
              const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${show.youtubeChannelId}&key=${apiKeyResult.apiKey}`
              const channelResponse = await fetch(channelUrl)
              const channelData = await channelResponse.json()
              
              if (channelData.items?.[0]) {
                uploadsPlaylistId = channelData.items[0].contentDetails?.relatedPlaylists?.uploads
                if (uploadsPlaylistId) {
                  // Update show with uploads playlist ID
                  await querySchema(org.slug,
                    `UPDATE "Show" SET "youtubeUploadsPlaylistId" = $1 WHERE id = $2`,
                    [uploadsPlaylistId, show.id]
                  )
                }
              }
            }
            
            if (!uploadsPlaylistId) {
              console.log(`[YouTube Cron] No uploads playlist for show ${show.name}`)
              continue
            }
            
            // Fetch videos from YouTube
            let pageToken = undefined
            let videosProcessed = 0
            let episodesCreated = 0
            let episodesUpdated = 0
            const maxPages = 3 // Limit to prevent quota exhaustion
            let pagesProcessed = 0
            
            do {
              const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}&key=${apiKeyResult.apiKey}`
              const playlistResponse = await fetch(playlistUrl)
              const playlistData = await playlistResponse.json()
              
              if (!playlistData.items) {
                console.log(`[YouTube Cron] No videos found for ${show.name}`)
                break
              }
              
              // Process each video
              for (const item of playlistData.items) {
                const videoId = item.contentDetails.videoId
                
                // Check if episode already exists
                const { data: existing } = await safeQuerySchema(org.slug,
                  `SELECT id FROM "Episode" WHERE "youtubeVideoId" = $1`,
                  [videoId]
                )
                
                if (existing && existing.length > 0) {
                  episodesUpdated++
                } else {
                  // Create new episode (simplified version)
                  const episodeId = `ep_yt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                  await querySchema(org.slug,
                    `INSERT INTO "Episode" (
                      id, "showId", "organizationId", title, 
                      "airDate", status, "youtubeVideoId", "youtubeUrl", 
                      "createdBy", "updatedAt"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                    ON CONFLICT (id) DO NOTHING`,
                    [
                      episodeId,
                      show.id,
                      org.id,
                      item.snippet.title.substring(0, 500),
                      new Date(item.snippet.publishedAt),
                      'published',
                      videoId,
                      `https://www.youtube.com/watch?v=${videoId}`,
                      'system-cron'
                    ]
                  )
                  episodesCreated++
                }
                videosProcessed++
              }
              
              pageToken = playlistData.nextPageToken
              pagesProcessed++
            } while (pageToken && pagesProcessed < maxPages)
            
            showsSynced++
            totalEpisodes += episodesCreated + episodesUpdated
            
            console.log(`[YouTube Cron] ✓ Synced ${show.name}: ${episodesCreated} created, ${episodesUpdated} updated`)
            
          } catch (error) {
            console.error(`[YouTube Cron] ✗ Error syncing show ${show.id}:`, error)
          }
        }

        // Update last sync timestamp
        await querySchema(
          org.slug,
          `INSERT INTO "YouTubeSyncSettings" ("organizationId", "lastSyncAt", "syncFrequency")
           VALUES ($1, NOW(), $2)
           ON CONFLICT ("organizationId") 
           DO UPDATE SET "lastSyncAt" = NOW()`,
          [org.id, syncFrequency]
        ).catch(err => {
          // If YouTubeSyncSettings table doesn't exist, update IntegrationStatus instead
          console.log('[YouTube Cron] Updating IntegrationStatus instead')
          return querySchema(
            'public',
            `INSERT INTO "IntegrationStatus" (
              "organizationId", 
              platform, 
              connected, 
              "lastSync"
            ) VALUES ($1, 'youtube', true, NOW())
            ON CONFLICT ("organizationId", platform) 
            DO UPDATE SET "lastSync" = NOW()`,
            [org.id]
          )
        })

        syncResults.push({
          organization: org.name,
          showsSynced,
          totalShows: shows.length,
          totalEpisodes,
          success: true
        })

        console.log(`[YouTube Cron] ✓ Completed sync for ${org.name}: ${showsSynced}/${shows.length} shows, ${totalEpisodes} episodes`)
        
      } catch (error) {
        console.error(`[YouTube Cron] ✗ Error syncing organization ${org.name}:`, error)
        syncResults.push({
          organization: org.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = syncResults.filter(r => r.success).length
    const totalEpisodes = syncResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.totalEpisodes || 0), 0)

    console.log(`[YouTube Cron] Daily sync completed: ${successCount}/${organizations.length} organizations, ${totalEpisodes} total episodes`)

    return NextResponse.json({
      message: 'Daily YouTube sync completed',
      timestamp: new Date().toISOString(),
      organizationsSynced: successCount,
      totalOrganizations: organizations.length,
      totalEpisodes,
      results: syncResults
    })

  } catch (error) {
    console.error('[YouTube Cron] Fatal error in daily sync:', error)
    return NextResponse.json(
      { 
        error: 'Failed to complete daily YouTube sync',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}

// POST endpoint for manual trigger (useful for testing)
export async function POST(request: NextRequest) {
  return GET(request)
}