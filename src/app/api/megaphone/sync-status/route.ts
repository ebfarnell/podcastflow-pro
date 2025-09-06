import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { MegaphoneService } from '../../../../services/megaphoneService.server'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const status = await MegaphoneService.getSyncStatus(session.user.organizationId)

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error fetching Megaphone sync status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    )
  }
}