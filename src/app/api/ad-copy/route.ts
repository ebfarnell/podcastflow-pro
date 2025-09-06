import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { SchemaModels, getUserOrgSlug } from '@/lib/db/schema-db'
import { randomUUID } from 'crypto'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/ad-copy - List ad copy for user's organization
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization context
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '25')
    const status = url.searchParams.get('status')
    const campaignId = url.searchParams.get('campaignId')
    const type = url.searchParams.get('type')

    // Build where clause
    const where: any = {}
    if (status) where.status = status
    if (campaignId) where.campaignId = campaignId
    if (type) where.type = type

    // For now, return mock data as the table might not exist in schemas yet
    const mockAdCopy = [
      {
        id: 'ac1',
        campaignId: 'camp1',
        title: 'Host Read Ad - Spring Sale',
        content: 'Mention our amazing spring sale with 30% off all products. Visit our website today!',
        type: 'host_read',
        status: 'approved',
        duration: null,
        instructions: 'Read naturally, emphasize the discount',
        callToAction: 'Visit our website today!',
        targetUrl: 'https://example.com/spring-sale',
        keywords: ['spring', 'sale', 'discount'],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'ac2',
        campaignId: 'camp2',
        title: 'Pre-Produced Spot - Brand Awareness',
        content: 'Professional pre-produced advertisement for brand awareness campaign.',
        type: 'pre_produced',
        status: 'pending_review',
        duration: 30,
        instructions: 'Play during mid-roll break',
        callToAction: 'Learn more at our website',
        targetUrl: 'https://example.com',
        keywords: ['brand', 'awareness', 'quality'],
        version: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]

    return NextResponse.json({
      adCopy: mockAdCopy,
      total: mockAdCopy.length,
      page,
      hasMore: false
    })

  } catch (error) {
    console.error('Ad copy list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ad copy' },
      { status: 500 }
    )
  }
}

// POST /api/ad-copy - Create new ad copy
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || !['master', 'admin', 'sales', 'producer'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      campaignId,
      title,
      content,
      type,
      duration,
      instructions,
      callToAction,
      targetUrl,
      keywords
    } = body

    // Validate required fields
    if (!title || !content || !campaignId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, campaignId, type' },
        { status: 400 }
      )
    }

    // Create new ad copy
    const newAdCopy = {
      id: `ac_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`,
      campaignId,
      title,
      content,
      type,
      status: 'draft',
      duration: duration || null,
      instructions: instructions || null,
      callToAction: callToAction || null,
      targetUrl: targetUrl || null,
      keywords: keywords || [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id
    }

    // In a real implementation, save to database
    // For now, return the created object
    return NextResponse.json({
      success: true,
      adCopy: newAdCopy
    }, { status: 201 })

  } catch (error) {
    console.error('Ad copy creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create ad copy' },
      { status: 500 }
    )
  }
}
