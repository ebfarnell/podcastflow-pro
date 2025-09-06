import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET endpoint to fetch campaign analytics
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        `/api/campaigns/${params.id}/analytics`,
        request
      )
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    console.log('📊 Campaign Analytics API: Fetching analytics', { 
      campaignId: params.id, 
      days, 
      startDate, 
      endDate 
    })

    // Verify campaign exists and user has access using schema-aware query
    const campaignQuery = `SELECT id, name, budget FROM "Campaign" WHERE id = $1`
    const campaigns = await querySchema<any>(orgSlug, campaignQuery, [params.id])

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    const campaign = campaigns[0]

    // Build date filter
    const now = new Date()
    let dateFilter: any = {}

    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } else {
      // Default to last N days
      const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      dateFilter = {
        gte: pastDate,
        lte: now
      }
    }

    // Get analytics records using schema-aware query
    const analyticsQuery = `
      SELECT * FROM "CampaignAnalytics" 
      WHERE "campaignId" = $1 AND date >= $2 AND date <= $3
      ORDER BY date ASC
    `
    const analytics = await querySchema<any>(orgSlug, analyticsQuery, [
      params.id, 
      dateFilter.gte, 
      dateFilter.lte
    ])

    // Calculate summary totals
    const summary = analytics.reduce((acc, record) => ({
      totalImpressions: acc.totalImpressions + record.impressions,
      totalClicks: acc.totalClicks + record.clicks,
      totalConversions: acc.totalConversions + record.conversions,
      totalSpent: acc.totalSpent + record.spent,
      totalAdPlaybacks: acc.totalAdPlaybacks + record.adPlaybacks,
      averageEngagementRate: acc.averageEngagementRate + record.engagementRate,
      averageCompletionRate: acc.averageCompletionRate + record.completionRate,
      averageSkipRate: acc.averageSkipRate + record.skipRate,
      records: acc.records + 1
    }), {
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalSpent: 0,
      totalAdPlaybacks: 0,
      averageEngagementRate: 0,
      averageCompletionRate: 0,
      averageSkipRate: 0,
      records: 0
    })

    // Calculate average rates
    if (summary.records > 0) {
      summary.averageEngagementRate = summary.averageEngagementRate / summary.records
      summary.averageCompletionRate = summary.averageCompletionRate / summary.records
      summary.averageSkipRate = summary.averageSkipRate / summary.records
    }

    // Calculate overall metrics
    const overallCtr = summary.totalImpressions > 0 ? (summary.totalClicks / summary.totalImpressions) * 100 : 0
    const overallConversionRate = summary.totalClicks > 0 ? (summary.totalConversions / summary.totalClicks) * 100 : 0
    const overallCpc = summary.totalClicks > 0 ? summary.totalSpent / summary.totalClicks : 0
    const overallCpa = summary.totalConversions > 0 ? summary.totalSpent / summary.totalConversions : 0

    const response = {
      campaignId: params.id,
      period: {
        startDate: dateFilter.gte?.toISOString(),
        endDate: dateFilter.lte?.toISOString(),
        days: days
      },
      summary: {
        ...summary,
        ctr: parseFloat(overallCtr.toFixed(2)),
        conversionRate: parseFloat(overallConversionRate.toFixed(2)),
        cpc: parseFloat(overallCpc.toFixed(2)),
        cpa: parseFloat(overallCpa.toFixed(2))
      },
      dailyData: analytics.map(record => ({
        date: record.date.toISOString().split('T')[0],
        impressions: record.impressions,
        clicks: record.clicks,
        conversions: record.conversions,
        spent: record.spent,
        ctr: record.ctr,
        conversionRate: record.conversionRate,
        cpc: record.cpc,
        cpa: record.cpa,
        engagementRate: record.engagementRate,
        completionRate: record.completionRate,
        skipRate: record.skipRate,
        adPlaybacks: record.adPlaybacks,
        averageViewTime: record.averageViewTime
      }))
    }

    console.log('✅ Campaign Analytics API: Returning analytics data', { 
      records: analytics.length,
      totalImpressions: summary.totalImpressions
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Campaign Analytics API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign analytics' },
      { status: 500 }
    )
  }
}

