import { NextRequest, NextResponse } from 'next/server'
import { reservationService } from '@/lib/reservations/reservation-service'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reservation = await reservationService.getReservationById(
      params.id,
      session.organizationId
    )

    return NextResponse.json({ reservation })
  } catch (error) {
    console.error('Error fetching reservation:', error)
    
    if (error instanceof Error && error.message === 'Reservation not found') {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch reservation' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    const updateData = {
      campaignId: body.campaignId,
      holdDuration: body.holdDuration,
      priority: body.priority,
      notes: body.notes
    }

    const reservation = await reservationService.updateReservation(
      params.id,
      session.organizationId,
      session.userId,
      updateData
    )

    return NextResponse.json({ reservation })
  } catch (error) {
    console.error('Error updating reservation:', error)
    
    if (error instanceof Error) {
      if (error.message === 'Reservation not found') {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
      }
      if (error.message === 'Only held reservations can be updated') {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to update reservation' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = body.reason || 'Cancelled by user'

    const reservation = await reservationService.cancelReservation(
      params.id,
      session.organizationId,
      session.userId,
      reason
    )

    return NextResponse.json({ reservation })
  } catch (error) {
    console.error('Error cancelling reservation:', error)
    
    if (error instanceof Error) {
      if (error.message === 'Reservation not found') {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
      }
      if (error.message === 'Only held reservations can be cancelled') {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to cancel reservation' },
      { status: 500 }
    )
  }
}