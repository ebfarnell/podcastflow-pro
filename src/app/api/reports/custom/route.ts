import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

interface ReportConfig {
  name: string
  type: 'table' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'dashboard'
  dimensions: string[]
  metrics: string[]
  filters: ReportFilter[]
  dateRange: string
  customStartDate?: string
  customEndDate?: string
}

interface ReportFilter {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between'
  value: string | number
  value2?: string | number
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    
    // Support both old format (config) and new format (direct params)
    const config: any = body.name ? body : {
      name: body.reportName || 'Custom Report',
      type: body.reportType || 'table',
      dimensions: body.selectedDimensions || [],
      metrics: body.selectedMetrics || [],
      filters: body.filters || [],
      dateRange: body.dateRange?.preset || 'custom',
      customStartDate: body.dateRange?.start,
      customEndDate: body.dateRange?.end
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
        '/api/reports/custom',
        request
      )
    }

    // Build the query based on configuration
    const result = await generateCustomReport(config, orgSlug, user)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Custom report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate custom report' },
      { status: 500 }
    )
  }
}

async function generateCustomReport(config: ReportConfig, orgSlug: string, user: any) {
  const { dimensions, metrics, filters, dateRange, customStartDate, customEndDate } = config

  // Calculate date range
  const { startDate, endDate } = getDateRange(dateRange, customStartDate, customEndDate)

  // Determine which tables to query based on dimensions and metrics
  const tables = getRequiredTables(dimensions, metrics)
  
  // Execute queries and aggregate data
  const rawData = await executeQueries(tables, orgSlug, startDate, endDate, user)
  
  // Process and aggregate the data
  const processedData = processReportData(rawData, dimensions, metrics)

  return {
    data: processedData,
    metadata: {
      totalRows: processedData.length,
      dimensions: dimensions.length,
      metrics: metrics.length,
      dateRange: { startDate, endDate },
      generatedAt: new Date().toISOString()
    }
  }
}

function getDateRange(dateRange: string, customStartDate?: string, customEndDate?: string) {
  const now = new Date()
  let startDate: Date
  let endDate: Date = now

  if (dateRange === 'custom' && customStartDate && customEndDate) {
    startDate = new Date(customStartDate)
    endDate = new Date(customEndDate)
  } else {
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'last7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'last30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'last90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
        break
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
  }

  return { startDate, endDate }
}

function getRequiredTables(dimensions: string[], metrics: string[]) {
  const allFields = [...dimensions, ...metrics]
  const tables = new Set<string>()

  // Map fields to their source tables
  const fieldToTable: Record<string, string> = {
    // Campaign fields
    'campaign_name': 'campaign',
    'campaign_status': 'campaign',
    'campaign_description': 'campaign',
    'campaign_probability': 'campaign',
    'prebill_required': 'campaign',
    'client_name': 'campaign',
    'agency_name': 'campaign',
    'industry': 'campaign',
    'target_audience': 'campaign',
    'budget': 'campaign',
    'spent': 'campaign',
    'impressions': 'campaign',
    'target_impressions': 'campaign',
    'clicks': 'campaign',
    'conversions': 'campaign',
    'active_campaigns': 'campaign',
    'total_campaigns': 'campaign',
    'completed_campaigns': 'campaign',
    
    // Show fields
    'show_name': 'show',
    'show_category': 'show',
    'show_host': 'show',
    'show_frequency': 'show',
    'show_release_day': 'show',
    'youtube_channel': 'show',
    'megaphone_id': 'show',
    'show_sellout_projection': 'show',
    'episode_value': 'show',
    
    // Episode fields
    'episode_title': 'episode',
    'episode_number': 'episode',
    'episode_status': 'episode',
    'episode_air_date': 'episode',
    'episode_duration': 'episode',
    'youtube_views': 'episode',
    'youtube_likes': 'episode',
    'youtube_comments': 'episode',
    'megaphone_downloads': 'episode',
    
    // Order fields
    'order_number': 'order',
    'order_status': 'order',
    'io_number': 'order',
    'order_total': 'order',
    'order_discount': 'order',
    'order_net': 'order',
    
    // Invoice fields
    'invoice_number': 'invoice',
    'invoice_status': 'invoice',
    'invoice_type': 'invoice',
    'invoice_amount': 'invoice',
    'invoice_paid': 'invoice',
    
    // Analytics fields
    'ctr': 'analytics',
    'conversion_rate': 'analytics',
    'cpc': 'analytics',
    'cpa': 'analytics',
    'roi': 'analytics',
    'engagement_rate': 'analytics',
    'avg_view_time': 'analytics',
    'bounce_rate': 'analytics',
    'ad_playbacks': 'analytics',
    'completion_rate': 'analytics',
    'skip_rate': 'analytics',
    
    // Seller fields
    'advertiser_seller': 'advertiser',
    'agency_seller': 'agency',
    
    // Time-based fields (from campaign)
    'date': 'campaign',
    'month': 'campaign',
    'quarter': 'campaign',
    'year': 'campaign'
  }

  allFields.forEach(field => {
    const table = fieldToTable[field]
    if (table) {
      tables.add(table)
    }
  })

  return Array.from(tables)
}

