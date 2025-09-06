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
        '/api/analytics/revenue',
        request
      )
    }

    const { organizationId, role } = user

    // Get query parameters
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '30d'
    const granularity = url.searchParams.get('granularity') || 'monthly'
    const customStartDate = url.searchParams.get('startDate')
    const customEndDate = url.searchParams.get('endDate')

    console.log('📊 Analytics Revenue API: Fetching revenue data', { timeRange, customStartDate, customEndDate, granularity, organizationId })

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

    // Fetch real revenue data from invoices and payments using schema-aware queries
    const invoicesQuery = `
      SELECT 
        i.*,
        json_agg(
          CASE WHEN p.status = 'completed' THEN 
            json_build_object('id', p.id, 'amount', p.amount, 'status', p.status, 'paidAt', p."paidAt")
          END
        ) FILTER (WHERE p.status = 'completed') as completed_payments,
        json_agg(
          json_build_object('id', ii.id, 'description', ii.description, 'amount', ii.amount, 'quantity', ii.quantity)
        ) as invoice_items
      FROM "Invoice" i
      LEFT JOIN "Payment" p ON p."invoiceId" = i.id
      LEFT JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
      WHERE i."issueDate" >= $1 AND i."issueDate" <= $2
      GROUP BY i.id
    `
    const { data: invoices, error: invoicesError } = await safeQuerySchema<any>(orgSlug, invoicesQuery, [startDate, endDate])
    if (invoicesError) {
      console.error('Failed to fetch invoices:', invoicesError)
      // Return empty revenue data
      return NextResponse.json({
        data: [],
        summary: {
          totalRevenue: 0,
          projectedRevenue: 0,
          actualRevenue: 0,
          pendingRevenue: 0,
          overdue: 0,
          adRevenue: 0,
          sponsorshipRevenue: 0,
          otherRevenue: 0
        },
        bySource: [
          { name: 'Advertising', value: 0 },
          { name: 'Sponsorships', value: 0 },
          { name: 'Other', value: 0 }
        ],
        growth: 0,
        timeRange,
        granularity,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      })
    }

    // Fetch campaigns for additional context using schema-aware queries
    const campaignsQuery = `
      SELECT * FROM "Campaign" 
      WHERE "createdAt" >= $1 AND "createdAt" <= $2
      ORDER BY "createdAt" ASC
    `
    const { data: campaigns } = await safeQuerySchema<any>(orgSlug, campaignsQuery, [startDate, endDate])

    // Generate time series data based on granularity
    const generateTimeSeriesData = (start: Date, end: Date, granularity: string) => {
      const data = []
      const current = new Date(start)
      
      while (current <= end) {
        const label = granularity === 'monthly' 
          ? current.toLocaleString('default', { month: 'short' })
          : current.toISOString().split('T')[0]
        
        // Filter invoices and campaigns for this period
        const periodInvoices = invoices.filter(invoice => {
          const invoiceDate = new Date(invoice.issueDate)
          if (granularity === 'monthly') {
            return invoiceDate.getMonth() === current.getMonth() && 
                   invoiceDate.getFullYear() === current.getFullYear()
          } else if (granularity === 'weekly') {
            const weekStart = new Date(current)
            const weekEnd = new Date(current)
            weekEnd.setDate(weekEnd.getDate() + 7)
            return invoiceDate >= weekStart && invoiceDate < weekEnd
          } else {
            return invoiceDate.toDateString() === current.toDateString()
          }
        })

        const periodCampaigns = campaigns.filter(campaign => {
          const campaignDate = new Date(campaign.createdAt)
          if (granularity === 'monthly') {
            return campaignDate.getMonth() === current.getMonth() && 
                   campaignDate.getFullYear() === current.getFullYear()
          } else if (granularity === 'weekly') {
            const weekStart = new Date(current)
            const weekEnd = new Date(current)
            weekEnd.setDate(weekEnd.getDate() + 7)
            return campaignDate >= weekStart && campaignDate < weekEnd
          } else {
            return campaignDate.toDateString() === current.toDateString()
          }
        })
        
        // Calculate actual revenue from paid invoices
        let revenue = 0
        periodInvoices.forEach(invoice => {
          const completedPayments = invoice.completed_payments || []
          const paidAmount = completedPayments.reduce((sum, payment) => sum + (payment?.amount || 0), 0)
          revenue += paidAmount
        })
        
        // If no payment data available, use invoice totals as booked revenue
        if (revenue === 0) {
          revenue = periodInvoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0)
        }
        
        // Calculate spend from campaign budgets (80% utilization estimate)
        let spend = 0
        periodCampaigns.forEach(campaign => {
          spend += (campaign.budget || 0) * 0.8
        })
        
        // Set target as 90% of revenue (for display purposes)
        const target = Math.round(revenue * 1.1)
        
        data.push({
          month: label,
          revenue,
          target,
          spend,
          profit: revenue - spend,
          campaigns: periodCampaigns.length
        })
        
        // Move to next period
        if (granularity === 'monthly') {
          current.setMonth(current.getMonth() + 1)
        } else if (granularity === 'weekly') {
          current.setDate(current.getDate() + 7)
        } else {
          current.setDate(current.getDate() + 1)
        }
      }
      
      return data
    }

    const revenueData = generateTimeSeriesData(startDate, now, granularity)

    // If no data, generate some placeholder data to show the chart structure
    if (revenueData.length === 0 || revenueData.every(d => d.revenue === 0)) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
      const currentMonth = now.getMonth()
      
      for (let i = 0; i < 6; i++) {
        const monthIndex = (currentMonth - 5 + i + 12) % 12
        revenueData.push({
          month: months[monthIndex] || `Month ${monthIndex + 1}`,
          revenue: 0,
          target: 0,
          spend: 0,
          profit: 0,
          campaigns: 0
        })
      }
    }

    console.log(`✅ Analytics Revenue API: Returning ${revenueData.length} data points`)

    return NextResponse.json({
      data: revenueData
    })

  } catch (error) {
    console.error('❌ Analytics Revenue API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}