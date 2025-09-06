import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { getUserOrgSlug, safeQuerySchema } from '@/lib/db/schema-db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and master can access this
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization context
    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    // Ensure we're using the schema name, not the org slug
    const schemaName = orgSlug.startsWith('org_') ? orgSlug : `org_${orgSlug.replace(/-/g, '_')}`

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'

    // Build queries based on type
    let approvals: any[] = []

    // Get pending campaign approvals from CampaignApproval table
    if (type === 'all' || type === 'campaigns') {
      const campaignsQuery = `
        SELECT 
          ca.id as "approvalId",
          'campaign' as type,
          c.id as "campaignId",
          c.name as "campaignName",
          a.name as "advertiserName",
          ag.name as "agencyName",
          c.status,
          c.probability,
          c.budget,
          c."startDate",
          c."endDate",
          u.name as "createdBy",
          ca."createdAt",
          ca."hasRateDiscrepancy",
          ca."discrepancyAmount",
          ca."discrepancyPercentage",
          ca."discrepancyDetails",
          ca.metadata,
          -- Calculate rate achievement (using metadata or defaults)
          COALESCE((ca.metadata->>'totalRateCardValue')::numeric, 100) as "rateCardRate",
          COALESCE((ca.metadata->>'negotiatedRate')::numeric, 80) as "negotiatedRate",
          COALESCE(ca."discrepancyPercentage", 85) as "rateAchievement",
          COALESCE((ca.metadata->>'totalSpots')::integer, 50) as "totalSpots",
          COALESCE(c."targetImpressions", 50000) as "totalImpressions",
          CASE 
            WHEN c."targetImpressions" > 0 THEN c.budget / c."targetImpressions" * 1000
            ELSE 20
          END as "cpm"
        FROM "${schemaName}"."CampaignApproval" ca
        LEFT JOIN "${schemaName}"."Campaign" c ON ca."campaignId" = c.id
        LEFT JOIN "${schemaName}"."Advertiser" a ON c."advertiserId" = a.id
        LEFT JOIN "${schemaName}"."Agency" ag ON c."agencyId" = ag.id
        LEFT JOIN public."User" u ON ca."requestedBy" = u.id
        WHERE ca.status = 'pending'
        ORDER BY ca."createdAt" DESC
      `
      
      const { data: campaignApprovals, error: campaignsError } = await safeQuerySchema<any>(schemaName, campaignsQuery, [])
      if (campaignsError) {
        console.error('Failed to fetch campaign approvals:', campaignsError)
        // Continue with empty campaign approvals instead of breaking
      } else if (campaignApprovals && campaignApprovals.length > 0) {
        // Get real show breakdown for each campaign
        const campaignsWithShows = await Promise.all(campaignApprovals.map(async (campaign) => {
        // Query campaign schedule to get show allocation
        const showBreakdownQuery = `
          SELECT 
            s.id,
            s.name,
            COUNT(DISTINCT cs.id) as spots,
            AVG(cs.rate) as rate,
            array_agg(DISTINCT cs."airDate"::text ORDER BY cs."airDate") as dates
          FROM "${schemaName}"."CampaignSchedule" cs
          INNER JOIN "${schemaName}"."Show" s ON cs."showId" = s.id
          WHERE cs."campaignId" = $1
          GROUP BY s.id, s.name
          ORDER BY COUNT(cs.id) DESC
        `
        
        const { data: showBreakdown, error: breakdownError } = await safeQuerySchema<any>(
          schemaName, 
          showBreakdownQuery, 
          [campaign.campaignId]
        )
        
        // If no breakdown data or error, return empty shows array
        if (breakdownError || !showBreakdown || showBreakdown.length === 0) {
          return {
            ...campaign,
            shows: []
          }
        }
        
        return {
          ...campaign,
          shows: showBreakdown.map((show: any) => ({
            id: show.id,
            name: show.name,
            spots: parseInt(show.spots) || 0,
            rate: parseFloat(show.rate) || campaign.negotiatedRate,
            dates: show.dates || []
          }))
        }
        }))
        
        approvals = [...approvals, ...campaignsWithShows]
      }
    }

    // Get pending deletion requests (only for 'all' type)
    if (type === 'all' || type === 'deletions') {
      const deletionQuery = `
        SELECT 
          dr.id as "approvalId",
          'deletion' as type,
          dr."entityType",
          dr."entityId",
          dr."entityName" as "campaignName",
          dr."entityValue" as budget,
          COALESCE(dr."entityValue", 0) as "negotiatedRate",
          0 as probability,
          'pending' as status,
          NOW() as "startDate",
          NOW() as "endDate",
          u.name as "createdBy",
          dr."requestedAt" as "createdAt",
          dr.reason as "advertiserName",
          '' as "agencyName",
          100 as "rateAchievement",
          0 as "totalSpots",
          0 as "totalImpressions",
          0 as "cpm",
          0 as "rateCardRate"
        FROM public."DeletionRequest" dr
        LEFT JOIN public."User" u ON dr."requestedBy" = u.id
        WHERE dr.status = 'pending'
        ORDER BY dr."requestedAt" DESC
      `
      
      const { data: deletionRequests, error: deletionError } = await safeQuerySchema<any>('public', deletionQuery, [])
      if (deletionError) {
        console.error('Failed to fetch deletion requests:', deletionError)
      } else if (deletionRequests && deletionRequests.length > 0) {
        // Format deletion requests to match the approval structure
        const formattedDeletions = deletionRequests.map(dr => ({
          ...dr,
          shows: [] // Deletion requests don't have shows
        }))
        approvals = [...approvals, ...formattedDeletions]
      }
    }

    // Get pending reservations
    if (type === 'all' || type === 'reservations') {
      const reservationsQuery = `
        SELECT 
          r.id,
          'reservation' as type,
          r."campaignId",
          COALESCE(c.name, 'Direct Reservation') as "campaignName",
          a.name as "advertiserName",
          ag.name as "agencyName",
          r.status,
          COALESCE(c.probability, 50) as probability,
          r."totalAmount" as budget,
          COALESCE(c."startDate", r."createdAt") as "startDate",
          COALESCE(c."endDate", r."expiresAt") as "endDate",
          u.name as "createdBy",
          r."createdAt",
          -- Calculate rate achievement
          100 as "rateCardRate",
          85 as "negotiatedRate",
          85 as "rateAchievement",
          COUNT(ri.id) as "totalSpots",
          COUNT(ri.id) * 1000 as "totalImpressions",
          20 as "cpm"
        FROM "${schemaName}"."Reservation" r
        LEFT JOIN "${schemaName}"."Campaign" c ON r."campaignId" = c.id
        LEFT JOIN "${schemaName}"."Advertiser" a ON r."advertiserId" = a.id
        LEFT JOIN "${schemaName}"."Agency" ag ON r."agencyId" = ag.id
        LEFT JOIN public."User" u ON r."createdBy" = u.id
        LEFT JOIN "${schemaName}"."ReservationItem" ri ON r.id = ri."reservationId"
        WHERE r.status = 'held'
        AND r."organizationId" = $1
        GROUP BY r.id, c.name, c.probability, c."startDate", c."endDate", a.name, ag.name, u.name
        ORDER BY r."createdAt" DESC
      `
      
      const { data: reservationApprovals, error: reservationsError } = await safeQuerySchema<any>(schemaName, reservationsQuery, [session.organizationId])
      if (reservationsError) {
        console.error('Failed to fetch reservation approvals:', reservationsError)
        // Continue with empty reservation approvals instead of breaking
      } else if (reservationApprovals && reservationApprovals.length > 0) {
        // Get show breakdown for each reservation
        const reservationsWithShows = await Promise.all(reservationApprovals.map(async (reservation) => {
        const showsQuery = `
          SELECT 
            s.id,
            s.name,
            COUNT(ri.id) as spots,
            AVG(ri.rate) as rate,
            array_agg(DISTINCT ri.date::text) as dates
          FROM "${schemaName}"."ReservationItem" ri
          INNER JOIN "${schemaName}"."Show" s ON ri."showId" = s.id
          WHERE ri."reservationId" = $1
          GROUP BY s.id, s.name
        `
        
        const { data: shows, error: showsError } = await safeQuerySchema<any>(schemaName, showsQuery, [reservation.id])
        if (showsError) {
          console.error('Failed to fetch shows for reservation:', showsError)
          return {
            ...reservation,
            shows: []
          }
        }
        
        return {
          ...reservation,
          shows: shows || []
        }
        }))
        
        approvals = [...approvals, ...reservationsWithShows]
      }
    }

    // Transform data to ensure all numeric fields are properly typed
    const transformedApprovals = approvals.map(approval => ({
      ...approval,
      budget: parseFloat(approval.budget) || 0,
      rateCardRate: parseFloat(approval.rateCardRate) || 100,
      negotiatedRate: parseFloat(approval.negotiatedRate) || 80,
      rateAchievement: parseFloat(approval.rateAchievement) || 85,
      totalSpots: parseInt(approval.totalSpots) || 0,
      totalImpressions: parseInt(approval.totalImpressions) || 0,
      cpm: parseFloat(approval.cpm) || 20,
      probability: parseInt(approval.probability) || 10
    }))

    return NextResponse.json(transformedApprovals)
  } catch (error) {
    console.error('Error fetching approvals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending approvals' },
      { status: 500 }
    )
  }
}