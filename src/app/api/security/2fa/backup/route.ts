import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'
import { createSecurityAuditLog } from '@/lib/security/audit'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// POST /api/security/2fa/backup - Verify backup code
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

    const { code } = await request.json()

    if (!code || code.length !== 8) {
      return NextResponse.json(
        { error: 'Invalid backup code format' },
        { status: 400 }
      )
    }

    // Get user's organization ID
    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        organizationId: true,
        twoFactorEnabled: true
      }
    })

    if (!userProfile?.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA is not enabled' },
        { status: 400 }
      )
    }

    // Get all unused backup codes for this user
    const backupCodes = await prisma.twoFactorBackupCode.findMany({
      where: {
        userId: user.id,
        used: false
      }
    })

    // Try to verify the code against each stored hash
    let validCode = null
    for (const backupCode of backupCodes) {
      const hash = crypto.pbkdf2Sync(code.toUpperCase(), backupCode.salt, 10000, 64, 'sha512').toString('hex')
      if (hash === backupCode.codeHash) {
        validCode = backupCode
        break
      }
    }

    if (!validCode) {
      // Log failed attempt
      await createSecurityAuditLog({
        organizationId: userProfile.organizationId,
        userId: user.id,
        userEmail: user.email,
        action: 'BACKUP_CODE_VERIFICATION_FAILED',
        resource: '2fa_backup',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: false
      })

      return NextResponse.json(
        { error: 'Invalid backup code' },
        { status: 400 }
      )
    }

    // Mark the backup code as used
    await prisma.twoFactorBackupCode.update({
      where: { id: validCode.id },
      data: { 
        used: true,
        usedAt: new Date()
      }
    })

    // Log successful backup code use
    await createSecurityAuditLog({
      organizationId: userProfile.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: 'BACKUP_CODE_USED',
      resource: '2fa_backup',
      resourceId: validCode.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true
    })

    // Check how many backup codes are left
    const remainingCodes = await prisma.twoFactorBackupCode.count({
      where: {
        userId: user.id,
        used: false
      }
    })

    console.log('✅ 2FA Backup API: Backup code verified successfully')
    return NextResponse.json({
      message: 'Backup code verified successfully',
      remainingCodes,
      warning: remainingCodes < 3 ? 'You have few backup codes remaining. Consider regenerating them.' : undefined
    })

  } catch (error) {
    console.error('❌ 2FA Backup API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/security/2fa/backup - Get backup codes status
export async function GET(request: NextRequest) {
  try {
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

    // Count remaining backup codes
    const totalCodes = await prisma.twoFactorBackupCode.count({
      where: { userId: user.id }
    })

    const remainingCodes = await prisma.twoFactorBackupCode.count({
      where: {
        userId: user.id,
        used: false
      }
    })

    return NextResponse.json({
      totalCodes,
      remainingCodes,
      usedCodes: totalCodes - remainingCodes
    })

  } catch (error) {
    console.error('❌ 2FA Backup API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/security/2fa/backup - Regenerate backup codes
export async function PUT(request: NextRequest) {
  try {
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

    // Get user's organization ID
    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        organizationId: true,
        twoFactorEnabled: true
      }
    })

    if (!userProfile?.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA must be enabled to regenerate backup codes' },
        { status: 400 }
      )
    }

    // Delete all existing backup codes
    await prisma.twoFactorBackupCode.deleteMany({
      where: { userId: user.id }
    })

    // Generate new backup codes
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

    // Log backup codes regeneration
    await createSecurityAuditLog({
      organizationId: userProfile.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: 'BACKUP_CODES_REGENERATED',
      resource: '2fa_backup',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true
    })

    console.log('✅ 2FA Backup API: Backup codes regenerated successfully')
    return NextResponse.json({
      message: 'Backup codes regenerated successfully',
      backupCodes
    })

  } catch (error) {
    console.error('❌ 2FA Backup API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}