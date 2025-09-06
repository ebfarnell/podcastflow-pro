import { NextRequest, NextResponse } from 'next/server'
import { querySchema, getAllOrganizationSlugs } from '@/lib/db/schema-db'
import { z } from 'zod'

const UpdateSchema = z.object({
  actualVisits: z.number().int().min(0),
  actualConversions: z.number().int().min(0),
})

// GET /api/kpi-update/[token] - Validate token and get KPI data
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token

    // Find and validate token across all organization schemas
    // Since this is accessed by external clients, we need to search all orgs
    let updateToken: any = null
    let orgSlug: string | null = null
    
    // Get all organization slugs
    const orgSlugs = await getAllOrganizationSlugs()
    
    // Search for the token in each organization schema
    for (const slug of orgSlugs) {
      const tokenQuery = `
        SELECT 
          t.*,
          k.*,
          c.id as campaign_id,
          c.name as campaign_name,
          a.id as advertiser_id,
          a.name as advertiser_name
        FROM "KPIUpdateToken" t
        INNER JOIN "CampaignKPI" k ON k.id = t."campaignKPIId"
        INNER JOIN "Campaign" c ON c.id = k."campaignId"
        LEFT JOIN "Advertiser" a ON a.id = c."advertiserId"
        WHERE t.token = $1 AND t."isActive" = true
      `
      
      const tokens = await querySchema<any>(slug, tokenQuery, [token])
      if (tokens && tokens.length > 0) {
        updateToken = tokens[0]
        orgSlug = slug
        break
      }
    }

    if (!updateToken) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
    }

    // Check if token has expired
    if (new Date() > new Date(updateToken.expiresAt)) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    }

    // Check if token was already used
    if (updateToken.usedAt) {
      return NextResponse.json({ error: 'This link has already been used' }, { status: 410 })
    }

    // Return KPI data
    return NextResponse.json({
      campaignKPI: {
        id: updateToken.campaignKPIId,
        kpiType: updateToken.kpiType,
        goalCPA: updateToken.goalCPA,
        conversionValue: updateToken.conversionValue,
        targetVisits: updateToken.targetVisits,
        targetConversions: updateToken.targetConversions,
        actualVisits: updateToken.actualVisits,
        actualConversions: updateToken.actualConversions,
        campaign: {
          id: updateToken.campaign_id,
          name: updateToken.campaign_name,
          advertiser: updateToken.advertiser_id ? {
            id: updateToken.advertiser_id,
            name: updateToken.advertiser_name
          } : null,
        }
      },
      token: {
        clientEmail: updateToken.clientEmail,
        clientName: updateToken.clientName,
        expiresAt: updateToken.expiresAt,
      }
    })
  } catch (error) {
    console.error('Error validating KPI update token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/kpi-update/[token] - Update KPI values
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token
    const body = await request.json()

    // Validate input
    const validatedData = UpdateSchema.parse(body)

    // Find and validate token across all organization schemas
    let updateToken: any = null
    let orgSlug: string | null = null
    
    // Get all organization slugs
    const orgSlugs = await getAllOrganizationSlugs()
    
    // Search for the token in each organization schema
    for (const slug of orgSlugs) {
      const tokenQuery = `
        SELECT 
          t.*,
          k.*
        FROM "KPIUpdateToken" t
        INNER JOIN "CampaignKPI" k ON k.id = t."campaignKPIId"
        WHERE t.token = $1 AND t."isActive" = true
      `
      
      const tokens = await querySchema<any>(slug, tokenQuery, [token])
      if (tokens && tokens.length > 0) {
        updateToken = tokens[0]
        orgSlug = slug
        break
      }
    }

    if (!updateToken) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
    }

    // Check if token has expired
    if (new Date() > new Date(updateToken.expiresAt)) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    }

    // Check if token was already used
    if (updateToken.usedAt) {
      return NextResponse.json({ error: 'This link has already been used' }, { status: 410 })
    }

    // Check if client updates are allowed
    if (!updateToken.clientCanUpdate) {
      return NextResponse.json({ error: 'Client updates are not allowed for this KPI' }, { status: 403 })
    }

    // Track old values for history
    const oldValues = {
      actualVisits: updateToken.actualVisits,
      actualConversions: updateToken.actualConversions,
    }

    // Update KPI values
    const updateQuery = `
      UPDATE "CampaignKPI"
      SET 
        "actualVisits" = $1,
        "actualConversions" = $2,
        "lastClientUpdate" = NOW(),
        "lastUpdated" = NOW(),
        "updatedAt" = NOW()
      WHERE id = $3
      RETURNING *
    `
    
    const updatedKPIs = await querySchema<any>(orgSlug!, updateQuery, [
      validatedData.actualVisits,
      validatedData.actualConversions,
      updateToken.campaignKPIId
    ])
    const updatedKPI = updatedKPIs[0]

    // Mark token as used
    await querySchema(orgSlug!, 
      `UPDATE "KPIUpdateToken" SET "usedAt" = NOW() WHERE id = $1`, 
      [updateToken.id]
    )

    // Create history entry
    const historyId = `kph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const historyQuery = `
      INSERT INTO "KPIHistory" (
        id, "campaignKPIId", "changeType", "changedFields", 
        "oldValues", "newValues", "clientEmail", "updateSource", 
        comment, "ipAddress", "userAgent", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
    `
    
    await querySchema(orgSlug!, historyQuery, [
      historyId,
      updateToken.campaignKPIId,
      'client_updated',
      JSON.stringify(['actualVisits', 'actualConversions']),
      JSON.stringify(oldValues),
      JSON.stringify(validatedData),
      updateToken.clientEmail,
      'client',
      'Updated via secure client link',
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      request.headers.get('user-agent')
    ])

    // TODO: Send notification to account manager about the update

    return NextResponse.json({
      message: 'KPI updated successfully',
      kpi: updatedKPI,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 })
    }
    console.error('Error updating KPI via client token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}