/**
 * YouTube Sync Orchestrator
 * 
 * Handles syncing YouTube channel uploads to Episodes in the organization schema.
 * Features:
 * - Paginated fetching with quota awareness
 * - Idempotent upserts based on youtubeVideoId
 * - Detailed logging and error handling
 * - Exponential backoff for rate limiting
 */

import { querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import { resolveYouTubeChannel } from './resolve-channel'
import { YouTubeAPIError, YouTubeQuotaError, YouTubeSyncError } from './errors'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

interface SyncOptions {
  orgSlug: string
  showId: string
  apiKey: string
  maxPages?: number
  since?: Date
  dryRun?: boolean
  userId?: string
  organizationId: string
}

interface SyncResult {
  success: boolean
  videosProcessed: number
  episodesCreated: number
  episodesUpdated: number
  episodesSkipped: number
  errors: string[]
  quotaUsed: number
  syncLogId?: string
}

interface VideoDetails {
  id: string
  title: string
  description: string
  publishedAt: Date
  durationSeconds: number
  thumbnailUrl: string
  viewCount: number
  likeCount: number
  commentCount: number
  url: string
}

const ENCRYPTION_KEY = process.env.YOUTUBE_ENCRYPTION_KEY || 'a8f5f167f44f4964e6c998dee827110ca8f5f167f44f4964e6c998dee827110c'

/**
 * Decrypt API key if encrypted
 */
function decryptApiKey(apiKey: string): string {
  if (!apiKey.includes(':')) {
    return apiKey // Not encrypted
  }
  
  try {
    const parts = apiKey.split(':')
    const iv = Buffer.from(parts.shift()!, 'hex')
    const encryptedText = Buffer.from(parts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    )
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
  } catch (error) {
    console.error('Failed to decrypt API key:', error)
    return apiKey // Return as-is if decryption fails
  }
}

/**
 * Parse ISO 8601 duration to seconds
 * PT15M33S -> 933 seconds
 * PT1H2M10S -> 3730 seconds
 */
function parseDuration(duration: string): number {
  if (!duration) return 0
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/)
  if (!match) return 0
  
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseFloat(match[3] || '0')
  
  return Math.floor(hours * 3600 + minutes * 60 + seconds)
}

/**
 * Extract episode number from title if present
 * Examples: "Episode 123", "Ep. 45", "#67", "Show 89"
 */
function extractEpisodeNumber(title: string): number | null {
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
  
  return null
}

/**
 * Exponential backoff with jitter
 */
async function sleep(ms: number): Promise<void> {
  const jitter = Math.random() * ms * 0.1 // 10% jitter
  return new Promise(resolve => setTimeout(resolve, ms + jitter))
}

/**
 * Fetch data from YouTube API with retry logic
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro'
        }
      })
      
      const data = await response.json()
      
      // Check for errors
      if (data.error) {
        const error = data.error
        
        // Quota exceeded - don't retry
        if (error.code === 403 && error.errors?.some((e: any) => e.reason === 'quotaExceeded')) {
          throw new YouTubeQuotaError('YouTube API quota exceeded')
        }
        
        // Rate limiting - retry with backoff
        if (error.code === 429 || error.code === 503) {
          if (attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000
            console.log(`Rate limited, retrying in ${backoffMs}ms...`)
            await sleep(backoffMs)
            continue
          }
        }
        
        throw new YouTubeAPIError(error.message || 'YouTube API error', 'API_ERROR')
      }
      
      return data
    } catch (error) {
      lastError = error as Error
      
      if (error instanceof YouTubeQuotaError) {
        throw error // Don't retry quota errors
      }
      
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000
        console.log(`Request failed, retrying in ${backoffMs}ms...`)
        await sleep(backoffMs)
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch from YouTube API')
}

/**
 * Sync YouTube channel uploads to Episodes
 */
