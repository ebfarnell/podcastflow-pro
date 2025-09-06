import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { safeQuerySchema } from '@/lib/db/schema-db'
import { notificationService } from '@/services/notifications/notification-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const placementType = url.searchParams.get('placementType')
    const fromDate = url.searchParams.get('fromDate')
    const toDate = url.searchParams.get('toDate')
    const includeExpired = url.searchParams.get('includeExpired') === 'true'

    let whereClause = '"showId" = $1 AND "organizationId" = $2'
    const queryParams = [params.id, session.organizationId]
    let paramIndex = 3

    if (placementType) {
      whereClause += ` AND "placementType" = $${paramIndex}`
      queryParams.push(placementType)
      paramIndex++
    }

    if (fromDate) {
      whereClause += ` AND "effectiveDate" >= $${paramIndex}`
      queryParams.push(fromDate)
      paramIndex++
    }

    if (toDate) {
      whereClause += ` AND "effectiveDate" <= $${paramIndex}`
      queryParams.push(toDate)
      paramIndex++
    }

    if (!includeExpired) {
      whereClause += ` AND ("expiryDate" IS NULL OR "expiryDate" >= CURRENT_DATE)`
    }

    const { data: rateHistory, error } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT rh.*, 
              s.name as showName,
              u.firstName || ' ' || u.lastName as createdByName
       FROM "ShowRateHistory" rh
       LEFT JOIN "Show" s ON rh."showId" = s.id
       LEFT JOIN "User" u ON rh."createdBy" = u.id
       WHERE ${whereClause}
       ORDER BY rh."effectiveDate" DESC, rh."placementType"`,
      queryParams
    )

    if (error) {
      console.error('❌ Rate history query failed:', error)
      return NextResponse.json([])
    }

    return NextResponse.json(rateHistory || [])
  } catch (error) {
    console.error('❌ Rate history API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master users can create/modify rates
    // Sales can only view rates (handled in GET)
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden - Only Admin can set rates' }, { status: 403 })
    }

    const body = await request.json()
    const { placementType, rate, effectiveDate, expiryDate, notes } = body

    if (!placementType || !rate || !effectiveDate) {
      return NextResponse.json({ 
        error: 'Placement type, rate, and effective date are required' 
      }, { status: 400 })
    }

    // Validate placement type
    const validPlacements = ['pre-roll', 'mid-roll', 'post-roll', 'host-read', 'sponsorship']
    if (!validPlacements.includes(placementType)) {
      return NextResponse.json({ 
        error: 'Invalid placement type' 
      }, { status: 400 })
    }

    // Validate rate (must be positive)
    if (parseFloat(rate) <= 0) {
      return NextResponse.json({ 
        error: 'Rate must be greater than 0' 
      }, { status: 400 })
    }

    // Validate dates
    const effective = new Date(effectiveDate)
    const expiry = expiryDate ? new Date(expiryDate) : null
    
    if (expiry && expiry <= effective) {
      return NextResponse.json({ 
        error: 'Expiry date must be after effective date' 
      }, { status: 400 })
    }

    // Check if show exists
    const { data: show } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT id, name FROM "Show" WHERE id = $1 AND "organizationId" = $2`,
      [params.id, session.organizationId]
    )

    if (!show?.[0]) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    // Check for overlapping rates (same placement type, overlapping date ranges)
    const { data: overlapping } = await safeQuerySchema(
      session.organizationSlug,
      `SELECT id FROM "ShowRateHistory" 
       WHERE "showId" = $1 
         AND "placementType" = $2 
         AND "effectiveDate" <= $3 
         AND ("expiryDate" IS NULL OR "expiryDate" >= $4)
         AND "organizationId" = $5`,
      [
        params.id, 
        placementType, 
        expiryDate || '2099-12-31', 
        effectiveDate, 
        session.organizationId
      ]
    )

    if (overlapping?.length > 0) {
      return NextResponse.json({ 
        error: 'Rate period overlaps with existing rate for this placement type' 
      }, { status: 400 })
    }

    // Create rate history entry
    const { data: rateEntry, error: insertError } = await safeQuerySchema(
      session.organizationSlug,
      `INSERT INTO "ShowRateHistory" (
        "showId", "placementType", "rate", "effectiveDate", "expiryDate", 
        "notes", "createdBy", "organizationId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`,
      [
        params.id,
        placementType,
        parseFloat(rate),
        effectiveDate,
        expiryDate || null,
        notes || '',
        session.userId,
        session.organizationId
      ]
    )

    if (insertError || !rateEntry?.[0]) {
      console.error('❌ Rate history creation failed:', insertError)
      return NextResponse.json({ error: 'Failed to create rate entry' }, { status: 500 })
    }

    // Send notification to relevant users about rate change
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
        title: `New Rate Set: ${show[0].name}`,
        message: `${placementType} rate set to $${rate} effective ${new Date(effectiveDate).toLocaleDateString()}`,
        type: 'system_update',
        userIds: relevantUsers.map((u: any) => u.id),
        actionUrl: `/shows/${params.id}?tab=rates`,
        sendEmail: false,
        emailData: {
          showName: show[0].name,
          placementType,
          rate: parseFloat(rate).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
          effectiveDate: new Date(effectiveDate).toLocaleDateString(),
          expiryDate: expiryDate ? new Date(expiryDate).toLocaleDateString() : 'No expiry',
          setBy: session.firstName && session.lastName ? 
            `${session.firstName} ${session.lastName}` : 'Sales Team',
          showLink: `${process.env.NEXT_PUBLIC_APP_URL}/shows/${params.id}`
        }
      })
    }

    return NextResponse.json(rateEntry[0])
  } catch (error) {
    console.error('❌ Rate history creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}