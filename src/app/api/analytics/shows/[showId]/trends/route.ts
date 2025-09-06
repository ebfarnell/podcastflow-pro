import { NextRequest, NextResponse } from 'next/server'
import { analyticsService } from '@/lib/analytics/analytics-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { showId: string } }
) {
  try {
    const showId = params.showId
    const { searchParams } = new URL(request.url)
    const metric = searchParams.get('metric') as 'downloads' | 'streams' | 'listeners' | 'revenue' || 'downloads'
    const periodType = searchParams.get('periodType') as 'daily' | 'weekly' | 'monthly' || 'daily'
    const periods = parseInt(searchParams.get('periods') || '7')
    
    if (!showId) {
      return NextResponse.json(
        { error: 'Show ID is required' },
        { status: 400 }
      )
    }
    
    const trends = await analyticsService.getAnalyticsTrends(
      showId,
      metric,
      periodType,
      periods
    )
    
    return NextResponse.json({ trends })
  } catch (error) {
    console.error('Error fetching analytics trends:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics trends' },
      { status: 500 }
    )
  }
}