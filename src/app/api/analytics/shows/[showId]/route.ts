import { NextRequest, NextResponse } from 'next/server'
import { analyticsService } from '@/lib/analytics/analytics-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { showId: string } }
) {
  try {
    const showId = params.showId
    const { searchParams } = new URL(request.url)
    const periodType = searchParams.get('periodType') as 'daily' | 'weekly' | 'monthly' | 'yearly' || 'daily'
    const startDate = searchParams.get('startDate')
    
    if (!showId) {
      return NextResponse.json(
        { error: 'Show ID is required' },
        { status: 400 }
      )
    }
    
    const analytics = await analyticsService.getShowAnalytics(
      showId, 
      periodType,
      startDate ? new Date(startDate) : undefined
    )
    
    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Error fetching show analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch show analytics' },
      { status: 500 }
    )
  }
}