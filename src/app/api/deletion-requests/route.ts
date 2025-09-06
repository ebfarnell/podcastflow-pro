import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/deletion-requests - List deletion requests with optional status filter
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Deletion requests API called')
    
    const session = await getSessionFromCookie(request)
    console.log('📋 Session data:', { userId: session?.userId, role: session?.role, organizationId: session?.organizationId })
    
    if (!session) {
      console.log('❌ No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.organizationId) {
      console.log('❌ No organizationId in session')
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    // Only admin and master can view deletion requests
    if (!['admin', 'master'].includes(session.role)) {
      console.log('❌ User role not authorized:', session.role)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const countOnly = searchParams.get('countOnly') === 'true'
    console.log('🔍 Query params:', { status, countOnly })

    // Build query conditions
    const where: any = {
      organizationId: session.organizationId
    }

    // Add status filter if provided
    if (status) {
      where.status = status
    }

    console.log('🔍 Query where clause:', where)
    console.log('🔍 Checking prisma client access...')
    
    if (!prisma) {
      console.log('❌ Prisma client is null/undefined')
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 })
    }

    if (!prisma.deletionRequest) {
      console.log('❌ prisma.deletionRequest is undefined')
      console.log('🔍 Available prisma models:', Object.keys(prisma).filter(key => !key.startsWith('_')))
      return NextResponse.json({ error: 'Database model not found' }, { status: 500 })
    }

    console.log('✅ Prisma client and deletionRequest model available')

    // If countOnly is true, just return the count
    if (countOnly) {
      console.log('🔍 Executing count query...')
      const count = await prisma.deletionRequest.count({ where })
      console.log(`✅ Count query successful. Found ${count} deletion requests`)
      return NextResponse.json({ count })
    }

    // Fetch deletion requests with proper relations
    console.log('🔍 Executing query...')
    const deletionRequests = await prisma.deletionRequest.findMany({
      where,
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        requestedAt: 'desc'
      }
    })

    console.log(`✅ Query executed successfully. Found ${deletionRequests.length} deletion requests`)
    console.log('🔍 Raw deletion requests:', deletionRequests.map(r => ({ id: r.id, status: r.status, entityType: r.entityType })))

    // Transform data to match expected frontend interface
    console.log('🔄 Transforming data...')
    const transformedRequests = deletionRequests.map(request => ({
      id: request.id,
      entityType: request.entityType,
      entityId: request.entityId,
      entityName: request.entityName,
      entityValue: null, // This would need to be calculated based on entity type
      requestedBy: request.requestedBy,
      requester: request.requester,
      requestedAt: request.requestedAt.toISOString(),
      reviewedBy: request.reviewedBy,
      reviewer: request.reviewer,
      reviewedAt: request.reviewedAt?.toISOString(),
      status: request.status as 'pending' | 'approved' | 'denied' | 'cancelled',
      reason: request.reason,
      reviewNotes: request.reviewNotes
    }))

    console.log('✅ Data transformation complete. Returning response')
    return NextResponse.json(transformedRequests)

  } catch (error) {
    console.error('❌ Error fetching deletion requests:', error)
    console.error('❌ Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch deletion requests',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

// POST /api/deletion-requests - Create a new deletion request
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 POST /api/deletion-requests called')
    
    const session = await getSessionFromCookie(request)
    console.log('📋 Session:', { userId: session?.userId, role: session?.role, organizationId: session?.organizationId })
    
    if (!session) {
      console.log('❌ No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.organizationId) {
      console.log('❌ No organizationId in session')
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const body = await request.json()
    console.log('📤 Request body:', body)
    
    const { entityType, entityId, entityName, reason } = body

    // Validate required fields
    if (!entityType || !entityId || !entityName) {
      console.log('❌ Missing required fields:', { entityType, entityId, entityName })
      return NextResponse.json(
        { 
          error: 'Missing required fields: entityType, entityId, entityName',
          received: { entityType: !!entityType, entityId: !!entityId, entityName: !!entityName }
        },
        { status: 400 }
      )
    }

    // Validate entity type
    const validEntityTypes = ['campaign', 'advertiser', 'agency', 'show', 'episode', 'order']
    if (!validEntityTypes.includes(entityType)) {
      console.log('❌ Invalid entity type:', entityType)
      return NextResponse.json(
        { error: 'Invalid entity type', validTypes: validEntityTypes },
        { status: 400 }
      )
    }

    console.log('✅ Validation passed. Creating deletion request...')
    console.log('📝 Deletion request data:', {
      entityType,
      entityId,
      entityName,
      requestedBy: session.userId,
      organizationId: session.organizationId,
      reason: reason || null,
      status: 'pending'
    })

    // Create the deletion request
    const deletionRequest = await prisma.deletionRequest.create({
      data: {
        entityType,
        entityId,
        entityName,
        requestedBy: session.userId,
        organizationId: session.organizationId!,
        reason: reason || null,
        status: 'pending'
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })
    
    console.log('✅ Deletion request created successfully:', deletionRequest.id)

    // Transform response to match expected format
    const transformedRequest = {
      id: deletionRequest.id,
      entityType: deletionRequest.entityType,
      entityId: deletionRequest.entityId,
      entityName: deletionRequest.entityName,
      entityValue: null,
      requestedBy: deletionRequest.requestedBy,
      requester: deletionRequest.requester,
      requestedAt: deletionRequest.requestedAt.toISOString(),
      status: deletionRequest.status as 'pending' | 'approved' | 'denied' | 'cancelled',
      reason: deletionRequest.reason,
      reviewNotes: null
    }

    return NextResponse.json(transformedRequest, { status: 201 })

  } catch (error) {
    console.error('❌ Error creating deletion request:', error)
    console.error('❌ Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to create deletion request',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}