export async function syncYouTubeUploads(options: SyncOptions): Promise<SyncResult> {
  const {
    orgSlug,
    showId,
    apiKey: encryptedApiKey,
    maxPages = 10,
    since,
    dryRun = false,
    userId,
    organizationId
  } = options
  
  const result: SyncResult = {
    success: false,
    videosProcessed: 0,
    episodesCreated: 0,
    episodesUpdated: 0,
    episodesSkipped: 0,
    errors: [],
    quotaUsed: 0
  }
  
  const apiKey = decryptApiKey(encryptedApiKey)
  
  // Create sync log entry using raw SQL
  let syncLog: any = null
  if (!dryRun) {
    try {
      const syncLogId = uuidv4()
      const syncLogQuery = `
        INSERT INTO "YouTubeSyncLog" (
          id, "organizationId", "syncType", status, 
          "startedAt", "totalItems", "processedItems", 
          "successfulItems", "failedItems", "syncConfig"
        ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)
        RETURNING *
      `
      const syncLogResult = await querySchema(orgSlug, syncLogQuery, [
        syncLogId,
        organizationId,
        'videos',
        'started',
        0, // totalItems
        0, // processedItems
        0, // successfulItems
        0, // failedItems
        JSON.stringify({
          showId,
          maxPages,
          since: since?.toISOString()
        })
      ])
      syncLog = syncLogResult[0]
      result.syncLogId = syncLog?.id
    } catch (error) {
      console.error('Failed to create sync log:', error)
    }
  }
  
  try {
    // Load show details using raw SQL
    const showQuery = `
      SELECT 
        id, name, "youtubeChannelUrl", "youtubeChannelId", 
        "youtubeChannelName", "youtubeUploadsPlaylistId", 
        "youtubePlaylistId", "youtubeAutoCreateEpisodes"
      FROM "Show"
      WHERE id = $1 AND "organizationId" = $2
      LIMIT 1
    `
    const { data: showResult } = await safeQuerySchema(orgSlug, showQuery, [showId, organizationId])
    const show = showResult[0]
    
    if (!show) {
      throw new YouTubeSyncError('Show not found')
    }
    
    // Resolve channel if needed
    let channelId = show.youtubeChannelId
    let uploadsPlaylistId = show.youtubeUploadsPlaylistId || show.youtubePlaylistId
    
    if (!channelId || !uploadsPlaylistId) {
      if (!show.youtubeChannelUrl) {
        throw new YouTubeSyncError('No YouTube channel configured for this show')
      }
      
      console.log('Resolving YouTube channel:', show.youtubeChannelUrl)
      const channelInfo = await resolveYouTubeChannel(apiKey, show.youtubeChannelUrl)
      
      channelId = channelInfo.channelId
      uploadsPlaylistId = channelInfo.uploadsPlaylistId
      
      // Update show with resolved IDs
      if (!dryRun) {
        const updateShowQuery = `
          UPDATE "Show"
          SET 
            "youtubeChannelId" = $1,
            "youtubeChannelName" = $2,
            "youtubeUploadsPlaylistId" = $3,
            "updatedAt" = NOW()
          WHERE id = $4
        `
        await querySchema(orgSlug, updateShowQuery, [
          channelId,
          channelInfo.channelTitle,
          uploadsPlaylistId,
          showId
        ])
      }
      
      result.quotaUsed += 5 // Channel resolution uses ~5 quota units
    }
    
    console.log(`Syncing uploads for channel ${channelId}, playlist ${uploadsPlaylistId}`)
    
    // Fetch playlist items (videos)
    const videoIds: string[] = []
    let pageToken: string | undefined = undefined
    let pagesProcessed = 0
    
    while (pagesProcessed < maxPages) {
      const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
      playlistUrl.searchParams.set('part', 'contentDetails,snippet')
      playlistUrl.searchParams.set('playlistId', uploadsPlaylistId)
      playlistUrl.searchParams.set('maxResults', '50')
      playlistUrl.searchParams.set('key', apiKey)
      
      if (pageToken) {
        playlistUrl.searchParams.set('pageToken', pageToken)
      }
      
      const playlistData = await fetchWithRetry(playlistUrl.toString())
      result.quotaUsed += 3 // playlistItems.list costs ~3 units
      
      if (!playlistData.items || playlistData.items.length === 0) {
        break
      }
      
      // Filter by date if specified
      for (const item of playlistData.items) {
        const publishedAt = new Date(item.snippet.publishedAt)
        if (since && publishedAt < since) {
          continue
        }
        videoIds.push(item.contentDetails.videoId)
      }
      
      pagesProcessed++
      pageToken = playlistData.nextPageToken
      
      if (!pageToken) {
        break
      }
    }
    
    console.log(`Found ${videoIds.length} videos to process`)
    
    if (videoIds.length === 0) {
      result.success = true
      return result
    }
    
    // Fetch detailed video information in batches
    const videosDetails: VideoDetails[] = []
    const batchSize = 50 // YouTube allows up to 50 IDs per request
    
    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize)
      const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
      detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics')
      detailsUrl.searchParams.set('id', batch.join(','))
      detailsUrl.searchParams.set('key', apiKey)
      
      const detailsData = await fetchWithRetry(detailsUrl.toString())
      result.quotaUsed += 5 // videos.list costs ~5 units
      
      for (const video of detailsData.items || []) {
        videosDetails.push({
          id: video.id,
          title: video.snippet.title,
          description: video.snippet.description || '',
          publishedAt: new Date(video.snippet.publishedAt),
          durationSeconds: parseDuration(video.contentDetails.duration),
          thumbnailUrl: video.snippet.thumbnails?.maxres?.url ||
                       video.snippet.thumbnails?.high?.url ||
                       video.snippet.thumbnails?.medium?.url ||
                       video.snippet.thumbnails?.default?.url || '',
          viewCount: parseInt(video.statistics?.viewCount || '0'),
          likeCount: parseInt(video.statistics?.likeCount || '0'),
          commentCount: parseInt(video.statistics?.commentCount || '0'),
          url: `https://www.youtube.com/watch?v=${video.id}`
        })
      }
    }
    
    console.log(`Fetched details for ${videosDetails.length} videos`)
    result.videosProcessed = videosDetails.length
    
    // Process each video and create/update episodes
    for (const video of videosDetails) {
      try {
        // Check if episode already exists
        const existingQuery = `
          SELECT id, title, "youtubeViewCount"
          FROM "Episode"
          WHERE "showId" = $1 AND "youtubeVideoId" = $2
          LIMIT 1
        `
        const { data: existingResult } = await safeQuerySchema(orgSlug, existingQuery, [showId, video.id])
        const existingEpisode = existingResult[0]
        
        if (existingEpisode) {
          // Update existing episode with latest stats
          if (!dryRun) {
            const updateEpisodeQuery = `
              UPDATE "Episode"
              SET 
                "youtubeViewCount" = $1,
                "youtubeLikeCount" = $2,
                "youtubeCommentCount" = $3,
                "updatedAt" = NOW()
              WHERE id = $4
            `
            await querySchema(orgSlug, updateEpisodeQuery, [
              video.viewCount,
              video.likeCount,
              video.commentCount,
              existingEpisode.id
            ])
          }
          result.episodesUpdated++
        } else if (show.youtubeAutoCreateEpisodes) {
          // Create new episode
          if (!dryRun) {
            // Determine episode number
            let episodeNumber = extractEpisodeNumber(video.title)
            
            if (!episodeNumber) {
              // Get next available episode number
              const maxEpisodeQuery = `
                SELECT COALESCE(MAX("episodeNumber"), 0) as max_episode
                FROM "Episode"
                WHERE "showId" = $1
              `
              const { data: maxResult } = await safeQuerySchema(orgSlug, maxEpisodeQuery, [showId])
              episodeNumber = (maxResult[0]?.max_episode || 0) + 1
            }
            
            const createEpisodeQuery = `
              INSERT INTO "Episode" (
                id, "showId", "organizationId", "episodeNumber",
                title, duration, "durationSeconds", "airDate",
                status, "createdBy", "updatedAt", "youtubeVideoId",
                "youtubeUrl", "youtubeViewCount", "youtubeLikeCount",
                "youtubeCommentCount", "thumbnailUrl", "publishUrl"
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15, $16, $17
              )
            `
            await querySchema(orgSlug, createEpisodeQuery, [
              uuidv4(),
              showId,
              organizationId,
              episodeNumber,
              video.title.substring(0, 500), // Limit title length
              video.durationSeconds,
              video.durationSeconds,
              video.publishedAt,
              'published',
              userId || 'youtube-sync',
              video.id,
              video.url,
              video.viewCount,
              video.likeCount,
              video.commentCount,
              video.thumbnailUrl,
              video.url
            ])
          }
          result.episodesCreated++
        } else {
          result.episodesSkipped++
        }
      } catch (error) {
        console.error(`Error processing video ${video.id}:`, error)
        result.errors.push(`Video ${video.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Update show's last sync timestamp
    if (!dryRun && (result.episodesCreated > 0 || result.episodesUpdated > 0)) {
      const updateSyncTimeQuery = `
        UPDATE "Show"
        SET "youtubeLastSyncAt" = NOW()
        WHERE id = $1
      `
      await querySchema(orgSlug, updateSyncTimeQuery, [showId])
    }
    
    result.success = true
    
    // Update sync log with success
    if (syncLog && !dryRun) {
      const updateSyncLogQuery = `
        UPDATE "YouTubeSyncLog"
        SET 
          status = $1,
          "completedAt" = NOW(),
          "totalItems" = $2,
          "processedItems" = $3,
          "successfulItems" = $4,
          "failedItems" = $5,
          "quotaUsed" = $6,
          results = $7
        WHERE id = $8
      `
      await querySchema(orgSlug, updateSyncLogQuery, [
        'completed',
        result.videosProcessed,
        result.videosProcessed,
        result.episodesCreated + result.episodesUpdated,
        result.errors.length,
        result.quotaUsed,
        JSON.stringify({
          created: result.episodesCreated,
          updated: result.episodesUpdated,
          skipped: result.episodesSkipped,
          errors: result.errors
        }),
        syncLog.id
      ])
    }
    
  } catch (error) {
    console.error('YouTube sync error:', error)
    
    result.success = false
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    
    // Update sync log with failure
    if (syncLog && !dryRun) {
      const updateSyncLogErrorQuery = `
        UPDATE "YouTubeSyncLog"
        SET 
          status = $1,
          "completedAt" = NOW(),
          "totalItems" = $2,
          "processedItems" = $3,
          "successfulItems" = $4,
          "failedItems" = $5,
          "errorMessage" = $6,
          "errorDetails" = $7,
          "quotaUsed" = $8,
          results = $9
        WHERE id = $10
      `
      await querySchema(orgSlug, updateSyncLogErrorQuery, [
        result.videosProcessed > 0 ? 'partial' : 'failed',
        result.videosProcessed,
        result.videosProcessed,
        result.episodesCreated + result.episodesUpdated,
        result.errors.length,
        error instanceof Error ? error.message : 'Unknown error',
        JSON.stringify({
          error: error instanceof Error ? error.toString() : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }),
        result.quotaUsed,
        JSON.stringify({
          created: result.episodesCreated,
          updated: result.episodesUpdated,
          skipped: result.episodesSkipped,
          errors: result.errors
        }),
        syncLog.id
      ])
    }
    
    if (error instanceof YouTubeQuotaError) {
      throw error
    }
    
    throw new YouTubeSyncError(
      `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { showId, errors: result.errors }
    )
  }
  
  return result
}