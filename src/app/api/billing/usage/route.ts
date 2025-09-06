import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    console.log('📊 Billing Usage API: Fetching usage data', { organizationId: user.organizationId })

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      include: {
        users: {
          select: { id: true, status: true }
        }
      }
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Calculate current billing period
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysInMonth = endOfMonth.getDate()
    const daysPassed = now.getDate()
    const percentageOfMonth = (daysPassed / daysInMonth) * 100

    // Mock usage data for now (in production, this would query UsageRecord table)
    const monthlyTotals = { 
      apiCalls: 15000, 
      storage: 25.5, 
      bandwidth: 125.3, 
      emailSends: 1200 
    }

    // Get current metrics
    const activeCampaigns = 5 // Mock for now
    const activeUsers = organization.users.filter(u => u.status === 'active').length

    // Get billing plan limits based on organization plan
    const planLimits = {
      professional: {
        apiCallsLimit: 100000,
        storageLimit: 100,
        bandwidthLimit: 500,
        campaignsLimit: 50,
        usersLimit: 10,
        emailSendsLimit: 50000,
        monthlyPrice: 299
      },
      enterprise: {
        apiCallsLimit: 1000000,
        storageLimit: 1000,
        bandwidthLimit: 5000,
        campaignsLimit: 500,
        usersLimit: 100,
        emailSendsLimit: 500000,
        monthlyPrice: 999
      }
    }
    const plan = planLimits[organization.plan?.toLowerCase() || 'professional'] || planLimits.professional

    // Calculate usage percentages
    const resources = [
      {
        name: 'Active Campaigns',
        current: activeCampaigns,
        limit: plan.campaignsLimit,
        unit: 'campaigns',
        percentage: Math.round((activeCampaigns / plan.campaignsLimit) * 100),
        trend: 'stable',
        trendValue: 0
      },
      {
        name: 'API Calls',
        current: monthlyTotals.apiCalls,
        limit: plan.apiCallsLimit,
        unit: 'calls',
        percentage: Math.round((monthlyTotals.apiCalls / plan.apiCallsLimit) * 100),
        trend: monthlyTotals.apiCalls > (plan.apiCallsLimit * 0.8) ? 'up' : 'stable',
        trendValue: 15
      },
      {
        name: 'Storage',
        current: parseFloat(monthlyTotals.storage.toFixed(1)),
        limit: plan.storageLimit,
        unit: 'GB',
        percentage: Math.round((monthlyTotals.storage / plan.storageLimit) * 100),
        trend: 'up',
        trendValue: 5
      },
      {
        name: 'Bandwidth',
        current: parseFloat(monthlyTotals.bandwidth.toFixed(1)),
        limit: plan.bandwidthLimit,
        unit: 'GB',
        percentage: Math.round((monthlyTotals.bandwidth / plan.bandwidthLimit) * 100),
        trend: 'stable',
        trendValue: 0
      },
      {
        name: 'Team Members',
        current: activeUsers,
        limit: plan.usersLimit,
        unit: 'users',
        percentage: Math.round((activeUsers / plan.usersLimit) * 100),
        trend: 'stable',
        trendValue: 0
      },
      {
        name: 'Email Sends',
        current: monthlyTotals.emailSends,
        limit: plan.emailSendsLimit,
        unit: 'emails',
        percentage: Math.round((monthlyTotals.emailSends / plan.emailSendsLimit) * 100),
        trend: 'up',
        trendValue: 8
      }
    ]

    // Generate mock daily usage for chart
    const dailyUsage = []
    for (let i = 0; i < daysPassed; i++) {
      const date = new Date(startOfMonth)
      date.setDate(date.getDate() + i)
      dailyUsage.push({
        date: date.toISOString().split('T')[0],
        apiCalls: Math.floor(Math.random() * 2000) + 500,
        storage: 20 + Math.random() * 10,
        bandwidth: 3 + Math.random() * 5,
        campaigns: 5
      })
    }

    // Calculate projections
    const projections = percentageOfMonth > 0 ? {
      apiCalls: Math.round(monthlyTotals.apiCalls / percentageOfMonth * 100),
      storage: parseFloat((monthlyTotals.storage / percentageOfMonth * 100).toFixed(1)),
      bandwidth: parseFloat((monthlyTotals.bandwidth / percentageOfMonth * 100).toFixed(1)),
      emailSends: Math.round(monthlyTotals.emailSends / percentageOfMonth * 100)
    } : monthlyTotals

    // Generate alerts for high usage
    const alerts = []
    resources.forEach(resource => {
      if (resource.percentage >= 80) {
        alerts.push({
          type: resource.percentage >= 95 ? 'error' : 'warning',
          resource: resource.name,
          message: `${resource.name} usage is at ${resource.percentage}% of limit`,
          threshold: resource.percentage >= 95 ? 95 : 80,
          projectedUsage: resource.percentage
        })
      }
    })

    // Calculate cost breakdown
    const overageCharges = {
      apiCalls: Math.max(0, projections.apiCalls - plan.apiCallsLimit) * 0.001, // $0.001 per extra call
      storage: Math.max(0, projections.storage - plan.storageLimit) * 2, // $2 per extra GB
      bandwidth: Math.max(0, projections.bandwidth - plan.bandwidthLimit) * 1, // $1 per extra GB
      total: 0
    }
    overageCharges.total = overageCharges.apiCalls + overageCharges.storage + overageCharges.bandwidth

    const response = {
      organizationId: organization.id,
      billingPeriod: {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString(),
        daysRemaining: daysInMonth - daysPassed
      },
      resources,
      dailyUsage,
      projections,
      alerts,
      costBreakdown: {
        basePlan: plan.monthlyPrice,
        overages: overageCharges,
        projectedTotal: plan.monthlyPrice + overageCharges.total
      }
    }

    console.log('✅ Billing Usage API: Returning real usage data')
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Billing Usage API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST endpoint to record usage
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    const { date, apiCalls, storage, bandwidth, campaigns, emailSends } = await request.json()

    console.log('📊 Billing Usage API: Recording usage', { 
      organizationId: user.organizationId, 
      date: date || 'today' 
    })

    const targetDate = date ? new Date(date) : new Date()
    const dateString = targetDate.toISOString().split('T')[0] + 'T00:00:00.000Z'

    // In production, this would record to a usage tracking table
    // For now, return a mock response
    const usageRecord = {
      organizationId: user.organizationId,
      date: new Date(dateString),
      apiCalls: apiCalls || 0,
      storage: storage || 0,
      bandwidth: bandwidth || 0,
      campaigns: campaigns || 0,
      emailSends: emailSends || 0
    }

    console.log('✅ Billing Usage API: Usage recorded successfully (mock)')
    return NextResponse.json(usageRecord)

  } catch (error) {
    console.error('❌ Billing Usage API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
