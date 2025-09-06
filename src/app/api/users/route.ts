import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import { emailService } from '@/lib/email/email-service'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { auditService, AuditEventType, AuditSeverity } from '@/lib/audit/audit-service'
import { activityService } from '@/lib/activities/activity-service'
import crypto from 'crypto'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

async function getHandler(request: AuthenticatedRequest) {
  try {
    const user = request.user!

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') as UserRole | null
    const organizationId = searchParams.get('organizationId')

    // Build query
    const where: any = {
      isActive: true,
    }

    // Filter by organization - ALWAYS filter unless explicitly requesting different org
    console.log('🔍 Users API Debug:', {
      userRole: user.role,
      userOrgId: user.organizationId,
      requestedOrgId: organizationId,
      userEmail: user.email
    });
    
    // SECURITY FIX: Always filter by user's organization by default
    // Only allow cross-org access if explicitly requested and user has proper permissions
    if (organizationId && organizationId !== user.organizationId) {
      // Cross-organization request - verify permissions
      if (user.role !== 'admin' && user.role !== 'master') {
        console.log('🔍 Unauthorized cross-org request blocked');
        return NextResponse.json(
          { error: 'Insufficient permissions for cross-organization access' },
          { status: 403 }
        )
      }
      where.organizationId = organizationId
      console.log('🔍 Authorized cross-org request:', organizationId);
    } else {
      // Default: filter by user's own organization
      where.organizationId = user.organizationId
      console.log('🔍 Applied org filter:', where.organizationId);
    }

    if (role) {
      where.role = role
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        title: true,
        department: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        isActive: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      users,
      total: users.length,
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest) => {
  const authToken = request.cookies.get('auth-token')
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Validate session and get user
  const user = await UserService.validateSession(authToken.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Add user to request
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = user
  
  return getHandler(authenticatedRequest)
}

async function postHandler(request: AuthenticatedRequest) {
  console.log('POST /api/users - Handler started')
  try {
    const user = request.user!
    console.log('Authenticated user:', user.email, user.role)

    const body = await request.json()
    console.log('Request body received:', JSON.stringify(body))
    const { email, password, name, role, organizationId, phone, title, department } = body

    // Validate required fields
    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'Email, name, and role are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existing = await UserService.findByEmail(email)
    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Create user (with temporary password if invitation-style)
    const defaultPassword = password || 'temp123!' // Temporary password for invitations
    const targetOrganizationId = organizationId || user.organizationId
    
    console.log('Creating user with data:', {
      email,
      name,
      role,
      organizationId: targetOrganizationId,
      phone: phone || null,
      title: title || null,
      department: department || null,
    })
    
    let newUser
    try {
      newUser = await UserService.createUser({
        email,
        password: defaultPassword,
        name,
        role,
        organizationId: targetOrganizationId,
        phone: phone || null,
        title: title || null,
        department: department || null,
      })
      
      console.log('User created successfully:', newUser.id)
    } catch (createError) {
      console.error('UserService.createUser error:', createError)
      throw createError
    }

    // Get organization details for email
    const organization = await prisma.organization.findUnique({
      where: { id: targetOrganizationId },
      select: { name: true }
    })

    // Generate invitation token for new users who haven't set their password
    let invitationToken = null
    if (!password) {
      // Create a temporary session that will be used for invitation acceptance
      invitationToken = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      
      await prisma.session.create({
        data: {
          userId: newUser.id,
          token: invitationToken,
          expiresAt,
          userAgent: 'invitation',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })
    }

    // Send invitation email
    let emailResult: any = { success: false }
    let emailWarning = null
    
    try {
      emailResult = await emailService.sendUserInvitation(
        email,
        name,
        role,
        organization?.name || 'Unknown Organization',
        user.name || user.email,
        user.email, // CC the inviter
        invitationToken, // Pass the invitation token
        targetOrganizationId, // Organization ID
        user.id // Inviter ID
      )
      
      if (!emailResult.success) {
        emailWarning = `User created successfully but invitation email could not be sent: ${emailResult.error || 'Unknown error'}`
        console.error('Email send failure details:', emailResult.details)
      }
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      emailWarning = 'User created successfully but invitation email failed to send.'
      emailResult = { success: false, error: emailError.message }
    }

    // Log user creation in audit log
    await auditService.log({
      eventType: AuditEventType.USER_CREATED,
      severity: AuditSeverity.MEDIUM,
      userId: user.id,
      organizationId: user.organizationId,
      entityType: 'user',
      entityId: newUser.id,
      action: 'Created new user account',
      details: {
        newUserEmail: email,
        newUserRole: role,
        newUserOrganization: organization?.name || targetOrganizationId,
        invitationEmailSent: emailResult.success,
        emailMessageId: emailResult.messageId,
        createdBy: user.email
      },
      success: true
    })

    // Log activity
    await activityService.logUserActivity(
      newUser,
      'created',
      user,
      {
        organizationName: organization?.name,
        invitationEmailSent: emailResult.success,
        emailMessageId: emailResult.messageId
      }
    )

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser

    const response: any = {
      user: userWithoutPassword,
      emailSent: emailResult.success,
      emailDetails: {
        success: emailResult.success,
        messageId: emailResult.messageId,
        provider: emailResult.details?.provider,
        duration: emailResult.details?.duration
      }
    }
    
    if (emailWarning) {
      response.warning = emailWarning
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const POST = async (request: NextRequest) => {
  console.log('POST /api/users - Export function called')
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      console.log('No auth token found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Validating session...')
    // Validate session and get user
    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      console.log('Session validation failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Session validated for user:', user.email)
    // Add user to request
    const authenticatedRequest = request as AuthenticatedRequest
    authenticatedRequest.user = user
    
    return postHandler(authenticatedRequest)
  } catch (error) {
    console.error('Error in POST /api/users export:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}