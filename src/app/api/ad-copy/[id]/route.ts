import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/ad-copy/[id] - Get specific ad copy
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const adCopyId = params.id

    // For now, return mock data based on ID
    const mockAdCopy = {
      id: adCopyId,
      campaignId: 'camp1',
      title: 'Host Read Ad - Spring Sale',
      content: 'Mention our amazing spring sale with 30% off all products. Visit our website today! This is a great opportunity for listeners to save money while getting high-quality products they love.',
      type: 'host_read',
      status: 'approved',
      duration: null,
      instructions: 'Read naturally, emphasize the discount percentage, and speak enthusiastically about the products',
      callToAction: 'Visit our website today!',
      targetUrl: 'https://example.com/spring-sale',
      keywords: ['spring', 'sale', 'discount', 'products', 'savings'],
      version: 1,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
      createdBy: user.id,
      approvedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      approvedBy: user.id
    }

    return NextResponse.json(mockAdCopy)

  } catch (error) {
    console.error('Ad copy fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ad copy' },
      { status: 500 }
    )
  }
}

// PUT /api/ad-copy/[id] - Update ad copy
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const adCopyId = params.id

    // Get organization context
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Validate that ad copy exists and belongs to user's organization
    // In a real implementation, check database first

    // Create updated ad copy object
    const updatedAdCopy = {
      id: adCopyId,
      ...body,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
      // Increment version if content changed
      version: body.content ? (body.version || 1) + 1 : body.version || 1
    }

    // In a real implementation, save to database
    return NextResponse.json({
      success: true,
      adCopy: updatedAdCopy
    })

  } catch (error) {
    console.error('Ad copy update error:', error)
    return NextResponse.json(
      { error: 'Failed to update ad copy' },
      { status: 500 }
    )
  }
}

// DELETE /api/ad-copy/[id] - Delete ad copy
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || !['master', 'admin', 'sales'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adCopyId = params.id

    // Get organization context
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Validate that ad copy exists and belongs to user's organization
    // In a real implementation, check database first

    // Check if ad copy is in use (has active campaigns)
    // For now, just check if status is 'active'
    // In real implementation, check for dependencies

    // In a real implementation, delete from database
    return NextResponse.json({
      success: true,
      message: 'Ad copy deleted successfully'
    })

  } catch (error) {
    console.error('Ad copy deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete ad copy' },
      { status: 500 }
    )
  }
}
