import { NextRequest, NextResponse } from 'next/server'
import { reservationService } from '@/lib/reservations/reservation-service'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow master and admin roles to manually run expiration
    if (session.role !== 'master' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const result = await reservationService.expireReservations()

    return NextResponse.json({
      message: 'Expiration process completed',
      expiredCount: result.expiredCount
    })
  } catch (error) {
    console.error('Error running reservation expiration:', error)
    return NextResponse.json(
      { error: 'Failed to run expiration process' },
      { status: 500 }
    )
  }
}