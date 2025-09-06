import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { notificationService } from '@/services/notifications/notification-service'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest, 
  { params }: { params: { id: string; rateId: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: rateEntry, error } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT rh.*, 
              s.name as showName,
              u.firstName || ' ' || u.lastName as createdByName
       FROM "ShowRateHistory" rh
       LEFT JOIN "Show" s ON rh."showId" = s.id
       LEFT JOIN "User" u ON rh."createdBy" = u.id
       WHERE rh.id = $1 AND rh."showId" = $2 AND rh."organizationId" = $3`,
      [params.rateId, params.id, session.organizationId]
    )

    if (error || !rateEntry?.[0]) {
      return NextResponse.json({ error: 'Rate entry not found' }, { status: 404 })
    }

    return NextResponse.json(rateEntry[0])
  } catch (error) {
    console.error('❌ Rate entry fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest, 
  { params }: { params: { id: string; rateId: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can modify rates
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden - Only Admin can modify rates' }, { status: 403 })
    }

    const body = await request.json()
    const { rate, effectiveDate, expiryDate, notes } = body

    // Get current rate entry
    const { data: currentRate } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT rh.*, s.name as showName 
       FROM "ShowRateHistory" rh
       LEFT JOIN "Show" s ON rh."showId" = s.id
       WHERE rh.id = $1 AND rh."showId" = $2 AND rh."organizationId" = $3`,
      [params.rateId, params.id, session.organizationId]
    )

    if (!currentRate?.[0]) {
      return NextResponse.json({ error: 'Rate entry not found' }, { status: 404 })
    }

    const current = currentRate[0]

    // Validate new values if provided
    if (rate && parseFloat(rate) <= 0) {
      return NextResponse.json({ 
        error: 'Rate must be greater than 0' 
      }, { status: 400 })
    }

    if (effectiveDate && expiryDate) {
      const effective = new Date(effectiveDate)
      const expiry = new Date(expiryDate)
      
      if (expiry <= effective) {
        return NextResponse.json({ 
          error: 'Expiry date must be after effective date' 
        }, { status: 400 })
      }
    }

    // Check for overlaps if dates are being changed
    if (effectiveDate || expiryDate) {
      const newEffective = effectiveDate || current.effectiveDate
      const newExpiry = expiryDate !== undefined ? expiryDate : current.expiryDate

      const { data: overlapping } = await safeQuerySchema(
        session.organizationSlug,
        `SELECT id FROM "ShowRateHistory" 
         WHERE "showId" = $1 
           AND "placementType" = $2 
           AND "effectiveDate" <= $3 
           AND ("expiryDate" IS NULL OR "expiryDate" >= $4)
           AND "organizationId" = $5
           AND id != $6`,
        [
          params.id, 
          current.placementType, 
          newExpiry || '2099-12-31', 
          newEffective, 
          session.organizationId,
          params.rateId
        ]
      )

      if (overlapping?.length > 0) {
        return NextResponse.json({ 
          error: 'Updated rate period would overlap with existing rate for this placement type' 
        }, { status: 400 })
      }
    }

    // Update rate entry
    const updateFields = []
    const updateParams = []
    let paramIndex = 1

    if (rate !== undefined) {
      updateFields.push(`rate = $${paramIndex}`)
      updateParams.push(parseFloat(rate))
      paramIndex++
    }

    if (effectiveDate) {
      updateFields.push(`"effectiveDate" = $${paramIndex}`)
      updateParams.push(effectiveDate)
      paramIndex++
    }

    if (expiryDate !== undefined) {
      updateFields.push(`"expiryDate" = $${paramIndex}`)
      updateParams.push(expiryDate || null)
      paramIndex++
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`)
      updateParams.push(notes)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return NextResponse.json(current)
    }

    updateParams.push(params.rateId, params.id, session.organizationId)

    const { data: updatedRate, error: updateError } = await safeQuerySchema(
      session.organizationSlug,
      `UPDATE "ShowRateHistory" SET ${updateFields.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP 
       WHERE id = $${paramIndex} AND "showId" = $${paramIndex + 1} AND "organizationId" = $${paramIndex + 2}
       RETURNING *`,
      updateParams
    )

    if (updateError || !updatedRate?.[0]) {
      console.error('❌ Rate entry update failed:', updateError)
      return NextResponse.json({ error: 'Failed to update rate entry' }, { status: 500 })
    }

    // Send notification about rate change
    const { data: relevantUsers } = await safeQuerySchema(
      'public',
      `SELECT id FROM "User" 
       WHERE "organizationId" = $1 
         AND role IN ('admin', 'master', 'sales') 
         AND id != $2 
         AND "isActive" = true`,
      [session.organizationId, session.userId]
    )

    if (relevantUsers?.length > 0) {
      const changedFields = []
      if (rate !== undefined && rate !== current.rate) {
        changedFields.push(`rate: $${current.rate} → $${rate}`)
      }
      if (effectiveDate && effectiveDate !== current.effectiveDate) {
        changedFields.push(`effective date: ${new Date(current.effectiveDate).toLocaleDateString()} → ${new Date(effectiveDate).toLocaleDateString()}`)
      }

      if (changedFields.length > 0) {
        await notificationService.sendBulkNotification({
          title: `Rate Updated: ${current.showName}`,
          message: `${current.placementType} rate updated: ${changedFields.join(', ')}`,
          type: 'system_update',
          userIds: relevantUsers.map((u: any) => u.id),
          actionUrl: `/shows/${params.id}?tab=rates`,
          sendEmail: false
        })
      }
    }

    return NextResponse.json(updatedRate[0])
  } catch (error) {
    console.error('❌ Rate entry update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest, 
  { params }: { params: { id: string; rateId: string } }
) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master users can delete rate entries
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get rate details before deletion
    const { data: rateEntry } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT rh.*, s.name as showName 
       FROM "ShowRateHistory" rh
       LEFT JOIN "Show" s ON rh."showId" = s.id
       WHERE rh.id = $1 AND rh."showId" = $2 AND rh."organizationId" = $3`,
      [params.rateId, params.id, session.organizationId]
    )

    if (!rateEntry?.[0]) {
      return NextResponse.json({ error: 'Rate entry not found' }, { status: 404 })
    }

    const entry = rateEntry[0]

    // Check if rate is currently being used in active campaigns
    const { data: activeCampaigns } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT COUNT(*) as count FROM "Order" o
       INNER JOIN "Campaign" c ON o."campaignId" = c.id
       WHERE c."showId" = $1 
         AND o.status IN ('active', 'pending')
         AND o."createdAt" >= $2
         AND (o."createdAt" <= $3 OR $3 IS NULL)`,
      [params.id, entry.effectiveDate, entry.expiryDate]
    )

    if (activeCampaigns?.[0]?.count > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete rate entry that is currently being used by active campaigns' 
      }, { status: 400 })
    }

    // Delete rate entry
    const { error } = await safeQuerySchema(
      session.organizationSlug,
      `DELETE FROM "ShowRateHistory" 
       WHERE id = $1 AND "showId" = $2 AND "organizationId" = $3`,
      [params.rateId, params.id, session.organizationId]
    )

    if (error) {
      console.error('❌ Rate entry deletion failed:', error)
      return NextResponse.json({ error: 'Failed to delete rate entry' }, { status: 500 })
    }

    // Send notification about rate deletion
    const { data: relevantUsers } = await safeQuerySchema(
      'public',
      `SELECT id FROM "User" 
       WHERE "organizationId" = $1 
         AND role IN ('admin', 'master', 'sales') 
         AND id != $2 
         AND "isActive" = true`,
      [session.organizationId, session.userId]
    )

    if (relevantUsers?.length > 0) {
      await notificationService.sendBulkNotification({
        title: `Rate Deleted: ${entry.showName}`,
        message: `${entry.placementType} rate ($${entry.rate}) effective ${new Date(entry.effectiveDate).toLocaleDateString()} has been deleted`,
        type: 'system_update',
        userIds: relevantUsers.map((u: any) => u.id),
        actionUrl: `/shows/${params.id}?tab=rates`,
        sendEmail: true,
        emailData: {
          showName: entry.showName,
          placementType: entry.placementType,
          rate: entry.rate.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
          effectiveDate: new Date(entry.effectiveDate).toLocaleDateString(),
          deletedBy: session.firstName && session.lastName ? 
            `${session.firstName} ${session.lastName}` : 'Administrator',
          deletionDate: new Date().toLocaleDateString()
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Rate entry deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}