import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { UserService } from '@/lib/auth/user-service'
import prisma from '@/lib/db/prisma'
import crypto from 'crypto'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// POST /api/master/invoices - Create new master invoice (platform invoice to organization)
export async function POST(request: NextRequest) {
  try {
    // Check authentication and master role
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
    const { 
      organizationId, 
      billingPeriodStart, 
      billingPeriodEnd,
      dueDate,
      planName,
      planPrice,
      userCount,
      campaignCount,
      storageUsedGB,
      additionalCharges,
      additionalChargesDescription,
      credits,
      creditsDescription,
      taxRate,
      notes 
    } = body

    // Validate required fields
    if (!organizationId || !billingPeriodStart || !billingPeriodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationId, billingPeriodStart, billingPeriodEnd' },
        { status: 400 }
      )
    }

    // Verify organization exists and get billing details
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: { users: true }
        }
      }
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get billing plan details
    const billingPlan = await prisma.billingPlan.findUnique({
      where: { name: organization.plan || 'professional' }
    })

    // Generate invoice number
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const timestamp = Date.now().toString().slice(-6)
    const invoiceNumber = `MINV-${year}-${month}-${timestamp}`

    // Calculate amounts
    const basePrice = planPrice || billingPlan?.monthlyPrice || 299
    const addCharges = additionalCharges || 0
    const creditAmount = credits || 0
    const subtotal = basePrice + addCharges - creditAmount
    const taxPercent = taxRate || 0
    const taxAmount = subtotal * (taxPercent / 100)
    const totalAmount = subtotal + taxAmount

    // Create the invoice in master schema
    const createInvoiceQuery = `
      INSERT INTO master."MasterInvoice" (
        id, "invoiceNumber", "organizationId", "billingPeriodStart", "billingPeriodEnd",
        "dueDate", "issueDate", "planName", "planPrice", "userCount", "campaignCount",
        "storageUsedGB", "additionalCharges", "additionalChargesDescription",
        "credits", "creditsDescription", "subtotal", "taxRate", "taxAmount",
        "totalAmount", status, notes, "createdById", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $24
      ) RETURNING *
    `

    const invoiceId = crypto.randomUUID()
    const now = new Date()
    const dueDateValue = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    
    const invoiceResult = await prisma.$queryRawUnsafe<any[]>(
      createInvoiceQuery,
      invoiceId,
      invoiceNumber,
      organizationId,
      new Date(billingPeriodStart),
      new Date(billingPeriodEnd),
      dueDateValue,
      now,
      planName || billingPlan?.name || organization.plan || 'professional',
      basePrice,
      userCount || organization._count.users || 0,
      campaignCount || 0, // Would need to query org schema for actual count
      storageUsedGB || 0,
      addCharges,
      additionalChargesDescription || null,
      creditAmount,
      creditsDescription || null,
      subtotal,
      taxPercent,
      taxAmount,
      totalAmount,
      'pending',
      notes || null,
      user.id,
      now
    )

    const invoice = invoiceResult[0]

    console.log('✅ Master Invoice created:', invoice.invoiceNumber)

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        organization: {
          id: organization.id,
          name: organization.name,
          email: organization.email
        }
      },
      message: 'Master invoice created successfully'
    })

  } catch (error) {
    console.error('❌ Master invoices POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

// GET /api/master/invoices - List master invoices
export async function GET(request: NextRequest) {
  try {
    // Check authentication and master role
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
    const organizationId = url.searchParams.get('organizationId')
    const status = url.searchParams.get('status')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build where clause
    let whereConditions: string[] = ['1=1']
    let queryParams: any[] = []
    let paramIndex = 1
    
    if (organizationId) {
      whereConditions.push(`i."organizationId" = $${paramIndex++}`)
      queryParams.push(organizationId)
    }
    
    if (status) {
      whereConditions.push(`i.status = $${paramIndex++}`)
      queryParams.push(status)
    }
    
    if (startDate) {
      whereConditions.push(`i."issueDate" >= $${paramIndex++}`)
      queryParams.push(new Date(startDate))
    }
    
    if (endDate) {
      whereConditions.push(`i."issueDate" <= $${paramIndex++}`)
      queryParams.push(new Date(endDate))
    }
    
    const whereClause = whereConditions.join(' AND ')
    
    // Query master invoices with organization data and payment totals
    const invoicesQuery = `
      SELECT 
        i.*,
        o.name as "orgName",
        o.email as "orgEmail",
        o.slug as "orgSlug",
        (SELECT COALESCE(SUM(p.amount), 0) FROM master."MasterPayment" p WHERE p."invoiceId" = i.id AND p.status = 'completed')::numeric as "totalPaid"
      FROM master."MasterInvoice" i
      LEFT JOIN public."Organization" o ON i."organizationId" = o.id
      WHERE ${whereClause}
      ORDER BY i."issueDate" DESC
    `
    
    const invoices = await prisma.$queryRawUnsafe<any[]>(invoicesQuery, ...queryParams)
    
    // Format invoices for response
    const formattedInvoices = invoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      organizationId: inv.organizationId,
      organization: {
        id: inv.organizationId,
        name: inv.orgName,
        email: inv.orgEmail,
        slug: inv.orgSlug
      },
      billingPeriodStart: inv.billingPeriodStart,
      billingPeriodEnd: inv.billingPeriodEnd,
      dueDate: inv.dueDate,
      issueDate: inv.issueDate,
      paidDate: inv.paidDate,
      planName: inv.planName,
      planPrice: Number(inv.planPrice),
      userCount: inv.userCount,
      campaignCount: inv.campaignCount,
      storageUsedGB: Number(inv.storageUsedGB),
      additionalCharges: Number(inv.additionalCharges || 0),
      credits: Number(inv.credits || 0),
      subtotal: Number(inv.subtotal),
      taxRate: Number(inv.taxRate),
      taxAmount: Number(inv.taxAmount),
      totalAmount: Number(inv.totalAmount),
      totalPaid: Number(inv.totalPaid || 0),
      status: inv.status,
      notes: inv.notes,
      createdAt: inv.createdAt
    }))

    // Calculate summary
    const summary = {
      total: formattedInvoices.length,
      totalAmount: formattedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      totalPaid: formattedInvoices.reduce((sum, inv) => sum + inv.totalPaid, 0),
      totalOutstanding: formattedInvoices
        .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + (inv.totalAmount - inv.totalPaid), 0),
      byStatus: {
        draft: formattedInvoices.filter(inv => inv.status === 'draft').length,
        pending: formattedInvoices.filter(inv => inv.status === 'pending').length,
        sent: formattedInvoices.filter(inv => inv.status === 'sent').length,
        partial: formattedInvoices.filter(inv => inv.status === 'partial').length,
        paid: formattedInvoices.filter(inv => inv.status === 'paid').length,
        overdue: formattedInvoices.filter(inv => inv.status === 'overdue').length,
        cancelled: formattedInvoices.filter(inv => inv.status === 'cancelled').length
      }
    }

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices,
      summary
    })

  } catch (error) {
    console.error('❌ Master invoices GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}
