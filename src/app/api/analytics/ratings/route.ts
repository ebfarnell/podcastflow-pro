import { NextRequest, NextResponse } from 'next/server'
import { analyticsService } from '@/lib/analytics/analytics-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'
import { z } from 'zod'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


const ratingSchema = z.object({
  episodeId: z.string(),
  rating: z.number().min(1).max(5),
  review: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { UserService } = await import('@/lib/auth/user-service')
    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = ratingSchema.parse(body)
    
    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'POST',
        '/api/analytics/ratings',
        request
      )
    }

    await analyticsService.addRating({
      ...validatedData,
      userId: user.id
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error adding rating:', error)
    return NextResponse.json(
      { error: 'Failed to add rating' },
      { status: 500 }
    )
  }
}

// Get ratings for an episode
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const episodeId = searchParams.get('episodeId')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    if (!episodeId) {
      return NextResponse.json(
        { error: 'Episode ID is required' },
        { status: 400 }
      )
    }
    
    // Get session to determine organization
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { UserService } = await import('@/lib/auth/user-service')
    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'GET',
        '/api/analytics/ratings',
        request
      )
    }
    
    // Fetch ratings using schema-aware queries
    const ratingsQuery = `
      SELECT 
        er.*,
        u.id as user_id, u.name as user_name, u.avatar as user_avatar
      FROM "EpisodeRating" er
      LEFT JOIN public."User" u ON u.id = er."userId"
      WHERE er."episodeId" = $1
      ORDER BY er."createdAt" DESC
      LIMIT $2 OFFSET $3
    `
    const ratingsRaw = await querySchema<any>(orgSlug, ratingsQuery, [episodeId, limit, offset])
    
    // Count total
    const countQuery = `SELECT COUNT(*) as count FROM "EpisodeRating" WHERE "episodeId" = $1`
    const countResult = await querySchema<any>(orgSlug, countQuery, [episodeId])
    const total = parseInt(countResult[0]?.count || '0')
    
    // Transform to match expected format
    const ratings = ratingsRaw.map(rating => ({
      ...rating,
      user: rating.user_id ? {
        id: rating.user_id,
        name: rating.user_name,
        avatar: rating.user_avatar
      } : null
    }))
    
    return NextResponse.json({
      ratings,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error fetching ratings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ratings' },
      { status: 500 }
    )
  }
}
