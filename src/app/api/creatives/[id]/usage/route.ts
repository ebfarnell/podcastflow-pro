import { NextRequest, NextResponse } from 'next/server'
import { creativeService } from '@/services/creative-service'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

// Get usage analytics for a creative
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if creative exists and user has access
    const creative = await creativeService.getById(params.id)
    if (!creative) {
      return NextResponse.json(
        { error: 'Creative not found' },
        { status: 404 }
      )
    }

    if (creative.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get date range from query params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateRange = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate),
    } : undefined

    const usage = await creativeService.getUsageAnalytics(params.id, dateRange)

    return NextResponse.json(usage)
  } catch (error) {
    console.error('Error fetching creative usage:', error)
    return NextResponse.json(
      { error: 'Failed to fetch creative usage' },
      { status: 500 }
    )
  }
}

// Track usage of a creative
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if creative exists and user has access
    const creative = await creativeService.getById(params.id)
    if (!creative) {
      return NextResponse.json(
        { error: 'Creative not found' },
        { status: 404 }
      )
    }

    if (creative.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate required fields
    if (!body.entityType || !body.entityId || !body.startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: entityType, entityId, startDate' },
        { status: 400 }
      )
    }

    const usage = await creativeService.trackUsage({
      creativeId: params.id,
      entityType: body.entityType,
      entityId: body.entityId,
      entityName: body.entityName,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      createdBy: session.userId,
    })

    return NextResponse.json(usage, { status: 201 })
  } catch (error) {
    console.error('Error tracking creative usage:', error)
    return NextResponse.json(
      { error: 'Failed to track creative usage' },
      { status: 500 }
    )
  }
}