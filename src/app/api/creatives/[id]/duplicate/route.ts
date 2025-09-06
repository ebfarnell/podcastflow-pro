import { NextRequest, NextResponse } from 'next/server'
import { creativeService } from '@/services/creative-service'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

// Duplicate a creative
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const newName = body.name

    // Check if creative exists and user has access
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

    const duplicate = await creativeService.duplicate(
      params.id,
      session.userId,
      newName
    )

    return NextResponse.json(duplicate, { status: 201 })
  } catch (error) {
    console.error('Error duplicating creative:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate creative' },
      { status: 500 }
    )
  }
}