async function executeQueries(tables: string[], orgSlug: string, startDate: Date, endDate: Date, user: any) {
  const results: any = {}

  for (const table of tables) {
    switch (table) {
      case 'campaign':
        // Comprehensive campaign query with all joins
        const campaignsQuery = `
          SELECT 
            c.*,
            a.id as advertiser_id, 
            a.name as advertiser_name, 
            a.industry as advertiser_industry,
            a."sellerId" as advertiser_seller_id,
            ag.id as agency_id, 
            ag.name as agency_name,
            ag."sellerId" as agency_seller_id,
            CASE 
              WHEN c."endDate" < CURRENT_DATE THEN 'completed'
              WHEN c."startDate" > CURRENT_DATE THEN 'scheduled'
              WHEN c.status = 'approved' THEN 'active'
              ELSE c.status
            END as computed_status
          FROM "Campaign" c
          LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
          LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
          WHERE c."createdAt" >= $1 AND c."createdAt" <= $2
        `
        const campaignsRaw = await querySchema<any>(orgSlug, campaignsQuery, [startDate, endDate])
        
        // Ensure campaignsRaw is an array
        const campaigns = Array.isArray(campaignsRaw) ? campaignsRaw : []
        
        // Get seller names
        const sellerIds = [...new Set([
          ...campaigns.map(c => c.advertiser_seller_id).filter(Boolean),
          ...campaigns.map(c => c.agency_seller_id).filter(Boolean)
        ])]
        
        const sellers: Record<string, string> = {}
        if (sellerIds.length > 0) {
          const sellersData = await prisma.user.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, name: true }
          })
          sellersData.forEach(s => sellers[s.id] = s.name)
        }
        
        results.campaigns = campaigns.map(campaign => ({
          ...campaign,
          advertiser_seller: campaign.advertiser_seller_id ? sellers[campaign.advertiser_seller_id] || 'Unassigned' : 'Unassigned',
          agency_seller: campaign.agency_seller_id ? sellers[campaign.agency_seller_id] || 'Unassigned' : 'Unassigned'
        }))
        break
        
      case 'show':
        const showsQuery = `
          SELECT 
            s.*,
            s."youtubeChannelName" as youtube_channel_name,
            s."megaphonePodcastId" as megaphone_podcast_id,
            s."releaseFrequency" as release_frequency,
            s."releaseDay" as release_day,
            s."selloutProjection" as sellout_projection,
            s."estimatedEpisodeValue" as episode_value
          FROM "Show" s
          WHERE s."createdAt" >= $1 AND s."createdAt" <= $2
        `
        const showsResult = await querySchema<any>(orgSlug, showsQuery, [startDate, endDate])
        results.shows = Array.isArray(showsResult) ? showsResult : []
        break
        
      case 'episode':
        const episodesQuery = `
          SELECT 
            e.*,
            e."youtubeViewCount" as youtube_views,
            e."youtubeLikeCount" as youtube_likes,
            e."youtubeCommentCount" as youtube_comments,
            e."megaphoneDownloads" as megaphone_downloads,
            e."durationSeconds" as duration_seconds,
            s.name as show_name,
            s.category as show_category
          FROM "Episode" e
          LEFT JOIN "Show" s ON s.id = e."showId"
          WHERE e."createdAt" >= $1 AND e."createdAt" <= $2
        `
        const episodesResult = await querySchema<any>(orgSlug, episodesQuery, [startDate, endDate])
        results.episodes = Array.isArray(episodesResult) ? episodesResult : []
        break
        
      case 'order':
        const ordersQuery = `
          SELECT 
            o.*,
            o."orderNumber" as order_number,
            o."totalAmount" as total_amount,
            o."discountAmount" as discount_amount,
            o."netAmount" as net_amount,
            o."ioNumber" as io_number,
            c.name as campaign_name
          FROM "Order" o
          LEFT JOIN "Campaign" c ON c.id = o."campaignId"
          WHERE o."createdAt" >= $1 AND o."createdAt" <= $2
        `
        const ordersResult = await querySchema<any>(orgSlug, ordersQuery, [startDate, endDate])
        results.orders = Array.isArray(ordersResult) ? ordersResult : []
        break
        
      case 'invoice':
        const invoicesQuery = `
          SELECT 
            i.*,
            i."invoiceNumber" as invoice_number,
            i."totalAmount" as total_amount,
            CASE 
              WHEN i.status = 'paid' THEN i."totalAmount"
              ELSE 0
            END as paid_amount
          FROM "Invoice" i
          WHERE i."createdAt" >= $1 AND i."createdAt" <= $2
        `
        const invoicesResult = await querySchema<any>(orgSlug, invoicesQuery, [startDate, endDate])
        results.invoices = Array.isArray(invoicesResult) ? invoicesResult : []
        break
        
      case 'analytics':
        // Get campaign analytics data
        const analyticsQuery = `
          SELECT 
            ca.*,
            ca."campaignId" as campaign_id,
            ca."engagementRate" as engagement_rate,
            ca."averageViewTime" as avg_view_time,
            ca."bounceRate" as bounce_rate,
            ca."adPlaybacks" as ad_playbacks,
            ca."completionRate" as completion_rate,
            ca."skipRate" as skip_rate,
            ca."conversionRate" as conversion_rate,
            c.name as campaign_name
          FROM "CampaignAnalytics" ca
          LEFT JOIN "Campaign" c ON c.id = ca."campaignId"
          WHERE ca.date >= $1 AND ca.date <= $2
        `
        const analyticsResult = await querySchema<any>(orgSlug, analyticsQuery, [startDate, endDate])
        results.analytics = Array.isArray(analyticsResult) ? analyticsResult : []
        break
        
      case 'advertiser':
        // Already fetched with campaigns
        break
        
      case 'agency':
        // Already fetched with campaigns
        break
    }
  }

  return results
}

