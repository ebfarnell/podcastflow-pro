import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id
    const searchParams = request.nextUrl.searchParams
    
    // Query parameters
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const offset = (page - 1) * pageSize

    // Build WHERE clause
    const whereConditions = []
    const queryParams = []
    let paramIndex = 1

    // Filter by campaign (through InvoiceItem)
    whereConditions.push(`
      i."id" IN (
        SELECT DISTINCT ii."invoiceId" 
        FROM "InvoiceItem" ii 
        WHERE ii."campaignId" = $${paramIndex}
      )
    `)
    queryParams.push(campaignId)
    paramIndex++

    // Also include invoices from the campaign's order if it exists
    whereConditions.push(`
      i."orderId" IN (
        SELECT "orderId" 
        FROM "Campaign" 
        WHERE "id" = $${paramIndex} 
        AND "orderId" IS NOT NULL
      )
    `)
    queryParams.push(campaignId)
    paramIndex++

    // Status filter
    if (status) {
      whereConditions.push(`i."status" = $${paramIndex}`)
      queryParams.push(status)
      paramIndex++
    }

    // Date range filters
    if (from) {
      whereConditions.push(`i."issueDate" >= $${paramIndex}::timestamp`)
      queryParams.push(from)
      paramIndex++
    }
    if (to) {
      whereConditions.push(`i."issueDate" <= $${paramIndex}::timestamp`)
      queryParams.push(to)
      paramIndex++
    }

    // Combine WHERE conditions
    const whereClause = whereConditions.length > 0 
      ? `WHERE (${whereConditions.slice(0, 2).join(' OR ')})${whereConditions.slice(2).map(w => ` AND ${w}`).join('')}`
      : ''

    // Query invoices with pagination
    const invoicesQuery = `
      SELECT 
        i."id",
        i."invoiceNumber",
        i."issueDate",
        i."dueDate",
        i."paidDate",
        i."status",
        i."amount",
        i."taxAmount",
        i."discountAmount",
        i."totalAmount",
        i."currency",
        i."description",
        i."billingPeriod",
        i."notes",
        i."orderId",
        i."advertiserId",
        i."agencyId",
        i."pdfUrl",
        i."createdAt",
        i."updatedAt",
        COALESCE(i."totalAmount", i."amount") as "displayAmount",
        CASE 
          WHEN i."status" = 'paid' THEN 0
          WHEN i."status" = 'void' THEN 0
          ELSE COALESCE(i."totalAmount", i."amount") - COALESCE(
            (SELECT SUM(p."amount") 
             FROM "Payment" p 
             WHERE p."invoiceId" = i."id"), 0
          )
        END as "balance",
        (
          SELECT json_agg(json_build_object(
            'id', ii."id",
            'description', ii."description",
            'quantity', ii."quantity",
            'unitPrice', ii."unitPrice",
            'amount', ii."amount",
            'campaignId', ii."campaignId"
          ))
          FROM "InvoiceItem" ii
          WHERE ii."invoiceId" = i."id"
        ) as "lineItems",
        (
          SELECT json_agg(json_build_object(
            'id', p."id",
            'amount', p."amount",
            'paymentDate', p."paymentDate",
            'paymentMethod', p."paymentMethod",
            'referenceNumber', p."referenceNumber"
          ))
          FROM "Payment" p
          WHERE p."invoiceId" = i."id"
        ) as "payments"
      FROM "Invoice" i
      ${whereClause}
      ORDER BY i."issueDate" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    queryParams.push(pageSize, offset)

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT i."id") as count
      FROM "Invoice" i
      ${whereClause}
    `
    const countParams = queryParams.slice(0, -2) // Remove limit and offset

    // Execute queries
    const { data: invoices, error: invoicesError } = await safeQuerySchema(
      session.organizationSlug,
      invoicesQuery,
      queryParams
    )

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError)
      return NextResponse.json({ 
        invoices: [], 
        pagination: { total: 0, page, pageSize, totalPages: 0 },
        totals: { issued: 0, paid: 0, outstanding: 0 }
      })
    }

    const { data: countResult, error: countError } = await safeQuerySchema(
      session.organizationSlug,
      countQuery,
      countParams
    )

    const total = countResult?.[0]?.count || 0
    const totalPages = Math.ceil(total / pageSize)

    // Calculate totals
    const totalsQuery = `
      SELECT 
        SUM(CASE WHEN i."status" != 'void' THEN COALESCE(i."totalAmount", i."amount") ELSE 0 END) as "totalIssued",
        SUM(CASE WHEN i."status" = 'paid' THEN COALESCE(i."totalAmount", i."amount") ELSE 0 END) as "totalPaid",
        SUM(
          CASE 
            WHEN i."status" NOT IN ('paid', 'void') THEN 
              COALESCE(i."totalAmount", i."amount") - COALESCE(
                (SELECT SUM(p."amount") 
                 FROM "Payment" p 
                 WHERE p."invoiceId" = i."id"), 0
              )
            ELSE 0
          END
        ) as "totalOutstanding"
      FROM "Invoice" i
      ${whereClause}
    `

    const { data: totalsResult, error: totalsError } = await safeQuerySchema(
      session.organizationSlug,
      totalsQuery,
      countParams
    )

    const totals = {
      issued: totalsResult?.[0]?.totalIssued || 0,
      paid: totalsResult?.[0]?.totalPaid || 0,
      outstanding: totalsResult?.[0]?.totalOutstanding || 0
    }

    return NextResponse.json({
      invoices: invoices || [],
      pagination: {
        total,
        page,
        pageSize,
        totalPages
      },
      totals
    })
  } catch (error) {
    console.error('Error in campaign invoices API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      invoices: [],
      pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
      totals: { issued: 0, paid: 0, outstanding: 0 }
    }, { status: 500 })
  }
}