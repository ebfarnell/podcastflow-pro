import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/auth/user-service'
import { getUserOrgSlug, querySchema } from '@/lib/db/schema-db'

// Force dynamic rendering for routes that use cookies/auth
export const dynamic = 'force-dynamic'


// GET handler - fetch campaign KPIs
async function getHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const campaignId = params.id

    // Fetch KPI for this campaign
    const kpiQuery = `
      SELECT * FROM "CampaignKPI" 
      WHERE "campaignId" = $1
    `
    const kpis = await querySchema<any>(orgSlug, kpiQuery, [campaignId])
    
    if (kpis.length === 0) {
      // Return empty KPI object if none exists
      return NextResponse.json({
        campaignId,
        kpiType: 'cpa',
        goalCPA: null,
        conversionValue: null,
        targetVisits: null,
        targetConversions: null,
        actualVisits: 0,
        actualConversions: 0,
        clientCanUpdate: false,
        reminderFrequency: 14,
        nextReminderDate: null
      })
    }

    const kpi = kpis[0]
    return NextResponse.json({
      id: kpi.id,
      campaignId: kpi.campaignId,
      kpiType: kpi.kpiType,
      goalCPA: kpi.goalCPA,
      conversionValue: kpi.conversionValue,
      targetVisits: kpi.targetVisits,
      targetConversions: kpi.targetConversions,
      actualVisits: kpi.actualVisits,
      actualConversions: kpi.actualConversions,
      clientCanUpdate: kpi.clientCanUpdate,
      reminderFrequency: kpi.reminderFrequency,
      nextReminderDate: kpi.nextReminderDate,
      updatedAt: kpi.updatedAt,
      createdAt: kpi.createdAt
    })
  } catch (error) {
    console.error('Error fetching campaign KPI:', error)
    return NextResponse.json(
      { error: 'Failed to fetch KPI data' },
      { status: 500 }
    )
  }
}

// POST handler - create or update campaign KPI
async function postHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authToken = request.cookies.get('auth-token')
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.validateSession(authToken.value)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgSlug = await getUserOrgSlug(user.id)
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const campaignId = params.id
    const body = await request.json()

    // Get the organization ID from the campaign
    const orgQuery = `SELECT "organizationId" FROM "Campaign" WHERE id = $1`
    const orgs = await querySchema<any>(orgSlug, orgQuery, [campaignId])
    
    if (orgs.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    const organizationId = orgs[0].organizationId

    // Check if KPI already exists
    const existingQuery = `SELECT id FROM "CampaignKPI" WHERE "campaignId" = $1`
    const existing = await querySchema<any>(orgSlug, existingQuery, [campaignId])

    if (existing.length > 0) {
      // Update existing KPI
      const updateQuery = `
        UPDATE "CampaignKPI"
        SET 
          "kpiType" = $2,
          "goalCPA" = $3,
          "conversionValue" = $4,
          "targetVisits" = $5,
          "targetConversions" = $6,
          "actualVisits" = $7,
          "actualConversions" = $8,
          "clientCanUpdate" = $9,
          "reminderFrequency" = $10,
          "nextReminderDate" = $11,
          "updatedBy" = $12,
          "updatedAt" = NOW()
        WHERE id = $1
        RETURNING *
      `
      
      const params = [
        existing[0].id,
        body.kpiType || 'cpa',
        body.goalCPA || null,
        body.conversionValue || null,
        body.targetVisits || null,
        body.targetConversions || null,
        body.actualVisits || 0,
        body.actualConversions || 0,
        body.clientCanUpdate || false,
        body.reminderFrequency || 14,
        body.nextReminderDate ? new Date(body.nextReminderDate) : null,
        user.id
      ]
      
      const result = await querySchema<any>(orgSlug, updateQuery, params)
      return NextResponse.json(result[0])
    } else {
      // Create new KPI
      const kpiId = `kpi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const createQuery = `
        INSERT INTO "CampaignKPI" (
          id, "campaignId", "organizationId", "kpiType", "goalCPA", "conversionValue",
          "targetVisits", "targetConversions", "actualVisits", "actualConversions",
          "clientCanUpdate", "reminderFrequency", "nextReminderDate",
          "updatedBy", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
        )
        RETURNING *
      `
      
      const params = [
        kpiId,
        campaignId,
        organizationId,
        body.kpiType || 'cpa',
        body.goalCPA || null,
        body.conversionValue || null,
        body.targetVisits || null,
        body.targetConversions || null,
        body.actualVisits || 0,
        body.actualConversions || 0,
        body.clientCanUpdate || false,
        body.reminderFrequency || 14,
        body.nextReminderDate ? new Date(body.nextReminderDate) : null,
        user.id
      ]
      
      const result = await querySchema<any>(orgSlug, createQuery, params)
      return NextResponse.json(result[0], { status: 201 })
    }
  } catch (error) {
    console.error('Error creating/updating campaign KPI:', error)
    return NextResponse.json(
      { error: 'Failed to save KPI data' },
      { status: 500 }
    )
  }
}

// Export handlers
export async function GET(request: NextRequest, context: { params: { id: string } }) {
  return getHandler(request, context)
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  return postHandler(request, context)
}
