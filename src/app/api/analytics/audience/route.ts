import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { getOrgPrismaClient } from '@/lib/db/multi-tenant-prisma'
import { accessLogger } from '@/lib/security/access-logger'
import { ytViewsByShow, ytViewsByRegion } from '@/server/youtube-audience'
import { megaDownloadsByShow, megaDownloadsByMarket } from '@/server/megaphone-audience'
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
        '/api/analytics/audience',
        request
      )
    }

    const { organizationId, role } = user

    // Get query parameters
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'category'
    const startDateParam = url.searchParams.get('startDate')
    const endDateParam = url.searchParams.get('endDate')
    const timeRange = url.searchParams.get('timeRange') || '30d'
    const showIdsParam = url.searchParams.get('showIds')
    
    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate: Date = now
    
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam)
      endDate = new Date(endDateParam)
    } else {
      startDate = new Date()
      switch (timeRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7)
          break
        case '30d':
          startDate.setDate(now.getDate() - 30)
          break
        case 'mtd':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'ytd':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
        default:
          startDate.setDate(now.getDate() - 30)
      }
    }
    
    const showIds = showIdsParam ? showIdsParam.split(',') : undefined

    console.log('📊 Analytics Audience API: Fetching audience data', { 
      type, 
      organizationId, 
      startDate, 
      endDate,
      showIds 
    })

    // Check cache first
    const cacheKey = `audience:${organizationId}:${type}:${startDate.toISOString()}:${endDate.toISOString()}:${showIds?.join(',') || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) {
      console.log('✅ Returning cached audience data')
      return NextResponse.json(cached)
    }

    // Get real data based on actual audience consumption
    let audienceData = []
    let sourceAttribution = { youtube: false, megaphone: false }

    switch (type) {
      case 'age':
      case 'gender':
      case 'device':
        // These demographics aren't available from current platform integrations
        audienceData = []
        break
      
      case 'markets':
      case 'location':
        // Fetch real audience geo data from YouTube and Megaphone
        try {
          const [ytRegions, megaMarkets] = await Promise.all([
            ytViewsByRegion({ 
              orgSlug,
              orgId: organizationId!, 
              startDate, 
              endDate, 
              showIds 
            }),
            megaDownloadsByMarket({ 
              orgSlug,
              orgId: organizationId!, 
              startDate, 
              endDate, 
              showIds 
            })
          ])

          // Merge YouTube and Megaphone geo data
          const marketMap = new Map<string, { 
            name: string
            youtubeViews: number
            podcastDownloads: number
            total: number 
          }>()

          // Add YouTube data
          if (ytRegions.length > 0) {
            sourceAttribution.youtube = true
            for (const region of ytRegions) {
              marketMap.set(region.regionCode, {
                name: region.regionName,
                youtubeViews: region.views,
                podcastDownloads: 0,
                total: region.views
              })
            }
          }

          // Add/merge Megaphone data
          if (megaMarkets.length > 0) {
            sourceAttribution.megaphone = true
            for (const market of megaMarkets) {
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
            }
          }

          // Calculate percentages and format response
          const totalAudience = Array.from(marketMap.values())
            .reduce((sum, m) => sum + m.total, 0) || 1
          
          audienceData = Array.from(marketMap.entries())
            .map(([code, data]) => ({
              marketCode: code,
              marketName: data.name,
              youtubeViews: data.youtubeViews,
              podcastDownloads: data.podcastDownloads,
              total: data.total,
              value: Math.round((data.total / totalAudience) * 100),
              percent: Math.round((data.total / totalAudience) * 100)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
        } catch (error) {
          console.error('Error fetching market data:', error)
          audienceData = []
        }
        break
      
      
      case 'category':
        // Fetch real audience data by show category
        try {
          const orgPrisma = getOrgPrismaClient(orgSlug)
          
          // Get shows with their categories
          const shows = await orgPrisma.show.findMany({
            where: showIds ? { id: { in: showIds } } : undefined,
            select: {
              id: true,
              name: true,
              category: true
            }
          })

          if (shows.length === 0) {
            audienceData = []
            break
          }

          // Create show ID to category mapping
          const showCategoryMap = new Map<string, string>()
          shows.forEach(show => {
            showCategoryMap.set(show.id, show.category || 'Uncategorized')
          })

          // Fetch actual audience data from platforms
          const [ytViews, megaDownloads] = await Promise.all([
            ytViewsByShow({ 
              orgSlug,
              orgId: organizationId!, 
              startDate, 
              endDate, 
              showIds 
            }),
            megaDownloadsByShow({ 
              orgSlug,
              orgId: organizationId!, 
              startDate, 
              endDate, 
              showIds 
            })
          ])

          // Aggregate by category
          const categoryMap = new Map<string, {
            views: number
            downloads: number
            total: number
          }>()

          // Initialize categories
          shows.forEach(show => {
            const category = show.category || 'Uncategorized'
            if (!categoryMap.has(category)) {
              categoryMap.set(category, { views: 0, downloads: 0, total: 0 })
            }
          })

          // Add YouTube views by category
          if (ytViews.length > 0) {
            sourceAttribution.youtube = true
            for (const viewData of ytViews) {
              const category = showCategoryMap.get(viewData.showId) || 'Uncategorized'
              const catData = categoryMap.get(category)!
              catData.views += viewData.views
              catData.total += viewData.views
            }
          }

          // Add Megaphone downloads by category
          if (megaDownloads.length > 0) {
            sourceAttribution.megaphone = true
            for (const dlData of megaDownloads) {
              const category = showCategoryMap.get(dlData.showId) || 'Uncategorized'
              const catData = categoryMap.get(category)!
              catData.downloads += dlData.downloads
              catData.total += dlData.downloads
            }
          }

          // Calculate percentages
          const totalAudience = Array.from(categoryMap.values())
            .reduce((sum, cat) => sum + cat.total, 0) || 1

          audienceData = Array.from(categoryMap.entries())
            .map(([category, data]) => ({
              category,
              name: category, // For backward compatibility
              views: data.views,
              downloads: data.downloads,
              total: data.total,
              value: Math.round((data.total / totalAudience) * 100),
              percent: (data.total / totalAudience) * 100
            }))
            .sort((a, b) => b.total - a.total)

          // If no platform data available, return empty
          if (!sourceAttribution.youtube && !sourceAttribution.megaphone) {
            audienceData = []
          }
        } catch (error) {
          console.error('Error fetching category audience data:', error)
          audienceData = []
        }
        break
      
      default:
        audienceData = []
    }

    console.log(`✅ Analytics Audience API: Returning ${audienceData.length} segments`)

    // Prepare response
    const response = {
      data: audienceData,
      sourceAttribution,
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        attribution: sourceAttribution,
        message: !sourceAttribution.youtube && !sourceAttribution.megaphone 
          ? 'No audience analytics available for the selected period.' 
          : undefined
      }
    }

    // Cache the response for 15 minutes
    if (audienceData.length > 0) {
      await cache.set(cacheKey, response, 900) // 15 minutes
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Analytics Audience API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}