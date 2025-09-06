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

    if (!['admin', 'master', 'sales'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'pending'

    // Get billing settings to determine threshold
    const { data: billingSettings } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT "preBillThresholdAmount" FROM "BillingSettings" WHERE "organizationId" = $1`,
      [session.organizationId]
    )

    const threshold = billingSettings?.[0]?.preBillThresholdAmount || 10000

    // Get advertisers that exceed the pre-bill threshold and need approval
    const { data: advertisers, error } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT 
        a.id,
        a.name,
        a.email,
        a."contactName",
        COALESCE(SUM(
          CASE 
            WHEN o.status IN ('active', 'completed') 
            THEN o."totalValue"
            ELSE 0 
          END
        ), 0) as "totalBillingAmount",
        COUNT(DISTINCT o.id) as "activeCampaigns",
        MAX(o."updatedAt") as "lastUpdated",
        CASE
          WHEN COALESCE(SUM(
            CASE 
              WHEN o.status IN ('active', 'completed') 
              THEN o."totalValue"
              ELSE 0 
            END
          ), 0) >= $2 THEN 'requires_approval'
          ELSE 'approved'
        END as "preBillStatus"
       FROM "Advertiser" a
       LEFT JOIN "Order" o ON a.id = o."advertiserId" 
         AND o."createdAt" >= date_trunc('month', CURRENT_DATE)
       WHERE a."organizationId" = $1
       GROUP BY a.id, a.name, a.email, a."contactName"
       HAVING ${status === 'pending' ? 
         `COALESCE(SUM(CASE WHEN o.status IN ('active', 'completed') THEN o."totalValue" ELSE 0 END), 0) >= $2` :
         `COALESCE(SUM(CASE WHEN o.status IN ('active', 'completed') THEN o."totalValue" ELSE 0 END), 0) < $2`
       }
       ORDER BY "totalBillingAmount" DESC`,
      [session.organizationId, threshold]
    )

    if (error) {
      console.error('❌ Pre-bill approvals query failed:', error)
      return NextResponse.json([])
    }

    return NextResponse.json({
      threshold,
      advertisers: advertisers || []
    })
  } catch (error) {
    console.error('❌ Pre-bill approvals API error:', error)
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
      return NextResponse.json({ error: 'Only administrators can approve pre-billing' }, { status: 403 })
    }

    const body = await request.json()
    const { advertiserId, action, notes } = body

    if (!advertiserId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 })
    }

    // Get advertiser details
    const { data: advertiser } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT a.*, 
              COALESCE(SUM(
                CASE 
                  WHEN o.status IN ('active', 'completed') 
                  THEN o."totalValue"
                  ELSE 0 
                END
              ), 0) as "totalBillingAmount"
       FROM "Advertiser" a
       LEFT JOIN "Order" o ON a.id = o."advertiserId" 
         AND o."createdAt" >= date_trunc('month', CURRENT_DATE)
       WHERE a.id = $1 AND a."organizationId" = $2
       GROUP BY a.id`,
      [advertiserId, session.organizationId]
    )

    if (!advertiser?.[0]) {
      return NextResponse.json({ error: 'Advertiser not found' }, { status: 404 })
    }

    const advertiserData = advertiser[0]

    // Create pre-bill approval record
    const { data: approval, error } = await safeQuerySchema(
      session.organizationSlug,
      `INSERT INTO "PreBillApproval" (
        "organizationId", "advertiserId", "billingAmount", "status", 
        "approvedById", "notes", "approvalDate"
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) 
      RETURNING *`,
      [
        session.organizationId,
        advertiserId,
        advertiserData.totalBillingAmount,
        action === 'approve' ? 'approved' : 'rejected',
        session.userId,
        notes || ''
      ]
    )

    if (error) {
      console.error('❌ Pre-bill approval creation failed:', error)
      return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 })
    }

    // Get sales users associated with this advertiser for notifications
    const { data: salesUsers } = await safeQuerySchema(
      'public',
      `SELECT DISTINCT u.id 
       FROM "User" u
       INNER JOIN "Order" o ON u.id = o."createdById" OR u.id = o."assignedSalesId"
       WHERE o."advertiserId" = $1 AND u."organizationId" = $2 AND u.role = 'sales'`,
      [advertiserId, session.organizationId]
    )

    // Send notifications
    const notificationUserIds = salesUsers?.map((u: any) => u.id) || []

    if (notificationUserIds.length > 0) {
      const approverName = session.firstName && session.lastName ? 
        `${session.firstName} ${session.lastName}` : 'Administrator'

      await notificationService.sendBulkNotification({
        title: `Pre-Bill ${action === 'approve' ? 'Approved' : 'Rejected'}: ${advertiserData.name}`,
        message: `Pre-billing for ${advertiserData.name} ($${advertiserData.totalBillingAmount?.toLocaleString()}) has been ${action}d`,
        type: action === 'approve' ? 'approval_granted' : 'approval_denied',
        userIds: notificationUserIds,
        actionUrl: `/billing/pre-bill-approvals`,
        sendEmail: true,
        emailData: {
          advertiserName: advertiserData.name,
          billingAmount: advertiserData.totalBillingAmount?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
          action: action === 'approve' ? 'approved' : 'rejected',
          approverName,
          approvalDate: new Date().toLocaleDateString(),
          notes: notes || 'No additional notes',
          nextSteps: action === 'approve' ? 
            'You can now proceed with billing for this advertiser' :
            'Please review billing amount or contact administrator for clarification'
        }
      })
    }

    return NextResponse.json(approval?.[0])
  } catch (error) {
    console.error('❌ Pre-bill approval error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}