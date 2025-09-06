import { NextRequest, NextResponse } from 'next/server'
import { creativeService } from '@/services/creative-service'
import { getSessionFromCookie } from '@/lib/auth/session-helper'

// Force this route to be dynamic
export const dynamic = 'force-dynamic'

// Search creatives for autocomplete/dropdown
export async function GET(request: NextRequest) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!query) {
      return NextResponse.json({ results: [] })
    }

    const results = await creativeService.search(
      query,
      session.organizationId,
      limit
    )

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error searching creatives:', error)
    return NextResponse.json(
      { error: 'Failed to search creatives' },
      { status: 500 }
    )
  }
}