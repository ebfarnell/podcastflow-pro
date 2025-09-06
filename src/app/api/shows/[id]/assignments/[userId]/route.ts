import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import { activityService } from '@/lib/activities/activity-service'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/shows/[id]/assignments/[userId]
 * Remove a user assignment from a show
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: showId, userId } = await params
    
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin/master can unassign users from shows
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get organization schema
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify show exists
    const showQuery = `SELECT id, name FROM "Show" WHERE id = $1`
    const { data: shows = [] } = await safeQuerySchema(orgSlug, showQuery, [showId])
    
    if (shows.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    // Get user details for logging
    const targetUser = await UserService.findById(userId)
    const userName = targetUser?.name || 'Unknown User'

    // Delete the assignment
    const deleteQuery = `DELETE FROM "_ShowToUser" WHERE "A" = $1 AND "B" = $2`
    await querySchema(orgSlug, deleteQuery, [showId, userId])

    // Log activity
    await activityService.logActivity({
      type: 'show',
      action: 'unassigned_user_from_show',
      title: 'User Unassignment',
      description: `Removed ${userName} from show "${shows[0].name}"`,
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      targetType: 'show',
      targetId: showId,
      targetName: shows[0].name,
      organizationId: user.organizationId,
      showId: showId,
      metadata: {
        unassignedUserId: userId,
        unassignedUserName: userName
      }
    })

    return NextResponse.json({
      success: true,
      message: `User ${userName} removed from show ${shows[0].name}`
    })

  } catch (error) {
    console.error('Error removing user from show:', error)
    return NextResponse.json(
      { error: 'Failed to remove user' },
      { status: 500 }
    )
  }
}