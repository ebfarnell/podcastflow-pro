import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'GET',
        `/api/shows/${params.id}/revenue-sharing`,
        request
      )
    }

    // Fetch show with revenue sharing details using schema-aware queries
    const showQuery = `
      SELECT 
        id, name, "revenueSharingType", "revenueSharingPercentage", 
        "revenueSharingFixedAmount", "revenueSharingNotes"
      FROM "Show" 
      WHERE id = $1
    `
    const shows = await querySchema<any>(orgSlug, showQuery, [params.id])
    
    if (!shows || shows.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }
    
    const show = shows[0]
    
    // Fetch assigned talent and producers using junction tables
    const talentQuery = `
      SELECT u.id, u.name, u.email
      FROM "_ShowToUser" stu
      JOIN public."User" u ON u.id = stu."B"
      WHERE stu."A" = $1 AND u.role = 'talent'
    `
    const assignedTalent = await querySchema<any>(orgSlug, talentQuery, [params.id])
    
    const producersQuery = `
      SELECT u.id, u.name, u.email
      FROM "_ShowToUser" stu
      JOIN public."User" u ON u.id = stu."B"
      WHERE stu."A" = $1 AND u.role = 'producer'
    `
    const assignedProducers = await querySchema<any>(orgSlug, producersQuery, [params.id])
    
    // Reconstruct show object with relationships
    show.assignedTalent = assignedTalent
    show.assignedProducers = assignedProducers

    if (!show) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    // Get revenue sharing agreements for talent using schema-aware queries
    const agreementsQuery = `
      SELECT 
        rsa.*,
        ut.id as talent_id, ut.name as talent_name, ut.email as talent_email,
        up.id as producer_id, up.name as producer_name, up.email as producer_email
      FROM "RevenueSharingAgreement" rsa
      LEFT JOIN public."User" ut ON ut.id = rsa."talentId"
      LEFT JOIN public."User" up ON up.id = rsa."producerId"
      WHERE rsa."showId" = $1
      ORDER BY rsa."createdAt" DESC
    `
    const agreementsRaw = await querySchema<any>(orgSlug, agreementsQuery, [params.id])
    
    // Transform agreements to match expected format
    const agreements = agreementsRaw.map(a => ({
      ...a,
      talent: a.talent_id ? {
        id: a.talent_id,
        name: a.talent_name,
        email: a.talent_email
      } : null,
      producer: a.producer_id ? {
        id: a.producer_id,
        name: a.producer_name,
        email: a.producer_email
      } : null
    }))

    // Calculate revenue statistics using schema-aware queries
    const revenueStatsQuery = `
      SELECT 
        COALESCE(SUM(oi.rate), 0) as total_revenue,
        COUNT(*) as total_orders
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE oi."showId" = $1 
        AND o.status IN ('confirmed', 'booked')
    `
    const revenueStatsRaw = await querySchema<any>(orgSlug, revenueStatsQuery, [params.id])
    
    const totalRevenue = Number(revenueStatsRaw[0]?.total_revenue || 0)
    const totalOrders = Number(revenueStatsRaw[0]?.total_orders || 0)

    // Calculate projected revenue sharing payouts
    let projectedPayouts = 0
    if (show.revenueSharingType === 'percentage' && show.revenueSharingPercentage) {
      projectedPayouts = totalRevenue * (show.revenueSharingPercentage / 100)
    } else if (show.revenueSharingType === 'fixed' && show.revenueSharingFixedAmount) {
      projectedPayouts = show.revenueSharingFixedAmount * totalOrders
    }

    return NextResponse.json({
      show,
      agreements,
      statistics: {
        totalRevenue,
        totalOrders,
        projectedPayouts,
        netRevenue: totalRevenue - projectedPayouts
      }
    })
  } catch (error) {
    console.error('Error fetching revenue sharing data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get session and verify authentication
    const authToken = request.cookies.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL SECURITY FIX: Use schema-aware queries for multi-tenant data
    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Check if master is accessing cross-org data
    if (user.role === 'master' && user.organizationId !== orgSlug) {
      await accessLogger.logMasterCrossOrgAccess(
        user.id,
        user.organizationId!,
        orgSlug,
        'PUT',
        `/api/shows/${params.id}/revenue-sharing`,
        request
      )
    }

    const body = await request.json()
    const { 
      revenueSharingType, 
      revenueSharingPercentage, 
      revenueSharingFixedAmount, 
      revenueSharingNotes 
    } = body

    // Verify show exists using schema-aware query
    const existingShowQuery = `SELECT id FROM "Show" WHERE id = $1`
    const existingShows = await querySchema<any>(orgSlug, existingShowQuery, [params.id])

    if (!existingShows || existingShows.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 })
    }

    // Validate revenue sharing data
    if (revenueSharingType === 'percentage' && (!revenueSharingPercentage || revenueSharingPercentage < 0 || revenueSharingPercentage > 100)) {
      return NextResponse.json({ 
        error: 'Revenue sharing percentage must be between 0 and 100' 
      }, { status: 400 })
    }

    if (revenueSharingType === 'fixed' && (!revenueSharingFixedAmount || revenueSharingFixedAmount < 0)) {
      return NextResponse.json({ 
        error: 'Fixed revenue sharing amount must be greater than 0' 
      }, { status: 400 })
    }

    // Update show revenue sharing settings using schema-aware query
    const updateQuery = `
      UPDATE "Show" 
      SET 
        "revenueSharingType" = $2,
        "revenueSharingPercentage" = $3,
        "revenueSharingFixedAmount" = $4,
        "revenueSharingNotes" = $5,
        "updatedBy" = $6,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, "revenueSharingType", "revenueSharingPercentage", 
                "revenueSharingFixedAmount", "revenueSharingNotes"
    `
    
    const updatedShows = await querySchema<any>(orgSlug, updateQuery, [
      params.id,
      revenueSharingType,
      revenueSharingType === 'percentage' ? parseFloat(revenueSharingPercentage) : null,
      revenueSharingType === 'fixed' ? parseFloat(revenueSharingFixedAmount) : null,
      revenueSharingNotes,
      user.id
    ])
    
    const updatedShow = updatedShows[0]

    return NextResponse.json(updatedShow)
  } catch (error) {
    console.error('Error updating revenue sharing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
