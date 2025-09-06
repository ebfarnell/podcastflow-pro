import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { UserService } from '@/lib/auth/user-service'
import { cookies } from 'next/headers'
import { organizationService } from '@/services/organizationService'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// Helper function to extract organization from auth token
function getOrganizationFromAuth(authHeader: string): string {
  return 'org-techstart'
}

// Helper function to extract user role from auth token
function getUserRoleFromAuth(authHeader: string): string {
  if (authHeader.includes('master')) {
    return 'master'
  }
  return 'admin'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await params

    // Check authentication via cookie
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')
    
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const currentUser = await UserService.validateSession(authToken.value)
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // For the old organization ID, redirect to the correct one
    if (organizationId === 'cmd2qfeve0000og5y8hfwu795') {
      // This is the old PodcastFlow Pro ID, redirect to the new one
      const newOrgId = 'cmd2qfev00000og5y8hftu795'
      return NextResponse.redirect(new URL(`/api/organizations/${newOrgId}`, request.url))
    }

    // Check access permissions
    if (currentUser.role !== 'master' && organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get organization from database
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true
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

    // Calculate user statistics
    const activeUsers = organization.users.filter(user => user.isActive)
    
    const enrichedOrganization = {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      status: organization.status,
      email: organization.email,
      phone: organization.phone,
      address: organization.address,
      city: organization.city,
      state: organization.state,
      postalCode: organization.postalCode,
      country: organization.country,
      timezone: organization.timezone,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      userCount: organization.users.length,
      activeUserCount: activeUsers.length,
      users: organization.users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        lastLoginAt: user.lastLoginAt
      })),
      lastActivity: organization.users.length > 0 ? 
        new Date(Math.max(...organization.users.map(u => new Date(u.lastLoginAt || u.createdAt).getTime()))).toISOString() :
        organization.createdAt
    }

    return NextResponse.json(enrichedOrganization)

  } catch (error) {
    console.error('Organization GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await params
    const body = await request.json()

    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userRole = getUserRoleFromAuth(authHeader)
    const userOrganizationId = getOrganizationFromAuth(authHeader)

    // Check access permissions
    if (userRole !== 'master' && organizationId !== userOrganizationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Check if organization exists
    const existingOrg = organizationService.getOrganization(organizationId)
    if (!existingOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // If domain is being updated, check for conflicts
    if (body.domain && body.domain !== existingOrg.domain) {
      const domainConflict = organizationService.getOrganizationByDomain(body.domain)
      if (domainConflict && domainConflict.id !== organizationId) {
        return NextResponse.json(
          { error: 'Organization with this domain already exists' },
          { status: 409 }
        )
      }
    }

    // Update organization
    const updatedOrganization = organizationService.updateOrganization(organizationId, body)
    if (!updatedOrganization) {
      return NextResponse.json(
        { error: 'Failed to update organization' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      organization: updatedOrganization,
      message: 'Organization updated successfully'
    })

  } catch (error) {
    console.error('Organization PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await params

    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userRole = getUserRoleFromAuth(authHeader)

    // Only master users can delete organizations
    if (userRole !== 'master') {
      return NextResponse.json(
        { error: 'Master access required to delete organizations' },
        { status: 403 }
      )
    }

    // Check if organization exists
    const existingOrg = organizationService.getOrganization(organizationId)
    if (!existingOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Check if organization has users
    const users = organizationService.getUsersByOrganization(organizationId)
    if (users.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete organization with active users. Please transfer or delete users first.' },
        { status: 400 }
      )
    }

    // Delete organization
    const deleted = organizationService.deleteOrganization(organizationId)
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete organization' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Organization deleted successfully'
    })

  } catch (error) {
    console.error('Organization DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
