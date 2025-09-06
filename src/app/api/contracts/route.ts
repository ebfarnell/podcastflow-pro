import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'
import { ContractService } from '@/lib/workflow/contract-service'

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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const advertiserId = searchParams.get('advertiserId')
    const campaignId = searchParams.get('campaignId')
    const orderId = searchParams.get('orderId')
    const search = searchParams.get('search')

    const offset = (page - 1) * limit

    // Build filters
    const filters: any = {}
    if (status) filters.status = status
    if (advertiserId) filters.advertiserId = advertiserId
    if (campaignId) filters.campaignId = campaignId
    if (orderId) filters.orderId = orderId
    if (search) {
      filters.OR = [
        { contractNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get contracts
    const { data: contracts, error } = await safeQuerySchema(orgSlug, async (db) => {
      const [items, total] = await Promise.all([
        db.contract.findMany({
          where: filters,
          include: {
            advertiser: {
              select: { id: true, name: true }
            },
            agency: {
              select: { id: true, name: true }
            },
            campaign: {
              select: { id: true, name: true }
            },
            order: {
              select: { id: true, orderNumber: true }
            },
            executedBy: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit
        }),
        db.contract.count({ where: filters })
      ])

      return { items, total }
    })

    if (error) {
      console.error('Error fetching contracts:', error)
      return NextResponse.json({ contracts: [], total: 0 })
    }

    return NextResponse.json({
      contracts: contracts?.items || [],
      total: contracts?.total || 0,
      page,
      limit
    })
  } catch (error) {
    console.error('Error in GET /api/contracts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can generate contracts
    if (!['admin', 'master', 'sales'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body = await request.json()
    const { orderId, templateId, variables } = body

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const contractService = new ContractService()
    const result = await contractService.generateContract(orgSlug, {
      orderId,
      templateId,
      variables
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      contractId: result.contractId,
      documentUrl: result.documentUrl
    })
  } catch (error) {
    console.error('Error in POST /api/contracts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}