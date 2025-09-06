import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { createSecurityAuditLog } from '@/lib/security/audit'

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

    console.log('🔐 2FA API: Fetching 2FA status for user', { userId: user.id })

    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        twoFactorEnabled: true,
        twoFactorSecret: true
      }
    })

    return NextResponse.json({
      enabled: userProfile?.twoFactorEnabled || false,
      method: userProfile?.twoFactorEnabled ? 'totp' : null,
      verified: userProfile?.twoFactorEnabled || false
    })

  } catch (error) {
    console.error('❌ 2FA API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    console.log('🔐 2FA API: Processing 2FA request for user', { userId: user.id, action: body.code ? 'verify' : 'enable' })

    // If code is provided, verify it
    if (body.code) {
      const { code } = body
      
      if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
        return NextResponse.json(
          { error: 'Invalid verification code format' },
          { status: 400 }
        )
      }

      // Get user's 2FA secret
      const userProfile = await prisma.user.findUnique({
        where: { id: user.id },
        select: { 
          twoFactorSecret: true,
          organizationId: true
        }
      })

      if (!userProfile?.twoFactorSecret) {
        return NextResponse.json(
          { error: '2FA setup not initiated' },
          { status: 400 }
        )
      }

      // Verify TOTP code using speakeasy
      const verified = speakeasy.totp.verify({
        secret: userProfile.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2 // Allow 2 time windows (60 seconds) for clock drift
      })

      if (!verified) {
        // Log failed attempt
        await createSecurityAuditLog({
          organizationId: userProfile.organizationId,
          userId: user.id,
          userEmail: user.email,
          action: '2FA_VERIFICATION_FAILED',
          resource: '2fa',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          success: false
        })

        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        )
      }

      // Enable 2FA
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          updatedAt: new Date()
        }
      })

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        crypto.randomBytes(4).toString('hex').toUpperCase()
      )

      // Store backup codes (hashed) in database
      const hashedBackupCodes = backupCodes.map(code => {
        const salt = crypto.randomBytes(16).toString('hex')
        const hash = crypto.pbkdf2Sync(code, salt, 10000, 64, 'sha512').toString('hex')
        return { hash, salt }
      })

      // Store in TwoFactorBackupCode table
      await prisma.$transaction(
        hashedBackupCodes.map(({ hash, salt }) =>
          prisma.twoFactorBackupCode.create({
            data: {
              userId: user.id,
              codeHash: hash,
              salt,
              used: false
            }
          })
        )
      )

      // Log successful 2FA enable
      await createSecurityAuditLog({
        organizationId: userProfile.organizationId,
        userId: user.id,
        userEmail: user.email,
        action: '2FA_ENABLED',
        resource: '2fa',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: true
      })

      console.log('✅ 2FA API: 2FA enabled successfully')
      return NextResponse.json({
        message: '2FA enabled successfully',
        backupCodes
      })
    } else {
      // Generate new secret for 2FA setup
      const secret = speakeasy.generateSecret({
        name: `PodcastFlow (${user.email})`,
        issuer: 'PodcastFlow',
        length: 32
      })

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url || '')

      // Store secret (but don't enable 2FA yet)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: secret.base32,
          updatedAt: new Date()
        }
      })

      console.log('✅ 2FA API: 2FA setup initiated')
      return NextResponse.json({
        secret: secret.base32,
        qrCode: qrCodeDataUrl,
        manualEntryKey: secret.base32,
        message: 'Scan the QR code with your authenticator app, then enter the 6-digit code'
      })
    }

  } catch (error) {
    console.error('❌ 2FA API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    console.log('🔐 2FA API: Disabling 2FA for user', { userId: user.id })

    // Get user's organization ID for audit log
    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true }
    })

    // Disable 2FA and clear secret
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date()
      }
    })

    // Delete all backup codes for this user
    await prisma.twoFactorBackupCode.deleteMany({
      where: { userId: user.id }
    })

    // Log 2FA disable
    if (userProfile?.organizationId) {
      await createSecurityAuditLog({
        organizationId: userProfile.organizationId,
        userId: user.id,
        userEmail: user.email,
        action: '2FA_DISABLED',
        resource: '2fa',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: true
      })
    }

    console.log('✅ 2FA API: 2FA disabled successfully')
    return NextResponse.json({
      message: '2FA disabled successfully'
    })

  } catch (error) {
    console.error('❌ 2FA API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
