import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { createSecurityAuditLog } from '@/lib/security/audit'
import {
  validatePasswordPolicy,
  checkPasswordReuse,
  storePasswordHistory,
  checkPasswordMinAge,
  getPasswordStrength
} from '@/lib/security/password-policy'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// POST /api/security/password - Change password with policy enforcement
export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const sessionUser = await UserService.validateSession(authToken.value)
    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    console.log('🔐 Password API: Processing password change for user', { 
      userId: sessionUser.id 
    })

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        email: true,
        password: true,
        organizationId: true,
        passwordChangedAt: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)
    if (!isValidPassword) {
      // Log failed attempt
      await createSecurityAuditLog({
        organizationId: user.organizationId,
        userId: sessionUser.id,
        userEmail: user.email,
        action: 'PASSWORD_CHANGE_FAILED',
        resource: 'password',
        reason: 'Invalid current password',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: false
      })

      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Check minimum age requirement
    const minAgeCheck = await checkPasswordMinAge(user.id, user.organizationId)
    if (!minAgeCheck.canChange) {
      return NextResponse.json(
        { 
          error: `You must wait ${minAgeCheck.hoursUntilCanChange} more hours before changing your password again` 
        },
        { status: 400 }
      )
    }

    // Validate new password against policy
    const validation = await validatePasswordPolicy(newPassword, user.organizationId)
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Password does not meet policy requirements',
          errors: validation.errors 
        },
        { status: 400 }
      )
    }

    // Check password reuse
    const isReused = await checkPasswordReuse(user.id, newPassword, user.organizationId)
    if (isReused) {
      return NextResponse.json(
        { error: 'This password has been used recently. Please choose a different password.' },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update user password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        forcePasswordChange: false,
        updatedAt: new Date()
      }
    })

    // Store password in history
    await storePasswordHistory(user.id, hashedPassword)

    // Log successful password change
    await createSecurityAuditLog({
      organizationId: user.organizationId,
      userId: sessionUser.id,
      userEmail: user.email,
      action: 'PASSWORD_CHANGED',
      resource: 'password',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true
    })

    // Get password strength
    const strength = getPasswordStrength(newPassword)

    console.log('✅ Password API: Password changed successfully')
    return NextResponse.json({
      message: 'Password changed successfully',
      strength: strength.strength,
      strengthScore: strength.score
    })

  } catch (error) {
    console.error('❌ Password API Error:', error)
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    )
  }
}

// GET /api/security/password - Get password policy and status
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        organizationId: true,
        passwordChangedAt: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get organization's password policy
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { settings: true }
    })

    const securitySettings = (org?.settings as any)?.security || {}
    const passwordPolicy = securitySettings.passwordPolicy || {}

    // Calculate password age
    let passwordAge = null
    let daysUntilExpiry = null
    if (user.passwordChangedAt) {
      passwordAge = Math.floor(
        (Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      if (passwordPolicy.maxAge && passwordPolicy.maxAge > 0) {
        daysUntilExpiry = passwordPolicy.maxAge - passwordAge
      }
    }

    return NextResponse.json({
      policy: {
        minLength: passwordPolicy.minLength || 8,
        requireUppercase: passwordPolicy.requireUppercase !== false,
        requireLowercase: passwordPolicy.requireLowercase !== false,
        requireNumbers: passwordPolicy.requireNumbers !== false,
        requireSpecialChars: passwordPolicy.requireSpecialChars || false,
        preventReuse: passwordPolicy.preventReuse || 5,
        maxAge: passwordPolicy.maxAge || 90,
        minAge: passwordPolicy.minAge || 0
      },
      status: {
        lastChanged: user.passwordChangedAt?.toISOString() || null,
        passwordAge,
        daysUntilExpiry,
        requiresChange: daysUntilExpiry !== null && daysUntilExpiry <= 7
      }
    })

  } catch (error) {
    console.error('❌ Password API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch password policy' },
      { status: 500 }
    )
  }
}

// PUT /api/security/password - Legacy endpoint for password change (backward compatibility)
export async function PUT(request: NextRequest) {
  // Use the new POST endpoint logic
  return POST(request)
}
