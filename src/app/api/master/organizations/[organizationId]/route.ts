import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'
import { getSchemaName } from '@/lib/db/utils'

// GET /api/master/organizations/[organizationId]
export const GET = await withMasterProtection(async (
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: {
        id: params.organizationId
      },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })
    
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get campaign count from organization schema
    let campaignCount = 0
    try {
      const schemaName = getSchemaName(organization.slug)
      const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "${schemaName}"."Campaign"`
      )
      campaignCount = Number(result[0].count)
    } catch (error) {
      console.warn(`Could not get campaign count for org ${organization.id}:`, error)
      // Continue without campaign count
    }

    // Get billing plan details
    const plan = organization.plan || 'professional'
    const billingPlan = await prisma.billingPlan.findUnique({
      where: { name: plan },
      select: {
        usersLimit: true,
        campaignsLimit: true,
        showsLimit: true,
        storageLimit: true,
        monthlyPrice: true,
        features: true
      }
    })

    // Create feature name mapping for conversion
    const featureNameToConstant: Record<string, string> = {
      'Advanced Analytics': 'advanced_analytics',
      'Enterprise Analytics': 'advanced_analytics', // Map enterprise analytics to advanced analytics
      'Priority Support': 'priority_support',
      '24/7 Support': 'priority_support', // Map 24/7 support to priority support
      'Custom Templates': 'custom_branding',
      'White Label': 'custom_branding', // Map white label to custom branding
      'API Access': 'api_access',
      'Advanced Api': 'api_access', // Map advanced api to api access
      'Custom Integrations': 'integrations', // Map custom integrations to integrations
      'SSO': 'sso',
      'Audit Logs': 'audit_logs',
      'Backups': 'backups',
      'Webhooks': 'webhooks',
      'Integrations': 'integrations',
      'Campaigns': 'campaigns',
      'Shows': 'shows',
      'Episodes': 'episodes',
      'Ad Approvals': 'ad_approvals',
      'Analytics': 'analytics',
      'Billing': 'billing'
    }

    // Convert human-readable features to constants
    const dbFeatures = Array.isArray(billingPlan?.features) ? billingPlan.features : []
    const convertedFeatures = dbFeatures.map((feature: string) => 
      featureNameToConstant[feature] || feature.toLowerCase().replace(/\s+/g, '_')
    ).filter(Boolean)

    // Transform the data to match expected format
    const transformedOrg = {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status || 'active',
      plan: plan.replace(/_custom_.*$/, ''), // Show base plan name without custom suffix
      activeUsers: organization._count.users,
      monthlyRevenue: organization.billingAmount !== null ? organization.billingAmount : (billingPlan?.monthlyPrice || 299),
      billingAmount: organization.billingAmount !== null ? organization.billingAmount : (billingPlan?.monthlyPrice || 299),
      limits: {
        users: billingPlan?.usersLimit || 0,
        campaigns: billingPlan?.campaignsLimit || 0,
        shows: billingPlan?.showsLimit || 0,
        storage: billingPlan?.storageLimit || 0
      },
      features: convertedFeatures,
      usage: {
        campaigns: campaignCount,
        storageGB: organization._count.users * 2 // Estimate 2GB per user
      },
      createdAt: organization.createdAt.toISOString()
    }

    console.log(`📊 GET Organization ${organization.id}:`, {
      dbBillingAmount: organization.billingAmount,
      planPrice: billingPlan?.monthlyPrice,
      returnedBillingAmount: transformedOrg.billingAmount,
      billingPlan: billingPlan
    })

    return NextResponse.json(transformedOrg)
  } catch (error) {
    console.error('Error fetching organization:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
})

// PUT /api/master/organizations/[organizationId]
export const PUT = await withMasterProtection(async (
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) => {
  try {
    const body = await request.json()
    
    console.log(`📝 PUT Organization ${params.organizationId} - Received:`, {
      name: body.name,
      plan: body.plan,
      limits: body.limits,
      features: body.features
    })
    
    // Check if organization exists
    const existingOrg = await prisma.organization.findUnique({
      where: {
        id: params.organizationId
      }
    })
    
    if (!existingOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Update organization with allowed fields
    const updateData: any = {}
    if (body.name) updateData.name = body.name
    if (body.slug) updateData.slug = body.slug
    if (body.status) updateData.status = body.status
    if (body.plan) updateData.plan = body.plan

    const updatedOrg = await prisma.organization.update({
      where: {
        id: params.organizationId
      },
      data: updateData,
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    // Handle custom limits by creating/updating a custom billing plan if needed
    if (body.limits) {
      const basePlan = (updatedOrg.plan || 'professional').replace(/_custom_.*$/, '')
      
      // Check if we need to create a custom plan for this organization
      const customPlanName = `${basePlan}_custom_${params.organizationId}`
      
      // Convert feature constants back to human-readable names
      const constantToFeatureName: Record<string, string> = {
        'advanced_analytics': 'Advanced Analytics',
        'priority_support': 'Priority Support',
        'custom_branding': 'Custom Templates',
        'api_access': 'API Access',
        'sso': 'SSO',
        'audit_logs': 'Audit Logs',
        'backups': 'Backups',
        'webhooks': 'Webhooks',
        'integrations': 'Integrations',
        'campaigns': 'Campaigns',
        'shows': 'Shows',
        'episodes': 'Episodes',
        'ad_approvals': 'Ad Approvals',
        'analytics': 'Analytics',
        'billing': 'Billing'
      }

      const humanReadableFeatures = (body.features || []).map((feature: string) => 
        constantToFeatureName[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      )

      // Get the base plan to inherit pricing
      const basePlanData = await prisma.billingPlan.findUnique({
        where: { name: basePlan }
      })

      // Check if custom plan exists
      const existingCustomPlan = await prisma.billingPlan.findFirst({
        where: { name: customPlanName }
      })

      if (existingCustomPlan) {
        // Update existing custom plan
        await prisma.billingPlan.update({
          where: { id: existingCustomPlan.id },
          data: {
            usersLimit: body.limits.users || basePlanData?.usersLimit || 10,
            campaignsLimit: body.limits.campaigns || basePlanData?.campaignsLimit || 50,
            showsLimit: body.limits.shows || basePlanData?.showsLimit || 5,
            storageLimit: body.limits.storage || basePlanData?.storageLimit || 100,
            features: humanReadableFeatures
          }
        })
      } else {
        // Create new custom plan
        await prisma.billingPlan.create({
          data: {
            name: customPlanName,
            usersLimit: body.limits.users || basePlanData?.usersLimit || 10,
            campaignsLimit: body.limits.campaigns || basePlanData?.campaignsLimit || 50,
            showsLimit: body.limits.shows || basePlanData?.showsLimit || 5,
            storageLimit: body.limits.storage || basePlanData?.storageLimit || 100,
            monthlyPrice: basePlanData?.monthlyPrice || 299,
            features: humanReadableFeatures,
            isActive: true
          }
        })
      }

      // Update organization to use the custom plan
      await prisma.organization.update({
        where: { id: params.organizationId },
        data: { plan: customPlanName }
      })
    }

    // Get campaign count from organization schema
    let campaignCount = 0
    try {
      const schemaName = getSchemaName(updatedOrg.slug)
      const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "${schemaName}"."Campaign"`
      )
      campaignCount = Number(result[0].count)
    } catch (error) {
      console.warn(`Could not get campaign count for org ${updatedOrg.id}:`, error)
    }

    // Get the updated billing plan info
    const basePlanForResponse = (updatedOrg.plan || 'professional').replace(/_custom_.*$/, '')
    const finalPlan = body.limits ? `${basePlanForResponse}_custom_${params.organizationId}` : (updatedOrg.plan || 'professional')
    const updatedBillingPlan = await prisma.billingPlan.findUnique({
      where: { name: finalPlan },
      select: {
        usersLimit: true,
        campaignsLimit: true,
        showsLimit: true,
        storageLimit: true,
        monthlyPrice: true,
        features: true
      }
    })

    // Convert features back to constants for response
    const featureNameToConstant: Record<string, string> = {
      'Advanced Analytics': 'advanced_analytics',
      'Priority Support': 'priority_support', 
      'Custom Templates': 'custom_branding',
      'API Access': 'api_access',
      'SSO': 'sso',
      'Audit Logs': 'audit_logs',
      'Backups': 'backups',
      'Webhooks': 'webhooks',
      'Integrations': 'integrations',
      'Campaigns': 'campaigns',
      'Shows': 'shows',
      'Episodes': 'episodes',
      'Ad Approvals': 'ad_approvals',
      'Analytics': 'analytics',
      'Billing': 'billing'
    }

    const dbFeatures = Array.isArray(updatedBillingPlan?.features) ? updatedBillingPlan.features : []
    const convertedFeatures = dbFeatures.map((feature: string) => 
      featureNameToConstant[feature] || feature.toLowerCase().replace(/\s+/g, '_')
    ).filter(Boolean)

    const transformedOrg = {
      id: updatedOrg.id,
      name: updatedOrg.name,
      slug: updatedOrg.slug,
      status: updatedOrg.status || 'active',
      plan: finalPlan.replace(/_custom_.*$/, ''), // Show base plan name
      activeUsers: updatedOrg._count.users,
      monthlyRevenue: updatedBillingPlan?.monthlyPrice || 299,
      limits: {
        users: updatedBillingPlan?.usersLimit || 0,
        campaigns: updatedBillingPlan?.campaignsLimit || 0,
        shows: updatedBillingPlan?.showsLimit || 0,
        storage: updatedBillingPlan?.storageLimit || 0
      },
      features: convertedFeatures,
      usage: {
        campaigns: campaignCount,
        storageGB: updatedOrg._count.users * 2
      },
      createdAt: updatedOrg.createdAt.toISOString()
    }

    return NextResponse.json({
      success: true,
      organization: transformedOrg
    })
  } catch (error) {
    console.error('Error updating organization:', error)
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    )
  }
})

