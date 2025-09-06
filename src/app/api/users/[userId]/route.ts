import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { logApiAccess } from '@/lib/audit/audit-middleware'
import { auditService, AuditEventType, AuditSeverity } from '@/lib/audit/audit-service'
import { safeQuerySchema } from '@/lib/db/schema-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await UserService.validateSession(authToken.value)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check access permissions
    if (currentUser.role !== 'master' && user.organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({ user })

  } catch (error) {
    console.error('User GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const body = await request.json()

    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await UserService.validateSession(authToken.value)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check access permissions
    // Allow users to update their own profile, or admins/master to update users in their organization
    const isUpdatingSelf = currentUser.id === userId
    const isAdminOrMaster = ['admin', 'master'].includes(currentUser.role)
    const isSameOrg = existingUser.organizationId === currentUser.organizationId
    
    if (!isUpdatingSelf && !isAdminOrMaster) {
      return NextResponse.json(
        { error: 'You can only update your own profile' },
        { status: 403 }
      )
    }
    
    if (!isUpdatingSelf && currentUser.role !== 'master' && !isSameOrg) {
      return NextResponse.json(
        { error: 'Access denied - different organization' },
        { status: 403 }
      )
    }

    // Prepare update data based on permissions
    const updateData: any = {}
    
    // All users can update their own basic profile info
    if (isUpdatingSelf || isAdminOrMaster) {
      if (body.name !== undefined) updateData.name = body.name
      if (body.phone !== undefined) updateData.phone = body.phone
      if (body.title !== undefined) updateData.title = body.title
      if (body.department !== undefined) updateData.department = body.department
    }
    
    // Only admins/master can update email, role, and active status
    if (isAdminOrMaster) {
      if (body.email !== undefined) updateData.email = body.email
      if (body.role !== undefined) updateData.role = body.role
      if (body.isActive !== undefined) updateData.isActive = body.isActive
    }

    // If email is being updated by admin/master, check for conflicts
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailConflict = await prisma.user.findUnique({
        where: { email: updateData.email }
      })
      if (emailConflict) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        )
      }
    }

    // Update user with only allowed fields
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        organization: true
      }
    })

    // Log user update
    await auditService.log({
      eventType: AuditEventType.USER_UPDATED,
      severity: AuditSeverity.MEDIUM,
      userId: currentUser.id,
      organizationId: currentUser.organizationId,
      entityType: 'user',
      entityId: userId,
      action: 'Updated user profile',
      details: {
        updatedFields: Object.keys(body),
        targetUser: updatedUser.email,
        changes: {
          roleChanged: body.role !== existingUser.role,
          statusChanged: body.isActive !== existingUser.isActive
        }
      },
      success: true
    })

    return NextResponse.json({
      user: updatedUser,
      message: 'User updated successfully'
    })

  } catch (error) {
    console.error('User PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await UserService.validateSession(authToken.value)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check access permissions
    if (currentUser.role !== 'master' && existingUser.organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // The database function delete_user_with_cleanup handles all related record deletion
    // It will clean up:
    // - Activity records from organization schema
    // - Sessions, API keys, Email logs/queue
    // - Notifications and audit logs
    // - Password history, 2FA codes
    // - User preferences
    // - Security audit logs, provisioning audits, system logs

    // Use the comprehensive deletion function for clean, reliable deletion
    try {
      console.log(`Attempting to delete user with ID: ${userId}`)
      
      // First verify the user still exists
      const userToDelete = await prisma.user.findUnique({
        where: { id: userId }
      })
      
      if (!userToDelete) {
        console.error(`User not found for deletion: ${userId}`)
        return NextResponse.json(
          { error: 'User not found or already deleted' },
          { status: 404 }
        )
      }
      
      console.log(`Found user to delete: ${userToDelete.email}`)
      
      // Use the database function for comprehensive deletion
      // This handles all cleanup and trigger management properly
      const result = await prisma.$queryRaw<Array<{success: boolean, message?: string, error?: string, warnings?: string[]}>>`
        SELECT delete_user_with_cleanup(
          ${userId}::text,
          ${currentUser.id}::text,
          ${currentUser.role}::text
        ) as result
      `
      
      if (result && result[0] && result[0].result) {
        const deleteResult = result[0].result as any
        
        if (!deleteResult.success) {
          console.error('User deletion failed:', deleteResult.error)
          if (deleteResult.warnings && deleteResult.warnings.length > 0) {
            console.warn('Deletion warnings:', deleteResult.warnings)
          }
          
          // Check if it's an access denied error
          if (deleteResult.error && deleteResult.error.includes('Access denied')) {
            return NextResponse.json(
              { error: deleteResult.error },
              { status: 403 }
            )
          }
          
          // Check if user not found
          if (deleteResult.error && deleteResult.error.includes('not found')) {
            return NextResponse.json(
              { error: deleteResult.error },
              { status: 404 }
            )
          }
          
          throw new Error(deleteResult.error || 'Failed to delete user')
        }
        
        console.log(`User deleted successfully: ${deleteResult.message}`)
        if (deleteResult.warnings && deleteResult.warnings.length > 0) {
          console.warn('Deletion warnings:', deleteResult.warnings)
        }
      } else {
        // Fallback: Direct deletion with proper context setting
        console.log('Function not available, using context-based deletion')
        
        const session = await UserService.getSessionFromUser(currentUser.id)
        const orgId = session?.organizationId || existingUser.organizationId || 'cmd6ntwt00001og415m69qh50'
        
        // First, clean up all related records
        console.log('Cleaning up related records...')
        
        // Delete from public schema tables
        await prisma.session.deleteMany({ where: { userId } })
        await prisma.apiKey.deleteMany({ where: { userId } })
        await prisma.emailLog.deleteMany({ where: { userId } })
        await prisma.emailQueue.deleteMany({ where: { userId } })
        await prisma.notification.deleteMany({ where: { userId } })
        await prisma.passwordResetToken.deleteMany({ where: { userId } })
        await prisma.emailVerificationToken.deleteMany({ where: { userId } })
        await prisma.invitationToken.deleteMany({ where: { userId } })
        await prisma.refreshToken.deleteMany({ where: { userId } })
        await prisma.auditLog.deleteMany({ where: { userId } })
        await prisma.userActivity.deleteMany({ where: { userId } })
        await prisma.systemLog.deleteMany({ where: { actorId: userId } })
        
        // Now delete the user using raw SQL with context set
        const deleteResult = await prisma.$queryRaw<{count: bigint}[]>`
          WITH context AS (
            SELECT set_config('app.current_org_id', ${orgId}, true) AS org_set,
                   set_config('app.current_user_id', ${currentUser.id}, true) AS user_set
          )
          DELETE FROM "User" 
          WHERE id = ${userId}
          RETURNING 1 as count
        `
        
        if (!deleteResult || deleteResult.length === 0) {
          throw new Error(`Could not delete user ${userId}`)
        }
        
        console.log(`Successfully deleted user with context: ${userId}`)
      }
    } catch (deleteError: any) {
      console.error('Failed to delete user:', deleteError)
      console.error('Error code:', deleteError?.code)
      console.error('Error meta:', deleteError?.meta)
      
      // If it's a P2025 error (record not found), the user might already be deleted
      if (deleteError?.code === 'P2025') {
        // Double-check if user exists
        const checkUser = await prisma.user.findUnique({
          where: { id: userId }
        })
        
        if (!checkUser) {
          // User is already gone, consider this a success
          console.log('User was already deleted')
          return NextResponse.json({
            message: 'User deleted successfully'
          })
        }
        
        // User exists but can't be deleted - there might be other constraints
        console.error('User exists but cannot be deleted. Checking for remaining references...')
        
        // Try to find what's blocking the deletion
        throw new Error(`Cannot delete user ${userId}: ${deleteError.message}`)
      }
      
      throw deleteError
    }

    // Log user deletion
    await auditService.log({
      eventType: AuditEventType.USER_DELETED,
      severity: AuditSeverity.HIGH,
      userId: currentUser.id,
      organizationId: currentUser.organizationId,
      entityType: 'user',
      entityId: userId,
      action: 'Deleted user account',
      details: {
        deletedUser: existingUser.email,
        deletedUserRole: existingUser.role
      },
      success: true
    })

    return NextResponse.json({
      message: 'User deleted successfully'
    })

  } catch (error: any) {
    console.error('User DELETE error:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta
    })
    
    // Return more detailed error for debugging
    return NextResponse.json(
      { 
        error: 'Failed to delete user',
        details: process.env.NODE_ENV === 'development' ? {
          message: error?.message,
          code: error?.code
        } : undefined
      },
      { status: 500 }
    )
  }
}