function processReportData(rawData: any, dimensions: string[], metrics: string[]) {
  const { 
    campaigns = [], 
    shows = [], 
    episodes = [], 
    orders = [], 
    invoices = [], 
    analytics = [] 
  } = rawData
  
  // Create a unified dataset
  const processedRows: any[] = []

  // Determine primary table based on selected fields
  let primaryData = campaigns
  if (dimensions.some(d => d.startsWith('episode_')) || metrics.some(m => m.startsWith('episode_') || m.startsWith('youtube_') || m.startsWith('megaphone_'))) {
    primaryData = episodes
  } else if (dimensions.some(d => d.startsWith('order_')) || metrics.some(m => m.startsWith('order_'))) {
    primaryData = orders
  } else if (dimensions.some(d => d.startsWith('invoice_')) || metrics.some(m => m.startsWith('invoice_'))) {
    primaryData = invoices
  } else if (dimensions.some(d => d.startsWith('show_')) && !dimensions.some(d => d.startsWith('campaign_'))) {
    primaryData = shows
  }

  // Process based on primary data source
  if (primaryData === campaigns) {
    campaigns.forEach((campaign: any) => {
      const row = extractCampaignRow(campaign, dimensions, metrics, analytics, orders, invoices)
      if (row) processedRows.push(row)
    })
  } else if (primaryData === episodes) {
    episodes.forEach((episode: any) => {
      const row = extractEpisodeRow(episode, dimensions, metrics)
      if (row) processedRows.push(row)
    })
  } else if (primaryData === orders) {
    orders.forEach((order: any) => {
      const row = extractOrderRow(order, dimensions, metrics)
      if (row) processedRows.push(row)
    })
  } else if (primaryData === invoices) {
    invoices.forEach((invoice: any) => {
      const row = extractInvoiceRow(invoice, dimensions, metrics)
      if (row) processedRows.push(row)
    })
  } else if (primaryData === shows) {
    shows.forEach((show: any) => {
      const row = extractShowRow(show, dimensions, metrics)
      if (row) processedRows.push(row)
    })
  }

  // Handle campaign count metrics specially
  if (metrics.includes('active_campaigns') || metrics.includes('total_campaigns') || metrics.includes('completed_campaigns')) {
    const counts = calculateCampaignCounts(campaigns)
    processedRows.forEach(row => {
      if (metrics.includes('active_campaigns')) row.active_campaigns = counts.active
      if (metrics.includes('total_campaigns')) row.total_campaigns = counts.total
      if (metrics.includes('completed_campaigns')) row.completed_campaigns = counts.completed
    })
    
    // If only count metrics and no rows, create a summary row
    if (processedRows.length === 0 && metrics.some(m => ['active_campaigns', 'total_campaigns', 'completed_campaigns'].includes(m))) {
      const summaryRow: any = {}
      dimensions.forEach(d => summaryRow[d] = 'All')
      if (metrics.includes('active_campaigns')) summaryRow.active_campaigns = counts.active
      if (metrics.includes('total_campaigns')) summaryRow.total_campaigns = counts.total
      if (metrics.includes('completed_campaigns')) summaryRow.completed_campaigns = counts.completed
      processedRows.push(summaryRow)
    }
  }

  // Group and aggregate data if needed
  if (dimensions.length > 0 && processedRows.length > 0) {
    return aggregateByDimensions(processedRows, dimensions, metrics)
  }

  return processedRows
}

