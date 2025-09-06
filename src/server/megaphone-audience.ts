import { querySchema } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'
import axios from 'axios'

export interface MegaphoneDownloadsData {
  showId: string
  episodeId: string
  date: Date
  downloads: number
  region?: string
}

export interface MegaphoneMarketData {
  marketCode: string
  marketName: string
  downloads: number
}

/**
 * Fetch Megaphone downloads per episode/show for a date range
 */
export async function megaDownloadsByShow({
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
}): Promise<MegaphoneDownloadsData[]> {
  try {
    console.log('megaDownloadsByShow - orgSlug:', orgSlug, 'orgId:', orgId)
    
    // Use querySchema for multi-tenant safe queries
    const showQuery = `
      SELECT id, "megaphonePodcastId", name 
      FROM "Show" 
      WHERE "megaphonePodcastId" IS NOT NULL
      ${showIds ? `AND id = ANY($1)` : ''}
    `
    const shows = await querySchema<any>(orgSlug, showQuery, showIds ? [showIds] : [])

    if (shows.length === 0) {
      console.log('No shows with Megaphone podcasts found')
      return []
    }

    // Get Megaphone API credentials using raw query
    const orgSettings = await prisma.$queryRaw<any[]>`
      SELECT "megaphoneApiKey", "megaphoneNetworkId" 
      FROM "OrganizationSettings" 
      WHERE "organizationId" = ${orgId}
      LIMIT 1
    `

    if (!orgSettings?.[0]?.megaphoneApiKey) {
      console.log(`No Megaphone API key for org ${orgId}`)
      return []
    }
    
    const settings = orgSettings[0]

    const results: MegaphoneDownloadsData[] = []
    
    // Fetch analytics for each podcast
    for (const show of shows) {
      if (!show.megaphonePodcastId) continue
      
      try {
        // Fetch episodes for this show from Megaphone
        const episodesUrl = `https://cms.megaphone.fm/api/networks/${settings.megaphoneNetworkId}/podcasts/${show.megaphonePodcastId}/episodes`
        
        const episodesResponse = await axios.get(episodesUrl, {
          headers: {
            'Authorization': `Token ${settings.megaphoneApiKey}`,
            'Accept': 'application/json'
          },
          params: {
            published_after: startDate.toISOString(),
            published_before: endDate.toISOString()
          }
        })

        const episodes = episodesResponse.data.episodes || []
        
        // Fetch download analytics for each episode
        for (const episode of episodes) {
          const analyticsUrl = `https://cms.megaphone.fm/api/networks/${settings.megaphoneNetworkId}/podcasts/${show.megaphonePodcastId}/episodes/${episode.id}/downloads`
          
          const analyticsResponse = await axios.get(analyticsUrl, {
            headers: {
              'Authorization': `Token ${settings.megaphoneApiKey}`,
              'Accept': 'application/json'
            },
            params: {
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
              group_by: 'day'
            }
          })

          // Process download data
          if (analyticsResponse.data.data) {
            for (const dataPoint of analyticsResponse.data.data) {
              results.push({
                showId: show.id,
                episodeId: episode.id,
                date: new Date(dataPoint.date),
                downloads: dataPoint.downloads || 0
              })
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching Megaphone analytics for show ${show.id}:`, error)
        // Continue with other shows
      }
    }

    return results
  } catch (error) {
    console.error('Error in megaDownloadsByShow:', error)
    return []
  }
}

/**
 * Fetch Megaphone downloads by market/region
 */
export async function megaDownloadsByMarket({
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
}): Promise<MegaphoneMarketData[]> {
  try {
    console.log('megaDownloadsByMarket - orgSlug:', orgSlug, 'orgId:', orgId)
    
    // Use querySchema for multi-tenant safe queries
    const showQuery = `
      SELECT id, "megaphonePodcastId"
      FROM "Show" 
      WHERE "megaphonePodcastId" IS NOT NULL
      ${showIds ? `AND id = ANY($1)` : ''}
    `
    const shows = await querySchema<any>(orgSlug, showQuery, showIds ? [showIds] : [])

    if (shows.length === 0) {
      return []
    }

    // Get Megaphone API credentials using raw query
    const orgSettings = await prisma.$queryRaw<any[]>`
      SELECT "megaphoneApiKey", "megaphoneNetworkId" 
      FROM "OrganizationSettings" 
      WHERE "organizationId" = ${orgId}
      LIMIT 1
    `

    if (!orgSettings?.[0]?.megaphoneApiKey) {
      return []
    }
    
    const settings = orgSettings[0]

    const marketMap = new Map<string, number>()
    
    // Fetch geo analytics for each podcast
    for (const show of shows) {
      if (!show.megaphonePodcastId) continue
      
      try {
        // Fetch geographic download data
        const geoUrl = `https://cms.megaphone.fm/api/networks/${settings.megaphoneNetworkId}/podcasts/${show.megaphonePodcastId}/downloads/geography`
        
        const geoResponse = await axios.get(geoUrl, {
          headers: {
            'Authorization': `Token ${settings.megaphoneApiKey}`,
            'Accept': 'application/json'
          },
          params: {
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0]
          }
        })

        // Aggregate downloads by market
        if (geoResponse.data.data) {
          for (const market of geoResponse.data.data) {
            const code = normalizeMarketCode(market.country_code || market.region)
            marketMap.set(code, (marketMap.get(code) || 0) + (market.downloads || 0))
          }
        }
      } catch (error) {
        console.error(`Error fetching Megaphone geo data for show ${show.id}:`, error)
      }
    }

    // Convert to array with market names
    const results: MegaphoneMarketData[] = []
    for (const [code, downloads] of marketMap.entries()) {
      results.push({
        marketCode: code,
        marketName: getMarketName(code),
        downloads
      })
    }

    return results.sort((a, b) => b.downloads - a.downloads)
  } catch (error) {
    console.error('Error in megaDownloadsByMarket:', error)
    return []
  }
}

/**
 * Normalize market codes from different formats
 */
function normalizeMarketCode(code: string): string {
  // Handle various formats: "US", "USA", "United States", etc.
  const mappings: Record<string, string> = {
    'USA': 'US',
    'United States': 'US',
    'United Kingdom': 'GB',
    'Great Britain': 'GB',
    'Canada': 'CA',
    // Add more mappings as needed
  }
  return mappings[code] || code.substring(0, 2).toUpperCase()
}

/**
 * Get human-readable market name
 */
function getMarketName(code: string): string {
  const marketNames: Record<string, string> = {
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
  return marketNames[code] || code
}

/**
 * Calculate content velocity metrics
 */
export async function calculateContentVelocity({
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
}): Promise<{
  kpi7d: number
  sparkline: Array<{ date: string; value: number }>
}> {
  try {
    console.log('calculateContentVelocity - orgSlug:', orgSlug, 'orgId:', orgId)
    
    // Use querySchema for multi-tenant safe queries
    const episodeQuery = `
      SELECT id, "showId", "airDate", "megaphoneEpisodeId"
      FROM "Episode" 
      WHERE "airDate" >= $1 AND "airDate" <= $2
      ${showIds ? `AND "showId" = ANY($3)` : ''}
      ORDER BY "airDate" ASC
    `
    const episodes = await querySchema<any>(
      orgSlug, 
      episodeQuery, 
      showIds ? [startDate, endDate, showIds] : [startDate, endDate]
    )

    if (episodes.length === 0) {
      return { kpi7d: 0, sparkline: [] }
    }

    // Fetch download data for velocity calculation
    const downloadData = await megaDownloadsByShow({
      orgSlug,
      orgId,
      startDate,
      endDate: new Date(Math.min(endDate.getTime(), Date.now())),
      showIds
    })

    // Calculate 7-day cumulative downloads per episode
    const velocityData: number[] = []
    const sparklineData: Array<{ date: string; value: number }> = []
    
    for (const episode of episodes) {
      const airDate = new Date(episode.airDate)
      const sevenDaysLater = new Date(airDate)
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
      
      // Sum downloads in first 7 days
      const downloads7d = downloadData
        .filter(d => 
          d.episodeId === episode.megaphoneEpisodeId &&
          d.date >= airDate &&
          d.date <= sevenDaysLater
        )
        .reduce((sum, d) => sum + d.downloads, 0)
      
      velocityData.push(downloads7d)
      
      // Add to sparkline
      sparklineData.push({
        date: airDate.toISOString().split('T')[0],
        value: downloads7d
      })
    }

    // Calculate average 7-day velocity
    const kpi7d = velocityData.length > 0
      ? Math.round(velocityData.reduce((a, b) => a + b, 0) / velocityData.length)
      : 0

    return {
      kpi7d,
      sparkline: sparklineData.slice(0, 30) // Limit to 30 points for display
    }
  } catch (error) {
    console.error('Error calculating content velocity:', error)
    return { kpi7d: 0, sparkline: [] }
  }
}