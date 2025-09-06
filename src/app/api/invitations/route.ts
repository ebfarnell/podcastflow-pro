import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { emailService } from '@/lib/email/email-service'
import { AuthenticatedRequest } from '@/lib/auth/api-protection'
import { auditService, AuditEventType, AuditSeverity } from '@/lib/audit/audit-service'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

// POST handler for resending invitations
async function postHandler(request: AuthenticatedRequest) {
  try {
    const user = request.user!
    console.log('Invitation API called by:', user.email, 'role:', user.role)

    const body = await request.json()
    const { email, action, userId } = body
    console.log('Request body:', { email, action, userId })

    // Handle both formats: direct email or action-based with userId
    let targetEmail: string | undefined = email
    
    if (action === 'resend' && userId) {
      // Find user by ID to get their email
      const userById = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })
      
      if (!userById) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
      
      targetEmail = userById.email
    }

    // Validate required fields
    if (!targetEmail) {
      console.log('Invalid invitation request:', { email, action, userId })
      return NextResponse.json(
        { error: 'Email or userId is required', received: { email, action, userId } },
        { status: 400 }
      )
    }

    // Find the user to resend invitation to (case-insensitive)
    const targetUser = await prisma.user.findFirst({
      where: { 
        email: {
          equals: targetEmail,
          mode: 'insensitive'
        }
      },
      include: {
        organization: {
          select: {
            name: true
          }
        }
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user has appropriate permissions to resend invitation
    if (user.role !== 'master' && user.organizationId !== targetUser.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized to resend invitation to this user' },
        { status: 403 }
      )
    }

    // Find existing invitation token or create a new one
    let invitationToken: string | undefined
    
    // Look for existing invitation session
    const existingSession = await prisma.session.findFirst({
      where: {
        userId: targetUser.id,
        userAgent: 'invitation',
        expiresAt: {
          gt: new Date() // Only valid (non-expired) sessions
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    if (existingSession) {
      invitationToken = existingSession.token
      console.log('Using existing invitation token for:', targetUser.email)
    } else {
      // Create new invitation session
      const crypto = await import('crypto')
      const newToken = crypto.randomBytes(32).toString('hex')
      const sessionId = 'cm' + crypto.randomBytes(10).toString('hex')
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now
      
      await prisma.session.create({
        data: {
          id: sessionId,
          userId: targetUser.id,
          token: newToken,
          expiresAt,
          userAgent: 'invitation',
          ipAddress: 'resend-api',
          createdAt: new Date(),
          lastAccessedAt: new Date()
        }
      })
      
      invitationToken = newToken
      console.log('Created new invitation token for:', targetUser.email)
    }

    // Resend invitation email
    let emailResult: any = { success: false }
    
    try {
      emailResult = await emailService.sendUserInvitation(
        targetUser.email,
        targetUser.name || 'User',
        targetUser.role,
        targetUser.organization?.name || 'Unknown Organization',
        user.name || user.email,
        user.email, // CC the inviter
        invitationToken // Pass the invitation token
      )
      
      if (!emailResult.success) {
        console.error('Email send failure details:', emailResult.details)
      }
    } catch (emailError) {
      console.error('Failed to resend invitation email:', emailError)
      emailResult = { success: false, error: emailError.message }
    }

    // Log the resend attempt in audit log
    await auditService.log({
      eventType: AuditEventType.USER_UPDATED,
      severity: AuditSeverity.LOW,
      userId: user.id,
      organizationId: user.organizationId,
      entityType: 'user',
      entityId: targetUser.id,
      action: 'Resent invitation email',
      details: {
        targetUserEmail: targetUser.email,
        targetUserRole: targetUser.role,
        invitationEmailSent: emailResult.success,
        emailMessageId: emailResult.messageId,
        resentBy: user.email
      },
      success: emailResult.success
    })

    if (!emailResult.success) {
      return NextResponse.json(
        { 
          error: `Failed to resend invitation email: ${emailResult.error || 'Unknown error'}`,
          details: emailResult.details
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      email: targetUser.email,
      emailDetails: {
        success: emailResult.success,
        messageId: emailResult.messageId,
        provider: emailResult.details?.provider,
        duration: emailResult.details?.duration
      }
    })
  } catch (error) {
    console.error('Error resending invitation:', error)
    return NextResponse.json(
      { error: 'Failed to resend invitation' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const POST = async (request: NextRequest) => {
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
  
  return postHandler(authenticatedRequest)
}