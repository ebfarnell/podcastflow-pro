import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema, getUserOrgSlug } from '@/lib/db/schema-db'

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

    // Get organization ID
    const { data: org } = await safeQuerySchema(orgSlug, async (db) => {
      return db.advertiser.findFirst({
        select: { organizationId: true }
      })
    })

    if (!org) {
      return NextResponse.json({ settings: null })
    }

    // Get billing settings
    const { data: settings, error } = await safeQuerySchema(orgSlug, async (db) => {
      return db.billingSettings.findUnique({
        where: { organizationId: org.organizationId }
      })
    })

    if (error) {
      console.error('Error fetching billing settings:', error)
      return NextResponse.json({ settings: null })
    }

    return NextResponse.json({ settings: settings || null })
  } catch (error) {
    console.error('Error in GET /api/billing/settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can update billing settings
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
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

    // Get organization ID
    const { data: org } = await safeQuerySchema(orgSlug, async (db) => {
      return db.advertiser.findFirst({
        select: { organizationId: true }
      })
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    // Update or create billing settings
    const { error } = await safeQuerySchema(orgSlug, async (db) => {
      await db.billingSettings.upsert({
        where: { organizationId: org.organizationId },
        update: {
          defaultInvoiceDay,
          defaultPaymentTerms,
          autoGenerateInvoices,
          invoicePrefix,
          invoiceStartNumber,
          lateFeePercentage,
          gracePeriodDays,
          preBillEnabled,
          preBillThresholdAmount,
          emailSettings,
          updatedAt: new Date(),
          updatedById: session.userId
        },
        create: {
          organizationId: org.organizationId,
          defaultInvoiceDay: defaultInvoiceDay || 1,
          defaultPaymentTerms: defaultPaymentTerms || 'Net 30',
          autoGenerateInvoices: autoGenerateInvoices !== false,
          invoicePrefix: invoicePrefix || 'INV',
          invoiceStartNumber: invoiceStartNumber || 1000,
          lateFeePercentage: lateFeePercentage || 0,
          gracePeriodDays: gracePeriodDays || 5,
          preBillEnabled: preBillEnabled !== false,
          preBillThresholdAmount: preBillThresholdAmount || 10000,
          emailSettings: emailSettings || {},
          updatedById: session.userId
        }
      })
    })

    if (error) {
      console.error('Error updating billing settings:', error)
      return NextResponse.json({ error: 'Failed to update billing settings' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PUT /api/billing/settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}