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

    // Master accounts don't belong to an organization
    if (user.role === 'master') {
      return NextResponse.json(
        { error: 'Master accounts do not belong to an organization' },
        { status: 404 }
      )
    }

    console.log('🏢 Organization API: Fetching organization data', { organizationId: user.organizationId })

    // Fetch organization from PostgreSQL (no includes as relations are in separate schemas)
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId || '' }
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get organization-specific data (these are in separate schemas, so provide defaults)
    let usersByRole = {}
    let totalUsers = 0
    let activeCampaigns = 0
    let totalCampaigns = 0
    let activeShows = 0
    let totalShows = 0

    try {
      // Try to get user counts from User table
      const users = await prisma.user.findMany({
        where: { organizationId: user.organizationId },
        select: { role: true }
      })
      totalUsers = users.length
      usersByRole = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    } catch (error) {
      console.warn('Could not fetch user counts:', error)
    }

    // Note: Campaign and Show data are in organization schemas, not accessible via public schema
    // Provide reasonable defaults for now

    // Format response - include all actual database fields
    const orgSettings = (organization.settings as any) || {}
    const response = {
      id: organization.id,
      name: organization.name,
      website: organization.website || '',
      industry: organization.industry || 'Media & Entertainment',
      size: orgSettings.size || '50-100',
      taxId: orgSettings.taxId || '',
      phone: organization.phone || '',
      addressLine1: organization.addressLine1 || '',
      city: organization.city || '',
      state: organization.state || '',
      postalCode: organization.postalCode || '',
      country: organization.country || 'United States',
      timezone: organization.timezone || 'America/New_York',
      
      // Legacy nested structure for backward compatibility
      contact: {
        email: organization.billingEmail || 'admin@podcastflow.pro',
        phone: organization.phone || '',
        address: {
          street: organization.addressLine1 || '',
          city: organization.city || '',
          state: organization.state || '',
          zip: organization.postalCode || '',
          country: organization.country || 'United States'
        }
      },
      
      plan: organization.billingPlanId || 'professional',
      status: organization.subscriptionStatus || 'active',
      features: {
        maxUsers: 100,
        maxCampaigns: 500,
        maxShows: 200,
        analytics: true,
        apiAccess: true,
        customBranding: true,
        advancedReporting: true,
        prioritySupport: true
      },
      billing: {
        plan: organization.billingPlanId || 'professional',
        status: organization.subscriptionStatus || 'active',
        billingCycle: 'monthly',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 299
      },
      settings: {
        timezone: organization.timezone || 'America/New_York',
        currency: 'USD',
        language: 'en',
        emailNotifications: true,
        twoFactorRequired: false
      },
      usage: {
        users: {
          total: totalUsers,
          byRole: usersByRole
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns
        },
        shows: {
          total: totalShows,
          active: activeShows
        }
      },
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    }

    console.log('✅ Organization API: Returning organization data')
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Organization API Error:', error)
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
    console.log('🏢 Organization API: Updating organization', { organizationId: user.organizationId, updates })

    // Build update data object
    const updateData: any = {
      updatedAt: new Date()
    }

    // Map updates to database fields
    if (updates.name) updateData.name = updates.name
    if (updates.website) updateData.website = updates.website
    if (updates.industry) updateData.industry = updates.industry
    if (updates.phone) updateData.phone = updates.phone
    if (updates.timezone) updateData.timezone = updates.timezone
    
    // Map address fields
    if (updates.addressLine1) updateData.addressLine1 = updates.addressLine1
    if (updates.city) updateData.city = updates.city
    if (updates.state) updateData.state = updates.state
    if (updates.postalCode) updateData.postalCode = updates.postalCode
    if (updates.country) updateData.country = updates.country
    
    // Store extra fields in settings JSON
    if (updates.size || updates.taxId) {
      const currentOrg = await prisma.organization.findUnique({
        where: { id: user.organizationId || '' },
        select: { settings: true }
      })
      const currentSettings = (currentOrg?.settings as any) || {}
      
      if (updates.size) currentSettings.size = updates.size
      if (updates.taxId) currentSettings.taxId = updates.taxId
      
      updateData.settings = currentSettings
    }
    
    // Support nested structure for backward compatibility
    if (updates.contact) {
      if (updates.contact.phone) updateData.phone = updates.contact.phone
      if (updates.contact.address) {
        if (updates.contact.address.street) updateData.addressLine1 = updates.contact.address.street
        if (updates.contact.address.city) updateData.city = updates.contact.address.city
        if (updates.contact.address.state) updateData.state = updates.contact.address.state
        if (updates.contact.address.zip) updateData.postalCode = updates.contact.address.zip
        if (updates.contact.address.country) updateData.country = updates.contact.address.country
      }
    }

    // Update organization in PostgreSQL
    const updatedOrg = await prisma.organization.update({
      where: { id: user.organizationId || '' },
      data: updateData
    })

    console.log('✅ Organization API: Organization updated successfully')
    return NextResponse.json({
      message: 'Organization updated successfully',
      organization: updatedOrg
    })

  } catch (error) {
    console.error('❌ Organization API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
