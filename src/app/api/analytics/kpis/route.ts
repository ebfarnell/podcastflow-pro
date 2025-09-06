import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

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
        '/api/analytics/kpis',
        request
      )
    }

    const { organizationId, role } = user

    // Get query parameters
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '30d'
    const customStartDate = url.searchParams.get('startDate')
    const customEndDate = url.searchParams.get('endDate')

    console.log('📊 Analytics KPIs API: Fetching KPIs', { timeRange, customStartDate, customEndDate, organizationId })

    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate: Date = now
    
    if (customStartDate && customEndDate) {
      // Use custom date range
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
    } else {
      // Use predefined time range
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
        case 'mtd': // Month to date
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'qtd': // Quarter to date
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

    // Fetch campaigns with analytics data using schema-aware queries
    const campaignsQuery = `
      SELECT 
        c.*,
        a.id as advertiser_id, a.name as advertiser_name, a.email as advertiser_email
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      WHERE c."createdAt" >= $1 AND c."createdAt" <= $2
    `
    const { data: campaignsRaw, error: campaignsError } = await safeQuerySchema<any>(orgSlug, campaignsQuery, [startDate, now])
    if (campaignsError) {
      console.error('Failed to fetch campaigns:', campaignsError)
      // Return default KPIs
      return NextResponse.json({
        totalRevenue: 0,
        revenueGrowth: 0,
        activeCampaigns: 0,
        campaignGrowth: 0,
        totalImpressions: 0,
        impressionGrowth: 0,
        uniqueListeners: 0,
        listenerGrowth: 0,
        averageCTR: 0,
        conversionRate: 0
      })
    }
    
    // Transform campaigns to match expected format
    const campaigns = campaignsRaw.map(c => ({
      ...c,
      advertiser: c.advertiser_id ? {
        id: c.advertiser_id,
        name: c.advertiser_name,
        email: c.advertiser_email
      } : null
    }))

    // Fetch campaign analytics data using schema-aware queries
    const campaignAnalyticsQuery = `
      SELECT 
        ca.*,
        c.id as campaign_id, c.name as campaign_name
      FROM "CampaignAnalytics" ca
      LEFT JOIN "Campaign" c ON c.id = ca."campaignId"
      WHERE ca.date >= $1 AND ca.date <= $2
    `
    const { data: campaignAnalyticsRaw } = await safeQuerySchema<any>(orgSlug, campaignAnalyticsQuery, [startDate, endDate])
    
    // Transform campaign analytics to match expected format
    const campaignAnalytics = campaignAnalyticsRaw.map(ca => ({
      ...ca,
      campaign: ca.campaign_id ? {
        id: ca.campaign_id,
        name: ca.campaign_name
      } : null
    }))

    // Fetch real revenue data from invoices using schema-aware queries
    const invoicesQuery = `
      SELECT 
        i.*,
        json_agg(
          CASE WHEN p.status = 'completed' THEN 
            json_build_object('id', p.id, 'amount', p.amount, 'status', p.status, 'paidAt', p."paidAt")
          END
        ) FILTER (WHERE p.status = 'completed') as completed_payments
      FROM "Invoice" i
      LEFT JOIN "Payment" p ON p."invoiceId" = i.id
      WHERE i."issueDate" >= $1 AND i."issueDate" <= $2
      GROUP BY i.id
    `
    const { data: invoices } = await safeQuerySchema<any>(orgSlug, invoicesQuery, [startDate, endDate])

    // Calculate previous period for comparison
    const periodDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const previousStartDate = new Date(startDate.getTime() - (periodDays * 24 * 60 * 60 * 1000))
    
    // Fetch previous period campaigns using schema-aware queries
    const previousCampaignsQuery = `
      SELECT 
        c.*,
        a.id as advertiser_id, a.name as advertiser_name, a.email as advertiser_email
      FROM "Campaign" c
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      WHERE c."createdAt" >= $1 AND c."createdAt" < $2
    `
    const { data: previousCampaignsRaw } = await safeQuerySchema<any>(orgSlug, previousCampaignsQuery, [previousStartDate, startDate])
    
    // Transform previous campaigns to match expected format
    const previousCampaigns = previousCampaignsRaw.map(c => ({
      ...c,
      advertiser: c.advertiser_id ? {
        id: c.advertiser_id,
        name: c.advertiser_name,
        email: c.advertiser_email
      } : null
    }))

    // Fetch previous period analytics data using schema-aware queries
    const previousCampaignAnalyticsQuery = `
      SELECT 
        ca.*,
        c.id as campaign_id, c.name as campaign_name
      FROM "CampaignAnalytics" ca
      LEFT JOIN "Campaign" c ON c.id = ca."campaignId"
      WHERE ca.date >= $1 AND ca.date < $2
    `
    const { data: previousCampaignAnalyticsRaw } = await safeQuerySchema<any>(orgSlug, previousCampaignAnalyticsQuery, [previousStartDate, startDate])
    
    // Transform previous campaign analytics to match expected format
    const previousCampaignAnalytics = previousCampaignAnalyticsRaw.map(ca => ({
      ...ca,
      campaign: ca.campaign_id ? {
        id: ca.campaign_id,
        name: ca.campaign_name
      } : null
    }))

    // Fetch previous period invoices using schema-aware queries
    const previousInvoicesQuery = `
      SELECT 
        i.*,
        json_agg(
          CASE WHEN p.status = 'completed' THEN 
            json_build_object('id', p.id, 'amount', p.amount, 'status', p.status, 'paidAt', p."paidAt")
          END
        ) FILTER (WHERE p.status = 'completed') as completed_payments
      FROM "Invoice" i
      LEFT JOIN "Payment" p ON p."invoiceId" = i.id
      WHERE i."issueDate" >= $1 AND i."issueDate" < $2
      GROUP BY i.id
    `
    const { data: previousInvoices } = await safeQuerySchema<any>(orgSlug, previousInvoicesQuery, [previousStartDate, startDate])

    // Calculate current period metrics from real data
    let totalImpressions = 0
    let totalClicks = 0
    let totalConversions = 0
    let totalSpend = 0
    
    // Sum up real analytics data from campaign analytics
    campaignAnalytics.forEach(analytics => {
      totalImpressions += analytics.impressions
      totalClicks += analytics.clicks
      totalConversions += analytics.conversions
      totalSpend += analytics.spent
    })
    
    // Calculate real revenue from invoices
    let totalRevenue = 0
    invoices.forEach(invoice => {
      const paidAmount = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
      totalRevenue += paidAmount > 0 ? paidAmount : invoice.totalAmount // Use paid amount or invoice total
    })
    
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length

    // Calculate previous period metrics from real data
    let prevTotalImpressions = 0
    let prevTotalClicks = 0
    let prevTotalConversions = 0
    let prevTotalSpend = 0
    
    previousCampaignAnalytics.forEach(analytics => {
      prevTotalImpressions += analytics.impressions
      prevTotalClicks += analytics.clicks
      prevTotalConversions += analytics.conversions
      prevTotalSpend += analytics.spent
    })
    
    let prevTotalRevenue = 0
    previousInvoices.forEach(invoice => {
      const paidAmount = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
      prevTotalRevenue += paidAmount > 0 ? paidAmount : invoice.totalAmount
    })
    
    const prevActiveCampaigns = previousCampaigns.filter(c => c.status === 'active').length

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return ((current - previous) / previous) * 100
    }

    // Calculate unique listeners from actual impression data
    // For now, estimate 70% unique rate, but this could be enhanced with real tracking
    const uniqueListeners = Math.floor(totalImpressions * 0.7)
    const prevUniqueListeners = Math.floor(prevTotalImpressions * 0.7)

    // Calculate actual CTR and conversion rates from real data
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0

    // Return data in the format expected by the frontend
    const response = {
      totalRevenue,
      revenueGrowth: calculateChange(totalRevenue, prevTotalRevenue),
      activeCampaigns,
      campaignGrowth: calculateChange(activeCampaigns, prevActiveCampaigns),
      totalImpressions,
      impressionGrowth: calculateChange(totalImpressions, prevTotalImpressions),
      uniqueListeners,
      listenerGrowth: calculateChange(uniqueListeners, prevUniqueListeners),
      averageCTR: avgCTR,
      conversionRate
    }

    console.log(`✅ Analytics KPIs API: Returning KPIs`, response)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Analytics KPIs API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}