import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session-helper'
import { querySchema } from '@/lib/db/schema-db'
import { getUserOrgSlug } from '@/lib/db/schema-db'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET all campaign approvals
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and masters can view approvals
    if (!['admin', 'master'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgSlug = await getUserOrgSlug(session.userId)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get filter from query params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    let whereClause = ''
    if (status !== 'all') {
      whereClause = `WHERE ca.status = '${status}'`
    }

    const query = `
      SELECT 
        ca.*,
        c.name as campaign_name,
        c.budget as campaign_budget,
        c.probability as campaign_probability,
        a.name as advertiser_name,
        ag.name as agency_name,
        u.name as requested_by_name,
        au.name as approved_by_name,
        ru.name as rejected_by_name
      FROM "CampaignApproval" ca
      JOIN "Campaign" c ON c.id = ca."campaignId"
      LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
      LEFT JOIN "Agency" ag ON ag.id = c."agencyId"
      LEFT JOIN public."User" u ON u.id = ca."requestedBy"
      LEFT JOIN public."User" au ON au.id = ca."approvedBy"
      LEFT JOIN public."User" ru ON ru.id = ca."rejectedBy"
      ${whereClause}
      ORDER BY ca."createdAt" DESC
    `
    
    const approvals = await querySchema<any>(orgSlug, query, [])

    // Get counts for each status
    const countsQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM "CampaignApproval"
      GROUP BY status
    `
    const counts = await querySchema<any>(orgSlug, countsQuery, [])
    
    const statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0
    }
    
    counts?.forEach(row => {
      statusCounts[row.status] = parseInt(row.count)
    })

    return NextResponse.json({
      approvals: approvals || [],
      counts: statusCounts
    })
  } catch (error) {
    console.error('Error fetching approvals:', error)
    return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 })
  }
}