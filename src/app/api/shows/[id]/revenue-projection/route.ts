import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

async function updateRevenueProjection(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can update revenue projections
    if (!['admin', 'master'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { id: showId } = params
    const body = await request.json()
    const {
      revenueSharingType,
      revenueSharingPercentage,
      revenueSharingFixedAmount,
      revenueSharingNotes,
      talentContractUrl
    } = body

    // Build update query dynamically
    const updateFields: string[] = []
    const updateParams: any[] = []
    let paramIndex = 1

    if (revenueSharingType !== undefined) {
      updateFields.push(`"revenueSharingType" = $${paramIndex++}`)
      updateParams.push(revenueSharingType)
    }

    if (revenueSharingPercentage !== undefined) {
      updateFields.push(`"revenueSharingPercentage" = $${paramIndex++}`)
      updateParams.push(revenueSharingPercentage)
    }

    if (revenueSharingFixedAmount !== undefined) {
      updateFields.push(`"revenueSharingFixedAmount" = $${paramIndex++}`)
      updateParams.push(revenueSharingFixedAmount)
    }

    if (revenueSharingNotes !== undefined) {
      updateFields.push(`"revenueSharingNotes" = $${paramIndex++}`)
      updateParams.push(revenueSharingNotes)
    }

    if (talentContractUrl !== undefined) {
      updateFields.push(`"talentContractUrl" = $${paramIndex++}`)
      updateParams.push(talentContractUrl)
      updateFields.push(`"talentContractUploadedAt" = $${paramIndex++}`)
      updateParams.push(new Date())
      updateFields.push(`"talentContractUploadedBy" = $${paramIndex++}`)
      updateParams.push(user.id)
    }

    // Always update timestamp
    updateFields.push(`"updatedAt" = $${paramIndex++}`)
    updateParams.push(new Date())
    updateFields.push(`"updatedBy" = $${paramIndex++}`)
    updateParams.push(user.id)

    // Add showId and organizationId conditions
    updateParams.push(showId)
    updateParams.push(user.organizationId)

    const updateQuery = `
      UPDATE "Show"
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND "organizationId" = $${paramIndex}
      RETURNING *
    `

    const result = await querySchema<any>(orgSlug, updateQuery, updateParams)

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      show: result[0]
    })

  } catch (error) {
    console.error('❌ Show revenue projection update error:', error)
    return NextResponse.json(
      { error: 'Failed to update revenue projection' },
      { status: 500 }
    )
  }
}

export const PUT = updateRevenueProjection
export const PATCH = updateRevenueProjection