import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema, safeQuerySchema } from '@/lib/db/schema-db'
import { activityService } from '@/lib/activities/activity-service'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'

/**
 * GET /api/shows/[id]/assignments
 * Get all user assignments for a show
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: showId } = await params
    
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Get all assignments for this show
    const assignmentsQuery = `
      SELECT 
        stu."B" as user_id,
        stu."role" as assignment_role,
        stu."assignedAt" as assigned_at,
        stu."assignedBy" as assigned_by,
        u.id,
        u.name,
        u.email,
        u.avatar,
        u.role,
        assignedByUser.name as assigned_by_name
      FROM "_ShowToUser" stu
      INNER JOIN public."User" u ON stu."B" = u.id
      LEFT JOIN public."User" assignedByUser ON stu."assignedBy" = assignedByUser.id
      WHERE stu."A" = $1
      ORDER BY stu."assignedAt" DESC
    `
    
    const { data: assignments = [] } = await safeQuerySchema(orgSlug, assignmentsQuery, [showId])

    return NextResponse.json({
      showId,
      showName: shows[0].name,
      assignments: assignments.map(a => ({
        userId: a.user_id,
        name: a.name,
        email: a.email,
        avatar: a.avatar,
        userRole: a.role, // User's system role
        assignmentRole: a.assignment_role, // Role in the show (producer/talent)
        assignedAt: a.assigned_at,
        assignedBy: a.assigned_by,
        assignedByName: a.assigned_by_name
      }))
    })

  } catch (error) {
    console.error('Error fetching show assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/shows/[id]/assignments
 * Assign a user to a show
 * Body: { userId: string, role?: 'producer' | 'talent' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: showId } = await params
    
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin/master can assign users to shows
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    
    const { userId, role } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    
    // Validate role if provided
    if (role && !['producer', 'talent'].includes(role)) {
      return NextResponse.json({ error: 'Role must be either "producer" or "talent"' }, { status: 400 })
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

    // Verify user exists and belongs to the same organization
    const targetUser = await UserService.findById(userId)
    if (!targetUser || targetUser.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'User not found in organization' }, { status: 404 })
    }

    // Check if assignment already exists
    const existingQuery = `SELECT 1 FROM "_ShowToUser" WHERE "A" = $1 AND "B" = $2`
    const { data: existing = [] } = await safeQuerySchema(orgSlug, existingQuery, [showId, userId])
    
    if (existing.length > 0) {
      // Update existing assignment
      const updateQuery = `
        UPDATE "_ShowToUser" 
        SET "role" = $3, "assignedAt" = CURRENT_TIMESTAMP, "assignedBy" = $4
        WHERE "A" = $1 AND "B" = $2
      `
      await querySchema(orgSlug, updateQuery, [showId, userId, role || targetUser.role, user.id])
    } else {
      // Create new assignment
      const insertQuery = `
        INSERT INTO "_ShowToUser" ("A", "B", "role", "assignedBy")
        VALUES ($1, $2, $3, $4)
      `
      await querySchema(orgSlug, insertQuery, [showId, userId, role || targetUser.role, user.id])
    }

    // Log activity
    await activityService.logActivity({
      type: 'show',
      action: 'assigned_user_to_show',
      title: 'User Assignment',
      description: `Assigned ${targetUser.name} to show "${shows[0].name}" as ${role || targetUser.role}`,
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
        assignedUserId: userId,
        assignedUserName: targetUser.name,
        assignmentRole: role || targetUser.role
      }
    })

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.name} assigned to show ${shows[0].name}`,
      assignment: {
        showId,
        userId,
        role: role || targetUser.role,
        assignedAt: new Date().toISOString(),
        assignedBy: user.id
      }
    })

  } catch (error) {
    console.error('Error assigning user to show:', error)
    return NextResponse.json(
      { error: 'Failed to assign user' },
      { status: 500 }
    )
  }
}