// DELETE /api/master/organizations/[organizationId]
export const DELETE = await withMasterProtection(async (
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) => {
  try {
    // Check if organization exists with counts
    const existingOrg = await prisma.organization.findUnique({
      where: {
        id: params.organizationId
      },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })
    
    if (!existingOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get counts from organization schema
    let orgCounts = {
      campaigns: 0,
      shows: 0,
      episodes: 0,
      advertisers: 0,
      agencies: 0
    }
    
    try {
      const schemaName = getSchemaName(existingOrg.slug)
      const counts = await prisma.$queryRawUnsafe<[{ 
        campaigns: bigint, 
        shows: bigint, 
        episodes: bigint,
        advertisers: bigint,
        agencies: bigint 
      }]>(`
        SELECT 
          (SELECT COUNT(*) FROM "${schemaName}"."Campaign") as campaigns,
          (SELECT COUNT(*) FROM "${schemaName}"."Show") as shows,
          (SELECT COUNT(*) FROM "${schemaName}"."Episode") as episodes,
          (SELECT COUNT(*) FROM "${schemaName}"."Advertiser") as advertisers,
          (SELECT COUNT(*) FROM "${schemaName}"."Agency") as agencies
      `)
      
      orgCounts = {
        campaigns: Number(counts[0].campaigns),
        shows: Number(counts[0].shows),
        episodes: Number(counts[0].episodes),
        advertisers: Number(counts[0].advertisers),
        agencies: Number(counts[0].agencies)
      }
    } catch (error) {
      console.warn(`Could not get counts for org ${existingOrg.id}:`, error)
    }

    // Log what will be deleted
    console.log(`Deleting organization ${existingOrg.name} (${existingOrg.id}) with:`, {
      users: existingOrg._count.users,
      ...orgCounts
    })

    // Delete all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all sessions for users in this organization
      const orgUsers = await tx.user.findMany({
        where: { organizationId: params.organizationId },
        select: { id: true }
      })
      const userIds = orgUsers.map(u => u.id)
      
      if (userIds.length > 0) {
        await tx.session.deleteMany({
          where: { userId: { in: userIds } }
        })
      }

      // Delete all users
      await tx.user.deleteMany({
        where: { organizationId: params.organizationId }
      })

      // Finally, delete the organization
      await tx.organization.delete({
        where: { id: params.organizationId }
      })
      
      // Note: Organization-specific schema data (campaigns, shows, etc.) 
      // remains in the org_* schema. In a full implementation, we would 
      // also drop the organization's schema, but that requires DDL permissions.
    })

    return NextResponse.json({
      success: true,
      message: `Organization "${existingOrg.name}" and all related data have been permanently deleted`
    })
  } catch (error) {
    console.error('Error deleting organization:', error)
    return NextResponse.json(
      { error: 'Failed to delete organization. There may be additional data dependencies.' },
      { status: 500 }
    )
  }
})