function extractCampaignRow(campaign: any, dimensions: string[], metrics: string[], analytics: any[], orders: any[], invoices: any[]) {
  const row: any = {}
  
  // Get related analytics data
  const campaignAnalytics = analytics.filter(a => a.campaign_id === campaign.id)
  const latestAnalytics = campaignAnalytics[campaignAnalytics.length - 1] || {}
  
  // Get related orders and invoices
  const campaignOrders = orders.filter(o => o.campaignId === campaign.id)
  const campaignInvoices = invoices.filter(i => i.campaignId === campaign.id)

  // Add dimension values
  dimensions.forEach(dim => {
    switch (dim) {
      case 'campaign_name':
        row[dim] = campaign.name || ''
        break
      case 'campaign_status':
        row[dim] = campaign.computed_status || campaign.status || ''
        break
      case 'campaign_description':
        row[dim] = campaign.description || ''
        break
      case 'campaign_probability':
        row[dim] = campaign.probability ? `${campaign.probability}%` : '10%'
        break
      case 'prebill_required':
        row[dim] = campaign.preBillRequired ? 'Yes' : 'No'
        break
      case 'client_name':
        row[dim] = campaign.advertiser_name || 'Unknown'
        break
      case 'agency_name':
        row[dim] = campaign.agency_name || 'Direct'
        break
      case 'industry':
        row[dim] = campaign.advertiser_industry || campaign.industry || 'Other'
        break
      case 'target_audience':
        row[dim] = campaign.targetAudience || 'General'
        break
      case 'advertiser_seller':
        row[dim] = campaign.advertiser_seller || 'Unassigned'
        break
      case 'agency_seller':
        row[dim] = campaign.agency_seller || 'Unassigned'
        break
      case 'date':
        row[dim] = campaign.createdAt ? new Date(campaign.createdAt).toISOString().split('T')[0] : ''
        break
      case 'month':
        row[dim] = campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : ''
        break
      case 'quarter':
        if (campaign.createdAt) {
          const date = new Date(campaign.createdAt)
          const quarter = Math.floor(date.getMonth() / 3) + 1
          row[dim] = `Q${quarter} ${date.getFullYear()}`
        } else {
          row[dim] = ''
        }
        break
      case 'year':
        row[dim] = campaign.createdAt ? new Date(campaign.createdAt).getFullYear().toString() : ''
        break
    }
  })

  // Add metric values
  metrics.forEach(metric => {
    switch (metric) {
      case 'budget':
        row[metric] = campaign.budget || 0
        break
      case 'spent':
        row[metric] = campaign.spent || 0
        break
      case 'impressions':
        row[metric] = campaign.impressions || 0
        break
      case 'target_impressions':
        row[metric] = campaign.targetImpressions || 0
        break
      case 'clicks':
        row[metric] = campaign.clicks || 0
        break
      case 'conversions':
        row[metric] = campaign.conversions || 0
        break
      case 'ctr':
        row[metric] = latestAnalytics.ctr || (campaign.impressions > 0 ? ((campaign.clicks || 0) / campaign.impressions * 100) : 0)
        break
      case 'conversion_rate':
        row[metric] = latestAnalytics.conversion_rate || latestAnalytics.conversionRate || (campaign.clicks > 0 ? ((campaign.conversions || 0) / campaign.clicks * 100) : 0)
        break
      case 'cpc':
        row[metric] = latestAnalytics.cpc || (campaign.clicks > 0 ? ((campaign.spent || 0) / campaign.clicks) : 0)
        break
      case 'cpa':
        row[metric] = latestAnalytics.cpa || (campaign.conversions > 0 ? ((campaign.spent || 0) / campaign.conversions) : 0)
        break
      case 'roi':
        row[metric] = campaign.spent > 0 ? (((campaign.budget || 0) - campaign.spent) / campaign.spent * 100) : 0
        break
      case 'engagement_rate':
        row[metric] = latestAnalytics.engagement_rate || latestAnalytics.engagementRate || 0
        break
      case 'avg_view_time':
        row[metric] = latestAnalytics.avg_view_time || latestAnalytics.averageViewTime || 0
        break
      case 'bounce_rate':
        row[metric] = latestAnalytics.bounce_rate || latestAnalytics.bounceRate || 0
        break
      case 'ad_playbacks':
        row[metric] = latestAnalytics.ad_playbacks || latestAnalytics.adPlaybacks || 0
        break
      case 'completion_rate':
        row[metric] = latestAnalytics.completion_rate || latestAnalytics.completionRate || 0
        break
      case 'skip_rate':
        row[metric] = latestAnalytics.skip_rate || latestAnalytics.skipRate || 0
        break
      case 'order_total':
        row[metric] = campaignOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
        break
      case 'order_discount':
        row[metric] = campaignOrders.reduce((sum, o) => sum + (o.discount_amount || 0), 0)
        break
      case 'order_net':
        row[metric] = campaignOrders.reduce((sum, o) => sum + (o.net_amount || 0), 0)
        break
      case 'invoice_amount':
        row[metric] = campaignInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0)
        break
      case 'invoice_paid':
        row[metric] = campaignInvoices.reduce((sum, i) => sum + (i.paid_amount || 0), 0)
        break
    }
  })

  return row
}

