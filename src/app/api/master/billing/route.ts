import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { querySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// Helper function to calculate billing data from real invoices
async function calculateBillingDataFromInvoices(timeRange: string, customStartDate?: string, customEndDate?: string) {
  // Calculate time range dates
  const now = new Date()
  let startDate: Date
  let endDate: Date = now

  if (customStartDate && customEndDate) {
    startDate = new Date(customStartDate)
    endDate = new Date(customEndDate)
  } else {
    switch (timeRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'thisWeek':
        const weekStart = now.getDate() - now.getDay()
        startDate = new Date(now.getFullYear(), now.getMonth(), weekStart)
        break
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'thisQuarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3
        startDate = new Date(now.getFullYear(), quarterStart, 1)
        break
      case 'lastQuarter':
        const lastQuarterStart = Math.floor(now.getMonth() / 3) * 3 - 3
        startDate = new Date(now.getFullYear(), lastQuarterStart, 1)
        endDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0)
        break
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1)
        endDate = new Date(now.getFullYear() - 1, 11, 31)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }
  }

  // Get all active organizations
  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true
    },
    select: { id: true, name: true, slug: true, plan: true, billingAmount: true, status: true }
  })

  let allInvoices: any[] = []
  let totalRevenue = 0
  let overdueAmount = 0
  let overdueAccounts = 0
  let paidInvoices = 0

  // Query invoices from all organization schemas
  for (const org of organizations) {
    try {
      if (!org.slug) continue
      
      const schemaName = `org_${org.slug.replace(/-/g, '_')}`
      const schemaDb = querySchema(schemaName)
      
      const invoices = await schemaDb.invoice.findMany({
        where: {
          organizationId: org.id,
          issueDate: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      // Add organization name to each invoice for display
      const invoicesWithOrgName = invoices.map(invoice => ({
        ...invoice,
        organizationName: org.name,
        lastPayment: invoice.paidDate?.toISOString() || null,
        dueDate: invoice.dueDate.toISOString(),
        createdAt: invoice.createdAt.toISOString()
      }))

      allInvoices = allInvoices.concat(invoicesWithOrgName)

      // Calculate metrics
      const orgPaidInvoices = invoices.filter(inv => inv.status === 'paid')
      const orgOverdueInvoices = invoices.filter(inv => inv.status === 'overdue')
      
      totalRevenue += orgPaidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
      overdueAmount += orgOverdueInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
      paidInvoices += orgPaidInvoices.length
      
      if (orgOverdueInvoices.length > 0) {
        overdueAccounts++
      }

    } catch (error) {
      console.warn(`Could not query invoices for organization ${org.name}:`, error)
      // Continue with other organizations
    }
  }

  // Calculate monthly recurring revenue from current active organizations
  const monthlyRecurring = organizations.reduce((sum, org) => {
    return sum + (org.billingAmount || 299) // Default to $299 if not set
  }, 0)

  // Calculate metrics
  const activeOrgs = organizations.filter(org => org.status === 'active').length
  const averageRevenuePerUser = activeOrgs > 0 ? monthlyRecurring / activeOrgs : 0
  const lifetimeValue = averageRevenuePerUser * 24 // 24 months average lifetime
  const churnRate = 0 // Would need historical data to calculate properly

  return {
    timeRange: {
      selected: timeRange,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      label: getTimeRangeLabel(timeRange)
    },
    metrics: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      monthlyRecurring,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      churnRate
    },
    realtimeMetrics: {
      overdueAccounts,
      revenueGrowth: 0, // Would need historical comparison
      subscriptionGrowth: 0, // Would need historical comparison
      averageRevenuePerUser: Math.round(averageRevenuePerUser),
      lifetimeValue: Math.round(lifetimeValue)
    },
    records: allInvoices
  }
}

function getTimeRangeLabel(range: string): string {
  const labels: Record<string, string> = {
    'today': 'Today',
    'yesterday': 'Yesterday',
    'thisWeek': 'This Week',
    'thisMonth': 'This Month',
    'lastMonth': 'Last Month',
    'thisQuarter': 'This Quarter',
    'lastQuarter': 'Last Quarter',
    'thisYear': 'This Year',
    'lastYear': 'Last Year',
    'custom': 'Custom Range'
  }
  return labels[range] || 'This Month'
}

// GET /api/master/billing
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
    if (!user || (user.role !== 'master' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || 'thisMonth'
    const customStartDate = url.searchParams.get('startDate')
    const customEndDate = url.searchParams.get('endDate')

    console.log(`📊 Fetching billing data for time range: ${timeRange}`)
    if (customStartDate && customEndDate) {
      console.log(`📅 Custom date range: ${customStartDate} to ${customEndDate}`)
    }

    const billingData = await calculateBillingDataFromInvoices(timeRange, customStartDate || undefined, customEndDate || undefined)
    return NextResponse.json(billingData)

  } catch (error) {
    console.error('Master billing API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch billing data' },
      { status: 500 }
    )
  }
}
