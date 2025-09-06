import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import { getSchemaName, queryAllSchemas } from '@/lib/db/schema-db'
import crypto from 'crypto'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/master/payments - List master payments (platform payments)
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || user.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized - Master access only' }, { status: 401 })
    }

    const url = new URL(request.url)
    const invoiceId = url.searchParams.get('invoiceId')
    const organizationId = url.searchParams.get('organizationId')
    const status = url.searchParams.get('status')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build where clause for SQL query
    let whereConditions: string[] = ['1=1']
    let queryParams: any[] = []
    let paramIndex = 1
    
    if (invoiceId) {
      whereConditions.push(`p."invoiceId" = $${paramIndex++}`)
      queryParams.push(invoiceId)
    }
    
    if (organizationId) {
      whereConditions.push(`p."organizationId" = $${paramIndex++}`)
      queryParams.push(organizationId)
    }
    
    if (status) {
      whereConditions.push(`p.status = $${paramIndex++}`)
      queryParams.push(status)
    }
    
    if (startDate) {
      whereConditions.push(`p."paymentDate" >= $${paramIndex++}`)
      queryParams.push(new Date(startDate))
    }
    
    if (endDate) {
      whereConditions.push(`p."paymentDate" <= $${paramIndex++}`)
      queryParams.push(new Date(endDate))
    }
    
    const whereClause = whereConditions.join(' AND ')
    
    // Query master payments with invoice and organization data
    const paymentsQuery = `
      SELECT 
        p.*,
        i."invoiceNumber",
        i."totalAmount" as "invoiceTotalAmount",
        i.status as "invoiceStatus",
        i."billingPeriodStart",
        i."billingPeriodEnd",
        o.id as "orgId",
        o.name as "orgName",
        o.slug as "orgSlug",
        u.id as "createdById",
        u.name as "createdByName",
        u.email as "createdByEmail"
      FROM master."MasterPayment" p
      LEFT JOIN master."MasterInvoice" i ON p."invoiceId" = i.id
      LEFT JOIN public."Organization" o ON p."organizationId" = o.id
      LEFT JOIN public."User" u ON p."createdById" = u.id
      WHERE ${whereClause}
      ORDER BY p."paymentDate" DESC
    `
    
    const payments = await prisma.$queryRawUnsafe<any[]>(paymentsQuery, ...queryParams)
    
    // Format payments for response
    const formattedPayments = payments.map(p => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      amount: Number(p.amount),
      currency: p.currency,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      processedDate: p.processedDate,
      status: p.status,
      transactionId: p.transactionId,
      processorFee: p.processorFee ? Number(p.processorFee) : 0,
      netAmount: p.netAmount ? Number(p.netAmount) : Number(p.amount),
      notes: p.notes,
      createdAt: p.createdAt,
      organization: {
        id: p.orgId,
        name: p.orgName,
        slug: p.orgSlug
      },
      invoice: {
        id: p.invoiceId,
        invoiceNumber: p.invoiceNumber,
        totalAmount: Number(p.invoiceTotalAmount),
        status: p.invoiceStatus,
        billingPeriodStart: p.billingPeriodStart,
        billingPeriodEnd: p.billingPeriodEnd
      },
      createdBy: p.createdById ? {
        id: p.createdById,
        name: p.createdByName,
        email: p.createdByEmail
      } : null
    }))

    // Calculate totals
    const totalAmount = formattedPayments.reduce((sum, payment) => sum + payment.amount, 0)
    const completedAmount = formattedPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, payment) => sum + payment.amount, 0)

    return NextResponse.json({
      success: true,
      payments: formattedPayments,
      summary: {
        total: formattedPayments.length,
        totalAmount,
        completedAmount,
        pendingAmount: totalAmount - completedAmount
      }
    })

  } catch (error) {
    console.error('❌ Master payments GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

// POST /api/master/payments - Record a master payment (from organization to platform)
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user || user.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized - Master access only' }, { status: 401 })
    }

    const body = await request.json()
    const { invoiceId, organizationId, amount, paymentMethod, transactionId, processorFee, notes, status } = body

    // Validate required fields
    if (!invoiceId || !amount || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: invoiceId, amount, paymentMethod' },
        { status: 400 }
      )
    }

    // Verify master invoice exists
    const invoiceResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT i.*, 
        (SELECT COALESCE(SUM(p.amount), 0) FROM master."MasterPayment" p WHERE p."invoiceId" = i.id AND p.status = 'completed')::numeric as "totalPaid",
        o.name as "orgName"
      FROM master."MasterInvoice" i
      LEFT JOIN public."Organization" o ON i."organizationId" = o.id
      WHERE i.id = $1
    `, invoiceId)
    
    if (invoiceResult.length === 0) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }
    
    const invoice = invoiceResult[0]

    // Calculate total paid amount including this payment
    const existingPaymentsTotal = Number(invoice.totalPaid || 0)
    const paymentAmount = parseFloat(amount)
    const totalPaid = existingPaymentsTotal + paymentAmount

    // Generate payment number
    const paymentNumber = `MPAY-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    const paymentDate = new Date()
    const netAmount = paymentAmount - (parseFloat(processorFee || '0') || 0)
    
    // Create the payment in the master schema
    const createPaymentQuery = `
      INSERT INTO master."MasterPayment" (
        id, "paymentNumber", "invoiceId", "organizationId", amount, currency, 
        "paymentMethod", "transactionId", "processorFee", "netAmount", 
        notes, status, "paymentDate", "processedDate", "createdById",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16
      ) RETURNING *
    `
    
    const paymentId = crypto.randomUUID()
    const paymentResult = await prisma.$queryRawUnsafe<any[]>(
      createPaymentQuery,
      paymentId,
      paymentNumber,
      invoiceId,
      organizationId || invoice.organizationId,
      paymentAmount,
      invoice.currency || 'USD',
      paymentMethod,
      transactionId || null,
      parseFloat(processorFee || '0') || 0,
      netAmount,
      notes || null,
      status || 'completed',
      paymentDate,
      status === 'completed' ? paymentDate : null,
      user.id,
      paymentDate
    )
    
    const payment = paymentResult[0]

    // Update invoice status if fully paid
    if (totalPaid >= Number(invoice.totalAmount)) {
      await prisma.$queryRawUnsafe(`
        UPDATE master."MasterInvoice"
        SET status = 'paid', "paidDate" = $1, "updatedAt" = $1
        WHERE id = $2
      `, new Date(), invoiceId)
      console.log(`✅ Master Invoice ${invoice.invoiceNumber} marked as paid`)
    } else if (totalPaid > 0) {
      // Partial payment
      await prisma.$queryRawUnsafe(`
        UPDATE master."MasterInvoice"
        SET status = 'partial', "updatedAt" = $1
        WHERE id = $2
      `, new Date(), invoiceId)
    }

    console.log(`✅ Master Payment recorded: ${payment.paymentNumber} for invoice ${invoice.invoiceNumber} from ${invoice.orgName}`)

    return NextResponse.json({
      success: true,
      payment: {
        ...payment,
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          organizationName: invoice.orgName
        }
      },
      message: 'Payment recorded successfully'
    })

  } catch (error) {
    console.error('❌ Master payments POST error:', error)
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    )
  }
}
