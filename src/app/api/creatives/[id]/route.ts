import { NextRequest, NextResponse } from 'next/server'
import { creativeService } from '@/services/creative-service'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

// Get a single creative
async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const creative = await creativeService.getById(params.id)
    
    if (!creative) {
      return NextResponse.json(
        { error: 'Creative not found' },
        { status: 404 }
      )
    }

    // Check organization access
    if (creative.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json(creative)
  } catch (error) {
    console.error('Error fetching creative:', error)
    return NextResponse.json(
      { error: 'Failed to fetch creative' },
      { status: 500 }
    )
  }
}

// Update a creative
async function handlePUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // First check if creative exists and user has access
    const existing = await creativeService.getById(params.id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Creative not found' },
        { status: 404 }
      )
    }

    if (existing.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const creative = await creativeService.update(params.id, {
      ...body,
      updatedBy: session.userId,
    })

    return NextResponse.json(creative)
  } catch (error) {
    console.error('Error updating creative:', error)
    return NextResponse.json(
      { error: 'Failed to update creative' },
      { status: 500 }
    )
  }
}

// Delete a creative
async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // First check if creative exists and user has access
    const existing = await creativeService.getById(params.id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Creative not found' },
        { status: 404 }
      )
    }

    if (existing.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Check if it's a soft delete (archive) or hard delete
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    if (hardDelete) {
      await creativeService.delete(params.id)
    } else {
      await creativeService.archive(params.id, session.userId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting creative:', error)
    return NextResponse.json(
      { error: 'Failed to delete creative' },
      { status: 500 }
    )
  }
}

// Export using direct function approach for production build compatibility
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleGET(request, { params })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handlePUT(request, { params })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleDELETE(request, { params })
}