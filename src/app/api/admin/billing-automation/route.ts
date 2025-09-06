import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { notificationService } from '@/services/notifications/notification-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: settings, error } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT * FROM "BillingSettings" WHERE "organizationId" = $1`,
      [session.organizationId]
    )

    if (error) {
      console.error('❌ Billing settings query failed:', error)
      return NextResponse.json(null)
    }

    return NextResponse.json(settings?.[0] || null)
  } catch (error) {
    console.error('❌ Billing settings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      defaultInvoiceDay,
      defaultPaymentTerms,
      autoGenerateInvoices,
      invoicePrefix,
      invoiceStartNumber,
      lateFeePercentage,
      gracePeriodDays,
      preBillEnabled,
      preBillThresholdAmount,
      emailSettings
    } = body

    // Check if settings already exist
    const { data: existingSettings } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT id FROM "BillingSettings" WHERE "organizationId" = $1`,
      [session.organizationId]
    )

    let settings
    let isUpdate = false

    if (existingSettings?.[0]) {
      // Update existing settings
      isUpdate = true
      const { data: updatedSettings, error } = await safeQuerySchema(
        session.organizationSlug,
        `UPDATE "BillingSettings" SET 
          "defaultInvoiceDay" = COALESCE($1, "defaultInvoiceDay"),
          "defaultPaymentTerms" = COALESCE($2, "defaultPaymentTerms"),
          "autoGenerateInvoices" = COALESCE($3, "autoGenerateInvoices"),
          "invoicePrefix" = COALESCE($4, "invoicePrefix"),
          "invoiceStartNumber" = COALESCE($5, "invoiceStartNumber"),
          "lateFeePercentage" = COALESCE($6, "lateFeePercentage"),
          "gracePeriodDays" = COALESCE($7, "gracePeriodDays"),
          "preBillEnabled" = COALESCE($8, "preBillEnabled"),
          "preBillThresholdAmount" = COALESCE($9, "preBillThresholdAmount"),
          "emailSettings" = COALESCE($10, "emailSettings"),
          "updatedAt" = CURRENT_TIMESTAMP,
          "updatedById" = $11
        WHERE "organizationId" = $12 RETURNING *`,
        [
          defaultInvoiceDay,
          defaultPaymentTerms,
          autoGenerateInvoices,
          invoicePrefix,
          invoiceStartNumber,
          lateFeePercentage,
          gracePeriodDays,
          preBillEnabled,
          preBillThresholdAmount,
          emailSettings ? JSON.stringify(emailSettings) : null,
          session.userId,
          session.organizationId
        ]
      )

      if (error) {
        console.error('❌ Billing settings update failed:', error)
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
      }

      settings = updatedSettings?.[0]
    } else {
      // Create new settings
      const { data: newSettings, error } = await safeQuerySchema(
        session.organizationSlug,
        `INSERT INTO "BillingSettings" (
          "organizationId", "defaultInvoiceDay", "defaultPaymentTerms", "autoGenerateInvoices", 
          "invoicePrefix", "invoiceStartNumber", "lateFeePercentage", "gracePeriodDays", 
          "preBillEnabled", "preBillThresholdAmount", "emailSettings", "updatedById"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          session.organizationId,
          defaultInvoiceDay || 1,
          defaultPaymentTerms || 'Net 30',
          autoGenerateInvoices !== undefined ? autoGenerateInvoices : true,
          invoicePrefix || 'INV',
          invoiceStartNumber || 1000,
          lateFeePercentage || 0,
          gracePeriodDays || 5,
          preBillEnabled !== undefined ? preBillEnabled : true,
          preBillThresholdAmount || 10000,
          JSON.stringify(emailSettings || {}),
          session.userId
        ]
      )

      if (error) {
        console.error('❌ Billing settings creation failed:', error)
        return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 })
      }

      settings = newSettings?.[0]
    }

    // Send notification to admin users about billing settings change
    const { data: adminUsers } = await safeQuerySchema(
      'public',
      `SELECT id FROM "User" WHERE "organizationId" = $1 AND role IN ('admin', 'master', 'sales') AND id != $2`,
      [session.organizationId, session.userId]
    )

    if (adminUsers?.length > 0) {
      const action = isUpdate ? 'updated' : 'configured'
      const criticalChanges = []
      
      if (autoGenerateInvoices === false) {
        criticalChanges.push('auto-invoice generation disabled')
      }
      if (preBillEnabled === false) {
        criticalChanges.push('pre-billing disabled')
      }
      if (lateFeePercentage && lateFeePercentage > 0) {
        criticalChanges.push(`late fees set to ${lateFeePercentage}%`)
      }

      let message = `Billing automation settings have been ${action}`
      if (criticalChanges.length > 0) {
        message += `. Key changes: ${criticalChanges.join(', ')}`
      }

      await notificationService.sendBulkNotification({
        title: `Billing Settings ${isUpdate ? 'Updated' : 'Configured'}`,
        message,
        type: 'system_update',
        userIds: adminUsers.map((u: any) => u.id),
        actionUrl: '/admin/settings?tab=billing',
        sendEmail: criticalChanges.length > 0 // Send email for critical changes
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('❌ Billing settings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}