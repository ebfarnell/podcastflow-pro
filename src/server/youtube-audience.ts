import { google } from 'googleapis'
import { querySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'

const youtube = google.youtube('v3')
const youtubeAnalytics = google.youtubeAnalytics('v2')

export interface YouTubeViewsData {
  showId: string
  videoId: string
  date: Date
  views: number
  watchTimeMinutes: number
  region?: string
}

export interface YouTubeRegionData {
  regionCode: string
  regionName: string
  views: number
}

/**
 * Fetch YouTube views per video/show for a date range
 */
export async function ytViewsByShow({
  orgSlug,
  orgId,
  startDate,
  endDate,
  showIds
}: {
  orgSlug: string
  orgId: string
  startDate: Date
  endDate: Date
  showIds?: string[]
}): Promise<YouTubeViewsData[]> {
  try {
    console.log('ytViewsByShow - orgSlug:', orgSlug, 'orgId:', orgId)
    
    // Use querySchema for multi-tenant safe queries
    const showQuery = `
      SELECT id, "youtubeChannelId", name 
      FROM "Show" 
      WHERE "youtubeChannelId" IS NOT NULL
      ${showIds ? `AND id = ANY($1)` : ''}
    `
    const shows = await querySchema<any>(orgSlug, showQuery, showIds ? [showIds] : [])

    if (shows.length === 0) {
      console.log('No shows with YouTube channels found')
      return []
    }

    const results: YouTubeViewsData[] = []
    
    // Fetch analytics for each channel
    for (const show of shows) {
      if (!show.youtubeChannelId) continue
      
      try {
        // Get OAuth token for this org using raw query since Prisma model might not be updated
        const orgSettings = await prisma.$queryRaw<any[]>`
          SELECT "youtubeAccessToken", "youtubeRefreshToken" 
          FROM "OrganizationSettings" 
          WHERE "organizationId" = ${orgId}
          LIMIT 1
        `
        
        if (!orgSettings?.[0]?.youtubeAccessToken) {
          console.log(`No YouTube auth for org ${orgId}`)
          continue
        }
        
        const settings = orgSettings[0]

        // Set up OAuth client
        const oauth2Client = new google.auth.OAuth2(
          process.env.YOUTUBE_CLIENT_ID,
          process.env.YOUTUBE_CLIENT_SECRET,
          process.env.YOUTUBE_REDIRECT_URI
        )
        
        oauth2Client.setCredentials({
          access_token: settings.youtubeAccessToken,
          refresh_token: settings.youtubeRefreshToken
        })

        // Fetch channel videos first
        const videosResponse = await youtube.search.list({
          auth: oauth2Client,
          part: ['id'],
          channelId: show.youtubeChannelId,
          type: ['video'],
          publishedAfter: startDate.toISOString(),
          publishedBefore: endDate.toISOString(),
          maxResults: 50
        })

        const videoIds = videosResponse.data.items?.map(item => item.id?.videoId).filter(Boolean) || []
        
        if (videoIds.length === 0) continue

        // Fetch analytics for videos
        const analyticsResponse = await youtubeAnalytics.reports.query({
          auth: oauth2Client,
          ids: `channel==${show.youtubeChannelId}`,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          metrics: 'views,estimatedMinutesWatched',
          dimensions: 'video,day',
          filters: `video==${videoIds.join(',')}`,
          maxResults: 1000
        })

        // Process analytics data
        if (analyticsResponse.data.rows) {
          for (const row of analyticsResponse.data.rows) {
            results.push({
              showId: show.id,
              videoId: row[0] as string,
              date: new Date(row[1] as string),
              views: row[2] as number,
              watchTimeMinutes: row[3] as number
            })
          }
        }
      } catch (error) {
        console.error(`Error fetching YouTube analytics for show ${show.id}:`, error)
        // Continue with other shows
      }
    }

    return results
  } catch (error) {
    console.error('Error in ytViewsByShow:', error)
    return []
  }
}

/**
 * Fetch YouTube views by geographic region
 */
export async function ytViewsByRegion({
  orgSlug,
  orgId,
  startDate,
  endDate,
  showIds
}: {
  orgSlug: string
  orgId: string
  startDate: Date
  endDate: Date
  showIds?: string[]
}): Promise<YouTubeRegionData[]> {
  try {
    console.log('ytViewsByRegion - orgSlug:', orgSlug, 'orgId:', orgId)
    
    // Use querySchema for multi-tenant safe queries
    const showQuery = `
      SELECT id, "youtubeChannelId"
      FROM "Show" 
      WHERE "youtubeChannelId" IS NOT NULL
      ${showIds ? `AND id = ANY($1)` : ''}
    `
    const shows = await querySchema<any>(orgSlug, showQuery, showIds ? [showIds] : [])

    if (shows.length === 0) {
      return []
    }

    const regionMap = new Map<string, number>()
    
    for (const show of shows) {
      if (!show.youtubeChannelId) continue
      
      try {
        // Get OAuth token using raw query
        const orgSettings = await prisma.$queryRaw<any[]>`
          SELECT "youtubeAccessToken", "youtubeRefreshToken" 
          FROM "OrganizationSettings" 
          WHERE "organizationId" = ${orgId}
          LIMIT 1
        `
        
        if (!orgSettings?.[0]?.youtubeAccessToken) continue
        
        const settings = orgSettings[0]

        const oauth2Client = new google.auth.OAuth2(
          process.env.YOUTUBE_CLIENT_ID,
          process.env.YOUTUBE_CLIENT_SECRET,
          process.env.YOUTUBE_REDIRECT_URI
        )
        
        oauth2Client.setCredentials({
          access_token: settings.youtubeAccessToken,
          refresh_token: settings.youtubeRefreshToken
        })

        // Fetch analytics by country
        const analyticsResponse = await youtubeAnalytics.reports.query({
          auth: oauth2Client,
          ids: `channel==${show.youtubeChannelId}`,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          metrics: 'views',
          dimensions: 'country',
          maxResults: 250
        })

        // Aggregate by region
        if (analyticsResponse.data.rows) {
          for (const row of analyticsResponse.data.rows) {
            const countryCode = row[0] as string
            const views = row[1] as number
            regionMap.set(countryCode, (regionMap.get(countryCode) || 0) + views)
          }
        }
      } catch (error) {
        console.error(`Error fetching YouTube geo data for show ${show.id}:`, error)
      }
    }

    // Convert to array with region names
    const results: YouTubeRegionData[] = []
    for (const [code, views] of regionMap.entries()) {
      results.push({
        regionCode: code,
        regionName: getRegionName(code),
        views
      })
    }

    return results.sort((a, b) => b.views - a.views)
  } catch (error) {
    console.error('Error in ytViewsByRegion:', error)
    return []
  }
}

/**
 * Helper to get human-readable region name from ISO code
 */
function getRegionName(code: string): string {
  const regionNames: Record<string, string> = {
    'US': 'United States',
    'CA': 'Canada',
    'GB': 'United Kingdom',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'JP': 'Japan',
    'IN': 'India',
    'BR': 'Brazil',
    'MX': 'Mexico',
    // Add more as needed
  }
  return regionNames[code] || code
}