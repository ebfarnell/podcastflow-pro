import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'
import { billingService } from '@/lib/workflow/billing-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const isActive = searchParams.get('active') !== 'false'

    // Get pre-bill advertisers
    const { data: preBillAdvertisers, error } = await safeQuerySchema(orgSlug, async (db) => {
      return db.preBillAdvertiser.findMany({
        where: {
          ...(isActive ? { isActive: true } : {})
        },
        include: {
          advertiser: {
            select: { id: true, name: true }
          },
          flaggedBy: {
            select: { id: true, name: true }
          }
        },
        orderBy: { flaggedDate: 'desc' }
      })
    })

    if (error) {
      console.error('Error fetching pre-bill advertisers:', error)
      return NextResponse.json({ advertisers: [] })
    }

    return NextResponse.json({ advertisers: preBillAdvertisers || [] })
  } catch (error) {
    console.error('Error in GET /api/billing/pre-bill:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can flag advertisers
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body = await request.json()
    const { advertiserId, reason, notes } = body

    if (!advertiserId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await billingService.flagAdvertiserForPreBill(
      orgSlug,
      advertiserId,
      reason,
      session.userId,
      notes
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/billing/pre-bill:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can unflag advertisers
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const advertiserId = searchParams.get('advertiserId')

    if (!advertiserId) {
      return NextResponse.json({ error: 'Advertiser ID is required' }, { status: 400 })
    }

    // Get organization ID
    const { data: advertiser } = await safeQuerySchema(orgSlug, async (db) => {
      return db.advertiser.findUnique({
        where: { id: advertiserId },
        select: { organizationId: true }
      })
    })

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser not found' }, { status: 404 })
    }

    // Deactivate pre-bill flag
    const { error } = await safeQuerySchema(orgSlug, async (db) => {
      await db.preBillAdvertiser.update({
        where: {
          organizationId_advertiserId: {
            organizationId: advertiser.organizationId,
            advertiserId
          }
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      })
    })

    if (error) {
      console.error('Error removing pre-bill flag:', error)
      return NextResponse.json({ error: 'Failed to remove pre-bill flag' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/billing/pre-bill:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}