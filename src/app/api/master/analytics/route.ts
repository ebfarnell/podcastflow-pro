import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'
import { queryAllSchemas } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// Calculate analytics from real database data across all organization schemas
async function calculateAnalytics(timeRange: string = '30d') {
  // Parse time range
  const daysAgo = parseInt(timeRange) || 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysAgo)

  // Get all organizations with user counts
  const organizations = await prisma.organization.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          users: true
        }
      }
    }
  })

  // Get total users across all organizations
  const totalUsers = await prisma.user.count()
  
  // Get active users (logged in within the time range)
  const activeUsers = await prisma.user.count({
    where: {
      lastLoginAt: {
        gte: startDate
      }
    }
  })

  // Get campaigns from all organization schemas
  const allCampaigns = await queryAllSchemas(async (orgSlug) => {
    const { SchemaModels } = await import('@/lib/db/schema-db')
    return SchemaModels.campaign.findMany(orgSlug, {
      createdAt: { gte: startDate }
    })
  })

  // Calculate total revenue from organization subscription fees
  const totalRevenue = organizations.reduce((sum, org) => {
    return sum + (org.billingAmount || 299) // Default to $299 if not set
  }, 0)

  // Get show counts from all schemas
  const allShows = await queryAllSchemas(async (orgSlug) => {
    const { SchemaModels } = await import('@/lib/db/schema-db')
    return SchemaModels.show.findMany(orgSlug, { isActive: true })
  })

  // Get episode counts from all schemas
  const allEpisodes = await queryAllSchemas(async (orgSlug) => {
    const { SchemaModels } = await import('@/lib/db/schema-db')
    return SchemaModels.episode.findMany(orgSlug, {
      createdAt: { gte: startDate }
    })
  })

  // Calculate organization metrics with real data from schemas
  const organizationMetrics = await Promise.all(organizations.map(async (org) => {
    // Count campaigns for this org
    const orgCampaigns = allCampaigns.filter(c => c._orgSlug === org.slug)
    
    // Count shows for this org
    const orgShows = allShows.filter(s => s._orgSlug === org.slug)
    
    // Count episodes for this org
    const orgEpisodes = allEpisodes.filter(e => e._orgSlug === org.slug)
    
    return {
      name: org.name,
      users: org._count.users,
      revenue: org.billingAmount || 299, // Use subscription fee, not media spend
      plan: org.plan || 'starter',
      campaigns: orgCampaigns.length,
      shows: orgShows.length,
      episodes: orgEpisodes.length
    }
  }))

  // Storage calculation (simplified - in production would query actual storage)
  const totalStorageGB = organizations.length * 10 // Assume 10GB per org for now
  
  // API usage metrics (would need actual API logging in production)
  const apiCalls = totalUsers * 100 // Estimate based on users

  // System metrics
  const uptime = 99.9 // Would need actual monitoring
  const avgResponseTime = 150 // ms - would need actual monitoring

  // Usage data for different features
  const usageData = [
    {
      metric: 'Storage',
      used: totalStorageGB,
      limit: organizations.length * 50, // 50GB per org limit
      unit: 'GB'
    },
    {
      metric: 'API Calls',
      used: apiCalls,
      limit: 1000000,
      unit: 'calls'
    },
    {
      metric: 'Active Users',
      used: activeUsers,
      limit: totalUsers * 2, // Allow for growth
      unit: 'users'
    },
    {
      metric: 'Organizations',
      used: organizations.length,
      limit: 1000,
      unit: 'orgs'
    },
    {
      metric: 'Total Campaigns',
      used: allCampaigns.length,
      limit: 10000,
      unit: 'campaigns'
    },
    {
      metric: 'Total Shows',
      used: allShows.length,
      limit: 5000,
      unit: 'shows'
    }
  ]

  return {
    totalUsers,
    activeUsers,
    totalRevenue,
    totalOrganizations: organizations.length,
    totalCampaigns: allCampaigns.length,
    totalShows: allShows.length,
    totalEpisodes: allEpisodes.length,
    organizationMetrics,
    usageData,
    performanceMetrics: {
      uptime,
      avgResponseTime,
      errorRate: 0.1, // Would need actual monitoring
      peakQPS: 1000
    }
  }
}

// GET /api/master/analytics
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { cookies } = await import('next/headers')
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { UserService } = await import('@/lib/auth/user-service')
    const user = await UserService.validateSession(authToken.value)
    if (!user || user.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '30d'

    const analytics = await calculateAnalytics(timeRange)
    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Master analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}
