import { NextRequest, NextResponse } from 'next/server'
import { AuthenticatedRequest } from '@/lib/auth/api-protection'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization context
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const url = new URL(request.url)
    const showIds = url.searchParams.get('showIds')
    const sellerIds = url.searchParams.get('sellerIds')
    const stages = url.searchParams.get('stages')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build base query filters
    const where: any = {
      organizationId: user.organizationId,
      status: { in: ['draft', 'active', 'paused'] }, // Exclude completed/archived/lost from pipeline
      // Exclude approved campaigns - they've moved to Orders system
      NOT: { status: { in: ['approved', 'lost'] } }
    }

    // Add seller filter (multiple selection)
    if (sellerIds) {
      const sellerIdArray = sellerIds.split(',').filter(id => id)
      if (sellerIdArray.length > 0) {
        where.createdBy = { in: sellerIdArray }
      }
    }

    // Add probability/stage filter
    if (stages) {
      const stageArray = stages.split(',').filter(s => s).map(Number)
      if (stageArray.length > 0) {
        where.probability = { in: stageArray }
      }
    }

    // Get all campaigns first, then filter by dates in JavaScript
    const campaignsQuery = `
      SELECT * FROM "Campaign"
      WHERE "organizationId" = $1
      AND status IN ('draft', 'active', 'paused')
      AND status NOT IN ('approved', 'lost')
      ${sellerIds ? `AND "createdBy" IN (${sellerIds.split(',').map((_, i) => `$${i + 2}`).join(', ')})` : ''}
      ${stages ? `AND probability IN (${stages.split(',').map((_, i) => `$${(sellerIds ? sellerIds.split(',').length : 0) + i + 2}`).join(', ')})` : ''}
      ORDER BY "createdAt" DESC
    `
    
    const params: any[] = [user.organizationId]
    if (sellerIds) params.push(...sellerIds.split(','))
    if (stages) params.push(...stages.split(',').map(Number))
    
    const { data: campaigns = [], error: campaignsError } = await safeQuerySchema(orgSlug, campaignsQuery, params)
    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    // Apply date filtering in JavaScript
    let filteredCampaigns = campaigns
    
    // Get shows for filter dropdown (moved up to use for show filtering logic)
    const showsQuery = `
      SELECT * FROM "Show"
      WHERE "organizationId" = $1 AND "isActive" = true
      ORDER BY name ASC
    `
    const { data: shows = [], error: showsError } = await safeQuerySchema(orgSlug, showsQuery, [user.organizationId])
    if (showsError) {
      console.error('Error fetching shows:', showsError)
      // Continue without shows rather than failing entirely
    }
    
    // Apply show filtering if showIds are provided
    if (showIds) {
      const showIdArray = showIds.split(',').filter(id => id)
      // Only apply show filtering if not all shows are selected
      // If all shows are selected, treat it as no filter to include campaigns without show assignments
      if (showIdArray.length > 0 && showIdArray.length < shows.length) {
        // Get all AdApprovals for the selected shows
        const placeholders = showIdArray.map((_, index) => `$${index + 1}`).join(', ')
        const adApprovalsQuery = `
          SELECT DISTINCT "campaignId" 
          FROM "AdApproval" 
          WHERE "showId" IN (${placeholders}) 
          AND "organizationId" = $${showIdArray.length + 1}
        `
        const { data: adApprovals = [], error: adApprovalsError } = await safeQuerySchema(orgSlug, adApprovalsQuery, [...showIdArray, user.organizationId])
        if (adApprovalsError) {
          console.error('Error fetching ad approvals:', adApprovalsError)
        }
        const campaignIdsWithShows = new Set(adApprovals.map((a: any) => a.campaignId))
        
        // Filter campaigns to only include those with AdApprovals for the selected shows
        filteredCampaigns = filteredCampaigns.filter(campaign => campaignIdsWithShows.has(campaign.id))
      }
      // If all shows are selected (showIdArray.length === shows.length), don't filter by shows
      // This ensures campaigns without any show assignments are still included
    }
    
    // Apply date filtering
    if (startDate || endDate) {
      filteredCampaigns = filteredCampaigns.filter(campaign => {
        const campaignStart = new Date(campaign.startDate)
        const campaignEnd = new Date(campaign.endDate)
        
        // If both start and end dates are provided, campaign must overlap with the range
        if (startDate && endDate) {
          const filterStart = new Date(startDate)
          const filterEnd = new Date(endDate)
          // Campaign overlaps if: campaign start <= filter end AND campaign end >= filter start
          return campaignStart <= filterEnd && campaignEnd >= filterStart
        }
        
        // If only start date is provided, campaign must end after or on the start date
        if (startDate) {
          const filterStart = new Date(startDate)
          return campaignEnd >= filterStart
        }
        
        // If only end date is provided, campaign must start before or on the end date
        if (endDate) {
          const filterEnd = new Date(endDate)
          return campaignStart <= filterEnd
        }
        
        return true
      })
    }

    // Batch fetch advertisers for campaign names
    const advertiserIds = [...new Set(filteredCampaigns.map(c => c.advertiserId).filter(Boolean))]
    let advertisersMap = new Map()
    
    if (advertiserIds.length > 0) {
      const advertisersQuery = `
        SELECT * FROM "Advertiser"
        WHERE id IN (${advertiserIds.map((_, i) => `$${i + 1}`).join(', ')})
      `
      const { data: advertisers = [], error: advertisersError } = await safeQuerySchema(orgSlug, advertisersQuery, advertiserIds)
      if (advertisersError) {
        console.warn('Could not fetch advertisers:', advertisersError)
      } else {
        advertisersMap = new Map(advertisers.map(a => [a.id, a]))
      }
    }

    // Get users for seller filtering from public schema (users are in public schema)
    const usersQuery = `
      SELECT id, name, email FROM "User" 
      WHERE "organizationId" = $1 AND role IN ('sales', 'admin')
    `
    const { data: users = [], error: usersError } = await safeQuerySchema('public', usersQuery, [user.organizationId])
    if (usersError) {
      console.error('Error fetching users:', usersError)
    }
    const usersMap = new Map(users.map(u => [u.id, u]))

    // Group campaigns by probability and calculate metrics
    const probabilityGroups = {
      10: { label: 'Initial Contact (10%)', campaigns: [], totalValue: 0, weightedValue: 0 },
      35: { label: 'Qualified Lead (35%)', campaigns: [], totalValue: 0, weightedValue: 0 },
      65: { label: 'Proposal Sent (65%)', campaigns: [], totalValue: 0, weightedValue: 0 },
      90: { label: 'Verbal Agreement (90%)', campaigns: [], totalValue: 0, weightedValue: 0 },
      100: { label: 'Signed Contract (100%)', campaigns: [], totalValue: 0, weightedValue: 0 }
    }

    let totalPipelineValue = 0
    let weightedPipelineValue = 0

    filteredCampaigns.forEach(campaign => {
      const probability = campaign.probability !== undefined ? campaign.probability : 10
      const budget = campaign.budget || 0
      const advertiser = advertisersMap.get(campaign.advertiserId)
      const seller = usersMap.get(campaign.createdBy)

      const enhancedCampaign = {
        id: campaign.id,
        name: campaign.name,
        advertiser: advertiser?.name || 'Unknown',
        advertiserName: advertiser?.name || 'Unknown',
        seller: seller?.name || seller?.email || 'Unknown',
        sellerId: campaign.createdBy,
        budget: budget,
        probability: probability,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        status: campaign.status,
        createdAt: campaign.createdAt,
        daysInPipeline: Math.floor((new Date().getTime() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      }

      if (probabilityGroups[probability as keyof typeof probabilityGroups]) {
        probabilityGroups[probability as keyof typeof probabilityGroups].campaigns.push(enhancedCampaign)
        probabilityGroups[probability as keyof typeof probabilityGroups].totalValue += budget
        probabilityGroups[probability as keyof typeof probabilityGroups].weightedValue += budget * (probability / 100)
      }

      totalPipelineValue += budget
      weightedPipelineValue += budget * (probability / 100)
    })

    // Get week boundaries for this week and same week last year
    const now = new Date()
    const startOfWeek = new Date(now)
    const dayOfWeek = now.getDay()
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Monday as start of week
    startOfWeek.setDate(diff)
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
    
    // Same week last year
    const startOfWeekLastYear = new Date(startOfWeek)
    startOfWeekLastYear.setFullYear(startOfWeekLastYear.getFullYear() - 1)
    const endOfWeekLastYear = new Date(endOfWeek)
    endOfWeekLastYear.setFullYear(endOfWeekLastYear.getFullYear() - 1)
    
    // Query approved campaigns (booked) for this week
    const bookedThisWeekQuery = `
      SELECT c.*, o."orderNumber", o."createdAt" as "bookedDate"
      FROM "Campaign" c
      INNER JOIN "Order" o ON o."campaignId" = c.id
      WHERE c."organizationId" = $1
      AND c.status = 'approved'
      AND o."createdAt" >= $2
      AND o."createdAt" <= $3
    `
    const { data: bookedThisWeek = [], error: bookedThisWeekError } = await safeQuerySchema(orgSlug, bookedThisWeekQuery, [
      user.organizationId, 
      startOfWeek.toISOString(), 
      endOfWeek.toISOString()
    ])
    if (bookedThisWeekError) {
      console.error('Error fetching booked this week:', bookedThisWeekError)
    }
    
    // Query approved campaigns (booked) for same week last year
    const bookedLastYearQuery = `
      SELECT c.*, o."orderNumber", o."createdAt" as "bookedDate"
      FROM "Campaign" c
      INNER JOIN "Order" o ON o."campaignId" = c.id
      WHERE c."organizationId" = $1
      AND c.status = 'approved'
      AND o."createdAt" >= $2
      AND o."createdAt" <= $3
    `
    const { data: bookedLastYear = [], error: bookedLastYearError } = await safeQuerySchema(orgSlug, bookedLastYearQuery, [
      user.organizationId, 
      startOfWeekLastYear.toISOString(), 
      endOfWeekLastYear.toISOString()
    ])
    if (bookedLastYearError) {
      console.error('Error fetching booked last year:', bookedLastYearError)
    }
    
    // Calculate totals
    const bookedThisWeekTotal = bookedThisWeek.reduce((sum, c) => sum + (c.budget || 0), 0)
    const bookedLastYearTotal = bookedLastYear.reduce((sum, c) => sum + (c.budget || 0), 0)

    // Get actual revenue for the selected date range
    let actualRevenueQuery = `
      SELECT SUM(c.budget) as total
      FROM "Campaign" c
      INNER JOIN "Order" o ON o."campaignId" = c.id
      WHERE c."organizationId" = $1
      AND c.status = 'approved'
    `
    const revenueParams: any[] = [user.organizationId]
    
    // Apply date filtering for revenue
    if (startDate || endDate) {
      if (startDate && endDate) {
        actualRevenueQuery += ` AND c."startDate" <= $3 AND c."endDate" >= $2`
        revenueParams.push(startDate, endDate)
      } else if (startDate) {
        actualRevenueQuery += ` AND c."endDate" >= $2`
        revenueParams.push(startDate)
      } else if (endDate) {
        actualRevenueQuery += ` AND c."startDate" <= $2`
        revenueParams.push(endDate)
      }
    }
    
    const { data: revenueResult = [{}], error: revenueError } = await safeQuerySchema(orgSlug, actualRevenueQuery, revenueParams)
    if (revenueError) {
      console.error('Error fetching revenue:', revenueError)
    }
    const actualRevenue = revenueResult[0]?.total || 0
    
    // Get last year's revenue for the same period
    const lastYearStart = startDate ? new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() - 1)).toISOString() : null
    const lastYearEnd = endDate ? new Date(new Date(endDate).setFullYear(new Date(endDate).getFullYear() - 1)).toISOString() : null
    
    let lastYearRevenueQuery = actualRevenueQuery.replace(/\$1/g, '$1').replace(/\$2/g, '$2').replace(/\$3/g, '$3')
    const lastYearParams: any[] = [user.organizationId]
    
    if (lastYearStart || lastYearEnd) {
      if (lastYearStart && lastYearEnd) {
        lastYearParams.push(lastYearStart, lastYearEnd)
      } else if (lastYearStart) {
        lastYearParams.push(lastYearStart)
      } else if (lastYearEnd) {
        lastYearParams.push(lastYearEnd)
      }
    }
    
    const { data: lastYearResult = [{}], error: lastYearError } = await safeQuerySchema(orgSlug, lastYearRevenueQuery, lastYearParams)
    if (lastYearError) {
      console.error('Error fetching last year revenue:', lastYearError)
    }
    const lastYearRevenue = lastYearResult[0]?.total || 0
    
    // Calculate YoY pacing
    const revenuePacing = lastYearRevenue > 0 ? Math.round((actualRevenue / lastYearRevenue) * 100) : 0
    
    // Get revenue projections and saved forecasts for forecast/goal calculation
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth() + 1
    const currentYear = currentDate.getFullYear()
    
    // Get revenue projections from shows
    const projectionsQuery = `
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN "releaseFrequency" = 'daily' THEN 30
            WHEN "releaseFrequency" = 'weekly' THEN 4
            WHEN "releaseFrequency" = 'biweekly' THEN 2
            WHEN "releaseFrequency" = 'monthly' THEN 1
            ELSE 4
          END * "estimatedEpisodeValue" * "selloutProjection" / 100
        ), 0) as monthly_projection
      FROM "Show"
      WHERE "organizationId" = $1 
        AND "isActive" = true
        AND "selloutProjection" IS NOT NULL
        AND "estimatedEpisodeValue" IS NOT NULL
    `
    
    const { data: projectionResult = [{}], error: projectionError } = await safeQuerySchema(orgSlug, projectionsQuery, [user.organizationId!])
    if (projectionError) {
      console.error('Error fetching projections:', projectionError)
    }
    const monthlyProjectionValue = Number(projectionResult[0]?.monthly_projection) || 0
    
    // Get saved revenue forecasts from RevenueForecast table
    let forecastTarget = 0
    let budgetTarget = 0
    
    // Determine which year's forecasts to use based on date filter
    const targetYear = startDate ? new Date(startDate).getFullYear() : 
                       endDate ? new Date(endDate).getFullYear() : 
                       currentYear
    
    // Fetch revenue forecasts for the target year
    const forecastsQuery = `
      SELECT month, "forecastAmount"
      FROM "RevenueForecast"
      WHERE "organizationId" = $1 AND year = $2
      ORDER BY month ASC
    `
    
    const { data: forecastsResult = [] } = await safeQuerySchema(orgSlug, forecastsQuery, [user.organizationId!, targetYear])
    const savedForecasts = new Map(forecastsResult.map((f: any) => [f.month, f.forecastAmount]))
    
    // Get budget goals from hierarchical budget with dynamic calculation
    const budgetGoalsQuery = `
      SELECT 
        hb.month,
        SUM(hb."budgetAmount") as "totalBudget"
      FROM "HierarchicalBudget" hb
      WHERE hb.year = $1 
        AND hb."isActive" = true
        AND hb."entityType" IN ('advertiser', 'seller')
        AND (hb."entityType" != 'seller' OR hb.notes ILIKE '%developmental%')
      GROUP BY hb.month
      ORDER BY hb.month ASC
    `
    
    const { data: budgetGoalsResult = [], error: budgetGoalsError } = await safeQuerySchema(orgSlug, budgetGoalsQuery, [targetYear])
    if (budgetGoalsError) {
      console.error('Error fetching budget goals:', budgetGoalsError)
    }
    const budgetGoals = new Map(budgetGoalsResult.map((b: any) => [b.month, b.totalBudget]))
    
    // Calculate forecast and goal based on date range
    if (!startDate && !endDate) {
      // YTD: Sum forecasts/goals for months 1 through current month
      for (let month = 1; month <= currentMonth; month++) {
        // Use saved forecast if available, otherwise use calculated projection
        const monthForecast = Number(savedForecasts.get(month)) || monthlyProjectionValue
        forecastTarget += Number(monthForecast) || 0
        
        // Use budget goal if available
        const monthGoal = Number(budgetGoals.get(month)) || 0
        budgetTarget += Number(monthGoal) || 0
      }
    } else if (startDate && endDate) {
      // Date range: Sum forecasts/goals for months in range
      const start = new Date(startDate)
      const end = new Date(endDate)
      const startMonth = start.getMonth() + 1
      const endMonth = end.getMonth() + 1
      
      // If range spans multiple years, just use projection-based calculation
      if (start.getFullYear() !== end.getFullYear()) {
        const monthsInRange = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)))
        forecastTarget = monthlyProjectionValue * monthsInRange
        // For multi-year ranges, we can't easily get budget data, so default to 0
        budgetTarget = 0
      } else {
        // Same year - sum the months in range
        for (let month = startMonth; month <= endMonth; month++) {
          const monthForecast = Number(savedForecasts.get(month)) || monthlyProjectionValue
          forecastTarget += Number(monthForecast) || 0
          
          const monthGoal = Number(budgetGoals.get(month)) || 0
          budgetTarget += Number(monthGoal) || 0
        }
      }
    } else {
      // Full year: Sum all 12 months
      for (let month = 1; month <= 12; month++) {
        const monthForecast = Number(savedForecasts.get(month)) || monthlyProjectionValue
        forecastTarget += Number(monthForecast) || 0
        
        const monthGoal = Number(budgetGoals.get(month)) || 0
        budgetTarget += Number(monthGoal) || 0
      }
    }
    
    // Ensure all values are numbers to prevent NaN
    forecastTarget = Number(forecastTarget) || 0
    budgetTarget = Number(budgetTarget) || 0
    const actualRevenueNum = Number(actualRevenue) || 0
    const weightedPipelineValueNum = Number(weightedPipelineValue) || 0
    
    const forecastGap = forecastTarget - (actualRevenueNum + weightedPipelineValueNum)
    const budgetGap = budgetTarget - (actualRevenueNum + weightedPipelineValueNum)
    
    // Calculate summary statistics
    const summary = {
      totalCampaigns: filteredCampaigns.length,
      totalPipelineValue,
      weightedPipelineValue,
      averageDealSize: filteredCampaigns.length > 0 ? totalPipelineValue / filteredCampaigns.length : 0,
      conversionRate: filteredCampaigns.filter(c => c.status === 'active').length / Math.max(filteredCampaigns.length, 1) * 100,
      averageCycleTime: filteredCampaigns.length > 0 ? 
        filteredCampaigns.reduce((sum, c) => sum + Math.floor((new Date().getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)), 0) / filteredCampaigns.length : 0,
      bookedThisWeek: bookedThisWeekTotal,
      bookedThisWeekCount: bookedThisWeek.length,
      bookedLastYearSameWeek: bookedLastYearTotal,
      bookedLastYearCount: bookedLastYear.length,
      // New fields for revenue cards
      actualRevenue,
      revenuePacing,
      lastYearRevenue,
      lastYearFinal: lastYearRevenue, // For now, using same value
      forecastTarget,
      forecastGap,
      budgetTarget,
      budgetGap
    }

    // Revenue projections based on pipeline
    const monthlyProjection = {
      optimistic: totalPipelineValue, // Unweighted - full value of all campaigns
      realistic: weightedPipelineValue, // Weighted - campaigns × probability percentage
      conservative: weightedPipelineValue * 0.8 // 80% of weighted value
    }

    console.log(`[Pipeline API] Returning pipeline data: ${filteredCampaigns.length} campaigns (${campaigns.length} total), $${totalPipelineValue.toLocaleString()} total value`)
    console.log(`[Pipeline API] Revenue data: actualRevenue=${actualRevenue}, revenuePacing=${revenuePacing}%, forecast=${Math.round(forecastTarget)}, goal=${Math.round(budgetTarget)}`)

    return NextResponse.json({
      success: true,
      pipeline: {
        groups: probabilityGroups,
        summary,
        projections: monthlyProjection,
        filters: {
          sellers: users.map(u => ({ id: u.id, name: u.name || u.email })),
          shows: shows.map(s => ({ id: s.id, name: s.name }))
        }
      }
    })
  } catch (error) {
    console.error('❌ Pipeline API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipeline data' },
      { status: 500 }
    )
  }
}

// Export handlers
export const GET = async (request: NextRequest) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return getHandler(request as AuthenticatedRequest)
}