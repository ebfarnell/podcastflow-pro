import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { emailService } from '@/lib/email/email-service'
import { AuthenticatedRequest } from '@/lib/auth/api-protection'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// GET /api/master/organizations
export const GET = await withMasterProtection(async (request: NextRequest) => {
  try {
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all'
    const tier = searchParams.get('tier') || 'all'
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (status !== 'all') {
      where.status = status
    }
    
    if (tier !== 'all') {
      where.plan = tier.toLowerCase()
    }

    // Get organizations with user counts
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.organization.count({ where })
    ])

    // Get billing plan details for all organizations
    const billingPlans = await prisma.billingPlan.findMany({
      select: {
        name: true,
        usersLimit: true,
        campaignsLimit: true,
        showsLimit: true,
        storageLimit: true,
        monthlyPrice: true,
        features: true
      }
    })

    // Create a map for easy lookup
    const planMap = billingPlans.reduce((acc, plan) => {
      acc[plan.name] = plan
      return acc
    }, {} as Record<string, any>)

    // Transform organizations with real plan data
    const transformedOrgs = organizations.map(org => {
      const rawPlan = org.plan || 'professional'
      const basePlan = rawPlan.replace(/_custom_.*$/, '') // Remove custom suffix for display
      const billingPlan = planMap[rawPlan] || planMap[basePlan] // Try both custom and base plan
      
      // Use billingAmount from organization or fall back to plan price
      const monthlyRevenue = org.billingAmount !== null ? org.billingAmount : (billingPlan?.monthlyPrice || 299)
      
      return {
        id: org.id,
        name: org.name,
        subscriptionTier: basePlan.charAt(0).toUpperCase() + basePlan.slice(1),
        activeUsers: org._count.users,
        monthlyRevenue: monthlyRevenue,
        storageUsed: org._count.users * 2, // Estimate 2GB per user
        createdAt: org.createdAt.toISOString(),
        status: org.status || 'active',
        contactEmail: org.email || '',
        phone: org.phone || '',
        plan: basePlan, // Use clean plan name
        limits: {
          users: billingPlan?.usersLimit || 0,
          campaigns: billingPlan?.campaignsLimit || 0,
          shows: billingPlan?.showsLimit || 0,
          storage: billingPlan?.storageLimit || 0
        },
        features: {
          apiAccess: true,
          customBranding: basePlan === 'enterprise',
          ssoEnabled: basePlan === 'enterprise',
          advancedAnalytics: basePlan !== 'starter',
          ...(billingPlan?.features || {})
        },
        usage: {
          campaigns: 0, // We'll need to query org schemas for actual campaign count
          apiCalls: org._count.users * 100, // Estimate
          storageGB: org._count.users * 2
        }
      }
    })

    // Calculate aggregates
    const aggregates = {
      totalOrganizations: total,
      totalRevenue: transformedOrgs.reduce((sum, org) => sum + org.monthlyRevenue, 0),
      totalUsers: transformedOrgs.reduce((sum, org) => sum + org.activeUsers, 0),
      averageUsersPerOrg: total > 0 ? Math.round(transformedOrgs.reduce((sum, org) => sum + org.activeUsers, 0) / total) : 0
    }

    return NextResponse.json({
      organizations: transformedOrgs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      aggregates
    })

  } catch (error) {
    console.error('Master organizations API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
})

// POST /api/master/organizations - Create new organization with admin user
export const POST = await withMasterProtection(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json()
    const masterUser = request.user!
    
    // Validate required fields
    if (!body.name || !body.adminEmail || !body.adminName) {
      return NextResponse.json(
        { error: 'Organization name, admin email and admin name are required' },
        { status: 400 }
      )
    }
    
    // Check if organization with same name exists
    const existingOrg = await prisma.organization.findFirst({
      where: {
        name: {
          equals: body.name,
          mode: 'insensitive'
        }
      }
    })
    
    if (existingOrg) {
      return NextResponse.json(
        { error: 'Organization with this name already exists' },
        { status: 409 }
      )
    }
    
    // Check if user with admin email already exists
    const existingUser = await UserService.findByEmail(body.adminEmail)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }
    
    // Create organization and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: body.name,
          slug: body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          isActive: true,
          email: body.adminEmail,
          plan: body.plan || 'professional',
          billingAmount: body.billingAmount || 299
        }
      })
      
      // Create admin user with temporary password
      const tempPassword = 'Welcome2025!' // They'll be forced to change on first login
      const adminUser = await tx.user.create({
        data: {
          email: body.adminEmail,
          password: await bcrypt.hash(tempPassword, 10),
          name: body.adminName,
          role: 'admin',
          organizationId: organization.id,
          isActive: true,
          emailVerified: false
        }
      })
      
      return { organization, adminUser }
    })
    
    // Generate invitation token for the admin user
    const invitationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    
    await prisma.session.create({
      data: {
        userId: result.adminUser.id,
        token: invitationToken,
        expiresAt,
        userAgent: 'invitation',
        ipAddress: 'master-created'
      }
    })
    
    // Send invitation email to admin
    let emailResult: any = { success: false }
    
    try {
      emailResult = await emailService.sendUserInvitation(
        body.adminEmail,
        body.adminName,
        'admin',
        body.name,
        masterUser.name || masterUser.email,
        masterUser.email, // CC the master account
        invitationToken // Pass the invitation token
      )
      
      if (!emailResult.success) {
        console.error('Failed to send admin invitation:', emailResult.error)
      }
    } catch (emailError) {
      console.error('Email error:', emailError)
      emailResult = { success: false, error: emailError.message }
    }

    return NextResponse.json({
      success: true,
      organization: result.organization,
      adminUser: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        name: result.adminUser.name,
        role: result.adminUser.role
      },
      emailSent: emailResult.success,
      emailDetails: emailResult.success ? {
        messageId: emailResult.messageId,
        provider: emailResult.details?.provider
      } : null,
      message: emailResult.success 
        ? 'Organization created and admin invitation sent successfully'
        : 'Organization created but invitation email could not be sent. Please contact the admin manually.'
    })

  } catch (error) {
    console.error('Create organization error:', error)
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    )
  }
})