// POST endpoint to record campaign analytics
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        'POST',
        `/api/campaigns/${params.id}/analytics`,
        request
      )
    }

    const body = await request.json()
    const {
      date,
      impressions = 0,
      clicks = 0,
      conversions = 0,
      spent = 0,
      engagementRate = 0,
      averageViewTime = 0,
      adPlaybacks = 0,
      completionRate = 0,
      skipRate = 0
    } = body

    console.log('📊 Campaign Analytics API: Recording analytics', { 
      campaignId: params.id, 
      date: date || 'today',
      impressions,
      clicks,
      conversions
    })

    // Verify campaign exists using schema-aware query
    const campaignQuery = `SELECT id FROM "Campaign" WHERE id = $1`
    const campaigns = await querySchema<any>(orgSlug, campaignQuery, [params.id])

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Calculate metrics
    const targetDate = date ? new Date(date) : new Date()
    const dateString = targetDate.toISOString().split('T')[0] + 'T00:00:00.000Z'
    
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0
    const cpc = clicks > 0 ? spent / clicks : 0
    const cpa = conversions > 0 ? spent / conversions : 0

    // Check if analytics record exists for this date using schema-aware query
    const existingAnalyticsQuery = `
      SELECT * FROM "CampaignAnalytics" 
      WHERE "campaignId" = $1 AND date = $2
    `
    const existingAnalytics = await querySchema<any>(orgSlug, existingAnalyticsQuery, [
      params.id, 
      new Date(dateString)
    ])

    let analyticsRecord
    if (existingAnalytics.length > 0) {
      // Update existing record using schema-aware query
      const updateAnalyticsQuery = `
        UPDATE "CampaignAnalytics" 
        SET 
          impressions = impressions + $3,
          clicks = clicks + $4,
          conversions = conversions + $5,
          spent = spent + $6,
          "adPlaybacks" = "adPlaybacks" + $7,
          "engagementRate" = $8,
          "averageViewTime" = $9,
          "completionRate" = $10,
          "skipRate" = $11,
          ctr = $12,
          "conversionRate" = $13,
          cpc = $14,
          cpa = $15,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "campaignId" = $1 AND date = $2
        RETURNING *
      `
      const updatedRecords = await querySchema<any>(orgSlug, updateAnalyticsQuery, [
        params.id,
        new Date(dateString),
        impressions,
        clicks,
        conversions,
        spent,
        adPlaybacks,
        engagementRate,
        averageViewTime,
        completionRate,
        skipRate,
        ctr,
        conversionRate,
        cpc,
        cpa
      ])
      analyticsRecord = updatedRecords[0]
    } else {
      // Create new record using schema-aware query
      const createAnalyticsQuery = `
        INSERT INTO "CampaignAnalytics" (
          "campaignId", date, impressions, clicks, conversions, spent, "adPlaybacks",
          "engagementRate", "averageViewTime", "completionRate", "skipRate",
          ctr, "conversionRate", cpc, cpa, "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `
      const createdRecords = await querySchema<any>(orgSlug, createAnalyticsQuery, [
        params.id,
        new Date(dateString),
        impressions,
        clicks,
        conversions,
        spent,
        adPlaybacks,
        engagementRate,
        averageViewTime,
        completionRate,
        skipRate,
        parseFloat(ctr.toFixed(2)),
        parseFloat(conversionRate.toFixed(2)),
        parseFloat(cpc.toFixed(2)),
        parseFloat(cpa.toFixed(2))
      ])
      analyticsRecord = createdRecords[0]
    }

    // Calculate campaign totals using schema-aware query
    const totalAnalyticsQuery = `
      SELECT 
        COALESCE(SUM(impressions), 0) as total_impressions,
        COALESCE(SUM(clicks), 0) as total_clicks,
        COALESCE(SUM(conversions), 0) as total_conversions,
        COALESCE(SUM(spent), 0) as total_spent
      FROM "CampaignAnalytics" 
      WHERE "campaignId" = $1
    `
    const totalAnalytics = await querySchema<any>(orgSlug, totalAnalyticsQuery, [params.id])
    const totals = totalAnalytics[0]

    // Update campaign totals using schema-aware query
    const updateCampaignQuery = `
      UPDATE "Campaign" 
      SET 
        impressions = $2,
        clicks = $3,
        conversions = $4,
        spent = $5,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
    `
    await querySchema(orgSlug, updateCampaignQuery, [
      params.id,
      totals.total_impressions,
      totals.total_clicks,
      totals.total_conversions,
      totals.total_spent
    ])

    console.log('✅ Campaign Analytics API: Analytics recorded successfully')
    return NextResponse.json(analyticsRecord, { status: 201 })

  } catch (error) {
    console.error('❌ Campaign Analytics API Error:', error)
    return NextResponse.json(
      { error: 'Failed to record campaign analytics' },
      { status: 500 }
    )
  }
}
