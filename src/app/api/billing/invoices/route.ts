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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const orderId = searchParams.get('orderId')
    const search = searchParams.get('search')

    const offset = (page - 1) * limit

    // Build filters
    const filters: any = {}
    if (status) filters.status = status
    if (search) {
      filters.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get invoices with order filter if provided
    const { data: invoices, error } = await safeQuerySchema(orgSlug, async (db) => {
      if (orderId) {
        // Get invoices for specific order through invoice items
        const [items, total] = await Promise.all([
          db.invoice.findMany({
            where: {
              ...filters,
              invoiceItems: {
                some: { orderId }
              }
            },
            include: {
              invoiceItems: {
                include: {
                  order: {
                    select: { id: true, orderNumber: true }
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
          }),
          db.invoice.count({
            where: {
              ...filters,
              invoiceItems: {
                some: { orderId }
              }
            }
          })
        ])
        return { items, total }
      } else {
        const [items, total] = await Promise.all([
          db.invoice.findMany({
            where: filters,
            include: {
              invoiceItems: {
                include: {
                  order: {
                    select: { id: true, orderNumber: true }
                  }
                },
                take: 1
              }
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
          }),
          db.invoice.count({ where: filters })
        ])
        return { items, total }
      }
    })

    if (error) {
      console.error('Error fetching invoices:', error)
      return NextResponse.json({ invoices: [], total: 0 })
    }

    return NextResponse.json({
      invoices: invoices?.items || [],
      total: invoices?.total || 0,
      page,
      limit
    })
  } catch (error) {
    console.error('Error in GET /api/billing/invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can generate invoices
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body = await request.json()
    const { orderId, lineItems, billingPeriod, dueDate, notes } = body

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const result = await billingService.generateInvoice(orgSlug, {
      orderId,
      lineItems,
      billingPeriod,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      invoiceId: result.invoiceId
    })
  } catch (error) {
    console.error('Error in POST /api/billing/invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}