function extractEpisodeRow(episode: any, dimensions: string[], metrics: string[]) {
  const row: any = {}

  // Add dimension values
  dimensions.forEach(dim => {
    switch (dim) {
      case 'episode_title':
        row[dim] = episode.title || ''
        break
      case 'episode_number':
        row[dim] = episode.episodeNumber || 0
        break
      case 'episode_status':
        row[dim] = episode.status || ''
        break
      case 'episode_air_date':
        row[dim] = episode.airDate ? new Date(episode.airDate).toISOString().split('T')[0] : ''
        break
      case 'show_name':
        row[dim] = episode.show_name || ''
        break
      case 'show_category':
        row[dim] = episode.show_category || ''
        break
      case 'date':
        row[dim] = episode.createdAt ? new Date(episode.createdAt).toISOString().split('T')[0] : ''
        break
      case 'month':
        row[dim] = episode.createdAt ? new Date(episode.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : ''
        break
      case 'quarter':
        if (episode.createdAt) {
          const date = new Date(episode.createdAt)
          const quarter = Math.floor(date.getMonth() / 3) + 1
          row[dim] = `Q${quarter} ${date.getFullYear()}`
        } else {
          row[dim] = ''
        }
        break
      case 'year':
        row[dim] = episode.createdAt ? new Date(episode.createdAt).getFullYear().toString() : ''
        break
    }
  })

  // Add metric values
  metrics.forEach(metric => {
    switch (metric) {
      case 'episode_duration':
        row[metric] = episode.duration_seconds ? Math.round(episode.duration_seconds / 60) : 0
        break
      case 'youtube_views':
        row[metric] = episode.youtube_views || 0
        break
      case 'youtube_likes':
        row[metric] = episode.youtube_likes || 0
        break
      case 'youtube_comments':
        row[metric] = episode.youtube_comments || 0
        break
      case 'megaphone_downloads':
        row[metric] = episode.megaphone_downloads || 0
        break
    }
  })

  return row
}

function extractOrderRow(order: any, dimensions: string[], metrics: string[]) {
  const row: any = {}

  // Add dimension values
  dimensions.forEach(dim => {
    switch (dim) {
      case 'order_number':
        row[dim] = order.order_number || ''
        break
      case 'order_status':
        row[dim] = order.status || ''
        break
      case 'io_number':
        row[dim] = order.io_number || ''
        break
      case 'campaign_name':
        row[dim] = order.campaign_name || ''
        break
      case 'date':
        row[dim] = order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : ''
        break
      case 'month':
        row[dim] = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : ''
        break
      case 'quarter':
        if (order.createdAt) {
          const date = new Date(order.createdAt)
          const quarter = Math.floor(date.getMonth() / 3) + 1
          row[dim] = `Q${quarter} ${date.getFullYear()}`
        } else {
          row[dim] = ''
        }
        break
      case 'year':
        row[dim] = order.createdAt ? new Date(order.createdAt).getFullYear().toString() : ''
        break
    }
  })

  // Add metric values
  metrics.forEach(metric => {
    switch (metric) {
      case 'order_total':
        row[metric] = order.total_amount || 0
        break
      case 'order_discount':
        row[metric] = order.discount_amount || 0
        break
      case 'order_net':
        row[metric] = order.net_amount || 0
        break
    }
  })

  return row
}

function extractInvoiceRow(invoice: any, dimensions: string[], metrics: string[]) {
  const row: any = {}

  // Add dimension values
  dimensions.forEach(dim => {
    switch (dim) {
      case 'invoice_number':
        row[dim] = invoice.invoice_number || ''
        break
      case 'invoice_status':
        row[dim] = invoice.status || ''
        break
      case 'invoice_type':
        row[dim] = invoice.type || 'incoming'
        break
      case 'date':
        row[dim] = invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : ''
        break
      case 'month':
        row[dim] = invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : ''
        break
      case 'quarter':
        if (invoice.createdAt) {
          const date = new Date(invoice.createdAt)
          const quarter = Math.floor(date.getMonth() / 3) + 1
          row[dim] = `Q${quarter} ${date.getFullYear()}`
        } else {
          row[dim] = ''
        }
        break
      case 'year':
        row[dim] = invoice.createdAt ? new Date(invoice.createdAt).getFullYear().toString() : ''
        break
    }
  })

  // Add metric values
  metrics.forEach(metric => {
    switch (metric) {
      case 'invoice_amount':
        row[metric] = invoice.total_amount || 0
        break
      case 'invoice_paid':
        row[metric] = invoice.paid_amount || 0
        break
    }
  })

  return row
}

function extractShowRow(show: any, dimensions: string[], metrics: string[]) {
  const row: any = {}

  // Add dimension values
  dimensions.forEach(dim => {
    switch (dim) {
      case 'show_name':
        row[dim] = show.name || ''
        break
      case 'show_category':
        row[dim] = show.category || ''
        break
      case 'show_host':
        row[dim] = show.host || ''
        break
      case 'show_frequency':
        row[dim] = show.release_frequency || show.releaseFrequency || ''
        break
      case 'show_release_day':
        row[dim] = show.release_day || show.releaseDay || ''
        break
      case 'youtube_channel':
        row[dim] = show.youtube_channel_name || show.youtubeChannelName || ''
        break
      case 'megaphone_id':
        row[dim] = show.megaphone_podcast_id || show.megaphonePodcastId || ''
        break
      case 'date':
        row[dim] = show.createdAt ? new Date(show.createdAt).toISOString().split('T')[0] : ''
        break
      case 'month':
        row[dim] = show.createdAt ? new Date(show.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : ''
        break
      case 'quarter':
        if (show.createdAt) {
          const date = new Date(show.createdAt)
          const quarter = Math.floor(date.getMonth() / 3) + 1
          row[dim] = `Q${quarter} ${date.getFullYear()}`
        } else {
          row[dim] = ''
        }
        break
      case 'year':
        row[dim] = show.createdAt ? new Date(show.createdAt).getFullYear().toString() : ''
        break
    }
  })

  // Add metric values
  metrics.forEach(metric => {
    switch (metric) {
      case 'show_sellout_projection':
        row[metric] = show.sellout_projection || show.selloutProjection || 0
        break
      case 'episode_value':
        row[metric] = show.episode_value || show.estimatedEpisodeValue || 0
        break
    }
  })

  return row
}

function calculateCampaignCounts(campaigns: any[]) {
  const now = new Date()
  let active = 0
  let completed = 0
  
  campaigns.forEach(campaign => {
    if (campaign.computed_status === 'active') {
      active++
    } else if (campaign.computed_status === 'completed') {
      completed++
    }
  })
  
  return {
    active,
    completed,
    total: campaigns.length
  }
}

function aggregateByDimensions(data: any[], dimensions: string[], metrics: string[]) {
  const grouped = data.reduce((acc, row) => {
    const key = dimensions.map(dim => row[dim] || 'Unknown').join('|')
    
    if (!acc[key]) {
      acc[key] = { ...row }
      // Initialize metric sums and counts
      metrics.forEach(metric => {
        if (typeof row[metric] === 'number') {
          acc[key][`${metric}_sum`] = row[metric]
          acc[key][`${metric}_count`] = 1
        }
      })
    } else {
      // Aggregate metrics
      metrics.forEach(metric => {
        if (typeof row[metric] === 'number') {
          // For percentage metrics, calculate weighted average
          if (metric.includes('rate') || metric.includes('ctr') || metric.includes('conversion') || metric.includes('roi')) {
            const currentSum = acc[key][`${metric}_sum`] || 0
            const currentCount = acc[key][`${metric}_count`] || 0
            acc[key][`${metric}_sum`] = currentSum + row[metric]
            acc[key][`${metric}_count`] = currentCount + 1
            acc[key][metric] = acc[key][`${metric}_sum`] / acc[key][`${metric}_count`]
          } else {
            // Sum for counts and amounts
            acc[key][metric] = (acc[key][metric] || 0) + row[metric]
          }
        }
      })
    }
    
    return acc
  }, {} as Record<string, any>)

  // Clean up temporary fields and return as array
  return Object.values(grouped).map(row => {
    const cleaned = { ...row }
    Object.keys(cleaned).forEach(key => {
      if (key.endsWith('_sum') || key.endsWith('_count')) {
        delete cleaned[key]
      }
    })
    return cleaned
  })
}