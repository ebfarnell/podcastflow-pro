import { NextRequest, NextResponse } from 'next/server'
import { reservationService } from '@/lib/reservations/reservation-service'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    
    let dateRange: { start: Date; end: Date } | undefined
    
    if (searchParams.get('startDate') && searchParams.get('endDate')) {
      dateRange = {
        start: new Date(searchParams.get('startDate')!),
        end: new Date(searchParams.get('endDate')!)
      }
    }

    const stats = await reservationService.getReservationStats(
      session.organizationId,
      dateRange
    )

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error fetching reservation stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservation statistics' },
      { status: 500 }
    )
  }
}