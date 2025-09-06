import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'
import { emailService } from '@/lib/email/email-service'
import { withApiProtection } from '@/lib/auth/api-protection'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/auth/password-reset - Send password reset email
export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { email, userId } = body
    
    // Validate input
    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Email or userId is required' },
        { status: 400 }
      )
    }
    
    // Find the user
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: email.toLowerCase() },
      include: {
        organization: true
      }
    })
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      })
    }
    
    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const sessionId = 'cm' + crypto.randomBytes(10).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1) // 1 hour expiry
    
    // Create a session for password reset
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        token: resetToken,
        userAgent: 'password-reset',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        expiresAt
      }
    })
    
    // Send password reset email
    const emailResult = await emailService.sendPasswordReset(
      user.email,
      user.name || user.email,
      resetToken,
      user.organization?.name || 'PodcastFlow Pro',
      (request as any).user?.name || 'Support Team',
      (request as any).user?.email || 'support@podcastflow.pro'
    )
    
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error)
      return NextResponse.json(
        { error: 'Failed to send password reset email' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Password reset link sent successfully',
      emailSent: true,
      emailDetails: {
        messageId: emailResult.messageId,
        provider: emailResult.details?.provider
      }
    })
    
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    )
  }
}, {
  allowedRoles: ['master', 'admin']
})

// Public endpoint for requesting password reset (no auth required)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }
    
    // Find the user (case-insensitive)
    const user = await prisma.user.findFirst({
      where: { 
        email: {
          equals: email,
          mode: 'insensitive'
        }
      },
      include: {
        organization: true
      }
    })
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      })
    }
    
    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const sessionId = 'cm' + crypto.randomBytes(10).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1) // 1 hour expiry
    
    // Create a session for password reset
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        token: resetToken,
        userAgent: 'password-reset',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        expiresAt
      }
    })
    
    // Send password reset email
    const emailResult = await emailService.sendPasswordReset(
      user.email,
      user.name || user.email,
      resetToken,
      user.organization?.name || 'PodcastFlow Pro',
      'PodcastFlow Support',
      'support@podcastflow.pro'
    )
    
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error)
    }
    
    // Always return success for security
    return NextResponse.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    })
    
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    )
  }
}
