import { NextRequest, NextResponse } from 'next/server'
import { analyticsService } from '@/lib/analytics/analytics-service'
import { z } from 'zod'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// Schema for tracking analytics events
const trackEventSchema = z.object({
  eventType: z.enum(['download', 'stream', 'listen_start', 'listen_complete', 'rating', 'share']),
  episodeId: z.string().optional(),
  showId: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  platform: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = trackEventSchema.parse(body)
    
    // Get additional info from request
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
    const userAgent = request.headers.get('user-agent') || undefined
    const referer = request.headers.get('referer') || undefined
    
    // Track the event
    await analyticsService.trackEvent({
      ...validatedData,
      ipAddress,
      userAgent,
      referer
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error tracking analytics event:', error)
    return NextResponse.json(
      { error: 'Failed to track analytics event' },
      { status: 500 }
    )
  }
}

// Get analytics events (admin only)
export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { UserService } = await import('@/lib/auth/user-service')
    const user = await UserService.validateSession(authToken.value)
    if (!user || !['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const showId = searchParams.get('showId')
    const episodeId = searchParams.get('episodeId')
    const eventType = searchParams.get('eventType')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const prisma = (await import('@/lib/db/prisma')).default
    
    const where: any = {}
    if (showId) where.showId = showId
    if (episodeId) where.episodeId = episodeId
    if (eventType) where.eventType = eventType

    const [events, total] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
          episode: {
            select: {
              id: true,
              title: true,
              show: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }),
      prisma.analyticsEvent.count({ where })
    ])

    return NextResponse.json({
      events,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error fetching analytics events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics events' },
      { status: 500 }
    )
  }
}
