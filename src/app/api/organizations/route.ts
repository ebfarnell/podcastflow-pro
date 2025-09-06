import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { createOrganizationWithSchema } from '@/lib/organizations/org-setup'
import { provisionTenant } from '@/lib/provisioning/provision-tenant-prisma'
import { 
  recordProvisionStart, 
  recordProvisionSuccess, 
  recordProvisionFailure 
} from '@/lib/provisioning/audit'

export async function GET(request: NextRequest) {
  try {
    // Get session for auth
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const search = url.searchParams.get('search') || ''
    const status = url.searchParams.get('status') || 'all'
    const plan = url.searchParams.get('plan') || 'all'
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    // Build where clause
    const where: any = {}
    
    // Master users see all orgs, others see only their org
    if (session.role !== 'master') {
      where.id = session.organizationId
    }

    // Apply filters
    if (status !== 'all') {
      where.status = status
    }
    
    if (plan !== 'all') {
      where.plan = plan
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get organizations from database
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { users: true }
          }
        }
      }),
      prisma.organization.count({ where })
    ])

    // Transform for response
    const enrichedOrganizations = organizations.map(org => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      domain: org.slug, // Legacy field compatibility
      email: org.email,
      phone: org.phone,
      address: org.address,
      city: org.city,
      state: org.state,
      postalCode: org.postalCode,
      country: org.country,
      status: org.status,
      plan: org.plan,
      isActive: org.isActive,
      contactEmail: org.email, // Legacy field compatibility
      contactName: org.name, // Legacy field compatibility
      userCount: org._count.users,
      activeUserCount: org._count.users, // TODO: Add active user count
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
      lastActivity: org.updatedAt.toISOString()
    }))

    return NextResponse.json({
      organizations: enrichedOrganizations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        search,
        status,
        plan
      },
      scope: session.role === 'master' ? 'all' : session.organizationId
    })

  } catch (error) {
    console.error('Organizations GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let auditId: string | undefined;
  const startTime = Date.now();

  try {
    // Get session for auth
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only master users can create organizations
    if (session.role !== 'master') {
      return NextResponse.json(
        { error: 'Master access required to create organizations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      name, 
      slug, 
      email, 
      phone, 
      address, 
      city, 
      state, 
      postalCode, 
      country,
      plan = 'professional',
      // Legacy field mapping
      domain,
      contactEmail,
      contactName,
      contactPhone
    } = body

    // Handle legacy field names
    const orgSlug = slug || domain?.replace(/\./g, '-').toLowerCase()
    const orgEmail = email || contactEmail
    const orgPhone = phone || contactPhone
    const orgName = name || contactName

    // Validate required fields
    if (!orgName || !orgSlug || !plan || !orgEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug/domain, plan, email' },
        { status: 400 }
      )
    }

    // Check if organization with slug already exists
    const existingOrg = await prisma.organization.findFirst({
      where: { slug: orgSlug }
    })

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Organization with this slug already exists' },
        { status: 409 }
      )
    }

    console.log(`Creating organization: ${orgName} (${orgSlug})`)

    // Create organization with basic schema using the existing function
    const createResult = await createOrganizationWithSchema({
      name: orgName,
      slug: orgSlug,
      email: orgEmail,
      phone: orgPhone,
      address,
      city,
      state,
      postalCode,
      country: country || 'US',
      plan
    })

    if (!createResult.success) {
      throw new Error(createResult.error || 'Failed to create organization')
    }

    const newOrganization = createResult.organization

    // Start provisioning audit
    auditId = await recordProvisionStart({
      orgId: newOrganization.id,
      orgSlug: newOrganization.slug,
      mode: 'sync',
      userId: session.userId
    })

    console.log(`Running comprehensive provisioning for ${orgSlug}`)

    // Run comprehensive provisioning to add missing tables, columns, etc.
    const provisionResult = await provisionTenant({
      orgSlug: newOrganization.slug,
      orgId: newOrganization.id,
      dryRun: false,
      verbose: true
    })

    const duration = Date.now() - startTime

    if (!provisionResult.success) {
      // Record failure but still return the org (partially provisioned)
      await recordProvisionFailure({
        auditId,
        orgId: newOrganization.id,
        orgSlug: newOrganization.slug,
        error: provisionResult.errors.join(', '),
        details: provisionResult,
        duration
      })

      console.error(`Provisioning had errors for ${orgSlug}:`, provisionResult.errors)
      
      // Return success with warning
      return NextResponse.json({
        organization: {
          id: newOrganization.id,
          name: newOrganization.name,
          slug: newOrganization.slug,
          domain: newOrganization.slug, // Legacy compatibility
          email: newOrganization.email,
          status: newOrganization.status,
          plan: newOrganization.plan,
          createdAt: newOrganization.createdAt,
          updatedAt: newOrganization.updatedAt
        },
        message: 'Organization created with partial provisioning',
        provisioning: {
          status: 'partial',
          errors: provisionResult.errors,
          summary: provisionResult.summary
        }
      }, { status: 201 })
    }

    // Record success
    await recordProvisionSuccess({
      auditId,
      orgId: newOrganization.id,
      orgSlug: newOrganization.slug,
      summary: provisionResult.summary,
      duration
    })

    console.log(`Successfully provisioned ${orgSlug} in ${duration}ms`)
    console.log(`Summary:`, provisionResult.summary)

    // Return success response
    return NextResponse.json({
      organization: {
        id: newOrganization.id,
        name: newOrganization.name,
        slug: newOrganization.slug,
        domain: newOrganization.slug, // Legacy compatibility
        email: newOrganization.email,
        phone: newOrganization.phone,
        address: newOrganization.address,
        city: newOrganization.city,
        state: newOrganization.state,
        postalCode: newOrganization.postalCode,
        country: newOrganization.country,
        status: newOrganization.status,
        plan: newOrganization.plan,
        isActive: newOrganization.isActive,
        createdAt: newOrganization.createdAt,
        updatedAt: newOrganization.updatedAt,
        contactEmail: newOrganization.email, // Legacy compatibility
        contactName: newOrganization.name // Legacy compatibility
      },
      message: 'Organization created and fully provisioned',
      provisioning: {
        status: 'complete',
        summary: provisionResult.summary,
        duration
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Organizations POST error:', error)
    
    const duration = Date.now() - startTime
    
    // Try to record the failure in audit
    if (auditId) {
      await recordProvisionFailure({
        auditId,
        orgId: 'unknown',
        orgSlug: 'unknown',
        error: error.message,
        details: { stack: error.stack },
        duration
      })
    }

    // Don't leak sensitive error details to client
    const userMessage = error.message.includes('already exists') 
      ? 'Organization with this name or slug already exists'
      : 'Failed to create organization. Please try again or contact support.'

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    )
  }
}

// New endpoint to check provisioning status
export async function GET_STATUS(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const orgId = url.pathname.split('/').pop()

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      )
    }

    // Get the latest provisioning audit entry
    const status = await prisma.$queryRaw<any[]>`
      SELECT * FROM "ProvisioningAudit"
      WHERE "orgId" = ${orgId}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `

    if (!status || status.length === 0) {
      return NextResponse.json({
        status: 'unknown',
        message: 'No provisioning records found'
      })
    }

    return NextResponse.json({
      status: status[0].status,
      summary: status[0].summary,
      error: status[0].error,
      duration: status[0].duration,
      createdAt: status[0].createdAt,
      updatedAt: status[0].updatedAt
    })

  } catch (error) {
    console.error('Provisioning status error:', error)
    return NextResponse.json(
      { error: 'Failed to get provisioning status' },
      { status: 500 }
    )
  }
}