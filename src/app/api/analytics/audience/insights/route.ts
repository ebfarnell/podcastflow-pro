import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { getOrgPrismaClient } from '@/lib/db/multi-tenant-prisma'
import { accessLogger } from '@/lib/security/access-logger'
import { ytViewsByShow, ytViewsByRegion } from '@/server/youtube-audience'
import { megaDownloadsByShow, megaDownloadsByMarket, calculateContentVelocity } from '@/server/megaphone-audience'
import { cache } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { organizationId, role } = user

    // Get query parameters
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '30d'
    const customStartDate = url.searchParams.get('startDate')
    const customEndDate = url.searchParams.get('endDate')
    const showIdsParam = url.searchParams.get('showIds')
    const showIds = showIdsParam ? showIdsParam.split(',') : undefined

    console.log('📊 Analytics Audience Insights API: Fetching insights', { timeRange, organizationId, showIds })

    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate: Date = now
    
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
    } else {
      startDate = new Date()
      switch (timeRange) {
        case '1d':
          startDate.setDate(now.getDate() - 1)
          break
        case '7d':
          startDate.setDate(now.getDate() - 7)
          break
        case '30d':
          startDate.setDate(now.getDate() - 30)
          break
        case '90d':
          startDate.setDate(now.getDate() - 90)
          break
        case 'mtd':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'qtd':
          const currentQuarter = Math.floor(now.getMonth() / 3)
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1)
          break
        case 'ytd':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
        default:
          startDate.setDate(now.getDate() - 30)
      }
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'GET',
        '/api/analytics/audience/insights',
        request
      )
    }

    // Check cache first
    const cacheKey = `insights:${organizationId}:${startDate.toISOString()}:${endDate.toISOString()}:${showIds?.join(',') || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) {
      console.log('✅ Returning cached insights')
      return NextResponse.json(cached)
    }

    // Fetch data for insights using schema-aware queries and platform APIs
    const [campaigns, shows, episodes, advertisers, ytViews, megaDownloads, ytRegions, megaMarkets, contentVelocity] = await Promise.all([
      // Fetch campaigns
      (async () => {
        const campaignsQuery = `
          SELECT 
            c.*,
            a.id as advertiser_id, a.name as advertiser_name, a.industry as advertiser_industry
          FROM "Campaign" c
          LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
          WHERE c."createdAt" >= $1 AND c."createdAt" <= $2
        `
        const campaignsRaw = await querySchema<any>(orgSlug, campaignsQuery, [startDate, endDate])
        return campaignsRaw.map(campaign => ({
          ...campaign,
          advertiser: campaign.advertiser_id ? {
            id: campaign.advertiser_id,
            name: campaign.advertiser_name,
            industry: campaign.advertiser_industry
          } : null
        }))
      })(),
      
      // Fetch shows with episodes
      (async () => {
        const showsQuery = `SELECT * FROM "Show"`
        const showsRaw = await querySchema<any>(orgSlug, showsQuery, [])
        
        // For each show, fetch episodes in date range
        const shows = await Promise.all(showsRaw.map(async (show) => {
          const episodesQuery = `
            SELECT * FROM "Episode" 
            WHERE "showId" = $1 AND "airDate" >= $2 AND "airDate" <= $3
          `
          const episodes = await querySchema<any>(orgSlug, episodesQuery, [show.id, startDate, endDate])
          return {
            ...show,
            episodes
          }
        }))
        
        return shows
      })(),
      
      // Fetch episodes
      (async () => {
        const episodesQuery = `
          SELECT * FROM "Episode" 
          WHERE "airDate" >= $1 AND "airDate" <= $2
        `
        return querySchema<any>(orgSlug, episodesQuery, [startDate, endDate])
      })(),
      
      // Fetch advertisers with campaigns
      (async () => {
        const advertisersQuery = `SELECT * FROM "Advertiser"`
        const advertisersRaw = await querySchema<any>(orgSlug, advertisersQuery, [])
        
        // For each advertiser, fetch campaigns in date range
        const advertisers = await Promise.all(advertisersRaw.map(async (advertiser) => {
          const campaignsQuery = `
            SELECT * FROM "Campaign" 
            WHERE "advertiserId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3
          `
          const campaigns = await querySchema<any>(orgSlug, campaignsQuery, [advertiser.id, startDate, endDate])
          return {
            ...advertiser,
            campaigns
          }
        }))
        
        return advertisers
      })(),
      
      // Fetch YouTube audience data
      ytViewsByShow({ orgSlug, orgId: organizationId!, startDate, endDate, showIds }),
      
      // Fetch Megaphone audience data
      megaDownloadsByShow({ orgSlug, orgId: organizationId!, startDate, endDate, showIds }),
      
      // Fetch YouTube geo data
      ytViewsByRegion({ orgSlug, orgId: organizationId!, startDate, endDate, showIds }),
      
      // Fetch Megaphone market data
      megaDownloadsByMarket({ orgSlug, orgId: organizationId!, startDate, endDate, showIds }),
      
      // Calculate content velocity
      calculateContentVelocity({ orgSlug, orgId: organizationId!, startDate, endDate, showIds })
    ])

    // Calculate audience-based insights using real platform data
    const sourceAttribution = {
      youtube: ytViews.length > 0,
      megaphone: megaDownloads.length > 0
    }

    // Build category distribution from actual audience data
    const categoryDistribution = calculateCategoryDistribution(
      shows, 
      ytViews, 
      megaDownloads
    )

    // Build top markets from actual geo data
    const topMarkets = calculateTopMarketsFromPlatforms(
      ytRegions,
      megaMarkets
    )

    // Calculate audience insights
    const insights = {
      // Real audience-based metrics
      categoryDistribution,
      topCategories: categoryDistribution.slice(0, 5),
      topMarkets,
      contentVelocity,
      
      // Keep existing structure for backward compatibility but with real data
      topShows: calculateTopShowsFromAudience(shows, ytViews, megaDownloads),
      
      // Deprecated/unavailable metrics - return empty or zero
      avgListeningDuration: 'No data',
      completionRate: 0,
      episodeDropOffPoints: [],
      topListeningTimes: calculateTopListeningTimes(episodes),
      preferredEpisodeLength: calculatePreferredLength(episodes),
      bingeBehavior: 0,
      listeningDevices: [],
      platformDistribution: [],
      returnListenerRate: 0,
      subscriberGrowth: 0,
      churnRisk: 'Unknown',
      marketGrowth: 0,
      
      // Metadata
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        attribution: sourceAttribution,
        message: !sourceAttribution.youtube && !sourceAttribution.megaphone
          ? 'No audience analytics available. Connect YouTube or Megaphone for real data.'
          : undefined
      }
    }

    console.log('✅ Analytics Audience Insights API: Returning insights')

    // Cache for 15 minutes if data is available
    if (sourceAttribution.youtube || sourceAttribution.megaphone) {
      await cache.set(cacheKey, insights, 900)
    }

    return NextResponse.json(insights)

  } catch (error) {
    console.error('❌ Analytics Audience Insights API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// New helper functions for audience-based calculations
function calculateCategoryDistribution(
  shows: any[],
  ytViews: any[],
  megaDownloads: any[]
): Array<{category: string, views: number, downloads: number, total: number, percent: number}> {
  const categoryMap = new Map<string, {views: number, downloads: number, total: number}>()
  
  // Create show ID to category mapping
  const showCategoryMap = new Map<string, string>()
  shows.forEach(show => {
    const category = show.category || 'Uncategorized'
    showCategoryMap.set(show.id, category)
    if (!categoryMap.has(category)) {
      categoryMap.set(category, {views: 0, downloads: 0, total: 0})
    }
  })
  
  // Aggregate YouTube views by category
  ytViews.forEach(viewData => {
    const category = showCategoryMap.get(viewData.showId) || 'Uncategorized'
    const catData = categoryMap.get(category)!
    catData.views += viewData.views
    catData.total += viewData.views
  })
  
  // Aggregate Megaphone downloads by category
  megaDownloads.forEach(dlData => {
    const category = showCategoryMap.get(dlData.showId) || 'Uncategorized'
    const catData = categoryMap.get(category)!
    catData.downloads += dlData.downloads
    catData.total += dlData.downloads
  })
  
  // Calculate percentages
  const totalAudience = Array.from(categoryMap.values())
    .reduce((sum, cat) => sum + cat.total, 0) || 1
  
  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      views: data.views,
      downloads: data.downloads,
      total: data.total,
      percent: Math.round((data.total / totalAudience) * 100 * 10) / 10
    }))
    .sort((a, b) => b.total - a.total)
}

function calculateTopMarketsFromPlatforms(
  ytRegions: any[],
  megaMarkets: any[]
): Array<{marketCode: string, marketName: string, youtubeViews: number, podcastDownloads: number, total: number, percent: number}> {
  const marketMap = new Map<string, {
    name: string,
    youtubeViews: number,
    podcastDownloads: number,
    total: number
  }>()
  
  // Add YouTube regions
  ytRegions.forEach(region => {
    marketMap.set(region.regionCode, {
      name: region.regionName,
      youtubeViews: region.views,
      podcastDownloads: 0,
      total: region.views
    })
  })
  
  // Add/merge Megaphone markets
  megaMarkets.forEach(market => {
    const existing = marketMap.get(market.marketCode)
    if (existing) {
      existing.podcastDownloads = market.downloads
      existing.total += market.downloads
    } else {
      marketMap.set(market.marketCode, {
        name: market.marketName,
        youtubeViews: 0,
        podcastDownloads: market.downloads,
        total: market.downloads
      })
    }
  })
  
  // Calculate percentages
  const totalAudience = Array.from(marketMap.values())
    .reduce((sum, m) => sum + m.total, 0) || 1
  
  return Array.from(marketMap.entries())
    .map(([code, data]) => ({
      marketCode: code,
      marketName: data.name,
      youtubeViews: data.youtubeViews,
      podcastDownloads: data.podcastDownloads,
      total: data.total,
      percent: Math.round((data.total / totalAudience) * 100 * 10) / 10
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}

function calculateTopShowsFromAudience(
  shows: any[],
  ytViews: any[],
  megaDownloads: any[]
): Array<{show: string, views: number, downloads: number, total: number, growth: number}> {
  const showMap = new Map<string, {
    name: string,
    views: number,
    downloads: number,
    total: number
  }>()
  
  // Initialize shows
  shows.forEach(show => {
    showMap.set(show.id, {
      name: show.name,
      views: 0,
      downloads: 0,
      total: 0
    })
  })
  
  // Add YouTube views
  ytViews.forEach(viewData => {
    const show = showMap.get(viewData.showId)
    if (show) {
      show.views += viewData.views
      show.total += viewData.views
    }
  })
  
  // Add Megaphone downloads
  megaDownloads.forEach(dlData => {
    const show = showMap.get(dlData.showId)
    if (show) {
      show.downloads += dlData.downloads
      show.total += dlData.downloads
    }
  })
  
  return Array.from(showMap.entries())
    .map(([id, data]) => ({
      show: data.name,
      views: data.views,
      downloads: data.downloads,
      total: data.total,
      growth: 0 // Would need historical data to calculate actual growth
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}

// Helper functions for calculating insights
function calculateAvgListeningDuration(episodes: any[]): string {
  // Return "No data" - we don't have real listening duration analytics
  return 'No data'
}

function calculateCompletionRate(episodes: any[]): number {
  // Return 0 - we don't have real completion rate data
  return 0
}

function calculateDropOffPoints(episodes: any[]): Array<{time: string, percentage: number}> {
  // Return empty array - we don't have real drop-off analytics
  return []
}

function calculateTopListeningTimes(episodes: any[]): Array<{hour: string, percentage: number}> {
  if (!episodes || episodes.length === 0) {
    return []
  }
  
  // Calculate based on episode air times as a proxy for listening times
  const timeSlots = new Map<string, number>()
  let validEpisodes = 0
  
  episodes.forEach(episode => {
    // Check if airDate exists and is valid
    if (!episode?.airDate) return
    
    try {
      const airDate = new Date(episode.airDate)
      if (isNaN(airDate.getTime())) return // Skip invalid dates
      
      const hour = airDate.getHours()
      validEpisodes++
      
      let timeSlot = 'Other'
      if (hour >= 6 && hour < 9) timeSlot = '6-9 AM'
      else if (hour >= 12 && hour < 13) timeSlot = '12-1 PM'
      else if (hour >= 17 && hour < 19) timeSlot = '5-7 PM'
      else if (hour >= 20 && hour < 22) timeSlot = '8-10 PM'
      
      timeSlots.set(timeSlot, (timeSlots.get(timeSlot) || 0) + 1)
    } catch (e) {
      // Skip episodes with invalid dates
    }
  })
  
  if (validEpisodes === 0) return []
  
  return Array.from(timeSlots.entries()).map(([hour, count]) => ({
    hour,
    percentage: Math.round((count / validEpisodes) * 100)
  }))
}

function calculatePreferredLength(episodes: any[]): string {
  if (episodes.length === 0) return 'No data'
  
  // Calculate average episode duration if we had that data
  // For now, base on episode count as a rough proxy
  const lengths = ['15-30 min', '30-45 min', '45-60 min', '60+ min']
  const index = Math.min(Math.floor(episodes.length / 20), lengths.length - 1)
  return lengths[index]
}

function calculateBingeBehavior(shows: any[]): number {
  // Return 0 - we don't have real binge listening analytics
  return 0
}

function calculateTopCategories(shows: any[], campaigns: any[]): Array<{category: string, percentage: number, trend: string}> {
  const categoryMap = new Map<string, number>()
  
  // Count shows by category
  shows.forEach(show => {
    const category = show.category || 'General'
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
  })
  
  // Add weight from campaign budgets
  campaigns.forEach(campaign => {
    const category = campaign.advertiser?.industry || 'General'
    const weight = Math.floor((campaign.budget || 0) / 1000)
    categoryMap.set(category, (categoryMap.get(category) || 0) + weight)
  })
  
  // Convert to percentages and add trends
  const total = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0) || 1
  const categories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({
      category,
      percentage: Math.round((count / total) * 100),
      trend: count > 5 ? 'up' : count > 2 ? 'stable' : 'down'
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5)
  
  // Ensure we have at least some data
  if (categories.length === 0) {
    return []
  }
  
  return categories
}

function calculateTopShows(shows: any[], campaigns: any[]): Array<{show: string, listeners: number, growth: number}> {
  if (!shows || shows.length === 0) {
    return []
  }
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  return shows
    .filter(show => show?.isActive)
    .map(show => {
      // Calculate listeners based on episode count and campaign activity
      const episodeCount = show.episodes?.length || 0
      const relatedCampaigns = Array.isArray(campaigns) ? 
        campaigns.filter(c => c?.showId === show.id).length : 0
      const baseListeners = episodeCount * 1000 + relatedCampaigns * 5000
      
      // Calculate growth based on recent episodes vs older episodes
      let recentEpisodes = 0
      if (Array.isArray(show.episodes)) {
        recentEpisodes = show.episodes.filter((ep: any) => {
          if (!ep?.airDate) return false
          try {
            const airDate = new Date(ep.airDate)
            return !isNaN(airDate.getTime()) && airDate > thirtyDaysAgo
          } catch (e) {
            return false
          }
        }).length
      }
      const growth = recentEpisodes > 0 ? Math.min(25, recentEpisodes * 5) : 0
      
      return {
        show: show.name || 'Unknown',
        listeners: baseListeners,
        growth: growth
      }
    })
    .sort((a, b) => b.listeners - a.listeners)
    .slice(0, 5)
}

function calculateContentVelocity(episodes: any[], startDate: Date, endDate: Date): number {
  // Validate dates
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return 0
  }
  
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1
  const episodeCount = Array.isArray(episodes) ? episodes.length : 0
  return Math.round((episodeCount / days) * 7 * 10) / 10 // Episodes per week
}

function calculateTopMarkets(advertisers: any[], campaigns: any[]): Array<{market: string, share: number}> {
  const marketMap = new Map<string, number>()
  
  advertisers.forEach(advertiser => {
    const country = advertiser.country || 'United States'
    const campaignBudget = advertiser.campaigns?.reduce((sum: number, c: any) => sum + (c.budget || 0), 0) || 0
    marketMap.set(country, (marketMap.get(country) || 0) + campaignBudget)
  })
  
  const total = Array.from(marketMap.values()).reduce((sum, val) => sum + val, 0) || 1
  const markets = Array.from(marketMap.entries())
    .map(([market, budget]) => ({
      market,
      share: Math.round((budget / total) * 100)
    }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 5)
  
  if (markets.length === 0) {
    return []
  }
  
  return markets
}

function calculateMarketGrowth(advertisers: any[], startDate: Date): number {
  // Validate startDate
  if (!startDate || isNaN(startDate.getTime())) {
    return 0
  }
  
  // Simulated growth based on advertiser activity
  const recentAdvertisers = advertisers.filter(adv => {
    if (!adv?.createdAt) return false
    try {
      const createdDate = new Date(adv.createdAt)
      return !isNaN(createdDate.getTime()) && createdDate >= startDate
    } catch (e) {
      return false
    }
  }).length
  
  return Math.min(25, 5 + recentAdvertisers * 2)
}

function calculateDeviceBreakdown(episodes: any[]): Array<{device: string, percentage: number}> {
  // Return empty array - we don't have real device analytics
  return []
}

function calculatePlatformDistribution(campaigns: any[]): Array<{platform: string, percentage: number}> {
  // Return empty array - we don't have real platform analytics
  return []
}

function calculateReturnRate(shows: any[]): number {
  // Return 0 - we don't have real return listener analytics
  return 0
}

function calculateSubscriberGrowth(shows: any[], startDate: Date): number {
  // Return 0 - we don't have real subscriber growth analytics
  // Validate startDate just in case it's used in the future
  if (!startDate || isNaN(startDate.getTime())) {
    return 0
  }
  return 0
}

function calculateChurnRisk(shows: any[], episodes: any[]): string {
  // Return 'Unknown' - we don't have real churn analytics
  return 'Unknown'
}