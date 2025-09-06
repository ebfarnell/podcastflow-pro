import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection, AuthenticatedRequest } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/types/auth'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'
import { AdApprovalServiceSchema } from '@/lib/services/ad-approval-service-schema'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

async function getHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await async params in Next.js 14.1.0
    const { id } = await params
    
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'GET',
        `/api/ad-approvals/${id}`,
        request
      )
    }
    
    // Get approval using schema-aware service
    const approval = await AdApprovalServiceSchema.getById(user.id, id)
    
    if (!approval) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(approval)
  } catch (error) {
    console.error('Error fetching approval:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approval' },
      { status: 500 }
    )
  }
}

async function putHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await async params in Next.js 14.1.0
    const { id } = await params
    
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if approval exists
    const existing = await AdApprovalServiceSchema.getById(user.id, id)
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      )
    }

    // Build update query
    const updateFields: string[] = []
    const updateParams: any[] = []
    let paramIndex = 1
    
    // Only allow updating certain fields
    const allowedFields = ['title', 'script', 'talkingPoints', 'priority', 'deadline', 'type', 'duration']
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`"${field}" = $${paramIndex++}`)
        updateParams.push(body[field])
      }
    }
    
    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }
    
    // Always update updatedAt
    updateFields.push(`"updatedAt" = NOW()`)
    updateParams.push(id)
    
    const updateQuery = `
      UPDATE "AdApproval"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `
    
    await querySchema(orgSlug, updateQuery, updateParams)
    
    // Get updated approval
    const approval = await AdApprovalServiceSchema.getById(user.id, id)
    
    return NextResponse.json(approval)
  } catch (error) {
    console.error('Error updating approval:', error)
    return NextResponse.json(
      { error: 'Failed to update approval' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await async params in Next.js 14.1.0
    const { id } = await params
    
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can delete
    if (user.role !== 'admin' && user.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if approval exists
    const existing = await AdApprovalServiceSchema.getById(user.id, id)
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      )
    }

    // Delete related data first, then approval
    // Delete comments
    await querySchema(orgSlug, `DELETE FROM "Comment" WHERE "adApprovalId" = $1`, [id])
    
    // Delete spot submissions
    await querySchema(orgSlug, `DELETE FROM "SpotSubmission" WHERE "adApprovalId" = $1`, [id])
    
    // Delete approval
    await querySchema(orgSlug, `DELETE FROM "AdApproval" WHERE id = $1`, [id])
    
    return NextResponse.json({ message: 'Approval deleted successfully' })
  } catch (error) {
    console.error('Error deleting approval:', error)
    return NextResponse.json(
      { error: 'Failed to delete approval' },
      { status: 500 }
    )
  }
}

// Use direct function export to fix production build issue
export const GET = async (request: NextRequest, context: { params: Promise<{ [key: string]: string }> }) => {
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
  
  return getHandler(authenticatedRequest, { params: context.params })
}

// Use direct function export to fix production build issue
export const PUT = async (request: NextRequest, context: { params: Promise<{ [key: string]: string }> }) => {
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
  
  return putHandler(authenticatedRequest, { params: context.params })
}