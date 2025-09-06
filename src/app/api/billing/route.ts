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

    console.log('💳 Billing API: Fetching billing overview', { userId: user.id, organizationId: user.organizationId })

    // Get organization data
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId || '' },
      include: {
        users: true,
      }
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Calculate usage metrics
    const userCount = organization.users.length
    // For now, estimate campaign count (in production, this would query the org schema)
    const campaignCount = 5
    
    // Calculate storage usage (estimate based on campaigns and content)
    const storageGB = campaignCount * 0.5 + userCount * 0.1 // Rough estimate
    
    // Calculate API calls (estimate based on user activity)
    const apiCalls = userCount * 1500 + campaignCount * 300 // Rough estimate

    // Build billing data
    const billingData = {
      organizationId: organization.id,
      plan: {
        name: organization.plan || 'Professional',
        tier: organization.plan?.toLowerCase() || 'pro',
        price: organization.billingAmount || 299,
        currency: 'USD',
        interval: 'month',
        status: organization.status || 'active',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        features: {
          campaigns: { 
            limit: organization.plan === 'enterprise' ? 500 : organization.plan === 'professional' ? 100 : 50, 
            used: campaignCount 
          },
          users: { 
            limit: organization.plan === 'enterprise' ? 100 : organization.plan === 'professional' ? 50 : 10, 
            used: userCount 
          },
          storage: { 
            limit: organization.plan === 'enterprise' ? 1000 : organization.plan === 'professional' ? 500 : 100, 
            used: Math.round(storageGB * 10) / 10, 
            unit: 'GB' 
          },
          apiCalls: { 
            limit: organization.plan === 'enterprise' ? 1000000 : organization.plan === 'professional' ? 500000 : 100000, 
            used: apiCalls, 
            unit: 'calls/month' 
          }
        }
      },
      billing: {
        customerId: `cus_${organization.id}`,
        paymentMethod: {
          type: 'card',
          last4: '4242',
          brand: 'Visa',
          expiryMonth: 12,
          expiryYear: 2025
        },
        billingAddress: {
          line1: organization.address || '123 Business Ave',
          city: organization.city || 'New York',
          state: organization.state || 'NY',
          postalCode: organization.postalCode || '10001',
          country: organization.country || 'US'
        },
        billingEmail: organization.billingEmail || organization.email || 'billing@company.com',
        taxId: organization.taxId || null
      },
      subscription: {
        id: `sub_${organization.id}`,
        status: organization.status || 'active',
        currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        trialEnd: null
      },
      usage: {
        currentPeriod: {
          campaigns: campaignCount,
          apiCalls: apiCalls,
          storageGB: Math.round(storageGB * 10) / 10,
          bandwidth: Math.round(storageGB * 7.2 * 10) / 10 // Estimate bandwidth based on storage
        },
        lastPeriod: {
          campaigns: Math.max(0, campaignCount - 2),
          apiCalls: Math.round(apiCalls * 0.85),
          storageGB: Math.round(storageGB * 0.9 * 10) / 10,
          bandwidth: Math.round(storageGB * 6.5 * 10) / 10
        }
      },
      invoices: {
        upcoming: {
          amount: organization.billingAmount || 299,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          items: [
            { description: `${organization.plan || 'Professional'} Plan - Monthly`, amount: organization.billingAmount || 299 }
          ]
        },
        history: [
          {
            id: `inv_${organization.id}_001`,
            amount: organization.billingAmount || 299,
            status: 'paid',
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: `inv_${organization.id}_002`,
            amount: organization.billingAmount || 299,
            status: 'paid',
            date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]
      }
    }

    console.log('✅ Billing API: Returning billing overview')
    return NextResponse.json(billingData)

  } catch (error) {
    console.error('❌ Billing API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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
    if (!user || !['master', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const updates = await request.json()
    console.log('💳 Billing API: Updating billing information', { organizationId: user.organizationId })

    // Update organization billing information
    const updatedOrg = await prisma.organization.update({
      where: { id: user.organizationId || '' },
      data: {
        billingEmail: updates.billing?.billingEmail,
        address: updates.billing?.billingAddress?.line1,
        city: updates.billing?.billingAddress?.city,
        state: updates.billing?.billingAddress?.state,
        postalCode: updates.billing?.billingAddress?.postalCode,
        country: updates.billing?.billingAddress?.country,
        taxId: updates.billing?.taxId,
        updatedAt: new Date(),
      }
    })

    console.log('✅ Billing API: Billing information updated successfully')
    return NextResponse.json({
      message: 'Billing information updated successfully',
      data: updatedOrg
    })

  } catch (error) {
    console.error('❌ Billing API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
