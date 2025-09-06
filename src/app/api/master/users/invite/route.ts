import { NextRequest, NextResponse } from 'next/server'
import { withMasterProtection } from '@/lib/auth/api-protection'
import prisma from '@/lib/db/prisma'
import { emailService } from '@/lib/email/email-service'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// POST /api/master/users/invite - Invite a new user to any organization
export const POST = await withMasterProtection(async (request: NextRequest) => {
  try {
    const user = (request as any).user!
    const body = await request.json()
    
    const { email, name, role, organizationId } = body

    // Validate required fields
    if (!email || !name || !role || !organizationId) {
      return NextResponse.json(
        { error: 'Email, name, role, and organization are required' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['admin', 'sales', 'producer', 'talent', 'client']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role specified' },
        { status: 400 }
      )
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: { 
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Create user with temporary password
    const tempPassword = crypto.randomBytes(12).toString('hex')
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name,
        role: role,
        organizationId: organizationId,
        isActive: true,
        emailVerified: false // Will be set to true when they accept invitation
      }
    })

    // Create invitation session token
    const invitationToken = crypto.randomBytes(32).toString('hex')
    const sessionId = 'cm' + crypto.randomBytes(10).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: newUser.id,
        token: invitationToken,
        expiresAt,
        userAgent: 'invitation',
        ipAddress: 'master-invite',
        createdAt: new Date(),
        lastAccessedAt: new Date()
      }
    })

    // Send invitation email
    let emailResult: any = { success: false }
    
    try {
      emailResult = await emailService.sendUserInvitation(
        newUser.email,
        newUser.name,
        newUser.role,
        organization.name,
        user.name || user.email,
        user.email,
        invitationToken
      )
      
      if (!emailResult.success) {
        console.error('Email send failure details:', emailResult.details)
      }
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      emailResult = { success: false, error: emailError.message }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        organizationId: newUser.organizationId
      },
      emailSent: emailResult.success,
      emailDetails: emailResult.success ? {
        messageId: emailResult.messageId,
        provider: emailResult.details?.provider
      } : null,
      message: emailResult.success 
        ? 'User created and invitation sent successfully'
        : 'User created but invitation email could not be sent. Please resend the invitation manually.'
    })

  } catch (error) {
    console.error('❌ Master user invite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})