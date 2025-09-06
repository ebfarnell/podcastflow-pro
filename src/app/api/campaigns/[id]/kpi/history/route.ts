import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'
import { accessLogger } from '@/lib/security/access-logger'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET /api/campaigns/[id]/kpi/history - Get KPI change history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id

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
        `/api/campaigns/${campaignId}/kpi/history`,
        request
      )
    }

    // Check if user has access to this campaign
    const campaignQuery = `SELECT id FROM "Campaign" WHERE id = $1`
    const campaigns = await querySchema<any>(orgSlug, campaignQuery, [campaignId])
    
    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get KPI for this campaign
    const kpiQuery = `SELECT id FROM "CampaignKPI" WHERE "campaignId" = $1`
    const kpis = await querySchema<any>(orgSlug, kpiQuery, [campaignId])
    
    if (!kpis || kpis.length === 0) {
      return NextResponse.json([])
    }
    const kpi = kpis[0]

    // Get history records
    const historyQuery = `
      SELECT 
        h.*,
        u.id as updater_id,
        u.name as updater_name,
        u.email as updater_email
      FROM "KPIHistory" h
      LEFT JOIN public."User" u ON u.id = h."updatedBy"
      WHERE h."campaignKPIId" = $1
      ORDER BY h."createdAt" DESC
      LIMIT 50
    `
    
    const historyRaw = await querySchema<any>(orgSlug, historyQuery, [kpi.id])
    
    // Transform to match expected format
    const history = historyRaw.map((h: any) => ({
      ...h,
      updater: h.updater_id ? {
        id: h.updater_id,
        name: h.updater_name,
        email: h.updater_email
      } : null
    }))

    return NextResponse.json(history)
  } catch (error) {
    console.error('Error fetching KPI history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
