import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { notificationService } from '@/services/notifications/notification-service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // This endpoint can be called by scheduled tasks or admin users
    const session = await getSessionFromCookie(request)
    
    // Allow system calls (for scheduled tasks) or admin users
    const isSystemCall = request.headers.get('x-system-key') === process.env.SYSTEM_API_KEY
    
    if (!isSystemCall && !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isSystemCall && !['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { organizationId, period, dryRun = false } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // Get organization details
    const { data: organization } = await safeQuerySchema(
      'public',
      `SELECT slug FROM "Organization" WHERE id = $1`,
      [organizationId]
    )

    if (!organization?.[0]) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const orgSlug = organization[0].slug

    // Get billing settings
    const { data: billingSettings } = await safeQuerySchema(
      orgSlug,
      `SELECT * FROM "BillingSettings" WHERE "organizationId" = $1`,
      [organizationId]
    )

    if (!billingSettings?.[0] || !billingSettings[0].autoGenerateInvoices) {
      return NextResponse.json({ 
        error: 'Auto-invoice generation is not enabled for this organization' 
      }, { status: 400 })
    }

    const settings = billingSettings[0]
    const currentPeriod = period || new Date().toISOString().slice(0, 7) // YYYY-MM format

    // Get orders that need to be invoiced for this period
    const { data: ordersToInvoice } = await safeQuerySchema(
      orgSlug,
      `SELECT o.*, 
              a.name as advertiserName,
              a.email as advertiserEmail,
              c.name as campaignName
       FROM "Order" o
       LEFT JOIN "Advertiser" a ON o."advertiserId" = a.id
       LEFT JOIN "Campaign" c ON o."campaignId" = c.id
       WHERE o."organizationId" = $1
         AND o.status IN ('active', 'completed')
         AND o."billingStatus" IN ('pending', 'partial')
         AND DATE_TRUNC('month', o."endDate") <= DATE_TRUNC('month', $2::date)
         AND NOT EXISTS (
           SELECT 1 FROM "Invoice" i 
           WHERE i."orderId" = o.id 
             AND i."billingPeriod" = $3
         )
       ORDER BY a.name, o."createdAt"`,
      [organizationId, `${currentPeriod}-01`, currentPeriod]
    )

    if (!ordersToInvoice?.length) {
      return NextResponse.json({
        success: true,
        message: 'No orders require invoicing for this period',
        period: currentPeriod,
        invoicesGenerated: 0
      })
    }

    const results = {
      period: currentPeriod,
      totalOrders: ordersToInvoice.length,
      invoicesGenerated: 0,
      totalAmount: 0,
      successful: [] as any[],
      failed: [] as any[],
      errors: [] as string[]
    }

    // Process each order
    for (const order of ordersToInvoice) {
      try {
        if (dryRun) {
          results.successful.push({
            orderId: order.id,
            advertiserName: order.advertiserName,
            amount: order.totalValue,
            dryRun: true
          })
          results.totalAmount += order.totalValue || 0
          continue
        }

        // Generate invoice number
        const { data: lastInvoice } = await safeQuerySchema(
          orgSlug,
          `SELECT "invoiceNumber" FROM "Invoice" 
           WHERE "organizationId" = $1 
           ORDER BY "invoiceNumber" DESC LIMIT 1`,
          [organizationId]
        )

        const nextInvoiceNumber = lastInvoice?.[0]?.invoiceNumber 
          ? lastInvoice[0].invoiceNumber + 1 
          : settings.invoiceStartNumber || 1000

        // Calculate due date
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + parseInt(settings.defaultPaymentTerms.replace('Net ', '') || '30'))

        // Create invoice
        const { data: invoice, error: invoiceError } = await safeQuerySchema(
          orgSlug,
          `INSERT INTO "Invoice" (
            "organizationId", "orderId", "advertiserId", "campaignId",
            "invoiceNumber", "billingPeriod", "amount", "dueDate",
            "paymentTerms", "status", "createdById"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
          RETURNING *`,
          [
            organizationId,
            order.id,
            order.advertiserId,
            order.campaignId,
            nextInvoiceNumber,
            currentPeriod,
            order.totalValue || 0,
            dueDate.toISOString(),
            settings.defaultPaymentTerms,
            session?.userId || 'system'
          ]
        )

        if (invoiceError || !invoice?.[0]) {
          results.failed.push({
            orderId: order.id,
            advertiserName: order.advertiserName,
            error: invoiceError || 'Failed to create invoice'
          })
          results.errors.push(`Failed to create invoice for ${order.advertiserName}: ${invoiceError}`)
          continue
        }

        // Update order billing status
        await safeQuerySchema(
          orgSlug,
          `UPDATE "Order" SET "billingStatus" = 'invoiced', "updatedAt" = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [order.id]
        )

        results.successful.push({
          orderId: order.id,
          invoiceId: invoice[0].id,
          invoiceNumber: nextInvoiceNumber,
          advertiserName: order.advertiserName,
          amount: order.totalValue || 0
        })

        results.invoicesGenerated++
        results.totalAmount += order.totalValue || 0

        // Send notification to advertiser/client about new invoice
        if (order.advertiserEmail && !dryRun) {
          // Find users associated with this advertiser
          const { data: advertiserUsers } = await safeQuerySchema(
            'public',
            `SELECT u.id 
             FROM "User" u
             WHERE u."organizationId" = $1 
               AND (u.email = $2 OR u.role = 'client')
               AND u."isActive" = true`,
            [organizationId, order.advertiserEmail]
          )

          if (advertiserUsers?.length > 0) {
            for (const user of advertiserUsers) {
              await notificationService.notifyInvoiceGenerated(
                user.id,
                {
                  ...invoice[0],
                  number: `${settings.invoicePrefix}${nextInvoiceNumber}`,
                  advertiserName: order.advertiserName,
                  campaignName: order.campaignName
                },
                true, // isAutomated
                true
              )
            }
          }
        }

      } catch (orderError) {
        console.error(`❌ Error processing order ${order.id}:`, orderError)
        results.failed.push({
          orderId: order.id,
          advertiserName: order.advertiserName,
          error: orderError.message || 'Unknown error'
        })
        results.errors.push(`Error processing ${order.advertiserName}: ${orderError.message}`)
      }
    }

    // Send cycle completion notification to admin users
    if (!dryRun && results.invoicesGenerated > 0) {
      const { data: adminUsers } = await safeQuerySchema(
        'public',
        `SELECT id FROM "User" 
         WHERE "organizationId" = $1 
           AND role IN ('admin', 'master') 
           AND "isActive" = true`,
        [organizationId]
      )

      if (adminUsers?.length > 0) {
        await notificationService.notifyBillingCycleComplete(
          adminUsers.map((u: any) => u.id),
          {
            period: currentPeriod,
            invoiceCount: results.invoicesGenerated,
            totalAmount: results.totalAmount,
            successfulInvoices: results.successful.length,
            failedInvoices: results.failed.length
          },
          true
        )
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      dryRun
    })

  } catch (error) {
    console.error('❌ Billing cycle error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}